import json # json 모듈 추가
import requests # requests 모듈 추가
from pywebpush import webpush, WebPushException # pywebpush 추가
import sys
import os
import uuid
import threading
import time
from datetime import datetime, timedelta, timezone, date as date_cls
from flask import Flask, request, jsonify
from enum import Enum
from pathlib import Path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))
import ktx
from dotenv import load_dotenv

from ktx import SoldOutError, KorailError, TrainType, NoResultsError, MacroError, NeedToLoginError
from mailer import send_email

try:
    from korean_lunar_calendar import KoreanLunarCalendar
except ImportError:  # 명절 날짜 추천 기능만 비활성화
    KoreanLunarCalendar = None

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

_cached_clients = {
    'ktx': {'client': None, 'login_time': 0},
}
_CLIENT_TTL = 600  # 10분간 세션 유지
_client_lock = threading.Lock()

def get_ktx_client(force_login=False, user_id=None, user_pw=None):
    """코레일(KTX/통합) 클라이언트를 캐싱하여 반복 로그인을 방지합니다."""
    with _client_lock:
        cache = _cached_clients['ktx']
        now = _time.time()

        final_id = user_id or os.environ.get('KTX_ID') or os.environ.get('SRT_ID')
        final_pw = user_pw or os.environ.get('KTX_PW') or os.environ.get('SRT_PW')

        if not force_login and cache['client'] and getattr(cache['client'], 'logined', False) and cache.get('id') == final_id and (now - cache['login_time']) < _CLIENT_TTL:
            return cache['client']
        
        if not (final_id and final_pw):
            raise ValueError("코레일 로그인 정보가 없습니다. 관리 탭에서 설정해 주세요.")
        
        client = ktx.Korail(final_id, final_pw)
        cache['client'] = client
        cache['id'] = final_id
        cache['login_time'] = now
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

@app.route('/api/config')
def get_config():
    ktx_id = os.environ.get('KTX_ID') or os.environ.get('SRT_ID', '')
    ktx_pw = os.environ.get('KTX_PW') or os.environ.get('SRT_PW', '')
    return jsonify({
        'ktxId': ktx_id,
        'ktxPw': ktx_pw,
        'srtId': ktx_id,
        'srtPw': ktx_pw
    })

SUB_FILE = os.path.join(current_dir, '../data/subscription.json')

def save_subscription():
    try:
        with open(SUB_FILE, 'w', encoding='utf-8') as f:
            json.dump(push_subscription, f)
    except: pass

def load_subscription():
    global push_subscription
    if os.path.exists(SUB_FILE):
        try:
            with open(SUB_FILE, 'r', encoding='utf-8') as f:
                push_subscription = json.load(f)
        except: pass

load_subscription()

@app.route('/api/subscribe', methods=['POST'])
def subscribe():
    global push_subscription
    push_subscription = request.json
    save_subscription()
    app.logger.info("Subscription received and saved.")
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
            body=f"{dep} → {arr} ({train_display}) 열차 예매에 성공했습니다."
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
        body=f"{d_name} → {a_name} ({train_display}) {source_label}에 성공했습니다."
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

# --- 명절(설날/추석) 오픈런 ---
# 명절 승차권은 코레일이 공지한 일시에 일제히 예매가 열리므로, 특정 열차를 미리 고를 수 없습니다.
# 오픈 시각 직전에 미리 로그인해 두었다가, 오픈 순간부터 희망 시간대의 열차를 반복 조회하여
# 좌석이 잡히는 첫 열차를 예매합니다. 집중 시도 시간이 지나면 일반 취소표 대기 간격으로 계속 시도합니다.
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

