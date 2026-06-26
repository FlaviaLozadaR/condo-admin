import React, { useEffect, useRef, useState } from "react";
import * as api from "./api.js";
import { onUnauthorized } from "./api.js";
import Landing from "./components/Landing.jsx";
import Login from "./components/Login.jsx";
import QrScannerScreen from "./components/QrScanner.jsx";
import HistorialVisitasScreen from "./screens/HistorialVisitasScreen.jsx";
import PagosScreen from "./screens/PagosScreen.jsx";
import UsuariosScreen from "./screens/UsuariosScreen.jsx";
import PropiedadesScreen from "./screens/PropiedadesScreen.jsx";
import AnunciosScreen from "./screens/AnunciosScreen.jsx";
import AsambleasScreen from "./screens/AsambleasScreen.jsx";
import PreRegisterVisitsScreen from "./screens/PreRegisterVisitsScreen.jsx";
import OwnerHomeScreen from "./screens/OwnerHomeScreen.jsx";
import OwnerPaymentsScreen from "./screens/OwnerPaymentsScreen.jsx";
import SecurityVisitRegisterScreen from "./screens/SecurityVisitRegisterScreen.jsx";
import PanicScreen from "./screens/PanicScreen.jsx";
import ReservasScreen from "./screens/ReservasScreen.jsx";
import DashboardScreen from "./screens/DashboardScreen.jsx";
import SuperAdminDashboardScreen from "./screens/SuperAdminDashboardScreen.jsx";
import PerfilScreen from "./screens/PerfilScreen.jsx";
import MisReservasScreen from "./screens/MisReservasScreen.jsx";
import SecurityHistoryScreen from "./screens/SecurityHistoryScreen.jsx";
import { onEnterKey } from "./utils/keyboard.js";
import { parseFecha } from "./screens/dashboardUtils.js";

const PHONE_PREFIX = "+591";
const stripPhonePrefix = (phone) => (phone || "").replace(/^\+591[\s-]*/, "");
const MAX_AREA_IMAGES = 6;

