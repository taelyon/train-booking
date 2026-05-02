import requests
import urllib.parse
from dotenv import load_dotenv
import os

load_dotenv()
import ktx
ktx_id=os.environ.get('KTX_ID')
ktx_pw=os.environ.get('KTX_PW')
client=ktx.Korail(ktx_id, ktx_pw)

try:
    trains = client.search_train('서울', '부산', '20260502', '200000', train_type=ktx.TrainType.KTX)
    target = next((t for t in trains if '매진' not in t.general_seat), None)
except ktx.NoResultsError:
    target = None

if not target:
    try:
        trains = client.search_train('서울', '부산', '20260502', '220000', train_type=ktx.TrainType.KTX)
        target = next((t for t in trains if '매진' not in t.general_seat), None)
    except ktx.NoResultsError:
        target = None

if target:
    print('Target train:', target.train_no)
    data = {
        'train_type': 'KTX',
        'dep': '서울',
        'arr': '부산',
        'date': '20260502',
        'time': '200000', # Send search time, not actual time
        'train_number': target.train_no,
        'adults': '1',
        'seat_type': 'GENERAL'
    }
    r = requests.post('http://127.0.0.1:5000/api/reserve', data=data)
    print(r.text)
else:
    print('No target train found')
