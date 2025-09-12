import os
import sys
from flask import Flask, request, jsonify
from dotenv import load_dotenv

# 현재 파일의 디렉터리를 Python 경로에 추가하여
# Vercel 환경에서 srt.py와 ktx.py를 찾을 수 있도록 합니다.
sys.path.insert(0, os.path.dirname(__file__))

import srt
import ktx

load_dotenv()
app = Flask(__name__)

@app.route("/api/stations")
def get_stations():
    stations = {
        "SRT": srt.STATION_CODE.keys(),
        "KTX": ktx.Korail.get_station_codes(name_only=True)
    }
    return jsonify({
        "SRT": sorted(list(stations["SRT"])),
        "KTX": sorted(list(stations["KTX"]))
    })

@app.route("/api/search")
def search_trains():
    try:
        train_type = request.args.get('type')
        dep_station = request.args.get('dep')
        arr_station = request.args.get('arr')
        date_str = request.args.get('date').replace('-', '')
        time_str = request.args.get('time').replace(':', '') + '00'
        
        trains_data = []
        if train_type == 'SRT':
            srt_client = srt.SRT(srt_id="-", srt_pw="-", auto_login=False)
            # available_only 인자를 제거하여 모든 열차를 가져옵니다.
            trains = srt_client.search_train(
                dep=dep_station, arr=arr_station, date=date_str, time=time_str
            )
            for train in trains:
                trains_data.append(train.dump(format="json"))

        elif train_type == 'KTX':
            ktx_client = ktx.Korail(korail_id="-", korail_pw="-", auto_login=False)
            # include_no_seats 인자를 제거하여 모든 열차를 가져옵니다.
            trains = ktx_client.search_train(
                dep=dep_station, arr=arr_station, date=date_str, time=time_str, 
                train_type=ktx.TrainType.KTX
            )
            for train in trains:
                trains_data.append(vars(train))

        return jsonify(trains_data)

    except Exception as e:
        print(f"Error in /api/search: {e}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500

@app.route("/api/reserve", methods=['POST'])
def reserve():
    try:
        data = request.json
        train_type = data.get('train_type')
        train_info = data.get('train')
        adults = int(data.get('adults', 1))
        seat_type = data.get('seat_type')

        reservation_result = None
        if train_type == 'SRT':
            srt_id = os.environ.get('SRT_ID')
            srt_pw = os.environ.get('SRT_PW')
            if not (srt_id and srt_pw):
                raise Exception("SRT 로그인 정보가 서버에 설정되지 않았습니다.")
            
            client = srt.SRT(srt_id, srt_pw)
            all_trains = client.search_train(dep=train_info['dep_station_name'], arr=train_info['arr_station_name'], date=train_info['dep_date'], time="000000")
            
            target_train = next((t for t in all_trains if t.train_number == train_info['train_number'] and t.dep_time == train_info['dep_time']), None)
            
            if not target_train:
                raise Exception("선택한 열차를 찾을 수 없습니다.")

            passengers = [srt.Adult(adults)]
            reserve_option = srt.SeatType.GENERAL_ONLY if seat_type == 'GENERAL' else srt.SeatType.SPECIAL_ONLY
            reservation = client.reserve(target_train, passengers=passengers, option=reserve_option)
            reservation_result = reservation.dump()

        elif train_type == 'KTX':
            ktx_id = os.environ.get('KTX_ID')
            ktx_pw = os.environ.get('KTX_PW')
            if not (ktx_id and ktx_pw):
                raise Exception("KTX 로그인 정보가 서버에 설정되지 않았습니다.")

            client = ktx.Korail(ktx_id, ktx_pw)
            all_trains = client.search_train(dep=train_info['dep_name'], arr=train_info['arr_name'], date=train_info['dep_date'], time="000000", train_type=ktx.TrainType.KTX)
            
            target_train = next((t for t in all_trains if t.train_no == train_info['train_no'] and t.dep_time == train_info['dep_time']), None)

            if not target_train:
                raise Exception("선택한 열차를 찾을 수 없습니다.")
                
            passengers = [ktx.AdultPassenger(adults)]
            reserve_option = ktx.ReserveOption.GENERAL_ONLY if seat_type == 'GENERAL' else ktx.ReserveOption.SPECIAL_ONLY
            reservation = client.reserve(target_train, passengers=passengers, option=reserve_option)
            reservation_result = str(reservation)

        return jsonify({"reservation": reservation_result})

    except (srt.SRTResponseError, ktx.SoldOutError) as e:
        return jsonify({"error": str(e), "soldOut": True}), 400
    except Exception as e:
        print(f"Error in /api/reserve: {e}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500

@app.route("/api/reservations")
def get_user_reservations():
    try:
        train_type = request.args.get('type')
        reservations_data = []

        if train_type == 'SRT':
            srt_id = os.environ.get('SRT_ID')
            srt_pw = os.environ.get('SRT_PW')
            client = srt.SRT(srt_id, srt_pw)
            reservations = client.get_reservations()
            for r in reservations:
                reservations_data.append(r.dump(format="json"))

        elif train_type == 'KTX':
            ktx_id = os.environ.get('KTX_ID')
            ktx_pw = os.environ.get('KTX_PW')
            client = ktx.Korail(ktx_id, ktx_pw)
            raw_reservations = client.tickets() + client.reservations()
            for r in raw_reservations:
                reservations_data.append({
                    'details': str(r),
                    'pnr_no': r.pnr_no if hasattr(r, 'pnr_no') else r.rsv_id,
                    'is_ticket': hasattr(r, 'buyer_name')
                })

        return jsonify(reservations_data)
    except Exception as e:
        print(f"Error in /api/reservations: {e}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500

@app.route("/api/cancel", methods=['POST'])
def cancel_reservation():
    try:
        data = request.json
        train_type = data.get('train_type')
        pnr_no = data.get('pnr_no')
        is_ticket = data.get('is_ticket')
        message = ""

        if train_type == 'SRT':
            srt_id = os.environ.get('SRT_ID')
            srt_pw = os.environ.get('SRT_PW')
            client = srt.SRT(srt_id, srt_pw)
            target_reservation = next((r for r in client.get_reservations() if r.reservation_number == pnr_no), None)
            if not target_reservation:
                raise Exception("취소할 SRT 예매 내역을 찾을 수 없습니다.")
            client.cancel(target_reservation)
            message = f"SRT 예매({pnr_no})가 정상적으로 취소되었습니다."

        elif train_type == 'KTX':
            ktx_id = os.environ.get('KTX_ID')
            ktx_pw = os.environ.get('KTX_PW')
            client = ktx.Korail(ktx_id, ktx_pw)
            reservation_list = client.tickets() + client.reservations()
            target_reservation = next((r for r in reservation_list if (r.pnr_no if hasattr(r, 'pnr_no') else r.rsv_id) == pnr_no), None)
            
            if not target_reservation:
                raise Exception("취소할 KTX 예매 내역을 찾을 수 없습니다.")
            
            if is_ticket:
                client.refund(target_reservation)
            else:
                client.cancel(target_reservation)
            message = f"KTX 예매({pnr_no})가 정상적으로 취소(환불)되었습니다."

        return jsonify({"message": message})
    except Exception as e:
        print(f"Error in /api/cancel: {e}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500

