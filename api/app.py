import json # json 모듈 추가
import requests # requests 모듈 추가
from pywebpush import webpush, WebPushException # pywebpush 추가
import sys
import os
import uuid
import hashlib
import threading
import time
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
from enum import Enum
from pathlib import Path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))
import ktx
from dotenv import load_dotenv

from ktx import SoldOutError, KorailError, TrainType, NoResultsError, MacroError, NeedToLoginError
from mailer import send_email

# 한국 표준시 (서머타임 없음)
KST = timezone(timedelta(hours=9))

# KTX/SRT 통합에 따른 레거시 예외 호환 정의
class SRTError(KorailError): pass
class SRTResponseError(NoResultsError): pass
class SRTLoginError(KorailError): pass

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

# 자동 예매 태스크 관리 전역 변수
# 형태: { 'task_id': { 'status': 'running'|'stopped'|'success'|'failed', 'thread': <Thread>, 'details': {...} } }
active_auto_reserves = {}

TASKS_FILE = os.path.join(current_dir, '../data/tasks.json')
os.makedirs(os.path.dirname(TASKS_FILE), exist_ok=True)

_tasks_file_lock = threading.Lock()

def save_tasks():
    tasks_to_save = {}
    for task_id, task in list(active_auto_reserves.items()):
        if task['status'] == 'running':
            tasks_to_save[task_id] = {
                'status': task['status'],
                'details': task['details'],
                'message': task['message']
            }
    try:
        # 여러 스레드가 동시에 저장해도 파일이 깨지지 않도록 잠금 후 임시 파일에 쓰고 교체
        with _tasks_file_lock:
            tmp_file = TASKS_FILE + '.tmp'
            with open(tmp_file, 'w', encoding='utf-8') as f:
                json.dump(tasks_to_save, f, ensure_ascii=False)
            os.replace(tmp_file, TASKS_FILE)
    except Exception as e:
        app.logger.error(f"Failed to save tasks: {e}")

def load_and_resume_tasks():
    if not os.path.exists(TASKS_FILE):
        return
    try:
        with open(TASKS_FILE, 'r', encoding='utf-8') as f:
            saved_tasks = json.load(f)
        
        loaded_count = 0
        for task_id, task in saved_tasks.items():
            try:
                active_auto_reserves[task_id] = task
                details = task.get('details', {})
                if details.get('mode') == 'openrun':
                    thread = threading.Thread(target=openrun_worker, args=(task_id, details))
                else:
                    thread = threading.Thread(target=auto_reserve_worker, args=(
                        task_id, 
                        details.get('train_type', 'KTX'), 
                        details.get('dep', ''), 
                        details.get('arr', ''), 
                        details.get('date', ''), 
                        details.get('time', ''), 
                        details.get('train_number', ''), 
                        details.get('adults', 1), 
                        details.get('seat_type', 'GENERAL'), 
                        details.get('auth', {})
                    ))
                thread.daemon = True
                active_auto_reserves[task_id]['thread'] = thread
                thread.start()
                loaded_count += 1
            except Exception as e:
                app.logger.error(f"Failed to load task {task_id}: {e}")
                
        app.logger.info(f"Resumed {loaded_count} tasks from {TASKS_FILE}")
    except Exception as e:
        app.logger.error(f"Failed to open or parse tasks file: {e}")

# --- 클라이언트 캐싱 (매번 로그인하지 않고 세션 재사용) ---
import time as _time
import threading

NO_ACCOUNT_MESSAGE = "코레일 로그인 정보가 없습니다. 관리 탭에서 계정을 저장해 주세요."

def account_key(auth):
    """아이디와 비밀번호로 계정 식별 키를 만듭니다 (둘 중 하나라도 없으면 None).
    세션 캐시, 작업 소유자 확인, 푸시 구독을 이 키로 구분하며 계정 정보 자체는 키에 남지 않습니다."""
    user_id, user_pw = (auth or {}).get('ktx_id'), (auth or {}).get('ktx_pw')
    if not (user_id and user_pw):
        return None
    return hashlib.sha256(f"{user_id}\n{user_pw}".encode('utf-8')).hexdigest()

# 계정별 로그인 세션: { account_key: {'client': Korail, 'login_time': float} }
_cached_clients = {}
_CLIENT_TTL = 600  # 10분간 세션 유지
_client_lock = threading.Lock()

def get_ktx_client(force_login=False, user_id=None, user_pw=None):
    """계정별로 코레일 클라이언트를 캐싱하여 반복 로그인을 방지합니다.
    아이디와 비밀번호가 모두 일치해야 세션을 재사용하며, 서버(.env) 계정으로 대신 로그인하지 않습니다."""
    key = account_key({'ktx_id': user_id, 'ktx_pw': user_pw})
    if key is None:
        raise ValueError(NO_ACCOUNT_MESSAGE)

    with _client_lock:
        now = _time.time()
        for expired_key in [k for k, c in _cached_clients.items() if now - c['login_time'] >= _CLIENT_TTL]:
            del _cached_clients[expired_key]

        cache = _cached_clients.get(key)
        if not force_login and cache and getattr(cache['client'], 'logined', False):
            return cache['client']

        client = ktx.Korail(user_id, user_pw)
        _cached_clients[key] = {'client': client, 'login_time': now}
        return client

# 검색전용 캐싱 클라이언트 (로그인 없이 세션/기기ID만 유지)
_cached_search_clients = {
    'ktx': None,
}

def get_ktx_search_client():
    """검색용 KTX 클라이언트 (로그인 없이 세션/기기ID 일관성 유지)"""
    if _cached_search_clients['ktx'] is None:
        _cached_search_clients['ktx'] = ktx.Korail(korail_id="-", korail_pw="-", auto_login=False)
    return _cached_search_clients['ktx']

