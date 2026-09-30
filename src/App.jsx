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

const TrainFrontIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"></path>
        <path d="m9 15-1-1"></path>
        <path d="m15 15 1-1"></path>
        <path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"></path>
        <path d="m8 19-2 3"></path>
        <path d="m16 19 2 3"></path>
    </svg>
);

const CheckIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M5 13l4 4L19 7"></path>
    </svg>
);

const StarIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8L12 2.5z"></path>
    </svg>
);

// --- UI 공통 스타일 ---
// 모든 화면이 같은 카드/입력/버튼 모양을 쓰도록 한 곳에서 관리합니다.
const ui = {
    card: 'bg-white rounded-2xl border border-slate-200 shadow-sm',
    label: 'block text-sm font-semibold text-slate-700 mb-1.5',
    input: 'w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition',
    hint: 'text-xs text-slate-500 mt-1.5 leading-relaxed',
    chip: 'inline-flex items-center gap-1 h-8 px-3 rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition',
};

const BUTTON_VARIANTS = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    dangerOutline: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
    warning: 'bg-amber-500 text-white hover:bg-amber-600',
    success: 'bg-green-600 text-white hover:bg-green-700',
};
const BUTTON_SIZES = { md: 'h-10 px-4 text-sm', lg: 'h-12 px-5 text-base' };
const buttonClass = (variant = 'primary', size = 'md') =>
    `inline-flex items-center justify-center gap-2 rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]}`;

const TONES = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};
const ALERT_TONES = { error: 'red', success: 'green', warning: 'amber', info: 'blue' };

const Spinner = ({ className = 'h-5 w-5 border-white' }) => (
    <span className={`inline-block animate-spin rounded-full border-2 border-b-transparent ${className}`} aria-label="로딩 중"></span>
);

const Badge = ({ tone = 'slate', pulse = false, children }) => (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold ${TONES[tone]} ${pulse ? 'animate-pulse' : ''}`}>{children}</span>
);

const Alert = ({ tone = 'error', title, children }) => (
    <div role="alert" className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${TONES[ALERT_TONES[tone]]}`}>
        {title && <p className="font-bold mb-1">{title}</p>}
        {children}
    </div>
);

function PageHeader({ icon: Icon, title, subtitle }) {
    return (
        <header className="text-center pb-1">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                <Icon className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </header>
    );
}

const SectionTitle = ({ children, description }) => (
    <div>
        <h2 className="text-base font-bold text-slate-900">{children}</h2>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
    </div>
);

const InfoBox = ({ title, children }) => (
    <div className="rounded-2xl bg-slate-100 p-5 text-sm text-slate-600 space-y-2 leading-relaxed">
        <p className="font-bold text-slate-800">{title}</p>
        {children}
    </div>
);

const InfoRow = ({ label, children }) => (
    <div className="flex justify-between gap-3">
        <span className="text-slate-500">{label}</span>
        <span className="text-right text-slate-800">{children}</span>
    </div>
);

function EmptyState({ icon: Icon, title, description, action }) {
    return (
        <div className="text-center py-14 px-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Icon className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">{title}</h2>
            <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
            {action && <div className="mt-6">{action}</div>}
        </div>
    );
}

const ModalShell = ({ children }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">{children}</div>
    </div>
);

const StatusIcon = ({ type }) => {
    if (type === 'success') {
        return <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600"><CheckIcon className="h-6 w-6" /></div>;
    }
    if (type === 'danger') {
        return <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600"><AlertTriangleIcon className="h-6 w-6" /></div>;
    }
    return null;
};

const Modal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = '확인', cancelText = '취소', type = 'info' }) => {
    if (!isOpen) return null;
    const confirmVariant = type === 'danger' ? 'danger' : type === 'success' ? 'success' : 'primary';
    return (
        <ModalShell>
            <div className="p-6 text-center">
                <StatusIcon type={type} />
                <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                <div className="text-sm text-slate-500 whitespace-pre-wrap leading-relaxed">{message}</div>
            </div>
            <div className="px-6 pb-6 flex gap-2">
                {onCancel && <button onClick={onCancel} className={`${buttonClass('secondary')} flex-1`}>{cancelText}</button>}
                <button onClick={onConfirm} className={`${buttonClass(confirmVariant)} flex-1`}>{confirmText}</button>
            </div>
        </ModalShell>
    );
};

// 출발/도착역 선택 (열차 조회와 명절 오픈런에서 공통 사용)
function RoutePicker({ depName, arrName, dep, arr, onDepChange, onArrChange, onSwap, action }) {
    return (
        <div className="relative rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
            <div className="flex items-center">
                <StationSelect label="출발" name={depName} stations={ALL_STATIONS} value={dep} onChange={onDepChange} />
                <button type="button" onClick={onSwap} aria-label="출발역과 도착역 바꾸기" className="shrink-0 mx-1 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-blue-300 hover:text-blue-600">
                    <SwapIcon />
                </button>
                <StationSelect label="도착" name={arrName} stations={ALL_STATIONS} value={arr} onChange={onArrChange} />
            </div>
            {action}
        </div>
    );
}

