const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp }     = require("firebase-admin/app");
const { getFirestore }      = require("firebase-admin/firestore");
const { getMessaging }      = require("firebase-admin/messaging");

initializeApp();

exports.notificarAmigosLibre = onDocumentUpdated(
  "usuarios/{userId}",
  async function(event) {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    // Solo actuar cuando disponible cambia de false/null a true
    if (after.disponible !== true || before.disponible === true) return;

    const userId = event.params.userId;
    const nombre = after.nombre || "Alguien";
    const amigos = after.amigos || [];

    if (!amigos.length) return;

    const db = getFirestore();

    // Recolectar fcmTokens de todos los amigos en batches de 10
    const tokens = [];
    const chunks = [];
    for (var i = 0; i < amigos.length; i += 10) {
      chunks.push(amigos.slice(i, i + 10));
    }

    for (var c = 0; c < chunks.length; c++) {
      var snaps = await db
        .collection("usuarios")
        .where("__name__", "in", chunks[c])
        .get();

      snaps.forEach(function(docSnap) {
        if (docSnap.id === userId) return;
        var token = docSnap.data().fcmToken;
        if (token && typeof token === "string" && token.length > 10) {
          tokens.push(token);
        }
      });
    }

    if (!tokens.length) return;

    var message = {
      notification: {
        title: nombre + " está libre ⚡",
        body:  "Está libre y desparchado en la universidad ahora mismo",
      },
      webpush: {
        notification: {
          icon:               "/icon-192.png",
          badge:              "/icon-72.png",
          tag:                "syncu-libre-" + userId,
          requireInteraction: false,
          vibrate:            [100, 50, 100],
        },
        fcmOptions: {
          link: "https://felipemoralesm.github.io/syncu/pages/comparador.html",
        },
      },
      data: {
        tipo:       "libre",
        senderUid:  userId,
        senderName: nombre,
      },
      tokens: tokens,
    };

    try {
      var response = await getMessaging().sendEachForMulticast(message);

      console.log(
        "[SyncU] Notificaciones enviadas: " +
        response.successCount + "/" + tokens.length +
        " (fallidas: " + response.failureCount + ")"
      );

      // Limpiar tokens inválidos o expirados
      var staleTokens = [];
      response.responses.forEach(function(r, idx) {
        if (!r.success) {
          var errorObj = r.error || {};
          var code = errorObj.code || "";
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token" ||
            code === "messaging/invalid-argument"
          ) {
            staleTokens.push(tokens[idx]);
          }
          console.warn("[SyncU] Token " + idx + " falló: " + code);
        }
      });

      // Borrar fcmToken de usuarios con tokens caducados
      if (staleTokens.length > 0) {
        var staleChunk = staleTokens.slice(0, 10);
        var staleSnaps = await db
          .collection("usuarios")
          .where("fcmToken", "in", staleChunk)
          .get();

        var batch = db.batch();
        staleSnaps.forEach(function(docSnap) {
          batch.update(docSnap.ref, { fcmToken: null });
        });
        await batch.commit();
        console.log("[SyncU] " + staleTokens.length + " tokens inválidos eliminados");
      }
    } catch (err) {
      console.error("[SyncU] Error enviando FCM:", err);
    }
  }
);
