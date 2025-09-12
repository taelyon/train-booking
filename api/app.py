import os
from flask import Flask, request, jsonify
from enum import Enum
import srt
import ktx
from dotenv import load_dotenv

from srt import SRTResponseError, SRTLoginError, SRTError
from ktx import SoldOutError, KorailError, TrainType

load_dotenv()
app = Flask(__name__)

# --- Helper to add to_dict() methods to classes ---
def add_to_dict_method(cls):
    def to_dict(self):
        d = {}
        # Add attributes from all parent classes as well
        for base_class in reversed(cls.__mro__):
            for attr, value in base_class.__dict__.items():
                if isinstance(value, property):
                     d[attr] = getattr(self, attr)

        for attr, value in self.__dict__.items():
            if not attr.startswith('_') and not callable(value):
                if isinstance(value, Enum):
                    d[attr] = value.value
                elif hasattr(value, 'to_dict'): # For nested objects
                    d[attr] = value.to_dict()
                else:
                    d[attr] = value

        # Use __repr__ as a fallback for a descriptive string
        if hasattr(self, '__repr__') and callable(self.__repr__):
             d['dump'] = self.__repr__()
        return d
    cls.to_dict = to_dict
    return cls

# Add .to_dict() to necessary classes from libraries
add_to_dict_method(srt.SRTTrain)
add_to_dict_method(srt.SRTReservation)
add_to_dict_method(ktx.Schedule)
add_to_dict_method(ktx.Train)
add_to_dict_method(ktx.Reservation)
add_to_dict_method(ktx.Ticket)


# --- API Routes ---