# 하위 호환용 별칭 (KTX 단일 클라이언트 사용)
get_srt_client = get_ktx_client
get_srt_search_client = get_ktx_search_client

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

# 계정별 푸시 구독: { account_key: [subscription, ...] }
# 각자 자기 계정의 예매 알림만 받도록 계정 키로 나눠 저장합니다 (계정 정보 자체는 저장하지 않음).
SUB_FILE = os.path.join(current_dir, '../data/push_subscriptions.json')
push_subscriptions = {}
_push_lock = threading.Lock()

def save_subscriptions():
    try:
        with _push_lock:
            tmp_file = SUB_FILE + '.tmp'
            with open(tmp_file, 'w', encoding='utf-8') as f:
                json.dump(push_subscriptions, f)
            os.replace(tmp_file, SUB_FILE)
    except Exception as e:
        app.logger.error(f"Failed to save push subscriptions: {e}")

def load_subscriptions():
    global push_subscriptions
    if os.path.exists(SUB_FILE):
        try:
            with open(SUB_FILE, 'r', encoding='utf-8') as f:
                push_subscriptions = json.load(f)
        except Exception as e:
            app.logger.error(f"Failed to load push subscriptions: {e}")

load_subscriptions()

@app.route('/api/subscribe', methods=['POST'])
def subscribe():
    key = account_key(get_auth_from_headers())
    subscription = request.get_json(silent=True) or {}
    endpoint = subscription.get('endpoint')
    if key is None:
        return jsonify({'error_message': NO_ACCOUNT_MESSAGE}), 400
    if not endpoint:
        return jsonify({'error_message': '푸시 구독 정보가 올바르지 않습니다.'}), 400

    with _push_lock:
        # 한 기기는 한 계정에만 연결 (기기에서 계정을 바꾸면 이전 계정의 알림은 더 이상 받지 않음)
        for k in list(push_subscriptions):
            push_subscriptions[k] = [sub for sub in push_subscriptions[k] if sub.get('endpoint') != endpoint]
            if not push_subscriptions[k]:
                del push_subscriptions[k]
        push_subscriptions.setdefault(key, []).append(subscription)
    save_subscriptions()
    app.logger.info("Push subscription saved for account.")
    return jsonify({'success': True}), 201

def send_push_notification(title, body, auth):
    """해당 계정으로 구독한 기기들에만 푸시 알림을 보냅니다."""
    key = account_key(auth)
    with _push_lock:
        subscriptions = list(push_subscriptions.get(key, [])) if key else []
    if not subscriptions:
        app.logger.info("No push subscription for this account.")
        return

    expired = []
    for subscription in subscriptions:
        try:
            webpush(
                subscription_info=subscription,
                data=json.dumps({"title": title, "body": body}),
                vapid_private_key=os.environ.get("VAPID_PRIVATE_KEY"),
                vapid_claims={"sub": os.environ.get("VAPID_ADMIN_EMAIL")}
            )
            app.logger.info("Push notification sent successfully.")
        except WebPushException as ex:
            app.logger.error(f"WebPushException: {ex}")
            # 만료되었거나 해지된 구독은 삭제 (Response 객체는 4xx일 때 거짓으로 평가되므로 None과 비교)
            if ex.response is not None and ex.response.status_code in (404, 410):
                expired.append(subscription.get('endpoint'))
        except Exception as e:
            app.logger.error(f"An error occurred while sending push notification: {e}")

    if expired:
        with _push_lock:
            remaining = [sub for sub in push_subscriptions.get(key, []) if sub.get('endpoint') not in expired]
            if remaining:
                push_subscriptions[key] = remaining
            else:
                push_subscriptions.pop(key, None)
        save_subscriptions()

def get_auth_from_headers():
    """헤더에서 코레일 계정 정보를 추출합니다 (레거시 헤더 지원)."""
    ktx_id = request.headers.get('X-KTX-ID') or request.headers.get('X-SRT-ID')
    ktx_pw = request.headers.get('X-KTX-PW') or request.headers.get('X-SRT-PW')
    return {
        'ktx_id': ktx_id,
        'ktx_pw': ktx_pw,
        'srt_id': ktx_id,
        'srt_pw': ktx_pw,
        'notify_email': request.headers.get('X-NOTIFY-EMAIL')
    }

def owns_task(task, auth):
    """요청한 계정(아이디+비밀번호)이 작업을 등록한 계정과 같은지 확인합니다."""
    key = account_key(auth)
    return key is not None and key == account_key(task.get('details', {}).get('auth'))

