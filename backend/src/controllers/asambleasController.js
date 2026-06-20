const path   = require('path');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const AsambleaDTO = require('../dto/asambleaDto');
const { uploadPrivateFile, getSignedUrl, deleteFile } = require('../services/supabase');

const fileFilter = (_req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) return cb(null, true);
  cb(new Error('Tipo de archivo no permitido. Use PDF, documentos Office o imágenes.'));
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const ADMIN_ROLES = ['Super Admin', 'Administrador'];

// Mapea una asamblea según el rol del viewer: admin ve votos completos;
// el resto solo su propio voto y sin documentPath (privacidad de votos).
function mapForViewer(asamblea, reqUser) {
  if (ADMIN_ROLES.includes(reqUser?.role)) return AsambleaDTO.toResponseAdmin(asamblea);
  const { votesYes, votesNo, votesAbstencion, userVotesJSON, documentPath, votes, userVotes, ...base } = asamblea;
  const userId = reqUser?.id || reqUser?.email;
  return { ...base, userVotes: { [userId]: userVotes?.[userId] } };
}

async function getAll(req, res) {
  try {
    const { page, limit } = req.query;
    // Solo Super Admin puede elegir condominio por query — el resto queda fijo al suyo.
    const condo = req.user.role === 'Super Admin' ? (req.query.condo || undefined) : req.user.condo;
    if (page) {
      const result = await db.getAsambleasPaged({
        page:  Math.max(1, parseInt(page) || 1),
        limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
        condo,
      });
      return res.json({ ...result, data: result.data.map(a => mapForViewer(a, req.user)) });
    }
    const asambleas = await db.getAsambleas(condo);
    res.json(asambleas.map(a => mapForViewer(a, req.user)));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    let fileUrl = '', fileName = '';
    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      fileUrl   = await uploadPrivateFile(req.file.buffer, 'asambleas', `${Date.now()}_${uuid()}${ext}`, req.file.mimetype);
      fileName  = req.file.originalname;
    }
    const data  = AsambleaDTO.fromRequest(req.body, fileName, fileUrl);
    // Administrador solo puede crear asambleas para su propio condominio.
    if (req.user.role !== 'Super Admin') data.condo = req.user.condo;
    const nuevo = await db.createAsamblea({ id: uuid(), ...data });
    res.status(201).json(AsambleaDTO.toResponseAdmin(nuevo));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function update(req, res) {
  try {
    const existing = await db.getAsambleaById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'Super Admin' && existing.condo !== req.user.condo) {
      return res.status(403).json({ error: 'No autorizado para este condominio' });
    }

    let fileUrl = '', fileName = '';
    if (req.file) {
      if (existing.documentPath) await deleteFile('asambleas', existing.documentPath);
      const ext = path.extname(req.file.originalname).toLowerCase();
      fileUrl   = await uploadPrivateFile(req.file.buffer, 'asambleas', `${Date.now()}_${uuid()}${ext}`, req.file.mimetype);
      fileName  = req.file.originalname;
    }
    const changes = AsambleaDTO.fromUpdate(req.body, fileName, fileUrl, existing);
    if (req.user.role !== 'Super Admin') changes.condo = req.user.condo;
    const updated = await db.updateAsamblea(req.params.id, changes);
    res.json(AsambleaDTO.toResponseAdmin(updated));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function remove(req, res) {
  try {
    const asamblea = await db.getAsambleaById(req.params.id);
    if (!asamblea) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'Super Admin' && asamblea.condo !== req.user.condo) {
      return res.status(403).json({ error: 'No autorizado para este condominio' });
    }
    if (asamblea.documentPath) await deleteFile('asambleas', asamblea.documentPath);
    await db.deleteAsamblea(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function vote(req, res) {
  try {
    const { tipo } = req.body || {};
    if (!tipo) return res.status(400).json({ error: 'Tipo de voto requerido' });
    const updated = await db.voteAsamblea(req.params.id, tipo, req.user.id);
    res.json(AsambleaDTO.toResponseAdmin(updated));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function getDocument(req, res) {
  try {
    const asamblea = await db.getAsambleaById(req.params.id);
    if (!asamblea?.documentPath) return res.status(404).json({ error: 'Documento no encontrado' });
    if (req.user.role !== 'Super Admin' && asamblea.condo !== req.user.condo) {
      return res.status(403).json({ error: 'No autorizado para este condominio' });
    }
    const signedUrl = await getSignedUrl('asambleas', asamblea.documentPath, 300);
    res.redirect(signedUrl);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { upload, getAll, create, update, remove, vote, getDocument };
