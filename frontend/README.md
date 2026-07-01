# Condo Admin — Frontend

Aplicación web y móvil para la gestión integral de condominios. Permite a administradores, propietarios, inquilinos y personal de seguridad manejar pagos, visitas, áreas sociales, asambleas y alertas — todo en tiempo real desde el navegador o desde un teléfono Android/iOS.

---

## Qué es este sistema

**Condo Admin** es una plataforma SaaS multi-tenant para administración de condominios y edificios. Permite:

- Al **administrador**: gestionar propiedades, cobrar expensas, aprobar pagos, manejar el acceso de visitas, publicar anuncios, organizar asambleas con votaciones digitales, y gestionar áreas comunes reservables.
- Al **propietario / inquilino**: ver y pagar sus expensas, pre-registrar visitas con código QR, reservar áreas sociales, votar en asambleas, y activar un botón de pánico.
- Al **personal de seguridad**: registrar ingresos y salidas (manual o por escaneo QR), ver el historial de visitas, y atender alertas de pánico.
- Al **Super Admin**: administrar múltiples condominios, ver dashboards cruzados y asignar administradores.

---

## Índice

1. [Stack y dependencias](#stack-y-dependencias)
2. [Estructura de carpetas](#estructura-de-carpetas)
3. [Cómo correr el proyecto](#cómo-correr-el-proyecto)
4. [Variables de entorno](#variables-de-entorno)
5. [api.js — cliente HTTP](#apijs--cliente-http)
6. [App.jsx — componente raíz](#appjsx--componente-raíz)
7. [Pantallas (screens)](#pantallas-screens)
8. [Componentes reutilizables](#componentes-reutilizables)
9. [Sistema de estilos](#sistema-de-estilos)
10. [Modo oscuro](#modo-oscuro)
11. [Roles y lógica de UI por rol](#roles-y-lógica-de-ui-por-rol)
12. [Polling en tiempo real](#polling-en-tiempo-real)
13. [Manejo de archivos en el frontend](#manejo-de-archivos-en-el-frontend)
14. [App móvil con Capacitor](#app-móvil-con-capacitor)
15. [Build y despliegue](#build-y-despliegue)
16. [Patrones y decisiones técnicas clave](#patrones-y-decisiones-técnicas-clave)

---

## Stack y dependencias

| Paquete | Versión | Para qué se usa |
|---|---|---|
| `react` | 18.3 | Framework de UI |
| `react-dom` | 18.3 | Renderizado en el DOM |
| `vite` | 5.4 | Bundler y dev server |
| `@vitejs/plugin-react` | 4.3 | Plugin de React para Vite (incluye Fast Refresh) |
| `html5-qrcode` | 2.3 | Escaneo de códigos QR desde la cámara del dispositivo |
| `qrcode.react` | 4.2 | Generación de imágenes QR (para los pases de visita) |
| `jspdf` | 4.2 | Generación de PDFs en el navegador |
| `jspdf-autotable` | 5.0 | Tablas dentro de PDFs (reportes de historial) |
| `xlsx` | 0.18 | Exportación a Excel |
| `@capacitor/core` | 8.4 | Core de Capacitor (puente JS → nativo) |
| `@capacitor/android` | 8.4 | Wrapper Android |
| `@capacitor/ios` | 8.4 | Wrapper iOS (estructura lista, pendiente configurar en Mac) |
| `@capacitor/cli` | 8.4 | CLI para build y sincronización de la app móvil |

No se usa ningún gestor de estado externo (sin Redux, sin Zustand, sin Context API). Todo el estado vive en `App.jsx` con `useState` y `useRef`.

---

## Estructura de carpetas

```
frontend/
├── index.html                        # Entry point HTML — carga Sora/Manrope, define el root div
├── vite.config.js                    # Configuración de Vite (solo el plugin de React)
├── capacitor.config.json             # Configuración de Capacitor (appId, appName, webDir)
├── package.json
├── .env.development                  # VITE_API_URL=http://localhost:3001/api
├── .env.production                   # VITE_API_URL=https://condo-backend-o5av.onrender.com/api
├── public/
│   └── images/                       # Íconos y assets estáticos (logo, favicon, splash)
├── android/                          # Proyecto Android generado por Capacitor (no editar a mano)
├── dist/                             # Build de producción (generado por vite build)
└── src/
    ├── main.jsx                      # Punto de entrada React — monta <App /> en #root
    ├── App.jsx                       # Componente raíz (~3200 líneas) — toda la lógica principal
    ├── api.js                        # Cliente HTTP — todas las llamadas al backend
    ├── styles.css                    # Estilos globales + variables CSS + dark mode
    ├── screens/                      # 17 pantallas (componentes de página completa)
    │   ├── OwnerHomeScreen.jsx       # Dashboard del propietario/inquilino
    │   ├── OwnerPaymentsScreen.jsx   # Pantalla de pagos del residente
    │   ├── MisReservasScreen.jsx     # Reservas de áreas del residente
    │   ├── PreRegisterVisitsScreen.jsx  # Pre-registro de visitas (genera QR)
    │   ├── DashboardScreen.jsx       # Dashboard del administrador
    │   ├── SuperAdminDashboardScreen.jsx  # Dashboard del Super Admin (multi-condo)
    │   ├── UsuariosScreen.jsx        # Gestión de usuarios
    │   ├── PropiedadesScreen.jsx     # Gestión de propiedades y cargos extra
    │   ├── PagosScreen.jsx           # Gestión de pagos (aprobación, revisión)
    │   ├── AnunciosScreen.jsx        # Publicación de anuncios
    │   ├── AsambleasScreen.jsx       # Asambleas con votación digital
    │   ├── ReservasScreen.jsx        # Aprobación de reservas (vista admin)
    │   ├── HistorialVisitasScreen.jsx  # Historial de ingresos/salidas (admin)
    │   ├── SecurityVisitRegisterScreen.jsx  # Registro manual de visitas (seguridad)
    │   ├── SecurityHistoryScreen.jsx  # Historial de visitas (seguridad)
    │   ├── PanicScreen.jsx           # Monitoreo de alertas de pánico
    │   └── PerfilScreen.jsx          # Perfil de usuario y cambio de contraseña
    ├── components/                   # 4 componentes reutilizables
    │   ├── Landing.jsx               # Pantalla de bienvenida (no autenticado)
    │   ├── Login.jsx                 # Formulario de login y recuperación de contraseña
    │   ├── QrScanner.jsx             # Escáner QR + gestión de visitantes dentro
    │   └── Pagination.jsx            # Controles de paginación reutilizables
    ├── utils/                        # Utilidades
    │   ├── keyboard.js               # Detección de teclado virtual (móvil)
    │   ├── images.js                 # Helpers para URLs de imágenes
    │   ├── tenants.js                # Lógica de inquilinos de una propiedad
    │   └── dashboard.js              # Cálculo de KPIs del dashboard
    └── data/                         # Datos estáticos y de demo
```

---

## Cómo correr el proyecto

```bash
cd frontend
npm install

# Desarrollo (dev server con hot reload en http://localhost:5173)
npm run dev

# Build para producción
npm run build

# Previsualizar el build de producción localmente
npm run preview

# Build + sync para la app móvil Android
npm run build:mobile

# Abrir el proyecto en Android Studio
npm run android
```

---

## Variables de entorno

Vite expone solo las variables que empiezan con `VITE_` al código del navegador.

**`.env.development`**
```
VITE_API_URL=http://localhost:3001/api
```

**`.env.production`**
```
VITE_API_URL=https://condo-backend-o5av.onrender.com/api
```

`api.js` lee esta variable al cargar:
```js
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
```

El mismo `.env.production` se usa tanto para el build web (`npm run build`) como para el build de la app móvil (`npm run build:mobile`). Cambiar la URL del backend en un solo lugar aplica a ambos destinos.

---

## api.js — cliente HTTP

Archivo: `src/api.js` (214 líneas)

Es el único lugar donde se hacen llamadas HTTP. Ninguna pantalla ni componente llama a `fetch` directamente.

### Variables principales

```js
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const SERVER_URL = BASE_URL.replace(/\/api\/?$/, '');  // para construir URLs de archivos
const TOKEN_KEY = 'condo_token';  // clave en localStorage
```

### Función `request(path, options)`

La función central. Hace todas las peticiones HTTP con:

1. **Token automático**: Lee el JWT de `localStorage` y lo agrega como `Authorization: Bearer <token>` en cada request.
2. **Content-Type inteligente**: Si `options.body` es un `FormData` (subida de archivos), NO agrega `Content-Type: application/json` — el navegador lo pone solo con el boundary correcto para `multipart/form-data`.
3. **Manejo de errores de red**: Si el `fetch` lanza una excepción (sin conexión), la atrapa y lanza un error claro.
4. **Manejo de 401**: Si el servidor responde 401, limpia el token de `localStorage` y notifica a todos los suscriptores para que redirijan al login.
5. **Throw en errores HTTP**: Si `res.ok` es false, lanza el error con el mensaje que vino del servidor.

### Sistema de suscriptores para logout

```js
const _unauthorizedCallbacks = new Set();

export function onUnauthorized(cb) {
  _unauthorizedCallbacks.add(cb);
  return () => _unauthorizedCallbacks.delete(cb);  // retorna función para desuscribir
}
```

`App.jsx` llama a `onUnauthorized(cb)` al montar, y el callback hace el logout visual (limpia el estado). Esto permite manejar sesiones expiradas desde cualquier parte de la app sin código duplicado.

### Grupos de funciones exportadas

Cada función del API es una línea que llama a `request(...)`:

**Auth**
- `login(email, password)` — Llama al backend, si hay token en la respuesta lo guarda en localStorage.
- `logout()` — Borra el token de localStorage.
- `forgotPassword(email)`, `resetPassword(token, password)`

**Condominios**
- `getCondominios()`, `createCondo(data)`, `updateCondo(id, data)`, `deleteCondo(id)`
- `getMyCondoPaymentQr()` — Devuelve una URL firmada para el QR de pago.
- `uploadCondoPaymentQr(condoId, formData)`, `deleteCondoPaymentQr(condoId)`
- `asignarExpensas(condoId, monto, propiedadIds)`

**Propiedades**
- `getPropiedades()`, `getPropiedadesPaged(params)`, `createPropiedad(data)`, `updatePropiedad(id, data)`, `deletePropiedad(id)`
- `getMyProperty()`, `getMyProperties()`
- `addCargoExtra(propId, monto, motivo)`, `editCargoExtra(propId, cargoId, monto, motivo)`, `removeCargoExtra(propId, cargoId)`

**Usuarios**
- `getUsuarios()`, `getUsuariosPaged(params)`, `createUsuario(data)`, `updateUsuario(id, data)`, `deleteUsuario(id)`, `changePassword(id, data)`

**Pagos**
- `getPagos()`, `getPagosPaged(params)`, `createPago(data)`
- `updatePagoStatus(id, estado, montoReal, saldoRestante, notaSaldo)`

**Anuncios, Asambleas, Visitas, Historial, Pánico, Áreas, Reservas** — mismos patrones CRUD + funciones específicas.

**Construcción de URLs**
- `getVisitaVerifyUrl(code)` — URL completa del endpoint de verificación del QR (se embebe en el QR mismo).
- `getAsambleaDocumentUrl(id)` — URL del endpoint que devuelve el documento de la asamblea.
- `getUploadUrl(relativePath)` — URL de un archivo subido localmente (desarrollo).

---

## App.jsx — componente raíz

Archivo: `src/App.jsx` (~3200 líneas)

Es un componente monolítico que orquesta toda la aplicación. No hay React Router — la navegación se maneja con un estado `activeSection` que determina qué pantalla renderizar.

### Inicialización

Al montar el componente:
1. Lee el token de `localStorage` con `getToken()`.
2. Si hay token, lo decodifica con `atob` para extraer el payload del JWT y leer el `id` del usuario.
3. Llama a `handleLogin()` con los datos del usuario guardados en `localStorage` para restaurar la sesión sin volver a hacer login.
4. Se suscribe a `onUnauthorized()` para manejar sesiones expiradas.

### Estado principal (useState)

El componente maneja más de 40 estados independientes. Los más importantes:

```js
const [user, setUser] = useState(null);              // usuario logueado
const [activeSection, setActiveSection] = useState('dashboard');  // pantalla activa
const [sidebarOpen, setSidebarOpen] = useState(false);  // menú mobile
const [theme, setTheme] = useState('light');           // 'light' | 'dark'

// Datos cargados del backend
const [propiedadesData, setPropiedadesData] = useState([]);
const [pagosData, setPagosData] = useState([]);
const [anunciosData, setAnunciosData] = useState([]);
const [asambleasData, setAsambleasData] = useState([]);
const [visitasData, setVisitasData] = useState([]);
const [historialData, setHistorialData] = useState([]);
const [panicAlerts, setPanicAlerts] = useState([]);
const [condominiosData, setCondominiosData] = useState([]);
const [reservasData, setReservasData] = useState([]);
const [areasData, setAreasData] = useState([]);

// Badges de notificaciones (contadores de no leídos)
const [panicBadge, setPanicBadge] = useState(0);
const [pagosBadge, setPagosBadge] = useState(0);
const [anunciosBadge, setAnunciosBadge] = useState(0);

// Formularios abiertos
const [showNewUserForm, setShowNewUserForm] = useState(false);
const [editingUser, setEditingUser] = useState(null);
const [showNewPropForm, setShowNewPropForm] = useState(false);
// ... etc (uno por cada modal/formulario de la app)
```

### Navegación

No hay React Router. La navegación es:

```jsx
// En el sidebar:
<button onClick={() => setActiveSection('pagos')}>Pagos</button>

// En el render principal:
const renderContent = () => {
  switch (activeSection) {
    case 'dashboard': return <DashboardScreen ... />;
    case 'pagos':     return <PagosScreen ... />;
    // ...
  }
};
```

Esta decisión simplifica la app para el caso de uso (no hay deep linking ni botón atrás del browser que importe), y elimina la dependencia de React Router.

### Polling

```js
useEffect(() => {
  if (!user) return;
  const interval = setInterval(pollData, 30_000);   // datos generales cada 30s
  const panicInt = setInterval(pollPanic, 10_000);  // alertas de pánico cada 10s
  return () => { clearInterval(interval); clearInterval(panicInt); };
}, [user]);
```

`pollData` recarga las listas de datos relevantes según el rol del usuario. `pollPanic` solo recarga las alertas de pánico (más frecuente porque es urgente).

### Badges y notificaciones

Se usan `useRef` para rastrear IDs ya vistos, evitando marcar como "nuevo" algo que el usuario ya leyó:

```js
const knownPanicIdsRef   = useRef(new Set());
const knownPagosIdsRef   = useRef(new Set());
const knownAnunciosIdsRef = useRef(new Set());
```

Cuando llegan datos del polling, se comparan con el Set de IDs conocidos. Los nuevos se cuentan para el badge. Usar `useRef` en lugar de `useState` evita que la comparación cause re-renders.

### Cálculo de `paidAllTime` (para el panel del residente)

```js
const paidAllTime = myPagos
  .filter(p => p.estado === 'aprobado' && p.tipo !== 'Reserva')
  .reduce((s, p) => s + (Number(p.monto) || 0), 0);
```

Se excluyen los pagos de tipo `Reserva` porque esos ya están acreditados mediante la eliminación del cargo extra en el backend. Incluirlos aquí produciría un doble descuento.

### Sidebar y menú por rol

El sidebar muestra opciones distintas según `user.role`. Las opciones que ve cada rol:

**Super Admin**: Dashboard, Condominios, Usuarios, Áreas Sociales
**Administrador**: Dashboard, Propiedades, Pagos, Usuarios, Anuncios, Asambleas, Áreas, Reservas, Historial Visitas, Botón de Pánico
**Propietario / Inquilino**: Inicio, Mis Pagos, Reservas, Pre-registrar Visitas, Asambleas, Anuncios, Botón de Pánico, Perfil
**Seguridad**: Registrar Visita, Historial, Escanear QR, Botón de Pánico, Perfil

En móvil el sidebar es un drawer que se abre con un botón hamburguesa.

---

## Pantallas (screens)

### `OwnerHomeScreen.jsx` — Inicio del propietario/inquilino

Muestra el estado financiero de la propiedad del residente:

- **Expensa mensual**: el monto base asignado por el admin.
- **Cargos extra**: suma de todos los cargos pendientes (desglosados en un acordeón/modal).
- **Total a pagar**: expensa + cargos extra.
- **Historial de pagos**: sus pagos anteriores con estado (pendiente/aprobado/rechazado).
- **QR de pago del condominio**: imagen para saber a dónde transferir.
- **Contactos de seguridad**: números de teléfono del personal de seguridad de su condominio.

### `OwnerPaymentsScreen.jsx` — Pagos del residente

Formulario para registrar un pago:
- Selecciona el tipo (Expensa o Reserva).
- Ingresa el monto y una referencia (número de transferencia).
- Sube el comprobante (imagen o PDF).
- El pago queda en estado "pendiente" hasta que el admin lo apruebe.

También muestra el historial de todos sus pagos con el estado actual.

### `MisReservasScreen.jsx` — Reservas del residente

- Lista las reservas del residente en su condominio.
- Permite crear una nueva reserva: selecciona el área, fecha, horario o día completo, y una nota.
- Muestra el estado de cada reserva (pendiente, aprobada, rechazada).
- Si la reserva tiene un cargo extra pendiente, lo muestra con su monto.
- Permite solicitar un cambio de fecha/horario en reservas ya creadas.

### `PreRegisterVisitsScreen.jsx` — Pre-registro de visitas

Permite a los residentes registrar una visita antes de que llegue:
- Nombre del visitante y número de cédula.
- Propiedad a visitar, motivo.
- Modo: peatonal o vehicular (si vehicular, pide la placa).
- Fecha de expiración del pase.
- Opcional: fotos del carnet (frente y dorso) y foto de la placa.

Al guardar, el backend genera un `code` único (UUID). La pantalla muestra el código QR que el residente le envía al visitante. El visitante llega con ese QR en su celular y el guardia lo escanea.

### `DashboardScreen.jsx` — Dashboard del administrador

Vista de KPIs del condominio:

- **Visitas este mes**: total de registros en historial del mes en curso.
- **Pagos pendientes**: cantidad de pagos esperando aprobación.
- **Deuda total**: suma de expensas + cargos extra de todas las propiedades.
- **Tabla de propiedades**: lista todas las propiedades con su estado de deuda, propietario, inquilino, y desglose de lo que deben.

Los KPIs se calculan en el frontend a partir de los datos ya cargados, sin llamadas adicionales.

### `SuperAdminDashboardScreen.jsx` — Dashboard del Super Admin

Vista cross-condominio:
- Tabla con todos los condominios: nombre, cantidad de propiedades, expensas configuradas.
- KPIs agregados de todos los condominios.
- Acceso rápido a cualquier condominio para gestionar sus datos.

### `UsuariosScreen.jsx` — Gestión de usuarios

- Lista paginada de usuarios con búsqueda por nombre/email y filtro por rol.
- Formulario para crear usuario: nombre, email, contraseña inicial, teléfono, rol, condominio (el campo condominio solo aparece para Super Admin).
- Edición inline en modal.
- Botón para cambiar contraseña de cualquier usuario (admin no necesita saber la contraseña actual).
- Eliminación con confirmación.

### `PropiedadesScreen.jsx` — Gestión de propiedades

- Lista paginada de propiedades con búsqueda.
- Formulario para crear/editar: código, calle, propietario, inquilinos (múltiples), expensa mensual.
- **Cargos extra**: cada propiedad tiene un modal que lista sus cargos extra individuales con monto y motivo. Desde ahí se pueden agregar, editar y eliminar cargos.
- **Detección de conflictos de inquilinos**: si un usuario ya está asignado como inquilino en otra propiedad del mismo condominio, muestra un aviso.

### `PagosScreen.jsx` — Gestión de pagos

Vista compleja con dos secciones:

**Gestión de Expensas** (colapsable, por defecto contraída):
- Lista todas las propiedades con su estado de deuda.
- Paginación de 15 propiedades por página con scroll-to-top automático al cambiar página.
- Botón para abrir el modal de "revisar pago" de cada propiedad.
- El modal muestra el comprobante del pago, el monto declarado, y permite aprobar/rechazar con ajuste de monto y nota de saldo.

**Lista de pagos** (por debajo de Gestión de Expensas):
- Pestañas de estado: Todos / Pendientes / Aprobados / Rechazados.
- Pestañas de tipo: Todos los tipos / Expensas / Reservas.
- Paginación y búsqueda por propiedad, propietario o referencia.
- KPIs: total pendiente, total aprobado, total recaudado.
- Comprobante visible directamente en la lista (miniatura clickeable para zoom).

Al aprobar un pago:
1. El backend elimina los cargos extra correspondientes.
2. La respuesta incluye `propiedadActualizada`.
3. El frontend aplica el parche en `propiedadesData` sin recargar todo.

### `AnunciosScreen.jsx` — Anuncios

- Lista de anuncios del condominio.
- Formulario para crear/editar: título, mensaje, audiencia (todos/propietarios/inquilinos/seguridad).
- Los residentes ven solo los anuncios dirigidos a su rol.
- Filtros por fecha (esta semana, este mes, antiguos).

### `AsambleasScreen.jsx` — Asambleas

- Lista de asambleas con su estado de votación.
- Creación: título, descripción, fechas de inicio y cierre, documento adjunto opcional (PDF o imagen).
- **Votación**: cada usuario autenticado puede votar Sí/No/Abstención. El voto se puede cambiar antes del cierre.
- **Privacidad de votos**: los residentes ven solo su propio voto y los contadores totales. Los admins ven el mapa completo de quién votó qué.
- Indicador de fecha de cierre con alerta si ya venció.
- Descarga del documento adjunto.

### `ReservasScreen.jsx` — Aprobación de reservas (admin)

Lista todas las reservas del condominio:
- Estado actual, área, propietario, fecha, horario.
- Botones para aprobar/rechazar con nota opcional.
- Botón "Cobrar" si el área tiene precio y todavía no se cobró.
- Si la reserva fue cobrada y hay un pago asociado: muestra el comprobante del pago (miniatura clickeable) y botones para aprobarlo/rechazarlo directamente desde la pantalla de reservas.
- El botón "Aprobar reserva" queda deshabilitado mientras el pago no esté aprobado.

### `HistorialVisitasScreen.jsx` — Historial de visitas (admin)

- Tabla paginada de todos los ingresos y salidas del condominio.
- Filtros: tipo (peatonal/vehicular), búsqueda por nombre/cédula/placa.
- KPIs del mes: total, peatonales, vehiculares.
- Para cada registro vinculado a un pase QR con fotos: botón "Documentos" que abre un modal con opciones de Ver (abre en nueva pestaña) y Descargar para cada foto disponible (frente de carnet, dorso, placa).
- Exportación del historial a PDF y a Excel.

### `SecurityVisitRegisterScreen.jsx` — Registro de visitas (seguridad)

Formulario para que el guardia registre manualmente la entrada de un visitante:
- Nombre del visitante, cédula, placa (si vehicular).
- Propiedad a la que viene, motivo.
- Tipo: peatonal o vehicular.
- Al guardar, crea una fila en `historial_visitas` con la hora de ingreso actual.

### `SecurityHistoryScreen.jsx` — Historial (seguridad)

Similar a `HistorialVisitasScreen` pero con menos opciones:
- Filtra automáticamente por el condominio del guardia.
- Permite marcar la salida de visitantes que están dentro.
- Filtro por mes (dropdown tipo popover).
- Paginación de 15 por página.
- Muestra los visitantes que siguen dentro en cards separadas.

### `PanicScreen.jsx` — Botón de pánico

**Vista residente**: botón rojo grande. Al presionar, abre un modal de confirmación. Al confirmar, crea una alerta con nombre, teléfono y dirección del residente.

**Vista admin/seguridad**: lista de alertas activas (pendiente/atendida). Cada alerta muestra nombre, unidad y teléfono. Botón para marcarla como atendida.

El polling de pánico corre cada 10 segundos (más frecuente que el resto de datos).

### `PerfilScreen.jsx` — Perfil de usuario

Todos los roles pueden:
- Ver y editar su nombre y teléfono.
- Cambiar su contraseña (pide la actual + la nueva + confirmación).
- Subir/cambiar su foto de perfil.
- Alternar el modo oscuro.

---

## Componentes reutilizables

### `Landing.jsx`

Pantalla de bienvenida para usuarios no autenticados. Muestra el logo, el nombre del sistema, y el botón de "Ingresar" que lleva al `Login.jsx`. También lista las características principales de la plataforma en cards.

### `Login.jsx`

Formulario de autenticación con dos modos:

**Modo login** (default):
- Campos email y contraseña.
- Al enviar: llama a `api.login(email, password)`, guarda el token, y notifica a `App.jsx` para actualizar el estado de sesión.
- Botón "¿Olvidaste tu contraseña?" que cambia al modo recuperación.

**Modo recuperación**:
- Solo pide email.
- Llama a `api.forgotPassword(email)`.
- Muestra un mensaje de confirmación independientemente de si el email existe (el backend siempre responde `{ ok: true }` para no revelar qué cuentas existen).

### `QrScanner.jsx`

El componente más complejo de los reutilizables. Tiene dos responsabilidades:

**1. Escáner QR** (usa `html5-qrcode`):
- Inicializa la cámara al montar.
- Cuando detecta un QR, llama a `api.verifyVisita(code)`.
- Si la visita está en estado `Pendiente`: muestra el modal "Confirmación de Ingreso" con los datos del visitante. Al hacer clic en Aceptar: cambia el estado a `Registrado` y crea un registro en historial con la hora actual.
- Si la visita está en estado `Registrado` (ya entró): muestra el modal "Confirmación de Salida". Al hacer clic en Aceptar: cambia el estado a `Completado`, actualiza la hora de salida en el historial, y lo quita de la lista de "visitantes dentro".
- Hay un cooldown de 3 segundos entre escaneos para evitar doble registro.

**2. Visitantes dentro** (divididos en dos cards):

**Portería Vehicular** (ícono SVG de auto):
- Lista los visitantes que ingresaron por modo `vehicular` y no han salido.
- Buscador por número de placa.
- Botón "Marcar Salida" manual para cada visitante.

**Portería Peatonal** (ícono SVG de persona caminando):
- Lista los visitantes que ingresaron por modo `peatonal` y no han salido.
- Buscador por número de cédula.
- Botón "Marcar Salida" manual para cada visitante.

El estado "dentro" se calcula filtrando `historialData` por visitas sin hora de salida registrada.

### `Pagination.jsx`

Componente simple de controles de paginación. Props:
- `page` — página actual (1-indexed).
- `totalPages` — total de páginas.
- `onPageChange(newPage)` — callback al cambiar de página.

Muestra botones de Anterior / números de página / Siguiente. Se usa en: PagosScreen (lista de pagos), PropiedadesScreen, UsuariosScreen, HistorialVisitasScreen, SecurityHistoryScreen, PagosScreen (gestión de expensas), AsambleasScreen, AnunciosScreen.

---

## Sistema de estilos

Archivo: `src/styles.css`

No se usa ningún framework CSS (sin Tailwind, sin Bootstrap). Todo el CSS es custom usando variables CSS nativas.

### Variables CSS globales (`:root`)

```css
:root {
  --accent:       #5b4bff;    /* violeta/índigo — color principal de la marca */
  --accent-light: #ede9ff;    /* fondo suave de elementos con acento */
  --surface:      #ffffff;    /* fondo de cards y paneles */
  --surface-2:    #f4f6fa;    /* fondo levemente diferenciado */
  --text-primary: #1a1a2e;    /* texto principal */
  --text-muted:   #6b7280;    /* texto secundario/gris */
  --border:       #e2e8f0;    /* bordes suaves */
  --danger:       #ef4444;    /* rojo para errores y eliminaciones */
  --success:      #10b981;    /* verde para aprobados */
  --warning:      #f59e0b;    /* amaranja para pendientes */
  --radius-sm:    6px;
  --radius-md:    12px;
  --radius-lg:    20px;
  --shadow-sm:    0 1px 3px rgba(0,0,0,.08);
  --shadow-md:    0 4px 12px rgba(0,0,0,.1);
}
```

### Tipografía

Cargada desde Google Fonts en `index.html`:
- **Sora** — titulares y elementos de UI (botones, labels).
- **Manrope** — cuerpo de texto, tablas, formularios.

### Layout principal

```
┌─────────────────────────────────────────────────┐
│  .app-shell                                     │
│  ┌──────────┐  ┌────────────────────────────┐  │
│  │ .sidebar │  │ .main-content              │  │
│  │          │  │  .content-header           │  │
│  │ nav menu │  │  .content-body             │  │
│  │          │  │    (pantalla activa)        │  │
│  └──────────┘  └────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

En móvil (≤ 768px): el sidebar se convierte en un drawer lateral que aparece/desaparece con `.sidebar-open`.

### Clases utilitarias importantes

- `.card` — Card con sombra y radio de borde estándar.
- `.btn`, `.btn-primary`, `.btn-danger`, `.btn-ghost` — Estilos de botones.
- `.badge`, `.badge-warning`, `.badge-success`, `.badge-danger` — Pills de estado.
- `.modal-overlay`, `.modal-content` — Overlays y paneles modales.
- `.form-group`, `.form-label`, `.form-input` — Estilos de formularios.
- `.table-container`, `.data-table` — Tablas responsivas.
- `.toast` — Notificaciones flotantes que aparecen arriba a la derecha.

### CSS específico de funcionalidades recientes

- `.visit-inside-grid` — Grid de 2 columnas para Portería Vehicular y Portería Peatonal.
- `.visit-inside-card` — Card de cada portería.
- `.expensas-mgmt-header-toggle` — Botón sin estilos nativos para el header colapsable de Gestión de Expensas.
- `.expensas-mgmt-chevron` + `.expensas-mgmt-chevron-open` — Ícono SVG que rota 180° al expandir.
- `.pagos-tabs-tipo` — Segunda fila de tabs con 3 columnas para filtrar por tipo de pago.
- `.reserva-pago-comprobante` — Contenedor del comprobante de pago dentro de la card de reserva.
- `.reserva-pago-comprobante-img` — Miniatura 110×110 con cursor zoom-in.
- `.historial-docs-btn` — Botón "Documentos" en la tabla de historial.
- `.historial-docs-modal`, `.historial-docs-list`, `.historial-docs-item` — Modal de visualización de fotos de documentos.

---

## Modo oscuro

El tema oscuro se activa añadiendo `data-theme="dark"` al elemento `<html>`:

```js
document.documentElement.setAttribute('data-theme', theme);
```

El CSS redefine todas las variables bajo ese selector:

```css
[data-theme="dark"] {
  --surface:      #000000;    /* negro puro — estilo Instagram */
  --surface-2:    #111111;
  --text-primary: #f1f5f9;
  --text-muted:   #94a3b8;
  --border:       #1f2937;
  --accent:       #818cf8;    /* el violeta se aclara para contraste sobre negro */
}
```

La preferencia se guarda en `localStorage` y se aplica al montar la app. El toggle está en `PerfilScreen.jsx`.

---

## Roles y lógica de UI por rol

La app renderiza componentes distintos según `user.role`. La lógica está en `App.jsx`:

```js
const isAdmin       = user.role === 'Administrador' || user.role === 'Super Admin';
const isSuperAdmin  = user.role === 'Super Admin';
const isResident    = user.role === 'Propietario' || user.role === 'Inquilino';
const isSecurity    = user.role === 'Seguridad';
```

Estas flags controlan:
- Qué ítems aparecen en el sidebar.
- Qué pantalla se renderiza para cada sección.
- Qué botones/acciones están visibles dentro de cada pantalla.
- Qué datos se cargan en el polling (un guardia no carga propiedades, un residente no carga historial de todo el condominio).

### Tabla de acceso por rol

| Funcionalidad | Super Admin | Admin | Propietario | Inquilino | Seguridad |
|---|---|---|---|---|---|
| Dashboard con KPIs multi-condo | ✓ | — | — | — | — |
| Dashboard del condominio | — | ✓ | — | — | — |
| Gestión de propiedades | ✓ | ✓ | — | — | — |
| Gestión de usuarios | ✓ | ✓ | — | — | — |
| Aprobar/rechazar pagos | ✓ | ✓ | — | — | — |
| Ver y registrar pagos | — | — | ✓ | ✓ | — |
| Pre-registrar visitas | — | — | ✓ | ✓ | — |
| Ver propio historial de visitas | — | — | ✓ | ✓ | — |
| Registrar ingresos en portería | — | — | — | — | ✓ |
| Escanear QR | — | — | — | — | ✓ |
| Ver historial del condominio | ✓ | ✓ | — | — | ✓ |
| Publicar anuncios | ✓ | ✓ | — | — | — |
| Ver anuncios | ✓ | ✓ | ✓ | ✓ | ✓ |
| Crear asambleas | ✓ | ✓ | — | — | — |
| Votar en asambleas | ✓ | ✓ | ✓ | ✓ | — |
| Crear/gestionar áreas sociales | ✓ | ✓ | — | — | — |
| Reservar áreas sociales | — | — | ✓ | ✓ | — |
| Aprobar/rechazar reservas | ✓ | ✓ | — | — | — |
| Botón de pánico (activar) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Botón de pánico (atender) | ✓ | ✓ | — | — | ✓ |

---

## Polling en tiempo real

La app no usa WebSockets. En su lugar, hace polling (peticiones periódicas) para mantenerse actualizada:

**Cada 30 segundos** (`pollData`):
- Carga los datos relevantes para el rol actual (pagos, reservas, anuncios, propiedades, visitas).
- Compara los nuevos IDs con los ya conocidos (`useRef` con Sets) para calcular badges.

**Cada 10 segundos** (`pollPanic`):
- Solo carga las alertas de pánico.
- Más frecuente porque las alertas son urgentes.

**Por qué polling y no WebSockets:**
- El backend corre en Render Free que cierra conexiones inactivas. Las WebSockets persistentes no sobreviven en ese tier.
- El polling es más simple de implementar, testear y depurar.
- Para el volumen de usuarios esperado (decenas, no miles), el overhead es insignificante.

---

## Manejo de archivos en el frontend

### Subida de archivos

Todos los uploads se hacen como `multipart/form-data`. En `api.js`, la función `request` detecta automáticamente si el `body` es un `FormData` y omite el header `Content-Type: application/json`:

```js
const isFormData = options.body instanceof FormData;
// Si isFormData: no pone Content-Type (el navegador lo pone con el boundary correcto)
// Si no:        pone Content-Type: application/json y serializa con JSON.stringify
```

Ejemplo de subida desde una pantalla:

```js
const formData = new FormData();
formData.append('monto', monto);
formData.append('referencia', ref);
formData.append('comprobante', fileInput.files[0]);
await api.createPago(formData);
```

### Visualización de archivos protegidos

Los archivos privados (comprobantes, carnets, fotos de placa) no tienen URLs públicas. Para verlos:

1. El frontend llama a un endpoint del backend (ej: `GET /api/visitas/:id/document/idFront`).
2. El backend genera una URL firmada de Supabase con tiempo de expiración y la devuelve.
3. El frontend abre esa URL en una nueva pestaña o la usa como `src` de una `<img>`.

```js
// Ver foto del carnet
const { url } = await api.getVisitaDocumentUrl(visitaId, 'idFront');
window.open(url, '_blank');

// Descargar foto
const res = await fetch(url);
const blob = await res.blob();
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'carnet-frente.jpg';
a.click();
```

### Generación de QR

Los pases de visita generan un QR con `qrcode.react`:

```jsx
import { QRCodeSVG } from 'qrcode.react';

// El contenido del QR es la URL pública del endpoint de verificación
const qrContent = api.getVisitaVerifyUrl(visita.code);

<QRCodeSVG value={qrContent} size={200} />
```

El guardia escanea ese QR con `html5-qrcode` en `QrScanner.jsx`, que llama al mismo endpoint para verificar y procesar el ingreso/salida.

---

## App móvil con Capacitor

Capacitor convierte la app web en una app nativa empaquetando el `dist/` dentro de un proyecto Android/iOS.

### Configuración — `capacitor.config.json`

```json
{
  "appId": "com.ignitel.condoadmin",
  "appName": "CondoAdmin",
  "webDir": "dist",
  "server": {
    "androidScheme": "https"
  }
}
```

- `appId`: identificador único de la app en Play Store/App Store.
- `webDir`: carpeta del build web que se empaqueta dentro del APK.
- `androidScheme: "https"`: hace que el WebView de Android use el scheme `https://localhost` en lugar de `http://` — necesario para que CORS funcione correctamente (el backend tiene `https://localhost` en la lista de orígenes permitidos).

### Flujo de build para Android

```bash
# 1. Hace el build web (usa .env.production con la URL de producción)
npm run build

# 2. Copia el dist/ al proyecto Android y sincroniza plugins
npx cap sync

# 3. Abre Android Studio para hacer el APK/AAB
npx cap open android
```

O todo junto:
```bash
npm run build:mobile  # equivale a: vite build && npx cap sync
npm run android       # equivale a: npx cap open android
```

### Diferencias de comportamiento web vs móvil

- **Cámara para QR**: en web usa la cámara del navegador; en Android usa el WebView nativo que tiene acceso a la cámara del dispositivo.
- **CORS**: en móvil las requests vienen de `capacitor://localhost` o `https://localhost` — ambos están en la lista blanca de CORS del backend.
- **Sin React Router**: no hay problemas de navegación con el botón "atrás" del dispositivo porque la app es de una sola ruta.

---

## Build y despliegue

### Build web

```bash
npm run build
```

Genera la carpeta `dist/` con HTML, CSS y JS minificados. El archivo de entrada es `dist/index.html`.

Variables de entorno: Vite lee `.env.production` automáticamente cuando `NODE_ENV=production`.

### Despliegue en Vercel (recomendado)

- Conectar el repositorio en Vercel.
- Configurar **Root Directory**: `frontend`.
- Build Command: `npm run build` (default).
- Output Directory: `dist` (default).
- Vercel detecta Vite automáticamente.

No hace falta configurar rewrites de SPA (la app no usa React Router, todas las rutas van a `index.html` por defecto).

### Despliegue manual (cualquier hosting estático)

Subir el contenido de `dist/` a cualquier CDN o servidor estático. Asegurarse de que todas las rutas sirvan `index.html` (configuración de SPA fallback).

---

## Patrones y decisiones técnicas clave

### Sin Redux ni Context

Todo el estado está en `useState` dentro de `App.jsx`. Esto funciona bien para el tamaño actual del proyecto (una pantalla a la vez, datos compartidos limitados). Si el proyecto crece significativamente, el próximo paso lógico sería extraer el estado de autenticación y los datos principales a Context o Zustand.

### Conversión de tipos al leer números de la DB

La base de datos puede devolver números como strings (especialmente campos `NUMERIC`). Por eso en todos los cálculos se usa `Number(x) || 0`:

```js
const total = propiedades.reduce((sum, p) => sum + (Number(p.expensaMensual) || 0), 0);
```

### `useRef` para sets de IDs conocidos

Para calcular badges sin causar re-renders innecesarios:

```js
const knownPanicIdsRef = useRef(new Set());

// Al recibir datos del polling:
const newAlerts = alerts.filter(a => !knownPanicIdsRef.current.has(String(a.id)));
newAlerts.forEach(a => knownPanicIdsRef.current.add(String(a.id)));
setPanicBadge(prev => prev + newAlerts.length);
```

Si se usara `useState` para el Set, cada actualización causaría un re-render. Con `useRef`, el Set se actualiza sin render.

### Paginación en frontend vs backend

La app mezcla dos estrategias:
- **Paginación en backend** (usuarios, pagos, historial, anuncios, asambleas): el servidor devuelve una página de datos y el total. Mejor para listas largas.
- **Paginación en frontend** (propiedades en Gestión de Expensas): el servidor devuelve todos los datos, el cliente recorta la página. Esto es porque el ordenamiento natural de propiedades no se puede delegar fácilmente a la DB.

### Manejo de fechas

Las fechas de Supabase vienen como strings ISO 8601 (`TIMESTAMPTZ`). Al comparar fechas:
- Para filtros de mes/año se usa `d.getMonth()` y `d.getFullYear()` directamente desde el objeto `Date`.
- Para strings de display se usan opciones de `toLocaleDateString('es-ES', {...})`.
- Para el filtro de mes en historial se usa `p.insertedAt` (ISO del servidor, confiable) y NO `p.createdAt` (string en español formateado para display, que no es parseable por `new Date()`).

### Exports nombrados en api.js

Todas las funciones de `api.js` se exportan con nombre (`export const getUsuarios = ...`), nunca como `export default`. Esto permite importar solo lo que se necesita en cada pantalla:

```js
import { getUsuarios, createUsuario, deleteUsuario } from '../api';
```

Y en `App.jsx` se importa todo como namespace:

```js
import * as api from './api';
// ...
await api.updatePagoStatus(id, estado);
```
