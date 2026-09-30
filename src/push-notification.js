import { getAuthHeaders, getSavedCredentials } from './auth';

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

// 푸시 알림을 구독하고, 관리 탭에 저장된 계정으로 서버에 등록합니다.
// 서버는 계정별로 구독을 저장하므로, 이미 구독된 기기도 매번 현재 계정으로 다시 등록합니다.
export async function subscribeUserToPush() {
    try {
      const registration = await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const response = await fetch('/api/vapid_public_key');
        const vapidPublicKey = await response.text();
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      }

      // 계정을 저장하기 전에는 등록하지 않음 (관리 탭에서 저장할 때 다시 등록됨)
      const { ktxId, ktxPw } = getSavedCredentials();
      if (!ktxId || !ktxPw) return;

      await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(subscription),
      });
    } catch (error) {
      // 사용자가 권한을 거부하면 여기서 에러가 발생하므로, alert를 띄우지 않습니다.
      console.error("Failed to subscribe the user: ", error);
    }
  }
