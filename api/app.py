import json # json 모듈 추가
from pywebpush import webpush, WebPushException # pywebpush 추가
import sys
import os
import uuid
import threading
import time
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

import logging
from logging.handlers import RotatingFileHandler

load_dotenv()
app = Flask(__name__, static_folder='../dist', static_url_path='/')

# 로그 설정 (train-booking.log 파일로 저장, 5MB 제한, 3개 백업)
LOG_DIR = os.path.join(current_dir, '../logs')
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, 'train-booking.log')

handler = RotatingFileHandler(LOG_FILE, maxBytes=5000000, backupCount=3, encoding='utf-8')
handler.setLevel(logging.INFO)
formatter = logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s: %(message)s')
handler.setFormatter(formatter)
app.logger.addHandler(handler)
app.logger.setLevel(logging.INFO)
app.logger.info('Train booking app started')

push_subscription = None

# 자동 예매 태스크 관리 전역 변수
# 형태: { 'task_id': { 'status': 'running'|'stopped'|'success'|'failed', 'thread': <Thread>, 'details': {...} } }
active_auto_reserves = {}

TASKS_FILE = os.path.join(current_dir, '../data/tasks.json')
os.makedirs(os.path.dirname(TASKS_FILE), exist_ok=True)

def save_tasks():
    tasks_to_save = {}
    for task_id, task in active_auto_reserves.items():
        if task['status'] == 'running':
            tasks_to_save[task_id] = {
                'status': task['status'],
                'details': task['details'],
                'message': task['message']
            }
    try:
        with open(TASKS_FILE, 'w', encoding='utf-8') as f:
            json.dump(tasks_to_save, f, ensure_ascii=False)
    except Exception as e:
        app.logger.error(f"Failed to save tasks: {e}")

def load_and_resume_tasks():
    if not os.path.exists(TASKS_FILE):
        return
    try:
        with open(TASKS_FILE, 'r', encoding='utf-8') as f:
            saved_tasks = json.load(f)
        for task_id, task in saved_tasks.items():
            active_auto_reserves[task_id] = task
            details = task['details']
            thread = threading.Thread(target=auto_reserve_worker, args=(
                task_id, details['train_type'], details['dep'], details['arr'], 
                details['date'], details['time'], details['train_number'], 
                details['adults'], details['seat_type'], details['auth']
            ))
            thread.daemon = True
            active_auto_reserves[task_id]['thread'] = thread
            thread.start()
        app.logger.info(f"Resumed {len(saved_tasks)} tasks from {TASKS_FILE}")
    except Exception as e:
        app.logger.error(f"Failed to load tasks: {e}")

load_and_resume_tasks()

# --- 클라이언트 캐싱 (매번 로그인하지 않고 세션 재사용) ---
import time as _time

_cached_clients = {
    'srt': {'client': None, 'login_time': 0},
    'ktx': {'client': None, 'login_time': 0},
}
_CLIENT_TTL = 600  # 10분간 세션 유지

def get_srt_client(force_login=False, user_id=None, user_pw=None):
    """SRT 클라이언트를 캐싱하여 반복 로그인을 방지합니다."""
    cache = _cached_clients['srt']
    now = _time.time()
    
    # 전달받은 아이디/비번이 없으면 환경변수 사용
    final_id = user_id or os.environ.get('SRT_ID')
    final_pw = user_pw or os.environ.get('SRT_PW')

    # 캐시된 클라이언트가 있고, 아이디가 같고, 시간이 유효하면 캐시 반환
    if not force_login and cache['client'] and cache.get('id') == final_id and (now - cache['login_time']) < _CLIENT_TTL:
        return cache['client']
    
    if not (final_id and final_pw):
        raise ValueError("SRT 로그인 정보가 없습니다. 관리 탭에서 설정해 주세요.")
    
    client = srt.SRT(final_id, final_pw)
    cache['client'] = client
    cache['id'] = final_id
    cache['login_time'] = now
    return client

def get_ktx_client(force_login=False, user_id=None, user_pw=None):
    """KTX(코레일) 클라이언트를 캐싱하여 반복 로그인을 방지합니다."""
    cache = _cached_clients['ktx']
    now = _time.time()

    final_id = user_id or os.environ.get('KTX_ID')
    final_pw = user_pw or os.environ.get('KTX_PW')

    if not force_login and cache['client'] and cache['client'].logined and cache.get('id') == final_id and (now - cache['login_time']) < _CLIENT_TTL:
        return cache['client']
    
    if not (final_id and final_pw):
        raise ValueError("KTX 로그인 정보가 없습니다. 관리 탭에서 설정해 주세요.")
    
    client = ktx.Korail(final_id, final_pw)
    cache['client'] = client
    cache['id'] = final_id
    cache['login_time'] = now
    return client

