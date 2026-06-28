import { useRef, useState } from "react";
import * as api from "../api.js";
import { parseAreaImages } from "../utils/images.js";

export default function ReservasScreen({
  user,
  condominiosData,
  areasSociales,
  setAreasSociales,
  reservasAreas,
  setReservasAreas,
  setPropiedadesData,
  pagosData,
  setPagosData,
  setEditingArea,
  setAreaForm,
  setAreaFormError,
  setIsCreateAreaModalOpen,
}) {
  const [areasTab, setAreasTab] = useState('areas'); // 'areas' | 'reservas' | 'cambios'
  const [reservasCondoFilter, setReservasCondoFilter] = useState('todos');
  const [reservasDateFilter, setReservasDateFilter] = useState('proximas'); // 'proximas' | 'pasadas'
  const [reservasCondoDropdownOpen, setReservasCondoDropdownOpen] = useState(false);
  const [confirmPrompt, setConfirmPrompt] = useState(null); // { message, onAccept }
  const [viewingArea, setViewingArea] = useState(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [carouselDragOffset, setCarouselDragOffset] = useState(0);
  const [isDraggingCarousel, setIsDraggingCarousel] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState(null);
  const carouselDragStartXRef = useRef(0);
  const carouselDraggedRef = useRef(false);

  const askConfirm = (message, onAccept) => setConfirmPrompt({ message, onAccept });

  const viewingAreaImages = viewingArea ? parseAreaImages(viewingArea.imagenUrl) : [];

  // Carrusel de fotos del área (botones en laptop, deslizar en dispositivo)
  const handleCarouselDragStart = (clientX) => {
    carouselDragStartXRef.current = clientX;
    carouselDraggedRef.current = false;
    setIsDraggingCarousel(true);
  };
  const handleCarouselDragMove = (clientX) => {
    if (!isDraggingCarousel) return;
    const offset = clientX - carouselDragStartXRef.current;
    if (Math.abs(offset) > 5) carouselDraggedRef.current = true;
    setCarouselDragOffset(offset);
  };
  const handleCarouselDragEnd = () => {
    if (!isDraggingCarousel) return;
    setIsDraggingCarousel(false);
    const threshold = 50;
    if (carouselDragOffset <= -threshold) {
      setCarouselIdx(prev => (prev + 1) % viewingAreaImages.length);
    } else if (carouselDragOffset >= threshold) {
      setCarouselIdx(prev => (prev - 1 + viewingAreaImages.length) % viewingAreaImages.length);
    }
    setCarouselDragOffset(0);
  };

  const handleDeleteArea = (id) => {
    askConfirm('¿Eliminar esta área social? Esta acción no se puede deshacer.', async () => {
      try {
        await api.deleteAreaSocial(id);
        setAreasSociales(prev => prev.filter(a => a.id !== id));
        setReservasAreas(prev => prev.filter(r => r.areaId !== id));
      } catch (e) { alert('Error: ' + e.message); }
    });
  };

  const handleAprobarReserva = async (id, estado, nota = '') => {
    try {
      const updated = await api.aprobarReservaArea(id, estado, nota);
      setReservasAreas(prev => prev.map(r => r.id === id ? updated : r));
    } catch (e) { alert('Error: ' + e.message); }
  };

  const handleAprobarPagoReserva = async (pagoId, estado) => {
    try {
      const updated = await api.updatePagoStatus(pagoId, estado);
      setPagosData(prev => prev.map(p => String(p.id) === String(pagoId) ? updated : p));
    } catch (e) { alert('Error: ' + e.message); }
  };

  const handleCobrarReserva = async (id) => {
    try {
      const { reserva, propiedad } = await api.cobrarReservaArea(id);
      setReservasAreas(prev => prev.map(r => r.id === id ? reserva : r));
      // Refleja al instante el cargo extra recién creado — sin esto, el
      // Dashboard y "Gestión de Expensas" quedan con el número viejo hasta recargar.
      if (propiedad) {
        setPropiedadesData(prev => prev.map(p => String(p.id) === String(propiedad.id) ? propiedad : p));
      }
    } catch (e) { alert('Error: ' + e.message); }
  };

  const handleDeleteReservaArea = (id) => {
    askConfirm('¿Eliminar esta reserva? Esta acción no se puede deshacer.', async () => {
      try {
        await api.deleteReservaArea(id);
        setReservasAreas(prev => prev.filter(r => r.id !== id));
      } catch (e) { alert('Error: ' + e.message); }
    });
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

  // Próximas vs pasadas (según fecha + hora de fin de la reserva)
  const now               = new Date();
  const esReservaPasada   = r => new Date(`${r.fecha}T${r.horaFin || '23:59'}`) < now;
  // Las solicitudes se atienden en orden de llegada — pendientes primero, las
  // más viejas arriba, así el admin las va resolviendo una por una.
  const reservasProximas  = myReservas.filter(r => !esReservaPasada(r)).sort((a, b) => {
    if (a.estado === 'pendiente' && b.estado !== 'pendiente') return -1;
    if (a.estado !== 'pendiente' && b.estado === 'pendiente') return 1;
    return new Date(a.insertedAt) - new Date(b.insertedAt);
  });
  const reservasPasadas   = myReservas.filter(r => esReservaPasada(r)).sort((a, b) => `${b.fecha}T${b.horaFin}`.localeCompare(`${a.fecha}T${a.horaFin}`));
  const reservasVisibles  = reservasDateFilter === 'pasadas' ? reservasPasadas : reservasProximas;

  return (
    <>
      <header className="dashboard-header dashboard-header-with-actions">
        <div>
          <h1>Áreas y Reservas</h1>
          <p>Gestiona las áreas sociales y las reservas del condominio.</p>
        </div>
        {areasTab === 'areas' && (
          <button className="btn btn-primary" onClick={() => { setEditingArea(null); setAreaForm({ nombre: '', descripcion: '', precio: '', condo: '', imagenesNuevas: [], imagenesExistentes: [] }); setAreaFormError(''); setIsCreateAreaModalOpen(true); }}>
            + Crear Área
          </button>
        )}
      </header>

      {areasTab === 'reservas' && (
        <p className="reservas-anticipacion-notice">ℹ Las reservas deben solicitarse con al menos 24 horas de anticipación.</p>
      )}

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
          {myAreas.map(area => {
            const areaImages = parseAreaImages(area.imagenUrl);
            return (
            <article key={area.id} className="area-card area-card-clickable" onClick={() => { setViewingArea(area); setCarouselIdx(0); }}>
              <div className="area-card-img-wrap">
                {areaImages[0] ? <img src={areaImages[0]} alt={area.nombre} className="area-card-img" /> : <div className="area-card-img-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>}
                {areaImages.length > 1 && <span className="area-card-img-count">{areaImages.length} fotos</span>}
                <div className="area-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="area-card-btn" title="Editar" onClick={() => { setEditingArea(area); setAreaForm({ nombre: area.nombre, descripcion: area.descripcion || '', precio: String(area.precio || ''), condo: area.condo || '', imagenesNuevas: [], imagenesExistentes: parseAreaImages(area.imagenUrl) }); setAreaFormError(''); setIsCreateAreaModalOpen(true); }}>
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
          )})}
        </div>
      )}

      {/* Tab: Reservas */}
      {areasTab === 'reservas' && (
        <div className="reservas-areas-list">
          <div className="areas-tabs" style={{marginBottom:'1rem'}}>
            <button className={`areas-tab${reservasDateFilter === 'proximas' ? ' areas-tab-active' : ''}`} onClick={() => setReservasDateFilter('proximas')}>
              Próximas{reservasProximas.length ? ` (${reservasProximas.length})` : ''}
            </button>
            <button className={`areas-tab${reservasDateFilter === 'pasadas' ? ' areas-tab-active' : ''}`} onClick={() => setReservasDateFilter('pasadas')}>
              Pasadas{reservasPasadas.length ? ` (${reservasPasadas.length})` : ''}
            </button>
          </div>

          {reservasVisibles.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><p className="empty-state-title">{reservasDateFilter === 'pasadas' ? 'Sin reservas pasadas' : 'Sin reservas próximas'}</p><p className="empty-state-subtitle">{reservasDateFilter === 'pasadas' ? 'Las reservas finalizadas aparecerán aquí.' : 'Aún no hay solicitudes de reserva próximas.'}</p></div>
          ) : reservasVisibles.map(r => {
            const area    = areasSociales.find(a => a.id === r.areaId);
            const areaImg = parseAreaImages(area?.imagenUrl)[0] || '';
            const precio  = Number(area?.precio) || 0;
            const necesitaCobro = precio > 0 && !r.cobrado;
            const pago = precio > 0 ? pagosData.find(p => p.reservaId === r.id) : null;
            const pagoNoAprobado = precio > 0 && r.cobrado && (!pago || pago.estado !== 'aprobado');
            return (
            <article key={r.id} className="reserva-area-card">
              {areaImg && <img src={areaImg} alt={r.areaNombre} className="reserva-area-card-img" />}
              <div className="reserva-area-card-top">
                <div>
                  <p className="reserva-area-nombre">{r.areaNombre}</p>
                  <p className="reserva-area-meta">{r.propietario} · {r.propiedad}</p>
                  <p className="reserva-area-horario">
                    <span className="reserva-area-horario-item">
                      <svg className="reserva-area-horario-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {r.fecha}
                    </span>
                    <span className="reserva-area-horario-sep">·</span>
                    <span className="reserva-area-horario-item">
                      <svg className="reserva-area-horario-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                      {r.diaCompleto ? 'Todo el día' : `${r.horaInicio}–${r.horaFin}`}
                    </span>
                  </p>
                  {r.nota && <p className="reserva-area-nota">"{r.nota}"</p>}
                  {precio > 0 && (
                    <p className={`reserva-cobro-status${r.cobrado ? ' reserva-cobro-status-ok' : ''}`}>
                      {r.cobrado ? '✓ Cobrado' : `Sin cobrar — Bs. ${precio.toLocaleString()}`}
                    </p>
                  )}
                  {r.cobrado && precio > 0 && (
                    <div className="reserva-pago-comprobante">
                      {!pago ? (
                        <p className="reserva-cobro-status reserva-cobro-status-pending">⏱ Esperando que suba el comprobante.</p>
                      ) : (
                        <>
                          <p className="reserva-pago-linea">
                            Pago: <span className={`pagos-status-chip pagos-status-${pago.estado}`}>{pago.estado}</span> · Bs. {Number(pago.monto).toLocaleString()}
                          </p>
                          {pago.comprobante && (() => {
                            const url = pago.comprobante?.startsWith('http') ? pago.comprobante : api.getUploadUrl(`comprobantes/${pago.comprobante}`);
                            const isPdf = url.toLowerCase().endsWith('.pdf');
                            return isPdf ? (
                              <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary pago-comprobante-pdf-link">Ver comprobante (PDF)</a>
                            ) : (
                              <img src={url} alt="Comprobante de pago" className="reserva-pago-comprobante-img" onClick={() => setZoomImageUrl(url)} title="Ver comprobante completo" />
                            );
                          })()}
                          {pago.estado === 'pendiente' && (
                            <div className="reserva-area-card-actions-row" style={{marginTop:'0.4rem'}}>
                              <button className="btn btn-primary" style={{fontSize:'0.78rem',padding:'0.25rem 0.6rem'}} onClick={() => askConfirm('¿Aprobar este pago?', () => handleAprobarPagoReserva(pago.id, 'aprobado'))}>
                                Aprobar pago
                              </button>
                              <button className="btn btn-secondary" style={{fontSize:'0.78rem',padding:'0.25rem 0.6rem'}} onClick={() => askConfirm('¿Rechazar este pago?', () => handleAprobarPagoReserva(pago.id, 'rechazado'))}>
                                Rechazar pago
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                <span className={`pagos-status-chip pagos-status-${r.estado}`}>{r.estado}</span>
              </div>
              {r.estado === 'pendiente' && (
                <div className="reserva-area-card-actions reserva-area-card-actions-row">
                  {necesitaCobro && (
                    <button className="btn btn-primary" style={{fontSize:'0.82rem',padding:'0.3rem 0.8rem'}}
                      onClick={() => askConfirm(`¿Cobrar Bs. ${precio.toLocaleString()} como cargo extra a ${r.propietario}?`, () => handleCobrarReserva(r.id))}>
                      Cobrar Bs. {precio.toLocaleString()}
                    </button>
                  )}
                  <button className="btn btn-primary" style={{fontSize:'0.82rem',padding:'0.3rem 0.8rem'}}
                    disabled={necesitaCobro || pagoNoAprobado}
                    title={necesitaCobro ? 'Primero tenés que cobrar la reserva' : pagoNoAprobado ? 'Esperá a que el pago esté aprobado' : ''}
                    onClick={() => askConfirm('¿Confirmás aprobar esta reserva?', () => handleAprobarReserva(r.id, 'aprobada'))}>
                    Aprobar
                  </button>
                  <button className="btn btn-secondary" style={{fontSize:'0.82rem',padding:'0.3rem 0.8rem'}}
                    onClick={() => askConfirm('¿Confirmás rechazar esta reserva?', () => handleAprobarReserva(r.id, 'rechazada'))}>
                    Rechazar
                  </button>
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
            const areaImg = parseAreaImages(areasSociales.find(a => a.id === r.areaId)?.imagenUrl)[0] || '';
            return (
            <article key={r.id} className="reserva-area-card">
              {areaImg && <img src={areaImg} alt={r.areaNombre} className="reserva-area-card-img" />}
              <p className="reserva-area-nombre">{r.areaNombre}</p>
              <p className="reserva-area-meta">{r.propietario} · {r.propiedad}</p>
              <div className="reserva-cambio-dates">
                <div className="reserva-cambio-from"><p>Horario actual</p><strong>{r.fecha} · {r.diaCompleto ? 'Todo el día' : `${r.horaInicio}–${r.horaFin}`}</strong></div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:20,height:20,color:'#6366f1',flexShrink:0}}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                <div className="reserva-cambio-to"><p>Solicita cambio a</p><strong>{r.solicitudCambio.fecha} · {r.solicitudCambio.diaCompleto ? 'Todo el día' : `${r.solicitudCambio.horaInicio}–${r.solicitudCambio.horaFin}`}</strong></div>
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

      {viewingArea && (
        <div className="modal-overlay" onClick={() => setViewingArea(null)}>
          <div className="modal-content modal-edit-user" onClick={(e) => e.stopPropagation()}>
            <h2>{viewingArea.nombre}</h2>
            <div className="modal-body-simple">
              {viewingAreaImages.length === 1 && (
                <img src={viewingAreaImages[0]} alt={viewingArea.nombre} className="reserva-form-img"
                  style={{cursor: 'zoom-in'}} onClick={() => setZoomImageUrl(viewingAreaImages[0])} />
              )}

              {viewingAreaImages.length > 1 && (
                <div className="area-image-carousel">
                  <div
                    className="area-image-carousel-track"
                    style={{
                      transform: `translateX(calc(-${carouselIdx * 100}% + ${carouselDragOffset}px))`,
                      transition: isDraggingCarousel ? "none" : undefined,
                      touchAction: "pan-y",
                      userSelect: isDraggingCarousel ? "none" : undefined,
                    }}
                    onTouchStart={(e) => handleCarouselDragStart(e.touches[0].clientX)}
                    onTouchMove={(e) => handleCarouselDragMove(e.touches[0].clientX)}
                    onTouchEnd={handleCarouselDragEnd}
                    onMouseDown={(e) => handleCarouselDragStart(e.clientX)}
                    onMouseMove={(e) => handleCarouselDragMove(e.clientX)}
                    onMouseUp={handleCarouselDragEnd}
                    onMouseLeave={handleCarouselDragEnd}
                  >
                    {viewingAreaImages.map((url, i) => (
                      <img key={url} src={url} alt={`${viewingArea.nombre} ${i + 1}`} className="area-image-carousel-slide"
                        style={{cursor: 'zoom-in'}}
                        onClick={() => { if (!carouselDraggedRef.current) setZoomImageUrl(url); }} />
                    ))}
                  </div>

                  <button type="button" className="area-image-carousel-arrow area-image-carousel-arrow-prev" aria-label="Foto anterior" onClick={() => setCarouselIdx(prev => (prev - 1 + viewingAreaImages.length) % viewingAreaImages.length)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <button type="button" className="area-image-carousel-arrow area-image-carousel-arrow-next" aria-label="Foto siguiente" onClick={() => setCarouselIdx(prev => (prev + 1) % viewingAreaImages.length)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>

                  <div className="carousel-dots area-image-carousel-dots" role="tablist" aria-label="Fotos">
                    {viewingAreaImages.map((_, i) => (
                      <button key={i} type="button" role="tab" aria-selected={i === carouselIdx} aria-label={`Foto ${i + 1}`} className={`carousel-dot${i === carouselIdx ? ' carousel-dot-active' : ''}`} onClick={() => setCarouselIdx(i)} />
                    ))}
                  </div>
                </div>
              )}

              {viewingArea.descripcion && <p className="area-detail-desc">{viewingArea.descripcion}</p>}

              <div className="propiedad-line-item">
                <span>Condominio</span>
                <strong>{viewingArea.condo || '—'}</strong>
              </div>
              <div className="propiedad-line-item">
                <span>Precio</span>
                <strong>{Number(viewingArea.precio) > 0 ? `Bs. ${Number(viewingArea.precio).toLocaleString()} por reserva` : 'Sin costo'}</strong>
              </div>
              <div className="propiedad-line-item">
                <span>Estado</span>
                <strong>{viewingArea.activo === false ? 'Inactiva' : 'Activa'}</strong>
              </div>
              <div className="propiedad-line-item">
                <span>Reservas activas</span>
                <strong>{myReservas.filter(r => r.areaId === viewingArea.id && r.estado !== 'rechazada').length}</strong>
              </div>
            </div>
            <footer className="modal-footer-simple">
              <button className="btn btn-secondary" onClick={() => setViewingArea(null)}>Cerrar</button>
            </footer>
          </div>
        </div>
      )}

      {zoomImageUrl && (
        <div className="qr-zoom-overlay" onClick={() => setZoomImageUrl(null)}>
          <div className="qr-zoom-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="qr-zoom-close" onClick={() => setZoomImageUrl(null)} aria-label="Cerrar">✕</button>
            <img src={zoomImageUrl} alt="Foto ampliada" className="qr-zoom-img" />
          </div>
        </div>
      )}

      {confirmPrompt && (
        <div className="modal-overlay modal-overlay-centered" onClick={() => setConfirmPrompt(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-icon" aria-hidden="true">?</div>
            <h2>¿Estás seguro?</h2>
            <p>{confirmPrompt.message}</p>
            <div className="confirm-modal-actions">
              <button type="button" className="confirm-modal-cancel" onClick={() => setConfirmPrompt(null)}>Cancelar</button>
              <button type="button" className="confirm-modal-accept" onClick={() => { confirmPrompt.onAccept(); setConfirmPrompt(null); }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
