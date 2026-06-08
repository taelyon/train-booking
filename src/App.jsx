import React, { useState, useEffect, useRef } from 'react';
import { subscribeUserToPush } from './push-notification';

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

const TrainIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" className={className}>
        <path fill="#4A90E2" d="M18 4H6a2 2 0 0 0-2 2v9h16V6a2 2 0 0 0-2-2z"/>
        <path fill="#50E3C2" d="M4 15h16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2z"/>
        <path fill="#FFFFFF" d="M7 8h2v2H7zM11 8h2v2h-2zM15 8h2v2h-2z"/>
        <path fill="#F5A623" d="M6 19h12v2H6z"/>
    </svg>
);

const AlertTriangleIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
);

const SettingsIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);

// --- Sound Utility ---
const playSuccessSound = () => {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (!audioContext) return;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(660, audioContext.currentTime); // E5 note
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.1); // A5 note
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.25);
    } catch (e) {
        console.error("Could not play sound:", e);
    }
};


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
                <main className="flex-grow p-4 pb-28">
                    <div className={activeTab === 'search' ? '' : 'hidden'}>
                        <SearchAndBookingFlow />
                    </div>
                    <div className={activeTab === 'reservations' ? '' : 'hidden'}>
                        <ReservationsScreen active={activeTab === 'reservations'} />
                    </div>
                    <div className={activeTab === 'settings' ? '' : 'hidden'}>
                        <SettingsScreen />
                    </div>
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
        { id: 'settings', icon: SettingsIcon, label: '관리' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 shadow-[0_-1px_20px_rgba(0,0,0,0.08)] z-50">
            <div className="flex justify-around items-center h-20">
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
    const [view, setView] = useState('search'); // 'search', 'results', 'autoRetry'
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchParams, setSearchParams] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [autoRetryData, setAutoRetryData] = useState(null);
    const [reservationResult, setReservationResult] = useState(null); // Used for the popup
    const [favorites, setFavorites] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('trainFavorites') || '[]');
        } catch (e) {
            console.error("Failed to parse favorites from localStorage", e);
            return [];
        }
    });

    useEffect(() => {
        // 브라우저가 서비스 워커와 알림 기능을 지원하는지 확인
        if ('serviceWorker' in navigator && 'Notification' in window) {
            // 사용자에게 아직 권한을 묻지 않은 상태('default')일 때만 요청
            if (Notification.permission === 'default') {
                subscribeUserToPush();
            }
        }
    }, []); // 빈 배열[]은 이 코드가 맨 처음 한 번만 실행되게 함

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


    const getAuthHeaders = () => {
        const credentials = JSON.parse(localStorage.getItem('trainCredentials') || '{}');
        return {
            'X-KTX-ID': credentials.ktxId || '',
            'X-KTX-PW': credentials.ktxPw || '',
            'X-SRT-ID': credentials.srtId || '',
            'X-SRT-PW': credentials.srtPw || ''
        };
    };

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
            const response = await fetch(`/api/search?${query}`, {
                headers: getAuthHeaders()
            });
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
            time: `${train.dep_time.substring(0,2)}:${train.dep_time.substring(2,4)}`, // 열차가 검색결과 첫 페이지에 나오도록 출발시간으로 덮어쓰기
            train_number: train.train_number || train.train_no,
            seat_type: seatType,
        };
        const endpoint = isRetry ? '/api/start-auto-reserve' : '/api/reserve';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    ...getAuthHeaders()
                },
                body: new URLSearchParams(body),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error_message || '예약 처리 중 오류가 발생했습니다.');
            
            if (isRetry) {
                setReservationResult({ success: true, message: "백그라운드 자동 예매가 시작되었습니다. 앱을 종료하셔도 푸시 알림으로 알려드립니다." });
                setView('results');
                setIsLoading(false);
            } else if (result.retry) {
                const bgResponse = await fetch('/api/start-auto-reserve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...getAuthHeaders() },
                    body: new URLSearchParams(body),
                });
                const bgResult = await bgResponse.json();
                if (!bgResponse.ok) throw new Error(bgResult.error_message);
                
                setReservationResult({ success: true, message: "열차가 매진되어 백그라운드 자동 예매를 시작했습니다. 앱을 종료하셔도 푸시 알림으로 알려드립니다." });
                setView('results');
                setIsLoading(false);
            } else if (result.reservation) {
                playSuccessSound();
                setReservationResult({ success: true, data: result.reservation });
                setView('results');
                setIsLoading(false);
            } else {
                 setReservationResult({ success: false, message: result.error_message || '알 수 없는 오류가 발생했습니다.' });
                 setIsLoading(false);
            }
        } catch (err) {
            setReservationResult({ success: false, message: err.message });
            setIsLoading(false);
        }
    };
    
    const renderMainView = () => {
        switch (view) {
            case 'results': return <ResultsView data={searchResults} onReserve={handleReserve} onBack={() => setView('search')} isLoading={isLoading} />;
            default: return <SearchForm onSubmit={handleSearch} isLoading={isLoading} favorites={favorites} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />;
        }
    };

    return (
        <>
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}
            
            {renderMainView()}

            {reservationResult && (
                <ResultMessage
                    result={reservationResult}
                    onBack={() => {
                        const isSuccess = reservationResult.success;
                        setReservationResult(null);
                        if (isSuccess) {
                            setView('search');
                        }
                    }}
                />
            )}
        </>
    );
}

