import React, { useState, useEffect, useRef } from 'react';

// --- Icon Components ---
const SearchIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
);

const TicketIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path>
        <path d="M13 5v2"></path><path d="M13 17v2"></path><path d="M13 11v2"></path>
    </svg>
);

const SwapIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3L4 7l4 4"></path><path d="M4 7h16"></path><path d="m16 21 4-4-4-4"></path><path d="M20 17H4"></path>
    </svg>
);

const BackIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
);


// --- Constants ---
const STATIONS = {
    "SRT": ["수서", "동탄", "평택지제", "경주", "곡성", "공주", "광주송정", "구례구", "김천(구미)", "나주", "남원", "대전", "동대구", "마산", "목포", "밀양", "부산", "서대구", "순천", "여수EXPO", "여천", "오송", "울산(통도사)", "익산", "전주", "정읍", "진영", "진주", "창원", "창원중앙", "천안아산", "포항"],
    "KTX": ["서울", "용산", "영등포", "광명", "수원", "천안아산", "오송", "대전", "서대전", "김천구미", "동대구", "경주", "포항", "밀양", "구포", "부산", "울산(통도사)", "마산", "창원중앙", "경산", "논산", "익산", "정읍", "광주송정", "목포", "전주", "순천", "여수EXPO", "청량리", "강릉", "행신"],
};

// --- Main App Component ---
export default function App() {
    const [activeTab, setActiveTab] = useState('search');

    return (
        <div className="bg-slate-50 font-sans flex justify-center items-start">
            <div className="w-full max-w-md bg-white min-h-screen shadow-lg flex flex-col">
                <main className="flex-grow p-4 pb-24">
                    {activeTab === 'search' ? <SearchAndBookingFlow /> : <ReservationsScreen />}
                </main>
                <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>
        </div>
    );
}

// --- Navigation ---
function BottomNav({ activeTab, setActiveTab }) {
    const navItems = [
        { id: 'search', icon: SearchIcon, label: '열차 조회' },
        { id: 'reservations', icon: TicketIcon, label: '예매 내역' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 shadow-[0_-1px_10px_rgba(0,0,0,0.05)]">
            <div className="flex justify-around items-center h-16">
                {navItems.map(item => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${isActive ? 'text-blue-600' : 'text-slate-500 hover:text-blue-500'}`}
                        >
                            <item.icon className="w-6 h-6 mb-1" />
                            <span className={`text-xs font-semibold ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}


// --- Screens & Flows ---

function SearchAndBookingFlow() {
    const [view, setView] = useState('search'); // 'search', 'results', 'resultMessage', 'autoRetry'
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchParams, setSearchParams] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [autoRetryData, setAutoRetryData] = useState(null);
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
                 const attempt = (autoRetryData?.attempt || 0) + 1;
                 setAutoRetryData({ train, seatType, attempt });
                 setView('autoRetry');
            } else if (result.reservation) {
                setAutoRetryData(null);
                setReservationResult({ success: true, data: result.reservation });
                setView('resultMessage');
            } else {
                 setAutoRetryData(null);
                 setReservationResult({ success: false, message: result.error_message || '알 수 없는 오류가 발생했습니다.' });
                 setView('resultMessage');
            }
        } catch (err) {
            setAutoRetryData(null);
            setReservationResult({ success: false, message: err.message });
            setView('resultMessage');
        } finally {
            if (!autoRetryData) {
               setIsLoading(false);
            }
        }
    };

    if (error) {
        return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>
    }

    switch (view) {
        case 'results': return <ResultsView data={searchResults} onReserve={handleReserve} onBack={() => setView('search')} isLoading={isLoading} />;
        case 'resultMessage': return <ResultMessage result={reservationResult} onBack={() => setView('search')} />;
        case 'autoRetry': return <AutoRetryView key={autoRetryData.attempt} train={autoRetryData.train} searchParams={searchParams} onCancel={() => { setAutoRetryData(null); setView('results'); setIsLoading(false); }} />;
        default: return <SearchForm onSubmit={handleSearch} isLoading={isLoading} favorites={favorites} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />;
    }
}

