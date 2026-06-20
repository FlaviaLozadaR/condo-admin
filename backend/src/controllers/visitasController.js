const path   = require('path');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const db  = require('../data/db');
const VisitaDTO = require('../dto/visitaDto');
const HistorialDTO = require('../dto/historialDto');
const { uploadPrivateFile, getSignedUrl, deleteFile } = require('../services/supabase');

const BUCKET = 'visitas-documentos';

const fileFilter = (_req, file, cb) => {
  const allowed = file.fieldname === 'platePhoto'
    ? ['.jpg', '.jpeg', '.png', '.webp']
    : ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) return cb(null, true);
  cb(new Error('Tipo de archivo no permitido.'));
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const TYPE_FIELDS = {
  front: 'idDocumentFrontPath',
  back:  'idDocumentBackPath',
  plate: 'platePhotoPath',
};

async function getAll(req, res) {
  try {
    // Solo Super Admin puede elegir condominio por query — el resto queda fijo al suyo.
    const condo = req.user.role === 'Super Admin' ? (req.query.condo || undefined) : req.user.condo;
    res.json((await db.getVisitas(condo)).map(VisitaDTO.toResponse));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const data = VisitaDTO.fromRequest(req.body);

    const uploads = { idDocumentFrontPath: '', idDocumentBackPath: '', platePhotoPath: '' };
    const front = req.files?.idDocumentFront?.[0];
    const back  = req.files?.idDocumentBack?.[0];
    const plate = req.files?.platePhoto?.[0];

    if (front) {
      uploads.idDocumentFrontPath = await uploadPrivateFile(front.buffer, BUCKET, `${Date.now()}_${uuid()}${path.extname(front.originalname).toLowerCase()}`, front.mimetype);
      data.idDocumentName = front.originalname;
    }
    if (back) {
      uploads.idDocumentBackPath = await uploadPrivateFile(back.buffer, BUCKET, `${Date.now()}_${uuid()}${path.extname(back.originalname).toLowerCase()}`, back.mimetype);
    }
    if (plate) {
      uploads.platePhotoPath = await uploadPrivateFile(plate.buffer, BUCKET, `${Date.now()}_${uuid()}${path.extname(plate.originalname).toLowerCase()}`, plate.mimetype);
      data.platePhotoName = plate.originalname;
    }

    const nuevo = await db.createVisita({ id: uuid(), ...data, ...uploads, condo: req.user?.condo || '' });

    // Si seguridad registra el ingreso en la puerta, el visitante ya está
    // entrando: se crea de una vez el registro de historial (entrada = ahora).
    let historialEntry = null;
    if (data.status === 'Registrado') {
      const historialData = HistorialDTO.fromRequest({
        visitante: data.fullName,
        cedula:    data.idNumber,
        propiedad: data.property,
        tipo:      data.mode,
        placa:     data.plate,
        guard:     data.createdBy,
        motivo:    data.motive,
      });
      historialEntry = HistorialDTO.toResponse(await db.createHistorial({ id: uuid(), ...historialData, condo: req.user?.condo || '' }));
    }

    res.status(201).json({ ...VisitaDTO.toResponse(nuevo), historialEntry });
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function verify(req, res) {
  try {
    const visita = await db.getVisitaByCode(req.params.code);
    if (!visita) return res.status(404).json({ error: 'Pase no encontrado', code: req.params.code });
    if (req.user.role !== 'Super Admin' && visita.condo !== req.user.condo) {
      return res.status(404).json({ error: 'Pase no encontrado', code: req.params.code });
    }
    res.json(VisitaDTO.toResponse(visita));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function update(req, res) {
  try {
    const existing = await db.getVisitaById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'Super Admin' && existing.condo !== req.user.condo) {
      return res.status(403).json({ error: 'No autorizado para este condominio' });
    }
    const { fullName, idNumber, property, motive, mode, plate } = req.body || {};
    const changes = {};
    if (fullName !== undefined) {
      if (!fullName.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
      changes.fullName = fullName.trim();
    }
    if (idNumber !== undefined) {
      if (!idNumber.trim()) return res.status(400).json({ error: 'El documento es requerido' });
      changes.idNumber = idNumber.trim();
    }
    if (property !== undefined) {
      if (!property.trim()) return res.status(400).json({ error: 'La propiedad es requerida' });
      changes.property = property.trim();
    }
    if (motive !== undefined) {
      if (!motive.trim()) return res.status(400).json({ error: 'El motivo es requerido' });
      changes.motive = motive.trim();
    }
    if (mode !== undefined) changes.mode = mode === 'vehicular' ? 'vehicular' : 'peatonal';
    if (plate !== undefined) changes.plate = plate?.trim() || '-';

    if (Object.keys(changes).length === 0) return res.status(400).json({ error: 'Nada para actualizar' });

    const updated = await db.updateVisita(req.params.id, changes);
    if (!updated) return res.status(404).json({ error: 'No encontrado' });
    res.json(VisitaDTO.toResponse(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function updateStatus(req, res) {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'Status requerido' });
    const existing = await db.getVisitaById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'Super Admin' && existing.condo !== req.user.condo) {
      return res.status(403).json({ error: 'No autorizado para este condominio' });
    }
    const updated = await db.updateVisitaStatus(req.params.id, status);
    res.json(VisitaDTO.toResponse(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function getDocumentUrl(req, res) {
  try {
    const field = TYPE_FIELDS[req.params.type];
    if (!field) return res.status(400).json({ error: 'Tipo de documento inválido' });

    const visita = await db.getVisitaById(req.params.id);
    if (!visita) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'Super Admin' && visita.condo !== req.user.condo) {
      return res.status(403).json({ error: 'No autorizado para este condominio' });
    }

    const filePath = visita[field];
    if (!filePath) return res.status(404).json({ error: 'Documento no disponible' });

    const url = await getSignedUrl(BUCKET, filePath, 300);
    res.json({ url });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function deleteDocument(req, res) {
  try {
    const field = TYPE_FIELDS[req.params.type];
    if (!field) return res.status(400).json({ error: 'Tipo de documento inválido' });

    const visita = await db.getVisitaById(req.params.id);
    if (!visita) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'Super Admin' && visita.condo !== req.user.condo) {
      return res.status(403).json({ error: 'No autorizado para este condominio' });
    }

    const filePath = visita[field];
    if (filePath) {
      await deleteFile(BUCKET, filePath);
      await db.updateVisita(req.params.id, { [field]: '' });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { upload, getAll, create, verify, update, updateStatus, getDocumentUrl, deleteDocument };
