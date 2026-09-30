import React, { useState, useEffect, useRef } from 'react';
import { subscribeUserToPush } from './push-notification';

// --- Auth Utils ---
export const getAuthHeaders = () => {
    const credentials = JSON.parse(localStorage.getItem('trainCredentials') || '{}');
    const ktxId = credentials.ktxId || credentials.srtId || '';
    const ktxPw = credentials.ktxPw || credentials.srtPw || '';
    return {
        'X-KTX-ID': ktxId,
        'X-KTX-PW': ktxPw,
        'X-SRT-ID': ktxId,
        'X-SRT-PW': ktxPw,
        'X-NOTIFY-EMAIL': credentials.notifyEmail || ''
    };
};

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
        <path fill="#4A90E2" d="M18 4H6a2 2 0 0 0-2 2v9h16V6a2 2 0 0 0-2-2z" />
        <path fill="#50E3C2" d="M4 15h16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2z" />
        <path fill="#FFFFFF" d="M7 8h2v2H7zM11 8h2v2h-2zM15 8h2v2h-2z" />
        <path fill="#F5A623" d="M6 19h12v2H6z" />
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
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);

const CalendarIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
        <path d="M12 14v3l2 1"></path>
    </svg>
);

const Modal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = '확인', cancelText = '취소', type = 'info' }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className={`p-6 text-center ${type === 'success' ? 'bg-green-50' : type === 'danger' ? 'bg-red-50' : ''}`}>
                    {type === 'success' && <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4"><svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></div>}
                    {type === 'danger' && <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4"><AlertTriangleIcon className="h-6 w-6 text-red-600" /></div>}
                    <h3 className="text-lg leading-6 font-bold text-slate-900 mb-2">{title}</h3>
                    <div className="text-sm text-slate-500 whitespace-pre-wrap">{message}</div>
                </div>
                <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
                    {onCancel && <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">{cancelText}</button>}
                    <button onClick={onConfirm} className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${type === 'danger' ? 'bg-red-600 hover:bg-red-700' : type === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};


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
const ALL_STATIONS = [
    // 수도권 주요 출발역
    "수서", "서울", "용산", "영등포", "광명", "수원", "동탄", "평택지제", "행신", "청량리",
    // 경부/동해선 방면
    "천안아산", "오송", "대전", "서대전", "김천구미", "동대구", "서대구", "경주", "포항", "밀양", "구포", "부산", "울산(통도사)",
    // 호남/전라선 방면
    "공주", "익산", "정읍", "광주송정", "나주", "목포", "전주", "남원", "곡성", "구례구", "순천", "여천", "여수EXPO",
    // 경전선/강원 방면
    "마산", "창원", "창원중앙", "진영", "진주", "강릉", "경산", "논산"
];

const STATIONS = {
    "KTX": ALL_STATIONS,
    "SRT": ALL_STATIONS
};

// --- Main App Component ---
export default function App() {
    const [activeTab, setActiveTab] = useState('search');

    return (
        <div className="bg-slate-50 font-sans flex justify-center items-start min-h-screen">
            <div className="w-full max-w-md bg-white min-h-screen shadow-lg flex flex-col">
                <main className="flex-grow px-4 pt-safe pb-safe">
                    <div className={activeTab === 'search' ? '' : 'hidden'}>
                        <SearchAndBookingFlow />
                    </div>
                    <div className={activeTab === 'openrun' ? '' : 'hidden'}>
                        <OpenRunScreen />
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
        { id: 'openrun', icon: CalendarIcon, label: '명절 오픈런' },
        { id: 'reservations', icon: TicketIcon, label: '예매 내역' },
        { id: 'settings', icon: SettingsIcon, label: '관리' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 shadow-[0_-1px_20px_rgba(0,0,0,0.08)] z-50 bottom-nav-safe">
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
        if (favorites.some(fav => fav.dep === favorite.dep && fav.arr === favorite.arr)) {
            alert('이미 등록된 즐겨찾기 구간입니다.');
            return;
        }
        updateFavorites([...favorites, { ...favorite, type: 'KTX' }]);
    };

    const removeFavorite = (favoriteToRemove) => {
        const newFavorites = favorites.filter(fav => fav.dep !== favoriteToRemove.dep || fav.arr !== favoriteToRemove.arr);
        updateFavorites(newFavorites);
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
            time: `${train.dep_time.substring(0, 2)}:${train.dep_time.substring(2, 4)}`, // 열차가 검색결과 첫 페이지에 나오도록 출발시간으로 덮어쓰기
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

    const [confirmModal, setConfirmModal] = useState({ isOpen: false, taskId: null });
    const [successModal, setSuccessModal] = useState({ isOpen: false, task: null });
    const [errorModal, setErrorModal] = useState({ isOpen: false, task: null });

    const fetchReservations = async () => {
        setIsLoading(true);
        setError('');
        setMessage('');
        try {
            const credentials = JSON.parse(localStorage.getItem('trainCredentials') || '{}');
            const ktxId = credentials.ktxId || credentials.srtId || '';
            const ktxPw = credentials.ktxPw || credentials.srtPw || '';
            const response = await fetch('/api/reservations', {
                headers: {
                    'X-KTX-ID': ktxId,
                    'X-KTX-PW': ktxPw,
                    'X-SRT-ID': ktxId,
                    'X-SRT-PW': ktxPw
                }
            });
            if (!response.ok) throw new Error('예매 내역을 불러오는데 실패했습니다.');
            const data = await response.json();
            setReservations(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const pollBgTasks = async () => {
        try {
            const bgResponse = await fetch('/api/auto-reserve-status', { headers: getAuthHeaders() });
            if (bgResponse.ok) {
                const bgData = await bgResponse.json();
                const tasks = bgData.tasks || [];
                setBgTasks(tasks.filter(t => t.status === 'running'));

                for (const task of tasks) {
                    if (task.status === 'success') {
                        setSuccessModal({ isOpen: true, task });
                        await fetch('/api/ack-auto-reserve', { method: 'POST', body: new URLSearchParams({ task_id: task.task_id }), headers: getAuthHeaders() });
                        fetchReservations(); // 예매 성공 시 전체 목록 즉시 갱신
                    } else if (task.status === 'failed') {
                        setErrorModal({ isOpen: true, task });
                        await fetch('/api/ack-auto-reserve', { method: 'POST', body: new URLSearchParams({ task_id: task.task_id }), headers: getAuthHeaders() });
                    }
                }
            }
        } catch (e) {
            console.error('Polling error:', e);
        }
    };

    useEffect(() => {
        let intervalId;
        if (active) {
            fetchReservations();
            pollBgTasks(); // 최초 1회 호출
            intervalId = setInterval(pollBgTasks, 10000); // 10초마다 갱신
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [active]);

    const openStopConfirm = (task_id) => {
        setConfirmModal({ isOpen: true, taskId: task_id });
    };

    const handleStopBgTask = async () => {
        const task_id = confirmModal.taskId;
        setConfirmModal({ isOpen: false, taskId: null });
        if (!task_id) return;

        setIsLoading(true);
        try {
            const body = new URLSearchParams({ task_id });
            const response = await fetch('/api/stop-auto-reserve', { method: 'POST', body, headers: getAuthHeaders() });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error_message);
            setMessage(result.message);
            await pollBgTasks();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = async (pnr_no, train_type, is_ticket) => {
        if (!pnr_no) {
            alert('오류: 취소에 필요한 예약번호 정보가 없습니다.');
            return;
        }
        if (!window.confirm('정말로 이 예매를 취소하시겠습니까?')) return;

        setIsLoading(true);
        setError('');
        setMessage('');
        try {
            const body = new URLSearchParams({ pnr_no, train_type: train_type || 'KTX', is_ticket: String(is_ticket === true) });
            const response = await fetch('/api/cancel', { method: 'POST', body, headers: getAuthHeaders() });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error_message || '취소 중 오류 발생');

            setMessage(result.message);
            await fetchReservations(); // Refresh the list
        } catch (err) {
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
            const response = await fetch('/api/pay', { method: 'POST', body, headers: getAuthHeaders() });
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
            <div className="text-center">
                <TicketIcon className="w-12 h-12 mx-auto text-blue-600 mb-1.5" />
                <h1 className="text-3xl font-bold text-slate-800">예매 내역</h1>
            </div>
            {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg">{error}</div>}
            {message && <div className="bg-green-100 text-green-700 p-3 rounded-lg">{message}</div>}
            {isLoading ? <div className="text-center p-8"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div></div> :
                <ReservationsView
                    reservations={reservations}
                    bgTasks={bgTasks}
                    onCancel={handleCancel}
                    onPay={(info) => setPaymentInfo(info)}
                    onStopBgTask={openStopConfirm}
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
            <Modal
                isOpen={confirmModal.isOpen}
                title="자동 예매 중단"
                message="진행 중인 자동 예매를 중단하시겠습니까?"
                confirmText="중단하기"
                cancelText="계속하기"
                type="danger"
                onConfirm={handleStopBgTask}
                onCancel={() => setConfirmModal({ isOpen: false, taskId: null })}
            />
            <Modal
                isOpen={successModal.isOpen}
                title="🎉 예매 성공!"
                message={`축하합니다! ${successModal.task?.mode === 'openrun' ? `명절 오픈런으로 ${successModal.task?.message}` : `${successModal.task?.train_type} ${successModal.task?.train_number} 열차 예매에 성공했습니다.`}\n\n앱에 등록된 카드로 즉시 결제하시거나, 코레일/SRT 앱에서 발권해 주세요.`}
                confirmText="확인"
                type="success"
                onConfirm={() => setSuccessModal({ isOpen: false, task: null })}
            />
            <Modal
                isOpen={errorModal.isOpen}
                title="자동 예매 실패"
                message={`예매 진행 중 오류가 발생하여 중단되었습니다.\n\n사유: ${errorModal.task?.message}`}
                confirmText="확인"
                type="danger"
                onConfirm={() => setErrorModal({ isOpen: false, task: null })}
            />
        </div>
    )
}

// --- View Components ---

function SearchForm({ onSubmit, isLoading, favorites, onAddFavorite, onRemoveFavorite }) {
    const [depStation, setDepStation] = useState(() => {
        if (favorites && favorites.length > 0) return favorites[0].dep;
        return '수서';
    });
    const [arrStation, setArrStation] = useState(() => {
        if (favorites && favorites.length > 0) return favorites[0].arr;
        return '부산';
    });

    const handleAddFavorite = () => {
        if (!depStation || !arrStation) {
            alert('출발역과 도착역을 모두 선택해주세요.');
            return;
        }
        onAddFavorite({ type: 'KTX', dep: depStation, arr: arrStation });
    };

    const applyFavorite = (fav) => {
        setDepStation(fav.dep);
        setArrStation(fav.arr);
    };

    const handleSwapStations = () => {
        setDepStation(arrStation);
        setArrStation(depStation);
    };

    const now = new Date();
    const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = kstTime.toISOString().slice(0, 10);
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
        <div className="space-y-3">
            <div className="text-center mb-1">
                <TrainIcon className="w-12 h-12 mx-auto text-blue-600 mb-1.5" />
                <h1 className="text-3xl font-bold text-slate-800">어디로 떠나시나요?</h1>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-5">
                <form onSubmit={onSubmit} className="space-y-4">
                    <input type="hidden" name="type" value="KTX" />



                    <div className="relative bg-slate-50 rounded-lg p-4">
                        <div className="flex items-center gap-2">
                            <StationSelect label="출발" name="dep" stations={ALL_STATIONS} value={depStation} onChange={e => setDepStation(e.target.value)} />
                            <button type="button" onClick={handleSwapStations} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-2 w-10 h-10 flex items-center justify-center border-4 border-white rounded-full bg-slate-200 hover:bg-slate-300 transition text-slate-600 z-10">
                                <SwapIcon />
                            </button>
                            <StationSelect label="도착" name="arr" stations={ALL_STATIONS} value={arrStation} onChange={e => setArrStation(e.target.value)} />
                        </div>
                        <button type="button" onClick={handleAddFavorite} title="즐겨찾기에 추가" className="absolute -top-2 -right-2 bg-amber-400 text-amber-900 rounded-full w-8 h-8 flex items-center justify-center hover:bg-amber-500 transition shadow-md text-xl">★</button>
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
                        <select name="adults" id="adults" defaultValue="1" className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">{[...Array(5).keys()].map(n => <option key={n + 1} value={n + 1}>{n + 1}명</option>)}</select>
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
                                    <span className="font-bold text-blue-600">KTX</span> {fav.dep} → {fav.arr}
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
                <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100"><BackIcon /></button>
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
    const isGeneralAvailable = train.general_seat_available ?? train.has_general_seat;
    const isSpecialAvailable = train.special_seat_available ?? train.has_special_seat;

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
    const depName = train.dep_station_name || train.dep_name;
    const arrName = train.arr_station_name || train.arr_name;
    const trainName = train.train_name || train.train_type_name || 'KTX';
    const trainNo = train.train_number || train.train_no;
    const isSuseoLine = depName === '수서' || arrName === '수서';

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 transition-all hover:shadow-md">
            <div className="flex justify-between items-baseline mb-3">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-blue-700">{trainName} {trainNo}</span>
                    {isSuseoLine && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            수서고속선
                        </span>
                    )}
                </div>
                <span className="text-sm text-slate-500">{duration} 소요</span>
            </div>
            <div className="flex justify-between items-center mb-4">
                <div className="text-center"><div className="text-2xl font-bold text-slate-800">{train.dep_time.substring(0, 2)}:{train.dep_time.substring(2, 4)}</div><div className="text-sm text-slate-600">{depName}</div></div>
                <div className="flex-grow flex items-center justify-center text-slate-400">
                    <span className="w-2 h-2 bg-slate-400 rounded-full"></span>
                    <div className="flex-grow border-t-2 border-dotted border-slate-300 mx-2"></div>
                    <span className="w-2 h-2 bg-slate-400 rounded-full"></span>
                </div>
                <div className="text-center"><div className="text-2xl font-bold text-slate-800">{train.arr_time.substring(0, 2)}:{train.arr_time.substring(2, 4)}</div><div className="text-sm text-slate-600">{arrName}</div></div>
            </div>
            <div className="border-t pt-3 flex gap-2">
                <SeatOption label="일반실" value="GENERAL" state={train.general_seat_state || (isGeneralAvailable ? '예약가능' : '매진')} available={isGeneralAvailable} selectedSeat={selectedSeat} setSelectedSeat={setSelectedSeat} />
                <SeatOption label="특실" value="SPECIAL" state={train.special_seat_state || (isSpecialAvailable ? '예약가능' : '매진')} available={isSpecialAvailable} selectedSeat={selectedSeat} setSelectedSeat={setSelectedSeat} />
            </div>
            <button
                onClick={() => onReserve(train, selectedSeat, !isSelectedSeatAvailable)}
                disabled={isLoading}
                className={`w-full mt-4 text-white font-bold py-2.5 px-4 rounded-lg transition duration-300 disabled:bg-slate-400 flex justify-center items-center ${isSelectedSeatAvailable ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-500 hover:bg-amber-600 text-slate-900'
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
            paymentInfo = `결제기한: ${paymentDate.substring(4, 6)}월 ${paymentDate.substring(6, 8)}일 ${paymentTime.substring(0, 2)}:${paymentTime.substring(2, 4)}`;
        }
    }

    const formattedDate = `${depDate.substring(0, 4)}년 ${depDate.substring(4, 6)}월 ${depDate.substring(6, 8)}일`;

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
                        <div className="text-xl font-bold text-slate-800">{depTime.substring(0, 2)}:{depTime.substring(2, 4)}</div>
                        <div className="text-md text-slate-600">{depName}</div>
                    </div>
                    <div className="flex-grow flex items-center justify-center text-slate-400 px-2">
                        <div className="flex-grow border-t-2 border-dotted border-slate-300"></div>
                        <TrainIcon className="w-5 h-5 mx-2 flex-shrink-0" />
                        <div className="flex-grow border-t-2 border-dotted border-slate-300"></div>
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-bold text-slate-800">{arrTime.substring(0, 2)}:{arrTime.substring(2, 4)}</div>
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
    const list = reservations.reservations || reservations.ktx_reservations || reservations.srt_reservations || [];
    const error = reservations.error || reservations.ktx_error || reservations.srt_error;

    if ((!list || list.length === 0) && !error && (!bgTasks || bgTasks.length === 0)) {
        return <EmptyReservations />;
    }

    return (
        <div>
            {bgTasks && bgTasks.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-800 mb-3">진행 중인 자동 예매</h2>
                    <div className="space-y-4">
                        {bgTasks.map(task => task.mode === 'openrun' ? (
                            <OpenRunTaskCard key={task.task_id} task={task} onStop={onStopBgTask} isLoading={isLoading} />
                        ) : (
                            <div key={task.task_id} className="bg-white p-4 rounded-lg shadow-sm border border-blue-200 space-y-3">
                                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                    <span className="text-sm font-semibold text-slate-600">
                                        {task.date.split('-')[0]}년 {task.date.split('-')[1]}월 {task.date.split('-')[2]}일 {task.time}
                                    </span>
                                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700 animate-pulse">자동 예매 중</span>
                                </div>
                                <div className="flex justify-between items-baseline mb-2">
                                    <span className="font-bold text-lg text-slate-700">{task.train_type || 'KTX'} {task.train_number}</span>
                                    {task.adults && <span className="text-sm text-slate-500 font-medium">{task.seat_type === 'GENERAL' ? '일반실' : '특실'} / 성인 {task.adults}명</span>}
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
            {error && (
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-800 mb-3">예매 내역</h2>
                    <p className="text-red-500 p-4 bg-red-50 rounded-lg">{error}</p>
                </div>
            )}
            {list && list.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-800 mb-3">통합 예매 내역</h2>
                    <div className="space-y-4">
                        {list.map((r, i) => (
                            <ReservationCard
                                key={`res-${i}`}
                                reservation={r}
                                type={r.train_name || r.train_type_name || 'KTX'}
                                onCancel={onCancel}
                                onPay={onPay}
                                isLoading={isLoading}
                            />
                        ))}
                    </div>
                </div>
            )}
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
                                결제 기한: {`${details.payment_date.substring(4, 6)}월 ${details.payment_date.substring(6, 8)}일 ${details.payment_time.substring(0, 2)}:${details.payment_time.substring(2, 4)}`}
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

// --- 명절 오픈런 ---
const OPENRUN_SEAT_LABELS = { GENERAL: '일반실', SPECIAL: '특실', ANY: '일반실/특실' };
const OPENRUN_PHASE_BADGES = {
    waiting: { label: '오픈 대기', className: 'bg-amber-100 text-amber-700' },
    openrun: { label: '오픈런 진행 중', className: 'bg-red-100 text-red-700 animate-pulse' },
    retry: { label: '취소표 대기 중', className: 'bg-blue-100 text-blue-700 animate-pulse' },
};
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const getKstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

const formatShortDate = (dateStr) => {
    if (!dateStr) return '';
    const [, month, day] = dateStr.split('-');
    const weekday = WEEKDAYS[new Date(`${dateStr}T00:00:00`).getDay()];
    return `${Number(month)}/${Number(day)}(${weekday})`;
};

const formatOpenAt = (openAt) => openAt ? `${formatShortDate(openAt.slice(0, 10))} ${openAt.slice(11, 16)}` : '';

const makeOpenRunLeg = (overrides = {}) => ({
    date: getKstToday(),
    time: '06:00',
    endTime: '12:00',
    preferredTrains: '',
    openDate: getKstToday(),
    openTime: '07:00',
    ...overrides,
});

function Countdown({ target }) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const intervalId = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(intervalId);
    }, []);

    const diff = new Date(target).getTime() - now;
    if (!target || Number.isNaN(diff)) return null;
    if (diff <= 0) return <span>오픈됨</span>;

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const pad = (n) => String(n).padStart(2, '0');
    const hms = `${pad(Math.floor((totalSeconds % 86400) / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`;
    return <span className="font-mono">{days > 0 ? `${days}일 ` : ''}{hms}</span>;
}

function OpenRunTaskCard({ task, onStop, isLoading }) {
    const badge = OPENRUN_PHASE_BADGES[task.phase] || OPENRUN_PHASE_BADGES.waiting;
    const legs = task.legs || [];

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-red-200 space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-600">
                    🧧 명절 오픈런 · {task.trip_type === 'round' ? '왕복' : '편도'}
                </span>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${badge.className}`}>{badge.label}</span>
            </div>
            <div className="text-sm text-slate-500 font-medium text-right">{OPENRUN_SEAT_LABELS[task.seat_type] || '일반실'} / 성인 {task.adults}명</div>
            {legs.map(leg => (
                <div key={leg.label} className="bg-slate-50 rounded-md p-3 text-sm text-slate-700 space-y-1">
                    <div className="flex justify-between items-baseline gap-2">
                        <span className="font-bold text-slate-800">{leg.label} · {leg.dep} → {leg.arr}</span>
                        {leg.status === 'reserved' && <span className="text-xs font-bold text-green-700 whitespace-nowrap">예매 완료 {leg.reserved_train}</span>}
                        {leg.status === 'expired' && <span className="text-xs font-bold text-slate-400 whitespace-nowrap">시간 초과</span>}
                    </div>
                    <div className="flex justify-between">
                        <span>탑승</span>
                        <span>{formatShortDate(leg.date)} {leg.time}~{leg.end_time}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>예매 오픈</span>
                        <span>{formatOpenAt(leg.open_at)}</span>
                    </div>
                    {leg.preferred_trains?.length > 0 && (
                        <div className="flex justify-between">
                            <span>지정 열차</span>
                            <span>{leg.preferred_trains.join(', ')}</span>
                        </div>
                    )}
                </div>
            ))}
            {task.phase === 'waiting' && (
                <div className="flex justify-between text-sm text-slate-700 px-1">
                    <span>오픈까지 남은 시간</span>
                    <span className="font-bold text-red-600"><Countdown target={task.open_at} /></span>
                </div>
            )}
            {task.message && <p className="text-xs text-slate-500 px-1">{task.message}</p>}
            <button onClick={() => onStop(task.task_id)} disabled={isLoading} className="w-full bg-slate-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-600 transition disabled:bg-slate-400">중단하기</button>
        </div>
    );
}

function OpenRunLegFields({ title, route, leg, onChange }) {
    const inputClass = "date-input px-2.5 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";
    const update = (field) => (e) => onChange({ ...leg, [field]: e.target.value });

    return (
        <div className="border border-slate-200 rounded-lg p-3 space-y-3">
            <div className="flex justify-between items-baseline">
                <h3 className="font-bold text-slate-800">{title}</h3>
                <span className="text-sm text-slate-500">{route}</span>
            </div>

            <div>
                <label className="block text-slate-700 text-sm font-bold mb-1">탑승일</label>
                <input type="date" value={leg.date} onChange={update('date')} required className={inputClass} />
            </div>

            <div>
                <label className="block text-slate-700 text-sm font-bold mb-1">희망 출발 시간대</label>
                <div className="flex items-center gap-1.5">
                    <div className="flex-1 min-w-0"><input type="time" value={leg.time} onChange={update('time')} required className={inputClass} /></div>
                    <span className="text-slate-500">~</span>
                    <div className="flex-1 min-w-0"><input type="time" value={leg.endTime} onChange={update('endTime')} required className={inputClass} /></div>
                </div>
            </div>

            <div>
                <label className="block text-slate-700 text-sm font-bold mb-1">특정 열차만 예매 (선택)</label>
                <input type="text" value={leg.preferredTrains} onChange={update('preferredTrains')} placeholder="예: 101, 103 (입력 순서대로 우선 시도)" className={`${inputClass} w-full`} />
            </div>

            <div>
                <label className="block text-slate-700 text-sm font-bold mb-1">예매 오픈 일시</label>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex-[3] min-w-[9.5rem]"><input type="date" value={leg.openDate} onChange={update('openDate')} required className={inputClass} /></div>
                    <div className="flex-[2] min-w-[7.5rem]"><input type="time" value={leg.openTime} onChange={update('openTime')} required className={inputClass} /></div>
                </div>
            </div>
        </div>
    );
}

function OpenRunScreen() {
    const favorites = (() => {
        try {
            return JSON.parse(localStorage.getItem('trainFavorites') || '[]');
        } catch (e) {
            return [];
        }
    })();

    const [tripType, setTripType] = useState('oneway');
    const [depStation, setDepStation] = useState(favorites[0]?.dep || '서울');
    const [arrStation, setArrStation] = useState(favorites[0]?.arr || '부산');
    const [outbound, setOutbound] = useState(() => makeOpenRunLeg());
    const [inbound, setInbound] = useState(null);
    const [adults, setAdults] = useState('1');
    const [seatType, setSeatType] = useState('GENERAL');
    const [burstMinutes, setBurstMinutes] = useState('30');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    const handleTripTypeChange = (type) => {
        setTripType(type);
        // 오는 편은 처음 왕복을 선택할 때 가는 편 날짜/오픈 일시를 기본값으로 채움
        if (type === 'round' && !inbound) {
            setInbound(makeOpenRunLeg({
                date: outbound.date,
                time: '14:00',
                endTime: '22:00',
                openDate: outbound.openDate,
                openTime: outbound.openTime,
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const legs = tripType === 'round' ? [['가는 편', outbound], ['오는 편', inbound]] : [['가는 편', outbound]];
        if (depStation === arrStation) {
            setError('출발역과 도착역이 같습니다.');
            return;
        }
        for (const [label, leg] of legs) {
            if (leg.endTime < leg.time) {
                setError(`${label} 희망 출발 시간대의 종료 시각이 시작 시각보다 빠릅니다.`);
                return;
            }
        }

        const toParams = (leg, prefix) => ({
            [`${prefix}date`]: leg.date,
            [`${prefix}time`]: leg.time,
            [`${prefix}end_time`]: leg.endTime,
            [`${prefix}preferred_trains`]: leg.preferredTrains,
            [`${prefix}open_date`]: leg.openDate,
            [`${prefix}open_time`]: leg.openTime,
        });

        setIsSubmitting(true);
        try {
            const body = new URLSearchParams({
                trip_type: tripType,
                dep: depStation,
                arr: arrStation,
                adults,
                seat_type: seatType,
                burst_minutes: burstMinutes,
                ...toParams(outbound, ''),
                ...(tripType === 'round' ? toParams(inbound, 'return_') : {}),
            });
            const response = await fetch('/api/start-openrun', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...getAuthHeaders() },
                body,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error_message || '오픈런 등록 중 오류가 발생했습니다.');

            setResult({
                success: true,
                message: `${data.message}\n오픈 약 90초 전에 자동으로 로그인한 뒤, 오픈 순간부터 좌석이 잡힐 때까지 예매를 시도합니다. 진행 상황은 [예매 내역] 탭에서 확인·중단할 수 있으며, 앱을 종료하셔도 푸시/이메일 알림으로 알려드립니다.`
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };


    const selectClass = "w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <div className="space-y-4">
            <div className="text-center mb-1">
                <CalendarIcon className="w-12 h-12 mx-auto text-red-500 mb-1.5" />
                <h1 className="text-3xl font-bold text-slate-800">명절 오픈런</h1>
                <p className="text-sm text-slate-500 mt-1">좌석이 풀리는 시각에 맞춰 자동으로 예매합니다.</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-xs leading-relaxed">
                <p className="font-bold mb-1">⚠️ 명절 일반예매 기간에는 사용할 수 없어요</p>
                명절 승차권 일반예매는 코레일 홈페이지의 <strong>명절 예매 전용 페이지</strong>와 <strong>코레일+ 앱</strong>에서만 진행되며(별도 로그인·접속 대기), 이 기능은 평상시 예매 경로를 사용합니다.
                명절 예매 이후 <strong>잔여석이 일반 예매로 풀리는 시각</strong>이나 평상시 예매 오픈 시각에 맞춰 등록하세요.
            </div>

            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">{error}</div>}


            <div className="bg-white rounded-xl shadow-lg p-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
                        {[['oneway', '편도'], ['round', '왕복']].map(([value, label]) => (
                            <button
                                type="button"
                                key={value}
                                onClick={() => handleTripTypeChange(value)}
                                className={`py-2 rounded-md text-sm font-bold transition ${tripType === value ? 'bg-white text-blue-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="relative bg-slate-50 rounded-lg p-4">
                        <div className="flex items-center gap-2">
                            <StationSelect label="출발" name="openrun_dep" stations={ALL_STATIONS} value={depStation} onChange={e => setDepStation(e.target.value)} />
                            <button type="button" onClick={() => { setDepStation(arrStation); setArrStation(depStation); }} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-2 w-10 h-10 flex items-center justify-center border-4 border-white rounded-full bg-slate-200 hover:bg-slate-300 transition text-slate-600 z-10">
                                <SwapIcon />
                            </button>
                            <StationSelect label="도착" name="openrun_arr" stations={ALL_STATIONS} value={arrStation} onChange={e => setArrStation(e.target.value)} />
                        </div>
                    </div>
                    {favorites.length > 0 && (
                        <div className="flex flex-wrap gap-2 -mt-2">
                            {favorites.map((fav, index) => (
                                <button type="button" key={index} onClick={() => { setDepStation(fav.dep); setArrStation(fav.arr); }} className="bg-white border border-slate-300 rounded-full px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition">
                                    ★ {fav.dep} → {fav.arr}
                                </button>
                            ))}
                        </div>
                    )}

                    <OpenRunLegFields title="가는 편" route={`${depStation} → ${arrStation}`} leg={outbound} onChange={setOutbound} />
                    {tripType === 'round' && inbound && (
                        <OpenRunLegFields title="오는 편" route={`${arrStation} → ${depStation}`} leg={inbound} onChange={setInbound} />
                    )}
                    <p className="text-xs text-slate-500 -mt-2">시간대 안에서 좌석이 남은 가장 이른 열차를 예매합니다. 예매 오픈 일시는 코레일 공지사항에서 확인해 입력하세요.</p>

                    <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                            <label className="block text-slate-700 text-sm font-bold mb-1">성인 승객</label>
                            <select value={adults} onChange={e => setAdults(e.target.value)} className={selectClass}>
                                {[...Array(5).keys()].map(n => <option key={n + 1} value={n + 1}>{n + 1}명</option>)}
                            </select>
                        </div>
                        <div className="flex-1 min-w-0">
                            <label className="block text-slate-700 text-sm font-bold mb-1">좌석</label>
                            <select value={seatType} onChange={e => setSeatType(e.target.value)} className={selectClass}>
                                <option value="GENERAL">일반실</option>
                                <option value="SPECIAL">특실</option>
                                <option value="ANY">상관없음 (일반실 우선)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-slate-700 text-sm font-bold mb-1">오픈 직후 집중 시도 시간</label>
                        <select value={burstMinutes} onChange={e => setBurstMinutes(e.target.value)} className={selectClass}>
                            <option value="10">10분</option>
                            <option value="30">30분</option>
                            <option value="60">60분</option>
                        </select>
                        <p className="text-xs text-slate-500 mt-1">이후에는 5초 간격으로 취소표를 계속 확인합니다.</p>
                    </div>

                    <button type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg transition duration-300 disabled:from-slate-400 disabled:to-slate-300 flex justify-center items-center text-lg">
                        {isSubmitting ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : (tripType === 'round' ? '왕복 오픈런 등록하기' : '오픈런 등록하기')}
                    </button>
                </form>
            </div>

            <div className="bg-slate-100 rounded-xl p-5 text-sm text-slate-600 space-y-2 leading-relaxed">
                <p className="font-bold text-slate-800">🧧 오픈런은 이렇게 동작해요</p>
                <p>1. 예매 오픈 약 90초 전에 코레일에 미리 로그인합니다. (계정 오류는 이때 알려드립니다.)</p>
                <p>2. 오픈 시각부터 희망 시간대 열차를 쉬지 않고 조회하여, 좌석이 남은 첫 열차를 바로 예매합니다. 왕복은 가는 편과 오는 편을 번갈아 시도합니다.</p>
                <p>3. 집중 시도 시간이 지나면 취소표 대기로 전환되며, 희망 시간대 열차가 모두 출발하면 종료됩니다.</p>
                <p className="text-xs text-slate-500">* 서버가 켜져 있는 동안 동작하므로 브라우저나 앱은 종료해도 됩니다. 예매 성공 후에는 결제 기한 내에 꼭 결제해 주세요.</p>
            </div>

            {result && <ResultMessage result={result} onBack={() => setResult(null)} />}
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

            if (permission === 'default' || (permission !== 'granted' && permission !== 'denied')) {
                permission = await window.Notification.requestPermission();
            }

            if (permission === 'granted') {
                try {
                    await subscribeUserToPush();
                } catch (e) { console.error(e); }
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
        notifyEmail: ''
    });
    const [message, setMessage] = useState('');

    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('trainCredentials') || '{}');
        const ktxId = saved.ktxId || saved.srtId || '';
        const ktxPw = saved.ktxPw || saved.srtPw || '';

        const fetchDefaults = async () => {
            try {
                const response = await fetch('/api/config');
                const defaults = await response.json();

                setCredentials({
                    ktxId: ktxId || defaults.ktxId || defaults.srtId || '',
                    ktxPw: ktxPw || defaults.ktxPw || defaults.srtPw || '',
                    notifyEmail: saved.notifyEmail || ''
                });
            } catch (e) {
                console.error("Failed to fetch default config", e);
                setCredentials({
                    ktxId: ktxId || '',
                    ktxPw: ktxPw || '',
                    notifyEmail: saved.notifyEmail || ''
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
        const toSave = {
            ...credentials,
            srtId: credentials.ktxId,
            srtPw: credentials.ktxPw
        };
        localStorage.setItem('trainCredentials', JSON.stringify(toSave));
        setMessage('설정이 저장되었습니다.');
        setTimeout(() => setMessage(''), 3000);
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <SettingsIcon className="w-12 h-12 mx-auto text-blue-600 mb-1.5" />
                <h1 className="text-3xl font-bold text-slate-800">계정 관리</h1>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
                <h2 className="text-lg font-bold text-blue-600 flex items-center gap-2">
                    <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
                    코레일 (고속철도 통합 계정)
                </h2>
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600">멤버십 번호 / 이메일 / 전화번호</label>
                    <input
                        type="text"
                        name="ktxId"
                        value={credentials.ktxId}
                        onChange={handleChange}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="아이디 또는 멤버십 번호 입력"
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
            {/* 추가 알림 설정 구역 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
                <h2 className="text-lg font-bold text-blue-600 flex items-center gap-2">
                    <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
                    추가 알림 설정
                </h2>
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600">예매 성공 시 알림 받을 이메일</label>
                    <input
                        type="email"
                        name="notifyEmail"
                        value={credentials.notifyEmail}
                        onChange={handleChange}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="example@gmail.com"
                    />
                    <p className="text-xs text-slate-500 mt-1">입력하지 않으면 이메일 알림이 전송되지 않습니다.</p>
                </div>
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
                    <p>1. <strong>계정 설정:</strong> 상단 입력란에 본인의 코레일(통합 멤버십) 계정 정보를 입력하고 <strong>[설정 저장하기]</strong>를 누르세요.</p>
                    <p className="text-xs text-slate-500 pl-4 -mt-2">
                        * 입력하신 계정 정보는 서버에 저장되지 않고, 사용하시는 <strong>개별 브라우저 내부(localStorage)</strong>에만 안전하게 보관됩니다.
                    </p>

                    <p>2. <strong>열차 조회 및 예매:</strong> 출발/도착역, 날짜, 인원을 선택하여 열차를 조회하세요. 수서역을 포함한 모든 고속철도를 한 번에 조회할 수 있습니다.</p>

                    <p>3. <strong>자동 예매 시도 (취소표 대기):</strong> 원하는 열차가 매진된 경우 <strong>[자동 예매 시도]</strong>를 누르면, 취소표가 발생할 때까지 5초 간격으로 시스템이 자동 재시도합니다. (예매 성공 시 브라우저 알림 및 이메일 알림이 발송됩니다.)</p>

                    <p>4. <strong>명절 오픈런:</strong> 좌석이 풀리는 시각이 정해진 경우 <strong>[명절 오픈런]</strong> 탭에서 구간(편도/왕복), 희망 출발 시간대, 예매 오픈 일시를 등록하세요. 오픈 직전 자동 로그인 후 오픈 순간부터 좌석이 남은 첫 열차를 자동으로 예매합니다. (명절 일반예매 기간에는 코레일 명절 전용 페이지/코레일+ 앱에서만 예매할 수 있어 사용할 수 없습니다.)</p>

                    <p>5. <strong>결제 및 취소/환불:</strong> 예매가 성공하면 <strong>[예매 내역]</strong> 탭에서 결제 카드를 등록하여 즉시 결제하거나, <strong>코레일톡 앱 또는 레츠코레일 홈페이지</strong>에서 결제할 수 있습니다. 기한 내에 결제하지 않으면 예약이 자동 취소되므로 유의해 주세요.</p>
                </div>
            </div>
        </div>
    );
}