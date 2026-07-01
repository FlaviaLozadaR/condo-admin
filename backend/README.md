# Condo Admin — Backend

API REST del sistema de administración de condominios. Construida con Node.js + Express, usa Supabase como base de datos PostgreSQL y almacenamiento de archivos. Sirve tanto la app web (React/Vite) como la app móvil (Capacitor Android/iOS).

---

## Índice

1. [Stack y dependencias](#stack-y-dependencias)
2. [Estructura de carpetas](#estructura-de-carpetas)
3. [Cómo correr el proyecto](#cómo-correr-el-proyecto)
4. [Variables de entorno](#variables-de-entorno)
5. [server.js — punto de entrada](#serverjs--punto-de-entrada)
6. [Middleware de autenticación y roles](#middleware-de-autenticación-y-roles)
7. [Capa de datos — db.js](#capa-de-datos--dbjs)
8. [Controladores](#controladores)
9. [Rutas y endpoints (todos los 45)](#rutas-y-endpoints)
10. [DTOs — validación y transformación](#dtos--validación-y-transformación)
11. [Servicios](#servicios)
12. [Swagger / Documentación interactiva](#swagger--documentación-interactiva)
13. [Esquema de la base de datos](#esquema-de-la-base-de-datos)
14. [Modelo de seguridad y multi-tenancy](#modelo-de-seguridad-y-multi-tenancy)
15. [Manejo de archivos (Supabase Storage)](#manejo-de-archivos-supabase-storage)
16. [Despliegue en Render](#despliegue-en-render)

---

## Stack y dependencias

| Paquete | Versión | Para qué se usa |
|---|---|---|
| `express` | 4.18 | Framework HTTP |
| `@supabase/supabase-js` | 2.105 | Cliente de Supabase (DB + Storage) |
| `bcryptjs` | 2.4 | Hash de contraseñas |
| `jsonwebtoken` | 9.0 | Firma y verificación de tokens JWT |
| `multer` | 2.1 | Parseo de `multipart/form-data` (subida de archivos) |
| `uuid` | 9.0 | Generación de IDs únicos (v4) |
| `helmet` | 8.1 | Cabeceras de seguridad HTTP |
| `cors` | 2.8 | Control de orígenes permitidos |
| `express-rate-limit` | 8.3 | Límite de peticiones por IP |
| `morgan` | 1.10 | Logging de cada request en consola |
| `dotenv` | 17.4 | Carga de `.env` en `process.env` |
| `swagger-jsdoc` | 6.3 | Genera el spec OpenAPI 3.0 a partir de JSDoc en los archivos de rutas |
| `swagger-ui-express` | 5.0 | Sirve la UI interactiva en `/api-docs` |

**Node requerido:** `>= 18` (se usa `node --watch` para desarrollo, que es nativo desde Node 18).

---

## Estructura de carpetas

```
backend/
├── server.js                        # Punto de entrada — monta middleware, rutas y swagger
├── package.json
├── .env                             # Variables de entorno (nunca en git)
├── .env.example                     # Plantilla con las claves necesarias
├── schema.sql                       # Esquema completo de la DB (ejecutar en Supabase SQL Editor)
├── public/
│   ├── index.html                   # Panel admin HTML (sirve como SPA estática)
│   └── reset-password.html          # Página de reseteo de contraseña (inyecta FRONTEND_URL)
├── uploads/                         # Documentos de asambleas subidos localmente (desarrollo)
└── src/
    ├── swagger.js                   # Configuración del spec OpenAPI 3.0.3
    ├── controllers/                 # Lógica de negocio (12 archivos, uno por entidad)
    │   ├── authController.js
    │   ├── condominiosController.js
    │   ├── usuariosController.js
    │   ├── propiedadesController.js
    │   ├── pagosController.js
    │   ├── anunciosController.js
    │   ├── asambleasController.js
    │   ├── visitasController.js
    │   ├── historialController.js
    │   ├── panicController.js
    │   ├── areasSocialesController.js
    │   └── reservasAreasController.js
    ├── routes/                      # Definición de rutas Express + comentarios @swagger (12 archivos)
    │   ├── auth.js
    │   ├── condominios.js
    │   ├── usuarios.js
    │   ├── propiedades.js
    │   ├── pagos.js
    │   ├── anuncios.js
    │   ├── asambleas.js
    │   ├── visitas.js
    │   ├── historial.js
    │   ├── panic.js
    │   ├── areasSociales.js
    │   └── reservasAreas.js
    ├── middleware/
    │   └── auth.js                  # requireAuth, requireRole, requireMinLevel, requireSelfOrAdmin
    ├── data/
    │   └── db.js                    # Supabase client wrapper — todas las queries
    ├── dto/                         # Data Transfer Objects (validación entrada / formato salida)
    │   ├── userDto.js
    │   ├── condominioDto.js
    │   ├── propiedadDto.js
    │   ├── pagoDto.js
    │   ├── anuncioDto.js
    │   └── ... (uno por entidad)
    └── services/
        ├── mailer.js                # Envío de emails via Brevo (transaccional)
        ├── supabase.js              # Funciones de Storage (upload, signed URL, delete)
        └── dashboard.js            # Cálculo de KPIs para el dashboard
```

---

## Cómo correr el proyecto

```bash
cd backend
npm install

# Copiar las variables de entorno y completarlas
cp .env.example .env

# Desarrollo (recarga automática con Node --watch)
npm run dev

# Producción
npm start
```

El servidor arranca en `http://localhost:3001` (o el puerto en `PORT`). Al iniciar imprime:

```
✓ Backend corriendo en http://localhost:3001
✓ Entorno: development
✓ Email:   tu@email.com
✓ Docs:    http://localhost:3001/api-docs
```

Si faltan variables de entorno requeridas, el proceso termina con un error claro antes de arrancar.

---

## Variables de entorno

Archivo `.env` en la raíz de `backend/`. **Nunca subir a git.**

| Variable | Requerida | Descripción |
|---|---|---|
| `JWT_SECRET` | Sí | Clave secreta para firmar/verificar tokens JWT (mínimo 32 caracteres aleatorios) |
| `BREVO_API_KEY` | Sí | API Key de Brevo (ex-Sendinblue) para envío de emails transaccionales |
| `BREVO_SENDER_EMAIL` | Sí | Email remitente verificado en Brevo |
| `SUPABASE_URL` | Sí | URL del proyecto Supabase (ej: `https://xyz.supabase.co`) |
| `SUPABASE_SECRET_KEY` | Sí | `service_role` key de Supabase (NO la `anon` key — necesita acceso completo a la DB) |
| `FRONTEND_URL` | No | URL del frontend React (ej: `http://localhost:5173`). Usada en CORS y en links de emails |
| `APP_URL` | No | URL pública del backend (ej: `https://condo-backend-o5av.onrender.com`). Usada en links de QR |
| `PORT` | No | Puerto del servidor (default: 3001) |
| `NODE_ENV` | No | `development` o `production` |

---

## server.js — punto de entrada

Archivo: `backend/server.js` (127 líneas)

### Validación de variables de entorno al arranque

Lo primero que hace es verificar que `JWT_SECRET`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `SUPABASE_URL` y `SUPABASE_SECRET_KEY` existan. Si falta alguna, llama a `process.exit(1)` con un mensaje claro. Esto evita que el servidor arranque "silenciosamente roto".

### Middleware global (en orden de aplicación)

1. **`app.set('trust proxy', 1)`** — Le dice a Express que confíe en el primer proxy inverso (Render, Heroku, etc.). Sin esto, `express-rate-limit` ve la IP del proxy en lugar de la IP real del usuario y aplica el rate limit a todo el mundo por igual.

2. **`helmet(...)`** — Añade cabeceras de seguridad HTTP estándar (X-Frame-Options, X-Content-Type-Options, HSTS, etc.). Se desactiva `contentSecurityPolicy` porque el panel admin (`public/index.html`) tiene scripts inline que CSP bloquearía. La seguridad de la API sigue intacta via JWT.

3. **`cors(...)`** — Lista de orígenes permitidos calculada dinámicamente desde las variables de entorno:
   - `FRONTEND_URL` (app web React)
   - `APP_URL` (el panel admin se sirve desde el propio backend)
   - `http://localhost:3001` y `http://localhost:4173` (desarrollo local)
   - `https://localhost` (Capacitor Android)
   - `capacitor://localhost` (Capacitor iOS)
   Cualquier origen no listado recibe un 403.

4. **`express-rate-limit`** — Límite global de 2000 requests por IP cada 15 minutos. Las rutas de auth tienen su propio rate limit más estricto (30 req / 5 min, configurado en `src/routes/auth.js`).

5. **`morgan`** — Logging de cada request al formato `[fecha] MÉTODO /ruta STATUS tiempo-ms`.

6. **`express.json({ limit: '1mb' })`** — Parseo de JSON. Limita el body a 1 MB para evitar ataques de payload gigante.

### Rutas especiales antes del router

- **`GET /reset-password.html`** — Sirve el HTML de reseteo de contraseña inyectando `FRONTEND_URL` en el template (reemplaza `{{FRONTEND_URL}}`). Esto permite que el link del email apunte al frontend correcto según el entorno.
- **`express.static('public')`** — Sirve el panel admin estático.
- **`/uploads`** — Sirve archivos locales subidos (solo en desarrollo; en producción van a Supabase Storage).
- **`/api-docs`** — UI interactiva de Swagger.
- **`/api-docs.json`** — El spec OpenAPI en JSON crudo (para importar en Postman).

### Montaje de routers

Todos los routers de la API se montan bajo `/api/`:

```
/api/auth              → src/routes/auth.js
/api/condominios       → src/routes/condominios.js
/api/usuarios          → src/routes/usuarios.js
/api/propiedades       → src/routes/propiedades.js
/api/pagos             → src/routes/pagos.js
/api/anuncios          → src/routes/anuncios.js
/api/asambleas         → src/routes/asambleas.js
/api/visitas           → src/routes/visitas.js
/api/historial-visitas → src/routes/historial.js
/api/panic             → src/routes/panic.js
/api/areas-sociales    → src/routes/areasSociales.js
/api/reservas-areas    → src/routes/reservasAreas.js
```

- **`GET /api/health`** — Endpoint de healthcheck, responde `{ ok: true, ts: "..." }`. Render lo usa para saber si el servicio está vivo.

### Manejadores de error

- **404 handler** — Cualquier ruta no reconocida responde `{ error: "Ruta no encontrada: METHOD /path" }`.
- **Global error handler** — Captura errores lanzados por middlewares o controladores. Si el error viene del CORS (origen no permitido) responde 403; si no, responde 500 con el mensaje del error.

---

## Middleware de autenticación y roles

Archivo: `src/middleware/auth.js`

### Jerarquía de roles

```
Super Admin  (nivel 5) → acceso total a todos los condominios
Administrador (nivel 4) → acceso total a su propio condominio
Propietario   (nivel 3) → solo sus propiedades y datos personales
Inquilino     (nivel 3) → igual que Propietario
Seguridad     (nivel 2) → registro de visitas e historial de su condominio
```

### `requireAuth(req, res, next)`

1. Verifica que el header `Authorization: Bearer <token>` esté presente.
2. Verifica la firma del JWT con `JWT_SECRET`. Si el token expiró, devuelve `{ error: "...", expired: true }` — el frontend detecta ese flag para mostrar el mensaje correcto.
3. **Clave importante**: el payload del JWT solo contiene el `id` del usuario. El rol y el condominio se leen **frescos desde la base de datos en cada pedido** (`db.getUsuarioById(payload.id)`). Esto garantiza que si un admin cambia el rol de un usuario o lo mueve a otro condominio, el cambio se refleja en la próxima request, sin esperar a que el token expire ni pedirle al usuario que vuelva a loguearse.
4. Pone `req.user = { id, role, condo }` para que los controladores lo usen.

### `requireRole(...roles)`

Middleware factory que acepta una lista de roles permitidos. Si `req.user.role` no está en esa lista, responde 403. Ejemplo de uso en una ruta:

```js
router.get('/', requireAuth, requireRole('Super Admin', 'Administrador'), ctrl.getAll);
```

### `requireMinLevel(level)`

Alternativa numérica a `requireRole` para cuando la lógica es jerárquica ("nivel mínimo X"). Por ejemplo, `requireMinLevel(4)` permite Super Admin y Administrador.

### `requireSelfOrAdmin(req, res, next)`

Permite la acción si el usuario es admin/super admin, O si el `req.params.id` coincide con su propio `req.user.id`. Usado en rutas como cambiar contraseña o ver el propio perfil.

---

## Capa de datos — db.js

Archivo: `src/data/db.js` (678 líneas)

Este archivo es el único punto de contacto con Supabase. Todos los controladores importan funciones de aquí, nunca llaman al cliente de Supabase directamente.

### Conversión camelCase ↔ snake_case

Supabase devuelve las columnas en `snake_case` (ej: `inserted_at`, `propiedad_id`). La app usa `camelCase` (ej: `insertedAt`, `propiedadId`). La conversión es automática con dos funciones:

```js
const toCamel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const toSnake = s => s.replace(/([A-Z])/g, '_$1').toLowerCase();

const rowToApp = row => Object.fromEntries(
  Object.entries(row).map(([k, v]) => [toCamel(k), v])
);

const appToRow = (obj, exclude = []) => Object.fromEntries(
  Object.entries(obj)
    .filter(([k, v]) => v !== undefined && !exclude.includes(k) && k !== 'insertedAt')
    .map(([k, v]) => [toSnake(k), v])
);
```

`appToRow` excluye automáticamente `insertedAt` (se deja a la DB que lo genere con `NOW()`), y cualquier clave pasada en `exclude`.

### Helper `q(promise)`

```js
async function q(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}
```

Convierte el patrón `{ data, error }` de Supabase en un throw estándar. Evita repetir el chequeo de error en cada query.

### Funciones por entidad

#### USUARIOS
- `getUsuarios(condo)` — Lista todos, filtrado por condominio.
- `getUsuarioById(id)` — Busca por ID. Devuelve `null` si no existe (código de error `PGRST116` = not found).
- `getUsuarioByEmail(email)` — Busca por email (siempre en minúsculas para evitar duplicados por case).
- `createUsuario(data)`, `updateUsuario(id, changes)`, `deleteUsuario(id)` — CRUD estándar.
- `getSeguridadContacts(condo)` — Lista mínima (id, nombre, teléfono) del personal de Seguridad, para que los residentes puedan llamarlos desde el botón de pánico.
- `getUsuariosPaged({ page, limit, q, condo, role })` — Paginación con filtros de búsqueda por nombre/email, condominio y rol. Devuelve `{ data, total, page, pageSize, totalPages }`.

#### CONDOMINIOS
- `getCondominios(condo)` — Si `condo` se pasa, filtra por nombre exacto. Si no, devuelve todos.
- `createCondominio(data)`, `deleteCondominio(id)` — CRUD.
- `updateCondominio(id, changes)` — Si el campo `name` cambia, llama automáticamente a `cascadeCondoRename(oldName, newName)`.
- `cascadeCondoRename(oldName, newName)` — Actualiza el campo `condo` en las 10 tablas que lo tienen denormalizado: `usuarios`, `propiedades`, `anuncios`, `asambleas`, `areas_sociales`, `reservas_areas`, `pagos`, `visitas`, `historial_visitas`, `panic_alerts`. Sin esto, al renombrar un condominio todas sus filas quedan huérfanas (no aparecen en ningún filtro).

#### PROPIEDADES

**Ordenamiento natural:** Las propiedades se ordenan con `sortPropiedades`, que usa `naturalCompare`. El ordenamiento natural entiende que "A-10" va después de "A-2", no antes (como haría un sort lexicográfico estándar). Dentro del mismo condominio, ordena primero por calle (alfabético) y luego por código (numérico natural).

**Cargos extra:** Los cargos extra NO se guardan en la tabla `propiedades`. Están en su propia tabla `cargos_extra` (uno por cargo). Las funciones `getCargosExtraByPropiedadIds(ids)` + `attachCargosExtra(propiedades, cargosMap)` los calculan y agregan a cada propiedad antes de devolver la respuesta:
- `cargoExtra` = suma de todos los `monto` de la propiedad.
- `notaCargo` = los `motivo` de cada cargo, concatenados con ` · `.
- `cargosExtraList` = el array completo de ítems para mostrarlo en el modal de gestión.

Funciones de cargos extra:
- `createCargoExtra(data)` — Crea un cargo. El campo `reservaId` lo vincula a una reserva específica.
- `updateCargoExtraItem(id, changes)`, `deleteCargoExtraItem(id)` — Edición/borrado individual.
- `deleteCargosExtraByReservaId(reservaId)` — Borra todos los cargos vinculados a una reserva. Se llama al aprobar el pago de tipo "Reserva".
- `deleteCargosExtraByPropiedadId(propiedadId)` — Borra todos los cargos de una propiedad. Se llama al aprobar el pago de tipo "Expensa".

- `getPropiedadesPaged({ page, limit, q, condo })` — La paginación se hace en memoria (no en la DB) porque el ordenamiento natural no se puede delegar a PostgreSQL sin extensiones. Trae todas las propiedades, las ordena, y luego recorta la página.

#### PAGOS
- `getPagosPaged({ page, limit, estado, q, condo, tipo })` — Junto con la página de datos, corre 4 queries en paralelo para devolver los KPIs: `totalPendientes`, `totalAprobados`, `totalRechazados` y `approvedPaymentsTotal` (suma de montos aprobados). Esto evita que el frontend tenga que hacer requests separados para los contadores.
- `updatePagoEstado(id, estado)` — Solo actualiza el estado.
- `updatePago(id, changes)` — Actualiza cualquier campo del pago (usado para ajustar el monto y guardar `saldoRestante`).

#### ASAMBLEAS

Las asambleas tienen lógica especial para los votos:

```js
const asambleaFromRow = row => {
  const r = rowToApp(row);
  r.votes = { favor: r.votesYes || 0, contra: r.votesNo || 0, abstencion: r.votesAbstencion || 0 };
  r.userVotesJSON = JSON.stringify(r.userVotes || {});
  return r;
};
```

La tabla guarda `votes_yes`, `votes_no`, `votes_abstencion` (contadores) y `user_votes` (objeto JSON `{ userId: tipoVoto }`). `asambleaFromRow` los transforma al formato que usa el frontend.

- `voteAsamblea(id, tipo, userId)` — Lógica de votación:
  1. Busca la asamblea.
  2. Verifica que la fecha de cierre no haya pasado (considera las 23:59:59 del día de cierre).
  3. Si el usuario ya votó, resta su voto anterior.
  4. Agrega el nuevo voto.
  5. Actualiza la asamblea con los nuevos contadores y el mapa de votos.

#### VISITAS

- `getVisitaByCode(code)` — Búsqueda por el código QR único. Usado por el endpoint de verificación que escanea el guardia.
- `attachVisitaDocFlags(historialRows)` — Función especial que enriquece filas de historial con flags de documentos. Toma un array de filas de historial, extrae los `visitaId` únicos, hace una sola query a `visitas` para traer las columnas de paths de documentos, y devuelve las filas originales con tres booleanos adicionales: `hasIdDocumentFront`, `hasIdDocumentBack`, `hasPlatePhoto`. Esto permite al frontend mostrar el botón "Ver documentos" solo en las filas que tienen fotos, sin tener que cargar las fotos en sí.

#### HISTORIAL

- `getHistorialPaged(...)` — Además de la página paginada, corre 3 queries en paralelo para contar visitas del mes actual (total, peatonales, vehiculares). Luego llama a `attachVisitaDocFlags` en los resultados antes de devolverlos.

#### RESET TOKENS
- `createResetToken(token, email, expiresAt)`, `getResetToken(token)`, `markTokenUsed(token)` — Flujo de recuperación de contraseña. El token se busca solo si `used = false`.

#### DASHBOARD
- `getDataForDashboard(condo)` — Corre 5 queries en paralelo (propiedades, pagos, visitas, historial, panic) y devuelve todo junto. Usado en el login para precalcular el dashboard.

---

## Controladores

Cada controlador importa `db.js`, un DTO, y los servicios que necesita (mailer, supabase storage). La lógica de negocio vive aquí; `db.js` solo hace las queries.

### `authController.js`

**`login(req, res)`**
1. Valida que `email` y `password` estén presentes.
2. Busca el usuario por email (case-insensitive, `getUsuarioByEmail`).
3. Verifica la contraseña con `bcryptjs.compare`.
4. Firma un JWT que solo contiene `{ id }` con expiración de 24h.
5. Calcula los datos del dashboard llamando a `getDataForDashboard` + `computeDashboard`.
6. Devuelve `{ token, user, dashboard }`.

**`forgotPassword(req, res)`**
1. Busca el usuario por email.
2. Si existe: genera un token aleatorio con `crypto.randomBytes(32)`, lo guarda en `reset_tokens` con expiración en 1 hora, envía el email via `mailer.sendResetEmail(email, token)`.
3. Siempre responde `{ ok: true }` aunque el email no exista, para no revelar qué cuentas hay.

**`resetPassword(req, res)`**
1. Valida que `token` y `password` (mínimo 8 caracteres) estén presentes.
2. Busca el token en `reset_tokens` (solo si `used = false`).
3. Verifica que no haya expirado.
4. Hashea la nueva contraseña con `bcryptjs.hash(..., 10)`.
5. Actualiza el usuario y marca el token como usado.

### `condominiosController.js`

- **`getAll`** — Super Admin ve todos. Administrador ve solo el suyo (filtra por `req.user.condo`).
- **`create`** — Solo Super Admin. Valida nombre único.
- **`update`** — Solo Super Admin. Si cambia el nombre, `db.updateCondominio` propaga el cambio a las 10 tablas.
- **`remove`** — Solo Super Admin.
- **`getMyCondoPaymentQr`** — Genera una URL firmada de 6 horas para el QR de pago del condominio del usuario logueado. El QR es la imagen que los residentes escanean para saber a dónde transferir el dinero.
- **`uploadPaymentQr`** — Sube la imagen del QR a Supabase Storage y guarda el path en el condominio.
- **`deletePaymentQr`** — Borra la imagen del Storage y limpia el path.
- **`asignarExpensas`** — Asigna el mismo monto de expensa mensual a un conjunto de propiedades (array de IDs). Útil para asignación masiva.

### `usuariosController.js`

- **`getAll`** / **`getAllPaged`** — Super Admin ve todos; Administrador solo los de su condominio.
- **`create`** — Hashea la contraseña antes de guardar. Valida email único. Si el rol es Administrador o inferior, el `condo` lo pone automáticamente al del admin creador (un admin no puede crear usuarios en otro condominio).
- **`update`** — Misma lógica de scope por condominio.
- **`remove`** — No permite que un usuario se borre a sí mismo.
- **`changePassword`** — El usuario puede cambiar la suya propia; un admin puede cambiar la de cualquier usuario de su condominio (sin pedir la contraseña actual en ese caso).
- **`getSeguridad`** — Lista solo el personal de Seguridad del condominio. Endpoint público para el componente de botón de pánico.

### `propiedadesController.js`

- **`getAll`** / **`getAllPaged`** — Filtra por condominio del usuario.
- **`create`** — Valida que no exista otra propiedad con el mismo código y calle.
- **`getMyProperty`** / **`getMyProperties`** — El residente consulta la(s) propiedad(es) donde es propietario o inquilino.
- **`addCargoExtra(req, res)`** — Crea un cargo extra en la tabla `cargos_extra`.
- **`updateCargoExtra(req, res)`** — Edita un cargo extra existente (monto y/o motivo).
- **`deleteCargoExtra(req, res)`** — Borra un cargo extra. Verifica que pertenezca al condominio del admin.

### `pagosController.js`

- **`getAll`** / **`getAllPaged`** — Filtra por condominio y acepta `?estado=pendiente|aprobado|rechazado` y `?tipo=Expensa|Reserva`.
- **`create`** — El comprobante de pago (imagen/PDF) se sube a Supabase Storage via `multer.memoryStorage()` + `uploadFile(...)`. Guarda el path relativo en el campo `comprobante`.
- **`updateStatus(req, res)`** — La operación más compleja del sistema:
  1. Actualiza el estado del pago (`pendiente` → `aprobado` o `rechazado`).
  2. Si el nuevo estado es `aprobado`:
     - Si `tipo === 'Reserva'`: llama a `deleteCargosExtraByReservaId(pago.reservaId)` para limpiar el cargo extra generado cuando la reserva fue cobrada.
     - Si `tipo === 'Expensa'`: llama a `deleteCargosExtraByPropiedadId(pago.propiedadId)` para limpiar todos los cargos extra (expensa pagada cubre los extras también).
     - Re-fetcha la propiedad actualizada (con los cargos extra ya eliminados).
  3. Genera una URL firmada para el comprobante (`withSignedComprobante`).
  4. Devuelve `{ ...pago, propiedadActualizada }` — el frontend aplica el parche inmediatamente sin necesidad de recargar todas las propiedades.

### `anunciosController.js`

- **`getAll`** — Filtra por `target` según el rol del usuario. Un inquilino solo ve anuncios con `target = 'todos'` o `target = 'inquilinos'`. Un Administrador ve los suyos más los del Super Admin dirigidos a `todos`.
- **`create`** / **`update`** / **`remove`** — Solo Admin y Super Admin pueden crear/editar/borrar.

### `asambleasController.js`

- **`create`** / **`update`** — Aceptan `multipart/form-data` porque pueden incluir un documento adjunto (PDF, imagen). El archivo se sube a Supabase Storage.
- **`vote`** — Llama a `db.voteAsamblea`. Si el voto es después de la fecha de cierre, devuelve 400.
- **`getDocument`** — Genera una URL firmada (5 minutos) para el documento adjunto de la asamblea.

### `visitasController.js`

Las visitas son los "pases QR" que pre-registran los residentes para sus visitas.

- **`create`** — Acepta `multipart/form-data` con hasta 3 archivos: foto del frente del carnet, foto del dorso, foto de la placa del vehículo. Genera un `code` único (UUID v4) que será el contenido del QR.
- **`verify(req, res)`** — El endpoint que escanea el guardia. Busca la visita por `code`, devuelve sus datos (nombre, propiedad, motivo, modo, placa, estado). El frontend decide si es ingreso o salida según el estado actual.
- **`updateStatus`** — Cambia el estado: `Pendiente` → `Registrado` (primer escaneo = ingreso) → `Completado` (segundo escaneo = salida). También puede pasar a `Cancelado`.
- **`getDocument`** — Genera una URL firmada para ver la foto del carnet (frente, dorso) o de la placa.
- **`deleteDocument`** — Borra una foto específica del Storage y limpia el path en la visita.

### `historialController.js`

- **`getAll`** / **`getAllPaged`** — Filtra por tipo (peatonal/vehicular), texto libre (nombre, cédula, placa) y condominio. Los resultados vienen con los flags `hasIdDocumentFront`/`hasIdDocumentBack`/`hasPlatePhoto` adjuntos.
- **`create`** — Registro manual de ingreso (sin QR). Puede incluir `visitaId` para vincularlo a un pase QR existente.
- **`updateSalida`** — Registra la hora de salida en un registro existente.
- **`getMyVisits`** — Para residentes. Filtra el historial por las propiedades donde el usuario es propietario o inquilino.

### `panicController.js`

- **`create`** — Cualquier rol puede crear una alerta de pánico. Queda en estado "Pendiente".
- **`updateStatus`** — Solo Admin y Seguridad pueden marcarla como "Atendida".

### `areasSocialesController.js`

- **`create`** / **`update`** — Aceptan hasta 6 imágenes por área. Las imágenes se suben a Supabase Storage. En `update`, el cliente envía `imagenesActuales` (JSON array con las URLs que quiere conservar); las que no estén en esa lista se borran del Storage.
- **`getAll`** — Los residentes solo ven áreas activas (`activo = true`). Los admins ven todas.

### `reservasAreasController.js`

- **`create`** — Valida que no haya conflicto de horario con otra reserva no rechazada de la misma área. Si la reserva es por día completo (00:00-23:59), bloquea todo el día.
- **`updateEstado`** — Aprueba o rechaza la reserva. Si el área tiene costo y no fue cobrada todavía, no permite aprobar.
- **`cobrar`** — Marca la reserva como cobrada y crea un cargo extra en la propiedad del propietario que reservó, referenciando el `id` de la reserva (`reservaId`) en el cargo extra. Este link es el que permite limpiar el cargo cuando se aprueba el pago.
- **`requestCambio`** — El residente puede solicitar un cambio de fecha/horario. Queda pendiente en el campo `solicitudCambio` de la reserva.
- **`responderCambio`** — El admin aprueba o rechaza la solicitud. Si aprueba, actualiza la fecha/horario de la reserva.

---

## Rutas y endpoints

**45 endpoints documentados en total.** Todos los archivos de rutas tienen comentarios `@swagger` que generan la documentación interactiva.

### `/api/auth` — Autenticación (público, sin JWT)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login. Devuelve JWT + usuario + dashboard precalculado |
| POST | `/api/auth/forgot-password` | Envía email de recuperación. Siempre responde `{ ok: true }` |
| POST | `/api/auth/reset-password` | Establece nueva contraseña con el token del email |

Rate limit especial: 30 req / 5 min. Excluye localhost.

### `/api/condominios`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/api/condominios` | Super Admin, Admin | Lista condominios |
| POST | `/api/condominios` | Super Admin | Crea condominio |
| PUT | `/api/condominios/:id` | Super Admin | Actualiza (propaga nombre si cambia) |
| DELETE | `/api/condominios/:id` | Super Admin | Elimina |
| GET | `/api/condominios/payment-qr` | Todos | URL firmada (6h) del QR de pago |
| PUT | `/api/condominios/:id/payment-qr` | Admin | Sube imagen del QR de pago |
| DELETE | `/api/condominios/:id/payment-qr` | Admin | Borra imagen del QR |
| PUT | `/api/condominios/:id/asignar-expensas` | Admin | Asigna monto de expensa a propiedades |

### `/api/usuarios`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/api/usuarios` | Admin | Lista usuarios (paginado, filtros: nombre/email/rol) |
| POST | `/api/usuarios` | Admin | Crea usuario |
| PUT | `/api/usuarios/:id` | Admin o sí mismo | Actualiza perfil |
| DELETE | `/api/usuarios/:id` | Admin | Elimina usuario |
| POST | `/api/usuarios/:id/change-password` | Admin o sí mismo | Cambia contraseña |
| GET | `/api/usuarios/seguridad` | Todos | Lista el personal de Seguridad (id, nombre, teléfono) |

### `/api/propiedades`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/api/propiedades` | Admin | Lista propiedades (paginado, filtros) |
| POST | `/api/propiedades` | Admin | Crea propiedad |
| PUT | `/api/propiedades/:id` | Admin | Actualiza |
| DELETE | `/api/propiedades/:id` | Admin | Elimina |
| GET | `/api/propiedades/my-property` | Residente | Devuelve la propiedad del usuario |
| GET | `/api/propiedades/my-properties` | Residente | Lista todas las propiedades del usuario |
| POST | `/api/propiedades/:id/cargos-extra` | Admin | Agrega cargo extra |
| PUT | `/api/propiedades/:id/cargos-extra/:cargoId` | Admin | Edita cargo extra |
| DELETE | `/api/propiedades/:id/cargos-extra/:cargoId` | Admin | Elimina cargo extra |

### `/api/pagos`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/api/pagos` | Admin | Lista pagos (paginado, filtros por estado y tipo) |
| POST | `/api/pagos` | Todos | Crea pago con comprobante (multipart) |
| PATCH | `/api/pagos/:id/status` | Admin | Aprueba/rechaza y limpia cargos extra |

### `/api/anuncios`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/api/anuncios` | Todos | Lista anuncios (filtrados por rol y target) |
| POST | `/api/anuncios` | Admin | Crea anuncio |
| PUT | `/api/anuncios/:id` | Admin | Actualiza |
| DELETE | `/api/anuncios/:id` | Admin | Elimina |

### `/api/asambleas`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/api/asambleas` | Todos | Lista asambleas |
| POST | `/api/asambleas` | Admin | Crea asamblea (con documento adjunto opcional) |
| PUT | `/api/asambleas/:id` | Admin | Actualiza |
| DELETE | `/api/asambleas/:id` | Admin | Elimina |
| POST | `/api/asambleas/:id/vote` | Todos | Registra o cambia voto |
| GET | `/api/asambleas/:id/document` | Todos | URL firmada (5 min) del documento adjunto |

### `/api/visitas`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/api/visitas` | Todos | Lista pases QR del condominio |
| POST | `/api/visitas` | Todos | Crea pase QR (con fotos de documentos opcionales) |
| GET | `/api/visitas/verify/:code` | Seguridad | Verifica un QR por código (usado al escanear) |
| PATCH | `/api/visitas/:id/status` | Seguridad | Cambia estado del pase (Pendiente/Registrado/Completado/Cancelado) |
| PATCH | `/api/visitas/:id` | Todos | Actualiza datos del pase |
| GET | `/api/visitas/:id/document/:type` | Admin | URL firmada para ver foto de documento (idFront, idBack, plate) |
| DELETE | `/api/visitas/:id/document/:type` | Admin | Borra foto de documento |
| DELETE | `/api/visitas/:id` | Admin | Elimina el pase QR |

### `/api/historial-visitas`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/api/historial-visitas` | Admin, Seguridad | Historial paginado con KPIs del mes |
| POST | `/api/historial-visitas` | Admin, Seguridad | Registro manual de ingreso |
| PATCH | `/api/historial-visitas/:id/salida` | Admin, Seguridad | Registra hora de salida |
| DELETE | `/api/historial-visitas/:id` | Admin, Seguridad | Elimina registro |
| GET | `/api/historial-visitas/my-visits` | Todos | Historial de las propiedades del residente |

### `/api/panic`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/api/panic` | Todos | Lista alertas de pánico |
| POST | `/api/panic` | Todos | Crea alerta |
| PATCH | `/api/panic/:id/status` | Admin, Seguridad | Marca como atendida |

### `/api/areas-sociales`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/api/areas-sociales` | Todos | Lista áreas (residentes solo ven las activas) |
| POST | `/api/areas-sociales` | Admin | Crea área con hasta 6 fotos |
| PUT | `/api/areas-sociales/:id` | Admin | Actualiza (puede agregar/quitar fotos) |
| DELETE | `/api/areas-sociales/:id` | Admin | Elimina área y sus fotos |

### `/api/reservas-areas`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/api/reservas-areas` | Todos | Lista reservas |
| POST | `/api/reservas-areas` | Propietario/Inquilino | Crea reserva (valida conflictos de horario) |
| PATCH | `/api/reservas-areas/:id/estado` | Admin | Aprueba o rechaza |
| PATCH | `/api/reservas-areas/:id/cobrar` | Admin | Crea cargo extra por el costo del área |
| POST | `/api/reservas-areas/:id/solicitar-cambio` | Propietario/Inquilino | Solicita cambio de fecha/horario |
| PATCH | `/api/reservas-areas/:id/responder-cambio` | Admin | Aprueba o rechaza el cambio |
| DELETE | `/api/reservas-areas/:id` | Admin | Elimina reserva |

---

## DTOs — validación y transformación

Cada entidad tiene un archivo DTO en `src/dto/`. Su función es:

1. **`fromRequest(body)`** — Toma el cuerpo del request HTTP y devuelve un objeto limpio con solo los campos permitidos. Valida tipos, rellena defaults, rechaza campos desconocidos.

2. **`toResponse(dbRow)`** — Toma una fila de la DB y devuelve el objeto que va al cliente. Puede ocultar campos sensibles (ej: `password`) o añadir campos calculados.

Ejemplo de uso en un controlador:

```js
const dto = UserDTO.fromRequest(req.body);  // valida y limpia
// ... lógica de negocio ...
res.json(UserDTO.toResponse(saved));         // formatea la respuesta
```

Para asambleas existe también `toResponseAdmin(row)` que incluye el mapa completo de votos (`userVotes`), mientras que `toResponse` lo omite — un residente ve solo si él votó, no cómo votaron los demás.

---

## Servicios

### `src/services/supabase.js`

Funciones para interactuar con Supabase Storage:

- **`uploadFile(bucket, path, buffer, mimetype)`** — Sube un archivo al bucket indicado.
- **`getSignedUrl(bucket, path, expiresIn)`** — Genera una URL firmada con tiempo de expiración en segundos.
- **`deleteFile(bucket, path)`** — Borra un archivo del Storage.

Buckets usados:
- `comprobantes` — Fotos/PDFs de pagos (firmadas, 10 min)
- `documentos-visitas` — Fotos de carnets y placas (firmadas, 10 min)
- `asambleas` — Documentos adjuntos a asambleas (firmadas, 5 min)
- `areas-sociales` — Fotos de áreas comunes (firmadas, 1 h)
- `payment-qr` — QR de pago del condominio (firmadas, 6 h)

### `src/services/mailer.js`

Envía emails via API de Brevo (ex-Sendinblue). No usa SMTP — usa el endpoint REST de Brevo para mayor confiabilidad. Función expuesta:

- **`sendResetEmail(email, token)`** — Construye el link de reseteo usando `APP_URL` y envía el email de recuperación de contraseña.

### `src/services/dashboard.js`

- **`computeDashboard(data, condo)`** — Toma los datos crudos de `getDataForDashboard` y calcula los KPIs del dashboard: propiedades con deuda, pagos pendientes, visitas del mes, etc. Se llama después del login para precalcular el estado inicial.

---

## Swagger / Documentación interactiva

Archivo de configuración: `src/swagger.js`

La documentación se genera automáticamente a partir de comentarios `@swagger` en los archivos de rutas (`src/routes/*.js`). Usa el estándar OpenAPI 3.0.3.

- **UI interactiva**: `GET /api-docs` — Permite explorar todos los endpoints, ver parámetros y respuestas esperadas, y hacer peticiones reales con el botón "Try it out".
- **Spec JSON**: `GET /api-docs.json` — El spec crudo para importar en Postman u otras herramientas.

Para probar endpoints protegidos en Swagger UI:
1. Llamar `POST /api/auth/login` desde la misma UI.
2. Copiar el `token` de la respuesta.
3. Hacer clic en "Authorize" (candado arriba a la derecha).
4. Pegar el token (con o sin `Bearer ` según el campo).
5. Todos los "Try it out" subsiguientes incluyen el token automáticamente.

Para importar en Postman: Import → Raw Text / URL → pegar la URL `/api-docs.json`.

---

## Esquema de la base de datos

Archivo de referencia: `backend/schema.sql`. Ejecutar en Supabase SQL Editor para crear o migrar tablas.

### Tablas principales

**`usuarios`**
```sql
id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()
name          TEXT NOT NULL
email         TEXT UNIQUE NOT NULL
password      TEXT NOT NULL  -- bcrypt hash
phone         TEXT
role          TEXT  -- 'Super Admin' | 'Administrador' | 'Propietario' | 'Inquilino' | 'Seguridad'
condo         TEXT  -- nombre del condominio (denormalizado)
property      TEXT  -- código de la propiedad del residente
inserted_at   TIMESTAMPTZ DEFAULT NOW()
```

**`condominios`**
```sql
id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()
name                 TEXT UNIQUE NOT NULL
type                 TEXT  -- 'Condominio' | 'Edificio'
address              TEXT
expensas_mensuales   NUMERIC DEFAULT 0
units                INTEGER DEFAULT 0
plan                 TEXT
payment_qr_url       TEXT  -- path en Supabase Storage
inserted_at          TIMESTAMPTZ DEFAULT NOW()
```

**`propiedades`**
```sql
id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()
condo            TEXT NOT NULL
code             TEXT  -- ej: 'A-3', '101'
street           TEXT  -- nombre de la calle o bloque
owner            TEXT  -- nombre del propietario
tenant           TEXT  -- nombre del inquilino principal
tenants          TEXT[]  -- array de inquilinos adicionales
expensa_mensual  NUMERIC DEFAULT 0
debt             NUMERIC DEFAULT 0
inserted_at      TIMESTAMPTZ DEFAULT NOW()
```

**`cargos_extra`** — itemizados, calculados y adjuntados a propiedades en runtime
```sql
id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()
propiedad_id  TEXT NOT NULL
reserva_id    TEXT DEFAULT ''  -- vínculo con reservas_areas (para limpieza automática al pagar)
monto         NUMERIC NOT NULL
motivo        TEXT
inserted_at   TIMESTAMPTZ DEFAULT NOW()
```

**`pagos`**
```sql
id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()
condo            TEXT NOT NULL
tipo             TEXT  -- 'Expensa' | 'Reserva'
monto            NUMERIC NOT NULL
estado           TEXT DEFAULT 'pendiente'  -- 'pendiente' | 'aprobado' | 'rechazado'
propietario      TEXT
propiedad        TEXT
referencia       TEXT
comprobante      TEXT  -- path en Supabase Storage
created_by_role  TEXT
reserva_id       TEXT  -- vínculo con la reserva (si tipo = Reserva)
saldo_restante   NUMERIC
nota_saldo       TEXT
inserted_at      TIMESTAMPTZ DEFAULT NOW()
```

**`anuncios`**
```sql
id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()
condo            TEXT NOT NULL
title            TEXT NOT NULL
message          TEXT NOT NULL
target           TEXT  -- 'todos' | 'propietarios' | 'inquilinos' | 'seguridad'
created_by_role  TEXT
inserted_at      TIMESTAMPTZ DEFAULT NOW()
```

**`asambleas`**
```sql
id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()
condo             TEXT NOT NULL
title             TEXT NOT NULL
start_date        TEXT
due_date          TEXT  -- fecha de cierre de votación
description       TEXT
votes_yes         INTEGER DEFAULT 0
votes_no          INTEGER DEFAULT 0
votes_abstencion  INTEGER DEFAULT 0
user_votes        JSONB DEFAULT '{}'  -- { userId: 'favor' | 'contra' | 'abstencion' }
document_path     TEXT  -- path en Supabase Storage
inserted_at       TIMESTAMPTZ DEFAULT NOW()
```

**`visitas`** — pases QR pre-registrados
```sql
id                        TEXT PRIMARY KEY DEFAULT gen_random_uuid()
condo                     TEXT NOT NULL
code                      TEXT UNIQUE  -- contenido del QR (UUID)
full_name                 TEXT
id_number                 TEXT  -- cédula
id_document_name          TEXT
id_document_front_path    TEXT  -- foto frente carnet (Storage)
id_document_back_path     TEXT  -- foto dorso carnet (Storage)
plate_photo_path          TEXT  -- foto placa vehículo (Storage)
property                  TEXT
motive                    TEXT
mode                      TEXT  -- 'peatonal' | 'vehicular'
plate                     TEXT
status                    TEXT DEFAULT 'Pendiente'  -- Pendiente | Registrado | Completado | Cancelado
created_by                TEXT
inserted_at               TIMESTAMPTZ DEFAULT NOW()
expires_at                TIMESTAMPTZ
```

**`historial_visitas`** — registro de ingresos y salidas
```sql
id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()
condo        TEXT NOT NULL
visitante    TEXT
cedula       TEXT
propiedad    TEXT
tipo         TEXT  -- 'peatonal' | 'vehicular'
placa        TEXT
guard        TEXT  -- nombre del guardia
motivo       TEXT
visita_id    TEXT  -- FK blanda a visitas.id (si ingresó por QR)
salida       TEXT  -- hora de salida (string, ej: '14:35')
inserted_at  TIMESTAMPTZ DEFAULT NOW()
```

**`panic_alerts`**
```sql
id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()
condo        TEXT NOT NULL
resident     TEXT NOT NULL
phone        TEXT
address      TEXT NOT NULL
unit         TEXT
status       TEXT DEFAULT 'Pendiente'  -- 'Pendiente' | 'Atendida'
inserted_at  TIMESTAMPTZ DEFAULT NOW()
```

**`areas_sociales`**
```sql
id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()
condo        TEXT NOT NULL
nombre       TEXT NOT NULL
descripcion  TEXT
precio       NUMERIC DEFAULT 0
imagenes     JSONB DEFAULT '[]'  -- array de paths en Storage
activo       BOOLEAN DEFAULT true
inserted_at  TIMESTAMPTZ DEFAULT NOW()
```

**`reservas_areas`**
```sql
id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()
condo             TEXT NOT NULL
area_id           TEXT
area_nombre       TEXT
propietario       TEXT  -- nombre del residente que reservó
propiedad_id      TEXT
fecha             TEXT  -- fecha de la reserva (YYYY-MM-DD)
hora_inicio       TEXT  -- '08:00'
hora_fin          TEXT  -- '14:00'
dia_completo      BOOLEAN DEFAULT false
nota              TEXT
estado            TEXT DEFAULT 'pendiente'  -- 'pendiente' | 'aprobada' | 'rechazada'
cobrado           BOOLEAN DEFAULT false
solicitud_cambio  JSONB  -- { fecha, horaInicio, horaFin, diaCompleto, nota }
inserted_at       TIMESTAMPTZ DEFAULT NOW()
```

**`reset_tokens`**
```sql
token       TEXT PRIMARY KEY
email       TEXT NOT NULL
expires_at  TIMESTAMPTZ NOT NULL
used        BOOLEAN DEFAULT false
```

---

## Modelo de seguridad y multi-tenancy

### Denormalización del condominio

Todas las tablas con datos de un condominio guardan el **nombre** del condominio en una columna `condo TEXT`, no una FK. Ventajas:
- Queries simples con `WHERE condo = ?` en lugar de JOINs.
- No hay tablas cruzadas con `condo_id`.

La contrapartida: si el condominio se renombra, hay que actualizar esa columna en todas las tablas. Esto lo hace `cascadeCondoRename` en `db.js`.

### Scope por condominio en controladores

Todos los controladores aplican el scope del condominio del usuario logueado automáticamente:

```js
// En cualquier controlador:
const condo = req.user.role === 'Super Admin' ? req.query.condo : req.user.condo;
const propiedades = await db.getPropiedades(condo);
```

El Super Admin puede ver datos de cualquier condominio pasando `?condo=NombreCondo`. El resto solo ve su propio condominio.

### Flujo de pago con limpieza de cargos extra

Este flujo conecta reservas, cargos extra y pagos:

```
1. Admin cobra la reserva → POST /reservas-areas/:id/cobrar
   └─ Crea fila en cargos_extra con reserva_id = reserva.id

2. Residente ve el cargo extra en su panel y paga
   └─ Crea fila en pagos con tipo='Reserva', reservaId = reserva.id

3. Admin aprueba el pago → PATCH /pagos/:id/status (estado='aprobado')
   └─ deleteCargosExtraByReservaId(reserva.id) borra el cargo extra
   └─ Respuesta incluye propiedadActualizada (con cargoExtra = 0)
   └─ Frontend parchea la propiedad en memoria sin recargar
```

---

## Manejo de archivos (Supabase Storage)

Todos los uploads usan `multer.memoryStorage()` — el archivo nunca toca el disco del servidor, va directo al buffer en memoria y de ahí a Supabase Storage. Esto es fundamental para funcionar en Render (filesystem efímero).

Cada tipo de archivo tiene un tiempo de firma diferente según la sensibilidad y el caso de uso:

| Tipo de archivo | Bucket | Duración de URL firmada |
|---|---|---|
| Comprobante de pago | `comprobantes` | 10 minutos |
| Foto de documento de visita | `documentos-visitas` | 10 minutos |
| Documento de asamblea | `asambleas` | 5 minutos |
| Foto de área social | `areas-sociales` | 1 hora |
| QR de pago del condominio | `payment-qr` | 6 horas |

---

## Despliegue en Render

El backend está desplegado en: `https://condo-backend-o5av.onrender.com`

Configuración de Render:
- **Root Directory**: `backend`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Free (tiene cold start de ~30-60s después de inactividad)
- **Health Check Path**: `/api/health`

Variables de entorno configuradas en el dashboard de Render (nunca en el repo):
`JWT_SECRET`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `FRONTEND_URL`, `APP_URL`, `NODE_ENV=production`.

El archivo `render.yaml` en la raíz del repositorio documenta esta configuración como "Blueprint" para poder recrear el servicio sin configuración manual.
