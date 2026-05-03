// ═══════════════════════════════════════════════════════════
//  SyncU — Cloud Functions
//  functions/index.js
//
//  Deploy:  cd functions && npm install && cd ..
//           firebase deploy --only functions
// ═══════════════════════════════════════════════════════════
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp }     = require("firebase-admin/app");
const { getFirestore }      = require("firebase-admin/firestore");
const { getMessaging }      = require("firebase-admin/messaging");

initializeApp();

// ── Trigger: nuevo doc en /notificaciones/{id} ───────────
exports.enviarNotificacionLibre = onDocumentCreated(
  "notificaciones/{notifId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    if (data.procesado) return; // ya procesado

    const { targetUids, titulo, cuerpo, senderUid } = data;
    if (!targetUids?.length) return;

    const db = getFirestore();

    // Obtener fcmToken de cada destinatario
    const tokens = [];
    for (const uid of targetUids) {
      if (uid === senderUid) continue; // no notificarse a sí mismo
      try {
        const userSnap = await db.collection("usuarios").doc(uid).get();
        const token = userSnap.data()?.fcmToken;
        if (token) tokens.push(token);
      } catch (e) {
        console.warn(`No se pudo leer token de ${uid}:`, e);
      }
    }

    if (!tokens.length) {
      await snap.ref.update({ procesado: true, resultado: "sin tokens" });
      return;
    }

    // Enviar notificación push
    const message = {
      notification: { title: titulo, body: cuerpo },
      data: {
        tipo:      "libre",
        senderUid: senderUid || "",
        click_action: "https://felipemoralesm.github.io/syncu/pages/comparador.html",
      },
      webpush: {
        notification: {
          icon: "/syncu/assets/icons/icon-192.png",
          badge: "/syncu/assets/icons/icon-72.png",
          requireInteraction: false,
          tag: `libre-${senderUid}`,
        },
        fcmOptions: {
          link: `https://felipemoralesm.github.io/syncu/pages/comparador.html`,
        },
      },
      tokens, // MulticastMessage
    };

    try {
      const response = await getMessaging().sendEachForMulticast(message);
      console.log(
        `Enviadas ${response.successCount}/${tokens.length} notificaciones`
      );

      // Limpiar tokens inválidos
      const invalidTokenUids = [];
      response.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error?.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            invalidTokenUids.push(targetUids[i]);
          }
        }
      });

      // Borrar fcmToken de usuarios con tokens caducados
      for (const uid of invalidTokenUids) {
        await db.collection("usuarios").doc(uid)
          .update({ fcmToken: null })
          .catch(() => {});
      }

      await snap.ref.update({
        procesado:     true,
        enviadas:      response.successCount,
        fallidas:      response.failureCount,
        procesadoEn:   new Date().toISOString(),
      });
    } catch (e) {
      console.error("Error enviando FCM:", e);
      await snap.ref.update({ procesado: true, error: String(e) });
    }
  }
);
