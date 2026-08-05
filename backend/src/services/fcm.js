const db = require('../data/db');
const mailer = require('./mailer');

const emailKey = (prefKey) => prefKey ? 'email' + prefKey[0].toUpperCase() + prefKey.slice(1) : null;

let messagingInstance = null;

function getMessaging() {
  if (messagingInstance) return messagingInstance;
  const key = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!key) return null;
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(key)) });
    }
    messagingInstance = admin.messaging();
    return messagingInstance;
  } catch (e) {
    console.error('[FCM] Error inicializando Firebase Admin:', e.message);
    return null;
  }
}

async function sendToTokens(tokens, title, body, data = {}) {
  if (!tokens?.length) return;
  const messaging = getMessaging();
  if (!messaging) {
    console.log('[FCM] Sin configurar — omitida:', title);
    return;
  }
  const message = {
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    tokens,
    android: { priority: 'high' },
  };
  try {
    const response = await messaging.sendEachForMulticast(message);
    const toRemove = [];
    response.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (code.includes('not-registered') || code.includes('invalid-registration-token')) {
          toRemove.push(tokens[i]);
        }
      }
    });
    await Promise.all(toRemove.map(t => db.removeFcmToken(t).catch(() => {})));
  } catch (e) {
    console.error('[FCM] Error enviando:', e.message);
  }
}

// Notifica a un usuario específico si tiene la preferencia habilitada
async function notifyUser(usuarioId, prefKey, title, body, data = {}) {
  try {
    const prefs = prefKey ? await db.getNotificationPreferences(usuarioId) : null;

    // Push
    if (!prefs || prefs[prefKey] !== false) {
      const tokens = await db.getFcmTokensByUsuario(usuarioId);
      await sendToTokens(tokens, title, body, data);
    }

    // Email
    const eKey = emailKey(prefKey);
    if (eKey && prefs && prefs[eKey] === true) {
      const user = await db.getUsuarioById(usuarioId);
      if (user?.email) await mailer.sendNotificationEmail(user.email, user.name, title, body).catch(() => {});
    }
  } catch (e) {
    console.error('[FCM] notifyUser error:', e.message);
  }
}

// Notifica a todos los usuarios de un rol (o varios) en el condo, respetando preferencias
async function notifyRole(condo, roles, prefKey, title, body, data = {}) {
  try {
    const userIds = await db.getUsuarioIdsByRole(condo, roles);
    if (!userIds.length) return;

    const prefs = prefKey ? await db.getNotificationPreferencesBatch(userIds) : [];
    const prefMap = new Map(prefs.map(p => [p.usuarioId, p]));
    const eKey = emailKey(prefKey);

    // Push — usuarios con preferencia push habilitada
    const pushIds = prefKey
      ? userIds.filter(id => { const p = prefMap.get(id); return !p || p[prefKey] !== false; })
      : userIds;
    const tokens = await db.getFcmTokensByUserIds(pushIds);
    await sendToTokens([...new Set(tokens)], title, body, data);

    // Email — usuarios con preferencia email habilitada
    if (eKey) {
      const emailIds = userIds.filter(id => prefMap.get(id)?.[eKey] === true);
      if (emailIds.length) {
        const users = await db.getUsuariosByIds(emailIds);
        await Promise.all(
          users.filter(u => u.email).map(u =>
            mailer.sendNotificationEmail(u.email, u.name, title, body).catch(() => {})
          )
        );
      }
    }
  } catch (e) {
    console.error('[FCM] notifyRole error:', e.message);
  }
}

// Busca al usuario por nombre en el condo y le envía la notificación
async function notifyUserByName(name, condo, prefKey, title, body, data = {}) {
  try {
    const usuarios = await db.getUsuarios(condo);
    const user = usuarios.find(u => u.name === name);
    if (!user) return;
    await notifyUser(user.id, prefKey, title, body, data);
  } catch (e) {
    console.error('[FCM] notifyUserByName error:', e.message);
  }
}

module.exports = { notifyUser, notifyRole, notifyUserByName };