# 검색전용 캐싱 클라이언트 (로그인 없이 세션/기기ID만 유지)
_cached_search_clients = {
    'srt': None,
    'ktx': None,
}

def get_ktx_search_client():
    """검색용 KTX 클라이언트 (로그인 없이 세션/기기ID 일관성 유지)"""
    if _cached_search_clients['ktx'] is None:
        _cached_search_clients['ktx'] = ktx.Korail(korail_id="-", korail_pw="-", auto_login=False)
    return _cached_search_clients['ktx']

def get_srt_search_client():
    """검색용 SRT 클라이언트 (로그인 없이 세션 일관성 유지)"""
    if _cached_search_clients['srt'] is None:
        _cached_search_clients['srt'] = srt.SRT(srt_id="-", srt_pw="-", auto_login=False)
    return _cached_search_clients['srt']

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

@app.route('/api/config')
def get_config():
    return jsonify({
        'ktxId': os.environ.get('KTX_ID', ''),
        'ktxPw': os.environ.get('KTX_PW', ''),
        'srtId': os.environ.get('SRT_ID', ''),
        'srtPw': os.environ.get('SRT_PW', '')
    })

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

def get_auth_from_headers():
    """헤더에서 KTX/SRT 계정 정보를 추출합니다."""
    return {
        'ktx_id': request.headers.get('X-KTX-ID'),
        'ktx_pw': request.headers.get('X-KTX-PW'),
        'srt_id': request.headers.get('X-SRT-ID'),
        'srt_pw': request.headers.get('X-SRT-PW')
    }

@app.route('/api/search')
def search():
    train_type = request.args.get('type')
    dep_station = request.args.get('dep')
    arr_station = request.args.get('arr')
    date_str = request.args.get('date').replace('-', '')
    time_str = request.args.get('time').replace(':', '') + '00'

    auth = get_auth_from_headers()

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
        all_trains = []
        seen_train_nos = set()
        current_time = time_str

        while True:
            trains_page = []
            try:
                if train_type == 'SRT':
                    srt_client = get_srt_search_client()
                    trains_page = srt_client.search_train(
                        dep=dep_station, arr=arr_station, date=date_str, time=current_time, available_only=False
                    )
                elif train_type == 'KTX':
                    ktx_client = get_ktx_search_client()
                    trains_page = ktx_client.search_train(
                        dep=dep_station, arr=arr_station, date=date_str, time=current_time,
                        include_no_seats=True,
                        train_type=ktx.TrainType.KTX
                    )
            except (SRTResponseError, NoResultsError) as e:
                # No more trains for the day
                break

            new_trains = []
            for t in trains_page:
                t_no = t.train_number if train_type == 'SRT' else t.train_no
                t_date = t.dep_date if train_type == 'SRT' else t.dep_date
                if t_date != date_str:
                    continue
                if t_no not in seen_train_nos:
                    seen_train_nos.add(t_no)
                    new_trains.append(t)
            
            import sys
            print(f"DEBUG: current_time={current_time}, got {len(trains_page)} trains, {len(new_trains)} new. Total={len(all_trains)+len(new_trains)}", file=sys.stderr, flush=True)

            if not new_trains:
                break
                
            all_trains.extend(new_trains)
            
            last_train = new_trains[-1]
            if last_train.dep_time >= "235000":
                break
                
            hh = int(last_train.dep_time[:2])
            mm = int(last_train.dep_time[2:4])
            ss = int(last_train.dep_time[4:])
            mm += 1
            if mm >= 60:
                hh += 1
                mm -= 60
            current_time = f"{hh:02d}{mm:02d}{ss:02d}"

        response_data['trains'] = [train.to_dict() for train in all_trains]
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

        auth = get_auth_from_headers()
        if train_type == 'SRT':
            client = get_srt_client(user_id=auth['srt_id'], user_pw=auth['srt_pw'])
            all_trains = client.search_train(dep=dep_station, arr=arr_station, date=date_str, time=time_str, available_only=False)
            passengers = [srt.Adult(adults)]
            reserve_option = srt.SeatType.GENERAL_ONLY if seat_type == 'GENERAL' else srt.SeatType.SPECIAL_ONLY

        elif train_type == 'KTX':
            client = get_ktx_client(user_id=auth['ktx_id'], user_pw=auth['ktx_pw'])
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
        # 매진뿐만 아니라 예약대기 한도 초과 시에도 멈추지 않고 계속 재시도하도록 수정
        if any(keyword in msg for keyword in ["잔여석없음", "Sold out", "매진", "한도수 초과", "예약대기"]):
            return jsonify({'retry': True, 'message': '매진 또는 예약대기 한도 초과. 5초 후 재시도합니다.'})
        if isinstance(e, KorailError):
            return jsonify({'error_message': f'오류: {e}'}), 401
        return jsonify({'error_message': msg}), 500
    except Exception as e:
        return jsonify({'error_message': str(e)}), 500

