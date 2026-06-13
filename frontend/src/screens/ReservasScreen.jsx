import { useState } from "react";
import * as api from "../api.js";

export default function ReservasScreen({
  user,
  condominiosData,
  areasSociales,
  setAreasSociales,
  reservasAreas,
  setReservasAreas,
  setEditingArea,
  setAreaForm,
  setAreaFormError,
  setIsCreateAreaModalOpen,
}) {
  const [areasTab, setAreasTab] = useState('areas'); // 'areas' | 'reservas' | 'cambios'
  const [reservasCondoFilter, setReservasCondoFilter] = useState('todos');
  const [reservasCondoDropdownOpen, setReservasCondoDropdownOpen] = useState(false);

  const handleDeleteArea = async (id) => {
    if (!window.confirm('¿Eliminar esta área social?')) return;
    try {
      await api.deleteAreaSocial(id);
      setAreasSociales(prev => prev.filter(a => a.id !== id));
      setReservasAreas(prev => prev.filter(r => r.areaId !== id));
    } catch (e) { alert('Error: ' + e.message); }
  };

  const handleAprobarReserva = async (id, estado, nota = '') => {
    try {
      const updated = await api.aprobarReservaArea(id, estado, nota);
      setReservasAreas(prev => prev.map(r => r.id === id ? updated : r));
    } catch (e) { alert('Error: ' + e.message); }
  };

  const handleDeleteReservaArea = async (id) => {
    if (!window.confirm('¿Eliminar esta reserva?')) return;
    try {
      await api.deleteReservaArea(id);
      setReservasAreas(prev => prev.filter(r => r.id !== id));
    } catch (e) { alert('Error: ' + e.message); }
  };

  const handleResponderCambio = async (id, aprobado) => {
    try {
      const updated = await api.responderCambioReserva(id, aprobado);
      setReservasAreas(prev => prev.map(r => r.id === id ? updated : r));
    } catch (e) { alert('Error: ' + e.message); }
  };

  const isSA = user.role === 'Super Admin';
  const selectedCondoName = isSA && reservasCondoFilter !== 'todos'
    ? (condominiosData.find(c => String(c.id) === reservasCondoFilter)?.name || '')
    : '';

  const myAreas = isSA
    ? (selectedCondoName ? areasSociales.filter(a => a.condo === selectedCondoName) : areasSociales)
    : areasSociales.filter(a => a.condo === user.condo);

  const myReservas = isSA
    ? (selectedCondoName ? reservasAreas.filter(r => r.condo === selectedCondoName) : reservasAreas)
    : reservasAreas.filter(r => r.condo === user.condo);

  const pendientes        = myReservas.filter(r => r.estado === 'pendiente');
  const cambiosPendientes = myReservas.filter(r => r.solicitudCambio?.estado === 'pendiente');

  return (
    <>
      <header className="dashboard-header dashboard-header-with-actions">
        <div>
          <h1>Áreas y Reservas</h1>
          <p>Gestiona las áreas sociales y las reservas del condominio.</p>
        </div>
        {areasTab === 'areas' && (
          <button className="btn btn-primary" onClick={() => { setEditingArea(null); setAreaForm({ nombre: '', descripcion: '', precio: '', condo: '', imagen: null, imagenPreview: '' }); setAreaFormError(''); setIsCreateAreaModalOpen(true); }}>
            + Crear Área
          </button>
        )}
      </header>

      {/* Filtro por condominio — solo Super Admin */}
      {isSA && (
        <div className="module-filters-row">
          <div className="management-condo-field">
            <label>Condominio / Edificio</label>
            <div className="condo-dropdown" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setReservasCondoDropdownOpen(false); }} tabIndex={-1}>
              <button type="button" className="condo-dropdown-trigger" onClick={() => setReservasCondoDropdownOpen(o => !o)} aria-expanded={reservasCondoDropdownOpen}>
                <span className="condo-dropdown-value">
                  {reservasCondoFilter === 'todos'
                    ? 'Todos los condominios'
                    : (() => { const c = condominiosData.find(c => String(c.id) === reservasCondoFilter); return c ? `${c.type}: ${c.name}` : 'Todos los condominios'; })()}
                </span>
                <svg className={`condo-dropdown-chevron${reservasCondoDropdownOpen ? ' open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {reservasCondoDropdownOpen && (
                <ul className="condo-dropdown-list" role="listbox">
                  <li role="option" aria-selected={reservasCondoFilter === 'todos'} className={`condo-dropdown-item${reservasCondoFilter === 'todos' ? ' selected' : ''}`} onMouseDown={() => { setReservasCondoFilter('todos'); setReservasCondoDropdownOpen(false); }}>
                    Todos los condominios
                  </li>
                  {condominiosData.map(c => (
                    <li key={c.id} role="option" aria-selected={reservasCondoFilter === String(c.id)} className={`condo-dropdown-item${reservasCondoFilter === String(c.id) ? ' selected' : ''}`} onMouseDown={() => { setReservasCondoFilter(String(c.id)); setReservasCondoDropdownOpen(false); }}>
                      {c.type}: {c.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="areas-tabs">
        {[['areas','Áreas Sociales'], ['reservas',`Reservas${pendientes.length ? ` (${pendientes.length})` : ''}`], ['cambios',`Cambios${cambiosPendientes.length ? ` (${cambiosPendientes.length})` : ''}`]].map(([key, label]) => (
          <button key={key} className={`areas-tab${areasTab === key ? ' areas-tab-active' : ''}`} onClick={() => setAreasTab(key)}>{label}</button>
        ))}
      </div>

      {/* Tab: Áreas Sociales */}
      {areasTab === 'areas' && (
        <div className="areas-grid">
          {myAreas.length === 0 && (
            <div className="empty-state" style={{gridColumn:'1/-1'}}>
              <div className="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg></div>
              <p className="empty-state-title">Sin áreas creadas</p>
              <p className="empty-state-subtitle">Creá la primera área social para que los propietarios puedan reservar.</p>
            </div>
          )}
          {myAreas.map(area => (
            <article key={area.id} className="area-card">
              <div className="area-card-img-wrap">
                {area.imagenUrl ? <img src={area.imagenUrl} alt={area.nombre} className="area-card-img" /> : <div className="area-card-img-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>}
                <div className="area-card-actions">
                  <button className="area-card-btn" title="Editar" onClick={() => { setEditingArea(area); setAreaForm({ nombre: area.nombre, descripcion: area.descripcion || '', precio: String(area.precio || ''), condo: area.condo || '', imagen: null, imagenPreview: area.imagenUrl || '' }); setAreaFormError(''); setIsCreateAreaModalOpen(true); }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25Z"/></svg>
                  </button>
                  <button className="area-card-btn area-card-btn-delete" title="Eliminar" onClick={() => handleDeleteArea(area.id)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM8 9H16V19H8V9ZM15.5 4L14.5 3H9.5L8.5 4H5V6H19V4H15.5Z"/></svg>
                  </button>
                </div>
              </div>
              <div className="area-card-body">
                <h3 className="area-card-name">{area.nombre}</h3>
                {area.descripcion && <p className="area-card-desc">{area.descripcion}</p>}
                <p className="area-card-price">{Number(area.precio) > 0 ? `Bs. ${Number(area.precio).toLocaleString()} por reserva` : 'Sin costo'}</p>
                <p className="area-card-reservas-count">{myReservas.filter(r => r.areaId === area.id && r.estado !== 'rechazada').length} reserva(s) activa(s)</p>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Tab: Reservas */}
      {areasTab === 'reservas' && (
        <div className="reservas-areas-list">
          {myReservas.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><p className="empty-state-title">Sin reservas</p><p className="empty-state-subtitle">Aún no hay solicitudes de reserva.</p></div>
          ) : myReservas.map(r => {
            const areaImg = areasSociales.find(a => a.id === r.areaId)?.imagenUrl || '';
            return (
            <article key={r.id} className="reserva-area-card">
              {areaImg && <img src={areaImg} alt={r.areaNombre} className="reserva-area-card-img" />}
              <div className="reserva-area-card-top">
                <div>
                  <p className="reserva-area-nombre">{r.areaNombre}</p>
                  <p className="reserva-area-meta">{r.propietario} · {r.propiedad}</p>
                  <p className="reserva-area-horario">📅 {r.fecha} · ⏰ {r.horaInicio}–{r.horaFin}</p>
                  {r.nota && <p className="reserva-area-nota">"{r.nota}"</p>}
                </div>
                <span className={`pagos-status-chip pagos-status-${r.estado}`}>{r.estado}</span>
              </div>
              {r.estado === 'pendiente' && (
                <div className="reserva-area-card-actions">
                  <button className="btn btn-primary" style={{fontSize:'0.82rem',padding:'0.3rem 0.8rem'}} onClick={() => handleAprobarReserva(r.id, 'aprobada')}>Aprobar</button>
                  <button className="btn btn-secondary" style={{fontSize:'0.82rem',padding:'0.3rem 0.8rem'}} onClick={() => handleAprobarReserva(r.id, 'rechazada')}>Rechazar</button>
                  <button className="area-card-btn area-card-btn-delete" onClick={() => handleDeleteReservaArea(r.id)} title="Eliminar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM8 9H16V19H8V9ZM15.5 4L14.5 3H9.5L8.5 4H5V6H19V4H15.5Z"/></svg>
                  </button>
                </div>
              )}
              {r.estado !== 'pendiente' && (
                <button className="area-card-btn area-card-btn-delete" style={{marginTop:'0.5rem'}} onClick={() => handleDeleteReservaArea(r.id)} title="Eliminar">Eliminar</button>
              )}
            </article>
            );
          })}
        </div>
      )}

      {/* Tab: Cambios */}
      {areasTab === 'cambios' && (
        <div className="reservas-areas-list">
          {cambiosPendientes.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg></div><p className="empty-state-title">Sin solicitudes de cambio</p><p className="empty-state-subtitle">No hay cambios de horario pendientes.</p></div>
          ) : cambiosPendientes.map(r => {
            const areaImg = areasSociales.find(a => a.id === r.areaId)?.imagenUrl || '';
            return (
            <article key={r.id} className="reserva-area-card">
              {areaImg && <img src={areaImg} alt={r.areaNombre} className="reserva-area-card-img" />}
              <p className="reserva-area-nombre">{r.areaNombre}</p>
              <p className="reserva-area-meta">{r.propietario} · {r.propiedad}</p>
              <div className="reserva-cambio-dates">
                <div className="reserva-cambio-from"><p>Horario actual</p><strong>{r.fecha} · {r.horaInicio}–{r.horaFin}</strong></div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:20,height:20,color:'#6366f1',flexShrink:0}}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                <div className="reserva-cambio-to"><p>Solicita cambio a</p><strong>{r.solicitudCambio.fecha} · {r.solicitudCambio.horaInicio}–{r.solicitudCambio.horaFin}</strong></div>
              </div>
              {r.solicitudCambio.nota && <p className="reserva-area-nota">"{r.solicitudCambio.nota}"</p>}
              <div className="reserva-area-card-actions">
                <button className="btn btn-primary" style={{fontSize:'0.82rem',padding:'0.3rem 0.8rem'}} onClick={() => handleResponderCambio(r.id, true)}>Aprobar cambio</button>
                <button className="btn btn-secondary" style={{fontSize:'0.82rem',padding:'0.3rem 0.8rem'}} onClick={() => handleResponderCambio(r.id, false)}>Rechazar cambio</button>
              </div>
            </article>
            );
          })}
        </div>
      )}
    </>
  );
}
