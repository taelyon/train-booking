import json # json 모듈 추가
from pywebpush import webpush, WebPushException # pywebpush 추가
import sys
import os
from flask import Flask, request, jsonify
from enum import Enum
from pathlib import Path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))
import srt
import ktx
from dotenv import load_dotenv

from srt import SRTResponseError, SRTLoginError, SRTError
from ktx import SoldOutError, KorailError, TrainType, NoResultsError, MacroError

load_dotenv()
app = Flask(__name__)
push_subscription = None

# --- Helper to add to_dict() methods to classes ---
def add_to_dict_method(cls):
    def to_dict(self):
        d = {}

        # 🔽 값을 JSON으로 변환하는 로직을 별도 함수로 분리하여 재사용성을 높였습니다. 🔽
        def serialize_value(value):
            if isinstance(value, Enum):
                return value.value
            if hasattr(value, 'to_dict'): # 객체일 경우 to_dict() 재귀 호출
                return value.to_dict()
            if isinstance(value, list): # 리스트일 경우 각 항목을 재귀적으로 변환
                return [serialize_value(item) for item in value]
            return value

        # 클래스의 속성(property)들을 처리합니다.
        for base_class in reversed(cls.__mro__):
            for attr, value in base_class.__dict__.items():
                if isinstance(value, property):
                    prop_value = getattr(self, attr)
                    d[attr] = serialize_value(prop_value) # 헬퍼 함수 사용

        # 인스턴스 변수들을 처리합니다.
        for attr, value in self.__dict__.items():
            # _로 시작하는 내부 변수는 제외하고, 호출 가능하지 않은(메서드가 아닌) 변수만 처리
            if not attr.startswith('_') and not callable(value):
                d[attr] = serialize_value(value) # 헬퍼 함수 사용

        # 대표 문자열이 있으면 추가합니다.
        if hasattr(self, '__repr__') and callable(self.__repr__):
             d['dump'] = self.__repr__()
        return d
    cls.to_dict = to_dict
    return cls

# Add .to_dict() to necessary classes from libraries
add_to_dict_method(srt.SRTTrain)
add_to_dict_method(srt.SRTReservation)
add_to_dict_method(srt.SRTTicket)
add_to_dict_method(ktx.Schedule)
add_to_dict_method(ktx.Train)
add_to_dict_method(ktx.Reservation)
add_to_dict_method(ktx.Ticket)
add_to_dict_method(ktx.Seat)

# --- API Routes ---
@app.route('/api/vapid_public_key')
def vapid_public_key():
    public_key = os.environ.get("VAPID_PUBLIC_KEY")
    if not public_key:
        return "VAPID public key not configured.", 500
    return public_key

@app.route('/api/subscribe', methods=['POST'])
def subscribe():
    global push_subscription
    push_subscription = request.json
    app.logger.info("Subscription received.")
    return jsonify({'success': True}), 201

def send_push_notification(title, body):
    global push_subscription
    if push_subscription is None:
        app.logger.warning("No push subscription available to send notification.")
        return

    try:
        webpush(
            subscription_info=push_subscription,
            data=json.dumps({"title": title, "body": body}),
            vapid_private_key=os.environ.get("VAPID_PRIVATE_KEY"),
            vapid_claims={"sub": os.environ.get("VAPID_ADMIN_EMAIL")}
        )
        app.logger.info("Push notification sent successfully.")
    except WebPushException as ex:
        app.logger.error(f"WebPushException: {ex}")
        # 푸시 구독이 만료되었을 수 있으므로 삭제
        if ex.response and ex.response.status_code == 410:
            push_subscription = None
    except Exception as e:
        app.logger.error(f"An error occurred while sending push notification: {e}")

