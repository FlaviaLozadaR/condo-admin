import * as api from "../api.js";

export default function PanicScreen({
  user,
  panicAlerts,
  setPanicAlerts,
  residentProfile,
  residentStreet,
  residentUnit,
  setIsPanicConfirmOpen,
}) {
  const isSecurity = user.role === "Seguridad";

  const activePanicAlerts = panicAlerts.filter((item) => item.status !== "Atendida");

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

  return (
    <>
      <header className="dashboard-header panic-header">
        <h1>Botón de Pánico</h1>
        <p>{isSecurity ? "Alertas activas de los propietarios" : "Sistema de alerta de emergencia"}</p>
      </header>

      {isSecurity ? (
        <section className="panic-security-panel">
          <h2>Alertas Recibidas</h2>
          <p>Estas alertas fueron activadas por propietarios y requieren asistencia inmediata.</p>

          <div className="panic-alert-list">
            {activePanicAlerts.length === 0 ? (
              <div className="panic-empty">No hay alertas activas en este momento.</div>
            ) : (
              activePanicAlerts.map((alert) => (
                <article key={alert.id} className="panic-alert-item">
                  <div>
                    <strong>{alert.resident}</strong>
                    <p>{alert.address} - {alert.unit}</p>
                    <small>Tel: {alert.phone} · {alert.createdAt}</small>
                  </div>
                  <div className="panic-alert-actions">
                    <span className={`panic-alert-status panic-alert-status-${alert.status === "Pendiente" ? "pending" : "way"}`}>{alert.status}</span>
                    {alert.status === "Pendiente" ? (
                      <button type="button" onClick={() => updatePanicAlertStatus(alert.id, "En camino")}>En camino</button>
                    ) : (
                      <button type="button" onClick={() => updatePanicAlertStatus(alert.id, "Atendida")}>Marcar atendida</button>
                    )}
                  </div>
                </article>
              ))
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
        </section>
      )}
    </>
  );
}
