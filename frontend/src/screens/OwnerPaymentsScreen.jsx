import { useState } from "react";

export default function OwnerPaymentsScreen({
  user,
  pagosData,
  residentProperty,
  residentUnit,
  residentExpensas,
  residentCargoExtra,
  residentCargoNota,
  condoPaymentQr,
  onQrError,
  totalDue,
  setIsPayExpensesModalOpen,
}) {
  const [qrRetried, setQrRetried] = useState(false);
  const [qrZoomOpen, setQrZoomOpen] = useState(false);
  const handleQrError = () => {
    if (qrRetried) return;
    setQrRetried(true);
    onQrError?.();
  };
  const handleDownloadQr = async () => {
    try {
      const res  = await fetch(condoPaymentQr);
      const blob = await res.blob();
      const ext  = (blob.type.split('/')[1] || 'png').split('+')[0];
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `qr-pago.${ext}`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {}
  };
  const myPagos = pagosData.filter(p =>
    p.propietario === user.name || p.propiedad === residentProperty
  );
  const myPendingPagos = myPagos.filter(p => p.estado === "pendiente");
  const myOverduePagos = myPagos.filter(p => p.estado === "rechazado");

  return (
    <>
      <header className="dashboard-header owner-header">
        <h1>Mis Pagos</h1>
        <p>Gestiona tus pagos de expensas</p>
      </header>

      <section className="owner-payments-status-panel">
        <div className="owner-payments-status-content">
          <div className="owner-payments-status-left">
            <h3>Estado Actual</h3>
            <div className="owner-payments-status-grid">
              <div className="owner-payments-status-item">
                <span className="owner-payments-label">Propiedad</span>
                <strong>{residentUnit !== '-' ? residentUnit : residentProperty}</strong>
              </div>
              <div className="owner-payments-status-item">
                <span className="owner-payments-label">Expensas Mensuales</span>
                <strong>Bs. {residentExpensas > 0 ? residentExpensas.toLocaleString() : '—'}</strong>
              </div>
              {residentCargoExtra > 0 && (
                <div className="owner-payments-status-item">
                  <span className="owner-payments-label">Cargo Extra</span>
                  <strong style={{color:'#dc2626'}}>Bs. {residentCargoExtra.toLocaleString()}</strong>
                </div>
              )}
              <div className={`owner-payments-status-item ${myPendingPagos.length === 0 && myOverduePagos.length === 0 ? 'owner-payments-status-paid' : ''}`}>
                <span className="owner-payments-label">Total a Pagar</span>
                <strong style={{color: totalDue === 0 ? '#16a34a' : undefined}}>
                  {totalDue === 0 ? '✓ Pagado' : `Bs. ${totalDue.toLocaleString()}`}
                </strong>
              </div>
            </div>
            {residentCargoExtra > 0 && residentCargoNota && (
              <p style={{margin:'0.4rem 0 0',fontSize:'0.78rem',color:'#dc2626'}}>⚠ {residentCargoNota}</p>
            )}
          </div>
          <button className="owner-btn-pay-expenses" type="button" onClick={() => setIsPayExpensesModalOpen(true)}>
            <span className="owner-btn-pay-icon">Bs.</span>
            <span className="owner-btn-pay-text">Pagar Expensas</span>
          </button>
        </div>
      </section>

      {condoPaymentQr && (
        <section className="resident-qr-panel">
          <div className="resident-qr-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:20,height:20,flexShrink:0,color:'#4f46e5'}}>
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              <path d="M14 14h1v1h-1zM17 14h1v1h-1zM14 17h1v1h-1zM17 17h3v3h-3z"/>
            </svg>
            <h3>QR de Pago</h3>
          </div>
          <div className="resident-qr-body">
            <div className="resident-qr-img-wrap">
              <img
                src={condoPaymentQr}
                alt="QR de pago del condominio"
                className="resident-qr-img"
                onError={handleQrError}
                onClick={() => setQrZoomOpen(true)}
                role="button"
                tabIndex={0}
                title="Ver QR ampliado"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setQrZoomOpen(true); } }}
              />
              <button
                type="button"
                className="payment-qr-download-btn"
                onClick={handleDownloadQr}
                title="Descargar QR"
                aria-label="Descargar QR"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
            </div>
            <div className="resident-qr-info">
              <p className="resident-qr-title">Escaneá el QR para pagar</p>
              <p className="resident-qr-sub">Usá tu billetera o app bancaria para escanear el código y realizar el pago de expensas. Luego subí el comprobante desde "Pagar Expensas".</p>
            </div>
          </div>
        </section>
      )}

      {qrZoomOpen && condoPaymentQr && (
        <div className="qr-zoom-overlay" onClick={() => setQrZoomOpen(false)}>
          <div className="qr-zoom-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="qr-zoom-close" onClick={() => setQrZoomOpen(false)} aria-label="Cerrar">✕</button>
            <img src={condoPaymentQr} alt="QR de pago ampliado" className="qr-zoom-img" />
          </div>
        </div>
      )}


      <section className="owner-payments-history-panel">
        <div className="owner-payments-history-head">
          <div>
            <h3>Historial de Pagos</h3>
            <p>Todos los comprobantes quedan sujetos a revisión y aprobación de la administración.</p>
          </div>
        </div>
        <div className="owner-payments-history-list">
          {pagosData
            .filter((pago) => pago.propiedad === residentProperty || pago.propietario === user.name)
            .map((pago) => (
            <article key={pago.id} className={`owner-payment-history-item owner-payment-history-item--${pago.estado}`}>
              <div className="owner-payment-history-left">
                <span className="owner-payment-history-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M12 3V21M16.5 7.5C16.5 6.1 15 5 12.8 5H11.2C9 5 7.5 6.1 7.5 7.5C7.5 8.9 9 10 11.2 10H12.8C15 10 16.5 11.1 16.5 12.5C16.5 13.9 15 15 12.8 15H11.2C9 15 7.5 13.9 7.5 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <div>
                  <p className="owner-payment-history-title">{pago.tipo}</p>
                  <p className="owner-payment-history-detail">{pago.fecha}</p>
                  <span className={`owner-payment-status-badge ${pago.estado === "aprobado" ? "owner-payment-approved" : "owner-payment-pending"}`}>
                    {pago.estado === "aprobado" ? "✓ Aprobado" : "⏱ Pendiente"}
                  </span>
                </div>
              </div>
              <span className="owner-payment-history-amount">Bs. {Number(pago.monto).toLocaleString()}</span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
