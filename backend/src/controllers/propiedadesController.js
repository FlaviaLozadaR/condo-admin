const { v4: uuid } = require('uuid');
const db  = require('../data/db');
const PropiedadDTO = require('../dto/propiedadDto');

// Nombres del propietario + todos los inquilinos de una propiedad
function propertyMemberNames(propiedad) {
  const names = new Set();
  if (propiedad.owner && propiedad.owner !== '-') names.add(propiedad.owner);
  if (Array.isArray(propiedad.tenants)) {
    propiedad.tenants.filter(t => t && t !== '-').forEach(t => names.add(t));
  } else if (propiedad.tenant && propiedad.tenant !== '-') {
    names.add(propiedad.tenant);
  }
  return names;
}

// Un inquilino solo puede estar asignado a una propiedad a la vez.
// Devuelve el primer nombre en conflicto (ya inquilino de otra propiedad), o null.
async function findTenantConflict(tenantsList, excludeId) {
  if (!tenantsList?.length) return null;
  const propiedades = await db.getPropiedades();
  for (const p of propiedades) {
    if (excludeId && String(p.id) === String(excludeId)) continue;
    const existing = Array.isArray(p.tenants)
      ? p.tenants.filter(t => t && t !== '-')
      : (p.tenant && p.tenant !== '-' ? [p.tenant] : []);
    const conflict = tenantsList.find(t => existing.includes(t));
    if (conflict) return conflict;
  }
  return null;
}

// Actualiza el campo `property` del usuario cuando se le asigna una propiedad.
// Si se pasa `before` (estado previo de la propiedad), también limpia el
// campo `property` de quienes fueron quitados como propietario/inquilino.
async function syncUserProperty(propiedad, before = null) {
  const label = `${propiedad.street} - ${propiedad.code}`;
  try {
    const newNames = propertyMemberNames(propiedad);
    const usuarios = await db.getUsuarios();

    for (const name of newNames) {
      const usuario = usuarios.find(u => u.name === name);
      if (usuario) await db.updateUsuario(usuario.id, { property: label }).catch(() => {});
    }

    if (before) {
      const oldLabel = `${before.street} - ${before.code}`;
      for (const name of propertyMemberNames(before)) {
        if (newNames.has(name)) continue;
        const usuario = usuarios.find(u => u.name === name);
        if (usuario && usuario.property === oldLabel) {
          await db.updateUsuario(usuario.id, { property: '-' }).catch(() => {});
        }
      }
    }
  } catch { /* no bloquear si falla */ }
}