@app.route('/api/search')
def search():
    dep_station = request.args.get('dep')
    arr_station = request.args.get('arr')
    date_str = request.args.get('date', '').replace('-', '')
    time_str = request.args.get('time', '').replace(':', '') + '00'

    # 프론트엔드로 보낼 기본 데이터 구조
    response_data = {
        'trains': [],
        'dep': dep_station,
        'arr': arr_station,
        'date': request.args.get('date'),
        'time': request.args.get('time'),
        'train_type': 'KTX',
        'adults': request.args.get('adults')
    }

    try:
        all_trains = []
        seen_train_nos = set()
        current_time = time_str
        ktx_client = get_ktx_search_client()

        while True:
            trains_page = []
            try:
                trains_page = ktx_client.search_train(
                    dep=dep_station,
                    arr=arr_station,
                    date=date_str,
                    time=current_time,
                    include_no_seats=True,
                    train_type=ktx.TrainType.KTX
                )
            except NoResultsError:
                # 당일 열차 조회 종료
                break

            new_trains = []
            for t in trains_page:
                t_no = t.train_no
                t_date = t.dep_date
                if t_date != date_str:
                    continue
                if t_no not in seen_train_nos:
                    seen_train_nos.add(t_no)
                    new_trains.append(t)

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

    except NoResultsError as e:
        app.logger.info(f"No train results: {e}")
        return jsonify(response_data)
    except MacroError as e:
        app.logger.warning(f"KTX MacroError: {e}")
        return jsonify({'error': str(e), 'error_code': 'MACRO_ERROR'}), 503
    except Exception as e:
        app.logger.error(f"An unexpected error occurred: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/reserve', methods=['POST'])
def reserve():
    try:
        form_data = request.form
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
        seat_type = form_data.get('seat_type', 'GENERAL')

        auth = get_auth_from_headers()
        if account_key(auth) is None:
            return jsonify({'error_message': NO_ACCOUNT_MESSAGE}), 400
        client = get_ktx_client(user_id=auth['ktx_id'], user_pw=auth['ktx_pw'])
        all_trains = client.search_train(
            dep=dep_station,
            arr=arr_station,
            date=date_str,
            time=time_str,
            include_no_seats=True,
            train_type=ktx.TrainType.KTX
        )
        passengers = [ktx.AdultPassenger(adults)]
        reserve_option = ktx.ReserveOption.GENERAL_ONLY if seat_type == 'GENERAL' else ktx.ReserveOption.SPECIAL_ONLY

        target_train = next((train for train in all_trains if train.train_no == train_number or train.train_number == train_number), None)

        if not target_train:
            return jsonify({'error_message': "선택한 열차를 찾을 수 없습니다."}), 404

        reservation = client.reserve(target_train, passengers=passengers, option=reserve_option)

        # 예매 성공 알림 보내기
        dep = target_train.dep_name
        arr = target_train.arr_name
        train_display = f"{target_train.train_type_name} {target_train.train_no}"
        send_push_notification(
            title="✅ 예매 성공!",
            body=f"{dep} → {arr} ({train_display}) 열차 예매에 성공했습니다.",
            auth=auth
        )
        
        # 이메일 알림
        notify_email = auth.get('notify_email')
        if notify_email:
            subject = f"[{train_display}] 예매 성공 알림!"
            body = f"""
            <h2>기차 예매가 성공적으로 완료되었습니다!</h2>
            <ul>
                <li><b>열차:</b> {train_display}</li>
                <li><b>여정:</b> {dep} → {arr}</li>
                <li><b>일시:</b> {date_val} {time_val}</li>
                <li><b>인원:</b> {adults}명</li>
            </ul>
            <p>코레일톡 앱 또는 레츠코레일 공식 홈페이지에 접속하여 기한 내에 결제를 진행해 주세요.<br>미결제 시 예약이 자동 취소됩니다.</p>
            """
            mail_success, mail_msg = send_email(notify_email, subject, body)
            if not mail_success:
                app.logger.error(f"Failed to send email to {notify_email}: {mail_msg}")
                
        return jsonify({'reservation': reservation.to_dict()})

    except MacroError as e:
        return jsonify({'error_message': f'코레일 서버 차단: {e}', 'error_code': 'MACRO_ERROR'}), 503
    except (SoldOutError, KorailError) as e:
        msg = str(e)
        if any(keyword in msg for keyword in ["잔여석없음", "Sold out", "매진", "한도수 초과", "예약대기"]):
            return jsonify({'retry': True, 'message': '매진 또는 예약대기 한도 초과. 5초 후 재시도합니다.'})
        return jsonify({'error_message': f'오류: {e}'}), 401
    except Exception as e:
        return jsonify({'error_message': str(e)}), 500

def is_transient_error(e):
    """일시적인 네트워크 연결 문제, 서버 점검, 타임아웃 오류 등인지 판별합니다."""
    # 1. 시스템 수준의 네트워크 연결 및 타임아웃 오류
    if isinstance(e, (ConnectionError, TimeoutError)):
        return True
    
    # 2. requests 라이브러리 예외 (ConnectionError, Timeout, HTTPError 등)
    try:
        import requests
        if isinstance(e, requests.exceptions.RequestException):
            return True
    except ImportError:
        pass
    
    # 3. 예외 클래스명 기반 확인 (curl_cffi 등 커스텀 예외)
    err_name = type(e).__name__
    if any(kw in err_name for kw in ["Connection", "Timeout", "SSLError", "Network", "HTTPError", "NetFunnel", "JSONDecodeError"]):
        return True
        
    # 4. 에러 메시지 내용 기반 확인 (서버 점검 및 Gateway 오류 등)
    msg = str(e)
    transient_keywords = [
        "점검", "정리작업", "정리 작업", "정기점검", "정기 점검", "시스템 점검", "서비스 점검",
        "502 Bad Gateway", "503 Service Unavailable", "504 Gateway Timeout", "500 Internal Server Error",
        "connection", "timeout", "network", "disconnected", "호스트", "연결", "시간 초과",
        "netfunnel", "NetFunnel", "Expecting value"
    ]
    if any(kw in msg for kw in transient_keywords):
        return True
        
    return False

def is_sold_out_error(e):
    """매진/예약대기 한도 등 '다시 시도하면 되는' 좌석 부족 오류인지 판별합니다."""
    msg = str(e)
    return any(keyword in msg for keyword in ["잔여석없음", "Sold out", "매진", "한도수 초과", "예약대기"])

def notify_auto_reserve_success(target_train, auth_dict, when_text, adults, seat_type, source_label):
    """백그라운드 예매 성공 시 푸시/이메일 알림을 보냅니다."""
    d_name = target_train.dep_name
    a_name = target_train.arr_name
    train_display = f"{target_train.train_type_name} {target_train.train_no}"

    # 푸시 알림
    send_push_notification(
        title="✅ 예매 성공!",
        body=f"{d_name} → {a_name} ({train_display}) {source_label}에 성공했습니다.",
        auth=auth_dict
    )

    # 이메일 알림
    notify_email = auth_dict.get('notify_email')
    if notify_email:
        subject = f"[{train_display}] 예매 성공 알림!"
        body = f"""
        <h2>기차 예매가 성공적으로 완료되었습니다!</h2>
        <ul>
            <li><b>열차:</b> {train_display}</li>
            <li><b>여정:</b> {d_name} → {a_name}</li>
            <li><b>일시:</b> {when_text}</li>
            <li><b>인원:</b> {adults}명 ({seat_type})</li>
        </ul>
        <p>코레일톡 앱 또는 레츠코레일 공식 홈페이지에 접속하여 기한 내에 결제를 진행해 주세요.<br>미결제 시 예약이 자동 취소됩니다.</p>
        """
        mail_success, mail_msg = send_email(notify_email, subject, body)
        if not mail_success:
            app.logger.error(f"Failed to send email to {notify_email}: {mail_msg}")

def auto_reserve_worker(task_id, train_type, dep, arr, date, time_val, train_number, adults, seat_type, auth_dict):
    task = active_auto_reserves.get(task_id)
    if not task: return

    date_str = date.replace('-', '')
    time_str = time_val.replace(':', '') + '00'
    
    app.logger.info(f"Task {task_id} started (unified Korail API).")

    while task['status'] == 'running':
        try:
            client = get_ktx_client(user_id=auth_dict.get('ktx_id'), user_pw=auth_dict.get('ktx_pw'))
            search_options = {'include_no_seats': True, 'train_type': ktx.TrainType.KTX}
            passengers = [ktx.AdultPassenger(adults)]
            reserve_option = ktx.ReserveOption.GENERAL_ONLY if seat_type == 'GENERAL' else ktx.ReserveOption.SPECIAL_ONLY

            all_trains = client.search_train(dep=dep, arr=arr, date=date_str, time=time_str, **search_options)
            target_train = next((t for t in all_trains if t.train_no == train_number or t.train_number == train_number), None)
            
            if not target_train:
                task['status'] = 'failed'
                task['message'] = "선택한 열차를 찾을 수 없습니다."
                app.logger.error(f"Task {task_id} failed: target train not found")
                break

            reservation = client.reserve(target_train, passengers=passengers, option=reserve_option)
            
            task['status'] = 'success'
            task['message'] = "예매 성공"
            
            # 예매 성공 알림 보내기
            notify_auto_reserve_success(target_train, auth_dict, f"{date} {time_val} 이후", adults, seat_type, "자동 예매")
                    
            app.logger.info(f"Task {task_id} success.")
            break

        except (SoldOutError, KorailError) as e:
            msg = str(e)
            if any(keyword in msg for keyword in ["잔여석없음", "Sold out", "매진", "한도수 초과", "예약대기"]):
                # 매진 시 5초 대기 후 계속 재시도
                time.sleep(5)
                continue
            elif is_transient_error(e):
                app.logger.warning(f"Task {task_id} transient error: {e}. Retrying in 10 seconds...")
                task['message'] = f"서버 점검/연결 오류로 재시도 중: {e}"
                save_tasks()  # 'running' 상태와 새로운 메시지를 tasks.json에 저장
                time.sleep(10)
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
            if is_transient_error(e):
                app.logger.warning(f"Task {task_id} transient error: {e}. Retrying in 10 seconds...")
                task['message'] = f"네트워크 오류로 재시도 중: {e}"
                save_tasks()  # 'running' 상태와 새로운 메시지를 tasks.json에 저장
                time.sleep(10)
                continue
            else:
                task['status'] = 'failed'
                task['message'] = str(e)
                app.logger.error(f"Task {task_id} unexpected error: {e}")
                break

    # 스레드 종료 시 (성공, 실패 모두) 상태 파일 업데이트 (메모리에서는 프론트가 ACK할 때 삭제)
    save_tasks()

# --- 명절 오픈런 ---
# 좌석이 풀리는 시각(예매 오픈 일시)에 맞춰 미리 로그인해 두었다가, 오픈 순간부터 희망 시간대의 열차를
# 반복 조회하여 좌석이 잡히는 첫 열차를 예매합니다. 왕복은 가는 편/오는 편을 한 작업에서 함께 처리하여
# 로그인 세션을 하나만 사용합니다. 집중 시도 시간이 지나면 일반 취소표 대기 간격으로 계속 시도합니다.
OPENRUN_PRELOGIN_SECONDS = 90   # 오픈 90초 전 미리 로그인 (계정 오류를 오픈 전에 발견)
OPENRUN_LEAD_SECONDS = 2        # 서버 시각 오차 대비 오픈 2초 전부터 조회 시작
OPENRUN_BURST_INTERVAL = 0.3    # 집중 시도 중 조회 간격 (search_train 자체에 0.5~1.2초 지연 포함)
OPENRUN_RETRY_INTERVAL = 5      # 집중 시도 이후 취소표 대기 간격
OPENRUN_MACRO_BACKOFF = 30      # 매크로 차단 시 대기 시간
OPENRUN_MAX_PAGES = 6           # 희망 시간대 조회 시 최대 페이지 수
OPENRUN_MAX_SAME_ERROR = 5      # 같은 오류가 연속으로 반복되면 중단
OPENRUN_SEAT_TYPES = {
    'GENERAL': ('일반실', ktx.ReserveOption.GENERAL_ONLY, lambda t: t.has_general_seat),
    'SPECIAL': ('특실', ktx.ReserveOption.SPECIAL_ONLY, lambda t: t.has_special_seat),
    'ANY': ('일반실/특실', ktx.ReserveOption.GENERAL_FIRST, lambda t: t.has_seat),
}
OPENRUN_LEG_FIELDS = ('dep', 'arr', 'date', 'time', 'end_time', 'open_date', 'open_time', 'preferred_trains')

def parse_kst(date_val, time_val):
    """'YYYY-MM-DD', 'HH:MM' 문자열을 한국 시간 datetime으로 변환합니다."""
    return datetime.strptime(f"{date_val} {time_val}", "%Y-%m-%d %H:%M").replace(tzinfo=KST)

def normalize_train_no(train_no):
    return str(train_no or '').strip().lstrip('0')

def parse_preferred_trains(raw):
    """'101, 103 / 105' 형태의 입력을 ['101', '103', '105']로 변환합니다."""
    tokens = raw.replace('/', ',').replace(' ', ',').split(',') if raw else []
    result = []
    for token in tokens:
        no = normalize_train_no(token)
        if no and no not in result:
            result.append(no)
    return result

def wait_until(task, target_dt):
    """target_dt(KST)까지 대기합니다. 대기 중 작업이 중단되면 False를 반환합니다."""
    while task['status'] == 'running':
        remaining = (target_dt - datetime.now(KST)).total_seconds()
        if remaining <= 0:
            return True
        time.sleep(min(remaining, 1.0))
    return False

def get_openrun_legs(details):
    """오픈런 구간 목록을 반환합니다. 왕복 도입 전에 저장된 편도 작업도 구간 1개로 변환합니다."""
    if not details.get('legs'):
        leg = {field: details.get(field) for field in OPENRUN_LEG_FIELDS}
        leg.update(status='pending', reserved_train=details.get('reserved_train', ''))
        if leg['reserved_train']:
            leg['status'] = 'reserved'
        details['legs'] = [leg]
    if details.get('trip_type') != 'round':
        # 편도는 '가는 편' 같은 구간 이름 없이 표시
        details['legs'][0]['label'] = ''
    return details['legs']

def leg_prefix(leg):
    """메시지 앞에 붙일 구간 이름 ('가는 편 ', '오는 편 ', 편도는 빈 문자열)"""
    return f"{leg['label']} " if leg.get('label') else ''

def leg_open_dt(leg):
    return parse_kst(leg['open_date'], leg['open_time'])

def leg_last_departure(leg):
    return parse_kst(leg['date'], leg['end_time'])

def iter_openrun_pages(client, leg, adults):
    """희망 시간대에 출발하는 열차를 조회 페이지 단위로 반환합니다."""
    date_str = leg['date'].replace('-', '')
    end_hhmm = leg['end_time'].replace(':', '')

    seen = set()
    current_time = leg['time'].replace(':', '') + '00'
    for _ in range(OPENRUN_MAX_PAGES):
        try:
            page = client.search_train(
                dep=leg['dep'], arr=leg['arr'], date=date_str, time=current_time,
                passengers=[ktx.AdultPassenger(adults)],
                include_no_seats=True, train_type=ktx.TrainType.KTX
            )
        except NoResultsError:
            break

        new_trains = [t for t in page if t.dep_date == date_str and t.train_no not in seen]
        if not new_trains:
            break
        seen.update(t.train_no for t in new_trains)
        yield [t for t in new_trains if t.dep_time[:4] <= end_hhmm]

        last_dep = new_trains[-1].dep_time
        if last_dep[:4] >= end_hhmm or last_dep >= "235000":
            break
        next_dt = datetime.strptime(last_dep[:4], "%H%M") + timedelta(minutes=1)
        current_time = next_dt.strftime("%H%M") + "00"

def iter_openrun_candidates(client, leg, adults, seat_type):
    """원하는 좌석이 남은 후보 열차를 우선순위 순으로 반환합니다.
    지정 열차가 없으면 이른 열차부터 페이지를 받는 즉시 반환하여 오픈 직후 한 발이라도 빨리 예매를 시도합니다."""
    preferred = leg.get('preferred_trains') or []
    has_wanted_seat = OPENRUN_SEAT_TYPES[seat_type][2]

    if not preferred:
        for trains in iter_openrun_pages(client, leg, adults):
            yield from (t for t in trains if has_wanted_seat(t))
        return

    by_no = {}
    for trains in iter_openrun_pages(client, leg, adults):
        by_no.update((normalize_train_no(t.train_no), t) for t in trains)
    yield from (by_no[no] for no in preferred if no in by_no and has_wanted_seat(by_no[no]))

def reserve_openrun_leg(client, leg, details, passengers, reserve_option):
    """구간의 후보 열차를 차례로 예매 시도하여, 성공한 열차를 반환합니다 (없으면 None)."""
    for train in iter_openrun_candidates(client, leg, details['adults'], details['seat_type']):
        try:
            client.reserve(train, passengers=passengers, option=reserve_option)
            return train
        except (SoldOutError, KorailError) as e:
            if isinstance(e, NeedToLoginError) or not is_sold_out_error(e):
                raise
            # 조회와 예매 사이에 다른 사람이 좌석을 가져감 → 다음 후보 열차 시도
    return None

def openrun_worker(task_id, details):
    task = active_auto_reserves.get(task_id)
    if not task: return

    auth_dict = details.get('auth', {})
    legs = get_openrun_legs(details)
    seat_label, reserve_option, _ = OPENRUN_SEAT_TYPES[details['seat_type']]
    passengers = [ktx.AdultPassenger(details['adults'])]
    burst = timedelta(minutes=details.get('burst_minutes', 30))
    lead = timedelta(seconds=OPENRUN_LEAD_SECONDS)

    def set_phase(phase, message):
        changed = task.get('phase') != phase or task.get('message') != message
        task['phase'] = phase
        task['message'] = message
        if changed:
            save_tasks()

    def fail(message):
        task['status'] = 'failed'
        task['message'] = message
        app.logger.error(f"Openrun task {task_id} failed: {message}")

    def finish():
        reserved = [f"{leg_prefix(leg)}{leg['reserved_train']}" for leg in legs if leg['status'] == 'reserved']
        missed = [leg['label'] for leg in legs if leg['status'] == 'expired']
        if not reserved:
            fail("희망 시간대의 열차가 모두 출발하여 오픈런을 종료했습니다.")
            return
        task['status'] = 'success'
        task['message'] = f"{', '.join(reserved)} 열차 예매 성공"
        if missed:
            task['message'] += f" ({', '.join(missed)}은 희망 시간대 열차가 모두 출발하여 예매하지 못했습니다)"
        app.logger.info(f"Openrun task {task_id} finished: {task['message']}")

    app.logger.info(f"Openrun task {task_id} scheduled: " + ", ".join(f"{leg_prefix(leg)}{leg_open_dt(leg).isoformat()}" for leg in legs))

    force_login = False
    logged_in_for = None  # 사전 로그인을 마친 오픈 시각
    last_error, same_error_count = None, 0
    while task['status'] == 'running':
        now = datetime.now(KST)
        for leg in legs:
            if leg['status'] == 'pending' and now >= leg_last_departure(leg):
                leg['status'] = 'expired'
                save_tasks()
        pending = [leg for leg in legs if leg['status'] == 'pending']
        if not pending:
            finish()
            break

        active = [leg for leg in pending if now >= leg_open_dt(leg) - lead]
        if not active:
            # 1) 가장 가까운 오픈 시각까지 대기 → 2) 오픈 직전 사전 로그인 → 3) 오픈 직전까지 대기
            next_open = min(leg_open_dt(leg) for leg in pending)
            prelogin_dt = next_open - timedelta(seconds=OPENRUN_PRELOGIN_SECONDS)
            if now < prelogin_dt:
                set_phase('waiting', f"예매 오픈({next_open:%m/%d %H:%M}) 대기 중")
                wait_until(task, prelogin_dt)
            elif logged_in_for != next_open:
                try:
                    get_ktx_client(force_login=True, user_id=auth_dict.get('ktx_id'), user_pw=auth_dict.get('ktx_pw'))
                    logged_in_for = next_open
                    set_phase('waiting', f"로그인 완료, 예매 오픈({next_open:%H:%M}) 대기 중")
                except Exception as e:
                    if not is_transient_error(e):
                        fail(f"사전 로그인 실패: {e}")
                        break
                    app.logger.warning(f"Openrun task {task_id} pre-login transient error: {e}")
                    time.sleep(5)
            else:
                wait_until(task, next_open - lead)
            continue

        bursting = any(now < leg_open_dt(leg) + burst for leg in active)
        interval = OPENRUN_BURST_INTERVAL if bursting else OPENRUN_RETRY_INTERVAL
        if bursting:
            set_phase('openrun', "오픈런 진행 중 (집중 시도)")
        elif task.get('phase') != 'retry':
            set_phase('retry', "좌석이 없어 취소표를 기다리는 중")

        try:
            client = get_ktx_client(force_login=force_login, user_id=auth_dict.get('ktx_id'), user_pw=auth_dict.get('ktx_pw'))
            force_login = False

            for leg in active:
                target_train = reserve_openrun_leg(client, leg, details, passengers, reserve_option)
                if target_train is None:
                    continue
                leg['status'] = 'reserved'
                leg['reserved_train'] = target_train.train_no
                save_tasks()
                when_text = f"{leg['date']} {target_train.dep_time[:2]}:{target_train.dep_time[2:4]} 출발"
                source_label = f"명절 오픈런({leg['label']}) 예매" if leg.get('label') else "명절 오픈런 예매"
                notify_auto_reserve_success(target_train, auth_dict, when_text, details['adults'], seat_label, source_label)
                app.logger.info(f"Openrun task {task_id} {leg_prefix(leg)}reserved: {target_train.train_no}")

            last_error, same_error_count = None, 0
            if any(leg['status'] == 'pending' for leg in active):
                time.sleep(interval)

        except NoResultsError:
            # 예매 오픈 전이거나 해당 시간대 열차가 아직 조회되지 않음
            time.sleep(interval)
        except NeedToLoginError:
            force_login = True
            time.sleep(1)
        except MacroError as e:
            app.logger.warning(f"Openrun task {task_id} MacroError: {e}")
            task['message'] = f"코레일 서버 차단 감지, {OPENRUN_MACRO_BACKOFF}초 후 재시도합니다."
            time.sleep(OPENRUN_MACRO_BACKOFF)
        except Exception as e:
            if is_sold_out_error(e):
                time.sleep(interval)
                continue
            if is_transient_error(e):
                app.logger.warning(f"Openrun task {task_id} transient error: {e}")
                time.sleep(1 if bursting else 10)
                continue

            msg = str(e)
            same_error_count = same_error_count + 1 if msg == last_error else 1
            last_error = msg
            app.logger.warning(f"Openrun task {task_id} error ({same_error_count}/{OPENRUN_MAX_SAME_ERROR}): {msg}")
            if same_error_count >= OPENRUN_MAX_SAME_ERROR:
                fail(msg)
                break
            time.sleep(interval)

    save_tasks()

class OpenrunInputError(ValueError):
    pass

def build_openrun_leg(form_data, prefix, label, dep, arr):
    """폼 입력에서 오픈런 구간 하나를 만들고 검증합니다. 예매 오픈 일시는 모든 구간이 공통으로 사용합니다."""
    name = f"{label} " if label else ''
    leg = {
        'label': label,
        'dep': dep,
        'arr': arr,
        'date': form_data.get(f'{prefix}date', ''),
        'time': form_data.get(f'{prefix}time', ''),
        'end_time': form_data.get(f'{prefix}end_time', ''),
        'open_date': form_data.get('open_date', ''),
        'open_time': form_data.get('open_time', ''),
        'preferred_trains': parse_preferred_trains(form_data.get(f'{prefix}preferred_trains', '')),
        'status': 'pending',
        'reserved_train': '',
    }
    if not all(leg[field] for field in ('date', 'time', 'end_time', 'open_date', 'open_time')):
        raise OpenrunInputError(f'{name}필수 정보가 누락되었습니다.')
    try:
        open_dt = leg_open_dt(leg)
        first_departure = parse_kst(leg['date'], leg['time'])
        last_departure = leg_last_departure(leg)
    except ValueError:
        raise OpenrunInputError(f'{name}날짜 또는 시간 형식이 올바르지 않습니다.')
    if last_departure < first_departure:
        raise OpenrunInputError(f'{name}희망 출발 시간대의 종료 시각이 시작 시각보다 빠릅니다.')
    if last_departure <= datetime.now(KST):
        raise OpenrunInputError(f'{name}희망 출발 시간대가 이미 지났습니다.')
    if open_dt >= last_departure:
        raise OpenrunInputError(f'{name}예매 오픈 일시가 희망 출발 시간 이후입니다.')
    return leg

@app.route('/api/start-openrun', methods=['POST'])
def start_openrun():
    form_data = request.form
    try:
        dep, arr = form_data.get('dep'), form_data.get('arr')
        trip_type = form_data.get('trip_type', 'oneway')
        adults = int(form_data.get('adults', 1))
        seat_type = form_data.get('seat_type', 'GENERAL')
        burst_minutes = int(form_data.get('burst_minutes', 30))

        if not dep or not arr:
            return jsonify({'error_message': '출발역과 도착역을 선택해 주세요.'}), 400
        if dep == arr:
            return jsonify({'error_message': '출발역과 도착역이 같습니다.'}), 400
        if trip_type not in ('oneway', 'round'):
            return jsonify({'error_message': '여정 종류가 올바르지 않습니다.'}), 400
        if seat_type not in OPENRUN_SEAT_TYPES:
            return jsonify({'error_message': '좌석 종류가 올바르지 않습니다.'}), 400
        if not 1 <= adults <= 9 or not 1 <= burst_minutes <= 180:
            return jsonify({'error_message': '인원 또는 집중 시도 시간이 올바르지 않습니다.'}), 400

        legs = [build_openrun_leg(form_data, '', '가는 편' if trip_type == 'round' else '', dep, arr)]
        if trip_type == 'round':
            return_leg = build_openrun_leg(form_data, 'return_', '오는 편', arr, dep)
            if parse_kst(return_leg['date'], return_leg['time']) < parse_kst(legs[0]['date'], legs[0]['time']):
                return jsonify({'error_message': '오는 편 탑승 일시가 가는 편보다 빠릅니다.'}), 400
            legs.append(return_leg)

        auth = get_auth_from_headers()
        if account_key(auth) is None:
            return jsonify({'error_message': NO_ACCOUNT_MESSAGE}), 400

        task_id = str(uuid.uuid4())
        task_details = {
            'mode': 'openrun',
            'trip_type': trip_type,
            'train_type': 'KTX',
            **{field: legs[0][field] for field in OPENRUN_LEG_FIELDS},  # 편도 형식과의 호환용
            'legs': legs,
            'burst_minutes': burst_minutes,
            'train_number': '',
            'seat_type': seat_type,
            'adults': adults,
            'auth': auth
        }

        active_auto_reserves[task_id] = {
            'status': 'running',
            'phase': 'waiting',
            'details': task_details,
            'message': '오픈런 준비 중...'
        }

        thread = threading.Thread(target=openrun_worker, args=(task_id, task_details))
        thread.daemon = True
        active_auto_reserves[task_id]['thread'] = thread
        thread.start()

        save_tasks()

        first_open = min(leg_open_dt(leg) for leg in legs)
        trip_label = '왕복 ' if trip_type == 'round' else ''
        return jsonify({
            'message': f"{first_open:%m월 %d일 %H:%M} 예매 오픈에 맞춰 {trip_label}오픈런이 등록되었습니다.",
            'task_id': task_id,
            'open_at': first_open.isoformat()
        })

    except OpenrunInputError as e:
        return jsonify({'error_message': str(e)}), 400
    except ValueError:
        return jsonify({'error_message': '입력값 형식이 올바르지 않습니다.'}), 400
    except Exception as e:
        return jsonify({'error_message': str(e)}), 500

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
        if account_key(auth) is None:
            return jsonify({'error_message': NO_ACCOUNT_MESSAGE}), 400

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
        if owns_task(task, auth):
            task['status'] = 'stopped'
            task['message'] = '사용자가 중단함'
            if task_id in active_auto_reserves:
                del active_auto_reserves[task_id]
            save_tasks()
            return jsonify({'message': '자동 예매가 중단되었습니다.'})
        else:
            return jsonify({'error_message': '권한이 없습니다.'}), 403
    return jsonify({'error_message': '해당 작업을 찾을 수 없습니다.'}), 404

def openrun_status_fields(details):
    """상태 조회 응답에 들어갈 오픈런 구간 정보를 만듭니다."""
    if details.get('mode') != 'openrun':
        return {}
    try:
        legs = get_openrun_legs(details)
        pending_opens = [leg_open_dt(leg) for leg in legs if leg['status'] == 'pending']
        next_open = min(pending_opens) if pending_opens else leg_open_dt(legs[0])
    except (KeyError, TypeError, ValueError):
        return {}
    return {
        'trip_type': details.get('trip_type', 'oneway'),
        'open_at': next_open.isoformat(),
        'legs': [{
            'label': leg['label'],
            'dep': leg['dep'],
            'arr': leg['arr'],
            'date': leg['date'],
            'time': leg['time'],
            'end_time': leg['end_time'],
            'open_at': leg_open_dt(leg).isoformat(),
            'preferred_trains': leg.get('preferred_trains') or [],
            'status': leg['status'],
            'reserved_train': leg.get('reserved_train', ''),
        } for leg in legs]
    }

@app.route('/api/auto-reserve-status')
def auto_reserve_status():
    auth = get_auth_from_headers()
    my_tasks = []
    
    for t_id, task in list(active_auto_reserves.items()):
        if owns_task(task, auth):
            my_tasks.append({
                'task_id': t_id,
                'status': task['status'],
                'message': task['message'],
                'train_type': task.get('details', {}).get('train_type', ''),
                'dep': task.get('details', {}).get('dep', ''),
                'arr': task.get('details', {}).get('arr', ''),
                'date': task.get('details', {}).get('date', ''),
                'time': task.get('details', {}).get('time', ''),
                'train_number': task.get('details', {}).get('train_number', ''),
                'adults': task.get('details', {}).get('adults', 1),
                'seat_type': task.get('details', {}).get('seat_type', 'GENERAL'),
                'mode': task.get('details', {}).get('mode', 'standby'),
                'phase': task.get('phase', ''),
                **openrun_status_fields(task.get('details', {}))
            })
    return jsonify({'tasks': my_tasks})

@app.route('/api/ack-auto-reserve', methods=['POST'])
def ack_auto_reserve():
    task_id = request.form.get('task_id')
    auth = get_auth_from_headers()
    if task_id in active_auto_reserves:
        task = active_auto_reserves[task_id]
        if owns_task(task, auth):
            del active_auto_reserves[task_id]
            save_tasks()
            return jsonify({'message': 'Task acknowledged and removed.'})
    return jsonify({'message': 'Ok'})

@app.route('/api/reservations')
def reservations():
    results = {'reservations': [], 'ktx_reservations': [], 'srt_reservations': [], 'error': None, 'ktx_error': None, 'srt_error': None}
    auth = get_auth_from_headers()
    try:
        client = get_ktx_client(user_id=auth['ktx_id'], user_pw=auth['ktx_pw'])
        raw = []
        try:
            raw.extend(client.tickets())
        except Exception as e:
            app.logger.warning(f"Failed to fetch KTX tickets: {e}")
        try:
            raw.extend(client.reservations())
        except Exception as e:
            app.logger.warning(f"Failed to fetch KTX reservations: {e}")
            results['error'] = str(e)
            results['ktx_error'] = str(e)
        
        serialized = [r.to_dict() for r in raw]
        results['reservations'] = serialized
        results['ktx_reservations'] = serialized
    except Exception as e: 
        results['error'] = str(e)
        results['ktx_error'] = str(e)
    return jsonify(results)

@app.route('/api/pay', methods=['POST'])
def pay():
    try:
        data = request.form
        pnr_no = data.get('pnr_no')

        if not pnr_no:
            return jsonify({'error_message': "결제 요청에 필요한 예약번호가 누락되었습니다."}), 400

        auth = get_auth_from_headers()
        if account_key(auth) is None:
            return jsonify({'error_message': NO_ACCOUNT_MESSAGE}), 400
        client = get_ktx_client(user_id=auth['ktx_id'], user_pw=auth['ktx_pw'])
        reservations = client.reservations()
        target = next((r for r in reservations if r.rsv_id == pnr_no or getattr(r, 'pnr_no', None) == pnr_no), None)

        if not target:
            return jsonify({'error_message': "결제할 예매 내역을 찾을 수 없습니다."}), 404

        client.pay_with_card(
            target,
            card_number=data.get('card_number'),
            card_password=data.get('card_password'),
            birthday=data.get('card_birthday'),
            card_expire=data.get('card_expire_date')
        )
        return jsonify({'message': f"예매({pnr_no})가 정상적으로 결제되었습니다."})
            
    except Exception as e:
        app.logger.error(f"An unexpected error occurred during payment: {e}", exc_info=True)
        return jsonify({'error_message': str(e)}), 500

@app.route('/api/cancel', methods=['POST'])
def cancel():
    try:
        data = request.form
        pnr_no = data.get('pnr_no')
        is_ticket = data.get('is_ticket', 'false').lower() == 'true'

        if not pnr_no:
            return jsonify({'error_message': "취소 요청에 필요한 예약번호가 누락되었습니다."}), 400

        auth = get_auth_from_headers()
        if account_key(auth) is None:
            return jsonify({'error_message': NO_ACCOUNT_MESSAGE}), 400
        client = get_ktx_client(user_id=auth['ktx_id'], user_pw=auth['ktx_pw'])
        reservations = client.tickets() + client.reservations()
        target = next((r for r in reservations if (hasattr(r, 'pnr_no') and r.pnr_no == pnr_no) or (hasattr(r, 'rsv_id') and r.rsv_id == pnr_no)), None)
        
        if not target:
            return jsonify({'error_message': "취소할 예매 내역을 찾을 수 없습니다."}), 404
        
        if is_ticket:
            client.refund(target)
        else:
            client.cancel(target)
        
        return jsonify({'message': f"예매({pnr_no})가 정상적으로 취소(환불)되었습니다."})
            
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

# 초기 서버 구동 시 예매 상태 복원
load_and_resume_tasks()

if __name__ == '__main__':
    from logging.handlers import RotatingFileHandler
    handler = RotatingFileHandler('train-booking.log', maxBytes=10000000, backupCount=5)
    app.logger.addHandler(handler)
    # 시놀로지 NAS 등 외부 환경에서 접근할 수 있도록 0.0.0.0 호스트로 5001 포트에서 실행합니다.
    app.run(host='0.0.0.0', port=5001, debug=True)