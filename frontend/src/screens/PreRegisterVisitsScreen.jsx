import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import * as api from "../api.js";

export default function PreRegisterVisitsScreen({
  user,
  visitMode,
  setVisitMode,
  visitRegistrationForm,
  setVisitRegistrationForm,
  visitFiles,
  setVisitFiles,
  visitPasses,
  setVisitPasses,
  selectedVisitPassId,
  setSelectedVisitPassId,
  historialVisitasData,
  setHistorialVisitasData,
  myProperties = [],
}) {
  const [qrScanMsg, setQrScanMsg] = useState('');
  const [securityActionLoading, setSecurityActionLoading] = useState(false);
  const [visitSuggestions, setVisitSuggestions] = useState([]);
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false);

  const isSecurity = user.role === "Seguridad";

  const selectedVisitPass = visitPasses.find((item) => item.id === selectedVisitPassId) || visitPasses[0];

  // Verifica si hay un ingreso abierto (sin salida registrada) para el visitante seleccionado
  const openHistorialEntry = selectedVisitPass
    ? historialVisitasData.find(h =>
        (h.visitante === selectedVisitPass.fullName || h.cedula === selectedVisitPass.idNumber) &&
        (!h.salida || h.salida === '-')
      )
    : null;

  const isQrExpired = selectedVisitPass?.expiresAt
    ? new Date(selectedVisitPass.expiresAt + 'T23:59:59') < new Date()
    : false;

  const handleGenerateVisitPass = async () => {
    if (!visitRegistrationForm.fullName.trim() || !visitRegistrationForm.idNumber.trim() || !visitRegistrationForm.property.trim() || !visitRegistrationForm.motive.trim()) {
      return;
    }
    if (!visitFiles.idDocument) return;
    if (visitMode === "vehicular" && !visitFiles.platePhoto) return;

    try {
      const newPass = await api.createVisita({
        mode: visitMode,
        fullName: visitRegistrationForm.fullName.trim(),
        idNumber: visitRegistrationForm.idNumber.trim(),
        property: visitRegistrationForm.property.trim(),
        motive: visitRegistrationForm.motive.trim(),
        plate: visitMode === "vehicular" ? visitRegistrationForm.plate.trim() || "-" : "-",
        idDocumentName: visitFiles.idDocument?.name || "sin-archivo",
        platePhotoName: visitMode === "vehicular" ? visitFiles.platePhoto?.name || "sin-archivo" : "-",
        createdBy: user.name,
        status: "Activo",
        expiresAt: visitRegistrationForm.expiresAt || null
      });
      setVisitPasses([newPass, ...visitPasses]);
      setSelectedVisitPassId(newPass.id);
      setVisitRegistrationForm({ fullName: "", idNumber: "", property: user.role === "Propietario" ? "Calle Principal - A-101" : "", motive: "", plate: "", expiresAt: "" });
      setVisitFiles({ idDocument: null, idDocumentBack: null, platePhoto: null });
    } catch (err) {
      console.error("Error generando pase:", err.message);
    }
  };

  const handleSecurityScan = (passId) => {
    setSelectedVisitPassId(passId);
    const pass = visitPasses.find(p => p.id === passId);
    if (pass) {
      setQrScanMsg(`✓ QR leído: ${pass.fullName}`);
      setTimeout(() => setQrScanMsg(''), 4000);
    }
  };

  const handleRegistrarIngreso = async () => {
    if (!selectedVisitPass) return;
    setSecurityActionLoading(true);
    try {
      const now = new Date();
      const horaActual = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const fechaActual = now.toLocaleDateString('es-ES');
      const entry = await api.createHistorialVisita({
        visitante: selectedVisitPass.fullName,
        cedula:    selectedVisitPass.idNumber,
        propiedad: selectedVisitPass.property,
        tipo:      'peatonal',
        placa:     selectedVisitPass.plate || '-',
        fecha:     fechaActual,
        entrada:   horaActual,
        salida:    '-',
        motivo:    selectedVisitPass.motive || '-',
        guard:     user.name,
      });
      setHistorialVisitasData(prev => [entry, ...prev]);
      setQrScanMsg(`✓ Ingreso registrado: ${selectedVisitPass.fullName} — ${horaActual}`);
      setTimeout(() => setQrScanMsg(''), 5000);
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSecurityActionLoading(false); }
  };

  const handleRegistrarSalida = async () => {
    if (!selectedVisitPass || !openHistorialEntry) return;
    setSecurityActionLoading(true);
    try {
      const now = new Date();
      const horaActual = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      // Actualizar la salida sobre el mismo registro de historial (sin duplicar)
      await api.updateHistorialSalida(openHistorialEntry.id, horaActual);
      // Marcar la visita como Inactivo
      await api.updateVisitaStatus(String(selectedVisitPass.id), 'Inactivo');
      setVisitPasses(prev => prev.map(p => p.id === selectedVisitPass.id ? { ...p, status: 'Inactivo' } : p));
      setHistorialVisitasData(prev => prev.map(h =>
        h.id === openHistorialEntry.id ? { ...h, salida: horaActual } : h
      ));
      setQrScanMsg(`✓ Salida registrada: ${selectedVisitPass.fullName} — ${horaActual}. QR desactivado.`);
      setTimeout(() => setQrScanMsg(''), 5000);
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSecurityActionLoading(false); }
  };

  return (
    <>
      <header className="dashboard-header visit-header">
        <div>
          <h1>Pre-registro de Visitas</h1>
          <p>{isSecurity ? "Escanea un QR para ver los datos completos del visitante" : "Genera un código QR para tus visitantes"}</p>
        </div>
      </header>

      {isSecurity ? (
        <section className="visit-security-layout">
          <article className="visit-security-card visit-qr-card">
            <h2>Lector QR</h2>
            {selectedVisitPass ? (
              <>
                <div className="visit-qr-preview">
                  <QRCodeSVG
                    value={api.getVisitaVerifyUrl(selectedVisitPass.code)}
                    size={160}
                    level="M"
                    style={{ display: "block", margin: "0 auto" }}
                  />
                  <div className="visit-qr-meta">
                    <strong>{selectedVisitPass.code}</strong>
                    <p>Escanea el código para cargar el acceso</p>
                  </div>
                </div>
                <div className="visit-pass-list">
                  {visitPasses.map((pass) => (
                    <button key={pass.id} type="button" className={`visit-pass-item${pass.id === selectedVisitPassId ? " visit-pass-item-active" : ""}`} onClick={() => handleSecurityScan(pass.id)}>
                      <strong>{pass.fullName}</strong>
                      <span>{pass.property}</span>
                      <small>{pass.code}</small>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{textAlign:'center',padding:'2rem 1rem',color:'#9ca3af'}}>
                <p style={{margin:0,fontSize:'0.88rem'}}>No hay pases QR registrados aún.</p>
                <div className="visit-pass-list" style={{marginTop:'1rem'}}>
                  {visitPasses.map((pass) => (
                    <button key={pass.id} type="button" className={`visit-pass-item${pass.id === selectedVisitPassId ? " visit-pass-item-active" : ""}`} onClick={() => handleSecurityScan(pass.id)}>
                      <strong>{pass.fullName}</strong>
                      <span>{pass.property}</span>
                      <small>{pass.code}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </article>

          <article className="visit-security-card visit-data-card">
            <h2>Datos del Visitante</h2>

            {/* Mensaje de confirmación QR */}
            {qrScanMsg && (
              <div style={{background: qrScanMsg.includes('Salida') ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', border: `1px solid ${qrScanMsg.includes('Salida') ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, borderRadius:10, padding:'0.65rem 0.85rem', marginBottom:'0.75rem', fontWeight:600, fontSize:'0.85rem', color: qrScanMsg.includes('Salida') ? '#ef4444' : '#16a34a'}}>
                {qrScanMsg}
              </div>
            )}

            {selectedVisitPass ? (
              <>
                <div className="visit-data-grid">
                  <div><span>Visitante</span><strong>{selectedVisitPass.fullName}</strong></div>
                  <div><span>Cédula</span><strong>{selectedVisitPass.idNumber}</strong></div>
                  <div><span>Propiedad</span><strong>{selectedVisitPass.property}</strong></div>
                  <div><span>Tipo</span><strong>{selectedVisitPass.mode === "vehicular" ? "Vehicular" : "Peatonal"}</strong></div>
                  <div><span>Placa</span><strong>{selectedVisitPass.plate || '-'}</strong></div>
                  <div><span>Motivo</span><strong>{selectedVisitPass.motive}</strong></div>
                  <div><span>Creado por</span><strong>{selectedVisitPass.createdBy}</strong></div>
                  <div><span>Estado QR</span><strong className="visit-status-pill" style={{color: selectedVisitPass.status === 'Inactivo' ? '#ef4444' : '#16a34a'}}>{selectedVisitPass.status}</strong></div>
                  {selectedVisitPass.expiresAt && (
                    <div><span>Vence</span><strong style={{color: isQrExpired ? '#ef4444' : '#16a34a'}}>
                      {new Date(selectedVisitPass.expiresAt + 'T00:00:00').toLocaleDateString('es-BO')}
                      {isQrExpired && <span className="badge-vencido"> Vencido</span>}
                    </strong></div>
                  )}
                  {openHistorialEntry && (
                    <div><span>Ingresó</span><strong style={{color:'#16a34a'}}>{openHistorialEntry.entrada}</strong></div>
                  )}
                </div>

                {isQrExpired && (
                  <p style={{marginTop:'0.75rem',padding:'0.6rem 1rem',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:10,fontSize:'0.82rem',color:'#ef4444',fontWeight:600,textAlign:'center'}}>
                    Pase vencido — el propietario debe generar uno nuevo
                  </p>
                )}

                {selectedVisitPass.status !== 'Inactivo' && !isQrExpired && (
                  <div style={{marginTop:'1rem',display:'flex',gap:'0.65rem',flexWrap:'wrap'}}>
                    {!openHistorialEntry ? (
                      <button className="btn btn-primary" style={{flex:1,fontSize:'0.88rem'}} disabled={securityActionLoading} onClick={handleRegistrarIngreso}>
                        {securityActionLoading ? 'Registrando…' : '→ Registrar Ingreso'}
                      </button>
                    ) : (
                      <button className="btn" style={{flex:1,fontSize:'0.88rem',background:'#ef4444',color:'#fff',border:'none',borderRadius:8,padding:'0.5rem',fontWeight:700,cursor:'pointer'}} disabled={securityActionLoading} onClick={handleRegistrarSalida}>
                        {securityActionLoading ? 'Registrando…' : '← Registrar Salida'}
                      </button>
                    )}
                  </div>
                )}

                {selectedVisitPass.status === 'Inactivo' && (
                  <p style={{marginTop:'0.75rem',fontSize:'0.82rem',color:'#ef4444',fontWeight:600,textAlign:'center'}}>QR desactivado — visita finalizada</p>
                )}
              </>
            ) : (
              <p style={{color:'#9ca3af',fontSize:'0.88rem',textAlign:'center',padding:'1rem'}}>Seleccioná un pase de la lista para ver los datos.</p>
            )}
          </article>
        </section>
      ) : (
        <section className="visit-owner-layout">
          <article className="visit-owner-card visit-owner-form-card">
            <div className="visit-mode-toggle">
              <button type="button" className={`visit-mode-btn${visitMode === "peatonal" ? " visit-mode-btn-active" : ""}`} onClick={() => setVisitMode("peatonal")}>Ingreso Peatonal</button>
              <button type="button" className={`visit-mode-btn${visitMode === "vehicular" ? " visit-mode-btn-active" : ""}`} onClick={() => setVisitMode("vehicular")}>Ingreso Vehicular</button>
            </div>

            <h2>Datos del Visitante</h2>

            <div className="visit-form-grid">
              <div className="visit-form-field" style={{position:'relative'}}>
                <span>Nombre Completo *</span>
                <input
                  type="text"
                  placeholder="Nombre del visitante"
                  value={visitRegistrationForm.fullName}
                  autoComplete="off"
                  onChange={e => {
                    const val = e.target.value;
                    setVisitRegistrationForm({ ...visitRegistrationForm, fullName: val });
                    if (val.length >= 1) {
                      const matches = visitPasses.filter(p => p.fullName.toLowerCase().startsWith(val.toLowerCase())).slice(0, 5);
                      setVisitSuggestions(matches);
                    } else {
                      setVisitSuggestions([]);
                    }
                  }}
                  onBlur={() => setTimeout(() => setVisitSuggestions([]), 200)}
                />
                {visitSuggestions.length > 0 && (
                  <ul style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,zIndex:50,margin:0,padding:'0.3rem',listStyle:'none',boxShadow:'0 4px 16px rgba(0,0,0,0.1)'}}>
                    {visitSuggestions.map(p => (
                      <li key={p.id}
                        onMouseDown={() => {
                          setVisitRegistrationForm({
                            fullName: p.fullName,
                            idNumber: p.idNumber,
                            property: p.property,
                            motive:   p.motive,
                            plate:    p.plate || '',
                          });
                          setVisitSuggestions([]);
                        }}
                        style={{padding:'0.5rem 0.75rem',cursor:'pointer',borderRadius:6,fontSize:'0.85rem'}}
                        onMouseEnter={e => e.target.style.background='#f5f3ff'}
                        onMouseLeave={e => e.target.style.background=''}
                      >
                        <strong>{p.fullName}</strong>
                        <span style={{color:'#9ca3af',marginLeft:'0.5rem',fontSize:'0.78rem'}}>{p.property} · {p.code}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <label className="visit-form-field">
                <span>Número de Carnet *</span>
                <input type="text" placeholder="12345678" value={visitRegistrationForm.idNumber} onChange={(e) => setVisitRegistrationForm({ ...visitRegistrationForm, idNumber: e.target.value })} />
              </label>
              {visitMode === "vehicular" && (
                <label className="visit-form-field visit-form-full">
                  <span>Placa del Vehículo *</span>
                  <input type="text" placeholder="ABC-123" value={visitRegistrationForm.plate} onChange={(e) => setVisitRegistrationForm({ ...visitRegistrationForm, plate: e.target.value })} />
                </label>
              )}
              <label className="visit-form-field visit-form-full">
                <span>Propiedad</span>
                {myProperties.length > 1 ? (
                  <div className="condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPropertyDropdownOpen(false); }} tabIndex={-1}>
                    <button
                      type="button"
                      className="condo-dropdown-trigger"
                      onClick={() => setPropertyDropdownOpen((o) => !o)}
                      aria-expanded={propertyDropdownOpen}
                    >
                      <span className="condo-dropdown-value">
                        {visitRegistrationForm.property || "Seleccioná una propiedad"}
                      </span>
                      <svg className={`condo-dropdown-chevron${propertyDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {propertyDropdownOpen && (
                      <ul className="condo-dropdown-list" role="listbox">
                        {myProperties.map((p) => (
                          <li
                            key={p.id}
                            role="option"
                            aria-selected={visitRegistrationForm.property === p.label}
                            className={`condo-dropdown-item${visitRegistrationForm.property === p.label ? " selected" : ""}`}
                            onMouseDown={() => { setVisitRegistrationForm({ ...visitRegistrationForm, property: p.label }); setPropertyDropdownOpen(false); }}
                          >
                            {p.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <input type="text" value={visitRegistrationForm.property} readOnly disabled placeholder="Sin propiedad asignada" />
                )}
                <small>
                  {myProperties.length > 1
                    ? "Solo podés registrar visitas para las propiedades asignadas a tu perfil"
                    : "Esta información se toma automáticamente de tu perfil"}
                </small>
              </label>
              <label className="visit-form-field visit-form-full">
                <span>Motivo de Visita *</span>
                <textarea placeholder="Describe el motivo de la visita" value={visitRegistrationForm.motive} onChange={(e) => setVisitRegistrationForm({ ...visitRegistrationForm, motive: e.target.value })} />
              </label>

              <label className="visit-form-field">
                <span>Vencimiento del pase <small style={{fontWeight:400,opacity:0.6}}>(opcional)</small></span>
                <input
                  type="date"
                  value={visitRegistrationForm.expiresAt}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setVisitRegistrationForm({ ...visitRegistrationForm, expiresAt: e.target.value })}
                />
              </label>

              <div className="visit-form-field visit-form-full" style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                <span style={{fontWeight:600,fontSize:'0.85rem',color:'inherit'}}>Foto de Identificación *</span>
                <label className="visit-upload-box">
                  <input type="file" accept="image/*,.pdf" className="visit-upload-input"
                    onChange={(e) => setVisitFiles({ ...visitFiles, idDocument: e.target.files?.[0] || null })} />
                  <span className="visit-upload-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M12 16V6M8 10L12 6L16 10M5 14V17C5 18.1 5.9 19 7 19H17C18.1 19 19 18.1 19 17V14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <span className="visit-upload-text">
                    <strong style={{display:'block',fontSize:'0.78rem',marginBottom:'0.1rem'}}>Anverso (frente)</strong>
                    {visitFiles.idDocument ? visitFiles.idDocument.name : "Click para subir"}
                  </span>
                </label>
                <label className="visit-upload-box">
                  <input type="file" accept="image/*,.pdf" className="visit-upload-input"
                    onChange={(e) => setVisitFiles({ ...visitFiles, idDocumentBack: e.target.files?.[0] || null })} />
                  <span className="visit-upload-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M12 16V6M8 10L12 6L16 10M5 14V17C5 18.1 5.9 19 7 19H17C18.1 19 19 18.1 19 17V14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <span className="visit-upload-text">
                    <strong style={{display:'block',fontSize:'0.78rem',marginBottom:'0.1rem'}}>Reverso (dorso)</strong>
                    {visitFiles.idDocumentBack ? visitFiles.idDocumentBack.name : "Click para subir"}
                  </span>
                </label>
              </div>

              {visitMode === "vehicular" && (
                <label className="visit-form-field visit-form-full">
                  <span>Foto de la Placa *</span>
                  <label className="visit-upload-box">
                    <input
                      type="file"
                      accept="image/*"
                      className="visit-upload-input"
                      onChange={(e) => setVisitFiles({ ...visitFiles, platePhoto: e.target.files?.[0] || null })}
                    />
                    <span className="visit-upload-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 16V6M8 10L12 6L16 10M5 14V17C5 18.1 5.9 19 7 19H17C18.1 19 19 18.1 19 17V14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="visit-upload-text">{visitFiles.platePhoto ? visitFiles.platePhoto.name : "Click para subir foto de placa"}</span>
                  </label>
                </label>
              )}
            </div>

            <button type="button" className="visit-owner-submit-btn" onClick={handleGenerateVisitPass}>
              Generar Código QR
            </button>
          </article>

          <article className="visit-owner-card visit-owner-qr-card">
            <h2>QR de Acceso</h2>
            {selectedVisitPass ? (
              <div className="visit-owner-qr-box">
                <QRCodeSVG
                  id="visit-qr-svg"
                  value={api.getVisitaVerifyUrl(selectedVisitPass.code)}
                  size={180}
                  level="M"
                  style={{ display: "block", margin: "0 auto 12px" }}
                />
                <div className="visit-owner-qr-info">
                  <strong>{selectedVisitPass.code}</strong>
                  <p>{selectedVisitPass.fullName}</p>
                  <small>{selectedVisitPass.property} · {selectedVisitPass.mode === "vehicular" ? "Vehicular" : "Peatonal"}</small>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{marginTop:'0.85rem',width:'100%',fontSize:'0.85rem',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.4rem'}}
                  onClick={() => {
                    const svg = document.getElementById('visit-qr-svg');
                    if (!svg) return;
                    const canvas = document.createElement('canvas');
                    canvas.width = 220; canvas.height = 260;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, 220, 260);
                    const data = new XMLSerializer().serializeToString(svg);
                    const img = new Image();
                    img.onload = () => {
                      ctx.drawImage(img, 20, 10, 180, 180);
                      ctx.fillStyle = '#111111';
                      ctx.font = 'bold 15px monospace';
                      ctx.textAlign = 'center';
                      ctx.fillText(selectedVisitPass.code, 110, 212);
                      ctx.font = '12px sans-serif';
                      ctx.fillStyle = '#444444';
                      ctx.fillText(selectedVisitPass.fullName, 110, 232);
                      ctx.fillText('Ingreso manual si falla la cámara', 110, 250);
                      const a = document.createElement('a');
                      a.download = `QR-${selectedVisitPass.code}.png`;
                      a.href = canvas.toDataURL('image/png');
                      a.click();
                    };
                    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)));
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}>
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Descargar QR
                </button>
              </div>
            ) : (
              <div style={{textAlign:'center', padding:'2rem 1rem', color:'#9ca3af'}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width:48,height:48,margin:'0 auto 0.75rem',display:'block',opacity:0.4}}>
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                  <path d="M14 14h1v1h-1zM17 14h1v1h-1zM14 17h1v1h-1zM17 17h3v3h-3z"/>
                </svg>
                <p style={{margin:0,fontSize:'0.88rem'}}>Completá el formulario y generá el código QR para tu visitante.</p>
              </div>
            )}
          </article>
        </section>
      )}
    </>
  );
}
