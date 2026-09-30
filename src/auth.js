// 관리 탭에서 이 브라우저에 저장한 코레일 계정 (localStorage)
export const getSavedCredentials = () => {
    try {
        const saved = JSON.parse(localStorage.getItem('trainCredentials') || '{}');
        return {
            ktxId: saved.ktxId || saved.srtId || '',
            ktxPw: saved.ktxPw || saved.srtPw || '',
            notifyEmail: saved.notifyEmail || '',
        };
    } catch (e) {
        return { ktxId: '', ktxPw: '', notifyEmail: '' };
    }
};

// 서버 요청마다 저장된 계정을 헤더로 보냅니다 (서버는 계정이 없는 요청을 거절)
export const getAuthHeaders = () => {
    const { ktxId, ktxPw, notifyEmail } = getSavedCredentials();
    return {
        'X-KTX-ID': ktxId,
        'X-KTX-PW': ktxPw,
        'X-SRT-ID': ktxId,
        'X-SRT-PW': ktxPw,
        'X-NOTIFY-EMAIL': notifyEmail
    };
};
