// VAPID 공개키를 URL-safe Base64에서 Uint8Array로 변환하는 함수
function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, "+")
      .replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
  
// 푸시 알림 구독을 요청하는 메인 함수
  
export async function subscribeUserToPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
  
      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        console.log("User IS already subscribed.");
        return; // 이미 구독 상태이면 조용히 종료
      }
  
      const response = await fetch('/api/vapid_public_key');
      const vapidPublicKey = await response.text();
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
  
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
  
      await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription),
      });
  
      console.log("User is subscribed.");
      // alert("푸시 알림이 활성화되었습니다."); // 이 줄을 삭제하거나 주석 처리
  
    } catch (error) {
      // 사용자가 권한을 거부하면 여기서 에러가 발생하므로, alert를 띄우지 않습니다.
      console.error("Failed to subscribe the user: ", error);
      // alert("푸시 알림을 활성화하는 데 실패했습니다."); // 이 줄을 삭제하거나 주석 처리
    }
  }