const db = require('../data/db');
const mailer = require('./mailer');
const https = require('https');

const emailKey = (prefKey) => prefKey ? 'email' + prefKey[0].toUpperCase() + prefKey.slice(1) : null;

// Send via Expo Push API
async function sendToTokens(tokens, title, body, data = {}) {
  if (!tokens?.length) return;

  const expoPushTokens = tokens.filter(t => t && t.startsWith('ExponentPushToken'));
  if (!expoPushTokens.length) return;

  const messages = expoPushTokens.map(to => ({
    to,
    title,
    body,
    data,
    sound: 'default',
    priority: 'high',
  }));

  const payload = JSON.stringify(messages);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'exp.host',
      path: '/--/api/v2/push/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', async () => {
        try {
          const result = JSON.parse(raw);
          const toRemove = [];
          (result.data || []).forEach((r, i) => {
            if (r.status === 'error') {
              const details = r.details?.error || '';
              if (details === 'DeviceNotRegistered' || details === 'InvalidCredentials') {
                toRemove.push(expoPushTokens[i]);
              }
            }
          });
          await Promise.all(toRemove.map(t => db.removeFcmToken(t).catch(() => {})));
        } catch (_) {}
        resolve();
      });
    });
    req.on('error', () => resolve());
    req.write(payload);
    req.end();
  });
}

// Notifica a un usuario específico respetando sus preferencias
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
    console.error('[PUSH] notifyUser error:', e.message);
  }
}

// Notifica a todos los usuarios de un rol en el condo respetando preferencias
async function notifyRole(condo, roles, prefKey, title, body, data = {}) {
  try {
    const userIds = await db.getUsuarioIdsByRole(condo, roles);
    if (!userIds.length) return;

    const prefs = prefKey ? await db.getNotificationPreferencesBatch(userIds) : [];
    const prefMap = new Map(prefs.map(p => [p.usuarioId, p]));
    const eKey = emailKey(prefKey);

    // Push
    const pushIds = prefKey
      ? userIds.filter(id => { const p = prefMap.get(id); return !p || p[prefKey] !== false; })
      : userIds;
    const tokens = await db.getFcmTokensByUserIds(pushIds);
    await sendToTokens([...new Set(tokens)], title, body, data);

    // Email
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
    console.error('[PUSH] notifyRole error:', e.message);
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
    console.error('[PUSH] notifyUserByName error:', e.message);
  }
}

module.exports = { notifyUser, notifyRole, notifyUserByName };