def auto_reserve_worker(task_id, train_type, dep, arr, date, time_val, train_number, adults, seat_type, auth_dict):
    task = active_auto_reserves.get(task_id)
    if not task: return

    date_str = date.replace('-', '')
    time_str = time_val.replace(':', '') + '00'
    
    app.logger.info(f"Task {task_id} started.")

    while task['status'] == 'running':
        try:
            client, search_options, passengers, reserve_option = (None, {}, [], None)
            
            if train_type == 'SRT':
                client = get_srt_client(user_id=auth_dict['srt_id'], user_pw=auth_dict['srt_pw'])
                search_options, passengers = {'available_only': False}, [srt.Adult(adults)]
                reserve_option = srt.SeatType.GENERAL_ONLY if seat_type == 'GENERAL' else srt.SeatType.SPECIAL_ONLY
            elif train_type == 'KTX':
                client = get_ktx_client(user_id=auth_dict['ktx_id'], user_pw=auth_dict['ktx_pw'])
                search_options = {'include_no_seats': True, 'train_type': ktx.TrainType.KTX}
                passengers, reserve_option = [ktx.AdultPassenger(adults)], ktx.ReserveOption.GENERAL_ONLY if seat_type == 'GENERAL' else ktx.ReserveOption.SPECIAL_ONLY

            all_trains = client.search_train(dep=dep, arr=arr, date=date_str, time=time_str, **search_options)
            target_train = next((t for t in all_trains if (t.train_number if train_type == 'SRT' else t.train_no) == train_number), None)
            
            if not target_train:
                task['status'] = 'failed'
                task['message'] = "선택한 열차를 찾을 수 없습니다."
                app.logger.error(f"Task {task_id} failed: target train not found")
                break

            reservation = client.reserve(target_train, passengers=passengers, option=reserve_option)
            
            task['status'] = 'success'
            task['message'] = "예매 성공"
            
            # 예매 성공 알림 보내기
            d_name = target_train.dep_station_name if train_type == 'SRT' else target_train.dep_name
            a_name = target_train.arr_station_name if train_type == 'SRT' else target_train.arr_name
            send_push_notification(
                title="✅ 예매 성공!",
                body=f"{d_name} → {a_name} ({train_number}) 자동 예매에 성공했습니다."
            )
            app.logger.info(f"Task {task_id} success.")
            break

        except (SRTResponseError, SoldOutError, SRTError, KorailError) as e:
            msg = str(e)
            if any(keyword in msg for keyword in ["잔여석없음", "Sold out", "매진", "한도수 초과", "예약대기"]):
                # 매진 시 5초 대기 후 계속 재시도
                time.sleep(5)
                continue
            else:
                task['status'] = 'failed'
                task['message'] = msg
                app.logger.error(f"Task {task_id} error: {msg}")
                break
        except MacroError as e:
            task['status'] = 'failed'
            task['message'] = f'코레일 서버 차단: {e}'
            app.logger.error(f"Task {task_id} MacroError: {e}")
            break
        except Exception as e:
            task['status'] = 'failed'
            task['message'] = str(e)
            app.logger.error(f"Task {task_id} unexpected error: {e}")
            break

    # 스레드 종료 시 (성공, 실패 모두) 상태 파일 업데이트
    save_tasks()

@app.route('/api/start-auto-reserve', methods=['POST'])
def start_auto_reserve():
    form_data = request.form
    try:
        train_type = form_data.get('type')
        dep, arr = form_data.get('dep'), form_data.get('arr')
        date_val, time_val = form_data.get('date'), form_data.get('time')
        train_number = form_data.get('train_number')
        adults = int(form_data.get('adults', 1))
        seat_type = form_data.get('seat_type', 'GENERAL')

        if not date_val or not time_val or not train_number:
            return jsonify({'error_message': '자동 예매를 위한 필수 정보가 누락되었습니다.'}), 400

        auth = get_auth_from_headers()
        
        task_id = str(uuid.uuid4())
        task_details = {
            'train_type': train_type,
            'dep': dep,
            'arr': arr,
            'date': date_val,
            'time': time_val,
            'train_number': train_number,
            'seat_type': seat_type,
            'adults': adults,
            'auth': auth
        }
        
        active_auto_reserves[task_id] = {
            'status': 'running',
            'details': task_details,
            'message': '시도 중...'
        }
        
        thread = threading.Thread(target=auto_reserve_worker, args=(task_id, train_type, dep, arr, date_val, time_val, train_number, adults, seat_type, auth))
        thread.daemon = True
        active_auto_reserves[task_id]['thread'] = thread
        thread.start()
        
        save_tasks()
        
        return jsonify({'message': '백그라운드 자동 예매가 시작되었습니다.', 'task_id': task_id})

    except Exception as e:
        return jsonify({'error_message': str(e)}), 500

