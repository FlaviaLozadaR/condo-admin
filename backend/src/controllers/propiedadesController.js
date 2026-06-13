const { v4: uuid } = require('uuid');
const db  = require('../data/db');
const PropiedadDTO = require('../dto/propiedadDto');

// Actualiza el campo `property` del usuario cuando se le asigna una propiedad
async function syncUserProperty(propiedad) {
  const label = `${propiedad.street} - ${propiedad.code}`;
  try {
    if (propiedad.owner && propiedad.owner !== '-') {
      const usuarios = await db.getUsuarios();
      const owner = usuarios.find(u => u.name === propiedad.owner);
      if (owner) await db.updateUsuario(owner.id, { property: label }).catch(() => {});
    }
    if (propiedad.tenant && propiedad.tenant !== '-') {
      const usuarios = await db.getUsuarios();
      const tenant = usuarios.find(u => u.name === propiedad.tenant);
      if (tenant) await db.updateUsuario(tenant.id, { property: label }).catch(() => {});
    }
  } catch { /* no bloquear si falla */ }
}

async function getAll(req, res) {
  try {
    const { page, limit, q, condo } = req.query;
    if (page) {
      const result = await db.getPropiedadesPaged({
        page:  Math.max(1, parseInt(page) || 1),
        limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
        q, condo,
      });
      return res.json({ ...result, data: result.data.map(PropiedadDTO.toResponse) });
    }
    res.json(await db.getPropiedades());
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const data = PropiedadDTO.fromRequest(req.body);
    const yaExiste = await db.propiedadExists(data.code, data.street);
    if (yaExiste) return res.status(409).json({ error: `Ya existe ${data.code} en ${data.street}` });
    const nuevo = await db.createPropiedad({ id: uuid(), ...data });
    await syncUserProperty(nuevo);
    res.status(201).json(PropiedadDTO.toResponse(nuevo));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function update(req, res) {
  try {
    const { code, street, block, owner, tenant, debt, condo } = req.body || {};
    const changes = {
      ...(code   && { code:   code.trim().toUpperCase() }),
      ...(street && { street: street.trim() }),
      ...(block  && { block:  block.trim().toUpperCase() }),
      ...(owner  && { owner }),
      ...(tenant !== undefined && { tenant: tenant || '-' }),
      ...(debt   !== undefined && { debt:   Math.max(0, Number(debt) || 0) }),
      ...(condo  && { condo }),
    };
    const updated = await db.updatePropiedad(req.params.id, changes);
    if (!updated) return res.status(404).json({ error: 'No encontrado' });
    await syncUserProperty(updated);
    res.json(PropiedadDTO.toResponse(updated));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function remove(req, res) {
  try {
    await db.deletePropiedad(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// GET /propiedades/my-property — devuelve la propiedad del usuario logueado
async function getMyProperty(req, res) {
  try {
    const user = await db.getUsuarioById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const propiedades = await db.getPropiedades();
    const propiedad   = propiedades.find(p => p.owner === user.name || p.tenant === user.name);
    if (!propiedad) return res.json({ cargoExtra: 0, notaCargo: '', code: '-', street: '', condo: '' });

    res.json({
      id:             propiedad.id,
      code:           propiedad.code,
      street:         propiedad.street,
      block:          propiedad.block,
      condo:          propiedad.condo,
      expensaMensual: Number(propiedad.expensaMensual) || 0,
      cargoExtra:     Number(propiedad.cargoExtra)     || 0,
      notaCargo:      propiedad.notaCargo              || '',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// PUT /propiedades/:id/cargo-extra — admin pone cargo extra a una propiedad
async function updateCargoExtra(req, res) {
  try {
    const { cargoExtra, notaCargo } = req.body || {};

    if (req.user.role === 'Administrador') {
      const adminUser   = await db.getUsuarioById(req.user.id);
      const propiedades = await db.getPropiedades();
      const propiedad   = propiedades.find(p => String(p.id) === String(req.params.id));
      if (!propiedad || propiedad.condo !== adminUser?.condo) {
        return res.status(403).json({ error: 'Solo podés modificar propiedades de tu condominio' });
      }
    }

    const changes = {
      cargoExtra: Math.max(0, Number(cargoExtra) || 0),
      notaCargo:  notaCargo || '',
    };
    const updated = await db.updatePropiedad(req.params.id, changes);
    if (!updated) return res.status(404).json({ error: 'Propiedad no encontrada' });
    res.json(PropiedadDTO.toResponse(updated));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

module.exports = { getAll, create, update, remove, getMyProperty, updateCargoExtra };
