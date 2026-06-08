import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove useEffect timer for autoRetryData
content = re.sub(
    r'    useEffect\(\(\) => \{\n        let timer;\n        if \(autoRetryData\) \{\n            timer = setTimeout\(\(\) => \{\n                handleReserve\(autoRetryData\.train, autoRetryData\.seatType, true\);\n            \}, 5000\);\n        \}\n        return \(\) => clearTimeout\(timer\);\n    \}, \[autoRetryData\]\);\n',
    '',
    content
)

# 2. Update handleReserve endpoint logic
old_handle_reserve = """        const endpoint = isRetry ? '/api/auto-retry' : '/api/reserve';

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
            
            if (result.retry) {
                 const attempt = (autoRetryData?.attempt || 0) + 1;
                 setAutoRetryData({ train, seatType, attempt });
                 setView('autoRetry');
            } else if (result.reservation) {
                setAutoRetryData(null);
                playSuccessSound();
                setReservationResult({ success: true, data: result.reservation });
                setView('results'); // Prevent crash
                setIsLoading(false);
            } else {
                 setAutoRetryData(null);
                 setReservationResult({ success: false, message: result.error_message || '알 수 없는 오류가 발생했습니다.' });
                 setIsLoading(false);
            }
        } catch (err) {
            setAutoRetryData(null);
            setReservationResult({ success: false, message: err.message });
            setIsLoading(false);
        }"""

new_handle_reserve = """        const endpoint = isRetry ? '/api/start-auto-reserve' : '/api/reserve';

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
        }"""

content = content.replace(old_handle_reserve, new_handle_reserve)

# 3. Remove AutoRetryView from renderMainView
content = re.sub(r"            case 'autoRetry': return <AutoRetryView.*?\n", "", content)

# 4. Add bgTasks to ReservationsScreen
content = content.replace(
    "const [reservations, setReservations] = useState({ srt_reservations: [], ktx_reservations: [], srt_error: null, ktx_error: null });",
    "const [reservations, setReservations] = useState({ srt_reservations: [], ktx_reservations: [], srt_error: null, ktx_error: null });\n    const [bgTasks, setBgTasks] = useState([]);"
)

# 5. Fetch bgTasks in fetchReservations
content = content.replace(
    "setReservations(data);",
    "setReservations(data);\n            const bgResponse = await fetch('/api/auto-reserve-status', { headers: getAuthHeaders() });\n            if (bgResponse.ok) {\n                const bgData = await bgResponse.json();\n                setBgTasks(bgData.tasks || []);\n            }"
)

# 6. Add handleStopBgTask
handle_stop_code = """    const handleStopBgTask = async (task_id) => {
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

    const handleCancel = async"""
content = content.replace("    const handleCancel = async", handle_stop_code)

# 7. Pass bgTasks and onStopBgTask to ReservationsView
old_res_view_call = """              <ReservationsView 
                  reservations={reservations} 
                  onCancel={handleCancel}
                  onPay={(info) => setPaymentInfo(info)}
                  isLoading={isLoading} 
              />"""
new_res_view_call = """              <ReservationsView 
                  reservations={reservations} 
                  bgTasks={bgTasks}
                  onCancel={handleCancel}
                  onPay={(info) => setPaymentInfo(info)}
                  onStopBgTask={handleStopBgTask}
                  isLoading={isLoading} 
              />"""
content = content.replace(old_res_view_call, new_res_view_call)

# 8. Update ReservationsView definition
content = content.replace(
    "function ReservationsView({ reservations, onCancel, onPay, isLoading }) {",
    "function ReservationsView({ reservations, bgTasks, onCancel, onPay, onStopBgTask, isLoading }) {"
)

# 9. Update EmptyReservations logic
content = content.replace(
    "if (!hasSrtReservations && !hasKtxReservations && !srtError && !ktxError) {",
    "if (!hasSrtReservations && !hasKtxReservations && !srtError && !ktxError && (!bgTasks || bgTasks.length === 0)) {"
)

# 10. Add bgTasks rendering
bg_tasks_render = """        <div>
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
            )}"""
content = content.replace("        <div>", bg_tasks_render, 1)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