def iter_openrun_pages(client, details):
    """희망 시간대에 출발하는 열차를 조회 페이지 단위로 반환합니다."""
    date_str = details['date'].replace('-', '')
    end_hhmm = details['end_time'].replace(':', '')

    seen = set()
    current_time = details['time'].replace(':', '') + '00'
    for _ in range(OPENRUN_MAX_PAGES):
        try:
            page = client.search_train(
                dep=details['dep'], arr=details['arr'], date=date_str, time=current_time,
                passengers=[ktx.AdultPassenger(details['adults'])],
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

def iter_openrun_candidates(client, details):
    """원하는 좌석이 남은 후보 열차를 우선순위 순으로 반환합니다.
    지정 열차가 없으면 이른 열차부터 페이지를 받는 즉시 반환하여 오픈 직후 한 발이라도 빨리 예매를 시도합니다."""
    preferred = details.get('preferred_trains') or []
    has_wanted_seat = OPENRUN_SEAT_TYPES[details['seat_type']][2]

    if not preferred:
        for trains in iter_openrun_pages(client, details):
            yield from (t for t in trains if has_wanted_seat(t))
        return

    by_no = {}
    for trains in iter_openrun_pages(client, details):
        by_no.update((normalize_train_no(t.train_no), t) for t in trains)
    yield from (by_no[no] for no in preferred if no in by_no and has_wanted_seat(by_no[no]))

def openrun_worker(task_id, details):
    task = active_auto_reserves.get(task_id)
    if not task: return

    auth_dict = details.get('auth', {})
    seat_label, reserve_option, _ = OPENRUN_SEAT_TYPES[details['seat_type']]
    passengers = [ktx.AdultPassenger(details['adults'])]
    open_dt = parse_kst(details['open_date'], details['open_time'])
    burst_until = open_dt + timedelta(minutes=details.get('burst_minutes', 30))
    last_departure = parse_kst(details['date'], details['end_time'])

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

    app.logger.info(f"Openrun task {task_id} scheduled at {open_dt.isoformat()}.")

    # 1) 오픈 직전까지 대기
    prelogin_dt = open_dt - timedelta(seconds=OPENRUN_PRELOGIN_SECONDS)
    if datetime.now(KST) < prelogin_dt:
        set_phase('waiting', f"예매 오픈({open_dt:%m/%d %H:%M}) 대기 중")
        if not wait_until(task, prelogin_dt):
            return

    # 2) 사전 로그인 (계정 오류는 오픈 전에 실패 처리)
    start_dt = open_dt - timedelta(seconds=OPENRUN_LEAD_SECONDS)
    while task['status'] == 'running' and datetime.now(KST) < start_dt:
        try:
            get_ktx_client(force_login=True, user_id=auth_dict.get('ktx_id'), user_pw=auth_dict.get('ktx_pw'))
            set_phase('waiting', f"로그인 완료, 예매 오픈({open_dt:%H:%M}) 대기 중")
            break
        except Exception as e:
            if is_transient_error(e):
                app.logger.warning(f"Openrun task {task_id} pre-login transient error: {e}")
                time.sleep(5)
                continue
            fail(f"사전 로그인 실패: {e}")
            save_tasks()
            return
    if not wait_until(task, start_dt):
        save_tasks()
        return

    # 3) 오픈런 집중 시도 → 이후 취소표 대기
    force_login = False
    last_error, same_error_count = None, 0
    while task['status'] == 'running':
        now = datetime.now(KST)
        if now >= last_departure:
            fail("희망 시간대의 열차가 모두 출발하여 오픈런을 종료했습니다.")
            break

        bursting = now < burst_until
        interval = OPENRUN_BURST_INTERVAL if bursting else OPENRUN_RETRY_INTERVAL
        if bursting:
            set_phase('openrun', "오픈런 진행 중 (집중 시도)")
        elif task.get('phase') != 'retry':
            set_phase('retry', "좌석이 없어 취소표를 기다리는 중")

        try:
            client = get_ktx_client(force_login=force_login, user_id=auth_dict.get('ktx_id'), user_pw=auth_dict.get('ktx_pw'))
            force_login = False

            reservation = target_train = None
            for train in iter_openrun_candidates(client, details):
                try:
                    reservation = client.reserve(train, passengers=passengers, option=reserve_option)
                    target_train = train
                    break
                except (SoldOutError, KorailError) as e:
                    if isinstance(e, NeedToLoginError) or not is_sold_out_error(e):
                        raise
                    # 조회와 예매 사이에 다른 사람이 좌석을 가져감 → 다음 후보 열차 시도

            if reservation is None:
                time.sleep(interval)
                continue

            task['status'] = 'success'
            task['message'] = "예매 성공"
            task['details']['reserved_train'] = target_train.train_no
            when_text = f"{details['date']} {target_train.dep_time[:2]}:{target_train.dep_time[2:4]} 출발"
            notify_auto_reserve_success(target_train, auth_dict, when_text, details['adults'], seat_label, "명절 오픈런 예매")
            app.logger.info(f"Openrun task {task_id} success: {target_train.train_no}")
            break

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

def get_upcoming_holidays(today, count=4):
    """다가오는 설날/추석과 전후 이틀의 날짜를 반환합니다."""
    if KoreanLunarCalendar is None:
        return []
    holidays = []
    for year in range(today.year, today.year + 3):
        for name, (l_month, l_day) in (('설날', (1, 1)), ('추석', (8, 15))):
            calendar = KoreanLunarCalendar()
            if not calendar.setLunarDate(year, l_month, l_day, False):
                continue
            day = date_cls.fromisoformat(calendar.SolarIsoFormat())
            if day + timedelta(days=2) < today:
                continue
            holidays.append({
                'name': f"{day.year} {name}",
                'date': day.isoformat(),
                'dates': [(day + timedelta(days=offset)).isoformat() for offset in range(-2, 3)]
            })
    holidays.sort(key=lambda h: h['date'])
    return holidays[:count]

@app.route('/api/holidays')
def holidays():
    return jsonify({'holidays': get_upcoming_holidays(datetime.now(KST).date())})

@app.route('/api/start-openrun', methods=['POST'])
def start_openrun():
    form_data = request.form
    try:
        dep, arr = form_data.get('dep'), form_data.get('arr')
        date_val = form_data.get('date', '')
        start_time, end_time = form_data.get('time', ''), form_data.get('end_time', '')
        open_date, open_time = form_data.get('open_date', ''), form_data.get('open_time', '')
        adults = int(form_data.get('adults', 1))
        seat_type = form_data.get('seat_type', 'GENERAL')
        burst_minutes = int(form_data.get('burst_minutes', 30))
        preferred_trains = parse_preferred_trains(form_data.get('preferred_trains', ''))

        if not all([dep, arr, date_val, start_time, end_time, open_date, open_time]):
            return jsonify({'error_message': '오픈런 등록을 위한 필수 정보가 누락되었습니다.'}), 400
        if dep == arr:
            return jsonify({'error_message': '출발역과 도착역이 같습니다.'}), 400
        if seat_type not in OPENRUN_SEAT_TYPES:
            return jsonify({'error_message': '좌석 종류가 올바르지 않습니다.'}), 400
        if not 1 <= adults <= 9 or not 1 <= burst_minutes <= 180:
            return jsonify({'error_message': '인원 또는 집중 시도 시간이 올바르지 않습니다.'}), 400
        try:
            open_dt = parse_kst(open_date, open_time)
            first_departure = parse_kst(date_val, start_time)
            last_departure = parse_kst(date_val, end_time)
        except ValueError:
            return jsonify({'error_message': '날짜 또는 시간 형식이 올바르지 않습니다.'}), 400
        if last_departure < first_departure:
            return jsonify({'error_message': '희망 출발 시간대의 종료 시각이 시작 시각보다 빠릅니다.'}), 400
        if last_departure <= datetime.now(KST):
            return jsonify({'error_message': '희망 출발 시간대가 이미 지났습니다.'}), 400
        if open_dt >= last_departure:
            return jsonify({'error_message': '예매 오픈 일시가 희망 출발 시간 이후입니다.'}), 400

        auth = get_auth_from_headers()
        if not (auth.get('ktx_id') or os.environ.get('KTX_ID') or os.environ.get('SRT_ID')):
            return jsonify({'error_message': '코레일 로그인 정보가 없습니다. 관리 탭에서 설정해 주세요.'}), 400

        task_id = str(uuid.uuid4())
        task_details = {
            'mode': 'openrun',
            'train_type': 'KTX',
            'dep': dep,
            'arr': arr,
            'date': date_val,
            'time': start_time,
            'end_time': end_time,
            'open_date': open_date,
            'open_time': open_time,
            'burst_minutes': burst_minutes,
            'preferred_trains': preferred_trains,
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

        return jsonify({
            'message': f"{open_dt:%m월 %d일 %H:%M} 예매 오픈에 맞춰 오픈런이 등록되었습니다.",
            'task_id': task_id,
            'open_at': open_dt.isoformat()
        })

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
        task_auth = task['details'].get('auth')
        if not task_auth or task_auth == auth:
            task['status'] = 'stopped'
            task['message'] = '사용자가 중단함'
            if task_id in active_auto_reserves:
                del active_auto_reserves[task_id]
            save_tasks()
            return jsonify({'message': '자동 예매가 중단되었습니다.'})
        else:
            return jsonify({'error_message': '권한이 없습니다.'}), 403
    return jsonify({'error_message': '해당 작업을 찾을 수 없습니다.'}), 404

def open_at_iso(details):
    try:
        return parse_kst(details['open_date'], details['open_time']).isoformat()
    except (KeyError, ValueError):
        return ''

@app.route('/api/auto-reserve-status')
def auto_reserve_status():
    auth = get_auth_from_headers()
    my_tasks = []
    
    for t_id, task in list(active_auto_reserves.items()):
        task_auth = task['details'].get('auth')
        if not task_auth or task_auth == auth:
            my_tasks.append({
                'task_id': t_id,
                'status': task['status'],
                'message': task['message'],
                'train_type': task.get('details', {}).get('train_type', ''),
                'dep': task.get('details', {}).get('dep', ''),
                'arr': task.get('details', {}).get('arr', ''),
                'date': task.get('details', {}).get('date', ''),
                'time': task.get('details', {}).get('time', ''),
                'train_number': task.get('details', {}).get('train_number') or task.get('details', {}).get('reserved_train', ''),
                'adults': task.get('details', {}).get('adults', 1),
                'seat_type': task.get('details', {}).get('seat_type', 'GENERAL'),
                'mode': task.get('details', {}).get('mode', 'standby'),
                'phase': task.get('phase', ''),
                'end_time': task.get('details', {}).get('end_time', ''),
                'open_at': open_at_iso(task.get('details', {})),
                'preferred_trains': task.get('details', {}).get('preferred_trains', [])
            })
    return jsonify({'tasks': my_tasks})

@app.route('/api/ack-auto-reserve', methods=['POST'])
def ack_auto_reserve():
    task_id = request.form.get('task_id')
    auth = get_auth_from_headers()
    if task_id in active_auto_reserves:
        task = active_auto_reserves[task_id]
        task_auth = task['details'].get('auth')
        if not task_auth or task_auth == auth:
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

        client = get_ktx_client()
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