function ReservationsScreen({ active }) {
    const [reservations, setReservations] = useState({ srt_reservations: [], ktx_reservations: [], srt_error: null, ktx_error: null });
    const [bgTasks, setBgTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [paymentInfo, setPaymentInfo] = useState(null); //결제정보

    const fetchReservations = async () => {
        setIsLoading(true);
        setError('');
        setMessage('');
        try {
            const credentials = JSON.parse(localStorage.getItem('trainCredentials') || '{}');
            const response = await fetch('/api/reservations', {
                headers: {
                    'X-KTX-ID': credentials.ktxId || '',
                    'X-KTX-PW': credentials.ktxPw || '',
                    'X-SRT-ID': credentials.srtId || '',
                    'X-SRT-PW': credentials.srtPw || ''
                }
            });
            if(!response.ok) throw new Error('예매 내역을 불러오는데 실패했습니다.');
            const data = await response.json();
            setReservations(data);
            const bgResponse = await fetch('/api/auto-reserve-status', { headers: getAuthHeaders() });
            if (bgResponse.ok) {
                const bgData = await bgResponse.json();
                setBgTasks(bgData.tasks || []);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        if (active) {
            fetchReservations();
        }
    }, [active]);

    const handleStopBgTask = async (task_id) => {
        if (!window.confirm('자동 예매를 중단하시겠습니까?')) return;
        setIsLoading(true);
        try {
            const body = new URLSearchParams({ task_id });
            const response = await fetch('/api/stop-auto-reserve', { method: 'POST', body, headers: getAuthHeaders() });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error_message);
            setMessage(result.message);
            await fetchReservations();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

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

    const handlePayment = async (paymentDetails) => {
        setIsLoading(true);
        setError('');
        setMessage('');
        try {
            const body = new URLSearchParams(paymentDetails);
            const response = await fetch('/api/pay', { method: 'POST', body });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error_message || '결제 중 오류 발생');
            
            setMessage(result.message);
            setPaymentInfo(null); // Close payment modal
            await fetchReservations(); // Refresh the list
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
             <h1 className="text-3xl font-bold text-slate-800 text-center">예매 내역</h1>
             {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg">{error}</div>}
             {message && <div className="bg-green-100 text-green-700 p-3 rounded-lg">{message}</div>}
             {isLoading ? <div className="text-center p-8"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div></div> :
              <ReservationsView 
                  reservations={reservations} 
                  bgTasks={bgTasks}
                  onCancel={handleCancel}
                  onPay={(info) => setPaymentInfo(info)}
                  onStopBgTask={handleStopBgTask}
                  isLoading={isLoading} 
              />
             }
            {paymentInfo && (
                <PaymentModal
                    reservation={paymentInfo.reservation}
                    trainType={paymentInfo.type}
                    onClose={() => setPaymentInfo(null)}
                    onSubmit={handlePayment}
                    isLoading={isLoading}
                />
            )}
        </div>
    )
}

// --- View Components ---

function SearchForm({ onSubmit, isLoading, favorites, onAddFavorite, onRemoveFavorite }) {
    const [trainType, setTrainType] = useState(() => {
        if (favorites && favorites.length > 0) return favorites[0].type;
        return 'SRT';
    });
    const [depStation, setDepStation] = useState(() => {
        if (favorites && favorites.length > 0) return favorites[0].dep;
        return '수서';
    });
    const [arrStation, setArrStation] = useState(() => {
        if (favorites && favorites.length > 0) return favorites[0].arr;
        return '광주송정';
    });
    
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        const defaultStations = STATIONS[trainType];
        if (trainType === 'SRT') {
            setDepStation(defaultStations.includes('수서') ? '수서' : defaultStations[0]);
            setArrStation(defaultStations.includes('광주송정') ? '광주송정' : defaultStations[1]);
        } else {
            setDepStation(defaultStations.includes('용산') ? '용산' : defaultStations[0]);
            setArrStation(defaultStations.includes('광주송정') ? '광주송정' : defaultStations[1]);
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

    const now = new Date();
    // KST는 UTC+9. 현재 UTC 시간에 9시간을 더해 한국 시간을 구합니다.
    const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);

    // KST 기준 날짜를 YYYY-MM-DD 형식으로 가져옵니다.
    const today = kstTime.toISOString().slice(0, 10);

    // 출발 시간 기본값으로 5분을 더합니다.
    const kstNowWithBuffer = new Date(kstTime.getTime() + 5 * 60 * 1000);
    const hours = kstNowWithBuffer.getUTCHours().toString().padStart(2, '0');
    const minutes = kstNowWithBuffer.getUTCMinutes().toString().padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    const [selectedDate, setSelectedDate] = useState(today);
    const [selectedTime, setSelectedTime] = useState(currentTime);

    const handleDateChange = (e) => {
        const newDate = e.target.value;
        setSelectedDate(newDate);
        if (newDate !== today) {
            setSelectedTime('00:00');
        } else {
            setSelectedTime(currentTime);
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <TrainIcon className="w-12 h-12 mx-auto text-blue-600 mb-2" />
                <h1 className="text-3xl font-bold text-slate-800">어디로 떠나시나요?</h1>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-5">
                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="flex bg-slate-100 rounded-lg p-1">{['SRT', 'KTX'].map(type => (<label key={type} className="flex-1 text-center cursor-pointer"><input type="radio" name="type" value={type} checked={trainType === type} onChange={() => setTrainType(type)} className="sr-only" /><span className={`block py-2 rounded-md transition font-semibold ${trainType === type ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>{type}</span></label>))}</div>
                    
                    <div className="relative bg-slate-50 rounded-lg p-4">
                        <div className="flex items-center gap-2">
                            <StationSelect label="출발" name="dep" stations={STATIONS[trainType]} value={depStation} onChange={e => setDepStation(e.target.value)} />
                            <button type="button" onClick={handleSwapStations} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-2 w-10 h-10 flex items-center justify-center border-4 border-white rounded-full bg-slate-200 hover:bg-slate-300 transition text-slate-600 z-10">
                                <SwapIcon />
                            </button>
                            <StationSelect label="도착" name="arr" stations={STATIONS[trainType]} value={arrStation} onChange={e => setArrStation(e.target.value)} />
                        </div>
                         <button type="button" onClick={handleAddFavorite} className="absolute -top-2 -right-2 bg-amber-400 text-amber-900 rounded-full w-8 h-8 flex items-center justify-center hover:bg-amber-500 transition shadow-md text-xl">★</button>
                    </div>
                    
                    <div>
                        <label className="block text-slate-700 text-sm font-bold mb-1">출발일시</label>
                        <div className="flex items-center border border-slate-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden">
                            <input 
                                type="date" 
                                name="date" 
                                value={selectedDate}
                                onChange={handleDateChange}
                                required 
                                className="flex-1 min-w-0 px-3 py-2 border-r border-slate-300 focus:outline-none bg-white" 
                            />
                            <input 
                                type="time" 
                                name="time" 
                                value={selectedTime}
                                onChange={(e) => setSelectedTime(e.target.value)}
                                required 
                                className="flex-1 min-w-0 px-3 py-2 focus:outline-none bg-white" 
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="adults" className="block text-slate-700 text-sm font-bold mb-1">성인 승객</label>
                        <select name="adults" id="adults" defaultValue="1" className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">{[...Array(5).keys()].map(n => <option key={n+1} value={n+1}>{n+1}명</option>)}</select>
                    </div>

                    <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg transition duration-300 disabled:from-slate-400 disabled:to-slate-300 flex justify-center items-center text-lg">
                        {isLoading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : '열차 조회하기'}
                    </button>
                </form>
            </div>

            {favorites.length > 0 && (
                <div className="mt-6">
                    <h3 className="font-bold text-slate-700 mb-3 text-center">⭐ 즐겨찾는 구간</h3>
                    <div className="flex flex-wrap justify-center gap-2">
                        {favorites.map((fav, index) => (
                            <div key={index} className="relative group">
                                <button type="button" onClick={() => applyFavorite(fav)} onTouchEnd={(e) => { e.preventDefault(); applyFavorite(fav); }} className="bg-white border border-slate-300 rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition">
                                    <span className={`font-bold ${fav.type === 'SRT' ? 'text-purple-600' : 'text-blue-600'}`}>{fav.type}</span> {fav.dep} → {fav.arr}
                                </button>
                                 <button type="button" onClick={() => onRemoveFavorite(fav)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto">×</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function StationSelect({ label, name, stations, value, onChange }) {
    return (
        <div className="flex-1 flex flex-col items-center">
            <label htmlFor={name} className="text-xs text-slate-500 font-semibold">{label}</label>
            <select 
                name={name} 
                id={name} 
                required 
                value={value} 
                onChange={onChange} 
                className="w-full font-bold text-slate-800 text-lg bg-transparent focus:outline-none appearance-none text-center p-1"
                style={{ textAlignLast: "center" }}
            >
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
            {/* 아래 부분을 수정합니다. */}
            <div className="space-y-3">
                {data.trains?.length > 0 ? (
                    data.trains.map((train, index) => (
                        <TrainCard key={index} train={train} trainType={data.train_type} onReserve={onReserve} isLoading={isLoading} />
                    ))
                ) : (
                    <EmptyResults searchParams={data} onBack={onBack} />
                )}
            </div>
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

function ReservationCard({ reservation, type, onCancel, onPay, isLoading }) {
    // --- Data Normalization ---
    const isSrt = type === 'SRT';
    const trainName = isSrt ? reservation.train_name : reservation.train_type_name;
    const trainNo = isSrt ? reservation.train_number : reservation.train_no;
    const depName = isSrt ? reservation.dep_station_name : reservation.dep_name;
    const arrName = isSrt ? reservation.arr_station_name : reservation.arr_name;
    const depDate = isSrt ? reservation.dep_date : (reservation.dep_date || reservation.run_date);
    const depTime = reservation.dep_time;
    const arrTime = reservation.arr_time;
    const price = isSrt ? reservation.total_cost : reservation.price;
    const seatCount = isSrt ? reservation.seat_count : reservation.seat_no_count;
    const pnrNo = isSrt ? reservation.reservation_number : (reservation.pnr_no || reservation.rsv_id);
    const isTicket = isSrt ? reservation.paid : reservation.is_ticket;
    const isWaiting = reservation.is_waiting;
    const paymentDate = isSrt ? reservation.payment_date : reservation.buy_limit_date;
    const paymentTime = isSrt ? reservation.payment_time : reservation.buy_limit_time;

    // --- Status Logic ---
    let statusText, statusColor, paymentInfo = null;
    if (isWaiting) {
        statusText = "예약 대기";
        statusColor = "bg-gray-500 text-white";
    } else if (isTicket) {
        statusText = "결제 완료";
        statusColor = "bg-green-600 text-white";
    } else {
        statusText = "결제 대기";
        statusColor = "bg-orange-500 text-white";
        if (paymentDate && paymentDate !== "00000000") {
             paymentInfo = `결제기한: ${paymentDate.substring(4,6)}월 ${paymentDate.substring(6,8)}일 ${paymentTime.substring(0,2)}:${paymentTime.substring(2,4)}`;
        }
    }

    const formattedDate = `${depDate.substring(0,4)}년 ${depDate.substring(4,6)}월 ${depDate.substring(6,8)}일`;

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-sm font-semibold text-slate-600">{formattedDate}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusColor}`}>{statusText}</span>
            </div>

            <div>
                 <div className="flex justify-between items-baseline mb-2">
                    <span className={`font-bold text-lg ${type === 'SRT' ? 'text-purple-700' : 'text-blue-700'}`}>{trainName} {trainNo}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <div className="text-center">
                        <div className="text-xl font-bold text-slate-800">{depTime.substring(0,2)}:{depTime.substring(2,4)}</div>
                        <div className="text-md text-slate-600">{depName}</div>
                    </div>
                     <div className="flex-grow flex items-center justify-center text-slate-400 px-2">
                        <div className="flex-grow border-t-2 border-dotted border-slate-300"></div>
                        <TrainIcon className="w-5 h-5 mx-2 flex-shrink-0" />
                        <div className="flex-grow border-t-2 border-dotted border-slate-300"></div>
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-bold text-slate-800">{arrTime.substring(0,2)}:{arrTime.substring(2,4)}</div>
                        <div className="text-md text-slate-600">{arrName}</div>
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-3">
                 <div className="flex justify-between text-sm text-slate-700">
                    <span>{seatCount}석</span>
                    <span className="font-bold">{new Intl.NumberFormat('ko-KR').format(price)}원</span>
                 </div>
                 {paymentInfo && <p className="text-sm text-center text-red-600 font-bold p-2 bg-red-50 rounded-md">{paymentInfo}</p>}
                 <div className="flex gap-2">
                    {!isTicket && !isWaiting && (
                        <button
                            onClick={() => onPay({ reservation, type })}
                            disabled={isLoading}
                            className="flex-1 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition disabled:bg-slate-400"
                        >
                            {isLoading ? '...' : '결제하기'}
                        </button>
                    )}
                    <button 
                        onClick={() => onCancel(pnrNo, type, isTicket)} 
                        disabled={isLoading} 
                        className="flex-1 bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition disabled:bg-slate-400"
                    >
                        {isLoading ? '...' : (isTicket ? '환불하기' : '예매 취소')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function EmptyReservations() {
    return (
        <div className="text-center py-16 px-4">
            <TicketIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h2 className="text-xl font-bold text-slate-700 mb-2">예매 내역이 비어있습니다</h2>
            <p className="text-slate-500">아직 예매하신 기차표가 없네요.<br />첫 여행을 계획해 보세요!</p>
        </div>
    );
}

function ReservationsView({ reservations, bgTasks, onCancel, onPay, onStopBgTask, isLoading }) {
    const srtList = reservations.srt_reservations || [];
    const ktxList = reservations.ktx_reservations || [];
    const srtError = reservations.srt_error;
    const ktxError = reservations.ktx_error;

    const hasSrtReservations = srtList.length > 0;
    const hasKtxReservations = ktxList.length > 0;

    if (!hasSrtReservations && !hasKtxReservations && !srtError && !ktxError && (!bgTasks || bgTasks.length === 0)) {
        return <EmptyReservations />;
    }

    const renderList = (type, list, error) => {
        if (error) {
            return (
                 <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-800 mb-3">{type}</h2>
                    <p className="text-red-500 p-4 bg-red-50 rounded-lg">{type}: {error}</p>
                 </div>
            );
        }
        if (!list || list.length === 0) return null;

        return (
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-3">{type}</h2>
                <div className="space-y-4">
                    {list.map((r, i) => (
                        <ReservationCard 
                            key={`${type}-${i}`}
                            reservation={r}
                            type={type}
                            onCancel={onCancel}
                            onPay={onPay}
                            isLoading={isLoading}
                        />
                     ))}
                </div>
            </div>
        );
    }
    
    return (
        <div>
            {bgTasks && bgTasks.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-800 mb-3">진행 중인 자동 예매</h2>
                    <div className="space-y-4">
                        {bgTasks.map(task => (
                            <div key={task.task_id} className="bg-white p-4 rounded-lg shadow-sm border border-blue-200 space-y-3">
                                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                    <span className="text-sm font-semibold text-slate-600">{task.date.substring(0,4)}년 {task.date.substring(4,6)}월 {task.date.substring(6,8)}일 {task.time.substring(0,2)}:{task.time.substring(2,4)}</span>
                                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700 animate-pulse">자동 예매 중</span>
                                </div>
                                <div className="flex justify-between items-baseline mb-2">
                                    <span className="font-bold text-lg text-slate-700">{task.train_type} {task.train_number}</span>
                                </div>
                                <div className="text-center font-bold text-slate-800">{task.dep} → {task.arr}</div>
                                <div className="pt-3">
                                    <button onClick={() => onStopBgTask(task.task_id)} disabled={isLoading} className="w-full bg-slate-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-600 transition">중단하기</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {renderList('SRT', srtList, srtError)}
            {renderList('KTX', ktxList, ktxError)}
        </div>
    );
}

function PaymentModal({ reservation, trainType, onClose, onSubmit, isLoading }) {
    const pnrNo = trainType === 'SRT' ? reservation.reservation_number : (reservation.pnr_no || reservation.rsv_id);
    const price = trainType === 'SRT' ? reservation.total_cost : reservation.price;

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const paymentDetails = Object.fromEntries(formData.entries());
        paymentDetails.pnr_no = pnrNo;
        paymentDetails.train_type = trainType;
        onSubmit(paymentDetails);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4">
                <h2 className="text-xl font-bold text-center text-slate-800">결제 정보 입력</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-slate-700 text-sm font-bold mb-1">카드 번호</label>
                        <input name="card_number" type="text" placeholder="1234-5678-1234-5678" required className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="block text-slate-700 text-sm font-bold mb-1">유효기간 (YYMM)</label>
                            <input name="card_expire_date" type="text" placeholder="2809" required className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-slate-700 text-sm font-bold mb-1">비밀번호 (앞 2자리)</label>
                            <input name="card_password" type="password" placeholder="••" required className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-slate-700 text-sm font-bold mb-1">생년월일 (YYMMDD)</label>
                        <input name="card_birthday" type="text" placeholder="901231" required className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="text-center font-bold text-lg text-slate-800 pt-2">
                        결제 금액: {new Intl.NumberFormat('ko-KR').format(price)}원
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 bg-slate-200 text-slate-800 font-bold py-3 px-4 rounded-lg hover:bg-slate-300 transition">취소</button>
                        <button type="submit" disabled={isLoading} className="flex-1 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:bg-slate-400">
                            {isLoading ? '결제 중...' : '결제하기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ResultMessage({ result, onBack }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setVisible(true), 10); // Animate in
        return () => clearTimeout(timer);
    }, []);

    const handleBack = () => {
        setVisible(false);
        setTimeout(onBack, 300); // Wait for animation to finish
    };
    
    const isSuccess = result?.success;
    const message = result?.message || (isSuccess ? '성공적으로 처리되었습니다.' : '오류가 발생했습니다.');
    const details = result?.data;
    
    return (
        <div className={`fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
            <div className={`bg-white rounded-lg shadow-xl w-full max-w-sm text-center p-6 transform transition-all duration-300 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
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
                <button onClick={handleBack} className="mt-8 w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition">확인</button>
            </div>
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
            <h1 className="text-2xl font-bold text-slate-800 mb-2">자동 예매 시도 중...</h1>
            <p className="text-slate-600 mb-6">선택한 열차의 취소표를 실시간으로 확인하고 있습니다.</p>
            <div className="bg-slate-50 p-4 rounded-lg shadow-inner border">
                <p className="font-semibold text-slate-800 text-lg">{train.dep_station_name || train.dep_name} → {train.arr_station_name || train.arr_name}</p>
                <p className="text-slate-500 text-sm">{searchParams.date} {searchParams.time}</p>
                <p className="mt-4 font-bold text-blue-600 text-lg">{countdown}초 후 다시 시도합니다.</p>
            </div>
            <button onClick={onCancel} className="mt-8 w-full bg-slate-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition duration-300">중단하기</button>
        </div>
    );
}

function EmptyResults({ searchParams, onBack }) {
    const dep = searchParams?.dep;
    const arr = searchParams?.arr;
    const time = searchParams?.time;

    return (
        <div className="text-center p-4 pt-12">
            <AlertTriangleIcon className="w-16 h-16 mx-auto text-amber-400 mb-4" />
            <h1 className="text-2xl font-bold text-slate-800 mb-2">조회된 열차가 없습니다</h1>
            <p className="text-slate-500 mb-8">
                <strong>{dep} → {arr}</strong> 방면, <strong>{time}</strong> 이후의 열차가 매진되었거나 운행하지 않습니다.
            </p>
            <div className="space-y-4">                
                <button
                    onClick={onBack}
                    className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition duration-300 flex items-center justify-center"
                >
                    <BackIcon />
                    <span className="ml-2">다시 검색하기</span>
                </button>
            </div>
        </div>
    );
}

function SettingsScreen() {
    const [notificationStatus, setNotificationStatus] = useState(
        window.Notification ? window.Notification.permission : 'unsupported'
    );
    
    const handleRequestNotification = async () => {
        if (window.Notification) {
            let permission = window.Notification.permission;
            
            // 아직 권한을 결정하지 않은 상태라면 시스템 팝업을 띄워 요청
            if (permission === 'default' || (permission !== 'granted' && permission !== 'denied')) {
                permission = await window.Notification.requestPermission();
            }

            if (permission === 'granted') {
                try {
                    await subscribeUserToPush();
                } catch(e) { console.error(e); }
            }
            
            setNotificationStatus(permission);
            
            if (permission === 'granted') {
                setMessage('푸시 알림이 설정되었습니다.');
                setTimeout(() => setMessage(''), 3000);
            } else {
                setMessage('푸시 알림 권한이 거부되었습니다. 브라우저 설정에서 직접 허용해주세요.');
                setTimeout(() => setMessage(''), 3000);
            }
        }
    };

    const [credentials, setCredentials] = useState({
        ktxId: '',
        ktxPw: '',
        srtId: '',
        srtPw: ''
    });
    const [message, setMessage] = useState('');

    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('trainCredentials') || '{}');
        
        const fetchDefaults = async () => {
            try {
                const response = await fetch('/api/config');
                const defaults = await response.json();
                
                setCredentials({
                    ktxId: saved.ktxId || defaults.ktxId || '',
                    ktxPw: saved.ktxPw || defaults.ktxPw || '',
                    srtId: saved.srtId || defaults.srtId || '',
                    srtPw: saved.srtPw || defaults.srtPw || ''
                });
            } catch (e) {
                console.error("Failed to fetch default config", e);
                setCredentials({
                    ktxId: saved.ktxId || '',
                    ktxPw: saved.ktxPw || '',
                    srtId: saved.srtId || '',
                    srtPw: saved.srtPw || ''
                });
            }
        };

        fetchDefaults();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCredentials(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        localStorage.setItem('trainCredentials', JSON.stringify(credentials));
        setMessage('설정이 저장되었습니다.');
        setTimeout(() => setMessage(''), 3000);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">계정 관리</h1>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
                <h2 className="text-lg font-bold text-blue-600 flex items-center gap-2">
                    <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
                    KTX (코레일)
                </h2>
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600">멤버십 번호 / 이메일 / 전화번호</label>
                    <input 
                        type="text" 
                        name="ktxId"
                        value={credentials.ktxId}
                        onChange={handleChange}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="아이디 입력"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600">비밀번호</label>
                    <input 
                        type="password" 
                        name="ktxPw"
                        value={credentials.ktxPw}
                        onChange={handleChange}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="비밀번호 입력"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
                <h2 className="text-lg font-bold text-purple-600 flex items-center gap-2">
                    <span className="w-2 h-6 bg-purple-600 rounded-full"></span>
                    SRT (에스알)
                </h2>
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600">이메일 / 회원번호 / 전화번호</label>
                    <input 
                        type="text" 
                        name="srtId"
                        value={credentials.srtId}
                        onChange={handleChange}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="아이디 입력"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600">비밀번호</label>
                    <input 
                        type="password" 
                        name="srtPw"
                        value={credentials.srtPw}
                        onChange={handleChange}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="비밀번호 입력"
                    />
                </div>
            </div>

            {/* 푸시 알림 설정 구역 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
                <h2 className="text-lg font-bold text-green-600 flex items-center gap-2">
                    <span className="w-2 h-6 bg-green-600 rounded-full"></span>
                    푸시 알림 설정
                </h2>
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div>
                        <p className="font-semibold text-slate-800">예매 성공 알림</p>
                        <p className="text-xs text-slate-500 mt-1">자동 예매 성공 시 푸시 알림을 받습니다.</p>
                    </div>
                    <div>
                        {notificationStatus === 'granted' ? (
                            <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full">허용됨</span>
                        ) : notificationStatus === 'denied' ? (
                            <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-bold rounded-full">차단됨</span>
                        ) : notificationStatus === 'unsupported' ? (
                            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm font-bold rounded-full">앱 설치 필요</span>
                        ) : (
                            <button onClick={handleRequestNotification} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition">
                                알림 켜기
                            </button>
                        )}
                    </div>
                </div>
                {notificationStatus === 'denied' && (
                    <p className="text-xs text-red-500 mt-2">알림이 차단되어 있습니다. 주소창의 자물쇠 아이콘을 눌러 알림 권한을 '허용'으로 변경해주세요.</p>
                )}
                {notificationStatus === 'unsupported' && (
                    <p className="text-xs text-amber-600 mt-2">
                        아이폰(iOS) 사파리 브라우저에서는 하단의 '공유' 버튼(네모 안의 위쪽 화살표)을 눌러 <strong>[홈 화면에 추가]</strong> 기능을 통해 바탕화면에 앱을 설치하신 후, 생성된 앱으로 접속하셔야만 푸시 알림 기능을 사용할 수 있습니다.
                    </p>
                )}
            </div>

            <button 
                onClick={handleSave}
                className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-900 transition-colors"
            >
                설정 저장하기
            </button>

            {message && (
                <div className="text-center text-green-600 font-semibold animate-bounce">
                    {message}
                </div>
            )}

            <div className="bg-slate-100 rounded-xl p-6 space-y-4">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    💡 열차 예매 서비스 이용 가이드
                </h2>
                <div className="text-sm text-slate-600 space-y-3 leading-relaxed">
                    <p>1. <strong>계정 설정:</strong> 상단 입력란에 본인의 KTX(코레일) 및 SRT(에스알) 계정 정보를 입력하고 <strong>[설정 저장하기]</strong>를 누르세요.</p>
                    <p className="text-xs text-slate-500 pl-4 -mt-2">
                        * 입력하신 계정 정보는 서버에 저장되지 않고, 사용하시는 <strong>개별 브라우저 내부(localStorage)</strong>에만 안전하게 보관됩니다.
                    </p>
                    
                    <p>2. <strong>열차 조회 및 예매:</strong> 출발/도착역, 날짜, 인원을 선택하여 열차를 조회하세요.</p>
                    
                    <p>3. <strong>자동 예매 시도 (취소표 대기):</strong> 원하는 열차가 매진된 경우 <strong>[자동 예매 시도]</strong>를 누르면, 취소표가 발생할 때까지 5초 간격으로 시스템이 자동 재시도합니다. (예매 성공 시 브라우저 알림이 발송됩니다.)</p>
                    
                    <p>4. <strong>결제 및 취소/환불:</strong> 예매가 성공하면 <strong>[예매 내역]</strong> 탭에서 결제 카드를 등록하여 즉시 결제하거나, <strong>코레일톡 앱이나 SRT 앱</strong>에서 결제할 수 있습니다. 기한 내에 결제하지 않으면 예약이 자동 취소되므로 유의해 주세요.</p>
                </div>
            </div>
        </div>
    );
}