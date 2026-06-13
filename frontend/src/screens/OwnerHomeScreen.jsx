import { useEffect, useState } from "react";

export default function OwnerHomeScreen({
  user,
  anunciosData,
  pagosData,
  historialVisitasData,
  residentProperty,
  residentUnit,
  setIsPayExpensesModalOpen,
  setActiveSection,
}) {
  const [announcementCarouselIdx, setAnnouncementCarouselIdx] = useState(0);

  const isTenant = user.role === "Inquilino";

  const rolePriority = {
    "Super Admin": 5,
    "Administrador": 4,
    "Propietario": 3,
    "Inquilino": 2,
    "Seguridad": 1
  };

  const canRoleSeeAnnouncementTarget = (role, target) => {
    if (target === "todos") return true;
    if (target === "propietarios") return role === "Propietario";
    if (target === "inquilinos") return role === "Inquilino";
    if (target === "seguridad") return role === "Seguridad";
    return false;
  };

  const isAnnouncementVisibleForUser = (announcement) => {
    const viewerPriority = rolePriority[user.role] || 0;
    const creatorPriority = rolePriority[announcement.createdByRole] || 0;
    const isCreator = user.role === announcement.createdByRole;
    const isAboveCreator = user.role === "Super Admin";
    const isSameOrBelowCreator = viewerPriority <= creatorPriority;

    if (isCreator || isAboveCreator) {
      return true;
    }

    return isSameOrBelowCreator && canRoleSeeAnnouncementTarget(user.role, announcement.target);
  };

  const visibleAnuncios = anunciosData.filter((item) => {
    const byRole = isAnnouncementVisibleForUser(item);
    const byCondo = user.role === 'Super Admin'
      ? true
      : user.role === 'Administrador'
        ? item.condo === user.condo
        : byRole;
    return byRole && byCondo;
  });

  const ownerRecentAnnouncements = visibleAnuncios.slice(0, 5);

  useEffect(() => {
    if (ownerRecentAnnouncements.length <= 1) return;
    const timer = setInterval(() => {
      setAnnouncementCarouselIdx(prev => (prev + 1) % ownerRecentAnnouncements.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [ownerRecentAnnouncements.length]);

  // Pagos reales del propietario/inquilino
  const myPagos = pagosData.filter(p =>
    p.propietario === user.name || p.propiedad === residentProperty
  );
  const myPendingPagos = myPagos.filter(p => p.estado === "pendiente");
  const myOverduePagos = myPagos.filter(p => p.estado === "rechazado");

  const paymentStatus = myOverduePagos.length > 0 ? "En mora"
    : myPendingPagos.length > 0 ? "Pendiente"
    : myPagos.length > 0 ? "Al día"
    : "Sin pagos";
  const paymentStatusClass = myOverduePagos.length > 0 ? "owner-text-danger"
    : myPendingPagos.length > 0 ? "owner-text-warning"
    : "owner-text-success";

  // Reservas activas del usuario
  const myActiveReservas = pagosData.filter(p =>
    (p.propietario === user.name || p.propiedad === residentProperty) &&
    p.tipo === "Reserva" && p.estado === "pendiente"
  ).length;

  // Visitas a mi propiedad (historial real filtrado por unidad)
  const ownerVisitHistory = residentUnit && residentUnit !== "-"
    ? historialVisitasData
        .filter(v =>
          (v.propiedad && v.propiedad.includes(residentUnit)) ||
          (v.unit      && v.unit.includes(residentUnit))
        )
        .slice(0, 6)
        .map(v => ({
          name:    v.visitante || v.visitorName || "—",
          type:    (v.placa && v.placa !== "-") ? "vehicular" : "peatonal",
          fecha:   v.fecha   || "—",
          inTime:  v.entrada || v.timestamp || "—",
          outTime: v.salida  || "-",
        }))
    : [];

  // Último pago real del propietario
  const myLastPago = myPagos
    .filter(p => p.estado === "aprobado")
    .slice(0, 1)[0] || null;

  return (
    <>
      <header className="dashboard-header owner-header">
        <h1>Bienvenido, {user.name}</h1>
        <p>{residentProperty}</p>
      </header>

      <section className="owner-top-kpis">
        <article className="owner-kpi-card">
          <span className="owner-kpi-icon owner-kpi-icon-blue" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 10.5L12 4L20 10.5V20H14V14H10V20H4V10.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p>Mi Propiedad</p>
            <strong>{residentUnit !== "-" ? residentUnit : (residentProperty !== "-" ? residentProperty : "Sin asignar")}</strong>
          </div>
        </article>

        <article className="owner-kpi-card">
          <span className="owner-kpi-icon owner-kpi-icon-green" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M20 6L9 17L4 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p>Estado de Pagos</p>
            <strong className={paymentStatusClass}>{paymentStatus}</strong>
          </div>
        </article>

        <article className="owner-kpi-card">
          <span className="owner-kpi-icon owner-kpi-icon-purple" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M8 3V6M16 3V6M4 9H20M5 6H19C20.1 6 21 6.9 21 8V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V8C3 6.9 3.9 6 5 6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p>Reservas Activas</p>
            <strong>{myActiveReservas}</strong>
          </div>
        </article>
      </section>

      <section className="owner-actions-grid">
        {!isTenant && (
          <button type="button" className="owner-action-card owner-action-card-green" onClick={() => setIsPayExpensesModalOpen(true)}>
            <span className="owner-action-icon owner-action-green" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/><path d="M12 6v12M9 9c0-1.1.9-2 2-2h2a2 2 0 010 4h-2a2 2 0 000 4h2a2 2 0 002-2"/>
              </svg>
            </span>
            <strong>Pagar Expensas</strong>
          </button>
        )}
        <button type="button" className="owner-action-card owner-action-card-purple" onClick={() => setActiveSection("Mis Reservas")}>
          <span className="owner-action-icon owner-action-purple" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
            </svg>
          </span>
          <strong>Reservar Áreas</strong>
        </button>
        <button type="button" className="owner-action-card owner-action-card-blue" onClick={() => setActiveSection("Pre-registro Visitas")}>
          <span className="owner-action-icon owner-action-blue" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </span>
          <strong>Pre-registro Visitas</strong>
        </button>
        {!isTenant && (
          <button type="button" className="owner-action-card owner-action-card-indigo" onClick={() => setActiveSection("Asambleas")}>
            <span className="owner-action-icon owner-action-indigo" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M21 15l-3 3-1.5-1.5"/>
              </svg>
            </span>
            <strong>Votar Asambleas</strong>
          </button>
        )}
      </section>

      <section className="owner-announcements-panel">
        <div className="owner-announcements-head">
          <h2>Anuncios</h2>
          <button type="button" className="owner-link-btn" onClick={() => setActiveSection("Anuncios")}>Ver todos</button>
        </div>

        {ownerRecentAnnouncements.length === 0 ? (
          <p className="owner-no-announcements">Sin anuncios recientes.</p>
        ) : (
          <>
            <div className="announcement-carousel">
              <div
                className="announcement-carousel-track"
                style={{ transform: `translateX(-${announcementCarouselIdx * 100}%)` }}
              >
                {ownerRecentAnnouncements.map((anuncio) => (
                  <article key={anuncio.id} className="announcement-carousel-slide">
                    <span className="owner-announcement-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M15 17H9M17 10C17 7.2 14.8 5 12 5C9.2 5 7 7.2 7 10V12.7C7 13.5 6.7 14.2 6.1 14.8L5 15.9H19L17.9 14.8C17.3 14.2 17 13.5 17 12.7V10Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <div className="announcement-carousel-body">
                      <h3>{anuncio.title}</h3>
                      <p>{anuncio.message}</p>
                      <small>{anuncio.dateLabel}</small>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {ownerRecentAnnouncements.length > 1 && (
              <div className="carousel-dots" role="tablist" aria-label="Anuncios">
                {ownerRecentAnnouncements.map((_, i) => (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={i === announcementCarouselIdx}
                    aria-label={`Anuncio ${i + 1}`}
                    className={`carousel-dot${i === announcementCarouselIdx ? " carousel-dot-active" : ""}`}
                    onClick={() => setAnnouncementCarouselIdx(i)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="owner-visit-history-panel">
        <div className="owner-announcements-head">
          <h2>Visitas a mi Unidad</h2>
          <span className="owner-visit-history-unit">{residentUnit !== "-" ? residentUnit : residentProperty}</span>
        </div>

        {ownerVisitHistory.length === 0 ? (
          <div className="owner-visit-history-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M16 8C17.7 8 19 6.7 19 5C19 3.3 17.7 2 16 2C14.3 2 13 3.3 13 5C13 6.7 14.3 8 16 8ZM8 10C9.7 10 11 8.7 11 7C11 5.3 9.7 4 8 4C6.3 4 5 5.3 5 7C5 8.7 6.3 10 8 10ZM4 20V18.8C4 16.7 5.8 15 8 15H10C12.2 15 14 16.7 14 18.8V20M13 20V18.7C13 17.5 12.5 16.4 11.7 15.6C12.3 15.2 13 15 13.8 15H16.2C18.4 15 20 16.6 20 18.8V20" />
            </svg>
            <p>Sin visitas registradas para tu unidad.</p>
          </div>
        ) : (
          <div className="owner-visit-history-wrap">
            <table className="owner-visit-history-table">
              <thead>
                <tr>
                  <th>Visitante</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                </tr>
              </thead>
              <tbody>
                {ownerVisitHistory.map((v, i) => (
                  <tr key={i}>
                    <td>{v.name}</td>
                    <td>
                      <span className={`visit-type-chip ${v.type === "vehicular" ? "visit-type-vehicle" : "visit-type-walk"}`}>
                        {v.type}
                      </span>
                    </td>
                    <td>{v.fecha}</td>
                    <td>{v.inTime}</td>
                    <td className={v.outTime === "-" ? "visit-pending" : ""}>{v.outTime === "-" ? "En curso" : v.outTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="owner-last-payment-panel">
        <h3>Último Pago</h3>
        {myLastPago ? (
          <>
            <p className="owner-last-payment-label">{myLastPago.tipo} · {myLastPago.fecha}</p>
            <div className="owner-last-payment-amount-wrap">
              <strong>Bs. {Number(myLastPago.monto).toLocaleString()}</strong>
              <span className="owner-payment-badge-approved">Aprobado</span>
            </div>
          </>
        ) : (
          <p className="owner-last-payment-label">Sin pagos aprobados aún.</p>
        )}
      </section>
    </>
  );
}
