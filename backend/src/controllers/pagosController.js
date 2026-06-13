const path   = require('path');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const db      = require('../data/db');
const PagoDTO = require('../dto/pagoDto');
const { uploadFile } = require('../services/supabase');

// Multer usa memoria — no toca el disco
const fileFilter = (_req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) return cb(null, true);
  cb(new Error('Solo se permiten imágenes (JPG, PNG) o PDF.'));
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
});

async function getAll(req, res) {
  try {
    const { page, limit, estado, q, condo } = req.query;
    if (page) {
      const result = await db.getPagosPaged({
        page:  Math.max(1, parseInt(page) || 1),
        limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
        estado, q, condo,
      });
      return res.json({ ...result, data: result.data.map(PagoDTO.toResponse) });
    }
    res.json(await db.getPagos());
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const data = PagoDTO.fromRequest(req.body);
    let comprobanteUrl = '';

    if (req.file) {
      const ext      = path.extname(req.file.originalname).toLowerCase();
      const filename = `${Date.now()}_${uuid()}${ext}`;
      comprobanteUrl = await uploadFile(
        req.file.buffer,
        'comprobantes',
        filename,
        req.file.mimetype
      );
    }

    const nuevo = await db.createPago({
      id: uuid(),
      ...data,
      comprobante:   comprobanteUrl,
      createdByRole: req.user?.role || '',
    });
    res.status(201).json(PagoDTO.toResponse(nuevo));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

async function updateStatus(req, res) {
  try {
    const { estado, montoReal, saldoRestante, notaSaldo } = req.body || {};
    if (!estado) return res.status(400).json({ error: 'Estado requerido' });

    // Si hay montoReal, actualizar el monto del pago además del estado
    let updated;
    if (montoReal !== undefined && montoReal !== null) {
      updated = await db.updatePago(req.params.id, { estado, monto: Number(montoReal) });
    } else {
      updated = await db.updatePagoEstado(req.params.id, estado);
    }
    if (!updated) return res.status(404).json({ error: 'No encontrado' });

    // Si hay saldo restante, actualizarlo en la propiedad del propietario
    if (saldoRestante > 0 && updated.propietario) {
      const propiedades = await db.getPropiedades();
      const propiedad   = propiedades.find(p => p.owner === updated.propietario || p.tenant === updated.propietario);
      if (propiedad) {
        await db.updatePropiedad(propiedad.id, {
          debt:     Math.max(0, (Number(propiedad.debt) || 0) + saldoRestante),
          notaCargo: notaSaldo || `Saldo pendiente de pago del ${new Date().toLocaleDateString('es-BO')}`,
        }).catch(() => {});
      }
    }

    res.json(PagoDTO.toResponse(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { getAll, create, updateStatus, upload };
