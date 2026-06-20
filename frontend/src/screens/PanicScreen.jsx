import { useEffect, useState } from "react";
import * as api from "../api.js";

const MESES_LARGOS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export default function PanicScreen({
  user,
  isSuperAdministrator,
  condominiosData = [],
  panicAlerts,
  setPanicAlerts,
  residentProfile,
  residentStreet,
  residentUnit,
  setIsPanicConfirmOpen,
}) {
  const isSecurity = user.role === "Seguridad";
  const isAdmin    = user.role === "Administrador";
  const canManage  = isSecurity; // solo Seguridad cambia el estado de una alerta
  const canView    = isSecurity || isAdmin || isSuperAdministrator;

  const [seguridadContacts, setSeguridadContacts] = useState([]);
  const [panicViewTab, setPanicViewTab] = useState("activas"); // 'activas' | 'atendidas'

  // Super Admin: filtro de condominio (por defecto ve todos, mezclados)
  const [panicCondoFilter, setPanicCondoFilter] = useState("todos");
  const [panicCondoDropdownOpen, setPanicCondoDropdownOpen] = useState(false);
  const [condoFilteredAlerts, setCondoFilteredAlerts] = useState(null);
  const [loadingCondoFilter, setLoadingCondoFilter] = useState(false);

  // Filtro de mes para la pestaña Atendidas
  const [panicMonthFilter, setPanicMonthFilter] = useState(() => monthKey(new Date()));
  const [panicMonthDropdownOpen, setPanicMonthDropdownOpen] = useState(false);

  useEffect(() => {
    if (isSecurity) return;
    api.getSeguridadContacts()
      .then(setSeguridadContacts)
      .catch((err) => console.error("Error cargando contactos de seguridad:", err.message));
  }, [isSecurity]);

  // Al elegir un condominio específico, pedimos esa vista filtrada al backend.
  // "Todos los condominios" usa la lista global (panicAlerts) sin pedidos extra.
  useEffect(() => {
    if (!isSuperAdministrator) return;
    if (panicCondoFilter === "todos") { setCondoFilteredAlerts(null); return; }
    const condoName = condominiosData.find((c) => String(c.id) === panicCondoFilter)?.name;
    if (!condoName) { setCondoFilteredAlerts(null); return; }
    setLoadingCondoFilter(true);
    api.getPanicAlerts(condoName)
      .then(setCondoFilteredAlerts)
      .catch(() => setCondoFilteredAlerts([]))
      .finally(() => setLoadingCondoFilter(false));
  }, [panicCondoFilter, isSuperAdministrator, condominiosData]);

  const sourceAlerts = condoFilteredAlerts ?? panicAlerts;

  const activePanicAlerts = sourceAlerts.filter((item) => item.status !== "Atendida");
  const attendedAllAlerts = sourceAlerts.filter((item) => item.status === "Atendida");

  // Meses disponibles para filtrar el historial de atendidas, según la fecha real de cada alerta.
  const monthOptions = (() => {
    const map = new Map();
    attendedAllAlerts.forEach((a) => {
      const d = new Date(a.insertedAt);
      if (isNaN(d)) return;
      const key = monthKey(d);
      if (!map.has(key)) map.set(key, { key, year: d.getFullYear(), month: d.getMonth(), label: `${MESES_LARGOS[d.getMonth()]} ${d.getFullYear()}` });
    });
    return Array.from(map.values()).sort((a, b) => (b.year - a.year) || (b.month - a.month));
  })();

  const attendedPanicAlerts = (panicMonthFilter === "todos"
    ? attendedAllAlerts
    : attendedAllAlerts.filter((a) => {
        const d = new Date(a.insertedAt);
        return !isNaN(d) && monthKey(d) === panicMonthFilter;
      })
  );

  const updatePanicAlertStatus = async (id, status) => {
    try {
      await api.updatePanicStatus(String(id), status);
      setPanicAlerts(
        panicAlerts.map((item) =>
          String(item.id) === String(id) ? { ...item, status } : item
        )
      );
    } catch (err) {
      console.error("Error actualizando alerta:", err.message);
    }
  };

  const selectedCondoLabel = panicCondoFilter === "todos"
    ? "Todos los condominios"
    : (() => {
        const c = condominiosData.find((item) => String(item.id) === panicCondoFilter);
        return c ? `${c.type}: ${c.name}` : "Todos los condominios";
      })();

  const selectedMonthLabel = panicMonthFilter === "todos"
    ? "Todos los meses"
    : (monthOptions.find((m) => m.key === panicMonthFilter)?.label || MESES_LARGOS[new Date().getMonth()] + " " + new Date().getFullYear());

  return (
    <>
      <header className="dashboard-header panic-header">
        <h1>Botón de Pánico</h1>
        <p>{canView ? "Alertas activas de los propietarios" : "Sistema de alerta de emergencia"}</p>
      </header>

      {canView ? (
        <section className="panic-security-panel">
          <h2>Alertas Recibidas</h2>
          <p>
            {canManage
              ? "Estas alertas fueron activadas por propietarios y requieren asistencia inmediata."
              : "Solo Seguridad puede cambiar el estado de una alerta — acá podés ver el seguimiento."}
          </p>

          {isSuperAdministrator && (
            <div className="management-condo-field panic-condo-field">
              <label>Condominio / Edificio</label>
              <div className="condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPanicCondoDropdownOpen(false); }} tabIndex={-1}>
                <button
                  type="button"
                  className="condo-dropdown-trigger"
                  onClick={() => setPanicCondoDropdownOpen((o) => !o)}
                  aria-expanded={panicCondoDropdownOpen}
                >
                  <span className="condo-dropdown-value">{selectedCondoLabel}</span>
                  <svg className={`condo-dropdown-chevron${panicCondoDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {panicCondoDropdownOpen && (
                  <ul className="condo-dropdown-list" role="listbox">
                    <li
                      role="option"
                      aria-selected={panicCondoFilter === "todos"}
                      className={`condo-dropdown-item${panicCondoFilter === "todos" ? " selected" : ""}`}
                      onMouseDown={() => { setPanicCondoFilter("todos"); setPanicCondoDropdownOpen(false); }}
                    >
                      Todos los condominios
                    </li>
                    {condominiosData.map((c) => (
                      <li
                        key={c.id}
                        role="option"
                        aria-selected={panicCondoFilter === String(c.id)}
                        className={`condo-dropdown-item${panicCondoFilter === String(c.id) ? " selected" : ""}`}
                        onMouseDown={() => { setPanicCondoFilter(String(c.id)); setPanicCondoDropdownOpen(false); }}
                      >
                        {c.type}: {c.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className="areas-tabs panic-tabs">
            <button type="button" className={`areas-tab${panicViewTab === "activas" ? " areas-tab-active" : ""}`} onClick={() => setPanicViewTab("activas")}>
              Activas{activePanicAlerts.length ? ` (${activePanicAlerts.length})` : ""}
            </button>
            <button type="button" className={`areas-tab${panicViewTab === "atendidas" ? " areas-tab-active" : ""}`} onClick={() => setPanicViewTab("atendidas")}>
              Atendidas{attendedAllAlerts.length ? ` (${attendedAllAlerts.length})` : ""}
            </button>
          </div>

          {panicViewTab === "atendidas" && (
            <div className="management-condo-field panic-month-field">
              <label>Período</label>
              <div className="condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPanicMonthDropdownOpen(false); }} tabIndex={-1}>
                <button
                  type="button"
                  className="condo-dropdown-trigger"
                  onClick={() => setPanicMonthDropdownOpen((o) => !o)}
                  aria-expanded={panicMonthDropdownOpen}
                >
                  <span className="condo-dropdown-value">{selectedMonthLabel}</span>
                  <svg className={`condo-dropdown-chevron${panicMonthDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {panicMonthDropdownOpen && (
                  <ul className="condo-dropdown-list" role="listbox">
                    <li
                      role="option"
                      aria-selected={panicMonthFilter === "todos"}
                      className={`condo-dropdown-item${panicMonthFilter === "todos" ? " selected" : ""}`}
                      onMouseDown={() => { setPanicMonthFilter("todos"); setPanicMonthDropdownOpen(false); }}
                    >
                      Todos los meses
                    </li>
                    {monthOptions.map((opt) => (
                      <li
                        key={opt.key}
                        role="option"
                        aria-selected={panicMonthFilter === opt.key}
                        className={`condo-dropdown-item${panicMonthFilter === opt.key ? " selected" : ""}`}
                        onMouseDown={() => { setPanicMonthFilter(opt.key); setPanicMonthDropdownOpen(false); }}
                      >
                        {opt.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className="panic-alert-list">
            {loadingCondoFilter ? (
              <p>Cargando...</p>
            ) : panicViewTab === "activas" ? (
              activePanicAlerts.length === 0 ? (
                <div className="panic-empty">No hay alertas activas en este momento.</div>
              ) : (
                activePanicAlerts.map((alert) => (
                  <article key={alert.id} className="panic-alert-item">
                    <div>
                      <strong>{alert.resident}</strong>
                      <p>{alert.address} - {alert.unit}{isSuperAdministrator && alert.condo ? ` · ${alert.condo}` : ""}</p>
                      <small>Tel: {alert.phone} · {alert.createdAt}</small>
                    </div>
                    <div className="panic-alert-actions">
                      <span className={`panic-alert-status panic-alert-status-${alert.status === "Pendiente" ? "pending" : "way"}`}>{alert.status}</span>
                      {canManage && (
                        alert.status === "Pendiente" ? (
                          <button type="button" onClick={() => updatePanicAlertStatus(alert.id, "En camino")}>En camino</button>
                        ) : (
                          <button type="button" onClick={() => updatePanicAlertStatus(alert.id, "Atendida")}>Marcar atendida</button>
                        )
                      )}
                    </div>
                  </article>
                ))
              )
            ) : (
              attendedPanicAlerts.length === 0 ? (
                <div className="panic-empty">No hay alertas atendidas en este período.</div>
              ) : (
                attendedPanicAlerts.map((alert) => (
                  <article key={alert.id} className="panic-alert-item panic-alert-item-done">
                    <div>
                      <strong>{alert.resident}</strong>
                      <p>{alert.address} - {alert.unit}{isSuperAdministrator && alert.condo ? ` · ${alert.condo}` : ""}</p>
                      <small>Tel: {alert.phone} · {alert.createdAt}</small>
                    </div>
                    <span className="panic-alert-status panic-alert-status-done">Atendida</span>
                  </article>
                ))
              )
            )}
          </div>
        </section>
      ) : (
        <section className="panic-owner-panel">
          <div className="panic-icon-wrap">
            <span className="panic-icon-circle" aria-hidden="true">!</span>
          </div>
          <h2>Alerta de Emergencia</h2>
          <p>Presiona el botón solo en caso de emergencia real</p>

          <div className="panic-property-box">
            <h3>Información de la propiedad:</h3>
            <p><strong>Dirección:</strong> {residentStreet}</p>
            <p><strong>Unidad:</strong> {residentUnit}</p>
            <p><strong>Residente:</strong> {residentProfile.name}</p>
            <p><strong>Teléfono:</strong> {residentProfile.phone || "+1234567892"}</p>
          </div>

          <button type="button" className="panic-trigger-btn" onClick={() => setIsPanicConfirmOpen(true)}>
            ACTIVAR ALERTA DE EMERGENCIA
          </button>

          <div className="panic-warning-box">
            <strong>Advertencia</strong>
            <p>El uso indebido del botón de pánico puede resultar en sanciones. Utilízalo solo en situaciones de emergencia real.</p>
          </div>

          {seguridadContacts.length > 0 && (
            <div className="panic-security-contacts">
              <h3>Llamar a seguridad</h3>
              <div className="panic-security-contacts-list">
                {seguridadContacts.map((contact) => (
                  <div key={contact.id} className="panic-security-contact-item">
                    <div className="panic-security-contact-info">
                      <strong>{contact.name}</strong>
                      <span>{contact.phone || "Sin número registrado"}</span>
                    </div>
                    {contact.phone && (
                      <a className="btn btn-primary panic-call-btn" href={`tel:${contact.phone}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        Llamar
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
