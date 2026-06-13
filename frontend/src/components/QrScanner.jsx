import { useState, useEffect, useRef } from "react";
import * as api from "../api.js";

export default function QrScanner({ visitPasses, setVisitPasses, selectedVisitPassId, setSelectedVisitPassId, historialVisitas = [], setHistorialVisitas, guardName = "", onToast }) {
  const [scannerActive, setScannerActive]   = useState(false);
  const [manualCode, setManualCode]         = useState("");
  const [scannedPass, setScannedPass]       = useState(null);
  const [scanError, setScanError]           = useState("");
  const [actionMsg, setActionMsg]           = useState("");
  const [actionLoading, setActionLoading]   = useState(false);
  const html5QrRef        = useRef(null);
  const scannerRunningRef = useRef(false);

  const stopScanner = () => {
    if (html5QrRef.current && scannerRunningRef.current) {
      scannerRunningRef.current = false;
      html5QrRef.current.stop().catch(() => {});
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
    try {
      const pass = await api.verifyVisita(clean);
      setScannedPass(pass);
      setSelectedVisitPassId(pass.id);
      showMsg(`✓ QR leído: ${pass.fullName}`);
      onToast?.(`✅ QR cargado: ${pass.fullName}`, "visita");
    } catch {
      setScanError(`Pase no encontrado: ${clean}`);
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
      ).then(() => { if (!cancelled) scannerRunningRef.current = true; })
       .catch(() => { setScanError("No se pudo acceder a la cámara. Usá el ingreso manual."); setScannerActive(false); });
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

  const handleIngreso = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const now = new Date();
      const hora = now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
      const fecha = now.toLocaleDateString('es-BO');
      const entry = await api.createHistorialVisita({
        visitante: selected.fullName,
        cedula:    selected.idNumber,
        propiedad: selected.property,
        tipo:      selected.mode === 'vehicular' ? 'vehicular' : 'peatonal',
        placa:     selected.plate || '-',
        fecha,
        entrada:   hora,
        salida:    '-',
        motivo:    selected.motive || '-',
        guard:     guardName,
      });
      setHistorialVisitas?.(prev => [entry, ...prev]);
      showMsg(`✓ Ingreso registrado: ${selected.fullName} — ${hora}`);
      onToast?.(`→ Ingreso: ${selected.fullName}`, "visita");
    } catch (e) { showMsg('Error: ' + e.message); }
    finally { setActionLoading(false); }
  };

  const handleSalida = async () => {
    if (!selected || !openEntry) return;
    setActionLoading(true);
    try {
      const now = new Date();
      const hora = now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
      await api.createHistorialVisita({
        visitante: selected.fullName,
        cedula:    selected.idNumber,
        propiedad: selected.property,
        tipo:      selected.mode === 'vehicular' ? 'vehicular' : 'peatonal',
        placa:     selected.plate || '-',
        fecha:     openEntry.fecha,
        entrada:   openEntry.entrada,
        salida:    hora,
        motivo:    selected.motive || '-',
        guard:     guardName,
      });
      await api.updateVisitaStatus(String(selected.id), 'Inactivo');
      setVisitPasses(prev => prev.map(v => String(v.id) === String(selected.id) ? { ...v, status: 'Inactivo' } : v));
      setHistorialVisitas?.(prev => prev.map(h => h.id === openEntry.id ? { ...h, salida: hora } : h));
      setScannedPass(prev => prev ? { ...prev, status: 'Inactivo' } : prev);
      showMsg(`✓ Salida registrada: ${selected.fullName} — ${hora}. QR desactivado.`);
      onToast?.(`← Salida: ${selected.fullName} — QR desactivado`, "visita");
    } catch (e) { showMsg('Error: ' + e.message); }
    finally { setActionLoading(false); }
  };

  return (
    <>
      <header className="dashboard-header visit-header">
        <div>
          <h1>Escanear QR</h1>
          <p>Escaneá el QR del visitante con la cámara o ingresá el código manualmente</p>
        </div>
      </header>

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

          {actionMsg && (
            <div style={{
              background: actionMsg.includes('Salida') || actionMsg.includes('Error') ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
              border: `1px solid ${actionMsg.includes('Salida') || actionMsg.includes('Error') ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
              borderRadius:10, padding:'0.6rem 0.85rem', marginBottom:'0.75rem',
              fontWeight:600, fontSize:'0.84rem',
              color: actionMsg.includes('Salida') || actionMsg.includes('Error') ? '#ef4444' : '#16a34a'
            }}>
              {actionMsg}
            </div>
          )}

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
    </>
  );
}