async function getAll(req, res) {
  try {
    const { page, limit, q } = req.query;
    // Administrador/Seguridad solo ven su propio condominio, sin importar lo que mande el cliente.
    const condo = req.user.role === 'Super Admin' ? (req.query.condo || undefined) : req.user.condo;
    if (page) {
      const result = await db.getPropiedadesPaged({
        page:  Math.max(1, parseInt(page) || 1),
        limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
        q, condo,
      });
      return res.json({ ...result, data: result.data.map(PropiedadDTO.toResponse) });
    }
    res.json(await db.getPropiedades(condo));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const data = PropiedadDTO.fromRequest(req.body);
    // Administrador solo puede crear propiedades en su propio condominio.
    if (req.user.role !== 'Super Admin') data.condo = req.user.condo;
    const yaExiste = await db.propiedadExists(data.code, data.street);
    if (yaExiste) return res.status(409).json({ error: `Ya existe ${data.code} en ${data.street}` });
    const tenantConflict = await findTenantConflict(data.tenants);
    if (tenantConflict) return res.status(409).json({ error: `${tenantConflict} ya es inquilino de otra propiedad` });
    const nuevo = await db.createPropiedad({ id: uuid(), ...data });
    await syncUserProperty(nuevo);
    res.status(201).json(PropiedadDTO.toResponse(nuevo));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function update(req, res) {
  try {
    const { code, street, block, owner, tenant, tenants, debt, condo } = req.body || {};
    const before = (await db.getPropiedades()).find(p => String(p.id) === String(req.params.id));
    if (!before) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'Super Admin' && before.condo !== req.user.condo) {
      return res.status(403).json({ error: 'No autorizado para este condominio' });
    }
    const tenantsList = Array.isArray(tenants)
      ? tenants.map(t => (t || '').trim()).filter(t => t && t !== '-')
      : undefined;
    if (tenantsList !== undefined) {
      const tenantConflict = await findTenantConflict(tenantsList, req.params.id);
      if (tenantConflict) return res.status(409).json({ error: `${tenantConflict} ya es inquilino de otra propiedad` });
    }
    const changes = {
      ...(code   && { code:   code.trim().toUpperCase() }),
      ...(street && { street: street.trim() }),
      ...(block  && { block:  block.trim().toUpperCase() }),
      ...(owner  && { owner }),
      ...(tenantsList !== undefined
        ? { tenants: tenantsList, tenant: tenantsList[0] || '-' }
        : (tenant !== undefined && { tenant: tenant || '-' })),
      ...(debt   !== undefined && { debt:   Math.max(0, Number(debt) || 0) }),
      // Solo Super Admin puede reasignar el condominio de una propiedad.
      ...(req.user.role === 'Super Admin' && condo && { condo }),
    };
    const updated = await db.updatePropiedad(req.params.id, changes);
    if (!updated) return res.status(404).json({ error: 'No encontrado' });
    await syncUserProperty(updated, before);
    res.json(PropiedadDTO.toResponse(updated));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function remove(req, res) {
  try {
    const propiedad = await db.getPropiedades().then(rows => rows.find(p => String(p.id) === String(req.params.id)));
    if (!propiedad) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'Super Admin' && propiedad.condo !== req.user.condo) {
      return res.status(403).json({ error: 'No autorizado para este condominio' });
    }
    await db.deletePropiedad(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// GET /propiedades/my-property — devuelve la propiedad del usuario logueado
async function getMyProperty(req, res) {
  try {
    const user = await db.getUsuarioById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const propiedades = await db.getPropiedades(user.condo);
    const propiedad   = propiedades.find(p =>
      p.owner === user.name ||
      (Array.isArray(p.tenants) ? p.tenants.includes(user.name) : p.tenant === user.name)
    );
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

// GET /propiedades/my-properties — todas las propiedades donde el usuario
// logueado es propietario o inquilino (para restringir el pre-registro de
// visitas a sus propias propiedades).
async function getMyProperties(req, res) {
  try {
    const user = await db.getUsuarioById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const propiedades = await db.getPropiedades(user.condo);
    const mine = propiedades.filter(p =>
      p.owner === user.name ||
      (Array.isArray(p.tenants) ? p.tenants.includes(user.name) : p.tenant === user.name)
    );
    res.json(mine.map(p => ({
      id:     p.id,
      code:   p.code,
      street: p.street,
      condo:  p.condo,
      label:  `${p.street} - ${p.code}`,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// PUT /propiedades/:id/cargo-extra — admin suma un cargo extra a una propiedad
// (se acumula sobre lo que ya tenía, igual que la expensa — no lo reemplaza)
async function updateCargoExtra(req, res) {
  try {
    const { cargoExtra, notaCargo } = req.body || {};

    const propiedades = await db.getPropiedades();
    const propiedad    = propiedades.find(p => String(p.id) === String(req.params.id));
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });

    if (req.user.role === 'Administrador') {
      const adminUser = await db.getUsuarioById(req.user.id);
      if (propiedad.condo !== adminUser?.condo) {
        return res.status(403).json({ error: 'Solo podés modificar propiedades de tu condominio' });
      }
    }

    const montoNum = Math.max(0, Number(cargoExtra) || 0);
    const changes = {
      cargoExtra: (Number(propiedad.cargoExtra) || 0) + montoNum,
      notaCargo:  [propiedad.notaCargo, notaCargo].filter(Boolean).join(' · '),
    };
    const updated = await db.updatePropiedad(req.params.id, changes);
    if (!updated) return res.status(404).json({ error: 'Propiedad no encontrada' });
    res.json(PropiedadDTO.toResponse(updated));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

module.exports = { getAll, create, update, remove, getMyProperty, getMyProperties, updateCargoExtra };
