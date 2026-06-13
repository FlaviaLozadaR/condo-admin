import { useState } from "react";
import * as api from "../api.js";

export default function MisReservasScreen({
  user,
  areasSociales,
  reservasAreas,
  setReservasAreas,
}) {
  const [selectedAreaForReserva, setSelectedAreaForReserva] = useState(null);
  const [reservaForm, setReservaForm] = useState({ fecha: '', horaInicio: '08:00', horaFin: '10:00', nota: '' });
  const [reservaFormLoading, setReservaFormLoading] = useState(false);
  const [reservaFormError, setReservaFormError] = useState('');
  const [cambioForm, setCambioForm] = useState({ fecha: '', horaInicio: '08:00', horaFin: '10:00', nota: '' });
  const [solicitandoCambioId, setSolicitandoCambioId] = useState(null);

  const handleCrearReserva = async () => {
    if (!reservaForm.fecha || !reservaForm.horaInicio || !reservaForm.horaFin) {
      setReservaFormError('Completá fecha y horario'); return;
    }
    if (reservaForm.horaInicio >= reservaForm.horaFin) {
      setReservaFormError('La hora de fin debe ser mayor a la de inicio'); return;
    }
    setReservaFormLoading(true); setReservaFormError('');
    try {
      const nueva = await api.createReservaArea({
        areaId:     selectedAreaForReserva.id,
        areaNombre: selectedAreaForReserva.nombre,
        fecha:      reservaForm.fecha,
        horaInicio: reservaForm.horaInicio,
        horaFin:    reservaForm.horaFin,
        nota:       reservaForm.nota,
      });
      setReservasAreas(prev => [nueva, ...prev]);
      setSelectedAreaForReserva(null);
      setReservaForm({ fecha: '', horaInicio: '08:00', horaFin: '10:00', nota: '' });
    } catch (e) { setReservaFormError(e.message); }
    finally { setReservaFormLoading(false); }
  };

  const handleSolicitarCambio = async (reservaId) => {
    if (!cambioForm.fecha || !cambioForm.horaInicio || !cambioForm.horaFin) {
      alert('Completá fecha y horario'); return;
    }
    if (cambioForm.horaInicio >= cambioForm.horaFin) {
      alert('La hora de fin debe ser mayor a la de inicio'); return;
    }
    try {
      const updated = await api.solicitarCambioReserva(reservaId, cambioForm);
      setReservasAreas(prev => prev.map(r => r.id === reservaId ? updated : r));
      setSolicitandoCambioId(null);
      setCambioForm({ fecha: '', horaInicio: '08:00', horaFin: '10:00', nota: '' });
    } catch (e) { alert('Error: ' + e.message); }
  };

  const disponibles  = areasSociales.filter(a => a.activo !== false);
  const misReservas  = reservasAreas.filter(r => r.propietario === user.name);
  const todasCondo   = reservasAreas; // para detectar conflictos
  const areaSelected = selectedAreaForReserva;

  // Horarios ocupados del área seleccionada en la fecha elegida
  const ocupados = areaSelected && reservaForm.fecha
    ? todasCondo.filter(r => r.areaId === areaSelected.id && r.fecha === reservaForm.fecha && r.estado !== 'rechazada')
    : [];

  return (
    <>
      <header className="dashboard-header owner-header">
        <h1>Reservar Áreas</h1>
        <p>Consultá las áreas sociales disponibles y realizá tu reserva.</p>
      </header>

      {/* Áreas disponibles */}
      {!areaSelected && (
        <>
          <p style={{fontWeight:600,fontSize:'0.9rem',color:'#374151',margin:'0 0 0.75rem'}}>Áreas disponibles</p>
          {disponibles.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg></div><p className="empty-state-title">Sin áreas configuradas</p><p className="empty-state-subtitle">El administrador aún no creó áreas sociales.</p></div>
          ) : (
            <div className="areas-grid">
              {disponibles.map(area => (
                <article key={area.id} className="area-card area-card-resident">
                  <div className="area-card-img-wrap">
                    {area.imagenUrl ? <img src={area.imagenUrl} alt={area.nombre} className="area-card-img" /> : <div className="area-card-img-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>}
                  </div>
                  <div className="area-card-body">
                    <h3 className="area-card-name">{area.nombre}</h3>
                    {area.descripcion && <p className="area-card-desc">{area.descripcion}</p>}
                    <p className="area-card-price">{Number(area.precio) > 0 ? `Bs. ${Number(area.precio).toLocaleString()} por reserva` : 'Sin costo'}</p>
                    <button className="btn btn-primary" style={{width:'100%',marginTop:'0.5rem',fontSize:'0.85rem'}} onClick={() => { setSelectedAreaForReserva(area); setReservaForm({ fecha: '', horaInicio: '08:00', horaFin: '10:00', nota: '' }); setReservaFormError(''); }}>
                      Reservar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* Formulario de reserva */}
      {areaSelected && (
        <div className="reserva-form-wrap">
          <button className="reserva-back-btn" onClick={() => setSelectedAreaForReserva(null)}>← Volver a las áreas</button>
          <h2 className="reserva-form-title">Reservar: {areaSelected.nombre}</h2>
          {areaSelected.imagenUrl && <img src={areaSelected.imagenUrl} alt={areaSelected.nombre} className="reserva-form-img" />}
          {Number(areaSelected.precio) > 0 && <p className="area-card-price">Costo: Bs. ${Number(areaSelected.precio).toLocaleString()}</p>}

          <div className="reserva-form-fields">
            <div className="form-group-simple">
              <label>Fecha *</label>
              <input type="date" min={new Date().toISOString().split('T')[0]} value={reservaForm.fecha} onChange={e => setReservaForm(f => ({...f, fecha: e.target.value}))} />
            </div>
            <div className="form-group-simple">
              <label>Hora inicio *</label>
              <input type="time" value={reservaForm.horaInicio} onChange={e => setReservaForm(f => ({...f, horaInicio: e.target.value}))} />
            </div>
            <div className="form-group-simple">
              <label>Hora fin *</label>
              <input type="time" value={reservaForm.horaFin} onChange={e => setReservaForm(f => ({...f, horaFin: e.target.value}))} />
            </div>
            <div className="form-group-simple">
              <label>Nota (opcional)</label>
              <input type="text" placeholder="Motivo o comentario" value={reservaForm.nota} onChange={e => setReservaForm(f => ({...f, nota: e.target.value}))} />
            </div>
          </div>

          {/* Horarios ocupados */}
          {reservaForm.fecha && (
            <div className="reserva-ocupados">
              <p style={{fontWeight:600,fontSize:'0.82rem',color:'#374151',margin:'0 0 0.4rem'}}>
                {ocupados.length > 0 ? 'Horarios ya reservados para esa fecha:' : '✓ Sin reservas para esa fecha'}
              </p>
              {ocupados.map(r => (
                <span key={r.id} className="reserva-ocupado-chip">{r.horaInicio}–{r.horaFin}</span>
              ))}
            </div>
          )}

          {reservaFormError && <p style={{color:'var(--danger)',fontSize:'0.85rem',margin:'0.5rem 0 0'}}>{reservaFormError}</p>}

          <div style={{display:'flex',gap:'0.75rem',marginTop:'1rem'}}>
            <button className="btn btn-secondary" onClick={() => setSelectedAreaForReserva(null)}>Cancelar</button>
            <button className="btn btn-primary" disabled={reservaFormLoading} onClick={handleCrearReserva}>
              {reservaFormLoading ? 'Enviando…' : 'Solicitar Reserva'}
            </button>
          </div>
        </div>
      )}

      {/* Mis reservas */}
      <div style={{marginTop:'1.5rem'}}>
        <p style={{fontWeight:600,fontSize:'0.9rem',color:'#374151',margin:'0 0 0.75rem'}}>Mis reservas</p>
        {misReservas.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><p className="empty-state-title">Sin reservas</p><p className="empty-state-subtitle">Aún no realizaste ninguna reserva.</p></div>
        ) : misReservas.map(r => (
          <article key={r.id} className="reserva-area-card">
            <div className="reserva-area-card-top">
              <div>
                <p className="reserva-area-nombre">{r.areaNombre}</p>
                <p className="reserva-area-horario">📅 {r.fecha} · ⏰ {r.horaInicio}–{r.horaFin}</p>
                {r.nota && <p className="reserva-area-nota">"{r.nota}"</p>}
                {r.solicitudCambio && (
                  <p style={{fontSize:'0.78rem',color: r.solicitudCambio.estado === 'aprobada' ? '#16a34a' : r.solicitudCambio.estado === 'rechazada' ? '#dc2626' : '#f59e0b',marginTop:'0.25rem'}}>
                    Cambio {r.solicitudCambio.estado}: {r.solicitudCambio.fecha} {r.solicitudCambio.horaInicio}–{r.solicitudCambio.horaFin}
                  </p>
                )}
              </div>
              <span className={`pagos-status-chip pagos-status-${r.estado}`}>{r.estado}</span>
            </div>

            {/* Solicitar cambio */}
            {r.estado === 'aprobada' && !r.solicitudCambio?.estado?.includes('pendiente') && (
              solicitandoCambioId === r.id ? (
                <div className="reserva-cambio-form">
                  <div className="form-group-simple"><label>Nueva fecha</label><input type="date" min={new Date().toISOString().split('T')[0]} value={cambioForm.fecha} onChange={e => setCambioForm(f => ({...f, fecha: e.target.value}))} /></div>
                  <div className="form-group-simple"><label>Hora inicio</label><input type="time" value={cambioForm.horaInicio} onChange={e => setCambioForm(f => ({...f, horaInicio: e.target.value}))} /></div>
                  <div className="form-group-simple"><label>Hora fin</label><input type="time" value={cambioForm.horaFin} onChange={e => setCambioForm(f => ({...f, horaFin: e.target.value}))} /></div>
                  <div className="form-group-simple"><label>Motivo</label><input type="text" value={cambioForm.nota} onChange={e => setCambioForm(f => ({...f, nota: e.target.value}))} /></div>
                  <div style={{display:'flex',gap:'0.5rem',marginTop:'0.5rem'}}>
                    <button className="btn btn-primary" style={{fontSize:'0.82rem'}} onClick={() => handleSolicitarCambio(r.id)}>Enviar solicitud</button>
                    <button className="btn btn-secondary" style={{fontSize:'0.82rem'}} onClick={() => setSolicitandoCambioId(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button className="expensas-edit-btn" style={{marginTop:'0.5rem'}} onClick={() => { setSolicitandoCambioId(r.id); setCambioForm({ fecha: r.fecha, horaInicio: r.horaInicio, horaFin: r.horaFin, nota: '' }); }}>
                  Solicitar cambio de fecha
                </button>
              )
            )}
          </article>
        ))}
      </div>
    </>
  );
}