function Dashboard({ user, onUpdateUser, onLogout, isDarkMode, onToggleDark: toggleDarkMode }) {
  const PANIC_ALERTS_STORAGE_KEY = "ignitel_panic_alerts";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(
    user.role === "Propietario" || user.role === "Inquilino"
      ? "Inicio"
      : user.role === "Seguridad"
        ? "Dashboard"
        : "Dashboard"
  );
  const [isPayExpensesModalOpen, setIsPayExpensesModalOpen] = useState(false);
  const [payForm, setPayForm] = useState({ monto: "", referencia: "", motivo: "", tipo: "Expensa", file: null });
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payMsg, setPayMsg] = useState("");
  const [isPanicConfirmOpen, setIsPanicConfirmOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [menuBadges, setMenuBadges] = useState({});
  const knownPanicIdsRef = useRef(new Set());
  const knownAnuncioIdsRef = useRef(new Set());
  const knownPagoIdsRef = useRef(new Set());
  const lastResidentCargoExtraRef = useRef(null);
  const lastReservaEstadosRef = useRef(new Map());
  const knownVisitIdsRef = useRef(new Set());
  const [visitMode, setVisitMode] = useState("peatonal");
  const [visitRegistrationForm, setVisitRegistrationForm] = useState({
    fullName: "",
    idNumber: "",
    property: "",
    motive: "",
    plate: "",
    expiresAt: ""
  });
  const [visitFiles, setVisitFiles] = useState({
    idDocument: null,
    idDocumentBack: null,
    platePhoto: null
  });
  const [visitPasses, setVisitPasses] = useState([
    {
      id: 1,
      code: "QR-482917",
      mode: "vehicular",
      fullName: "María Gómez",
      idNumber: "12345678",
      property: "Calle Principal - A-101",
      motive: "Visita familiar",
      plate: "ABC-123",
      createdBy: "Juan Pérez",
      createdAt: "Hoy",
      status: "Activo"
    },
    {
      id: 2,
      code: "QR-729415",
      mode: "peatonal",
      fullName: "Pedro García",
      idNumber: "87654321",
      property: "Calle Principal - A-101",
      motive: "Entrega de encomienda",
      plate: "-",
      createdBy: "Juan Pérez",
      createdAt: "Ayer",
      status: "Escaneado"
    }
  ]);
  const [selectedVisitPassId, setSelectedVisitPassId] = useState(1);
  const [panicAlerts, setPanicAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem(PANIC_ALERTS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [reservationCondoFilter, setReservationCondoFilter] = useState("todos");
  const [reservationCondoDropdownOpen, setReservationCondoDropdownOpen] = useState(false);
  const [isCreateAnnouncementModalOpen, setIsCreateAnnouncementModalOpen] = useState(false);
  const [isEditAnuncioModalOpen, setIsEditAnuncioModalOpen] = useState(false);
  const [editingAnuncio, setEditingAnuncio] = useState(null);
  const [isCreateAsambleaModalOpen, setIsCreateAsambleaModalOpen] = useState(false);
  // Profile
  const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem(`profilePhoto_${user?.email}`) || null);
  const [isCreateCondoModalOpen, setIsCreateCondoModalOpen] = useState(false);
  const [isEditCondoModalOpen,   setIsEditCondoModalOpen]   = useState(false);
  const [editingCondo,           setEditingCondo]           = useState(null);
  const [isDeleteCondoConfirmOpen, setIsDeleteCondoConfirmOpen] = useState(false);
  const [condoToDelete,            setCondoToDelete]            = useState(null);
  const [isCreatePropertyModalOpen, setIsCreatePropertyModalOpen] = useState(false);
  const [isEditPropertyModalOpen, setIsEditPropertyModalOpen] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const genTempPassword = () => `Condo${Math.floor(1000 + Math.random() * 9000)}!`;
  const [newUserForm, setNewUserForm] = useState({ nombre: "", apellido: "", email: "", rol: "Administrador", telefono: "", contrasena: genTempPassword(), condoId: "" });
  const [newUserError, setNewUserError] = useState("");
  const [newUserSuccess, setNewUserSuccess] = useState(null);
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createAnnouncementLoading, setCreateAnnouncementLoading] = useState(false);
  const [createAnnouncementError, setCreateAnnouncementError] = useState('');
  const [createAsambleaLoading, setCreateAsambleaLoading] = useState(false);
  const [createAsambleaError, setCreateAsambleaError] = useState('');
  // Áreas sociales y reservas
  const [areasSociales, setAreasSociales] = useState([]);
  const [reservasAreas, setReservasAreas] = useState([]);
  const [isCreateAreaModalOpen, setIsCreateAreaModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [areaForm, setAreaForm] = useState({ nombre: '', descripcion: '', precio: '', condo: '', imagenesNuevas: [], imagenesExistentes: [] });
  const [areaCondoDropdownOpen, setAreaCondoDropdownOpen] = useState(false);
  const [areaFormLoading, setAreaFormLoading] = useState(false);
  const [areaFormError, setAreaFormError] = useState('');
  const [formData, setFormData] = useState({
    calle: "",
    casaNumber: "",
    nombre: "",
    cedula: "",
    oficina: "",
    celular: "",
    correo: "",
    nombreResidente: "",
    cedulaResidente: "",
    oficinaResidente: "",
    celularResidente: "",
    correoResidente: "",
    emergenciaCon: "",
    emergenciaTelefono: "",
    emergenciaOtro: ""
  });
  const [personasResidentes, setPersonasResidentes] = useState([]);
  const [personalServicio, setPersonalServicio] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [mascotas, setMascotas] = useState([]);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  // QR de pago y expensas
  const [condoPaymentQr, setCondoPaymentQr] = useState('');
  const [residentExpensas, setResidentExpensas] = useState(0);
  const [residentCargoExtra, setResidentCargoExtra] = useState(0);
  const [residentCargoNota, setResidentCargoNota] = useState('');
  const [residentPropId, setResidentPropId] = useState('');
  const [residentPropCode, setResidentPropCode] = useState('');
  const [residentPropStreet, setResidentPropStreet] = useState('');
  // Propiedades donde el usuario es propietario o inquilino (pre-registro de visitas)
  const [myProperties, setMyProperties] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editRoleDropdownOpen, setEditRoleDropdownOpen] = useState(false);
  const [createRoleDropdownOpen, setCreateRoleDropdownOpen] = useState(false);
  const [createCondoDropdownOpen, setCreateCondoDropdownOpen] = useState(false);
  const [createPropertyCondoDropdownOpen, setCreatePropertyCondoDropdownOpen] = useState(false);
  const [createAnnouncementCondoDropdownOpen, setCreateAnnouncementCondoDropdownOpen] = useState(false);
  const [announcementTargetDropdownOpen, setAnnouncementTargetDropdownOpen] = useState(false);
  const [createPropertyForm, setCreatePropertyForm] = useState({
    calle: "",
    numero: "",
    bloque: "",
    propietario: "",
    inquilinos: [""],
    condoId: ""
  });
  const [editingPropertyForm, setEditingPropertyForm] = useState({
    id: null,
    calle: "",
    numero: "",
    bloque: "",
    propietario: "",
    inquilinos: [""],
    deuda: 0
  });
  const [usuariosData, setUsuariosData] = useState([
    { id: 1, name: "Super Admin", email: "superadmin@condominio.com", phone: "+1234567890", role: "Super Admin", property: "-", condo: "General" },
    { id: 2, name: "María González", email: "admin@condominio.com", phone: "+1234567891", role: "Administrador", property: "-", condo: "General" },
    { id: 3, name: "Juan Pérez", email: "juan@email.com", phone: "+1234567892", role: "Propietario", property: "Calle Principal - A-101", condo: "Calle Principal" },
    { id: 4, name: "Ana Martínez", email: "ana@email.com", phone: "+1234567893", role: "Inquilino", property: "Calle Principal - A-102", condo: "Calle Principal" },
    { id: 5, name: "Carlos Ramírez", email: "carlos@email.com", phone: "+1234567894", role: "Seguridad", property: "-", condo: "General" },
    { id: 6, name: "Laura Sánchez", email: "laura@email.com", phone: "+1234567895", role: "Propietario", property: "Calle Secundaria - B-201", condo: "Calle Secundaria" }
  ]);
  const [condominiosData, setCondominiosData] = useState([
    { id: 1, name: "Calle Principal", type: "Condominio" },
    { id: 2, name: "Calle Secundaria", type: "Edificio" }
  ]);
  const [selectedManagementCondoId, setSelectedManagementCondoId] = useState(0);
  const [condoDropdownOpen, setCondoDropdownOpen] = useState(false);
  const [selectedDashboardCondoId, setSelectedDashboardCondoId] = useState("todos");
  const [newCondoForm, setNewCondoForm] = useState({ name: "", type: "Condominio", address: "" });
  const [createOwnerDropdownOpen, setCreateOwnerDropdownOpen] = useState(false);
  const [editOwnerDropdownOpen, setEditOwnerDropdownOpen] = useState(false);
  const [editTenantDropdownOpenIdx, setEditTenantDropdownOpenIdx] = useState(null);
  const [createTenantDropdownOpenIndex, setCreateTenantDropdownOpenIndex] = useState(null);
  const [propiedadesData, setPropiedadesData] = useState([
    { id: 1, code: "A-101", street: "Calle Principal", block: "A", owner: "Juan Perez", tenant: "-", debt: 0, condo: "Calle Principal" },
    { id: 2, code: "A-102", street: "Calle Principal", block: "A", owner: "Laura Sanchez", tenant: "Ana Martinez", debt: 350, condo: "Calle Principal" },
    { id: 3, code: "B-201", street: "Calle Secundaria", block: "B", owner: "Laura Sanchez", tenant: "-", debt: 120, condo: "Calle Secundaria" },
    { id: 4, code: "B-202", street: "Calle Secundaria", block: "B", owner: "Juan Perez", tenant: "-", debt: 550, condo: "Calle Secundaria" }
  ]);
  const [pagosData, setPagosData] = useState([
    {
      id: 1,
      propiedad: "Calle Principal - A-101",
      propietario: "Juan Perez",
      tipo: "Expensa",
      monto: 250,
      fecha: "31/3/2026",
      estado: "aprobado"
    },
    {
      id: 2,
      propiedad: "Calle Principal - A-102",
      propietario: "Laura Sanchez",
      tipo: "Expensa",
      monto: 250,
      fecha: "4/4/2026",
      estado: "pendiente"
    },
    {
      id: 3,
      propiedad: "Calle Secundaria - B-201",
      propietario: "Laura Sanchez",
      tipo: "Reserva",
      monto: 120,
      fecha: "27/3/2026",
      estado: "aprobado"
    }
  ]);
  const [anunciosData, setAnunciosData] = useState([
    {
      id: 1,
      title: "Recoleccion de Basura",
      message: "Recordatorio: La recoleccion de basura sera manana miercoles a las 7:00 AM. Por favor, saquen sus contenedores.",
      condo: "Calle Principal",
      target: "todos",
      createdByRole: "Administrador",
      dateLabel: "14 de abril de 2026"
    },
    {
      id: 2,
      title: "Pago de Expensas",
      message: "Les recordamos que el plazo para el pago de expensas vence el dia 30 de cada mes.",
      condo: "Calle Principal",
      target: "propietarios",
      createdByRole: "Administrador",
      dateLabel: "13 de abril de 2026"
    },
    {
      id: 3,
      title: "Mantenimiento de Piscina",
      message: "La piscina estara cerrada por mantenimiento del 20 al 22 de abril.",
      condo: "Calle Secundaria",
      target: "todos",
      createdByRole: "Administrador",
      dateLabel: "12 de abril de 2026"
    }
  ]);
  const [newAnnouncementForm, setNewAnnouncementForm] = useState({
    title: "",
    message: "",
    target: "todos",
    condo: ""
  });
  const [asambleasData, setAsambleasData] = useState([]);
  const [historialVisitasData, setHistorialVisitasData] = useState([]);
  const [newAsambleaForm, setNewAsambleaForm] = useState({
    title: "",
    startDate: "",
    dueDate: "",
    description: "",
  });
  const [newAsambleaFile, setNewAsambleaFile] = useState(null);
  const [editingAsamblea, setEditingAsamblea] = useState(null);
  const [isEditAsambleaModalOpen, setIsEditAsambleaModalOpen] = useState(false);
  const [editAsambleaForm, setEditAsambleaForm] = useState({ title: "", startDate: "", dueDate: "", description: "" });
  const [editAsambleaFile, setEditAsambleaFile] = useState(null);

  useEffect(() => {
    const loadAll = async () => {
      const safe = fn => fn().catch(() => []);
      const isAdmin    = ["Super Admin", "Administrador"].includes(user.role);
      const isMgmt     = ["Super Admin", "Administrador", "Seguridad"].includes(user.role);
      const isResident = ["Propietario", "Inquilino"].includes(user.role);

      const [condos, usuarios, propiedades, pagos, anuncios, asambleas, visitas, historial, panic, areas, reservasAr] = await Promise.all([
        isAdmin ? safe(api.getCondominios)      : Promise.resolve([]),
        isAdmin ? safe(api.getUsuarios)         : Promise.resolve([]),
        isMgmt  ? safe(api.getPropiedades)      : Promise.resolve([]),
        safe(api.getPagos),
        safe(api.getAnuncios),
        safe(api.getAsambleas),
        safe(api.getVisitas),
        isMgmt  ? safe(api.getHistorialVisitas) : isResident ? safe(api.getMyVisitHistory) : Promise.resolve([]),
        safe(api.getPanicAlerts),
        !isMgmt || isAdmin ? safe(api.getAreasSociales)  : Promise.resolve([]),
        !isMgmt || isAdmin ? safe(api.getReservasAreas)  : Promise.resolve([]),
      ]);
      setAreasSociales(areas || []);
      setReservasAreas(reservasAr || []);
      setCondominiosData(condos);
      setUsuariosData(usuarios);
      setPropiedadesData(propiedades);
      setPagosData(pagos);
      setAnunciosData(anuncios);
      setAsambleasData(asambleas);
      setVisitPasses(visitas);
      setHistorialVisitasData(historial);
      setPanicAlerts(panic);
      panic.forEach(a => knownPanicIdsRef.current.add(String(a.id)));
      anuncios.forEach(a => knownAnuncioIdsRef.current.add(String(a.id)));
      pagos.forEach(p => knownPagoIdsRef.current.add(String(p.id)));
    };
    loadAll();
  }, []);


  const addToast = (message, type = "info") => {
    const id = Date.now();
    setToasts(prev => [{ id, message, type }, ...prev].slice(0, 3));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
  };

  // ── Utilidad PDF: abre ventana con tabla estilizada lista para imprimir ──────
  const exportToPDF = async ({ title, subtitle, headers, rows, totals }) => {
    try {
      // jsPDF pesa ~350KB y solo se necesita al exportar — se carga bajo demanda
      const { jsPDF }    = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: headers.length > 5 ? "landscape" : "portrait" });
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text(title, 14, 18);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(subtitle, 14, 24);

      doc.setFontSize(11);
      doc.setTextColor(79, 87, 247);
      doc.text("Ignitel", pageWidth - 14, 18, { align: "right" });

      autoTable(doc, {
        startY: 30,
        head: [headers],
        body: rows,
        foot: totals ? [totals] : undefined,
        styles: { fontSize: 8, cellPadding: 3, textColor: [51, 65, 85] },
        headStyles: { fillColor: [79, 87, 247], textColor: 255, fontStyle: "bold" },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 255] },
      });

      const slug = title
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      const date = new Date().toISOString().slice(0, 10);
      doc.save(`${slug}_${date}.pdf`);
      addToast(`${rows.length} registros exportados a PDF.`, "success");
    } catch (err) {
      console.error("Error exportando PDF:", err);
      addToast("Error al generar el PDF.", "error");
    }
  };

  // Polling en tiempo real cada 30 segundos
  useEffect(() => {
    const poll = async () => {
      try {
        // Panic alerts — visible para Seguridad y Admin
        if (["Seguridad", "Administrador", "Super Admin"].includes(user.role)) {
          const alerts = await api.getPanicAlerts();
          const newAlerts = alerts.filter(a => !knownPanicIdsRef.current.has(String(a.id)));
          if (newAlerts.length > 0) {
            newAlerts.forEach(a => {
              knownPanicIdsRef.current.add(String(a.id));
              addToast(`🚨 Alerta de pánico: ${a.resident} — ${a.address} ${a.unit}`, "panic");
            });
            setPanicAlerts(alerts);
            setMenuBadges(prev => ({ ...prev, panic: (prev.panic || 0) + newAlerts.length }));
          }
        }

        // Anuncios nuevos — todos los roles
        const anuncios = await api.getAnuncios();
        const newAnuncios = anuncios.filter(a => !knownAnuncioIdsRef.current.has(String(a.id)));
        if (newAnuncios.length > 0) {
          newAnuncios.forEach(a => {
            knownAnuncioIdsRef.current.add(String(a.id));
            addToast(`📢 Nuevo anuncio: ${a.title}`, "anuncio");
          });
          setAnunciosData(anuncios);
          setMenuBadges(prev => ({ ...prev, anuncios: (prev.anuncios || 0) + newAnuncios.length }));
        }

        // Pagos pendientes — Admin/SuperAdmin
        if (["Administrador", "Super Admin"].includes(user.role)) {
          const pagos = await api.getPagos();
          const newPagos = pagos.filter(p => !knownPagoIdsRef.current.has(String(p.id)));
          if (newPagos.length > 0) {
            newPagos.forEach(p => {
              knownPagoIdsRef.current.add(String(p.id));
              addToast(`💰 Nuevo pago pendiente: ${p.propiedad} — Bs. ${p.monto}`, "pago");
            });
            setPagosData(pagos);
            setMenuBadges(prev => ({ ...prev, pagos: (prev.pagos || 0) + newPagos.length }));
          }
        }

        // Visitas nuevas — Seguridad (sin toast: solo mantiene la lista al día)
        if (user.role === "Seguridad") {
          const visitas = await api.getVisitas();
          const newVisitas = visitas.filter(v => !knownVisitIdsRef.current.has(String(v.id)));
          if (newVisitas.length > 0) {
            newVisitas.forEach(v => knownVisitIdsRef.current.add(String(v.id)));
            setVisitPasses(visitas);
          }
        }

        // Expensas/cargo extra — Propietario/Inquilino: si el admin asigna o
        // cambia el monto, se refleja solo sin esperar a un refresh manual.
        if (["Propietario", "Inquilino"].includes(user.role)) {
          const prop = await api.getMyProperty();
          const nuevoCargoExtra = Number(prop.cargoExtra) || 0;
          if (lastResidentCargoExtraRef.current !== null && nuevoCargoExtra > lastResidentCargoExtraRef.current) {
            addToast(`💰 Se te asignó un cargo extra: Bs. ${(nuevoCargoExtra - lastResidentCargoExtraRef.current).toLocaleString()}`, "pago");
          }
          lastResidentCargoExtraRef.current = nuevoCargoExtra;
          setResidentExpensas(Number(prop.expensaMensual) || 0);
          setResidentCargoExtra(nuevoCargoExtra);
          setResidentCargoNota(prop.notaCargo || '');
        }

        // Reservas de áreas — se refresca para reflejar aprobaciones/rechazos
        // del admin (o solicitudes nuevas de residentes) sin esperar un refresh manual.
        if (["Propietario", "Inquilino", "Administrador", "Super Admin"].includes(user.role)) {
          const reservas = await api.getReservasAreas();
          if (["Propietario", "Inquilino"].includes(user.role)) {
            reservas.forEach(r => {
              if (r.propietario === user.name) {
                const prevEstado = lastReservaEstadosRef.current.get(r.id);
                if (prevEstado && prevEstado !== r.estado && ["aprobada", "rechazada"].includes(r.estado)) {
                  addToast(`📅 Tu reserva de ${r.areaNombre} fue ${r.estado}`, r.estado === "aprobada" ? "pago" : "error");
                }
                lastReservaEstadosRef.current.set(r.id, r.estado);
              }
            });
          }
          setReservasAreas(reservas);
        }
      } catch { /* sin conexión, ignorar */ }
    };

    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [user.role]);

  // Polling rápido exclusivo para pánico (cada 10s) — notifica a seguridad/admin inmediatamente
  useEffect(() => {
    if (!["Seguridad", "Administrador", "Super Admin"].includes(user.role)) return;
    const pollPanic = async () => {
      try {
        const alerts = await api.getPanicAlerts();
        const newAlerts = alerts.filter(a => !knownPanicIdsRef.current.has(String(a.id)));
        if (newAlerts.length > 0) {
          newAlerts.forEach(a => {
            knownPanicIdsRef.current.add(String(a.id));
            addToast(`🚨 ALERTA DE PÁNICO: ${a.resident} — ${a.address} ${a.unit}`, "panic");
          });
          setPanicAlerts(alerts);
          setMenuBadges(prev => ({ ...prev, panic: (prev.panic || 0) + newAlerts.length }));
        }
      } catch { /* ignorar */ }
    };
    const panicInterval = setInterval(pollPanic, 10000);
    return () => clearInterval(panicInterval);
  }, [user.role]);

  const clearBadge = (key) => setMenuBadges(prev => ({ ...prev, [key]: 0 }));

  const handleCreateUserKeyDown = (e) => {
    if (e.key === "Enter" && !createUserLoading) {
      e.preventDefault();
      handleCreateUser();
    }
  };

  const handleCreateUser = async () => {
    const { nombre, apellido, email, rol, telefono, contrasena, condoId } = newUserForm;
    if (!nombre.trim()) { setNewUserError("El nombre es obligatorio."); return; }
    if (!email.trim())  { setNewUserError("El correo electrónico es obligatorio."); return; }

    const fullName = `${nombre.trim()} ${apellido.trim()}`.trim();
    const condo = isSuperAdministrator
      ? (condoId ? (condominiosData.find(c => String(c.id) === String(condoId))?.name || "General") : "General")
      : (user.condo || "General");

    try {
      setNewUserError("");
      setCreateUserLoading(true);
      const plainPassword = contrasena.trim() || "123456";
      const newUser = await api.createUsuario({
        name:     fullName,
        email:    email.trim(),
        phone:    telefono.trim() ? `${PHONE_PREFIX} ${telefono.trim()}` : "",
        role:     rol,
        property: "-",
        condo,
        password: plainPassword,
      });
      setUsuariosData([newUser, ...usuariosData]);
      setNewUserSuccess({
        name:      fullName,
        email:     email.trim(),
        password:  newUser.tempPassword || plainPassword,
        emailSent: newUser.emailSent,
        emailError: newUser.emailError,
      });
      setNewUserForm({ nombre: "", apellido: "", email: "", rol: isSuperAdministrator ? "Administrador" : "Propietario", telefono: "", contrasena: "", condoId: "" });
    } catch (err) {
      setNewUserError(err.message || "Error al guardar. Verificá que el correo no esté registrado.");
    } finally {
      setCreateUserLoading(false);
    }
  };

  const handleSaveUserEdit = async () => {
    if (!editingUser) return;
    try {
      const updated = await api.updateUsuario(String(editingUser.id), {
        name: editingUser.name,
        email: editingUser.email,
        phone: editingUser.phone,
        role: editingUser.role
      });
      setUsuariosData(usuariosData.map(u => (String(u.id) === String(editingUser.id) ? { ...u, ...updated } : u)));
      setIsEditUserModalOpen(false);
    } catch (err) {
      console.error("Error actualizando usuario:", err.message);
      addToast(err.message || "Error al actualizar el usuario.", "error");
    }
  };

  const handleAdminResetPassword = async () => {
    const pw = document.getElementById("admin-reset-pw").value.trim();
    if (!pw) return addToast("Ingresá la nueva contraseña", "warning");
    if (pw.length < 8) return addToast("Mínimo 8 caracteres", "warning");
    try {
      await api.changePassword(String(editingUser.id), { newPassword: pw });
      addToast(`Contraseña de ${editingUser.name} restablecida`, "success");
      document.getElementById("admin-reset-pw").value = "";
    } catch (e) { addToast(e.message, "error"); }
  };

  const selectedReservationCondoName =
    reservationCondoFilter === "todos"
      ? ""
      : (condominiosData.find((condo) => String(condo.id) === reservationCondoFilter)?.name || "");

  const reservasData = pagosData.filter((item) => item.tipo.toLowerCase() === "reserva");

  const filteredReservas = reservasData.filter((item) => {
    const byCondo = !selectedReservationCondoName || item.propiedad.toLowerCase().includes(selectedReservationCondoName.toLowerCase());
    return byCondo;
  });

  const residentProfile = usuariosData.find((item) => item.email === user.email) || { name: user.name, property: user.property || "-", phone: user.phone || "" };

  // Refleja al instante los cambios guardados desde "Mi Perfil" — en la sesión
  // actual (user) y en usuariosData si ya estaba cargado — para que pantallas
  // como el Botón de Pánico no queden con el nombre/teléfono viejo hasta recargar.
  const handleProfileUpdated = (updatedFields) => {
    onUpdateUser?.(updatedFields);
    setUsuariosData((prev) => prev.map((u) => (String(u.id) === String(user.id) ? { ...u, ...updatedFields } : u)));
  };
  const residentProperty = (residentPropCode && residentPropCode !== '-')
    ? `${residentPropStreet} - ${residentPropCode}`
    : residentProfile.property || user.property || "-";
  const [residentStreet, residentUnit = "-"] = residentProperty.split(" - ");

  // Pagos reales del propietario/inquilino
  const myPagos = pagosData.filter(p =>
    p.propietario === user.name || p.propiedad === residentProperty
  );

  // Cuánto pagó aprobado en total — la expensa se acumula sin reiniciarse cada
  // mes, así que lo pagado tiene que descontarse de todo lo histórico, no solo
  // de este mes, para que no reaparezca como deuda ya cubierta.
  const paidAllTime = myPagos
    .filter(p => p.estado === 'aprobado')
    .reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const totalDue = Math.max(0, (residentExpensas + residentCargoExtra) - paidAllTime);

  useEffect(() => {
    localStorage.setItem(PANIC_ALERTS_STORAGE_KEY, JSON.stringify(panicAlerts));
  }, [panicAlerts]);

  const handleConfirmPanicAlert = async () => {
    if (user.role !== "Propietario" && user.role !== "Inquilino") return;
    try {
      const newAlert = await api.createPanicAlert({
        resident: residentProfile.name,
        phone: residentProfile.phone || "+1234567892",
        address: residentStreet,
        unit: residentUnit
      });
      setPanicAlerts([newAlert, ...panicAlerts]);
      setIsPanicConfirmOpen(false);
    } catch (err) {
      console.error("Error enviando alerta de panico:", err.message);
    }
  };

  // Carga info de pago del condominio y propiedad del residente
  useEffect(() => {
    if (['Propietario', 'Inquilino'].includes(user.role)) {
      api.getMyCondoPaymentQr().then(d => {
        setCondoPaymentQr(d.paymentQrUrl || '');
      }).catch(() => {});
      api.getMyProperty().then(d => {
        setResidentExpensas(Number(d.expensaMensual) || 0);
        setResidentCargoExtra(Number(d.cargoExtra) || 0);
        setResidentCargoNota(d.notaCargo || '');
        setResidentPropId(d.id || '');
        if (d.code && d.code !== '-') {
          setResidentPropCode(d.code);
          setResidentPropStreet(d.street || '');
        }
      }).catch(() => {});
      api.getMyProperties().then(list => {
        setMyProperties(list);
        if (list.length > 0) {
          setVisitRegistrationForm(prev => prev.property ? prev : { ...prev, property: list[0].label });
        }
      }).catch(() => {});
    }
  }, [user.role]);

  // ── Áreas sociales handlers ──────────────────────────────────
  const handleSaveArea = async () => {
    if (!areaForm.nombre.trim()) { setAreaFormError('El nombre es requerido'); return; }
    if (isSuperAdministrator && !editingArea && !areaForm.condo) { setAreaFormError('Seleccioná un condominio'); return; }
    setAreaFormLoading(true); setAreaFormError('');
    try {
      const fd = new FormData();
      fd.append('nombre', areaForm.nombre.trim());
      fd.append('descripcion', areaForm.descripcion);
      fd.append('precio', areaForm.precio || '0');
      if (isSuperAdministrator && areaForm.condo) fd.append('condo', areaForm.condo);
      areaForm.imagenesNuevas.forEach(({ file }) => fd.append('imagenes', file));

      if (editingArea) {
        fd.append('imagenesActuales', JSON.stringify(areaForm.imagenesExistentes));
        const updated = await api.updateAreaSocial(editingArea.id, fd);
        setAreasSociales(prev => prev.map(a => a.id === editingArea.id ? updated : a));
      } else {
        const nueva = await api.createAreaSocial(fd);
        setAreasSociales(prev => [nueva, ...prev]);
      }
      areaForm.imagenesNuevas.forEach(({ preview }) => URL.revokeObjectURL(preview));
      setIsCreateAreaModalOpen(false);
      setEditingArea(null);
      setAreaForm({ nombre: '', descripcion: '', precio: '', condo: '', imagenesNuevas: [], imagenesExistentes: [] });
    } catch (e) { setAreaFormError(e.message); }
    finally { setAreaFormLoading(false); }
  };

  const handleCreateAnnouncement = async () => {
    if (!newAnnouncementForm.title.trim() || !newAnnouncementForm.message.trim()) return;
    setCreateAnnouncementLoading(true);
    setCreateAnnouncementError('');
    try {
      const condoName = user.role === 'Super Admin'
        ? (newAnnouncementForm.condo || condominiosData[0]?.name || 'General')
        : user.condo || condominiosData[0]?.name || 'General';

      const newAnnouncement = await api.createAnuncio({
        title:         newAnnouncementForm.title.trim(),
        message:       newAnnouncementForm.message.trim(),
        condo:         condoName,
        target:        newAnnouncementForm.target,
        createdByRole: user.role,
      });
      setAnunciosData(prev => [newAnnouncement, ...prev]);
      setNewAnnouncementForm({ title: '', message: '', target: 'todos', condo: '' });
      setIsCreateAnnouncementModalOpen(false);
    } catch (err) {
      setCreateAnnouncementError(err.message || 'Error al publicar el anuncio.');
    } finally {
      setCreateAnnouncementLoading(false);
    }
  };

  const handleSaveAnuncioEdit = async () => {
    if (!editingAnuncio) return;
    try {
      const updated = await api.updateAnuncio(String(editingAnuncio.id), {
        title: editingAnuncio.title,
        message: editingAnuncio.message,
        target: editingAnuncio.target,
        ...(isSuperAdministrator && { condo: editingAnuncio.condo }),
      });
      setAnunciosData(anunciosData.map((a) => (a.id === editingAnuncio.id ? { ...a, ...updated } : a)));
      setIsEditAnuncioModalOpen(false);
      setEditingAnuncio(null);
    } catch (err) {
      console.error("Error actualizando anuncio:", err.message);
    }
  };

  const handleCreateAsamblea = async () => {
    if (!newAsambleaForm.title.trim() || !newAsambleaForm.startDate || !newAsambleaForm.dueDate || !newAsambleaForm.description.trim()) {
      setCreateAsambleaError('Completá todos los campos obligatorios.');
      return;
    }
    setCreateAsambleaLoading(true);
    setCreateAsambleaError('');
    try {
      const condoName = user.role === 'Super Admin'
        ? (selectedManagementCondoName || condominiosData[0]?.name || 'General')
        : user.condo || condominiosData[0]?.name || 'General';
      const formData = new FormData();
      formData.append('title',       newAsambleaForm.title.trim());
      formData.append('startDate',   newAsambleaForm.startDate);
      formData.append('dueDate',     newAsambleaForm.dueDate);
      formData.append('description', newAsambleaForm.description.trim());
      formData.append('condo',       condoName);
      if (newAsambleaFile) formData.append('document', newAsambleaFile);
      const newAsamblea = await api.createAsamblea(formData);
      setAsambleasData(prev => [newAsamblea, ...prev]);
      setNewAsambleaForm({ title: "", startDate: "", dueDate: "", description: "" });
      setNewAsambleaFile(null);
      setIsCreateAsambleaModalOpen(false);
    } catch (err) {
      setCreateAsambleaError(err.message || 'Error al crear la asamblea.');
    } finally {
      setCreateAsambleaLoading(false);
    }
  };

  const handleEditAsamblea = async () => {
    if (!editAsambleaForm.title.trim() || !editAsambleaForm.dueDate) return;
    try {
      const formData = new FormData();
      formData.append('title',       editAsambleaForm.title.trim());
      formData.append('startDate',   editAsambleaForm.startDate);
      formData.append('dueDate',     editAsambleaForm.dueDate);
      formData.append('description', editAsambleaForm.description.trim());
      formData.append('condo', editingAsamblea.condo || 'General');
      if (editAsambleaFile) formData.append('document', editAsambleaFile);
      const updated = await api.updateAsamblea(editingAsamblea.id, formData);
      setAsambleasData(asambleasData.map(a => String(a.id) === String(editingAsamblea.id) ? { ...a, ...updated } : a));
      setIsEditAsambleaModalOpen(false);
      setEditingAsamblea(null);
    } catch (err) {
      console.error("Error editando asamblea:", err.message);
    }
  };

  const getPropertyTenants = (propiedad) => {
    if (Array.isArray(propiedad.tenants)) {
      return propiedad.tenants.filter(Boolean);
    }
    if (propiedad.tenant && propiedad.tenant !== "-") {
      return [propiedad.tenant];
    }
    return [];
  };

  const addCreateTenantField = () => {
    setCreatePropertyForm({ ...createPropertyForm, inquilinos: [...createPropertyForm.inquilinos, ""] });
    setCreateTenantDropdownOpenIndex(null);
  };

  const removeCreateTenantField = (index) => {
    const nextTenants = createPropertyForm.inquilinos.filter((_, idx) => idx !== index);
    setCreatePropertyForm({
      ...createPropertyForm,
      inquilinos: nextTenants.length ? nextTenants : [""]
    });
    setCreateTenantDropdownOpenIndex((current) => (current === index ? null : current > index ? current - 1 : current));
  };

  const updateCreateTenantField = (index, value) => {
    const nextTenants = createPropertyForm.inquilinos.map((tenant, idx) => (idx === index ? value : tenant));
    setCreatePropertyForm({ ...createPropertyForm, inquilinos: nextTenants });
  };

  const addEditTenantField = () => {
    setEditingPropertyForm({ ...editingPropertyForm, inquilinos: [...editingPropertyForm.inquilinos, ""] });
  };

  const removeEditTenantField = (index) => {
    const nextTenants = editingPropertyForm.inquilinos.filter((_, idx) => idx !== index);
    setEditingPropertyForm({
      ...editingPropertyForm,
      inquilinos: nextTenants.length ? nextTenants : [""]
    });
  };

  const updateEditTenantField = (index, value) => {
    const nextTenants = editingPropertyForm.inquilinos.map((tenant, idx) => (idx === index ? value : tenant));
    setEditingPropertyForm({ ...editingPropertyForm, inquilinos: nextTenants });
  };

  const handleCreateProperty = async () => {
    const selectedCondo = condominiosData.find(c => String(c.id) === String(createPropertyForm.condoId));
    const condoName = selectedCondo?.name || "";
    const isEdificio = selectedCondo?.type === "Edificio";
    if (!condoName || !createPropertyForm.calle.trim() || !createPropertyForm.numero.trim() || !createPropertyForm.propietario.trim()) {
      return;
    }
    if (isEdificio && !createPropertyForm.bloque.trim()) return;
    const tenants = createPropertyForm.inquilinos.filter((item) => item && item !== "-");
    try {
      const newProperty = await api.createPropiedad({
        code: createPropertyForm.numero.trim(),
        street: createPropertyForm.calle.trim(),
        block: isEdificio ? createPropertyForm.bloque.trim() : "-",
        owner: createPropertyForm.propietario,
        tenants,
        debt: 0,
        condo: condoName
      });
      setPropiedadesData([newProperty, ...propiedadesData]);
      setCreatePropertyForm({ calle: "", numero: "", bloque: "", propietario: "", inquilinos: [""], condoId: "" });
      setIsCreatePropertyModalOpen(false);
    } catch (err) {
      console.error("Error creando propiedad:", err.message);
      addToast(err.message || "Error al crear la propiedad.", "error");
    }
  };

  const handleSavePropertyEdit = async () => {
    if (!editingPropertyForm.calle.trim() || !editingPropertyForm.numero.trim() || !editingPropertyForm.bloque.trim() || !editingPropertyForm.propietario.trim()) {
      return;
    }
    const tenants = editingPropertyForm.inquilinos.filter((item) => item && item !== "-");
    const debt = Number.isNaN(Number(editingPropertyForm.deuda)) ? 0 : Math.max(0, Number(editingPropertyForm.deuda));
    try {
      const updated = await api.updatePropiedad(String(editingPropertyForm.id), {
        street: editingPropertyForm.calle.trim(),
        code: editingPropertyForm.numero.trim(),
        block: editingPropertyForm.bloque.trim(),
        owner: editingPropertyForm.propietario,
        tenants,
        debt
      });
      setPropiedadesData(
        propiedadesData.map((p) => String(p.id) === String(editingPropertyForm.id) ? { ...p, ...updated } : p)
      );
      setIsEditPropertyModalOpen(false);
    } catch (err) {
      console.error("Error actualizando propiedad:", err.message);
      addToast(err.message || "Error al actualizar la propiedad.", "error");
    }
  };

  const handleSavePropertyEditKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSavePropertyEdit();
    }
  };

  const addPersonaResidente = () => {
    setPersonasResidentes([...personasResidentes, { id: Date.now(), nombre: "", parentesco: "", celular: "" }]);
  };

  const removePersonaResidente = (id) => {
    setPersonasResidentes(personasResidentes.filter(p => p.id !== id));
  };

  const updatePersonaResidente = (id, field, value) => {
    setPersonasResidentes(personasResidentes.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const addPersonalServicio = () => {
    setPersonalServicio([...personalServicio, { id: Date.now(), nombre: "", laboral: "", celular: "" }]);
  };

  const removePersonalServicio = (id) => {
    setPersonalServicio(personalServicio.filter(p => p.id !== id));
  };

  const updatePersonalServicio = (id, field, value) => {
    setPersonalServicio(personalServicio.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const addVehiculo = () => {
    setVehiculos([...vehiculos, { id: Date.now(), tipo: "", color: "", placa: "" }]);
  };

  const removeVehiculo = (id) => {
    setVehiculos(vehiculos.filter(v => v.id !== id));
  };

  const updateVehiculo = (id, field, value) => {
    setVehiculos(vehiculos.map(v => 
      v.id === id ? { ...v, [field]: value } : v
    ));
  };

  const addMascota = () => {
    setMascotas([...mascotas, { id: Date.now(), nombre: "", raza: "", color: "" }]);
  };

  const removeMascota = (id) => {
    setMascotas(mascotas.filter(m => m.id !== id));
  };

  const updateMascota = (id, field, value) => {
    setMascotas(mascotas.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  const isSuperAdministrator = user.role === "Super Admin";

  const selectedManagementCondo = condominiosData.find((item) => item.id === selectedManagementCondoId) || null;
  const selectedManagementCondoName = selectedManagementCondo?.name || "";

  const handleCreateCondoKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateCondo();
    }
  };

  const handleCreateCondo = async () => {
    if (!newCondoForm.name.trim()) return;
    try {
      const newCondo = await api.createCondo({ name: newCondoForm.name.trim(), type: newCondoForm.type, address: newCondoForm.address.trim() });
      setCondominiosData((prev) => [newCondo, ...prev]);
      setSelectedManagementCondoId(newCondo.id);
      setSelectedDashboardCondoId(newCondo.id);
      setNewCondoForm({ name: "", type: "Condominio", address: "" });
      setIsCreateCondoModalOpen(false);
    } catch (err) {
      console.error("Error creando condominio:", err.message);
    }
  };

  const confirmDeleteCondo = async () => {
    if (!condoToDelete?.id) return;
    const idToDelete = String(condoToDelete.id);
    // Safety: never send "undefined" or "null" to the API
    if (!idToDelete || idToDelete === "undefined" || idToDelete === "null") {
      addToast("Error: ID de condominio inválido.", "error");
      setIsDeleteCondoConfirmOpen(false);
      setCondoToDelete(null);
      return;
    }
    try {
      await api.deleteCondo(idToDelete);
      // Refresh desde el backend en vez de filtro cliente — garantiza consistencia
      const updated = await api.getCondominios();
      setCondominiosData(updated);
      addToast("Condominio eliminado.", "success");
    } catch (err) {
      addToast("Error al eliminar el condominio.", "error");
    } finally {
      setIsDeleteCondoConfirmOpen(false);
      setCondoToDelete(null);
    }
  };

  const handleSaveCondoEditKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveCondoEdit();
    }
  };

  const handleSaveCondoEdit = async () => {
    if (!editingCondo?.name?.trim()) return;
    try {
      const oldName = condominiosData.find(c => c.id === editingCondo.id)?.name;
      const updated = await api.updateCondo(String(editingCondo.id), {
        name:    editingCondo.name.trim(),
        type:    editingCondo.type,
        address: editingCondo.address || "",
      });
      setCondominiosData(prev => prev.map(c => c.id === editingCondo.id ? { ...c, ...updated } : c));

      // El backend ya propaga el nuevo nombre a todas las tablas (cascadeCondoRename),
      // pero los datos ya cargados en memoria en esta sesión quedan con el nombre viejo
      // hasta que se recarga la página — se parchan acá para que se vean al instante.
      if (oldName && updated.name && oldName !== updated.name) {
        const patch = (item) => (item.condo === oldName ? { ...item, condo: updated.name } : item);
        setUsuariosData(prev => prev.map(patch));
        setPropiedadesData(prev => prev.map(patch));
        setPagosData(prev => prev.map(patch));
        setAnunciosData(prev => prev.map(patch));
        setAsambleasData(prev => prev.map(patch));
        setVisitPasses(prev => prev.map(patch));
        setHistorialVisitasData(prev => prev.map(patch));
        setPanicAlerts(prev => prev.map(patch));
        setAreasSociales(prev => prev.map(patch));
        setReservasAreas(prev => prev.map(patch));
      }

      setIsEditCondoModalOpen(false);
      setEditingCondo(null);
      addToast("Condominio actualizado.", "success");
    } catch (err) {
      addToast("Error al actualizar el condominio.", "error");
    }
  };

  const adminCondoName = isSuperAdministrator ? selectedManagementCondoName : user.condo;
  const propietariosOptions = usuariosData.filter((u) => u.role === "Propietario" && (!adminCondoName || u.condo === adminCondoName));
  const inquilinosOptions   = usuariosData.filter((u) => u.role === "Inquilino"   && (!adminCondoName || u.condo === adminCondoName));

  // Un inquilino solo puede estar asignado a una propiedad — excluye de las opciones
  // a quienes ya son inquilinos de OTRA propiedad (excludePropertyId = la que se está editando, si aplica).
  const getAvailableInquilinosOptions = (excludePropertyId) => {
    const takenElsewhere = new Set(
      propiedadesData
        .filter((p) => !excludePropertyId || String(p.id) !== String(excludePropertyId))
        .flatMap((p) => getPropertyTenants(p))
    );
    return inquilinosOptions.filter((item) => !takenElsewhere.has(item.name));
  };

  const adminMenu = [
    {
      label: "Dashboard",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 4H10V10H4V4ZM14 4H20V10H14V4ZM4 14H10V20H4V14ZM14 14H20V20H14V14Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    },
    {
      label: "Usuarios",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16 8C17.7 8 19 6.7 19 5C19 3.3 17.7 2 16 2C14.3 2 13 3.3 13 5C13 6.7 14.3 8 16 8ZM8 10C9.7 10 11 8.7 11 7C11 5.3 9.7 4 8 4C6.3 4 5 5.3 5 7C5 8.7 6.3 10 8 10ZM4 20V18.8C4 16.7 5.8 15 8 15H10C12.2 15 14 16.7 14 18.8V20M13 20V18.7C13 17.5 12.5 16.4 11.7 15.6C12.3 15.2 13 15 13.8 15H16.2C18.4 15 20 16.6 20 18.8V20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Propiedades",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 21H19M7 21V6H17V21M9.5 10H10.5M13.5 10H14.5M9.5 13.5H10.5M13.5 13.5H14.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    },
    {
      label: "Historial Visitas",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8V12L15 14M3 12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3C9.39 3 7.04 4.11 5.39 5.89M3 4V8H7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Pagos",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3V21M16.5 7.5C16.5 6.1 15 5 12.8 5H11.2C9 5 7.5 6.1 7.5 7.5C7.5 8.9 9 10 11.2 10H12.8C15 10 16.5 11.1 16.5 12.5C16.5 13.9 15 15 12.8 15H11.2C9 15 7.5 13.9 7.5 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Anuncios",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6H20V18H4V6ZM4 8L12 13L20 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Reservas",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 3V6M16 3V6M4 9H20M5 6H19C20.1 6 21 6.9 21 8V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V8C3 6.9 3.9 6 5 6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Asambleas",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3H14L18 7V21H6V3ZM14 3V7H18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Botón de Pánico",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8V12M12 16H12.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    }
  ];

  const ownerMenu = [
    {
      label: "Inicio",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 10.5L12 4L20 10.5V20H14V14H10V20H4V10.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Mis Pagos",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3V21M16.5 7.5C16.5 6.1 15 5 12.8 5H11.2C9 5 7.5 6.1 7.5 7.5C7.5 8.9 9 10 11.2 10H12.8C15 10 16.5 11.1 16.5 12.5C16.5 13.9 15 15 12.8 15H11.2C9 15 7.5 13.9 7.5 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Mis Reservas",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 3V6M16 3V6M4 9H20M5 6H19C20.1 6 21 6.9 21 8V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V8C3 6.9 3.9 6 5 6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Anuncios",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 17H9M17 10C17 7.2 14.8 5 12 5C9.2 5 7 7.2 7 10V12.7C7 13.5 6.7 14.2 6.1 14.8L5 15.9H19L17.9 14.8C17.3 14.2 17 13.5 17 12.7V10Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Asambleas",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3H14L18 7V21H6V3ZM14 3V7H18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Pre-registro Visitas",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 3H5V7M15 3H19V7M9 21H5V17M15 21H19V17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Botón de Pánico",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8V12M12 16H12.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    }
  ];

  const tenantMenu = [
    {
      label: "Inicio",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 10.5L12 4L20 10.5V20H14V14H10V20H4V10.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Mis Reservas",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 3V6M16 3V6M4 9H20M5 6H19C20.1 6 21 6.9 21 8V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V8C3 6.9 3.9 6 5 6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Anuncios",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 17H9M17 10C17 7.2 14.8 5 12 5C9.2 5 7 7.2 7 10V12.7C7 13.5 6.7 14.2 6.1 14.8L5 15.9H19L17.9 14.8C17.3 14.2 17 13.5 17 12.7V10Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Pre-registro Visitas",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 3H5V7M15 3H19V7M9 21H5V17M15 21H19V17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Botón de Pánico",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8V12M12 16H12.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    }
  ];

  const securityMenu = [
    {
      label: "Dashboard",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="14" y="3" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="14" y="14" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      label: "Registro Visitas",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3L4 7V12C4 17 7.5 20.8 12 22C16.5 20.8 20 17 20 12V7L12 3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Escanear QR",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 3H5V7M15 3H19V7M9 21H5V17M15 21H19V17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Historial",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8V12L15 14M3 12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Botón de Pánico",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8V12M12 16H12.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    }
  ];

  const isOwner = user.role === "Propietario";
  const isTenant = user.role === "Inquilino";
  const isResidentRole = isOwner || isTenant;
  const isSecurity = user.role === "Seguridad";
  const menu = isOwner ? ownerMenu : isTenant ? tenantMenu : isSecurity ? securityMenu : adminMenu;

  // Pases de visita de las propiedades del condominio del usuario de seguridad
  // (filtra por las etiquetas "calle - código" de las propiedades de su condo)
  const securityVisitPasses = (() => {
    if (!user.condo) return visitPasses;
    const propLabels = new Set(
      propiedadesData.filter(p => p.condo === user.condo).map(p => `${p.street} - ${p.code}`)
    );
    return visitPasses.filter(v => propLabels.has(v.property));
  })();

  // "Cobrado" se reinicia cada mes — el resto de las métricas (En Mora, Morosos)
  // queda acumulado, porque una deuda no desaparece sola al cambiar de mes.
  const nowForDashboard  = new Date();
  const curMonthDashboard = nowForDashboard.getMonth();
  const curYearDashboard  = nowForDashboard.getFullYear();

  const superAdminDashboards = condominiosData
    .map((condo) => {
      // Propiedades del condo
      const propertiesForCondo = propiedadesData.filter(p => p.condo === condo.name);

      // Sets para emparejar pagos
      const ownerNamesSet = new Set(propertiesForCondo.map(p => p.owner).filter(o => o && o !== '-'));
      const propLabels    = new Set(propertiesForCondo.map(p => `${p.street} - ${p.code}`));

      // Pagos del condo: emparejados por propietario o por label de propiedad
      const paymentsForCondo = pagosData.filter(pay =>
        ownerNamesSet.has(pay.propietario) || propLabels.has(pay.propiedad)
      );
      const approvedPayments = paymentsForCondo.filter(p => p.estado === 'aprobado');
      const pendingPayments  = paymentsForCondo.filter(p => p.estado === 'pendiente');

      // Cobrado = pagos aprobados del mes actual (se reinicia cada mes)
      const approvedPaymentsThisMonth = approvedPayments.filter(p => {
        const d = parseFecha(p.fecha);
        return d && d.getMonth() === curMonthDashboard && d.getFullYear() === curYearDashboard;
      });
      const collectedAmount = approvedPaymentsThisMonth.reduce((s, p) => s + (Number(p.monto) || 0), 0);

      // Propietarios con pago aprobado (no son morosos)
      const approvedOwners = new Set(approvedPayments.map(p => p.propietario).filter(Boolean));

      // Propiedades con expensa asignada sin pago aprobado → morosos reales
      const propsConExpensaC = propertiesForCondo.filter(p => (Number(p.expensaMensual) || 0) > 0);
      const propsMorosasC    = propsConExpensaC.filter(p => p.owner && p.owner !== '-' && !approvedOwners.has(p.owner));

      // En mora = expensas sin pagar + pagos pendientes + campo debt
      const debtTotal = propsMorosasC.reduce((s, p) => s + (Number(p.expensaMensual) || 0) + (Number(p.cargoExtra) || 0), 0)
        + pendingPayments.reduce((s, p) => s + (Number(p.monto) || 0), 0)
        + propertiesForCondo.reduce((s, p) => s + (Number(p.debt) || 0), 0);

      // Morosos únicos
      const morososSetC = new Set([
        ...propsMorosasC.map(p => p.owner),
        ...pendingPayments.map(p => p.propietario),
        ...propertiesForCondo.filter(p => (Number(p.debt) || 0) > 0).map(p => p.owner),
      ].filter(Boolean));
      const debtorsCount = morososSetC.size;

      // Visitas
      const condoNameLower  = condo.name.toLowerCase();
      const visitsForCondo  = visitPasses.filter(v => (v.property || '').toLowerCase().includes(condoNameLower));

      // Propietarios e inquilinos únicos
      const owners  = new Set(propertiesForCondo.filter(p => p.owner && p.owner !== '-').map(p => p.owner));
      const tenants = new Set(propertiesForCondo.flatMap(p => getPropertyTenants(p)).filter(t => t && t !== '-'));

      // Top 10 morosos
      const debtors = propertiesForCondo
        .map(p => {
          const label      = `${p.street} - ${p.code}`;
          const pending    = pendingPayments.filter(pay => pay.propiedad === label || pay.propietario === p.owner);
          const pendingAmt = pending.reduce((s, pay) => s + (Number(pay.monto) || 0), 0);
          const sinPago    = propsConExpensaC.includes(p) && !approvedOwners.has(p.owner)
            ? (Number(p.expensaMensual) || 0) + (Number(p.cargoExtra) || 0) : 0;
          return { property: label, debt: pendingAmt + sinPago + (Number(p.debt) || 0) };
        })
        .filter(d => d.debt > 0)
        .sort((a, b) => b.debt - a.debt)
        .slice(0, 10);

      return {
        id:                    condo.id,
        name:                  condo.name,
        type:                  condo.type,
        propertiesCount:       propertiesForCondo.length,
        ownersCount:           owners.size,
        tenantsCount:          tenants.size,
        debtTotal,
        debtorsCount,
        approvedPaymentsCount: approvedPayments.length,
        pendingPaymentsCount:  pendingPayments.length,
        collectedAmount,
        visitsCount:           visitsForCondo.length,
        debtors,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className={`dashboard-screen${isResidentRole ? " owner-layout" : ""}`}>

      {/* Mobile top bar */}
      <header className="mobile-topbar">
        <button
          type="button"
          className="hamburger-btn"
          aria-label="Abrir menú"
          onClick={() => setSidebarOpen(true)}
        >
          <span /><span /><span />
        </button>
        <span className="mobile-topbar-title">{activeSection}</span>
        <span className="mobile-topbar-role">{user.role}</span>
      </header>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`dashboard-sidebar${sidebarOpen ? " mobile-open" : ""}`}>
        <div className="dashboard-brand-wrap">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p className="dashboard-role">{user.role}</p>
            <button
              type="button"
              className="sidebar-close-btn"
              aria-label="Cerrar menú"
              onClick={() => setSidebarOpen(false)}
            >
              ✕
            </button>
          </div>
        </div>

        <nav className="dashboard-menu" aria-label="Menu principal">
          {menu.map((item) => {
            const badgeKey =
              item.label === "Botón de Pánico" || item.label === "Escanear QR" ? "panic"
              : item.label === "Anuncios" ? "anuncios"
              : item.label === "Pagos" ? "pagos"
              : null;
            const badgeCount = badgeKey ? (menuBadges[badgeKey] || 0) : 0;
            return (
              <button
                key={item.label}
                type="button"
                className={`dashboard-menu-item${item.label === activeSection ? " dashboard-menu-item-active" : ""}`}
                onClick={() => {
                  setActiveSection(item.label);
                  if (badgeKey) clearBadge(badgeKey);
                  setSidebarOpen(false);
                }}
              >
                <span className="menu-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
                {badgeCount > 0 && (
                  <span className="menu-badge" aria-label={`${badgeCount} notificaciones`}>{badgeCount}</span>
                )}
              </button>
            );
          })}
        </nav>


        <div className="dashboard-user-box">
          <button type="button" className="dashboard-user-head dashboard-user-head-btn" onClick={() => { setActiveSection("Mi Perfil"); setSidebarOpen(false); }}>
            <span className="dashboard-user-avatar" aria-hidden="true">
              {profilePhoto
                ? <img src={profilePhoto} alt="" className="dashboard-user-avatar-img" />
                : <svg viewBox="0 0 24 24"><path d="M12 12C14.2 12 16 10.2 16 8C16 5.8 14.2 4 12 4C9.8 4 8 5.8 8 8C8 10.2 9.8 12 12 12ZM5 20C5 16.7 7.7 14 11 14H13C16.3 14 19 16.7 19 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              }
            </span>
            <div className="dashboard-user-info">
              <p className="dashboard-user-name">{user.name}</p>
              <p className="dashboard-user-email">{user.email}</p>
            </div>
            <svg className="dashboard-user-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button type="button" className="dashboard-logout" onClick={onLogout}>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <section className={`dashboard-content${isResidentRole ? " owner-content" : ""}`}>
        {activeSection === "Inicio" ? (
          <OwnerHomeScreen
            user={user}
            anunciosData={anunciosData}
            pagosData={pagosData}
            historialVisitasData={historialVisitasData}
            residentProperty={residentProperty}
            residentUnit={residentUnit}
            totalDue={totalDue}
            setIsPayExpensesModalOpen={setIsPayExpensesModalOpen}
            setActiveSection={setActiveSection}
          />
        ) : activeSection === "Dashboard" ? (
          isSuperAdministrator ? (
            <SuperAdminDashboardScreen
              condominiosData={condominiosData}
              superAdminDashboards={superAdminDashboards}
              pagosData={pagosData}
              historialVisitasData={historialVisitasData}
              selectedDashboardCondoId={selectedDashboardCondoId}
              setSelectedDashboardCondoId={setSelectedDashboardCondoId}
              setActiveSection={setActiveSection}
            />
          ) : (
            <DashboardScreen
              user={user}
              adminCondoName={adminCondoName}
              propiedadesData={propiedadesData}
              pagosData={pagosData}
              historialVisitasData={historialVisitasData}
              visitPasses={visitPasses}
              exportToPDF={exportToPDF}
              onToast={addToast}
            />
          )
        ) : activeSection === "Usuarios" ? (
          <UsuariosScreen
            user={user}
            isSuperAdministrator={isSuperAdministrator}
            condominiosData={condominiosData}
            superAdminDashboards={superAdminDashboards}
            usuariosData={usuariosData}
            setUsuariosData={setUsuariosData}
            selectedManagementCondoId={selectedManagementCondoId}
            setSelectedManagementCondoId={setSelectedManagementCondoId}
            condoDropdownOpen={condoDropdownOpen}
            setCondoDropdownOpen={setCondoDropdownOpen}
            selectedManagementCondoName={selectedManagementCondoName}
            setEditingCondo={setEditingCondo}
            setIsEditCondoModalOpen={setIsEditCondoModalOpen}
            setIsCreateCondoModalOpen={setIsCreateCondoModalOpen}
            setCondoToDelete={setCondoToDelete}
            setIsDeleteCondoConfirmOpen={setIsDeleteCondoConfirmOpen}
            setNewUserForm={setNewUserForm}
            setNewUserError={setNewUserError}
            setIsCreateUserModalOpen={setIsCreateUserModalOpen}
            genTempPassword={genTempPassword}
            setEditingUser={setEditingUser}
            setIsEditUserModalOpen={setIsEditUserModalOpen}
            onToast={addToast}
          />
        ) : activeSection === "Propiedades" ? (
          <PropiedadesScreen
            user={user}
            isSuperAdministrator={isSuperAdministrator}
            condominiosData={condominiosData}
            propiedadesData={propiedadesData}
            setPropiedadesData={setPropiedadesData}
            selectedManagementCondoId={selectedManagementCondoId}
            setSelectedManagementCondoId={setSelectedManagementCondoId}
            selectedManagementCondoName={selectedManagementCondoName}
            setCreatePropertyForm={setCreatePropertyForm}
            setIsCreatePropertyModalOpen={setIsCreatePropertyModalOpen}
            setEditingPropertyForm={setEditingPropertyForm}
            setIsEditPropertyModalOpen={setIsEditPropertyModalOpen}
            onToast={addToast}
          />
        ) : activeSection === "Historial Visitas" ? (
          <HistorialVisitasScreen
            user={user}
            isSuperAdministrator={isSuperAdministrator}
            condominiosData={condominiosData}
            propiedadesData={propiedadesData}
            historialVisitasData={historialVisitasData}
            onToast={addToast}
            exportToPDF={exportToPDF}
          />
        ) : activeSection === "Pagos" ? (
          <PagosScreen
            user={user}
            isSuperAdministrator={isSuperAdministrator}
            condominiosData={condominiosData}
            setCondominiosData={setCondominiosData}
            propiedadesData={propiedadesData}
            setPropiedadesData={setPropiedadesData}
            pagosData={pagosData}
            setPagosData={setPagosData}
            onToast={addToast}
            exportToPDF={exportToPDF}
          />
        ) : activeSection === "Reservas" ? (
          <ReservasScreen
            user={user}
            condominiosData={condominiosData}
            areasSociales={areasSociales}
            setAreasSociales={setAreasSociales}
            reservasAreas={reservasAreas}
            setReservasAreas={setReservasAreas}
            setEditingArea={setEditingArea}
            setAreaForm={setAreaForm}
            setAreaFormError={setAreaFormError}
            setIsCreateAreaModalOpen={setIsCreateAreaModalOpen}
          />
        ) : activeSection === "Anuncios" ? (
          <AnunciosScreen
            user={user}
            isSuperAdministrator={isSuperAdministrator}
            condominiosData={condominiosData}
            anunciosData={anunciosData}
            setAnunciosData={setAnunciosData}
            setIsCreateAnnouncementModalOpen={setIsCreateAnnouncementModalOpen}
            setEditingAnuncio={setEditingAnuncio}
            setIsEditAnuncioModalOpen={setIsEditAnuncioModalOpen}
            onToast={addToast}
          />
        ) : activeSection === "Asambleas" && !isTenant ? (
          <AsambleasScreen
            user={user}
            isSuperAdministrator={isSuperAdministrator}
            condominiosData={condominiosData}
            asambleasData={asambleasData}
            setAsambleasData={setAsambleasData}
            setIsCreateAsambleaModalOpen={setIsCreateAsambleaModalOpen}
            setEditingAsamblea={setEditingAsamblea}
            setEditAsambleaForm={setEditAsambleaForm}
            setEditAsambleaFile={setEditAsambleaFile}
            setIsEditAsambleaModalOpen={setIsEditAsambleaModalOpen}
            onToast={addToast}
          />
        ) : activeSection === "Mi Perfil" ? (
          <PerfilScreen
            user={user}
            profilePhoto={profilePhoto}
            setProfilePhoto={setProfilePhoto}
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
            onProfileUpdated={handleProfileUpdated}
          />
        ) : activeSection === "Mis Pagos" && !isTenant ? (
          <OwnerPaymentsScreen
            user={user}
            pagosData={pagosData}
            residentProperty={residentProperty}
            residentUnit={residentUnit}
            residentExpensas={residentExpensas}
            residentCargoExtra={residentCargoExtra}
            residentCargoNota={residentCargoNota}
            condoPaymentQr={condoPaymentQr}
            onQrError={() => api.getMyCondoPaymentQr().then(d => setCondoPaymentQr(d.paymentQrUrl || '')).catch(() => {})}
            totalDue={totalDue}
            setIsPayExpensesModalOpen={setIsPayExpensesModalOpen}
          />
        ) : activeSection === "Mis Reservas" ? (
          <MisReservasScreen
            user={user}
            areasSociales={areasSociales}
            reservasAreas={reservasAreas}
            setReservasAreas={setReservasAreas}
            setIsPayExpensesModalOpen={setIsPayExpensesModalOpen}
            setPayForm={setPayForm}
          />
        ) : activeSection === "Dashboard" && isSecurity ? (
          <DashboardScreen
            user={user}
            adminCondoName={adminCondoName}
            propiedadesData={propiedadesData}
            pagosData={pagosData}
            historialVisitasData={historialVisitasData}
            visitPasses={visitPasses}
            panicAlerts={panicAlerts}
            setActiveSection={setActiveSection}
            exportToPDF={exportToPDF}
            onToast={addToast}
          />
        ) : activeSection === "Registro Visitas" ? (
          <SecurityVisitRegisterScreen
            user={user}
            visitMode={visitMode}
            setVisitMode={setVisitMode}
            visitRegistrationForm={visitRegistrationForm}
            setVisitRegistrationForm={setVisitRegistrationForm}
            visitFiles={visitFiles}
            setVisitFiles={setVisitFiles}
            visitPasses={visitPasses}
            setVisitPasses={setVisitPasses}
            setSelectedVisitPassId={setSelectedVisitPassId}
            setHistorialVisitasData={setHistorialVisitasData}
            propiedadesData={propiedadesData}
            onToast={addToast}
          />
        ) : activeSection === "Escanear QR" ? (
          <QrScannerScreen
            visitPasses={securityVisitPasses}
            setVisitPasses={setVisitPasses}
            selectedVisitPassId={selectedVisitPassId}
            setSelectedVisitPassId={setSelectedVisitPassId}
            historialVisitas={historialVisitasData}
            setHistorialVisitas={setHistorialVisitasData}
            guardName={user.name}
          />
        ) : activeSection === "Historial" ? (
          <SecurityHistoryScreen visitPasses={visitPasses} setVisitPasses={setVisitPasses} historialVisitasData={historialVisitasData} onToast={addToast} />
        ) : activeSection === "Pre-registro Visitas" ? (
          <PreRegisterVisitsScreen
            user={user}
            visitMode={visitMode}
            setVisitMode={setVisitMode}
            visitRegistrationForm={visitRegistrationForm}
            setVisitRegistrationForm={setVisitRegistrationForm}
            visitFiles={visitFiles}
            setVisitFiles={setVisitFiles}
            visitPasses={visitPasses}
            setVisitPasses={setVisitPasses}
            selectedVisitPassId={selectedVisitPassId}
            setSelectedVisitPassId={setSelectedVisitPassId}
            historialVisitasData={historialVisitasData}
            setHistorialVisitasData={setHistorialVisitasData}
            myProperties={myProperties}
          />
        ) : activeSection === "Botón de Pánico" ? (
          <PanicScreen
            user={user}
            isSuperAdministrator={isSuperAdministrator}
            condominiosData={condominiosData}
            panicAlerts={panicAlerts}
            setPanicAlerts={setPanicAlerts}
            residentProfile={residentProfile}
            residentStreet={residentStreet}
            residentUnit={residentUnit}
            setIsPanicConfirmOpen={setIsPanicConfirmOpen}
          />
        ) : (
          <section className="dashboard-panel section-placeholder">
            <h2>{activeSection}</h2>
            <p>Esta seccion quedara conectada a datos reales en el siguiente paso.</p>
          </section>
        )}
      </section>

      {isPanicConfirmOpen && (
        <div className="modal-overlay" onClick={() => setIsPanicConfirmOpen(false)}>
          <div className="modal-content panic-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="panic-confirm-icon" aria-hidden="true">!</div>
            <h2>¿Confirmar Alerta de Emergencia?</h2>
            <p>Esta acción notificará inmediatamente al personal de seguridad.</p>
            <div className="panic-confirm-actions">
              <button type="button" className="panic-confirm-cancel" onClick={() => setIsPanicConfirmOpen(false)}>Cancelar</button>
              <button type="button" className="panic-confirm-send" onClick={handleConfirmPanicAlert}>Confirmar Emergencia</button>
            </div>
          </div>
        </div>
      )}

      {isCreateUserModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content modal-edit-user" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>{newUserSuccess ? "Usuario registrado" : "Registrar Usuario"}</h2>
              <button className="modal-close" type="button" onClick={() => { setIsCreateUserModalOpen(false); setNewUserError(""); setNewUserSuccess(null); }}>✕</button>
            </header>

            {newUserSuccess ? (
              <div className="modal-body-simple">
                <div style={{ background: "var(--success, #22c55e)22", border: "1px solid var(--success, #22c55e)", borderRadius: "8px", padding: "1rem 1.25rem", marginBottom: "1rem" }}>
                  <p style={{ color: "#16a34a", fontWeight: 600, margin: "0 0 0.25rem" }}>
                    {newUserSuccess.emailSent ? "Credenciales enviadas por email." : "Usuario creado."}
                  </p>
                  {!newUserSuccess.emailSent && newUserSuccess.emailError && (
                    <p style={{ color: "#dc2626", fontSize: "0.8rem", margin: "0 0 0.25rem" }}>
                      El email no se pudo enviar: {newUserSuccess.emailError}
                    </p>
                  )}
                  <p style={{ color: "#374151", fontSize: "0.85rem", margin: 0 }}>
                    Guardá estas credenciales para compartirlas manualmente si es necesario.
                  </p>
                </div>
                <div style={{ background: "#1e293b", borderRadius: "8px", padding: "1.25rem" }}>
                  <p style={{ color: "#94a3b8", fontSize: "0.75rem", margin: "0 0 0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Correo</p>
                  <p style={{ color: "#e2e8f0", fontWeight: 600, margin: "0 0 1rem" }}>{newUserSuccess.email}</p>
                  <p style={{ color: "#94a3b8", fontSize: "0.75rem", margin: "0 0 0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contraseña</p>
                  <p style={{ color: "#facc15", fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>{newUserSuccess.password}</p>
                </div>
                <footer className="modal-footer" style={{ paddingTop: "1.5rem" }}>
                  <button className="btn btn-primary" type="button" onClick={() => { setIsCreateUserModalOpen(false); setNewUserSuccess(null); }}>
                    Cerrar
                  </button>
                </footer>
              </div>
            ) : (
            <>
            <div className="modal-body-simple">
              <p style={{ fontSize: "0.8rem", color: "#374151", marginBottom: "0.5rem", lineHeight: 1.4 }}>
                El usuario recibirá un correo con sus credenciales al registrarse.
              </p>

              <div className="form-row">
                <div className="form-group-simple">
                  <label>Nombre <span style={{ color: "var(--danger)" }}>*</span></label>
                  <input
                    type="text"
                    value={newUserForm.nombre}
                    onChange={(e) => setNewUserForm({ ...newUserForm, nombre: e.target.value })}
                    onKeyDown={handleCreateUserKeyDown}
                    placeholder="Ej: Juan"
                    autoFocus
                  />
                </div>
                <div className="form-group-simple">
                  <label>Apellido</label>
                  <input
                    type="text"
                    value={newUserForm.apellido}
                    onChange={(e) => setNewUserForm({ ...newUserForm, apellido: e.target.value })}
                    onKeyDown={handleCreateUserKeyDown}
                    placeholder="Ej: Pérez"
                  />
                </div>
              </div>

              <div className="form-group-simple">
                <label>Correo electrónico <span style={{ color: "var(--danger)" }}>*</span></label>
                <input
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  onKeyDown={handleCreateUserKeyDown}
                  placeholder="usuario@ejemplo.com"
                />
              </div>

              <div className="form-row">
                {!isSuperAdministrator && (
                  <div className="form-group-simple">
                    <label>Rol</label>
                    <div className="condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setCreateRoleDropdownOpen(false); }} tabIndex={-1}>
                      <button
                        type="button"
                        className="condo-dropdown-trigger"
                        onClick={() => setCreateRoleDropdownOpen((o) => !o)}
                        aria-expanded={createRoleDropdownOpen}
                      >
                        <span className="condo-dropdown-value">{newUserForm.rol}</span>
                        <svg className={`condo-dropdown-chevron${createRoleDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                      {createRoleDropdownOpen && (
                        <ul className="condo-dropdown-list" role="listbox">
                          {["Propietario", "Inquilino", "Seguridad"].map((role) => (
                            <li
                              key={role}
                              role="option"
                              aria-selected={newUserForm.rol === role}
                              className={`condo-dropdown-item${newUserForm.rol === role ? " selected" : ""}`}
                              onMouseDown={() => { setNewUserForm({ ...newUserForm, rol: role }); setCreateRoleDropdownOpen(false); }}
                            >
                              {role}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
                <div className="form-group-simple">
                  <label>Teléfono</label>
                  <div className="phone-input-group">
                    <span className="phone-input-prefix">{PHONE_PREFIX}</span>
                    <input
                      type="text"
                      value={newUserForm.telefono}
                      onChange={(e) => setNewUserForm({ ...newUserForm, telefono: e.target.value })}
                      onKeyDown={handleCreateUserKeyDown}
                      placeholder="Ej: 69444833"
                    />
                  </div>
                </div>
              </div>

              {!isSuperAdministrator && newUserForm.rol === "Seguridad" && user.condo && (
                <div className="form-group-simple">
                  <label>Condominio asignado</label>
                  <div style={{
                    padding: "0.55rem 0.85rem",
                    borderRadius: "8px",
                    background: "rgba(99,102,241,0.08)",
                    border: "1px solid rgba(99,102,241,0.25)",
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: "var(--dash-text)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    {user.condo}
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted,#9ca3af)", marginTop: "0.3rem" }}>
                    El guardia quedará vinculado a este condominio.
                  </p>
                </div>
              )}

              {isSuperAdministrator && (
                <div className="form-group-simple">
                  <label>Condominio</label>
                  <div className="condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setCreateCondoDropdownOpen(false); }} tabIndex={-1}>
                    <button
                      type="button"
                      className="condo-dropdown-trigger"
                      onClick={() => setCreateCondoDropdownOpen((o) => !o)}
                      aria-expanded={createCondoDropdownOpen}
                    >
                      <span className="condo-dropdown-value">
                        {newUserForm.condoId
                          ? (() => { const c = condominiosData.find((c) => String(c.id) === String(newUserForm.condoId)); return c ? `${c.type ? c.type + ": " : ""}${c.name}` : "— Sin condominio asignado —"; })()
                          : "— Sin condominio asignado —"}
                      </span>
                      <svg className={`condo-dropdown-chevron${createCondoDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {createCondoDropdownOpen && (
                      <ul className="condo-dropdown-list condo-dropdown-list--up" role="listbox">
                        <li
                          role="option"
                          aria-selected={!newUserForm.condoId}
                          className={`condo-dropdown-item${!newUserForm.condoId ? " selected" : ""}`}
                          onMouseDown={() => { setNewUserForm({ ...newUserForm, condoId: "" }); setCreateCondoDropdownOpen(false); }}
                        >
                          — Sin condominio asignado —
                        </li>
                        {condominiosData.map((c) => (
                          <li
                            key={c.id}
                            role="option"
                            aria-selected={String(newUserForm.condoId) === String(c.id)}
                            className={`condo-dropdown-item${String(newUserForm.condoId) === String(c.id) ? " selected" : ""}`}
                            onMouseDown={() => { setNewUserForm({ ...newUserForm, condoId: c.id }); setCreateCondoDropdownOpen(false); }}
                          >
                            {c.type ? `${c.type}: ` : ""}{c.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              <div className="form-group-simple">
                <label>Contraseña temporal <span style={{ fontSize: "0.78rem", color: "#818cf8" }}>— el usuario la puede cambiar desde Mi Perfil</span></label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={newUserForm.contrasena}
                    onChange={(e) => setNewUserForm({ ...newUserForm, contrasena: e.target.value })}
                    onKeyDown={handleCreateUserKeyDown}
                    placeholder="Contraseña temporal"
                    autoComplete="new-password"
                    style={{ paddingRight: "3rem", fontFamily: "monospace", letterSpacing: "0.05em" }}
                  />
                  <button
                    type="button"
                    title="Generar nueva contraseña"
                    style={{ position: "absolute", right: "0.6rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#818cf8", fontSize: "1rem", padding: "4px" }}
                    onClick={() => setNewUserForm({ ...newUserForm, contrasena: genTempPassword() })}
                  >↺</button>
                </div>
              </div>

              {newUserError && (
                <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginTop: "0.5rem" }}>{newUserError}</p>
              )}
            </div>

            <footer className="modal-footer">
              <button className="btn btn-secondary" type="button" disabled={createUserLoading} onClick={() => { setIsCreateUserModalOpen(false); setNewUserError(""); }}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" onClick={handleCreateUser} disabled={createUserLoading}>
                {createUserLoading ? "Registrando…" : "Registrar y enviar email"}
              </button>
            </footer>
            </>
            )}
          </div>
        </div>
      )}

      {isEditUserModalOpen && editingUser && (
        <div className="modal-overlay">
          <div className="modal-content modal-edit-user">
            <h2>Editar Usuario</h2>

            <div className="modal-body-simple">
              <div className="form-group-simple">
                <label>Nombre</label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  onKeyDown={onEnterKey(handleSaveUserEdit)}
                />
              </div>

              <div className="form-group-simple">
                <label>Email</label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  onKeyDown={onEnterKey(handleSaveUserEdit)}
                />
              </div>

              <div className="form-group-simple">
                <label>Teléfono</label>
                <div className="phone-input-group">
                  <span className="phone-input-prefix">{PHONE_PREFIX}</span>
                  <input
                    type="text"
                    value={stripPhonePrefix(editingUser.phone)}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value.trim() ? `${PHONE_PREFIX} ${e.target.value}` : "" })}
                    onKeyDown={onEnterKey(handleSaveUserEdit)}
                  />
                </div>
              </div>

              <div className="form-group-simple">
                <label>Rol</label>
                <div className="condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setEditRoleDropdownOpen(false); }} tabIndex={-1}>
                  <button
                    type="button"
                    className="condo-dropdown-trigger"
                    onClick={() => setEditRoleDropdownOpen((o) => !o)}
                    aria-expanded={editRoleDropdownOpen}
                  >
                    <span className="condo-dropdown-value">{editingUser.role}</span>
                    <svg className={`condo-dropdown-chevron${editRoleDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {editRoleDropdownOpen && (
                    <ul className="condo-dropdown-list" role="listbox">
                      {(isSuperAdministrator
                        ? ["Super Admin", "Administrador", "Propietario", "Inquilino", "Seguridad"]
                        : ["Propietario", "Inquilino", "Seguridad"]
                      ).map((role) => (
                        <li
                          key={role}
                          role="option"
                          aria-selected={editingUser.role === role}
                          className={`condo-dropdown-item${editingUser.role === role ? " selected" : ""}`}
                          onMouseDown={() => { setEditingUser({ ...editingUser, role }); setEditRoleDropdownOpen(false); }}
                        >
                          {role}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Restablecer contraseña */}
              <div className="form-group-simple" style={{ marginTop: "0.5rem", borderTop: "1px solid var(--dash-border)", paddingTop: "1rem" }}>
                <label>Restablecer contraseña <span style={{ fontSize: "0.78rem", color: "#818cf8" }}>— sin necesitar la actual</span></label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    id="admin-reset-pw"
                    placeholder="Nueva contraseña (mín. 8 caracteres)"
                    style={{ fontFamily: "monospace", letterSpacing: "0.05em", flex: 1 }}
                    onKeyDown={onEnterKey(handleAdminResetPassword)}
                  />
                  <button
                    type="button"
                    title="Generar contraseña temporal"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#818cf8", fontSize: "1.1rem", padding: "4px 8px" }}
                    onClick={() => { document.getElementById("admin-reset-pw").value = genTempPassword(); }}
                  >↺</button>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: "0.5rem", width: "100%" }}
                  onClick={handleAdminResetPassword}
                >
                  Guardar nueva contraseña
                </button>
              </div>
            </div>

            <footer className="modal-footer-simple">
              <button className="btn btn-secondary" type="button" onClick={() => setIsEditUserModalOpen(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" onClick={handleSaveUserEdit}>
                Guardar
              </button>
            </footer>
          </div>
        </div>
      )}

      {isCreateCondoModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content modal-edit-user modal-create-property">
            <h2>Crear Condominio o Edificio</h2>

            <div className="modal-body-simple">
              <div className="form-row">
                <div className="form-group-simple">
                  <label>Tipo</label>
                  <select
                    value={newCondoForm.type}
                    onChange={(e) => setNewCondoForm({ ...newCondoForm, type: e.target.value })}
                  >
                    <option value="Condominio">Condominio</option>
                    <option value="Edificio">Edificio</option>
                  </select>
                </div>
                <div className="form-group-simple">
                  <label>Nombre <span style={{ color: "var(--danger)" }}>*</span></label>
                  <input
                    type="text"
                    placeholder="Ej: Torre Norte"
                    value={newCondoForm.name}
                    onChange={(e) => setNewCondoForm({ ...newCondoForm, name: e.target.value })}
                    onKeyDown={handleCreateCondoKeyDown}
                    autoFocus
                  />
                </div>
              </div>
              <div className="form-group-simple">
                <label>Dirección</label>
                <input
                  type="text"
                  placeholder="Ej: Av. Principal 123, Ciudad"
                  value={newCondoForm.address}
                  onChange={(e) => setNewCondoForm({ ...newCondoForm, address: e.target.value })}
                  onKeyDown={handleCreateCondoKeyDown}
                />
              </div>
            </div>

            <footer className="modal-footer-simple">
              <button className="btn btn-secondary" type="button" onClick={() => { setIsCreateCondoModalOpen(false); setNewCondoForm({ name: "", type: "Condominio", address: "" }); }}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" onClick={handleCreateCondo}>
                Crear y Acceder
              </button>
            </footer>
          </div>
        </div>
      )}

      {isEditCondoModalOpen && editingCondo && (
        <div className="modal-overlay" onClick={() => { setIsEditCondoModalOpen(false); setEditingCondo(null); }}>
          <div className="modal-content modal-edit-user" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Editar Condominio</h2>
              <button className="modal-close" type="button" onClick={() => { setIsEditCondoModalOpen(false); setEditingCondo(null); }}>✕</button>
            </header>
            <div className="modal-body-simple">
              <div className="form-group-simple">
                <label>Tipo</label>
                <select value={editingCondo.type} onChange={e => setEditingCondo({ ...editingCondo, type: e.target.value })}>
                  <option value="Condominio">Condominio</option>
                  <option value="Edificio">Edificio</option>
                </select>
              </div>
              <div className="form-group-simple">
                <label>Nombre <span style={{ color: "var(--danger)" }}>*</span></label>
                <input type="text" value={editingCondo.name} onChange={e => setEditingCondo({ ...editingCondo, name: e.target.value })} onKeyDown={handleSaveCondoEditKeyDown} placeholder="Ej: Torre Norte" autoFocus />
              </div>
              <div className="form-group-simple">
                <label>Dirección</label>
                <input type="text" value={editingCondo.address || ""} onChange={e => setEditingCondo({ ...editingCondo, address: e.target.value })} onKeyDown={handleSaveCondoEditKeyDown} placeholder="Ej: Av. Principal 123" />
              </div>
            </div>
            <footer className="modal-footer">
              <button className="btn btn-secondary" type="button" onClick={() => { setIsEditCondoModalOpen(false); setEditingCondo(null); }}>Cancelar</button>
              <button className="btn btn-primary" type="button" onClick={handleSaveCondoEdit}>Guardar cambios</button>
            </footer>
          </div>
        </div>
      )}

      {/* Confirmar eliminación de condominio */}
      {isDeleteCondoConfirmOpen && condoToDelete && (
        <div className="modal-overlay" onClick={() => { setIsDeleteCondoConfirmOpen(false); setCondoToDelete(null); }}>
          <div className="modal-content" style={{ maxWidth: "420px" }} onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Eliminar condominio</h2>
              <button className="modal-close" type="button" onClick={() => { setIsDeleteCondoConfirmOpen(false); setCondoToDelete(null); }}>✕</button>
            </header>
            <div className="modal-body-simple" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "1.75rem 1.5rem 0.75rem" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(239,68,68,0.10)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.25rem" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </div>
              <p style={{ margin: "0 0 0.4rem", fontWeight: 700, fontSize: "1.05rem", width: "100%" }}>
                ¿Eliminar "{condoToDelete.name}"?
              </p>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--dash-text-2, #667085)", lineHeight: 1.5, width: "100%" }}>
                Esta acción no se puede deshacer. Se eliminarán todos los datos asociados.
              </p>
            </div>
            <footer className="modal-footer">
              <button className="btn btn-secondary" type="button" onClick={() => { setIsDeleteCondoConfirmOpen(false); setCondoToDelete(null); }}>
                Cancelar
              </button>
              <button
                className="btn"
                type="button"
                style={{ background: "#ef4444", color: "#fff", border: "none" }}
                onClick={confirmDeleteCondo}
              >
                Sí, eliminar
              </button>
            </footer>
          </div>
        </div>
      )}

      {isCreatePropertyModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content modal-edit-user modal-create-property">
            <h2>Crear Propiedad</h2>

            <div className="modal-body-simple">
              <div className="form-group-simple">
                <label>Condominio / Edificio <span style={{ color: "var(--danger)" }}>*</span></label>
                {isSuperAdministrator ? (
                  <div className="condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setCreatePropertyCondoDropdownOpen(false); }} tabIndex={-1}>
                    <button
                      type="button"
                      className="condo-dropdown-trigger"
                      onClick={() => setCreatePropertyCondoDropdownOpen((o) => !o)}
                      aria-expanded={createPropertyCondoDropdownOpen}
                    >
                      <span className="condo-dropdown-value">
                        {createPropertyForm.condoId
                          ? (() => { const c = condominiosData.find((c) => String(c.id) === String(createPropertyForm.condoId)); return c ? `${c.type}: ${c.name}` : "— Seleccioná un condominio —"; })()
                          : "— Seleccioná un condominio —"}
                      </span>
                      <svg className={`condo-dropdown-chevron${createPropertyCondoDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {createPropertyCondoDropdownOpen && (
                      <ul className="condo-dropdown-list" role="listbox">
                        <li role="option" aria-selected={!createPropertyForm.condoId} className={`condo-dropdown-item${!createPropertyForm.condoId ? " selected" : ""}`} onMouseDown={() => { setCreatePropertyForm({ ...createPropertyForm, condoId: "" }); setCreatePropertyCondoDropdownOpen(false); }}>
                          — Seleccioná un condominio —
                        </li>
                        {condominiosData.map((c) => (
                          <li key={c.id} role="option" aria-selected={String(createPropertyForm.condoId) === String(c.id)} className={`condo-dropdown-item${String(createPropertyForm.condoId) === String(c.id) ? " selected" : ""}`} onMouseDown={() => { setCreatePropertyForm({ ...createPropertyForm, condoId: String(c.id) }); setCreatePropertyCondoDropdownOpen(false); }}>
                            {c.type}: {c.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="condo-dropdown-trigger" style={{cursor:'default', background:'#f9fafb'}}>
                    <span className="condo-dropdown-value" style={{color:'#374151', fontWeight:600}}>
                      {condominiosData.find(c => c.name === user.condo)
                        ? `${condominiosData.find(c => c.name === user.condo).type}: ${user.condo}`
                        : user.condo || '—'}
                    </span>
                  </div>
                )}
              </div>

              {(() => {
                const selectedCondo = condominiosData.find(c => String(c.id) === String(createPropertyForm.condoId));
                const isEdificio = selectedCondo?.type === "Edificio";
                return (
                  <>
                    <div className="form-row">
                      <div className="form-group-simple">
                        <label>Calle <span style={{ color: "var(--danger)" }}>*</span></label>
                        <input
                          type="text"
                          placeholder="Nombre de la calle"
                          value={createPropertyForm.calle}
                          onChange={(e) => setCreatePropertyForm({ ...createPropertyForm, calle: e.target.value })}
                          onKeyDown={onEnterKey(handleCreateProperty)}
                        />
                      </div>
                      <div className="form-group-simple">
                        <label>Número <span style={{ color: "var(--danger)" }}>*</span></label>
                        <input
                          type="text"
                          placeholder="Ej: A-101"
                          value={createPropertyForm.numero}
                          onChange={(e) => setCreatePropertyForm({ ...createPropertyForm, numero: e.target.value })}
                          onKeyDown={onEnterKey(handleCreateProperty)}
                        />
                      </div>
                    </div>
                    {isEdificio && (
                      <div className="form-group-simple">
                        <label>Bloque <span style={{ color: "var(--danger)" }}>*</span></label>
                        <input
                          type="text"
                          placeholder="Ej: A"
                          value={createPropertyForm.bloque}
                          onChange={(e) => setCreatePropertyForm({ ...createPropertyForm, bloque: e.target.value })}
                          onKeyDown={onEnterKey(handleCreateProperty)}
                        />
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="form-group-simple">
                <label>Propietario</label>
                <div className="condo-dropdown tenant-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setCreateOwnerDropdownOpen(false); }} tabIndex={-1}>
                  <button
                    type="button"
                    className="condo-dropdown-trigger tenant-dropdown-trigger"
                    onClick={() => setCreateOwnerDropdownOpen((open) => !open)}
                    aria-expanded={createOwnerDropdownOpen}
                  >
                    <span className="condo-dropdown-value">
                      {createPropertyForm.propietario || "Seleccionar propietario"}
                    </span>
                    <svg className={`condo-dropdown-chevron${createOwnerDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {createOwnerDropdownOpen && (
                    <ul className="condo-dropdown-list tenant-dropdown-list" role="listbox">
                      <li
                        role="option"
                        aria-selected={!createPropertyForm.propietario}
                        className={`condo-dropdown-item${!createPropertyForm.propietario ? " selected" : ""}`}
                        onMouseDown={() => { setCreatePropertyForm({ ...createPropertyForm, propietario: "" }); setCreateOwnerDropdownOpen(false); }}
                      >
                        Seleccionar propietario
                      </li>
                      {propietariosOptions.map((propietario) => (
                        <li
                          key={propietario.id}
                          role="option"
                          aria-selected={createPropertyForm.propietario === propietario.name}
                          className={`condo-dropdown-item${createPropertyForm.propietario === propietario.name ? " selected" : ""}`}
                          onMouseDown={() => { setCreatePropertyForm({ ...createPropertyForm, propietario: propietario.name }); setCreateOwnerDropdownOpen(false); }}
                        >
                          {propietario.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="form-group-simple">
                <div className="tenant-group-header">
                  <label>Inquilino(s)</label>
                  <button type="button" className="btn-add-section" onClick={addCreateTenantField}>+ Agregar</button>
                </div>
                <div className="tenant-fields-wrap">
                  {createPropertyForm.inquilinos.map((inquilino, index) => (
                    <div key={`create-tenant-${index}`} className="tenant-row">
                      <div className="condo-dropdown tenant-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setCreateTenantDropdownOpenIndex((current) => (current === index ? null : current)); }} tabIndex={-1}>
                        <button
                          type="button"
                          className="condo-dropdown-trigger tenant-dropdown-trigger"
                          onClick={() => setCreateTenantDropdownOpenIndex((current) => (current === index ? null : index))}
                          aria-expanded={createTenantDropdownOpenIndex === index}
                        >
                          <span className="condo-dropdown-value">
                            {inquilino || "Seleccionar inquilino"}
                          </span>
                          <svg className={`condo-dropdown-chevron${createTenantDropdownOpenIndex === index ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        {createTenantDropdownOpenIndex === index && (
                          <ul className="condo-dropdown-list condo-dropdown-list--up" role="listbox">
                            <li
                              role="option"
                              aria-selected={!inquilino}
                              className={`condo-dropdown-item${!inquilino ? " selected" : ""}`}
                              onMouseDown={() => { updateCreateTenantField(index, ""); setCreateTenantDropdownOpenIndex(null); }}
                            >
                              Seleccionar inquilino
                            </li>
                            {getAvailableInquilinosOptions()
                              .filter(item => !createPropertyForm.inquilinos.includes(item.name) || item.name === inquilino)
                              .map((item) => (
                                <li
                                  key={item.id}
                                  role="option"
                                  aria-selected={inquilino === item.name}
                                  className={`condo-dropdown-item${inquilino === item.name ? " selected" : ""}`}
                                  onMouseDown={() => { updateCreateTenantField(index, item.name); setCreateTenantDropdownOpenIndex(null); }}
                                >
                                  {item.name}
                                </li>
                              ))}
                          </ul>
                        )}
                      </div>
                      {createPropertyForm.inquilinos.length > 1 && (
                        <button type="button" className="tenant-remove-btn" onClick={() => removeCreateTenantField(index)} title="Quitar inquilino">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <footer className="modal-footer-simple">
              <button className="btn btn-secondary" type="button" onClick={() => setIsCreatePropertyModalOpen(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" onClick={handleCreateProperty}>
                Crear
              </button>
            </footer>
          </div>
        </div>
      )}

      {isEditPropertyModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content modal-edit-user modal-create-property">
            <h2>Editar Propiedad</h2>

            <div className="modal-body-simple">
              <div className="form-group-simple">
                <label>Calle</label>
                <input
                  type="text"
                  value={editingPropertyForm.calle}
                  onChange={(e) => setEditingPropertyForm({ ...editingPropertyForm, calle: e.target.value })}
                  onKeyDown={handleSavePropertyEditKeyDown}
                  autoFocus
                />
              </div>

              <div className="form-group-simple">
                <label>Número</label>
                <input
                  type="text"
                  value={editingPropertyForm.numero}
                  onChange={(e) => setEditingPropertyForm({ ...editingPropertyForm, numero: e.target.value })}
                  onKeyDown={handleSavePropertyEditKeyDown}
                />
              </div>

              <div className="form-group-simple">
                <label>Bloque</label>
                <input
                  type="text"
                  value={editingPropertyForm.bloque}
                  onChange={(e) => setEditingPropertyForm({ ...editingPropertyForm, bloque: e.target.value })}
                  onKeyDown={handleSavePropertyEditKeyDown}
                />
              </div>

              <div className="form-group-simple">
                <label>Propietario</label>
                <div className="condo-dropdown tenant-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setEditOwnerDropdownOpen(false); }} tabIndex={-1}>
                  <button
                    type="button"
                    className="condo-dropdown-trigger tenant-dropdown-trigger"
                    onClick={() => setEditOwnerDropdownOpen((open) => !open)}
                    aria-expanded={editOwnerDropdownOpen}
                  >
                    <span className="condo-dropdown-value">
                      {editingPropertyForm.propietario || "Seleccionar propietario"}
                    </span>
                    <svg className={`condo-dropdown-chevron${editOwnerDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {editOwnerDropdownOpen && (
                    <ul className="condo-dropdown-list tenant-dropdown-list" role="listbox">
                      <li
                        role="option"
                        aria-selected={!editingPropertyForm.propietario}
                        className={`condo-dropdown-item${!editingPropertyForm.propietario ? " selected" : ""}`}
                        onMouseDown={() => { setEditingPropertyForm({ ...editingPropertyForm, propietario: "" }); setEditOwnerDropdownOpen(false); }}
                      >
                        Seleccionar propietario
                      </li>
                      {propietariosOptions.map((propietario) => (
                        <li
                          key={propietario.id}
                          role="option"
                          aria-selected={editingPropertyForm.propietario === propietario.name}
                          className={`condo-dropdown-item${editingPropertyForm.propietario === propietario.name ? " selected" : ""}`}
                          onMouseDown={() => { setEditingPropertyForm({ ...editingPropertyForm, propietario: propietario.name }); setEditOwnerDropdownOpen(false); }}
                        >
                          {propietario.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="form-group-simple">
                <div className="tenant-group-header">
                  <label>Inquilino(s)</label>
                  <button type="button" className="btn-add-section" onClick={addEditTenantField}>+ Agregar</button>
                </div>
                <div className="tenant-fields-wrap">
                  {editingPropertyForm.inquilinos.map((inquilino, index) => (
                    <div key={`edit-tenant-${index}`} className="tenant-row">
                      <div className="condo-dropdown" style={{flex:1}} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setEditTenantDropdownOpenIdx(null); }} tabIndex={-1}>
                        <button
                          type="button"
                          className="condo-dropdown-trigger"
                          onClick={() => setEditTenantDropdownOpenIdx(editTenantDropdownOpenIdx === index ? null : index)}
                          aria-expanded={editTenantDropdownOpenIdx === index}
                        >
                          <span className="condo-dropdown-value">{inquilino || "Seleccionar inquilino"}</span>
                          <svg className={`condo-dropdown-chevron${editTenantDropdownOpenIdx === index ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        {editTenantDropdownOpenIdx === index && (
                          <ul className="condo-dropdown-list condo-dropdown-list--up" role="listbox">
                            <li role="option" aria-selected={!inquilino} className={`condo-dropdown-item${!inquilino ? " selected" : ""}`}
                              onMouseDown={() => { updateEditTenantField(index, ""); setEditTenantDropdownOpenIdx(null); }}>
                              Seleccionar inquilino
                            </li>
                            {getAvailableInquilinosOptions(editingPropertyForm.id)
                              .filter(item => !editingPropertyForm.inquilinos.includes(item.name) || item.name === inquilino)
                              .map((item) => (
                                <li key={item.id} role="option" aria-selected={inquilino === item.name}
                                  className={`condo-dropdown-item${inquilino === item.name ? " selected" : ""}`}
                                  onMouseDown={() => { updateEditTenantField(index, item.name); setEditTenantDropdownOpenIdx(null); }}>
                                  {item.name}
                                </li>
                              ))}
                          </ul>
                        )}
                      </div>
                      {editingPropertyForm.inquilinos.length > 1 && (
                        <button type="button" className="tenant-remove-btn" onClick={() => removeEditTenantField(index)} title="Quitar inquilino">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group-simple">
                <label>Deuda</label>
                <input
                  type="number"
                  min="0"
                  value={editingPropertyForm.deuda}
                  onChange={(e) => setEditingPropertyForm({ ...editingPropertyForm, deuda: e.target.value })}
                  onKeyDown={handleSavePropertyEditKeyDown}
                />
              </div>
            </div>

            <footer className="modal-footer-simple">
              <button className="btn btn-secondary" type="button" onClick={() => setIsEditPropertyModalOpen(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" onClick={handleSavePropertyEdit}>
                Guardar
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal crear/editar área social */}
      {isCreateAreaModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateAreaModalOpen(false)}>
          <div className="modal-content modal-edit-user" onClick={e => e.stopPropagation()} style={{maxWidth:480}}>
            <header className="modal-header">
              <h2>{editingArea ? 'Editar Área Social' : 'Nueva Área Social'}</h2>
              <button className="modal-close" type="button" onClick={() => setIsCreateAreaModalOpen(false)}>✕</button>
            </header>
            <div className="modal-body-simple">
              {isSuperAdministrator && (
                <div className="form-group-simple">
                  <label>Condominio *</label>
                  <div className="condo-dropdown" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setAreaCondoDropdownOpen(false); }} tabIndex={-1}>
                    <button type="button" className="condo-dropdown-trigger" onClick={() => setAreaCondoDropdownOpen(o => !o)} aria-expanded={areaCondoDropdownOpen}>
                      <span className="condo-dropdown-value">
                        {areaForm.condo
                          ? (() => { const c = condominiosData.find(c => c.name === areaForm.condo); return c ? `${c.type}: ${c.name}` : areaForm.condo; })()
                          : '— Seleccioná un condominio —'}
                      </span>
                      <svg className={`condo-dropdown-chevron${areaCondoDropdownOpen ? ' open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {areaCondoDropdownOpen && (
                      <ul className="condo-dropdown-list" role="listbox">
                        {condominiosData.map(c => (
                          <li key={c.id} role="option" aria-selected={areaForm.condo === c.name}
                            className={`condo-dropdown-item${areaForm.condo === c.name ? ' selected' : ''}`}
                            onMouseDown={() => { setAreaForm(f => ({...f, condo: c.name})); setAreaCondoDropdownOpen(false); }}>
                            {c.type}: {c.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
              <div className="form-group-simple">
                <label>Nombre *</label>
                <input type="text" placeholder="Ej: Salón de eventos" value={areaForm.nombre} onChange={e => setAreaForm(f => ({...f, nombre: e.target.value}))} onKeyDown={onEnterKey(handleSaveArea, areaFormLoading)} autoFocus />
              </div>
              <div className="form-group-simple">
                <label>Descripción</label>
                <textarea className="anuncio-textarea" placeholder="Descripción del área, capacidad, reglas..." value={areaForm.descripcion} onChange={e => setAreaForm(f => ({...f, descripcion: e.target.value}))} style={{minHeight:80}} />
              </div>
              <div className="form-group-simple">
                <label>Precio por reserva (Bs.) <span style={{color:'#9ca3af',fontWeight:400}}>— dejar en 0 si es gratuito</span></label>
                <input type="number" min="0" placeholder="0" value={areaForm.precio} onChange={e => setAreaForm(f => ({...f, precio: e.target.value}))} onKeyDown={onEnterKey(handleSaveArea, areaFormLoading)} />
              </div>
              <div className="form-group-simple">
                <label>Fotos (opcional, máx. {MAX_AREA_IMAGES})</label>
                <div className="area-form-images-grid">
                  {areaForm.imagenesExistentes.map((url) => (
                    <div key={url} className="area-form-image-thumb">
                      <img src={url} alt="Foto del área" />
                      <button type="button" className="area-form-image-remove" title="Quitar foto" onClick={() => setAreaForm(f => ({...f, imagenesExistentes: f.imagenesExistentes.filter(u => u !== url)}))}>✕</button>
                    </div>
                  ))}
                  {areaForm.imagenesNuevas.map((img, idx) => (
                    <div key={img.preview} className="area-form-image-thumb">
                      <img src={img.preview} alt="Foto nueva" />
                      <button type="button" className="area-form-image-remove" title="Quitar foto" onClick={() => { URL.revokeObjectURL(img.preview); setAreaForm(f => ({...f, imagenesNuevas: f.imagenesNuevas.filter((_, i) => i !== idx)})); }}>✕</button>
                    </div>
                  ))}
                  {(areaForm.imagenesExistentes.length + areaForm.imagenesNuevas.length) < MAX_AREA_IMAGES && (
                    <label className="area-form-image-add">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      <span>Agregar</span>
                      <input type="file" accept="image/*" multiple style={{display:'none'}} onChange={e => {
                        const files = Array.from(e.target.files || []);
                        const remaining = MAX_AREA_IMAGES - (areaForm.imagenesExistentes.length + areaForm.imagenesNuevas.length);
                        const nuevas = files.slice(0, remaining).map(file => ({ file, preview: URL.createObjectURL(file) }));
                        setAreaForm(f => ({...f, imagenesNuevas: [...f.imagenesNuevas, ...nuevas]}));
                        e.target.value = '';
                      }} />
                    </label>
                  )}
                </div>
              </div>
              {areaFormError && <p style={{color:'var(--danger)',fontSize:'0.85rem',margin:0}}>{areaFormError}</p>}
            </div>
            <footer className="modal-footer">
              <button className="btn btn-secondary" type="button" disabled={areaFormLoading} onClick={() => setIsCreateAreaModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" type="button" disabled={areaFormLoading} onClick={handleSaveArea}>
                {areaFormLoading ? <span style={{display:'flex',alignItems:'center',gap:'0.4rem'}}><svg style={{width:14,height:14,animation:'spin 0.8s linear infinite'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Guardando…</span> : editingArea ? 'Guardar cambios' : 'Crear área'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {isCreateAnnouncementModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content modal-edit-user modal-create-announcement">
            <h2>Nuevo Anuncio</h2>

            <div className="modal-body-simple">
              {isSuperAdministrator && (
                <div className="form-group-simple">
                  <label>Condominio destinatario</label>
                  <div className="condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setCreateAnnouncementCondoDropdownOpen(false); }} tabIndex={-1}>
                    <button
                      type="button"
                      className="condo-dropdown-trigger"
                      onClick={() => setCreateAnnouncementCondoDropdownOpen((o) => !o)}
                      aria-expanded={createAnnouncementCondoDropdownOpen}
                    >
                      <span className="condo-dropdown-value">
                        {newAnnouncementForm.condo || "— Seleccionar condominio —"}
                      </span>
                      <svg className={`condo-dropdown-chevron${createAnnouncementCondoDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {createAnnouncementCondoDropdownOpen && (
                      <ul className="condo-dropdown-list" role="listbox">
                        <li
                          role="option"
                          aria-selected={!newAnnouncementForm.condo}
                          className={`condo-dropdown-item${!newAnnouncementForm.condo ? " selected" : ""}`}
                          onMouseDown={() => { setNewAnnouncementForm({ ...newAnnouncementForm, condo: "" }); setCreateAnnouncementCondoDropdownOpen(false); }}
                        >
                          — Seleccionar condominio —
                        </li>
                        {condominiosData.map((c) => (
                          <li
                            key={c.id}
                            role="option"
                            aria-selected={newAnnouncementForm.condo === c.name}
                            className={`condo-dropdown-item${newAnnouncementForm.condo === c.name ? " selected" : ""}`}
                            onMouseDown={() => { setNewAnnouncementForm({ ...newAnnouncementForm, condo: c.name }); setCreateAnnouncementCondoDropdownOpen(false); }}
                          >
                            {c.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              <div className="form-group-simple">
                <label>Titulo</label>
                <input
                  type="text"
                  placeholder="Ej: Corte de agua"
                  value={newAnnouncementForm.title}
                  onChange={(e) => setNewAnnouncementForm({ ...newAnnouncementForm, title: e.target.value })}
                  onKeyDown={onEnterKey(handleCreateAnnouncement, createAnnouncementLoading)}
                />
              </div>

              <div className="form-group-simple">
                <label>Mensaje</label>
                <textarea
                  className="anuncio-textarea"
                  placeholder="Escribe el anuncio para los residentes"
                  value={newAnnouncementForm.message}
                  onChange={(e) => setNewAnnouncementForm({ ...newAnnouncementForm, message: e.target.value })}
                />
              </div>

              <div className="form-group-simple">
                <label>Visible para</label>
                <div className="condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setAnnouncementTargetDropdownOpen(false); }} tabIndex={-1}>
                  <button
                    type="button"
                    className="condo-dropdown-trigger"
                    onClick={() => setAnnouncementTargetDropdownOpen((o) => !o)}
                    aria-expanded={announcementTargetDropdownOpen}
                  >
                    <span className="condo-dropdown-value">
                      {{ todos: "Todos", propietarios: "Propietarios", inquilinos: "Inquilinos", seguridad: "Seguridad" }[newAnnouncementForm.target] || "Todos"}
                    </span>
                    <svg className={`condo-dropdown-chevron${announcementTargetDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {announcementTargetDropdownOpen && (
                    <ul className="condo-dropdown-list condo-dropdown-list--up" role="listbox">
                      {[{ value: "todos", label: "Todos" }, { value: "propietarios", label: "Propietarios" }, { value: "inquilinos", label: "Inquilinos" }, { value: "seguridad", label: "Seguridad" }].map(({ value, label }) => (
                        <li
                          key={value}
                          role="option"
                          aria-selected={newAnnouncementForm.target === value}
                          className={`condo-dropdown-item${newAnnouncementForm.target === value ? " selected" : ""}`}
                          onMouseDown={() => { setNewAnnouncementForm({ ...newAnnouncementForm, target: value }); setAnnouncementTargetDropdownOpen(false); }}
                        >
                          {label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {createAnnouncementError && (
              <p style={{color:'var(--danger)',fontSize:'0.85rem',margin:'0 0 0.5rem',padding:'0 1.5rem'}}>
                {createAnnouncementError}
              </p>
            )}

            <footer className="modal-footer-simple">
              <button className="btn btn-secondary" type="button" disabled={createAnnouncementLoading} onClick={() => { setIsCreateAnnouncementModalOpen(false); setCreateAnnouncementError(''); }}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" disabled={createAnnouncementLoading} onClick={handleCreateAnnouncement}>
                {createAnnouncementLoading ? (
                  <span style={{display:'flex',alignItems:'center',gap:'0.4rem'}}>
                    <svg style={{width:14,height:14,animation:'spin 0.8s linear infinite'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                    Publicando…
                  </span>
                ) : 'Publicar'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {isEditAnuncioModalOpen && editingAnuncio && (
        <div className="modal-overlay" onClick={() => { setIsEditAnuncioModalOpen(false); setEditingAnuncio(null); }}>
          <div className="modal-content modal-edit-user modal-create-announcement" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Editar Anuncio</h2>
              <button className="modal-close" type="button" onClick={() => { setIsEditAnuncioModalOpen(false); setEditingAnuncio(null); }}>✕</button>
            </header>
            <div className="modal-body-simple">
              {isSuperAdministrator && (
                <div className="form-group-simple">
                  <label>Condominio destinatario</label>
                  <select
                    value={editingAnuncio.condo || ""}
                    onChange={(e) => setEditingAnuncio({ ...editingAnuncio, condo: e.target.value })}
                  >
                    <option value="">— Seleccionar condominio —</option>
                    {condominiosData.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group-simple">
                <label>Título</label>
                <input type="text" value={editingAnuncio.title} onChange={(e) => setEditingAnuncio({ ...editingAnuncio, title: e.target.value })} onKeyDown={onEnterKey(handleSaveAnuncioEdit)} />
              </div>
              <div className="form-group-simple">
                <label>Mensaje</label>
                <textarea className="anuncio-textarea" value={editingAnuncio.message} onChange={(e) => setEditingAnuncio({ ...editingAnuncio, message: e.target.value })} />
              </div>
              <div className="form-group-simple">
                <label>Visible para</label>
                <select value={editingAnuncio.target} onChange={(e) => setEditingAnuncio({ ...editingAnuncio, target: e.target.value })}>
                  <option value="todos">Todos</option>
                  <option value="propietarios">Propietarios</option>
                  <option value="inquilinos">Inquilinos</option>
                  <option value="seguridad">Seguridad</option>
                </select>
              </div>

            </div>
            <footer className="modal-footer">
              <button className="btn btn-secondary" type="button" onClick={() => { setIsEditAnuncioModalOpen(false); setEditingAnuncio(null); }}>Cancelar</button>
              <button className="btn btn-primary" type="button" onClick={handleSaveAnuncioEdit}>Guardar cambios</button>
            </footer>
          </div>
        </div>
      )}

      {isPayExpensesModalOpen && (
        <div className="modal-overlay" onClick={() => { setIsPayExpensesModalOpen(false); setPayMsg(""); setPayForm({ monto: "", referencia: "", motivo: "", tipo: "Expensa", file: null }); }}>
          <div className="modal-content modal-pay-expenses" onClick={e => e.stopPropagation()}>
            <header className="modal-pay-expenses-header">
              <h2>{payForm.tipo === "Reserva" ? "Pagar Reserva" : "Pagar Expensas"}</h2>
              <button className="modal-close" type="button" onClick={() => { setIsPayExpensesModalOpen(false); setPayMsg(""); setPayForm({ monto: "", referencia: "", motivo: "", tipo: "Expensa", file: null }); }}>✕</button>
            </header>

            <div className="modal-pay-expenses-body">
              <section className="modal-pay-amount-card">
                <span className="modal-pay-label">¿Cuánto estás pagando?</span>
                <div style={{display:'flex',alignItems:'center',gap:'0.4rem',marginTop:'0.25rem'}}>
                  <span style={{fontWeight:700,fontSize:'1.1rem',color:'var(--text-secondary,#6b7280)'}}>Bs.</span>
                  <input
                    type="number"
                    className="modal-pay-monto-input"
                    placeholder={totalDue > 0 ? String(totalDue) : "0"}
                    min="1"
                    value={payForm.monto}
                    onChange={e => setPayForm({ ...payForm, monto: e.target.value })}
                    style={{flex:1}}
                  />
                </div>
                {payForm.tipo !== "Reserva" && totalDue > 0 && (
                  <p style={{margin:'0.3rem 0 0',fontSize:'0.78rem',color:'#9090c0'}}>
                    Total adeudado: Bs. {totalDue.toLocaleString()}
                    {Number(payForm.monto) > 0 && Number(payForm.monto) < totalDue && (
                      <span style={{color:'#f59e0b',marginLeft:'0.5rem'}}>
                        · Saldo restante: Bs. {(totalDue - Number(payForm.monto)).toLocaleString()}
                      </span>
                    )}
                  </p>
                )}
              </section>

              <section className="modal-pay-reference-section">
                <label>N° de Referencia / Comprobante</label>
                <input
                  type="text"
                  placeholder="Ej: 00123456789"
                  value={payForm.referencia}
                  onChange={e => setPayForm({ ...payForm, referencia: e.target.value })}
                />
              </section>

              <section className="modal-pay-reference-section">
                <label>Motivo (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: pago de reserva de churrasquera"
                  value={payForm.motivo}
                  onChange={e => setPayForm({ ...payForm, motivo: e.target.value })}
                />
              </section>

              <section className="modal-pay-upload-section">
                <label>Adjuntar Comprobante (imagen o PDF) *</label>
                <label className="modal-pay-upload-box">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="modal-pay-upload-input"
                    onChange={e => setPayForm({ ...payForm, file: e.target.files?.[0] || null })}
                  />
                  <span className="modal-pay-upload-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 16V6M8 10L12 6L16 10M5 14V17C5 18.1 5.9 19 7 19H17C18.1 19 19 18.1 19 17V14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {payForm.file ? (
                    <span className="modal-pay-upload-title modal-pay-file-ok">✓ {payForm.file.name}</span>
                  ) : (
                    <>
                      <span className="modal-pay-upload-title">Click para subir imagen o PDF</span>
                      <span className="modal-pay-upload-subtitle">PNG, JPG o PDF · máx. 8 MB</span>
                    </>
                  )}
                </label>
              </section>

              <div className="modal-pay-alert">
                Tu pago quedará en estado <strong>Pendiente</strong> hasta que el administrador revise y apruebe el comprobante.
              </div>

              {payMsg && (
                <p className={`perfil-msg${payMsg.includes("exitosamente") ? " perfil-msg-ok" : " perfil-msg-error"}`}>{payMsg}</p>
              )}
            </div>

            <footer className="modal-pay-expenses-footer">
              <button type="button" className="modal-pay-cancel-btn" onClick={() => { setIsPayExpensesModalOpen(false); setPayMsg(""); setPayForm({ monto: "", referencia: "", motivo: "", tipo: "Expensa", file: null }); }}>
                Cancelar
              </button>
              <button
                type="button"
                className="modal-pay-submit-btn"
                disabled={paySubmitting}
                onClick={async () => {
                  const monto = Number(payForm.monto);
                  if (!monto || monto <= 0) { setPayMsg("Ingresá el monto que estás pagando."); return; }
                  if (!payForm.file) { setPayMsg("Adjuntá el comprobante de pago."); return; }
                  setPaySubmitting(true);
                  setPayMsg("");
                  try {
                    const fd = new FormData();
                    fd.append("propiedad",   residentProperty);
                    fd.append("propietario", residentProfile.name);
                    fd.append("tipo",        payForm.tipo || "Expensa");
                    fd.append("monto",       String(monto));
                    fd.append("estado",      "pendiente");
                    fd.append("referencia",  payForm.referencia.trim());
                    fd.append("motivo",      payForm.motivo.trim());
                    fd.append("comprobante", payForm.file);
                    const newPago = await api.createPago(fd);
                    setPagosData(prev => [newPago, ...prev]);
                    setPayForm({ monto: "", referencia: "", motivo: "", tipo: "Expensa", file: null });
                    setIsPayExpensesModalOpen(false);
                    setPayMsg("");
                  } catch (err) {
                    setPayMsg("Error al enviar: " + (err.message || "intentá de nuevo."));
                  } finally {
                    setPaySubmitting(false);
                  }
                }}
              >
                {paySubmitting ? "Enviando…" : "Enviar Comprobante"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {isCreateAsambleaModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content modal-edit-user modal-create-announcement">
            <h2>Nueva Asamblea</h2>

            <div className="modal-body-simple">
              <div className="form-group-simple">
                <label>Título <span style={{color:'var(--danger,#e53)'}}>*</span></label>
                <input
                  type="text"
                  placeholder="Ej: Renovación de entrada principal"
                  value={newAsambleaForm.title}
                  onChange={(e) => setNewAsambleaForm({ ...newAsambleaForm, title: e.target.value })}
                  onKeyDown={onEnterKey(handleCreateAsamblea, createAsambleaLoading)}
                />
              </div>

              <div className="form-group-simple">
                <label>Descripción <span style={{color:'var(--danger,#e53)'}}>*</span></label>
                <textarea
                  className="anuncio-textarea"
                  placeholder="Describe la propuesta de asamblea"
                  value={newAsambleaForm.description}
                  onChange={(e) => setNewAsambleaForm({ ...newAsambleaForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group-simple">
                  <label>Fecha de inicio <span style={{color:'var(--danger,#e53)'}}>*</span></label>
                  <input
                    type="date"
                    value={newAsambleaForm.startDate}
                    onChange={(e) => setNewAsambleaForm({ ...newAsambleaForm, startDate: e.target.value })}
                    onKeyDown={onEnterKey(handleCreateAsamblea, createAsambleaLoading)}
                  />
                </div>
                <div className="form-group-simple">
                  <label>Fecha de vencimiento <span style={{color:'var(--danger,#e53)'}}>*</span></label>
                  <input
                    type="date"
                    value={newAsambleaForm.dueDate}
                    min={newAsambleaForm.startDate || undefined}
                    onChange={(e) => setNewAsambleaForm({ ...newAsambleaForm, dueDate: e.target.value })}
                    onKeyDown={onEnterKey(handleCreateAsamblea, createAsambleaLoading)}
                  />
                </div>
              </div>

              <div className="form-group-simple">
                <label>Documento (PDF, Word, Excel, imagen — máx. 10 MB)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png"
                  onChange={(e) => setNewAsambleaFile(e.target.files?.[0] || null)}
                  style={{ paddingTop: 6 }}
                />
                {newAsambleaFile && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary,#666)', marginTop: 4 }}>
                    Archivo seleccionado: {newAsambleaFile.name}
                  </p>
                )}
              </div>
            </div>

            {createAsambleaError && (
              <p style={{color:'var(--danger)',fontSize:'0.85rem',margin:'0 0 0.5rem',padding:'0 1.5rem'}}>{createAsambleaError}</p>
            )}
            <footer className="modal-footer-simple">
              <button className="btn btn-secondary" type="button" disabled={createAsambleaLoading} onClick={() => { setIsCreateAsambleaModalOpen(false); setNewAsambleaFile(null); setCreateAsambleaError(''); }}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" disabled={createAsambleaLoading} onClick={handleCreateAsamblea}>
                {createAsambleaLoading ? (
                  <span style={{display:'flex',alignItems:'center',gap:'0.4rem'}}>
                    <svg style={{width:14,height:14,animation:'spin 0.8s linear infinite'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                    Creando…
                  </span>
                ) : 'Crear Asamblea'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {isEditAsambleaModalOpen && editingAsamblea && (
        <div className="modal-overlay">
          <div className="modal-content modal-edit-user modal-create-announcement">
            <h2>Editar Asamblea</h2>

            <div className="modal-body-simple">
              <div className="form-group-simple">
                <label>Título <span style={{color:'var(--danger,#e53)'}}>*</span></label>
                <input
                  type="text"
                  value={editAsambleaForm.title}
                  onChange={(e) => setEditAsambleaForm({ ...editAsambleaForm, title: e.target.value })}
                  onKeyDown={onEnterKey(handleEditAsamblea)}
                />
              </div>

              <div className="form-group-simple">
                <label>Descripción</label>
                <textarea
                  className="anuncio-textarea"
                  value={editAsambleaForm.description}
                  onChange={(e) => setEditAsambleaForm({ ...editAsambleaForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group-simple">
                  <label>Fecha de inicio</label>
                  <input
                    type="date"
                    value={editAsambleaForm.startDate}
                    onChange={(e) => setEditAsambleaForm({ ...editAsambleaForm, startDate: e.target.value })}
                    onKeyDown={onEnterKey(handleEditAsamblea)}
                  />
                </div>
                <div className="form-group-simple">
                  <label>Fecha de vencimiento</label>
                  <input
                    type="date"
                    value={editAsambleaForm.dueDate}
                    min={editAsambleaForm.startDate || undefined}
                    onChange={(e) => setEditAsambleaForm({ ...editAsambleaForm, dueDate: e.target.value })}
                    onKeyDown={onEnterKey(handleEditAsamblea)}
                  />
                </div>
              </div>

              <div className="form-group-simple">
                <label>Reemplazar documento (opcional)</label>
                {editingAsamblea.documentName && !editAsambleaFile && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary,#666)', marginBottom: 6 }}>
                    Documento actual: {editingAsamblea.documentName}
                  </p>
                )}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png"
                  onChange={(e) => setEditAsambleaFile(e.target.files?.[0] || null)}
                  style={{ paddingTop: 6 }}
                />
                {editAsambleaFile && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary,#666)', marginTop: 4 }}>
                    Nuevo archivo: {editAsambleaFile.name}
                  </p>
                )}
              </div>
            </div>

            <footer className="modal-footer-simple">
              <button className="btn btn-secondary" type="button" onClick={() => { setIsEditAsambleaModalOpen(false); setEditingAsamblea(null); setEditAsambleaFile(null); }}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" onClick={handleEditAsamblea}>
                Guardar Cambios
              </button>
            </footer>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <span>{t.message}</span>
              <button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>✕</button>
            </div>
          ))}
        </div>
      )}

    </main>
  );
}

export default function App() {
  const [screen, setScreen]           = useState(() =>
    localStorage.getItem("ignitel_visited") === "true" ? "login" : "landing"
  );
  const [sessionUser, setSessionUser] = useState(null);
  const [expiredMsg, setExpiredMsg]   = useState("");
  const [isDarkMode, setIsDarkMode]   = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDarkMode ? "dark" : "light");
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  // Auto-logout when backend returns 401 (token expired or invalid)
  useEffect(() => {
    const unsub = onUnauthorized((expired) => {
      api.logout();
      setSessionUser(null);
      setExpiredMsg(
        expired
          ? "Tu sesión expiró. Ingresá nuevamente."
          : "Tu sesión fue cerrada. Ingresá nuevamente."
      );
      setScreen("login");
    });
    return unsub;
  }, []);

  if (screen === "login") {
    return (
      <Login
        onBack={() => { setScreen("landing"); setExpiredMsg(""); }}
        expiredMsg={expiredMsg}
        onLogin={(user) => {
          setExpiredMsg("");
          setSessionUser(user);
          setScreen("dashboard");
        }}
      />
    );
  }

  if (screen === "dashboard" && sessionUser) {
    return (
      <Dashboard
        user={sessionUser}
        onUpdateUser={(patch) => setSessionUser((prev) => (prev ? { ...prev, ...patch } : prev))}
        isDarkMode={isDarkMode}
        onToggleDark={toggleDarkMode}
        onLogout={() => {
          api.logout();
          setSessionUser(null);
          setScreen("landing");
        }}
      />
    );
  }

  return <Landing
    onStartLogin={() => {
      localStorage.setItem("ignitel_visited", "true");
      setScreen("login");
    }}
    isDarkMode={isDarkMode}
    onToggleDark={toggleDarkMode}
  />;
}