@app.route('/api/stop-auto-reserve', methods=['POST'])
def stop_auto_reserve():
    task_id = request.form.get('task_id')
    auth = get_auth_from_headers()
    
    if task_id in active_auto_reserves:
        task = active_auto_reserves[task_id]
        if task['details']['auth'] == auth:
            task['status'] = 'stopped'
            task['message'] = '사용자가 중단함'
            save_tasks()
            return jsonify({'message': '자동 예매가 중단되었습니다.'})
        else:
            return jsonify({'error_message': '권한이 없습니다.'}), 403
    return jsonify({'error_message': '해당 작업을 찾을 수 없습니다.'}), 404

@app.route('/api/auto-reserve-status')
def auto_reserve_status():
    auth = get_auth_from_headers()
    my_tasks = []
    
    for t_id, task in list(active_auto_reserves.items()):
        if task['details']['auth'] == auth:
            my_tasks.append({
                'task_id': t_id,
                'status': task['status'],
                'message': task['message'],
                'train_type': task['details']['train_type'],
                'dep': task['details']['dep'],
                'arr': task['details']['arr'],
                'date': task['details']['date'],
                'time': task['details']['time'],
                'train_number': task['details']['train_number']
            })
    return jsonify({'tasks': my_tasks})

@app.route('/api/reservations')
def reservations():
    results = {'srt_reservations': [], 'ktx_reservations': [], 'srt_error': None, 'ktx_error': None}
    auth = get_auth_from_headers()
    try:
        client = get_srt_client(user_id=auth['srt_id'], user_pw=auth['srt_pw'])
        results['srt_reservations'] = [r.to_dict() for r in client.get_reservations()]
    except Exception as e: results['srt_error'] = str(e)
    try:
        client = get_ktx_client(user_id=auth['ktx_id'], user_pw=auth['ktx_pw'])
        raw = []
        try:
            raw.extend(client.tickets())
        except Exception as e:
            app.logger.warning(f"Failed to fetch KTX tickets (might be deprecated or need login): {e}")
        try:
            raw.extend(client.reservations())
        except Exception as e:
            app.logger.warning(f"Failed to fetch KTX reservations: {e}")
            results['ktx_error'] = str(e)
        
        results['ktx_reservations'] = [r.to_dict() for r in raw]
    except Exception as e: 
        results['ktx_error'] = str(e)
    return jsonify(results)

@app.route('/api/pay', methods=['POST'])
def pay():
    try:
        data = request.form
        train_type = data.get('train_type')
        pnr_no = data.get('pnr_no')

        if not train_type or not pnr_no:
            return jsonify({'error_message': "결제 요청에 필요한 정보가 누락되었습니다."}), 400

        auth = get_auth_from_headers()
        if train_type == 'SRT':
            client = get_srt_client(user_id=auth['srt_id'], user_pw=auth['srt_pw'])
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
            client = get_ktx_client(user_id=auth['ktx_id'], user_pw=auth['ktx_pw'])
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
            client = get_srt_client()
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
            client = get_ktx_client()
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

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    """React SPA 라우팅을 지원하기 위해 api 경로가 아닌 모든 요청을 index.html로 서빙합니다."""
    # API 요청이거나 정적 파일(.js, .css 등) 요청인데 파일을 못 찾고 여기까지 왔다면 404 반환
    if path.startswith('api/') or path.startswith('assets/') or '.' in path:
        return jsonify({"error": "Not Found"}), 404
    return app.send_static_file('index.html')

@app.route('/api/client-error', methods=['POST'])
def client_error():
    try:
        data = request.json
        app.logger.error(f"[Client Error] {data.get('message')} | {data.get('source')}:{data.get('lineno')} | col: {data.get('colno')} | error: {data.get('error')}")
        return jsonify({"status": "logged"})
    except:
        return jsonify({"status": "failed"})

if __name__ == '__main__':
    from logging.handlers import RotatingFileHandler
    handler = RotatingFileHandler('train-booking.log', maxBytes=10000000, backupCount=5)
    app.logger.addHandler(handler)
    # 시놀로지 NAS 등 외부 환경에서 접근할 수 있도록 0.0.0.0 호스트로 5001 포트에서 실행합니다.
    app.run(host='0.0.0.0', port=5001, debug=True)