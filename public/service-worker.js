// 서비스 워커에 'push' 이벤트 리스너 추가
self.addEventListener('push', event => {
    console.log('[Service Worker] Push Received.');
    // 푸시 데이터 파싱
    const data = event.data.json();
    const title = data.title || '열차 예매';
    const options = {
      body: data.body || '새로운 알림이 도착했습니다.',
      // TODO: 알림 아이콘 이미지를 public 폴더에 추가하세요.
      icon: '/notification-icon.png',
      badge: '/badge-icon.png'
    };
  
    // 알림 표시
    event.waitUntil(self.registration.showNotification(title, options));
  });
  
  // 알림 클릭 시 동작 (예: 앱 열기)
  self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Notification click Received.');
    event.notification.close();
    event.waitUntil(
      clients.openWindow('/') // 알림 클릭 시 메인 페이지로 이동
    );
  });