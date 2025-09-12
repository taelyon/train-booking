import React, { useState, useEffect } from 'react';

const STATIONS = {
    "SRT": [
        "수서", "동탄", "평택지제", "경주", "곡성", "공주", "광주송정",
        "구례구", "김천(구미)", "나주", "남원", "대전", "동대구", "마산",
        "목포", "밀양", "부산", "서대구", "순천", "여수EXPO", "여천",
        "오송", "울산(통도사)", "익산", "전주", "정읍", "진영", "진주",
        "창원", "창원중앙", "천안아산", "포항",
    ],
    "KTX": [
        "서울", "용산", "영등포", "광명", "수원", "천안아산", "오송", "대전",
        "서대전", "김천구미", "동대구", "경주", "포항", "밀양", "구포", "부산",
        "울산(통도사)", "마산", "창원중앙", "경산", "논산", "익산", "정읍",
        "광주송정", "목포", "전주", "순천", "여수EXPO", "청량리", "강릉", "행신",
    ],
};


export default function App() {
    const [view, setView] = useState('search');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchParams, setSearchParams] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [autoRetryData, setAutoRetryData] = useState(null);
    const [reservations, setReservations] = useState({ srt: [], ktx: [] });
    const [reservationResult, setReservationResult] = useState(null);
    const [favorites, setFavorites] = useState([]);

    useEffect(() => {
        try {
            const savedFavorites = JSON.parse(localStorage.getItem('trainFavorites') || '[]');
            setFavorites(savedFavorites);
        } catch (e) {
            console.error("Failed to parse favorites from localStorage", e);
            setFavorites([]);
        }
    }, []);
    
    // 🔽 즐겨찾기 로직을 'type' 포함하도록 수정 🔽
    const updateFavorites = (newFavorites) => {
        const uniqueFavorites = Array.from(new Set(newFavorites.map(fav => JSON.stringify(fav)))).map(favStr => JSON.parse(favStr));
        localStorage.setItem('trainFavorites', JSON.stringify(uniqueFavorites));
        setFavorites(uniqueFavorites);
    };

    const addFavorite = (favorite) => {
        if (favorites.some(fav => fav.type === favorite.type && fav.dep === favorite.dep && fav.arr === favorite.arr)) {
            alert('이미 등록된 즐겨찾기 구간입니다.');
            return;
        }
        updateFavorites([...favorites, favorite]);
    };

    const removeFavorite = (favoriteToRemove) => {
        const newFavorites = favorites.filter(fav => fav.type !== favoriteToRemove.type || fav.dep !== favoriteToRemove.dep || fav.arr !== favoriteToRemove.arr);
        updateFavorites(newFavorites);
    };

    useEffect(() => {
        let timer;
        if (autoRetryData) {
            timer = setTimeout(() => {
                handleReserve(autoRetryData.train, autoRetryData.seatType, true);
            }, 5000);
        }
        return () => clearTimeout(timer);
    }, [autoRetryData]);

    const handleSearch = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setAutoRetryData(null);
        
        const formData = new FormData(e.target);
        const params = Object.fromEntries(formData.entries());
        setSearchParams(params);
        const query = new URLSearchParams(params).toString();

        try {
            const response = await fetch(`/api/search?${query}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || '서버에서 오류가 발생했습니다.');
            setSearchResults(data);
            setView('results');
        } catch (err) {
            setError(err.message);
            setView('search');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleReserve = async (train, seatType, isRetry = false) => {
        setIsLoading(true);
        setError('');
        setAutoRetryData(null);
        
        if (!searchParams) {
            setError('검색 정보가 유효하지 않습니다. 다시 검색해주세요.');
            setIsLoading(false);
            setView('search');
            return;
        }

        const body = {
            ...searchParams,
            train_number: train.train_number || train.train_no,
            seat_type: seatType,
        };
        const endpoint = isRetry ? '/api/auto-retry' : '/api/reserve';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(body),
            });
            const result = await response.json();
             if (!response.ok) throw new Error(result.error_message || '예약 처리 중 오류가 발생했습니다.');
            
            if (result.retry) {
                 setAutoRetryData({ train, seatType });
            } else if (result.reservation) {
                setReservationResult({ success: true, data: result.reservation });
                setView('resultMessage');
            } else {
                 setReservationResult({ success: false, message: result.error_message || '알 수 없는 오류가 발생했습니다.' });
                 setView('resultMessage');
            }
        } catch (err) {
            setReservationResult({ success: false, message: err.message });
            setView('resultMessage');
        } finally {
            setIsLoading(false);
        }
    };
    
    const fetchReservations = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch('/api/reservations');
            if(!response.ok) throw new Error('예매 내역을 불러오는데 실패했습니다.');
            const data = await response.json();
            setReservations(data);
            setView('reservations');
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = async (pnr_no, train_type, is_ticket) => {
        // 🔽 요청을 보내기 전, 필수 정보가 있는지 먼저 확인하는 코드를 추가했습니다. 🔽
        if (!pnr_no || !train_type) {
            alert('오류: 취소에 필요한 예약번호 또는 열차 종류 정보가 없습니다. 페이지를 새로고침 후 다시 시도해주세요.');
            setIsLoading(false);
            return;
        }

        if (!window.confirm('정말로 이 예매를 취소하시겠습니까?')) return;
        setIsLoading(true);
        try {
            // 🔽 데이터를 더 명시적이고 안정적인 방식으로 구성하도록 수정했습니다. 🔽
            const body = new URLSearchParams();
            body.append('pnr_no', pnr_no);
            body.append('train_type', train_type);
            // is_ticket 값은 true/false 또는 undefined일 수 있으므로, 문자열로 변환하여 전달합니다.
            body.append('is_ticket', String(is_ticket === true));

            const response = await fetch('/api/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error_message || '취소 중 오류 발생');
            
            setReservationResult({ success: true, message: result.message });
            // 취소 성공 후, 예매 내역을 다시 불러와 화면을 갱신합니다.
            await fetchReservations(); 
            setView('resultMessage');
        } catch(err) {
            setReservationResult({ success: false, message: err.message });
            setView('resultMessage');
        } finally {
            setIsLoading(false);
        }
    }

    const renderContent = () => {
        if (autoRetryData) return <AutoRetryView train={autoRetryData.train} searchParams={searchParams} onCancel={() => { setAutoRetryData(null); setView('results'); }} />;
        switch (view) {
            case 'results': return <ResultsView data={searchResults} onReserve={handleReserve} onBack={() => setView('search')} isLoading={isLoading} />;
            case 'reservations': return <ReservationsView reservations={reservations} onBack={() => setView('search')} onCancel={handleCancel} isLoading={isLoading} />;
            case 'resultMessage': return <ResultMessage result={reservationResult} onBack={() => setView('search')} />;
            default: return <SearchForm 
                onSubmit={handleSearch} 
                onShowReservations={fetchReservations} 
                isLoading={isLoading}
                favorites={favorites}
                onAddFavorite={addFavorite}
                onRemoveFavorite={removeFavorite}
            />;
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen font-sans flex justify-center items-start p-0 sm:p-4">
            <div className="w-full max-w-2xl bg-white sm:rounded-xl shadow-lg">
                <main className="p-4 sm:p-8">
                    {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}
                    {renderContent()}
                </main>
            </div>
        </div>
    );
}

// --- Sub-components ---

// 🔽 SearchForm 컴포넌트 전체 수정 🔽

function SearchForm({ onSubmit, onShowReservations, isLoading, favorites, onAddFavorite, onRemoveFavorite }) {
    const [trainType, setTrainType] = useState('SRT');
    const [depStation, setDepStation] = useState('수서');
    const [arrStation, setArrStation] = useState('부산');
    
    useEffect(() => {
        const defaultStations = STATIONS[trainType];
        if (trainType === 'SRT') {
            setDepStation(defaultStations.includes('수서') ? '수서' : defaultStations[0]);
            setArrStation(defaultStations.includes('부산') ? '부산' : defaultStations[1]);
        } else { // KTX
            setDepStation(defaultStations.includes('서울') ? '서울' : defaultStations[0]);
            setArrStation(defaultStations.includes('부산') ? '부산' : defaultStations[1]);
        }
    }, [trainType]);

    const handleAddFavorite = () => {
        if (!depStation || !arrStation) {
            alert('출발역과 도착역을 모두 선택해주세요.');
            return;
        }
        onAddFavorite({ type: trainType, dep: depStation, arr: arrStation });
    };

    const applyFavorite = (fav) => {
        setTrainType(fav.type);
        setDepStation(fav.dep);
        setArrStation(fav.arr);
    };

    const handleSwapStations = () => {
        const temp = depStation;
        setDepStation(arrStation);
        setArrStation(temp);
    };

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().substring(0, 5);

    return (
        <>
            <h1 className="text-3xl font-bold text-center text-blue-900 mb-2">기차 조회 🚆</h1>
            <div className="text-center mb-6"><button onClick={onShowReservations} className="bg-blue-100 text-blue-800 font-semibold py-2 px-4 border border-blue-300 rounded-lg hover:bg-blue-200 transition">🎫 예매 확인 / 취소</button></div>
            
            {favorites.length > 0 && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                    <h3 className="font-bold text-gray-700 mb-2">⭐ 즐겨찾는 구간</h3>
                    <ul className="space-y-2">
                        {favorites.map((fav, index) => (
                            <li key={index} className="flex justify-between items-center bg-white p-2 rounded shadow-sm">
                                <button type="button" onClick={() => applyFavorite(fav)} className="text-left flex-grow hover:text-blue-700 transition">
                                    <span className={`inline-block rounded px-2 py-1 text-xs font-semibold mr-2 ${fav.type === 'SRT' ? 'bg-purple-200 text-purple-800' : 'bg-blue-200 text-blue-800'}`}>{fav.type}</span>
                                    <span className="font-semibold">{fav.dep} → {fav.arr}</span>
                                </button>
                                <button type="button" onClick={() => onRemoveFavorite(fav)} className="text-red-500 hover:text-red-700 font-bold ml-4 px-2 transition">X</button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            
            <form onSubmit={onSubmit}>
                <div className="mb-4"><div className="flex bg-gray-200 rounded-lg p-1">{['SRT', 'KTX'].map(type => (<label key={type} className="flex-1 text-center cursor-pointer"><input type="radio" name="type" value={type} checked={trainType === type} onChange={() => setTrainType(type)} className="sr-only" /><span className={`block py-2 rounded-md transition font-semibold ${trainType === type ? 'bg-white text-blue-800 shadow' : 'text-gray-600'}`}>{type}</span></label>))}</div></div>
                
                <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1">
                        <StationSelect key={`${trainType}-dep`} label="출발역" name="dep" stations={STATIONS[trainType]} value={depStation} onChange={e => setDepStation(e.target.value)} />
                    </div>
                    <div className="mt-7">
                        {/* 🔽 SVG 아이콘을 텍스트로 교체했습니다. 🔽 */}
                        <button type="button" onClick={handleSwapStations} className="p-2 w-10 h-10 flex items-center justify-center border rounded-full bg-gray-100 hover:bg-gray-200 transition text-xl font-bold text-gray-600">
                            ↔
                        </button>
                    </div>
                    <div className="flex-1">
                        <StationSelect key={`${trainType}-arr`} label="도착역" name="arr" stations={STATIONS[trainType]} value={arrStation} onChange={e => setArrStation(e.target.value)} />
                    </div>
                </div>

                <div className="mb-4">
                    <button type="button" onClick={handleAddFavorite} className="w-full bg-yellow-400 text-yellow-900 font-semibold py-2 px-4 rounded-lg hover:bg-yellow-500 transition">★ 현재 구간 즐겨찾기 추가</button>
                </div>
                
                <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">출발일 / 시각</label>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <input type="date" name="date" defaultValue={today} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <input type="time" name="time" defaultValue={now} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                </div>
                <div className="mb-6">
                    <label htmlFor="adults" className="block text-gray-700 text-sm font-bold mb-2">성인 승객수</label><select name="adults" id="adults" defaultValue="1" className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}명</option>)}</select>
                </div>
                <button type="submit" disabled={isLoading} className="w-full bg-blue-800 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition duration-300 disabled:bg-gray-400">{isLoading ? '조회 중...' : '조회하기'}</button>
            </form>
        </>
    );
}


function StationSelect({ label, name, stations, value, onChange }) {
    return (
        <div>
            <label htmlFor={name} className="block text-gray-700 text-sm font-bold mb-2">{label}</label>
            <select name={name} id={name} required value={value} onChange={onChange} className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {stations.map(station => <option key={station} value={station}>{station}</option>)}
            </select>
        </div>
    );
}

function ResultsView({ data, onReserve, onBack, isLoading }) {
    return (
        <div>
            <button onClick={onBack} className="text-blue-800 font-semibold mb-4 hover:underline">← 다시 검색하기</button>
            <h1 className="text-2xl font-bold text-center text-blue-900 mb-1">조회 결과</h1>
            <h2 className="text-lg text-center text-gray-600 mb-6">{data.dep} → {data.arr}</h2>
            <div className="space-y-3">{data.trains?.length > 0 ? (data.trains.map((train, index) => (<TrainCard key={index} train={train} trainType={data.train_type} onReserve={onReserve} isLoading={isLoading} />))) : (<div className="bg-white p-4 rounded-lg shadow-md text-center text-gray-500">조회 가능한 열차가 없습니다.</div>)}</div>
        </div>
    );
}

function TrainCard({ train, trainType, onReserve, isLoading }) {
    const isSrt = trainType === 'SRT';
    const isSeatAvailable = isSrt ? train.seat_available : train.has_seat;
    const isGeneralAvailable = isSrt ? train.general_seat_available : train.has_general_seat;
    const isSpecialAvailable = isSrt ? train.special_seat_available : train.has_special_seat;
    const [selectedSeat, setSelectedSeat] = useState(() => isGeneralAvailable ? 'GENERAL' : (isSpecialAvailable ? 'SPECIAL' : 'GENERAL'));
    const depTime = train.dep_time; const arrTime = train.arr_time;

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-md p-4">
            <div className="font-bold text-gray-800 mb-3">{train.train_name || train.train_type_name} {train.train_number || train.train_no}</div>
            <div className="flex justify-between items-center mb-4">
                <div className="text-center"><div className="text-xl font-bold">{depTime.substring(0,2)}:{depTime.substring(2,4)}</div><div className="text-sm text-gray-600">{train.dep_station_name || train.dep_name}</div></div>
                <div className="text-2xl text-blue-800">→</div>
                <div className="text-center"><div className="text-xl font-bold">{arrTime.substring(0,2)}:{arrTime.substring(2,4)}</div><div className="text-sm text-gray-600">{train.arr_station_name || train.arr_name}</div></div>
            </div>
            <div className="border-t pt-3"><div className="flex justify-around gap-2"><SeatOption label="일반실" value="GENERAL" state={train.general_seat_state || (isGeneralAvailable ? '예약가능' : '매진')} available={isGeneralAvailable} selectedSeat={selectedSeat} setSelectedSeat={setSelectedSeat} /><SeatOption label="특실" value="SPECIAL" state={train.special_seat_state || (isSpecialAvailable ? '예약가능' : '매진')} available={isSpecialAvailable} selectedSeat={selectedSeat} setSelectedSeat={setSelectedSeat} /></div></div>
            <button onClick={() => onReserve(train, selectedSeat)} disabled={isLoading} className={`w-full mt-4 text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:bg-gray-400 ${isSeatAvailable ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-500 hover:bg-yellow-600 text-gray-800'}`}>{isSeatAvailable ? '예매하기' : '🔄 자동 예매 시도'}</button>
        </div>
    );
}

function SeatOption({ label, value, state, available, selectedSeat, setSelectedSeat }) {
    return (
        <label className={`flex-1 p-2 border rounded-md text-center transition ${!available ? 'cursor-not-allowed' : 'cursor-pointer'} ${selectedSeat === value ? 'bg-blue-100 border-blue-500' : 'bg-gray-50'}`}>
            <input type="radio" name={`seat_type_${label}`} value={value} checked={selectedSeat === value} onChange={() => setSelectedSeat(value)} disabled={!available} className="sr-only"/>
            <span className={`font-semibold ${available ? (selectedSeat === value ? 'text-blue-800' : 'text-gray-800') : 'text-gray-400'}`}>{label}: {state}</span>
        </label>
    );
}

function ReservationsView({ reservations, onBack, onCancel, isLoading }) {
    const renderList = (type, list, error) => (
        <div className="mb-8">
            <h2 className="text-xl font-bold text-blue-900 mb-3">{type} 예매 내역</h2>
            <div className="space-y-3">
                {error ? <p className="text-red-500">{error}</p> :
                 list?.length > 0 ? list.map((r, i) => (
                    <div key={i} className="bg-white p-4 rounded-lg shadow-md border">
                        <p className="text-gray-800 mb-3 font-semibold">{r.dump}</p>
                        <button onClick={() => onCancel(r.pnr_no || r.reservation_number, type, r.is_ticket)} disabled={isLoading} className="w-full bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition">취소하기</button>
                    </div>
                 )) : <p className="text-gray-500">예매 내역이 없습니다.</p>
                }
            </div>
        </div>
    );
    return (
        <div><button onClick={onBack} className="text-blue-800 font-semibold mb-4 hover:underline">← 첫 화면으로 돌아가기</button><h1 className="text-2xl font-bold text-center text-blue-900 mb-6">예매 내역 확인 / 취소</h1>{renderList('SRT', reservations.srt_reservations, reservations.srt_error)}{renderList('KTX', reservations.ktx_reservations, reservations.ktx_error)}</div>
    );
}

function ResultMessage({ result, onBack }) {
    const isSuccess = result?.success;
    const message = result?.message || (isSuccess ? '성공적으로 처리되었습니다.' : '오류가 발생했습니다.');
    const details = result?.data;
    return (
        <div className="text-center">
            <h1 className={`text-2xl font-bold mb-4 ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>{isSuccess ? '처리 완료 ✅' : '처리 실패 😥'}</h1>
            <div className="bg-white p-6 rounded-lg shadow-md border"><p className="text-lg mb-4">{message}</p>{details && (<div className="text-left bg-gray-50 p-4 rounded-md"><p><strong>열차:</strong> {details.dump}</p>{details.payment_date && details.payment_date !== "00000000" && (<p><strong>결제 기한:</strong> {`${details.payment_date.substring(4,6)}월 ${details.payment_date.substring(6,8)}일 ${details.payment_time.substring(0,2)}:${details.payment_time.substring(2,4)}`}</p>)}</div>)}</div>
            <button onClick={onBack} className="mt-6 bg-blue-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition">첫 화면으로 돌아가기</button>
        </div>
    );
}

function AutoRetryView({ train, searchParams, onCancel }) {
    const [countdown, setCountdown] = useState(5);
    useEffect(() => { if (countdown > 0) { const timer = setTimeout(() => setCountdown(countdown - 1), 1000); return () => clearTimeout(timer); } }, [countdown]);
    return (
        <div className="text-center">
            <h1 className="text-2xl font-bold text-blue-800 mb-4">자동 예매 시도 중...</h1><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800 mx-auto mb-4"></div>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <p className="font-semibold">{train.dep_station_name || train.dep_name} → {train.arr_station_name || train.arr_name}</p>
                <p className="text-gray-600">{searchParams.date} {searchParams.time}</p><p className="mt-4">선택한 열차의 취소 표를 확인하고 있습니다. 이 페이지를 닫지 마세요.</p><p className="mt-2 font-bold text-blue-700">{countdown}초 후 자동으로 다시 시도합니다.</p>
            </div>
            <button onClick={onCancel} className="mt-6 bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition duration-300">시도 중단</button>
        </div>
    );
}