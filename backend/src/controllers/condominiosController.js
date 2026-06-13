const path   = require('path');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const db             = require('../data/db');
const CondominioDTO  = require('../dto/condominioDto');
const { uploadFile, deleteFile } = require('../services/supabase');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) return cb(null, true);
    cb(new Error('Solo se permiten imágenes (JPG, PNG, WEBP).'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

async function getAll(req, res) {
  try { res.json(await db.getCondominios()); }
  catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const data  = CondominioDTO.fromRequest(req.body);
    const nuevo = await db.createCondominio({ id: uuid(), ...data });
    res.status(201).json(CondominioDTO.toResponse(nuevo));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function update(req, res) {
  try {
    const { name, type, address, units, plan } = req.body || {};
    const changes = {
      ...(name    && { name }),
      ...(type    && { type }),
      ...(address !== undefined && { address }),
      ...(units   !== undefined && { units: String(units) }),
      ...(plan    && { plan }),
    };
    const updated = await db.updateCondominio(req.params.id, changes);
    if (!updated) return res.status(404).json({ error: 'No encontrado' });
    res.json(CondominioDTO.toResponse(updated));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function remove(req, res) {
  try {
    const id = req.params.id;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'ID de condominio inválido' });
    }
    const condos = await db.getCondominios();
    const exists  = condos.find(c => String(c.id) === String(id));
    if (!exists) return res.status(404).json({ error: 'Condominio no encontrado' });
    await db.deleteCondominio(id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// GET /condominios/payment-qr — devuelve info de pago del condominio del usuario logueado
async function getMyPaymentQr(req, res) {
  try {
    const user   = await db.getUsuarioById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const condos = await db.getCondominios();
    const condo  = condos.find(c => c.name === user.condo);
    res.json({
      paymentQrUrl:      condo?.paymentQrUrl      || '',
      expensasMensuales: Number(condo?.expensasMensuales) || 0,
      condoName:         condo?.name || user.condo || '',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// PUT /condominios/:id/asignar-expensas — asigna monto a propiedades seleccionadas
async function asignarExpensas(req, res) {
  try {
    const { id } = req.params;
    const { monto, propiedadIds } = req.body || {};
    if (!monto || !Array.isArray(propiedadIds)) {
      return res.status(400).json({ error: 'Faltan datos: monto y propiedadIds' });
    }

    if (req.user.role === 'Administrador') {
      const adminUser = await db.getUsuarioById(req.user.id);
      const condos    = await db.getCondominios();
      const condo     = condos.find(c => String(c.id) === String(id));
      if (!condo || condo.name !== adminUser?.condo) {
        return res.status(403).json({ error: 'Solo podés modificar tu propio condominio' });
      }
    }

    const montoNum = Math.max(0, Number(monto) || 0);
    const updated  = [];
    for (const propId of propiedadIds) {
      const result = await db.updatePropiedad(propId, { expensaMensual: montoNum });
      if (result) updated.push(result);
    }
    res.json({ ok: true, updated: updated.length });
  } catch (e) { res.status(400).json({ error: e.message }); }
}

// PUT /condominios/:id/payment-qr — el admin sube o reemplaza el QR
async function uploadPaymentQr(req, res) {
  try {
    const { id } = req.params;
    const condos  = await db.getCondominios();
    const condo   = condos.find(c => String(c.id) === String(id));
    if (!condo) return res.status(404).json({ error: 'Condominio no encontrado' });

    // Administrador solo puede gestionar su propio condominio
    if (req.user.role === 'Administrador') {
      const user = await db.getUsuarioById(req.user.id);
      if (!user || user.condo !== condo.name) {
        return res.status(403).json({ error: 'Solo podés gestionar el QR de tu propio condominio' });
      }
    }

    if (!req.file) return res.status(400).json({ error: 'Se requiere una imagen del QR' });

    // Borrar QR anterior si existe
    if (condo.paymentQrUrl) {
      await deleteFile('payment-qr', condo.paymentQrUrl).catch(() => {});
    }

    const ext      = path.extname(req.file.originalname).toLowerCase();
    const filename = `qr_${id}_${Date.now()}${ext}`;
    const paymentQrUrl = await uploadFile(req.file.buffer, 'payment-qr', filename, req.file.mimetype);

    const updated = await db.updateCondominio(id, { paymentQrUrl });
    res.json(CondominioDTO.toResponse(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// DELETE /condominios/:id/payment-qr — elimina el QR
async function deletePaymentQr(req, res) {
  try {
    const { id } = req.params;
    const condos  = await db.getCondominios();
    const condo   = condos.find(c => String(c.id) === String(id));
    if (!condo) return res.status(404).json({ error: 'Condominio no encontrado' });

    if (req.user.role === 'Administrador') {
      const user = await db.getUsuarioById(req.user.id);
      if (!user || user.condo !== condo.name) {
        return res.status(403).json({ error: 'Solo podés gestionar el QR de tu propio condominio' });
      }
    }

    if (condo.paymentQrUrl) {
      await deleteFile('payment-qr', condo.paymentQrUrl).catch(() => {});
    }

    const updated = await db.updateCondominio(id, { paymentQrUrl: '' });
    res.json(CondominioDTO.toResponse(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { getAll, create, update, remove, upload, uploadPaymentQr, deletePaymentQr, getMyPaymentQr, asignarExpensas };