function ReservationsScreen() {
    const [reservations, setReservations] = useState({ srt_reservations: [], ktx_reservations: [], srt_error: null, ktx_error: null });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const fetchReservations = async () => {
        setIsLoading(true);
        setError('');
        setMessage('');
        try {
            const response = await fetch('/api/reservations');
            if(!response.ok) throw new Error('예매 내역을 불러오는데 실패했습니다.');
            const data = await response.json();
            setReservations(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchReservations();
    }, []);

    const handleCancel = async (pnr_no, train_type, is_ticket) => {
        if (!pnr_no || !train_type) {
            alert('오류: 취소에 필요한 예약번호 또는 열차 종류 정보가 없습니다.');
            return;
        }
        if (!window.confirm('정말로 이 예매를 취소하시겠습니까?')) return;

        setIsLoading(true);
        setError('');
        setMessage('');
        try {
            const body = new URLSearchParams({ pnr_no, train_type, is_ticket: String(is_ticket === true) });
            const response = await fetch('/api/cancel', { method: 'POST', body });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error_message || '취소 중 오류 발생');
            
            setMessage(result.message);
            await fetchReservations(); // Refresh the list
        } catch(err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
             <h1 className="text-3xl font-bold text-slate-800">예매 내역</h1>
             {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg">{error}</div>}
             {message && <div className="bg-green-100 text-green-700 p-3 rounded-lg">{message}</div>}
             {isLoading ? <div className="text-center p-8"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div></div> :
              <ReservationsView reservations={reservations} onCancel={handleCancel} isLoading={isLoading} />
             }
        </div>
    )
}

// --- View Components ---

function SearchForm({ onSubmit, isLoading, favorites, onAddFavorite, onRemoveFavorite }) {
    const [trainType, setTrainType] = useState('SRT');
    const [depStation, setDepStation] = useState('수서');
    const [arrStation, setArrStation] = useState('부산');
    
    useEffect(() => {
        const defaultStations = STATIONS[trainType];
        if (trainType === 'SRT') {
            setDepStation(defaultStations.includes('수서') ? '수서' : defaultStations[0]);
            setArrStation(defaultStations.includes('부산') ? '부산' : defaultStations[1]);
        } else {
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
        setDepStation(arrStation);
        setArrStation(depStation);
    };

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const currentTime = now.toTimeString().substring(0, 5);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-800">어디로 떠나시나요? 🚆</h1>
            
            {favorites.length > 0 && (
                <div>
                    <h3 className="font-bold text-slate-700 mb-2">⭐ 즐겨찾는 구간</h3>
                    <ul className="space-y-2">
                        {favorites.map((fav, index) => (
                            <li key={index} className="flex justify-between items-center bg-slate-100 p-2 rounded-lg">
                                <button type="button" onClick={() => applyFavorite(fav)} className="text-left flex-grow hover:opacity-80 transition">
                                    <span className={`inline-block rounded px-2 py-1 text-xs font-semibold mr-2 ${fav.type === 'SRT' ? 'bg-purple-200 text-purple-800' : 'bg-blue-200 text-blue-800'}`}>{fav.type}</span>
                                    <span className="font-semibold text-slate-800">{fav.dep} → {fav.arr}</span>
                                </button>
                                <button type="button" onClick={() => onRemoveFavorite(fav)} className="text-red-500 hover:text-red-700 font-bold ml-4 px-2 text-lg transition">×</button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
                <div className="flex bg-slate-100 rounded-lg p-1">{['SRT', 'KTX'].map(type => (<label key={type} className="flex-1 text-center cursor-pointer"><input type="radio" name="type" value={type} checked={trainType === type} onChange={() => setTrainType(type)} className="sr-only" /><span className={`block py-2 rounded-md transition font-semibold ${trainType === type ? 'bg-white text-blue-600 shadow' : 'text-slate-600'}`}>{type}</span></label>))}</div>
                
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <StationSelect key={`${trainType}-dep`} label="출발" name="dep" stations={STATIONS[trainType]} value={depStation} onChange={e => setDepStation(e.target.value)} />
                    </div>
                    <button type="button" onClick={handleSwapStations} className="p-2 mt-7 w-10 h-10 flex items-center justify-center border rounded-full bg-slate-100 hover:bg-slate-200 transition text-slate-600">
                        <SwapIcon />
                    </button>
                    <div className="flex-1">
                        <StationSelect key={`${trainType}-arr`} label="도착" name="arr" stations={STATIONS[trainType]} value={arrStation} onChange={e => setArrStation(e.target.value)} />
                    </div>
                </div>

                <div>
                    <button type="button" onClick={handleAddFavorite} className="w-full bg-amber-300 text-amber-900 font-semibold py-2.5 px-4 rounded-lg hover:bg-amber-400 transition text-sm">★ 현재 구간 즐겨찾기</button>
                </div>
                
                <div className="flex gap-2">
                    <div className="flex-1"><label className="block text-slate-700 text-sm font-bold mb-2">출발일</label><input type="date" name="date" defaultValue={today} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                    <div className="flex-1"><label className="block text-slate-700 text-sm font-bold mb-2">시각</label><input type="time" name="time" defaultValue={currentTime} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                </div>
                <div>
                    <label htmlFor="adults" className="block text-slate-700 text-sm font-bold mb-2">성인 승객</label><select name="adults" id="adults" defaultValue="1" className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">{[...Array(5).keys()].map(n => <option key={n+1} value={n+1}>{n+1}명</option>)}</select>
                </div>
                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition duration-300 disabled:bg-slate-400 flex justify-center items-center">{isLoading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : '열차 조회하기'}</button>
            </form>
        </div>
    );
}

function StationSelect({ label, name, stations, value, onChange }) {
    return (
        <div>
            <label htmlFor={name} className="block text-slate-700 text-sm font-bold mb-2">{label}</label>
            <select name={name} id={name} required value={value} onChange={onChange} className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-no-repeat bg-right pr-8" style={{backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}>
              {stations.map(station => <option key={station} value={station}>{station}</option>)}
            </select>
        </div>
    );
}

function ResultsView({ data, onReserve, onBack, isLoading }) {
    return (
        <div className="space-y-4">
             <div className="flex items-center">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100"><BackIcon/></button>
                <div className="text-center flex-grow">
                    <h1 className="text-xl font-bold text-slate-800">조회 결과</h1>
                    <p className="text-md text-slate-500">{data.dep} → {data.arr}</p>
                </div>
                <div className="w-10"></div>
            </div>
            <div className="space-y-3">{data.trains?.length > 0 ? (data.trains.map((train, index) => (<TrainCard key={index} train={train} trainType={data.train_type} onReserve={onReserve} isLoading={isLoading} />))) : (<div className="bg-white p-6 rounded-lg text-center text-slate-500">조회 가능한 열차가 없습니다.</div>)}</div>
        </div>
    );
}

function TrainCard({ train, trainType, onReserve, isLoading }) {
    const isSrt = trainType === 'SRT';
    const isGeneralAvailable = isSrt ? train.general_seat_available : train.has_general_seat;
    const isSpecialAvailable = isSrt ? train.special_seat_available : train.has_special_seat;
    
    const [selectedSeat, setSelectedSeat] = useState(() => {
        if (isGeneralAvailable) return 'GENERAL';
        if (isSpecialAvailable) return 'SPECIAL';
        return 'GENERAL';
    });
    
    const isSelectedSeatAvailable = (selectedSeat === 'GENERAL' && isGeneralAvailable) || (selectedSeat === 'SPECIAL' && isSpecialAvailable);
        
    const calculateDuration = (depTime, arrTime) => {
        const depTotalMinutes = parseInt(depTime.substring(0, 2)) * 60 + parseInt(depTime.substring(2, 4));
        const arrTotalMinutes = parseInt(arrTime.substring(0, 2)) * 60 + parseInt(arrTime.substring(2, 4));
        let diff = arrTotalMinutes - depTotalMinutes;
        if (diff < 0) diff += 24 * 60;
        const hours = Math.floor(diff / 60);
        const minutes = diff % 60;
        return `${hours > 0 ? `${hours}시간 ` : ''}${minutes}분`;
    };
    
    const duration = calculateDuration(train.dep_time, train.arr_time);

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 transition-all hover:shadow-md">
            <div className="flex justify-between items-baseline mb-3">
              <span className={`font-bold text-lg ${isSrt ? 'text-purple-700' : 'text-blue-700'}`}>{train.train_name || train.train_type_name} {train.train_number || train.train_no}</span>
              <span className="text-sm text-slate-500">{duration} 소요</span>
            </div>
            <div className="flex justify-between items-center mb-4">
                <div className="text-center"><div className="text-2xl font-bold text-slate-800">{train.dep_time.substring(0,2)}:{train.dep_time.substring(2,4)}</div><div className="text-sm text-slate-600">{train.dep_station_name || train.dep_name}</div></div>
                <div className="flex-grow flex items-center justify-center text-slate-400">
                    <span className="w-2 h-2 bg-slate-400 rounded-full"></span>
                    <div className="flex-grow border-t-2 border-dotted border-slate-300 mx-2"></div>
                    <span className="w-2 h-2 bg-slate-400 rounded-full"></span>
                </div>
                <div className="text-center"><div className="text-2xl font-bold text-slate-800">{train.arr_time.substring(0,2)}:{train.arr_time.substring(2,4)}</div><div className="text-sm text-slate-600">{train.arr_station_name || train.arr_name}</div></div>
            </div>
            <div className="border-t pt-3 flex gap-2">
                <SeatOption label="일반실" value="GENERAL" state={train.general_seat_state || (isGeneralAvailable ? '예약가능' : '매진')} available={isGeneralAvailable} selectedSeat={selectedSeat} setSelectedSeat={setSelectedSeat} />
                <SeatOption label="특실" value="SPECIAL" state={train.special_seat_state || (isSpecialAvailable ? '예약가능' : '매진')} available={isSpecialAvailable} selectedSeat={selectedSeat} setSelectedSeat={setSelectedSeat} />
            </div>
            <button 
                onClick={() => onReserve(train, selectedSeat, !isSelectedSeatAvailable)} 
                disabled={isLoading} 
                className={`w-full mt-4 text-white font-bold py-2.5 px-4 rounded-lg transition duration-300 disabled:bg-slate-400 flex justify-center items-center ${
                    isSelectedSeatAvailable ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-500 hover:bg-amber-600 text-slate-900'
                }`}
            >
                 {isLoading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>}
                 {isSelectedSeatAvailable ? '예매하기' : '자동 예매 시도'}
            </button>
        </div>
    );
}

function SeatOption({ label, value, state, available, selectedSeat, setSelectedSeat }) {
    return (
        <label className={`flex-1 p-2 border rounded-md text-center cursor-pointer transition-all duration-200 ${selectedSeat === value ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
            <input type="radio" name={`seat_type_${label}`} value={value} checked={selectedSeat === value} onChange={() => setSelectedSeat(value)} className="sr-only" />
            <div className="text-sm font-semibold text-slate-600">{label}</div>
            <div className={`text-md font-bold ${available ? 'text-green-600' : 'text-slate-400'}`}>{state}</div>
        </label>
    );
}

function ReservationsView({ reservations, onCancel, isLoading }) {
    const renderList = (type, list, error) => (
        <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-3">{type}</h2>
            <div className="space-y-3">
                {error ? <p className="text-red-500">{error}</p> :
                 list?.length > 0 ? list.map((r, i) => (
                    <div key={i} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                        <p className="text-slate-800 mb-3 font-semibold text-sm leading-relaxed">{r.dump}</p>
                        <button onClick={() => onCancel(r.pnr_no || r.reservation_number, type, r.is_ticket)} disabled={isLoading} className="w-full bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition disabled:bg-slate-400">
                            {isLoading ? '취소 중...' : '예매 취소'}
                        </button>
                    </div>
                 )) : <p className="text-slate-500 text-center py-4">예매 내역이 없습니다.</p>
                }
            </div>
        </div>
    );

    return (
        <div>
            {renderList('SRT', reservations.srt_reservations, reservations.srt_error)}
            {renderList('KTX', reservations.ktx_reservations, reservations.ktx_error)}
        </div>
    );
}

function ResultMessage({ result, onBack }) {
    const isSuccess = result?.success;
    const message = result?.message || (isSuccess ? '성공적으로 처리되었습니다.' : '오류가 발생했습니다.');
    const details = result?.data;
    
    return (
        <div className="text-center p-4">
            <div className={`mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center ${isSuccess ? 'bg-green-100' : 'bg-red-100'}`}>
                <span className="text-4xl">{isSuccess ? '✅' : '😥'}</span>
            </div>
            <h1 className={`text-2xl font-bold mb-2 ${isSuccess ? 'text-green-700' : 'text-red-700'}`}>{isSuccess ? '처리 완료' : '처리 실패'}</h1>
            <p className="text-slate-600 mb-6">{message}</p>
            {details && (
                <div className="text-left bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
                    <p className="font-semibold">{details.dump}</p>
                    {details.payment_date && details.payment_date !== "00000000" && (
                        <p className="mt-2 text-red-600 font-bold">
                            결제 기한: {`${details.payment_date.substring(4,6)}월 ${details.payment_date.substring(6,8)}일 ${details.payment_time.substring(0,2)}:${details.payment_time.substring(2,4)}`}
                        </p>
                    )}
                </div>
            )}
            <button onClick={onBack} className="mt-8 w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition">확인</button>
        </div>
    );
}

function AutoRetryView({ train, searchParams, onCancel }) {
    const [countdown, setCountdown] = useState(5);
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    return (
        <div className="text-center p-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">빈 자리 확인 중...</h1>
            <p className="text-slate-600 mb-6">선택한 열차의 취소표를 실시간으로 확인하고 있습니다.</p>
            <div className="bg-slate-50 p-4 rounded-lg shadow-inner border">
                <p className="font-semibold text-slate-800">{train.dep_station_name || train.dep_name} → {train.arr_station_name || train.arr_name}</p>
                <p className="text-slate-500 text-sm">{searchParams.date} {searchParams.time}</p>
                <p className="mt-4 font-bold text-blue-600 text-lg">{countdown}초 후 다시 시도합니다.</p>
            </div>
            <button onClick={onCancel} className="mt-8 w-full bg-slate-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition duration-300">중단하기</button>
        </div>
    );
}



