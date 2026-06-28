-- ================================================================
-- CONDO ADMIN — Schema Supabase PostgreSQL
-- Pegar completo en SQL Editor de Supabase y ejecutar
-- ================================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  email TEXT UNIQUE NOT NULL,
  password TEXT DEFAULT '',
  role TEXT DEFAULT 'Propietario',
  phone TEXT DEFAULT '',
  property TEXT DEFAULT '-',
  condo TEXT DEFAULT 'General'
);

-- Índices para que la paginación (ORDER BY name + filtro por condo/búsqueda)
-- de usuarios sea eficiente a medida que crecen los condominios/residentes.
CREATE INDEX IF NOT EXISTS idx_usuarios_condo ON usuarios (condo);
CREATE INDEX IF NOT EXISTS idx_usuarios_name  ON usuarios (name);

CREATE TABLE IF NOT EXISTS condominios (
  id TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  type TEXT DEFAULT 'Condominio',
  address TEXT DEFAULT '',
  units TEXT DEFAULT '0',
  plan TEXT DEFAULT 'Básico',
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS propiedades (
  id TEXT PRIMARY KEY,
  condo TEXT DEFAULT '',
  code TEXT DEFAULT '',
  street TEXT DEFAULT '',
  block TEXT DEFAULT '',
  owner TEXT DEFAULT '',
  tenant TEXT DEFAULT '-',
  debt NUMERIC DEFAULT 0,
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para que la paginación (ORDER BY code + filtro por condo/búsqueda)
-- de propiedades sea eficiente a medida que crecen los condominios/residentes.
CREATE INDEX IF NOT EXISTS idx_propiedades_condo ON propiedades (condo);
CREATE INDEX IF NOT EXISTS idx_propiedades_code  ON propiedades (code);

-- Cargos extra de una propiedad: itemizados (no un solo número acumulado) para
-- poder agregar varios y editar/borrar cada uno individualmente.
CREATE TABLE IF NOT EXISTS cargos_extra (
  id TEXT PRIMARY KEY,
  propiedad_id TEXT NOT NULL,
  monto NUMERIC DEFAULT 0,
  motivo TEXT DEFAULT '',
  reserva_id TEXT DEFAULT '',
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargos_extra_propiedad ON cargos_extra (propiedad_id);

CREATE TABLE IF NOT EXISTS pagos (
  id TEXT PRIMARY KEY,
  propiedad TEXT DEFAULT '',
  propietario TEXT DEFAULT '',
  resident TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  tipo TEXT DEFAULT 'Expensa',
  monto NUMERIC DEFAULT 0,
  fecha TEXT DEFAULT '',
  estado TEXT DEFAULT 'pendiente',
  referencia TEXT DEFAULT '',
  comprobante TEXT DEFAULT '',
  due_date TEXT DEFAULT '',
  created_by_role TEXT DEFAULT '',
  condo TEXT DEFAULT '',
  motivo TEXT DEFAULT '',
  reserva_id TEXT DEFAULT '',
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla acotada (propiedades x meses): índices para que la paginación
-- (ORDER BY inserted_at DESC + filtro por estado) sea eficiente.
CREATE INDEX IF NOT EXISTS idx_pagos_inserted_at ON pagos (inserted_at DESC);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos (estado);
CREATE INDEX IF NOT EXISTS idx_pagos_condo ON pagos (condo);

CREATE TABLE IF NOT EXISTS anuncios (
  id TEXT PRIMARY KEY,
  title TEXT DEFAULT '',
  message TEXT DEFAULT '',
  condo TEXT DEFAULT 'General',
  target TEXT DEFAULT 'todos',
  created_by_role TEXT DEFAULT '',
  date_label TEXT DEFAULT '',
  author TEXT DEFAULT '',
  category TEXT DEFAULT 'General',
  priority TEXT DEFAULT 'Media',
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de crecimiento continuo: índices para que la paginación
-- (ORDER BY inserted_at DESC + filtro por condo) no se degrade con el tiempo.
CREATE INDEX IF NOT EXISTS idx_anuncios_inserted_at ON anuncios (inserted_at DESC);
CREATE INDEX IF NOT EXISTS idx_anuncios_condo ON anuncios (condo);

CREATE TABLE IF NOT EXISTS asambleas (
  id TEXT PRIMARY KEY,
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  condo TEXT DEFAULT 'General',
  start_date TEXT DEFAULT '',
  due_date TEXT DEFAULT '',
  document_name TEXT DEFAULT '',
  document_path TEXT DEFAULT '',
  created_at TEXT DEFAULT '',
  votes_yes INTEGER DEFAULT 0,
  votes_no INTEGER DEFAULT 0,
  votes_abstencion INTEGER DEFAULT 0,
  user_votes JSONB DEFAULT '{}',
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de crecimiento continuo: índices para que la paginación
-- (ORDER BY inserted_at DESC + filtro por condo) no se degrade con el tiempo.
CREATE INDEX IF NOT EXISTS idx_asambleas_inserted_at ON asambleas (inserted_at DESC);
CREATE INDEX IF NOT EXISTS idx_asambleas_condo ON asambleas (condo);

CREATE TABLE IF NOT EXISTS visitas (
  id TEXT PRIMARY KEY,
  code TEXT DEFAULT '',
  mode TEXT DEFAULT 'peatonal',
  full_name TEXT DEFAULT '',
  id_number TEXT DEFAULT '',
  property TEXT DEFAULT '',
  motive TEXT DEFAULT '',
  plate TEXT DEFAULT '-',
  id_document_name TEXT DEFAULT '',
  plate_photo_name TEXT DEFAULT '',
  id_document_front_path TEXT DEFAULT '',
  id_document_back_path TEXT DEFAULT '',
  plate_photo_path TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT '',
  status TEXT DEFAULT 'Activo',
  expires_at DATE DEFAULT NULL,
  condo TEXT DEFAULT '',
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitas_condo ON visitas (condo);

CREATE TABLE IF NOT EXISTS historial_visitas (
  id TEXT PRIMARY KEY,
  visitante TEXT DEFAULT '',
  cedula TEXT DEFAULT '',
  propiedad TEXT DEFAULT '',
  tipo TEXT DEFAULT 'Entrada',
  placa TEXT DEFAULT '-',
  fecha TEXT DEFAULT '',
  entrada TEXT DEFAULT '',
  salida TEXT DEFAULT '-',
  motivo TEXT DEFAULT '',
  guard TEXT DEFAULT '',
  condo TEXT DEFAULT '',
  visita_id TEXT DEFAULT '',
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historial_visitas_visita_id ON historial_visitas (visita_id);

-- Tabla de crecimiento continuo: índices para que la paginación
-- (ORDER BY inserted_at DESC + filtro por tipo) no se degrade con el tiempo.
CREATE INDEX IF NOT EXISTS idx_historial_visitas_inserted_at ON historial_visitas (inserted_at DESC);
CREATE INDEX IF NOT EXISTS idx_historial_visitas_tipo ON historial_visitas (tipo);
CREATE INDEX IF NOT EXISTS idx_historial_visitas_condo ON historial_visitas (condo);

CREATE TABLE IF NOT EXISTS panic_alerts (
  id TEXT PRIMARY KEY,
  resident TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  condo TEXT DEFAULT '',
  status TEXT DEFAULT 'Pendiente',
  created_at TEXT DEFAULT '',
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reset_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  token TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  used BOOLEAN DEFAULT FALSE
);
