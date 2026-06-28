const path   = require('path');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const db      = require('../data/db');
const PagoDTO = require('../dto/pagoDto');
const { uploadPrivateFile, getSignedUrl } = require('../services/supabase');

// El comprobante se guarda como nombre de archivo (bucket privado) — al
// devolver el pago al cliente se reemplaza por un link firmado, válido 10 minutos.
async function withSignedComprobante(pago) {
  if (!pago?.comprobante) return pago;
  const signed = await getSignedUrl('comprobantes', pago.comprobante, 600).catch(() => '');
  return { ...pago, comprobante: signed };
}

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
    const { page, limit, estado, q, tipo } = req.query;
    // Solo Super Admin puede elegir condominio por query — el resto queda fijo al suyo.
    const condo = req.user.role === 'Super Admin' ? (req.query.condo || undefined) : req.user.condo;
    if (page) {
      const result = await db.getPagosPaged({
        page:  Math.max(1, parseInt(page) || 1),
        limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
        estado, q, condo, tipo,
      });
      const data = await Promise.all(result.data.map(PagoDTO.toResponse).map(withSignedComprobante));
      return res.json({ ...result, data });
    }
    const pagos = (await db.getPagos(condo)).map(PagoDTO.toResponse);
    res.json(await Promise.all(pagos.map(withSignedComprobante)));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const data = PagoDTO.fromRequest(req.body);

    // Un residente solo puede registrar pagos a su propio nombre — el cuerpo
    // de la petición no decide a nombre de quién queda el pago.
    if (['Propietario', 'Inquilino'].includes(req.user.role)) {
      const me = await db.getUsuarioById(req.user.id);
      if (me?.name) { data.propietario = me.name; data.resident = me.name; }
    }

    let comprobanteUrl = '';

    if (req.file) {
      const ext      = path.extname(req.file.originalname).toLowerCase();
      const filename = `${Date.now()}_${uuid()}${ext}`;
      comprobanteUrl = await uploadPrivateFile(
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
      condo:         req.user?.condo || '',
    });
    res.status(201).json(await withSignedComprobante(PagoDTO.toResponse(nuevo)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

async function updateStatus(req, res) {
  try {
    const { estado, montoReal, saldoRestante, notaSaldo } = req.body || {};
    if (!estado) return res.status(400).json({ error: 'Estado requerido' });

    const existing = await db.getPagoById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'Super Admin' && existing.condo !== req.user.condo) {
      return res.status(403).json({ error: 'No autorizado para este condominio' });
    }

    // Si hay montoReal, actualizar el monto del pago además del estado
    let updated;
    if (montoReal !== undefined && montoReal !== null) {
      updated = await db.updatePago(req.params.id, { estado, monto: Number(montoReal) });
    } else {
      updated = await db.updatePagoEstado(req.params.id, estado);
    }
    if (!updated) return res.status(404).json({ error: 'No encontrado' });

    // Al aprobar un pago, los cargos extra que cubre quedan pagados — se
    // borran para que no sigan apareciendo como pendientes. Una Reserva paga
    // exactamente el cargo extra que la generó; una Expensa pagada en su
    // totalidad (sin saldo restante) paga todos los cargos extra de la propiedad.
    let propiedadActualizada = null;
    if (estado === 'aprobado') {
      let propiedadId = null;
      if (existing.tipo === 'Reserva' && existing.reservaId) {
        const propiedades = await db.getPropiedades();
        const propiedad   = propiedades.find(p =>
          p.owner === existing.propietario ||
          (Array.isArray(p.tenants) ? p.tenants.includes(existing.propietario) : p.tenant === existing.propietario)
        );
        if (propiedad) {
          await db.deleteCargosExtraByReservaId(existing.reservaId).catch(() => {});
          propiedadId = propiedad.id;
        }
      } else if (existing.tipo !== 'Reserva' && !saldoRestante) {
        const propiedades = await db.getPropiedades();
        const propiedad   = propiedades.find(p =>
          p.owner === existing.propietario ||
          (Array.isArray(p.tenants) ? p.tenants.includes(existing.propietario) : p.tenant === existing.propietario)
        );
        if (propiedad) {
          await db.deleteCargosExtraByPropiedadId(propiedad.id).catch(() => {});
          propiedadId = propiedad.id;
        }
      }
      if (propiedadId) {
        propiedadActualizada = (await db.getPropiedades()).find(p => String(p.id) === String(propiedadId)) || null;
      }
    }

    // Si hay saldo restante, actualizarlo en la propiedad del propietario
    if (saldoRestante > 0 && updated.propietario) {
      const propiedades = await db.getPropiedades();
      const propiedad   = propiedades.find(p =>
        p.owner === updated.propietario ||
        (Array.isArray(p.tenants) ? p.tenants.includes(updated.propietario) : p.tenant === updated.propietario)
      );
      if (propiedad) {
        await db.updatePropiedad(propiedad.id, {
          debt:     Math.max(0, (Number(propiedad.debt) || 0) + saldoRestante),
          notaCargo: notaSaldo || `Saldo pendiente de pago del ${new Date().toLocaleDateString('es-BO')}`,
        }).catch(() => {});
      }
    }

    res.json({ ...(await withSignedComprobante(PagoDTO.toResponse(updated))), propiedadActualizada });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { getAll, create, updateStatus, upload };
