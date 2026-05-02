# -*- coding: utf-8 -*-
from dotenv import load_dotenv
import os

load_dotenv()
import ktx
ktx_id=os.environ.get('KTX_ID')
ktx_pw=os.environ.get('KTX_PW')
client=ktx.Korail(ktx_id, ktx_pw)

date_str = '20260502'
current_time = '170000'
all_trains = []
seen_train_nos = set()

for _ in range(5):
    print(f"Searching at {current_time}...")
    try:
        trains = client.search_train('서울', '부산', date_str, current_time, train_type=ktx.TrainType.KTX, include_no_seats=True)
    except ktx.NoResultsError:
        print("No results.")
        break
    
    new_trains = []
    for t in trains:
        if t.dep_date != date_str:
            continue
        if t.train_no not in seen_train_nos:
            seen_train_nos.add(t.train_no)
            new_trains.append(t)
    
    if not new_trains:
        print("No new trains.")
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

print(f"Found {len(all_trains)} trains.")