function FavoriteChips({ favorites, onSelect, onRemove }) {
    if (!favorites || favorites.length === 0) return null;
    return (
        <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">즐겨찾는 구간</p>
            <div className="flex flex-wrap gap-2">
                {favorites.map((fav, index) => (
                    <span key={index} className={ui.chip}>
                        <button type="button" onClick={() => onSelect(fav)} className="inline-flex items-center gap-1">
                            <StarIcon className="h-3.5 w-3.5 text-amber-400" />
                            {fav.dep} → {fav.arr}
                        </button>
                        {onRemove && (
                            <button type="button" onClick={() => onRemove(fav)} aria-label={`${fav.dep} → ${fav.arr} 즐겨찾기 삭제`} className="-mr-1 ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600">×</button>
                        )}
                    </span>
                ))}
            </div>
        </div>
    );
}

function DateTimeFields({ date, time, onDateChange, onTimeChange, dateName, timeName }) {
    return (
        <div className="flex flex-wrap gap-2">
            <div className="flex-[3] min-w-[9.5rem]"><input type="date" name={dateName} value={date} onChange={onDateChange} required className={`${ui.input} date-input`} /></div>
            <div className="flex-[2] min-w-[8.5rem]"><input type="time" name={timeName} value={time} onChange={onTimeChange} required className={`${ui.input} date-input`} /></div>
        </div>
    );
}

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
        <div className="bg-slate-200 font-sans flex justify-center items-start min-h-screen">
            <div className="w-full max-w-md bg-slate-50 min-h-screen shadow-lg flex flex-col">
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
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 shadow-[0_-1px_12px_rgba(15,23,42,0.06)] z-50 bottom-nav-safe">
            <div className="flex justify-around items-center h-16">
                {navItems.map(item => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`flex flex-col items-center justify-center w-full h-full transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <item.icon className="w-6 h-6 mb-1" />
                            <span className={`text-xs ${isActive ? 'font-bold' : 'font-semibold'}`}>{item.label}</span>
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
            {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

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
        <div className="space-y-4">
            <PageHeader icon={TicketIcon} title="예매 내역" subtitle="예매한 승차권과 진행 중인 자동 예매를 확인합니다." />
            {error && <Alert tone="error">{error}</Alert>}
            {message && <Alert tone="success">{message}</Alert>}
            {isLoading ? <div className="flex justify-center py-12"><Spinner className="h-10 w-10 border-blue-600" /></div> :
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
        <div className="space-y-4">
            <PageHeader icon={TrainFrontIcon} title="열차 조회" subtitle="어디로 떠나시나요?" />

            <form onSubmit={onSubmit} className={`${ui.card} p-5 space-y-4`}>
                <input type="hidden" name="type" value="KTX" />

                <RoutePicker
                    depName="dep"
                    arrName="arr"
                    dep={depStation}
                    arr={arrStation}
                    onDepChange={e => setDepStation(e.target.value)}
                    onArrChange={e => setArrStation(e.target.value)}
                    onSwap={handleSwapStations}
                    action={
                        <button type="button" onClick={handleAddFavorite} title="즐겨찾기에 추가" aria-label="즐겨찾기에 추가" className="absolute -top-2.5 -right-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-amber-400 shadow-sm transition hover:bg-amber-50">
                            <StarIcon className="h-4 w-4" />
                        </button>
                    }
                />

                <div>
                    <label className={ui.label}>출발일시</label>
                    <DateTimeFields
                        dateName="date"
                        timeName="time"
                        date={selectedDate}
                        time={selectedTime}
                        onDateChange={handleDateChange}
                        onTimeChange={(e) => setSelectedTime(e.target.value)}
                    />
                </div>

                <div>
                    <label htmlFor="adults" className={ui.label}>성인 승객</label>
                    <select name="adults" id="adults" defaultValue="1" className={ui.input}>{[...Array(5).keys()].map(n => <option key={n + 1} value={n + 1}>{n + 1}명</option>)}</select>
                </div>

                <button type="submit" disabled={isLoading} className={`${buttonClass('primary', 'lg')} w-full`}>
                    {isLoading ? <Spinner /> : '열차 조회하기'}
                </button>
            </form>

            <FavoriteChips favorites={favorites} onSelect={applyFavorite} onRemove={onRemoveFavorite} />
        </div>
    );
}

function StationSelect({ label, name, stations, value, onChange }) {
    return (
        <div className="flex-1 min-w-0 flex flex-col items-center">
            <label htmlFor={name} className="text-xs text-slate-500 font-semibold">{label}</label>
            <select
                name={name}
                id={name}
                required
                value={value}
                onChange={onChange}
                className="w-full font-bold text-slate-900 text-lg bg-transparent focus:outline-none appearance-none text-center p-1"
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
                <button onClick={onBack} aria-label="뒤로" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-200/60"><BackIcon /></button>
                <div className="text-center flex-grow">
                    <h1 className="text-xl font-bold text-slate-900">조회 결과</h1>
                    <p className="text-sm text-slate-500">{data.dep} → {data.arr}</p>
                </div>
                <div className="w-10"></div>
            </div>
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
        <div className={`${ui.card} p-4`}>
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-blue-700">{trainName} {trainNo}</span>
                    {isSuseoLine && <Badge tone="indigo">수서고속선</Badge>}
                </div>
                <span className="text-sm text-slate-500">{duration} 소요</span>
            </div>
            <TimeLine depTime={train.dep_time} arrTime={train.arr_time} depName={depName} arrName={arrName} />
            <div className="grid grid-cols-2 gap-2 mt-4">
                <SeatOption label="일반실" value="GENERAL" state={train.general_seat_state || (isGeneralAvailable ? '예약가능' : '매진')} available={isGeneralAvailable} selectedSeat={selectedSeat} setSelectedSeat={setSelectedSeat} name={`seat_${trainNo}`} />
                <SeatOption label="특실" value="SPECIAL" state={train.special_seat_state || (isSpecialAvailable ? '예약가능' : '매진')} available={isSpecialAvailable} selectedSeat={selectedSeat} setSelectedSeat={setSelectedSeat} name={`seat_${trainNo}`} />
            </div>
            <button
                onClick={() => onReserve(train, selectedSeat, !isSelectedSeatAvailable)}
                disabled={isLoading}
                className={`${buttonClass(isSelectedSeatAvailable ? 'primary' : 'warning')} w-full mt-3`}
            >
                {isLoading && <Spinner />}
                {isSelectedSeatAvailable ? '예매하기' : '자동 예매 시도'}
            </button>
        </div>
    );
}

function TimeLine({ depTime, arrTime, depName, arrName }) {
    return (
        <div className="flex justify-between items-center">
            <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">{depTime.substring(0, 2)}:{depTime.substring(2, 4)}</div>
                <div className="text-sm text-slate-600">{depName}</div>
            </div>
            <div className="flex-grow flex items-center justify-center text-slate-300 px-3">
                <div className="flex-grow border-t-2 border-dotted border-slate-300"></div>
                <TrainFrontIcon className="w-5 h-5 mx-2 flex-shrink-0 text-slate-400" />
                <div className="flex-grow border-t-2 border-dotted border-slate-300"></div>
            </div>
            <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">{arrTime.substring(0, 2)}:{arrTime.substring(2, 4)}</div>
                <div className="text-sm text-slate-600">{arrName}</div>
            </div>
        </div>
    );
}

function SeatOption({ label, value, state, available, selectedSeat, setSelectedSeat, name }) {
    const selected = selectedSeat === value;
    return (
        <label className={`p-2 border rounded-xl text-center cursor-pointer transition ${selected ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-100' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
            <input type="radio" name={name} value={value} checked={selected} onChange={() => setSelectedSeat(value)} className="sr-only" />
            <div className="text-sm font-semibold text-slate-600">{label}</div>
            <div className={`text-sm font-bold ${available ? 'text-green-600' : 'text-slate-400'}`}>{state}</div>
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
    let statusText, statusTone, paymentInfo = null;
    if (isWaiting) {
        statusText = "예약 대기";
        statusTone = "slate";
    } else if (isTicket) {
        statusText = "결제 완료";
        statusTone = "green";
    } else {
        statusText = "결제 대기";
        statusTone = "amber";
        if (paymentDate && paymentDate !== "00000000") {
            paymentInfo = `결제기한: ${paymentDate.substring(4, 6)}월 ${paymentDate.substring(6, 8)}일 ${paymentTime.substring(0, 2)}:${paymentTime.substring(2, 4)}`;
        }
    }

    const formattedDate = `${depDate.substring(0, 4)}년 ${depDate.substring(4, 6)}월 ${depDate.substring(6, 8)}일`;

    return (
        <div className={`${ui.card} p-4 space-y-3`}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-600">{formattedDate}</span>
                <Badge tone={statusTone}>{statusText}</Badge>
            </div>

            <div className="space-y-2">
                <span className="font-bold text-lg text-blue-700">{trainName} {trainNo}</span>
                <TimeLine depTime={depTime} arrTime={arrTime} depName={depName} arrName={arrName} />
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-3">
                <div className="flex justify-between text-sm text-slate-700">
                    <span>{seatCount}석</span>
                    <span className="font-bold">{new Intl.NumberFormat('ko-KR').format(price)}원</span>
                </div>
                {paymentInfo && <p className="text-sm text-center text-red-600 font-semibold py-2 bg-red-50 rounded-lg">{paymentInfo}</p>}
                <div className="flex gap-2">
                    {!isTicket && !isWaiting && (
                        <button onClick={() => onPay({ reservation, type })} disabled={isLoading} className={`${buttonClass('primary')} flex-1`}>
                            결제하기
                        </button>
                    )}
                    <button onClick={() => onCancel(pnrNo, type, isTicket)} disabled={isLoading} className={`${buttonClass('dangerOutline')} flex-1`}>
                        {isTicket ? '환불하기' : '예매 취소'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function EmptyReservations() {
    return (
        <EmptyState
            icon={TicketIcon}
            title="예매 내역이 비어있습니다"
            description={<>아직 예매하신 기차표가 없네요.<br />첫 여행을 계획해 보세요!</>}
        />
    );
}

function StandbyTaskCard({ task, onStop, isLoading }) {
    return (
        <div className={`${ui.card} p-4 space-y-3`}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-600">
                    {task.date.split('-')[0]}년 {task.date.split('-')[1]}월 {task.date.split('-')[2]}일 {task.time}
                </span>
                <Badge tone="blue" pulse>자동 예매 중</Badge>
            </div>
            <div className="flex justify-between items-baseline">
                <span className="font-bold text-lg text-blue-700">{task.train_type || 'KTX'} {task.train_number}</span>
                {task.adults && <span className="text-sm text-slate-500">{task.seat_type === 'GENERAL' ? '일반실' : '특실'} / 성인 {task.adults}명</span>}
            </div>
            <div className="font-bold text-slate-800">{task.dep} → {task.arr}</div>
            <button onClick={() => onStop(task.task_id)} disabled={isLoading} className={`${buttonClass('secondary')} w-full`}>중단하기</button>
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
        <div className="space-y-8">
            {bgTasks && bgTasks.length > 0 && (
                <section className="space-y-3">
                    <SectionTitle>진행 중인 자동 예매</SectionTitle>
                    {bgTasks.map(task => task.mode === 'openrun' ? (
                        <OpenRunTaskCard key={task.task_id} task={task} onStop={onStopBgTask} isLoading={isLoading} />
                    ) : (
                        <StandbyTaskCard key={task.task_id} task={task} onStop={onStopBgTask} isLoading={isLoading} />
                    ))}
                </section>
            )}
            {(error || (list && list.length > 0)) && (
                <section className="space-y-3">
                    <SectionTitle>예매 내역</SectionTitle>
                    {error && <Alert tone="error">{error}</Alert>}
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
                </section>
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
        <ModalShell>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <h2 className="text-lg font-bold text-center text-slate-900">결제 정보 입력</h2>
                <div>
                    <label className={ui.label}>카드 번호</label>
                    <input name="card_number" type="text" inputMode="numeric" placeholder="1234-5678-1234-5678" required className={ui.input} />
                </div>
                <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                        <label className={ui.label}>유효기간 (YYMM)</label>
                        <input name="card_expire_date" type="text" inputMode="numeric" placeholder="2809" required className={ui.input} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <label className={ui.label}>비밀번호 앞 2자리</label>
                        <input name="card_password" type="password" inputMode="numeric" placeholder="••" required className={ui.input} />
                    </div>
                </div>
                <div>
                    <label className={ui.label}>생년월일 (YYMMDD)</label>
                    <input name="card_birthday" type="text" inputMode="numeric" placeholder="901231" required className={ui.input} />
                </div>
                <div className="flex justify-between items-center rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                    <span className="text-sm text-slate-500">결제 금액</span>
                    <span className="text-lg font-bold text-slate-900">{new Intl.NumberFormat('ko-KR').format(price)}원</span>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={onClose} className={`${buttonClass('secondary', 'lg')} flex-1`}>취소</button>
                    <button type="submit" disabled={isLoading} className={`${buttonClass('primary', 'lg')} flex-1`}>
                        {isLoading ? <Spinner /> : '결제하기'}
                    </button>
                </div>
            </form>
        </ModalShell>
    );
}

function ResultMessage({ result, onBack }) {
    const isSuccess = result?.success;
    const message = result?.message || (isSuccess ? '성공적으로 처리되었습니다.' : '오류가 발생했습니다.');
    const details = result?.data;

    return (
        <ModalShell>
            <div className="p-6 text-center">
                <StatusIcon type={isSuccess ? 'success' : 'danger'} />
                <h3 className="text-lg font-bold text-slate-900 mb-2">{isSuccess ? '처리 완료' : '처리 실패'}</h3>
                <p className="text-sm text-slate-500 whitespace-pre-wrap leading-relaxed">{message}</p>
                {details && (
                    <div className="mt-4 text-left bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
                        <p className="font-semibold text-slate-800">{details.dump}</p>
                        {details.payment_date && details.payment_date !== "00000000" && (
                            <p className="mt-2 text-red-600 font-bold">
                                결제 기한: {`${details.payment_date.substring(4, 6)}월 ${details.payment_date.substring(6, 8)}일 ${details.payment_time.substring(0, 2)}:${details.payment_time.substring(2, 4)}`}
                            </p>
                        )}
                    </div>
                )}
            </div>
            <div className="px-6 pb-6">
                <button onClick={onBack} className={`${buttonClass(isSuccess ? 'primary' : 'secondary')} w-full`}>확인</button>
            </div>
        </ModalShell>
    );
}

function EmptyResults({ searchParams, onBack }) {
    const dep = searchParams?.dep;
    const arr = searchParams?.arr;
    const time = searchParams?.time;

    return (
        <EmptyState
            icon={AlertTriangleIcon}
            title="조회된 열차가 없습니다"
            description={<><strong>{dep} → {arr}</strong> 방면, <strong>{time}</strong> 이후의 열차가 매진되었거나 운행하지 않습니다.</>}
            action={
                <button onClick={onBack} className={`${buttonClass('primary', 'lg')} w-full`}>
                    <BackIcon />
                    다시 검색하기
                </button>
            }
        />
    );
}

// --- 명절 오픈런 ---
const OPENRUN_SEAT_LABELS = { GENERAL: '일반실', SPECIAL: '특실', ANY: '일반실/특실' };
const OPENRUN_PHASE_BADGES = {
    waiting: { label: '오픈 대기', tone: 'amber' },
    openrun: { label: '오픈런 진행 중', tone: 'red', pulse: true },
    retry: { label: '취소표 대기 중', tone: 'blue', pulse: true },
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
    // 예매 오픈 일시는 공통이므로 한 번만 표시 (구간별로 다르게 저장된 이전 작업만 구간마다 표시)
    const sameOpenAt = legs.every(leg => leg.open_at === legs[0]?.open_at);

    return (
        <div className={`${ui.card} p-4 space-y-3`}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                    <CalendarIcon className="h-4 w-4 text-blue-600" />
                    명절 오픈런 · {task.trip_type === 'round' ? '왕복' : '편도'}
                </span>
                <Badge tone={badge.tone} pulse={badge.pulse}>{badge.label}</Badge>
            </div>
            <div className="text-sm text-slate-500 text-right">{OPENRUN_SEAT_LABELS[task.seat_type] || '일반실'} / 성인 {task.adults}명</div>
            {legs.map((leg, index) => (
                <div key={index} className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
                    <div className="flex justify-between items-baseline gap-2">
                        <span className="font-bold text-slate-900">{leg.label ? `${leg.label} · ` : ''}{leg.dep} → {leg.arr}</span>
                        {leg.status === 'reserved' && <Badge tone="green">예매 완료 {leg.reserved_train}</Badge>}
                        {leg.status === 'expired' && <Badge tone="slate">시간 초과</Badge>}
                    </div>
                    <InfoRow label="탑승">{formatShortDate(leg.date)} {leg.time}~{leg.end_time}</InfoRow>
                    {!sameOpenAt && <InfoRow label="예매 오픈">{formatOpenAt(leg.open_at)}</InfoRow>}
                    {leg.preferred_trains?.length > 0 && <InfoRow label="지정 열차">{leg.preferred_trains.join(', ')}</InfoRow>}
                </div>
            ))}
            <div className="text-sm space-y-1 px-1">
                {sameOpenAt && legs.length > 0 && <InfoRow label="예매 오픈"><span className="font-semibold">{formatOpenAt(legs[0].open_at)}</span></InfoRow>}
                {task.phase === 'waiting' && (
                    <InfoRow label="오픈까지 남은 시간"><span className="font-bold text-blue-700"><Countdown target={task.open_at} /></span></InfoRow>
                )}
            </div>
            {task.message && <p className="text-xs text-slate-500 px-1">{task.message}</p>}
            <button onClick={() => onStop(task.task_id)} disabled={isLoading} className={`${buttonClass('secondary')} w-full`}>중단하기</button>
        </div>
    );
}

function OpenRunLegFields({ title, route, leg, onChange }) {
    const update = (field) => (e) => onChange({ ...leg, [field]: e.target.value });

    return (
        <div className={title ? "rounded-xl border border-slate-200 p-3 space-y-4" : "space-y-4"}>
            {title && (
                <div className="flex justify-between items-baseline">
                    <h3 className="font-bold text-slate-900">{title}</h3>
                    <span className="text-sm text-slate-500">{route}</span>
                </div>
            )}

            <div>
                <label className={ui.label}>탑승일</label>
                <input type="date" value={leg.date} onChange={update('date')} required className={`${ui.input} date-input`} />
            </div>

            <div>
                <label className={ui.label}>희망 출발 시간대</label>
                <div className="flex items-center gap-1.5">
                    <div className="flex-1 min-w-0"><input type="time" value={leg.time} onChange={update('time')} required className={`${ui.input} date-input`} /></div>
                    <span className="text-slate-400">~</span>
                    <div className="flex-1 min-w-0"><input type="time" value={leg.endTime} onChange={update('endTime')} required className={`${ui.input} date-input`} /></div>
                </div>
            </div>

            <div>
                <label className={ui.label}>특정 열차만 예매 (선택)</label>
                <input type="text" value={leg.preferredTrains} onChange={update('preferredTrains')} placeholder="예: 101, 103 (입력 순서대로 우선 시도)" className={ui.input} />
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
    const [openDate, setOpenDate] = useState(getKstToday());
    const [openTime, setOpenTime] = useState('07:00');
    const [adults, setAdults] = useState('1');
    const [seatType, setSeatType] = useState('GENERAL');
    const [burstMinutes, setBurstMinutes] = useState('30');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    const handleTripTypeChange = (type) => {
        setTripType(type);
        // 오는 편은 처음 왕복을 선택할 때 가는 편 탑승일을 기본값으로 채움
        if (type === 'round' && !inbound) {
            setInbound(makeOpenRunLeg({ date: outbound.date, time: '14:00', endTime: '22:00' }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const legs = tripType === 'round' ? [['가는 편 ', outbound], ['오는 편 ', inbound]] : [['', outbound]];
        if (depStation === arrStation) {
            setError('출발역과 도착역이 같습니다.');
            return;
        }
        for (const [label, leg] of legs) {
            if (leg.endTime < leg.time) {
                setError(`${label}희망 출발 시간대의 종료 시각이 시작 시각보다 빠릅니다.`);
                return;
            }
        }

        const toParams = (leg, prefix) => ({
            [`${prefix}date`]: leg.date,
            [`${prefix}time`]: leg.time,
            [`${prefix}end_time`]: leg.endTime,
            [`${prefix}preferred_trains`]: leg.preferredTrains,
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
                open_date: openDate,
                open_time: openTime,
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
                message: `${data.message}\n오픈 약 90초 전에 관리 탭에 저장된 계정으로 서버가 자동 로그인한 뒤, 오픈 순간부터 좌석이 잡힐 때까지 예매를 시도합니다. 진행 상황은 [예매 내역] 탭에서 확인·중단할 수 있으며, 앱을 종료하셔도 푸시/이메일 알림으로 알려드립니다.`
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };


    // 관리 탭에 저장된 계정 (탭 전환 때마다 다시 그려지므로 저장 직후 값도 반영됨)
    const savedAccountId = (() => {
        try {
            const saved = JSON.parse(localStorage.getItem('trainCredentials') || '{}');
            return saved.ktxId || saved.srtId || '';
        } catch (e) {
            return '';
        }
    })();

    return (
        <div className="space-y-4">
            <PageHeader icon={CalendarIcon} title="명절 오픈런" subtitle="좌석이 풀리는 시각에 맞춰 자동으로 예매합니다." />

            <Alert tone="warning" title="명절 일반예매 기간에는 사용할 수 없어요">
                명절 승차권 일반예매는 코레일 홈페이지의 <strong>명절 예매 전용 페이지</strong>와 <strong>코레일+ 앱</strong>에서만 진행되며(별도 로그인·접속 대기), 이 기능은 평상시 예매 경로를 사용합니다.
                명절 예매 이후 <strong>잔여석이 일반 예매로 풀리는 시각</strong>이나 평상시 예매 오픈 시각에 맞춰 등록하세요.
            </Alert>

            {error && <Alert tone="error">{error}</Alert>}

            <form onSubmit={handleSubmit} className={`${ui.card} p-5 space-y-4`}>
                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                    {[['oneway', '편도'], ['round', '왕복']].map(([value, label]) => (
                        <button
                            type="button"
                            key={value}
                            onClick={() => handleTripTypeChange(value)}
                            className={`h-9 rounded-lg text-sm font-bold transition ${tripType === value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <RoutePicker
                    depName="openrun_dep"
                    arrName="openrun_arr"
                    dep={depStation}
                    arr={arrStation}
                    onDepChange={e => setDepStation(e.target.value)}
                    onArrChange={e => setArrStation(e.target.value)}
                    onSwap={() => { setDepStation(arrStation); setArrStation(depStation); }}
                />
                <FavoriteChips favorites={favorites} onSelect={(fav) => { setDepStation(fav.dep); setArrStation(fav.arr); }} />

                <OpenRunLegFields title={tripType === 'round' ? '가는 편' : ''} route={`${depStation} → ${arrStation}`} leg={outbound} onChange={setOutbound} />
                {tripType === 'round' && inbound && (
                    <OpenRunLegFields title="오는 편" route={`${arrStation} → ${depStation}`} leg={inbound} onChange={setInbound} />
                )}
                <p className="text-xs text-slate-500 -mt-2">시간대 안에서 좌석이 남은 가장 이른 열차를 예매합니다.</p>

                <div>
                    <label className={ui.label}>예매 오픈 일시</label>
                    <DateTimeFields date={openDate} time={openTime} onDateChange={e => setOpenDate(e.target.value)} onTimeChange={e => setOpenTime(e.target.value)} />
                    <p className={ui.hint}>{tripType === 'round' ? '가는 편과 오는 편 모두 이 시각부터 예매를 시도합니다. ' : ''}코레일 공지사항에서 확인해 입력하세요.</p>
                </div>

                <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                        <label className={ui.label}>성인 승객</label>
                        <select value={adults} onChange={e => setAdults(e.target.value)} className={ui.input}>
                            {[...Array(5).keys()].map(n => <option key={n + 1} value={n + 1}>{n + 1}명</option>)}
                        </select>
                    </div>
                    <div className="flex-1 min-w-0">
                        <label className={ui.label}>좌석</label>
                        <select value={seatType} onChange={e => setSeatType(e.target.value)} className={ui.input}>
                            <option value="GENERAL">일반실</option>
                            <option value="SPECIAL">특실</option>
                            <option value="ANY">상관없음 (일반실 우선)</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className={ui.label}>오픈 직후 집중 시도 시간</label>
                    <select value={burstMinutes} onChange={e => setBurstMinutes(e.target.value)} className={ui.input}>
                        <option value="10">10분</option>
                        <option value="30">30분</option>
                        <option value="60">60분</option>
                    </select>
                    <p className={ui.hint}>이후에는 5초 간격으로 취소표를 계속 확인합니다.</p>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm">
                    <InfoRow label="예매 계정">
                        {savedAccountId ? <span className="font-semibold">{savedAccountId}</span> : <span className="font-semibold text-amber-600">관리 탭에서 계정을 저장해 주세요</span>}
                    </InfoRow>
                    <p className={ui.hint}>관리 탭에 저장된 이 계정으로 서버가 오픈 직전에 자동 로그인합니다. 따로 로그인하실 필요는 없습니다.</p>
                </div>

                <button type="submit" disabled={isSubmitting} className={`${buttonClass('primary', 'lg')} w-full`}>
                    {isSubmitting ? <Spinner /> : (tripType === 'round' ? '왕복 오픈런 등록하기' : '오픈런 등록하기')}
                </button>
            </form>

            <InfoBox title="오픈런은 이렇게 동작해요">
                <p>1. 예매 오픈 약 90초 전에 서버가 <strong>관리 탭에 저장된 계정</strong>으로 코레일에 자동 로그인합니다. 비밀번호가 틀리는 등 계정에 문제가 있으면 이때 실패로 알려드립니다.</p>
                <p>2. 오픈 시각부터 희망 시간대 열차를 쉬지 않고 조회하여, 좌석이 남은 첫 열차를 바로 예매합니다. 왕복은 가는 편과 오는 편을 번갈아 시도합니다.</p>
                <p>3. 집중 시도 시간이 지나면 취소표 대기로 전환되며, 희망 시간대 열차가 모두 출발하면 종료됩니다.</p>
                <p className="text-xs text-slate-500">* 계정은 등록하는 순간의 정보로 저장되므로, 등록 후 관리 탭에서 계정이나 비밀번호를 바꿨다면 오픈런을 중단하고 다시 등록해 주세요. 서버가 켜져 있는 동안 동작하므로 브라우저나 앱은 종료해도 됩니다.</p>
            </InfoBox>

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

    const pushBadge = {
        granted: <Badge tone="green">허용됨</Badge>,
        denied: <Badge tone="red">차단됨</Badge>,
        unsupported: <Badge tone="amber">앱 설치 필요</Badge>,
    }[notificationStatus];

    return (
        <div className="space-y-4">
            <PageHeader icon={SettingsIcon} title="계정 관리" subtitle="예매에 사용할 계정과 알림을 설정합니다." />

            <section className={`${ui.card} p-5 space-y-4`}>
                <SectionTitle description="고속철도(KTX·SRT) 통합 계정">코레일 계정</SectionTitle>
                <div>
                    <label className={ui.label}>멤버십 번호 / 이메일 / 전화번호</label>
                    <input
                        type="text"
                        name="ktxId"
                        value={credentials.ktxId}
                        onChange={handleChange}
                        className={ui.input}
                        placeholder="아이디 또는 멤버십 번호 입력"
                    />
                </div>
                <div>
                    <label className={ui.label}>비밀번호</label>
                    <input
                        type="password"
                        name="ktxPw"
                        value={credentials.ktxPw}
                        onChange={handleChange}
                        className={ui.input}
                        placeholder="비밀번호 입력"
                    />
                    <p className={ui.hint}>열차 조회·예매와 자동 예매, 명절 오픈런 모두 이 계정을 사용합니다.</p>
                </div>
            </section>

            <section className={`${ui.card} p-5 space-y-4`}>
                <SectionTitle description="예매에 성공하면 알려드립니다.">알림</SectionTitle>
                <div className="flex justify-between items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">푸시 알림</p>
                        <p className="text-xs text-slate-500 mt-0.5">이 기기로 예매 성공 알림을 받습니다.</p>
                    </div>
                    {pushBadge || (
                        <button onClick={handleRequestNotification} className={`${buttonClass('primary')} shrink-0`}>알림 켜기</button>
                    )}
                </div>
                {notificationStatus === 'denied' && (
                    <p className="text-xs text-red-600 -mt-2">알림이 차단되어 있습니다. 주소창의 자물쇠 아이콘을 눌러 알림 권한을 '허용'으로 변경해주세요.</p>
                )}
                {notificationStatus === 'unsupported' && (
                    <p className="text-xs text-amber-700 -mt-2 leading-relaxed">
                        아이폰(iOS) 사파리 브라우저에서는 하단의 '공유' 버튼(네모 안의 위쪽 화살표)을 눌러 <strong>[홈 화면에 추가]</strong> 기능을 통해 바탕화면에 앱을 설치하신 후, 생성된 앱으로 접속하셔야만 푸시 알림 기능을 사용할 수 있습니다.
                    </p>
                )}
                <div>
                    <label className={ui.label}>이메일 알림 주소</label>
                    <input
                        type="email"
                        name="notifyEmail"
                        value={credentials.notifyEmail}
                        onChange={handleChange}
                        className={ui.input}
                        placeholder="example@gmail.com"
                    />
                    <p className={ui.hint}>입력하지 않으면 이메일 알림이 전송되지 않습니다.</p>
                </div>
            </section>

            <button onClick={handleSave} className={`${buttonClass('primary', 'lg')} w-full`}>
                설정 저장하기
            </button>

            {message && <Alert tone="success">{message}</Alert>}

            <InfoBox title="열차 예매 서비스 이용 가이드">
                <p>1. <strong>계정 설정:</strong> 상단 입력란에 본인의 코레일(통합 멤버십) 계정 정보를 입력하고 <strong>[설정 저장하기]</strong>를 누르세요.</p>
                <p className="text-xs text-slate-500 pl-4 -mt-1">
                    * 계정 정보는 사용하시는 <strong>브라우저 내부(localStorage)</strong>에 저장됩니다. 단, 자동 예매나 명절 오픈런을 등록하면 앱을 닫아도 서버가 대신 로그인할 수 있도록 <strong>해당 작업이 끝날 때까지 서버에도 보관</strong>됩니다.
                </p>

                <p>2. <strong>열차 조회 및 예매:</strong> 출발/도착역, 날짜, 인원을 선택하여 열차를 조회하세요. 수서역을 포함한 모든 고속철도를 한 번에 조회할 수 있습니다.</p>

                <p>3. <strong>자동 예매 시도 (취소표 대기):</strong> 원하는 열차가 매진된 경우 <strong>[자동 예매 시도]</strong>를 누르면, 취소표가 발생할 때까지 5초 간격으로 시스템이 자동 재시도합니다. (예매 성공 시 브라우저 알림 및 이메일 알림이 발송됩니다.)</p>

                <p>4. <strong>명절 오픈런:</strong> 좌석이 풀리는 시각이 정해진 경우 <strong>[명절 오픈런]</strong> 탭에서 구간(편도/왕복), 희망 출발 시간대, 예매 오픈 일시를 등록하세요. 오픈 직전 서버가 이 계정으로 자동 로그인한 뒤 오픈 순간부터 좌석이 남은 첫 열차를 자동으로 예매합니다. (명절 일반예매 기간에는 코레일 명절 전용 페이지/코레일+ 앱에서만 예매할 수 있어 사용할 수 없습니다.)</p>

                <p>5. <strong>결제 및 취소/환불:</strong> 예매가 성공하면 <strong>[예매 내역]</strong> 탭에서 결제 카드를 등록하여 즉시 결제하거나, <strong>코레일톡 앱 또는 레츠코레일 홈페이지</strong>에서 결제할 수 있습니다. 기한 내에 결제하지 않으면 예약이 자동 취소되므로 유의해 주세요.</p>
            </InfoBox>
        </div>
    );
}
