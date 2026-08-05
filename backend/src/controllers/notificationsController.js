const db = require('../data/db');

async function registerToken(req, res) {
  try {
    const { token, platform } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Token requerido' });
    await db.saveFcmToken(req.user.id, token, platform || 'android');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function removeToken(req, res) {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Token requerido' });
    await db.removeFcmToken(token);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function getPreferences(req, res) {
  try {
    const prefs = await db.getNotificationPreferences(req.user.id);
    res.json(prefs || {
      paymentApproved: true,
      paymentSubmitted: true,
      announcement: true,
      panic: true,
      reservationApproved: true,
      reservationRequested: true,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function updatePreferences(req, res) {
  try {
    const { paymentApproved, paymentSubmitted, announcement, panic, reservationApproved, reservationRequested } = req.body || {};
    const prefs = await db.upsertNotificationPreferences(req.user.id, {
      ...(paymentApproved    !== undefined && { paymentApproved }),
      ...(paymentSubmitted   !== undefined && { paymentSubmitted }),
      ...(announcement       !== undefined && { announcement }),
      ...(panic              !== undefined && { panic }),
      ...(reservationApproved    !== undefined && { reservationApproved }),
      ...(reservationRequested   !== undefined && { reservationRequested }),
    });
    res.json(prefs);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { registerToken, removeToken, getPreferences, updatePreferences };