@app.route('/api/search')
def search():
    train_type = request.args.get('type')
    dep_station = request.args.get('dep')
    arr_station = request.args.get('arr')
    date_str = request.args.get('date').replace('-', '')
    time_str = request.args.get('time').replace(':', '') + '00'

    try:
        trains = []
        if train_type == 'SRT':
            srt_client = srt.SRT(srt_id="-", srt_pw="-", auto_login=False)
            trains = srt_client.search_train(
                dep=dep_station, arr=arr_station, date=date_str, time=time_str, available_only=False
            )
        elif train_type == 'KTX':
            ktx_client = ktx.Korail(korail_id="-", korail_pw="-", auto_login=False)
            trains = ktx_client.search_train(
                dep=dep_station, arr=arr_station, date=date_str, time=time_str, 
                include_no_seats=True,
                train_type=ktx.TrainType.KTX
            )
        
        trains_list = [train.to_dict() for train in trains]
        return jsonify({
            'trains': trains_list,
            'dep': dep_station,
            'arr': arr_station,
            'date': request.args.get('date'),
            'time': request.args.get('time'),
            'train_type': train_type,
            'adults': request.args.get('adults')
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reserve', methods=['POST'])
def reserve():
    try:
        form_data = request.form
        train_type = form_data.get('type')
        dep_station = form_data.get('dep')
        arr_station = form_data.get('arr')
        date_str = form_data.get('date').replace('-', '')
        time_str = form_data.get('time').replace(':', '') + '00'
        train_number = form_data.get('train_number')
        adults = int(form_data.get('adults', 1))
        seat_type = form_data.get('seat_type')

        client, passengers, reserve_option, all_trains = (None, [], None, [])
        
        if train_type == 'SRT':
            srt_id, srt_pw = os.environ.get('SRT_ID'), os.environ.get('SRT_PW')
            if not (srt_id and srt_pw): return jsonify({'error_message': "SRT 로그인 정보가 서버에 설정되지 않았습니다."}), 400
            client = srt.SRT(srt_id, srt_pw)
            all_trains = client.search_train(dep=dep_station, arr=arr_station, date=date_str, time=time_str, available_only=False)
            passengers = [srt.Adult(adults)]
            reserve_option = srt.SeatType.GENERAL_ONLY if seat_type == 'GENERAL' else srt.SeatType.SPECIAL_ONLY

        elif train_type == 'KTX':
            ktx_id, ktx_pw = os.environ.get('KTX_ID'), os.environ.get('KTX_PW')
            if not (ktx_id and ktx_pw): return jsonify({'error_message': "KTX 로그인 정보가 서버에 설정되지 않았습니다."}), 400
            client = ktx.Korail(ktx_id, ktx_pw)
            all_trains = client.search_train(dep=dep_station, arr=arr_station, date=date_str, time=time_str, include_no_seats=True, train_type=ktx.TrainType.KTX)
            passengers = [ktx.AdultPassenger(adults)]
            reserve_option = ktx.ReserveOption.GENERAL_ONLY if seat_type == 'GENERAL' else ktx.ReserveOption.SPECIAL_ONLY
        
        target_train = next((train for train in all_trains if (train.train_number if train_type == 'SRT' else train.train_no) == train_number), None)
        
        if not target_train: return jsonify({'error_message': "선택한 열차를 찾을 수 없습니다."}), 404

        reservation = client.reserve(target_train, passengers=passengers, option=reserve_option)
        return jsonify({'reservation': reservation.to_dict()})

    except (SRTLoginError, KorailError) as e: return jsonify({'error_message': f'로그인 실패: {e}'}), 401
    except Exception as e: return jsonify({'error_message': str(e)}), 500

@app.route('/api/auto-retry', methods=['POST'])
def auto_retry():
    form_data = request.form
    try:
        train_type = form_data.get('type')
        dep, arr = form_data.get('dep'), form_data.get('arr')
        date, time = form_data.get('date').replace('-', ''), form_data.get('time').replace(':', '') + '00'
        train_number = form_data.get('train_number')
        adults = int(form_data.get('adults', 1))
        seat_type = form_data.get('seat_type', 'GENERAL')

        client, search_options, passengers, reserve_option = (None, {}, [], None)

        if train_type == 'SRT':
            client = srt.SRT(os.environ.get('SRT_ID'), os.environ.get('SRT_PW'))
            search_options, passengers = {'available_only': False}, [srt.Adult(adults)]
            reserve_option = srt.SeatType.GENERAL_ONLY if seat_type == 'GENERAL' else srt.SeatType.SPECIAL_ONLY
        elif train_type == 'KTX':
            client = ktx.Korail(os.environ.get('KTX_ID'), os.environ.get('KTX_PW'))
            search_options = {'include_no_seats': True, 'train_type': ktx.TrainType.KTX}
            passengers, reserve_option = [ktx.AdultPassenger(adults)], ktx.ReserveOption.GENERAL_ONLY if seat_type == 'GENERAL' else ktx.ReserveOption.SPECIAL_ONLY

        all_trains = client.search_train(dep=dep, arr=arr, date=date, time=time, **search_options)
        target_train = next((t for t in all_trains if (t.train_number if train_type == 'SRT' else t.train_no) == train_number), None)
        if not target_train: return jsonify({'error_message': "선택한 열차를 찾을 수 없습니다."}), 404
        
        reservation = client.reserve(target_train, passengers=passengers, option=reserve_option)
        return jsonify({'reservation': reservation.to_dict()})

    except (SRTResponseError, SoldOutError, SRTError, KorailError) as e:
        msg = str(e)
        if "잔여석없음" in msg or "Sold out" in msg or "매진" in msg:
            return jsonify({'retry': True, 'message': '매진. 5초 후 재시도합니다.'})
        return jsonify({'error_message': msg}), 500
    except Exception as e: return jsonify({'error_message': str(e)}), 500

@app.route('/api/reservations')
def reservations():
    results = {'srt_reservations': [], 'ktx_reservations': [], 'srt_error': None, 'ktx_error': None}
    try:
        client = srt.SRT(os.environ.get('SRT_ID'), os.environ.get('SRT_PW'))
        results['srt_reservations'] = [r.to_dict() for r in client.get_reservations()]
    except Exception as e: results['srt_error'] = str(e)
    try:
        client = ktx.Korail(os.environ.get('KTX_ID'), os.environ.get('KTX_PW'))
        raw = client.tickets() + client.reservations()
        results['ktx_reservations'] = [r.to_dict() for r in raw]
    except Exception as e: results['ktx_error'] = str(e)
    return jsonify(results)

@app.route('/api/cancel', methods=['POST'])
def cancel():
    try:
        data = request.form
        train_type, pnr_no = data.get('train_type'), data.get('pnr_no')
        
        if train_type == 'SRT':
            client = srt.SRT(os.environ.get('SRT_ID'), os.environ.get('SRT_PW'))
            target = next((r for r in client.get_reservations() if r.reservation_number == pnr_no), None)
            if not target: return jsonify({'error_message': "취소할 SRT 예매 내역을 찾을 수 없습니다."}), 404
            client.cancel(target)
            return jsonify({'message': f"SRT 예매({pnr_no})가 정상적으로 취소되었습니다."})

        elif train_type == 'KTX':
            client = ktx.Korail(os.environ.get('KTX_ID'), os.environ.get('KTX_PW'))
            is_ticket = data.get('is_ticket') == 'True'
            reservations = client.tickets() + client.reservations()
            target = next((r for r in reservations if (r.pnr_no if hasattr(r, 'pnr_no') else r.rsv_id) == pnr_no), None)
            if not target: return jsonify({'error_message': "취소할 KTX 예매 내역을 찾을 수 없습니다."}), 404
            if is_ticket: client.refund(target)
            else: client.cancel(target)
            return jsonify({'message': f"KTX 예매({pnr_no})가 정상적으로 취소(환불)되었습니다."})
            
    except Exception as e: return jsonify({'error_message': str(e)}), 500
