// ═══════════════════════════════════════════════════════════
//  SyncU — Push Notifications Client
//  js/push-notifications.js
// ═══════════════════════════════════════════════════════════
import { getMessaging, getToken, onMessage }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
import { doc, updateDoc, addDoc, collection, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// VAPID public key — Firebase Console → Project Settings
// → Cloud Messaging → Web Push certificates → Key pair
const VAPID_KEY = "TU_VAPID_PUBLIC_KEY_AQUI";

let messaging = null;

export async function initPush(firebaseApp, db, uid) {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  messaging = getMessaging(firebaseApp);
  const swReg = await navigator.serviceWorker.ready;

  let token;
  try {
    token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
  } catch(e) { console.warn('[SyncU Push] getToken failed:', e); return; }

  if (!token) return;

  try {
    await updateDoc(doc(db, 'usuarios', uid), {
      fcmToken: token,
      fcmUpdatedAt: serverTimestamp(),
    });
  } catch(e) { console.warn('[SyncU Push] token save failed:', e); }

  // Foreground message handler
  onMessage(messaging, payload => {
    const { title, body } = payload.notification || {};
    if (title) showInAppBanner(title, body || '');
  });
}

export async function notifyFriends(db, senderUid, senderName, friendUids) {
  if (!friendUids?.length) return;
  const chunks = [];
  for (let i = 0; i < friendUids.length; i += 10)
    chunks.push(friendUids.slice(i, i + 10));

  for (const chunk of chunks) {
    await addDoc(collection(db, 'notificaciones'), {
      tipo:       'libre',
      senderUid,
      senderName,
      targetUids: chunk,
      titulo:     `${senderName} está libre ⚡`,
      cuerpo:     '¡Están libres al mismo tiempo! Compara horarios.',
      creadoEn:   serverTimestamp(),
      procesado:  false,
    });
  }
}

function showInAppBanner(title, body) {
  document.getElementById('syncu-push-banner')?.remove();
  const banner = document.createElement('div');
  banner.id = 'syncu-push-banner';
  Object.assign(banner.style, {
    position:'fixed', top:'70px', left:'50%',
    transform:'translateX(-50%)',
    maxWidth:'380px', width:'calc(100% - 2rem)',
    background:'#1A1A1A',
    border:'1px solid rgba(255,107,0,0.3)',
    borderRadius:'14px', padding:'0.85rem 1rem',
    display:'flex', alignItems:'flex-start', gap:'0.75rem',
    boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
    zIndex:'500', fontFamily:"'Space Grotesk',sans-serif",
    animation:'syncu-banner-in 0.35s cubic-bezier(0.22,1,0.36,1) forwards',
  });
  if (!document.getElementById('syncu-banner-style')) {
    const s = document.createElement('style');
    s.id = 'syncu-banner-style';
    s.textContent = `@keyframes syncu-banner-in{from{opacity:0;transform:translateX(-50%) translateY(-20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
    document.head.appendChild(s);
  }
  banner.innerHTML = `
    <div style="font-size:1.4rem;line-height:1;flex-shrink:0">⚡</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:.88rem;font-weight:700;color:#fff;margin-bottom:.15rem">${title}</div>
      <div style="font-size:.75rem;color:#9CA3AF">${body}</div>
    </div>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#666;cursor:pointer;font-size:1.1rem;padding:0;line-height:1">×</button>`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove?.(), 5000);
}