@app.route('/api/search')
def search():
    train_type = request.args.get('type')
    dep_station = request.args.get('dep')
    arr_station = request.args.get('arr')
    date_str = request.args.get('date').replace('-', '')
    time_str = request.args.get('time').replace(':', '') + '00'

    # 프론트엔드로 보낼 기본 데이터 구조
    response_data = {
        'trains': [],
        'dep': dep_station,
        'arr': arr_station,
        'date': request.args.get('date'),
        'time': request.args.get('time'),
        'train_type': train_type,
        'adults': request.args.get('adults')
    }

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

        response_data['trains'] = [train.to_dict() for train in trains]
        return jsonify(response_data)

    except (SRTResponseError, NoResultsError) as e:
        # SRT, KTX 조회 결과가 없을 때 발생하는 오류를 여기서 처리합니다.
        # 오류 대신, 비어있는 trains 리스트를 포함한 정상 응답(200)을 보냅니다.
        app.logger.info(f"No train results: {e}") # 서버 로그에는 정보로 남김
        return jsonify(response_data)
    except MacroError as e:
        # 코레일 매크로 차단 에러 처리
        app.logger.warning(f"KTX MacroError: {e}")
        return jsonify({'error': str(e), 'error_code': 'MACRO_ERROR'}), 503
    except Exception as e:
        # 그 외 예상치 못한 다른 모든 오류는 500 오류로 처리합니다.
        app.logger.error(f"An unexpected error occurred: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/reserve', methods=['POST'])
def reserve():
    try:
        form_data = request.form
        train_type = form_data.get('type')
        dep_station = form_data.get('dep')
        arr_station = form_data.get('arr')
        date_val = form_data.get('date')
        time_val = form_data.get('time')
        if not date_val or not time_val:
            return jsonify({'error_message': '예약 요청에 날짜 또는 시간 정보가 누락되었습니다.'}), 400

        date_str = date_val.replace('-', '')
        time_str = time_val.replace(':', '') + '00'
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

        # 예매 성공 알림 보내기
        dep = target_train.dep_station_name if train_type == 'SRT' else target_train.dep_name
        arr = target_train.arr_station_name if train_type == 'SRT' else target_train.arr_name
        send_push_notification(
            title="✅ 예매 성공!",
            body=f"{dep} → {arr} 열차 예매에 성공했습니다."
        )
        return jsonify({'reservation': reservation.to_dict()})

    except (SRTLoginError) as e:
        return jsonify({'error_message': f'로그인 실패: {e}'}), 401
    except MacroError as e:
        return jsonify({'error_message': f'코레일 서버 차단: {e}', 'error_code': 'MACRO_ERROR'}), 503
    except (SRTResponseError, SoldOutError, SRTError, KorailError) as e:
        msg = str(e)
        if "잔여석없음" in msg or "Sold out" in msg or "매진" in msg:
            return jsonify({'retry': True, 'message': '매진. 5초 후 재시도합니다.'})
        if isinstance(e, KorailError):
            return jsonify({'error_message': f'오류: {e}'}), 401
        return jsonify({'error_message': msg}), 500
    except Exception as e:
        return jsonify({'error_message': str(e)}), 500

@app.route('/api/auto-retry', methods=['POST'])
def auto_retry():
    form_data = request.form
    try:
        train_type = form_data.get('type')
        dep, arr = form_data.get('dep'), form_data.get('arr')
        date_val = form_data.get('date')
        time_val = form_data.get('time')
        if not date_val or not time_val:
            return jsonify({'error_message': '자동 재시도를 위한 날짜 또는 시간 정보가 없습니다.'}), 400

        date, time = date_val.replace('-', ''), time_val.replace(':', '') + '00'
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
        # 예매 성공 알림 보내기
        dep = target_train.dep_station_name if train_type == 'SRT' else target_train.dep_name
        arr = target_train.arr_station_name if train_type == 'SRT' else target_train.arr_name
        send_push_notification(
            title="✅ 예매 성공!",
            body=f"{dep} → {arr} 열차 예매에 성공했습니다."
        )
        return jsonify({'reservation': reservation.to_dict()})

    except (SRTResponseError, SoldOutError, SRTError, KorailError) as e:
        msg = str(e)
        if "잔여석없음" in msg or "Sold out" in msg or "매진" in msg:
            return jsonify({'retry': True, 'message': '매진. 5초 후 재시도합니다.'})
        return jsonify({'error_message': msg}), 500
    except MacroError as e:
        return jsonify({'error_message': f'코레일 서버 차단: {e}', 'error_code': 'MACRO_ERROR'}), 503
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

@app.route('/api/pay', methods=['POST'])
def pay():
    try:
        data = request.form
        train_type = data.get('train_type')
        pnr_no = data.get('pnr_no')

        if not train_type or not pnr_no:
            return jsonify({'error_message': "결제 요청에 필요한 정보가 누락되었습니다."}), 400

        if train_type == 'SRT':
            client = srt.SRT(os.environ.get('SRT_ID'), os.environ.get('SRT_PW'))
            reservations = client.get_reservations()
            target = next((r for r in reservations if r.reservation_number == pnr_no), None)
            
            if not target:
                return jsonify({'error_message': "결제할 SRT 예매 내역을 찾을 수 없습니다."}), 404
            
            client.pay_with_card(
                target,
                number=data.get('card_number'),
                password=data.get('card_password'),
                validation_number=data.get('card_birthday'),
                expire_date=data.get('card_expire_date')
            )
            return jsonify({'message': f"SRT 예매({pnr_no})가 정상적으로 결제되었습니다."})

        elif train_type == 'KTX':
            client = ktx.Korail(os.environ.get('KTX_ID'), os.environ.get('KTX_PW'))
            reservations = client.reservations()
            target = next((r for r in reservations if r.rsv_id == pnr_no), None)

            if not target:
                return jsonify({'error_message': "결제할 KTX 예매 내역을 찾을 수 없습니다."}), 404

            client.pay_with_card(
                target,
                card_number=data.get('card_number'),
                card_password=data.get('card_password'),
                birthday=data.get('card_birthday'),
                card_expire=data.get('card_expire_date')
            )
            return jsonify({'message': f"KTX 예매({pnr_no})가 정상적으로 결제되었습니다."})
        
        else:
            return jsonify({'error_message': f"알 수 없는 열차 종류({train_type})입니다."}), 400
            
    except Exception as e:
        app.logger.error(f"An unexpected error occurred during payment: {e}", exc_info=True)
        return jsonify({'error_message': str(e)}), 500

@app.route('/api/cancel', methods=['POST'])
def cancel():
    try:
        data = request.form
        train_type = data.get('train_type')
        pnr_no = data.get('pnr_no')
        is_ticket = data.get('is_ticket', 'false').lower() == 'true'

        if not train_type or not pnr_no:
            return jsonify({'error_message': "취소 요청에 필요한 정보가 누락되었습니다."}), 400

        if train_type == 'SRT':
            client = srt.SRT(os.environ.get('SRT_ID'), os.environ.get('SRT_PW'))
            reservations = client.get_reservations()
            target = next((r for r in reservations if r.reservation_number == pnr_no), None)
            
            if not target:
                return jsonify({'error_message': "취소할 SRT 예매 내역을 찾을 수 없습니다."}), 404
            
            if is_ticket:
                client.refund(target)
            else:
                client.cancel(target)
            
            return jsonify({'message': f"SRT 예매({pnr_no})가 정상적으로 취소(환불)되었습니다."})

        elif train_type == 'KTX':
            client = ktx.Korail(os.environ.get('KTX_ID'), os.environ.get('KTX_PW'))
            reservations = client.tickets() + client.reservations()
            target = next((r for r in reservations if (hasattr(r, 'pnr_no') and r.pnr_no == pnr_no) or (hasattr(r, 'rsv_id') and r.rsv_id == pnr_no)), None)
            
            if not target:
                return jsonify({'error_message': "취소할 KTX 예매 내역을 찾을 수 없습니다."}), 404
            
            if is_ticket:
                client.refund(target)
            else:
                client.cancel(target)
            
            return jsonify({'message': f"KTX 예매({pnr_no})가 정상적으로 취소(환불)되었습니다."})
        
        else:
            return jsonify({'error_message': f"알 수 없는 열차 종류({train_type})입니다."}), 400
            
    except Exception as e:
        app.logger.error(f"An unexpected error occurred during cancellation: {e}", exc_info=True)
        return jsonify({'error_message': str(e)}), 500