import requests
import os
from dotenv import load_dotenv

load_dotenv()
import ktx
ktx_id=os.environ.get('KTX_ID')
ktx_pw=os.environ.get('KTX_PW')
client=ktx.Korail(ktx_id, ktx_pw)

found = False
for hour in range(16, 24):
    time_str = f"{hour:02d}0000"
    try:
        trains = client.search_train('서울', '부산', '20260502', time_str, train_type=ktx.TrainType.KTX)
        for t in trains:
            if '매진' not in t.general_seat:
                print(f"Found available train: {t.train_no} at {t.dep_time}")
                data = {
                    'train_type': 'KTX',
                    'dep': '서울',
                    'arr': '부산',
                    'date': '20260502',
                    'time': time_str, # The time we used for search
                    'train_number': t.train_no,
                    'adults': '1',
                    'seat_type': 'GENERAL'
                }
                r = requests.post('http://127.0.0.1:5000/api/reserve', data=data)
                print("Response:", r.text)
                found = True
                break
    except ktx.NoResultsError:
        pass
    if found:
        break

if not found:
    print("No available KTX trains found today.")
