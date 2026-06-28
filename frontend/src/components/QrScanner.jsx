import { useState, useEffect, useRef } from "react";
import * as api from "../api.js";

const LONG_STAY_MS = 2 * 60 * 60 * 1000; // 2 horas

// Combina fecha (DD/MM/YYYY) + hora (HH:MM) de un registro de historial en un Date
const parseEntryDateTime = (h) => {
  const dateParts = (h.fecha || '').split('/');
  const timeParts = (h.entrada || '').split(':');
  if (dateParts.length !== 3 || timeParts.length !== 2) return null;
  const [d, m, y] = dateParts.map(Number);
  const [hh, mm] = timeParts.map(Number);
  if ([d, m, y, hh, mm].some(Number.isNaN)) return null;
  return new Date(y, m - 1, d, hh, mm);
};

export default function QrScanner({ visitPasses, setVisitPasses, selectedVisitPassId, setSelectedVisitPassId, historialVisitas = [], setHistorialVisitas, guardName = "" }) {
  const [scannerActive, setScannerActive]   = useState(false);
  const [manualCode, setManualCode]         = useState("");
  const [scannedPass, setScannedPass]       = useState(null);
  const [scanError, setScanError]           = useState("");
  const [actionMsg, setActionMsg]           = useState("");
  const [actionLoading, setActionLoading]   = useState(false);
  const [busyEntryId, setBusyEntryId]       = useState(null);
  const [qrValidationError, setQrValidationError] = useState(null); // { title, message }
  const [scanConfirm, setScanConfirm] = useState(null); // { pass, type: 'ingreso'|'salida', openEntry }
  const [vehicularSearch, setVehicularSearch] = useState(""); // busca por placa
  const [peatonalSearch, setPeatonalSearch]   = useState(""); // busca por cédula
  const html5QrRef        = useRef(null);
  const scannerRunningRef = useRef(false);

  // Respaldo a prueba de fallos: apaga directamente los tracks de la cámara
  // del <video> que dejó la librería, sin depender de su estado interno.
  // html5-qrcode a veces lanza una excepción síncrona en stop() si todavía no
  // terminó de marcar el escaneo como "iniciado" — sin esto, en ese caso la
  // cámara queda prendida sin que nadie la libere.
  const releaseCameraTracks = () => {
    document.querySelectorAll('#qr-camera-reader video').forEach((videoEl) => {
      const stream = videoEl.srcObject;
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach((track) => track.stop());
      }
      videoEl.srcObject = null;
    });
  };

  const stopScanner = () => {
    scannerRunningRef.current = false;
    const scanner = html5QrRef.current;
    if (scanner) {
      try {
        scanner.stop().then(() => scanner.clear()).catch(() => {}).finally(releaseCameraTracks);
      } catch {
        releaseCameraTracks();
      }
    } else {
      releaseCameraTracks();
    }
  };

  const showMsg = (msg) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 5000);
  };

  const lookupCode = async (code) => {
    const clean = code.replace(/.*\/verify\//, "").trim();
    setScanError("");
    setScannedPass(null);
    setManualCode("");
    try {
      const pass = await api.verifyVisita(clean);
      setScannedPass(pass);
      setSelectedVisitPassId(pass.id);
      await autoRegister(pass);
    } catch (err) {
      setScanError(err.message || `Pase no encontrado: ${clean}`);
    }
  };

  useEffect(() => {
    if (!scannerActive) return;
    let cancelled = false;
    import("html5-qrcode").then(({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode("qr-camera-reader", {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      html5QrRef.current = scanner;
      const containerWidth = document.getElementById("qr-camera-reader")?.offsetWidth || 300;
      const qrboxSize = Math.floor(Math.min(containerWidth * 0.8, 280));
      scanner.start(
        { facingMode: "environment" },
        { fps: 30, qrbox: { width: qrboxSize, height: qrboxSize }, aspectRatio: 1.0, disableFlip: false },
        (decodedText) => { stopScanner(); setScannerActive(false); lookupCode(decodedText); },
        () => {}
      ).then(() => {
        if (cancelled) {
          // El componente ya pidió detener la cámara mientras todavía estaba
          // iniciando (start() es async) — liberarla recién ahora que terminó,
          // si no, el navegador la deja prendida sin que la app se entere.
          try {
            scanner.stop().then(() => scanner.clear()).catch(() => {}).finally(releaseCameraTracks);
          } catch {
            releaseCameraTracks();
          }
        } else {
          scannerRunningRef.current = true;
        }
      }).catch(() => { setScanError("No se pudo acceder a la cámara. Usá el ingreso manual."); setScannerActive(false); });
    });
    return () => { cancelled = true; stopScanner(); };
  }, [scannerActive]);

  const selected = scannedPass || visitPasses.find(v => v.id === selectedVisitPassId) || null;

  // Busca si hay un ingreso abierto para el visitante
  const openEntry = selected
    ? historialVisitas.find(h =>
        (h.visitante === selected.fullName || h.cedula === selected.idNumber) &&
        (!h.salida || h.salida === '-')
      )
    : null;

  // Visitantes actualmente dentro (sin salida registrada), del más antiguo al más reciente
  const insideVisitors = historialVisitas
    .filter(h => !h.salida || h.salida === '-')
    .map(h => ({ ...h, _entered: parseEntryDateTime(h) }))
    .sort((a, b) => (a._entered?.getTime() ?? 0) - (b._entered?.getTime() ?? 0));

  // Separados por portería — vehicular y peatonal son flujos físicamente
  // distintos, no tiene sentido mezclarlos en una sola lista.
  const insideVehicularAll = insideVisitors.filter(e => e.tipo === 'vehicular');
  const insidePeatonalAll  = insideVisitors.filter(e => e.tipo !== 'vehicular');

  // Búsqueda rápida: por placa en vehicular, por cédula en peatonal — para no
  // tener que desplazarse por toda la lista buscando a alguien puntual.
  const insideVehicular = vehicularSearch.trim()
    ? insideVehicularAll.filter(e => (e.placa || '').toLowerCase().includes(vehicularSearch.trim().toLowerCase()))
    : insideVehicularAll;
  const insidePeatonal = peatonalSearch.trim()
    ? insidePeatonalAll.filter(e => (e.cedula || '').toLowerCase().includes(peatonalSearch.trim().toLowerCase()))
    : insidePeatonalAll;

  // Marca la salida de un registro de historial y, si corresponde, desactiva su pase QR.
  // `passIdOverride` permite indicar directamente el pase a desactivar (p.ej. el pase
  // recién escaneado), sin depender de que esté presente en `visitPasses`.
  const performSalida = async (entry, passIdOverride) => {
    const now  = new Date();
    const hora = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    await api.updateHistorialSalida(entry.id, hora);
    setHistorialVisitas?.(prev => prev.map(h => h.id === entry.id ? { ...h, salida: hora } : h));

    const matchingPassId = passIdOverride ?? visitPasses.find(p =>
      (p.fullName === entry.visitante || p.idNumber === entry.cedula) && p.status !== 'Inactivo'
    )?.id;

    if (matchingPassId) {
      await api.updateVisitaStatus(String(matchingPassId), 'Inactivo');
      setVisitPasses(prev => prev.map(v => String(v.id) === String(matchingPassId) ? { ...v, status: 'Inactivo' } : v));
      setScannedPass(prev => prev && String(prev.id) === String(matchingPassId) ? { ...prev, status: 'Inactivo' } : prev);
    }
    return hora;
  };

  // Registra el ingreso de un pase en el historial (entrada = ahora)
  const registerIngreso = async (pass) => {
    const now = new Date();
    const hora  = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const fecha = now.toLocaleDateString('es-ES');
    const entry = await api.createHistorialVisita({
      visitante: pass.fullName,
      cedula:    pass.idNumber,
      propiedad: pass.property,
      tipo:      pass.mode === 'vehicular' ? 'vehicular' : 'peatonal',
      placa:     pass.plate || '-',
      fecha,
      entrada:   hora,
      salida:    '-',
      motivo:    pass.motive || '-',
      guard:     guardName,
      visitaId:  pass.id,
    });
    setHistorialVisitas?.(prev => [entry, ...prev]);
    showMsg(`✓ Ingreso registrado: ${pass.fullName} — ${hora}`);
  };

  // Al escanear (o ingresar manualmente) un código válido, el primer escaneo
  // de un QR es para ingreso y el segundo para salida — pero ninguno de los
  // dos se registra solo: se le pide confirmación al guardia antes.
  const autoRegister = async (pass) => {
    if (pass.status === 'Inactivo') {
      setQrValidationError({
        title: 'QR desactivado',
        message: `Este código ya fue usado — la visita de ${pass.fullName} ya finalizó.`,
      });
      return;
    }
    if (pass.expiresAt && new Date(pass.expiresAt + 'T23:59:59') < new Date()) {
      const vencio = new Date(pass.expiresAt + 'T00:00:00').toLocaleDateString('es-BO');
      setQrValidationError({
        title: 'QR vencido',
        message: `El pase de ${pass.fullName} venció el ${vencio} y ya no es válido. No se registró el ingreso.`,
      });
      return;
    }
    // Tope absoluto: ningún QR es válido más de 24hs después de creado,
    // sin importar el vencimiento que se le haya puesto (o si no tiene).
    if (pass.insertedAt && Date.now() - new Date(pass.insertedAt).getTime() > 24 * 60 * 60 * 1000) {
      setQrValidationError({
        title: 'QR vencido',
        message: `El pase de ${pass.fullName} fue generado hace más de 24 horas — el máximo permitido — y ya no es válido. No se registró el ingreso.`,
      });
      return;
    }

    const open = historialVisitas.find(h =>
      (h.visitante === pass.fullName || h.cedula === pass.idNumber) &&
      (!h.salida || h.salida === '-')
    );

    setScanConfirm({ pass, type: open ? 'salida' : 'ingreso', openEntry: open || null });
  };

  const confirmScanAction = async () => {
    if (!scanConfirm) return;
    const { pass, type, openEntry } = scanConfirm;
    setActionLoading(true);
    try {
      if (type === 'ingreso') {
        await registerIngreso(pass);
      } else {
        const hora = await performSalida(openEntry, pass.id);
        showMsg(`✓ Salida registrada: ${pass.fullName} — ${hora}. QR desactivado.`);
      }
    } catch (e) {
      showMsg('Error: ' + e.message);
    } finally {
      setActionLoading(false);
      setScanConfirm(null);
    }
  };

  const handleMarkSalida = async (entry) => {
    setBusyEntryId(entry.id);
    try {
      const hora = await performSalida(entry);
      showMsg(`✓ Salida registrada: ${entry.visitante} — ${hora}`);
    } catch (e) {
      showMsg('Error: ' + e.message);
    } finally {
      setBusyEntryId(null);
    }
  };

  const handleIngreso = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await registerIngreso(selected);
    } catch (e) { showMsg('Error: ' + e.message); }
    finally { setActionLoading(false); }
  };

  const handleSalida = async () => {
    if (!selected || !openEntry) return;
    setActionLoading(true);
    try {
      const hora = await performSalida(openEntry);
      showMsg(`✓ Salida registrada: ${selected.fullName} — ${hora}. QR desactivado.`);
    } catch (e) { showMsg('Error: ' + e.message); }
    finally { setActionLoading(false); }
  };

  const renderInsideList = (list, emptyMessage = "No hay visitantes dentro por esta portería.") => (
    list.length === 0 ? (
      <p className="visit-inside-empty">{emptyMessage}</p>
    ) : (
      <div className="visit-inside-list">
        {list.map((entry) => {
          const longStay = entry._entered && (Date.now() - entry._entered.getTime()) > LONG_STAY_MS;
          return (
            <div key={entry.id} className={`visit-inside-item${longStay ? " visit-inside-item-warn" : ""}`}>
              <div className="visit-inside-info">
                <strong>{entry.visitante}</strong>
                <span>{entry.propiedad} · {entry.tipo === 'vehicular' ? `Vehicular (${entry.placa})` : 'Peatonal'}</span>
                <small>Ingresó a las {entry.entrada}{longStay ? " · hace más de 2 hs" : ""}</small>
              </div>
              <button
                type="button"
                className="visit-inside-salida-btn"
                disabled={busyEntryId === entry.id}
                onClick={() => handleMarkSalida(entry)}
              >
                {busyEntryId === entry.id ? "..." : "Marcar Salida"}
              </button>
            </div>
          );
        })}
      </div>
    )
  );

  return (
    <>
      <header className="dashboard-header visit-header">
        <div>
          <h1>Escanear QR</h1>
          <p>Escaneá el QR del visitante con la cámara o ingresá el código manualmente</p>
        </div>
      </header>

      <div className="visit-inside-grid">
        <article className="visit-security-card visit-inside-card">
          <h2>
            <svg className="visit-inside-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 16V12.5C4 11.7 4.4 11 5.1 10.6L6.4 9.8C6.7 9.6 7 9.3 7.1 9L7.8 7.2C8.1 6.5 8.7 6 9.5 6H14.5C15.3 6 15.9 6.5 16.2 7.2L16.9 9C17 9.3 17.3 9.6 17.6 9.8L18.9 10.6C19.6 11 20 11.7 20 12.5V16" />
              <path d="M3 16H21" />
              <circle cx="7.5" cy="16" r="1.6" />
              <circle cx="16.5" cy="16" r="1.6" />
            </svg>
            Portería Vehicular
            {insideVehicularAll.length > 0 && <span className="visit-inside-count">{insideVehicularAll.length}</span>}
          </h2>
          {insideVehicularAll.length > 0 && (
            <input
              type="text"
              className="visit-inside-search"
              placeholder="Buscar por placa..."
              value={vehicularSearch}
              onChange={e => setVehicularSearch(e.target.value)}
            />
          )}
          {renderInsideList(insideVehicular, vehicularSearch.trim() ? "Ningún vehículo dentro coincide con esa placa." : "No hay visitantes dentro por esta portería.")}
        </article>

        <article className="visit-security-card visit-inside-card">
          <h2>
            <svg className="visit-inside-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="2" />
              <path d="M12 7.5V13L9 16.5M12 13L15 16.5M12 10.5L8.5 12M12 10.5L15.5 12" />
            </svg>
            Portería Peatonal
            {insidePeatonalAll.length > 0 && <span className="visit-inside-count">{insidePeatonalAll.length}</span>}
          </h2>
          {insidePeatonalAll.length > 0 && (
            <input
              type="text"
              className="visit-inside-search"
              placeholder="Buscar por cédula..."
              value={peatonalSearch}
              onChange={e => setPeatonalSearch(e.target.value)}
            />
          )}
          {renderInsideList(insidePeatonal, peatonalSearch.trim() ? "Ningún visitante dentro coincide con esa cédula." : "No hay visitantes dentro por esta portería.")}
        </article>
      </div>

      <section className="visit-security-layout">
        <article className="visit-security-card visit-qr-card">
          <h2>Lector QR</h2>

          <div style={{ display:"flex", flexDirection:"column", gap:"10px", marginBottom:"14px" }}>
            {!scannerActive ? (
              <button type="button" className="btn btn-primary" style={{width:"100%"}}
                onClick={() => { setScannerActive(true); setScanError(""); setScannedPass(null); }}>
                📷 Activar Cámara
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" style={{width:"100%"}}
                onClick={() => setScannerActive(false)}>
                ✕ Detener Cámara
              </button>
            )}

            <div id="qr-camera-reader" style={{ width:"100%", borderRadius:"10px", overflow:"hidden", minHeight: scannerActive ? "260px" : "0", background:"#000" }} />

            <small style={{ color:"#9ca3af", fontSize:"12px" }}>O ingresá el código del pase manualmente:</small>
            <div style={{ display:"flex", gap:"8px" }}>
              <input
                type="text"
                placeholder="Código QR manual (ej: QR-482917)"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && manualCode.trim() && lookupCode(manualCode.trim())}
                style={{ flex:1, padding:"8px 12px", borderRadius:"6px", border:"1px solid #d1d5db", fontSize:"13px", background:"transparent", color:"inherit" }}
              />
              <button type="button" className="btn btn-primary" onClick={() => manualCode.trim() && lookupCode(manualCode.trim())}>
                Buscar
              </button>
            </div>

            {scanError && <p style={{ color:"#ef4444", fontSize:"13px", margin:0 }}>{scanError}</p>}
          </div>

          <div className="visit-pass-list">
            {visitPasses.map(pass => (
              <button key={pass.id} type="button"
                className={`visit-pass-item${pass.id === (scannedPass?.id ?? selectedVisitPassId) ? " visit-pass-item-active" : ""}`}
                onClick={() => { setScannedPass(null); setSelectedVisitPassId(pass.id); setScanError(""); showMsg(`✓ QR seleccionado: ${pass.fullName}`); }}>
                <span className={`visit-pass-status visit-pass-status-${pass.status?.toLowerCase()}`}>{pass.status}</span>
                <span className="visit-pass-name">{pass.fullName}</span>
                <span className="visit-pass-code">{pass.code}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="visit-security-card visit-data-card">
          <h2>Datos del Visitante</h2>

          {actionMsg && (() => {
            const isWarn = /Salida|Error|desactivado|vencido|no encontrado/i.test(actionMsg);
            return (
              <div style={{
                background: isWarn ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                border: `1px solid ${isWarn ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                borderRadius:10, padding:'0.6rem 0.85rem', marginBottom:'0.75rem',
                fontWeight:600, fontSize:'0.84rem',
                color: isWarn ? '#ef4444' : '#16a34a'
              }}>
                {actionMsg}
              </div>
            );
          })()}

          {selected ? (
            <>
              <div className="visit-data-grid">
                <div><span>Visitante</span><strong>{selected.fullName}</strong></div>
                <div><span>Cédula</span><strong>{selected.idNumber}</strong></div>
                <div><span>Propiedad</span><strong>{selected.property}</strong></div>
                <div><span>Motivo</span><strong>{selected.motive}</strong></div>
                <div><span>Modalidad</span><strong>{selected.mode === "vehicular" ? "Vehicular" : "Peatonal"}</strong></div>
                {selected.plate && selected.plate !== "-" && <div><span>Placa</span><strong>{selected.plate}</strong></div>}
                <div><span>Estado QR</span>
                  <strong style={{color: selected.status === 'Inactivo' ? '#ef4444' : '#16a34a'}}>{selected.status}</strong>
                </div>
                {openEntry && <div><span>Ingresó a las</span><strong style={{color:'#16a34a'}}>{openEntry.entrada}</strong></div>}
              </div>

              {selected.status !== 'Inactivo' && (
                <div style={{marginTop:'1rem', display:'flex', gap:'0.65rem'}}>
                  {!openEntry ? (
                    <button className="btn btn-primary" style={{flex:1, fontSize:'0.88rem'}} disabled={actionLoading} onClick={handleIngreso}>
                      {actionLoading ? 'Registrando…' : '→ Registrar Ingreso'}
                    </button>
                  ) : (
                    <button style={{flex:1, fontSize:'0.88rem', background:'#ef4444', color:'#fff', border:'none', borderRadius:8, padding:'0.5rem', fontWeight:700, cursor:'pointer'}} disabled={actionLoading} onClick={handleSalida}>
                      {actionLoading ? 'Registrando…' : '← Registrar Salida'}
                    </button>
                  )}
                </div>
              )}

              {selected.status === 'Inactivo' && (
                <p style={{marginTop:'0.75rem', fontSize:'0.82rem', color:'#ef4444', fontWeight:600, textAlign:'center'}}>
                  QR desactivado — visita finalizada
                </p>
              )}
            </>
          ) : (
            <p style={{color:'#9ca3af', fontSize:'0.88rem', textAlign:'center', padding:'1rem'}}>
              Escaneá o seleccioná un pase QR para ver los datos.
            </p>
          )}
        </article>
      </section>

      {qrValidationError && (
        <div className="modal-overlay modal-overlay-centered">
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-icon confirm-modal-icon-danger" aria-hidden="true">!</div>
            <h2>{qrValidationError.title}</h2>
            <p>{qrValidationError.message}</p>
            <div className="confirm-modal-actions">
              <button type="button" className="confirm-modal-accept" style={{width:'100%'}} onClick={() => setQrValidationError(null)}>
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {scanConfirm && (
        <div className="modal-overlay modal-overlay-centered" onClick={() => !actionLoading && setScanConfirm(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`confirm-modal-icon ${scanConfirm.type === 'salida' ? 'confirm-modal-icon-danger' : ''}`} aria-hidden="true">
              {scanConfirm.type === 'ingreso' ? '→' : '←'}
            </div>
            <h2>Confirmación de {scanConfirm.type === 'ingreso' ? 'Ingreso' : 'Salida'}</h2>
            <p>
              {scanConfirm.pass.fullName} — {scanConfirm.pass.property}
              {scanConfirm.pass.mode === 'vehicular' ? ` · Vehicular (${scanConfirm.pass.plate})` : ' · Peatonal'}
            </p>
            <div className="confirm-modal-actions">
              <button type="button" className="confirm-modal-cancel" disabled={actionLoading} onClick={() => setScanConfirm(null)}>Cancelar</button>
              <button type="button" className="confirm-modal-accept" disabled={actionLoading} onClick={confirmScanAction}>
                {actionLoading ? 'Registrando…' : 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
