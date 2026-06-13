import { useState } from "react";
import {
  parseFecha,
  MONTH_NAMES,
  DAY_NAMES,
  formatAmount,
  describeSector,
  chartLeft,
  chartTop,
  chartWidth,
  chartHeight,
  barWidth,
  barGap,
  barBaseX,
} from "./dashboardUtils.js";

export default function SuperAdminDashboardScreen({
  condominiosData,
  superAdminDashboards,
  pagosData,
  historialVisitasData,
  selectedDashboardCondoId,
  setSelectedDashboardCondoId,
  setActiveSection,
}) {
  const [dashboardCondoDropdownOpen, setDashboardCondoDropdownOpen] = useState(false);

  const nowDate  = new Date();
  const curMonth = nowDate.getMonth();
  const curYear  = nowDate.getFullYear();

  const allCondosDashboard = {
    id: "todos",
    name: "Todos los condominios",
    propertiesCount:       superAdminDashboards.reduce((s, d) => s + d.propertiesCount, 0),
    ownersCount:           superAdminDashboards.reduce((s, d) => s + d.ownersCount, 0),
    tenantsCount:          superAdminDashboards.reduce((s, d) => s + d.tenantsCount, 0),
    debtTotal:             superAdminDashboards.reduce((s, d) => s + d.debtTotal, 0),
    debtorsCount:          superAdminDashboards.reduce((s, d) => s + d.debtorsCount, 0),
    approvedPaymentsCount: superAdminDashboards.reduce((s, d) => s + d.approvedPaymentsCount, 0),
    pendingPaymentsCount:  superAdminDashboards.reduce((s, d) => s + d.pendingPaymentsCount, 0),
    collectedAmount:       superAdminDashboards.reduce((s, d) => s + d.collectedAmount, 0),
    visitsCount:           superAdminDashboards.reduce((s, d) => s + d.visitsCount, 0),
    debtors: superAdminDashboards.flatMap(d => d.debtors).sort((a, b) => b.debt - a.debt).slice(0, 5),
  };

  const selectedSuperAdminDashboard = selectedDashboardCondoId === "todos"
    ? allCondosDashboard
    : superAdminDashboards.find((item) => item.id === selectedDashboardCondoId) ||
      superAdminDashboards[0] ||
      null;

  const superAdminSelectedKpis = selectedSuperAdminDashboard
    ? [
        {
          label: "Unidades",
          value: selectedSuperAdminDashboard.propertiesCount,
          tone: "primary",
          icon: "building"
        },
        {
          label: "Cobrado",
          value: formatAmount(selectedSuperAdminDashboard.collectedAmount),
          tone: "success",
          icon: "money"
        },
        {
          label: "En Mora",
          value: formatAmount(selectedSuperAdminDashboard.debtTotal),
          tone: "danger",
          icon: "alert"
        },
        {
          label: "Morosos",
          value: selectedSuperAdminDashboard.debtorsCount,
          tone: "warning",
          icon: "users"
        }
      ]
    : [];

  // ── Super Admin chart data (filtered by selected dashboard condo) ────────────
  const saCondoName = selectedSuperAdminDashboard?.name || "";
  const saMonthlyPayments = Array.from({ length: 4 }, (_, i) => {
    let m = curMonth - 3 + i; let y = curYear;
    if (m < 0) { m += 12; y -= 1; }
    const total = pagosData
      .filter(p => {
        if (p.estado !== "aprobado") return false;
        const d = parseFecha(p.fecha);
        if (!d || d.getMonth() !== m || d.getFullYear() !== y) return false;
        if (saCondoName && !p.propiedad?.toLowerCase().includes(saCondoName.toLowerCase())) return false;
        return true;
      })
      .reduce((s, p) => s + (Number(p.monto) || 0), 0);
    return { label: MONTH_NAMES[m], value: total };
  });
  const saVisitBuckets = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(nowDate); d.setDate(nowDate.getDate() - i);
    saVisitBuckets[d.toDateString()] = { label: DAY_NAMES[d.getDay()], value: 0 };
  }
  historialVisitasData.forEach(v => {
    const d = parseFecha(v.fecha);
    if (d) { const k = d.toDateString(); if (saVisitBuckets[k]) saVisitBuckets[k].value += 1; }
  });
  const saVisitsByDay = Object.values(saVisitBuckets);
  const saRawBarMax  = Math.max(...saMonthlyPayments.map(p => p.value), 1000);
  const saBarMax     = Math.ceil(saRawBarMax / 1000) * 1000;
  const saGridStep   = saBarMax / 4;
  const saGridValues = [0, saGridStep, saGridStep * 2, saGridStep * 3, saBarMax].map(Math.round);
  const saRawLineMax    = Math.max(...saVisitsByDay.map(v => v.value), 5);
  const saLineMax       = Math.ceil(saRawLineMax / 5) * 5 || 5;
  const saVisitGridStep = saLineMax / 4;
  const saVisitGridValues = [0, saVisitGridStep, saVisitGridStep * 2, saVisitGridStep * 3, saLineMax].map(Math.round);
  const saVisitPoints = saVisitsByDay.map((item, idx) => ({
    x: chartLeft + (idx / Math.max(saVisitsByDay.length - 1, 1)) * chartWidth,
    y: chartTop + chartHeight - (item.value / saLineMax) * chartHeight,
    label: item.label,
  }));
  const saVisitPath = saVisitPoints.map(p => `${p.x},${p.y}`).join(" ");
  const saPedCount = historialVisitasData.filter(v => !v.placa || v.placa === "-").length;
  const saVehCount = historialVisitasData.filter(v => v.placa && v.placa !== "-").length;
  const saTotalIncome = saPedCount + saVehCount;
  const saPedPercent = saTotalIncome > 0 ? Math.round(saPedCount / saTotalIncome * 100) : 0;
  const saVehPercent = saTotalIncome > 0 ? 100 - saPedPercent : 0;
  const saPedPath = describeSector(75, 75, 74, 0, (saPedPercent / 100) * 360);
  const saVehPath = describeSector(75, 75, 74, (saPedPercent / 100) * 360, 360);
  const saDebtors = (selectedSuperAdminDashboard?.debtors || []).map(d => ({
    property: d.property, block: "", debt: `$${d.debt}`,
  }));

  return (
    <>
      <header className="dashboard-header">
        <h1>Dashboard Global</h1>
        <p>{selectedDashboardCondoId === "todos" ? "Vista global de todos los condominios." : "Selecciona un condominio o edificio para ver todos sus datos."}</p>
      </header>

      {condominiosData.length === 0 ? (
        <section className="dashboard-panel" style={{ textAlign: "center", padding: "3rem 2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏢</div>
          <h2 style={{ marginBottom: "0.5rem" }}>Aún no hay condominios</h2>
          <p style={{ color: "var(--text-muted, #94a3b8)", marginBottom: "1.5rem" }}>
            Creá el primer condominio desde la sección <strong>Gestión de Condominios</strong> para empezar a ver datos aquí.
          </p>
          <button className="btn btn-primary" onClick={() => setActiveSection("Gestión")}>
            Ir a Gestión de Condominios
          </button>
        </section>
      ) : (
      <>
      <section className="dashboard-panel superadmin-selector-panel">
        <div className="management-condo-field dashboard-condo-field">
          <label>Condominio / Edificio</label>
          <div className="condo-dropdown dashboard-condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDashboardCondoDropdownOpen(false); }} tabIndex={-1}>
            <button
              type="button"
              className="condo-dropdown-trigger dashboard-condo-trigger"
              onClick={() => setDashboardCondoDropdownOpen((open) => !open)}
              aria-expanded={dashboardCondoDropdownOpen}
            >
              <span className="condo-dropdown-value">
                {selectedDashboardCondoId === "todos"
                  ? "Todos los condominios"
                  : (() => {
                      const c = condominiosData.find((item) => item.id === selectedDashboardCondoId);
                      return c ? `${c.type}: ${c.name}` : "Seleccionar condominio";
                    })()}
              </span>
              <svg className={`condo-dropdown-chevron${dashboardCondoDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {dashboardCondoDropdownOpen && (
              <ul className="condo-dropdown-list dashboard-condo-list" role="listbox">
                <li
                  role="option"
                  aria-selected={selectedDashboardCondoId === "todos"}
                  className={`condo-dropdown-item${selectedDashboardCondoId === "todos" ? " selected" : ""}`}
                  onMouseDown={() => { setSelectedDashboardCondoId("todos"); setDashboardCondoDropdownOpen(false); }}
                >
                   Todos los condominios
                </li>
                {condominiosData.map((item) => (
                  <li
                    key={item.id}
                    role="option"
                    aria-selected={selectedDashboardCondoId === item.id}
                    className={`condo-dropdown-item${selectedDashboardCondoId === item.id ? " selected" : ""}`}
                    onMouseDown={() => { setSelectedDashboardCondoId(item.id); setDashboardCondoDropdownOpen(false); }}
                  >
                    {item.type}: {item.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="dashboard-kpi-grid">
        {superAdminSelectedKpis.map((kpi) => (
          <article key={kpi.label} className={`dashboard-kpi dashboard-kpi-${kpi.tone}`}>
            <div className="kpi-content">
              <span className={`kpi-icon kpi-icon-${kpi.tone}`} aria-hidden="true">
                {kpi.icon === "building" && (
                  <svg viewBox="0 0 24 24">
                    <path d="M7 3H17V21H7V3ZM10 7H11M13 7H14M10 11H11M13 11H14M10 15H11M13 15H14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                )}
                {kpi.icon === "money" && (
                  <svg viewBox="0 0 24 24">
                    <path d="M12 3V21M16.5 7.5C16.5 6.1 15 5 12.8 5H11.2C9 5 7.5 6.1 7.5 7.5C7.5 8.9 9 10 11.2 10H12.8C15 10 16.5 11.1 16.5 12.5C16.5 13.9 15 15 12.8 15H11.2C9 15 7.5 13.9 7.5 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {kpi.icon === "alert" && (
                  <svg viewBox="0 0 24 24">
                    <path d="M12 9V13M12 17H12.01M4.6 18H19.4C20.7 18 21.5 16.6 20.8 15.5L13.4 4.2C12.8 3.2 11.3 3.2 10.6 4.2L3.2 15.5C2.5 16.6 3.3 18 4.6 18Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {kpi.icon === "users" && (
                  <svg viewBox="0 0 24 24">
                    <path d="M16 8C17.7 8 19 6.7 19 5C19 3.3 17.7 2 16 2C14.3 2 13 3.3 13 5C13 6.7 14.3 8 16 8ZM8 10C9.7 10 11 8.7 11 7C11 5.3 9.7 4 8 4C6.3 4 5 5.3 5 7C5 8.7 6.3 10 8 10ZM4 20V18.8C4 16.7 5.8 15 8 15H10C12.2 15 14 16.7 14 18.8V20M13 20V18.7C13 17.5 12.5 16.4 11.7 15.6C12.3 15.2 13 15 13.8 15H16.2C18.4 15 20 16.6 20 18.8V20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <div className="kpi-text">
                <p className="dashboard-kpi-label">{kpi.label}</p>
                <strong>{kpi.value}</strong>
              </div>
            </div>
          </article>
        ))}
      </section>

      {selectedSuperAdminDashboard && selectedDashboardCondoId === "todos" && (
        <section className="superadmin-dashboards-grid superadmin-all-grid">
          {superAdminDashboards.map(d => (
            <article key={d.id} className="dashboard-panel superadmin-dashboard-card superadmin-all-card" style={{cursor:'pointer'}} onClick={() => setSelectedDashboardCondoId(d.id)}>
              <header className="superadmin-dashboard-head">
                <h2>{d.name}</h2>
                <span className="superadmin-dashboard-chip">{d.propertiesCount} unidades</span>
              </header>
              <div className="superadmin-metrics-grid">
                <div><span>Propietarios</span><strong>{d.ownersCount}</strong></div>
                <div><span>Inquilinos</span><strong>{d.tenantsCount}</strong></div>
                <div><span>Cobrado</span><strong>{formatAmount(d.collectedAmount)}</strong></div>
                <div><span>En Mora</span><strong>{formatAmount(d.debtTotal)}</strong></div>
              </div>
              <div className="superadmin-dashboard-row">
                <p><span>Pagos aprobados:</span> <strong>{d.approvedPaymentsCount}</strong></p>
                <p><span>Pagos pendientes:</span> <strong>{d.pendingPaymentsCount}</strong></p>
                <p><span>Morosos:</span> <strong>{d.debtorsCount}</strong></p>
              </div>
            </article>
          ))}
        </section>
      )}

      {selectedSuperAdminDashboard && selectedDashboardCondoId !== "todos" && (
        <section className="superadmin-dashboards-grid">
          <article key={selectedSuperAdminDashboard.name} className="dashboard-panel superadmin-dashboard-card">
            <header className="superadmin-dashboard-head">
              <h2>{selectedSuperAdminDashboard.name}</h2>
              <span className="superadmin-dashboard-chip">{selectedSuperAdminDashboard.propertiesCount} unidades</span>
            </header>

            <div className="superadmin-metrics-grid">
              <div><span>Propietarios</span><strong>{selectedSuperAdminDashboard.ownersCount}</strong></div>
              <div><span>Inquilinos</span><strong>{selectedSuperAdminDashboard.tenantsCount}</strong></div>
              <div><span>Cobrado</span><strong>{formatAmount(selectedSuperAdminDashboard.collectedAmount)}</strong></div>
              <div><span>En Mora</span><strong>{formatAmount(selectedSuperAdminDashboard.debtTotal)}</strong></div>
            </div>

            <div className="superadmin-dashboard-row">
              <p><span>Pagos aprobados:</span> <strong>{selectedSuperAdminDashboard.approvedPaymentsCount}</strong></p>
              <p><span>Pagos pendientes:</span> <strong>{selectedSuperAdminDashboard.pendingPaymentsCount}</strong></p>
              <p><span>Visitas registradas:</span> <strong>{selectedSuperAdminDashboard.visitsCount}</strong></p>
            </div>

            <div className="superadmin-debtors-preview">
              <h3>Morosos principales</h3>
              {selectedSuperAdminDashboard.debtors.length === 0 ? (
                <p className="superadmin-empty-text">Sin morosos registrados.</p>
              ) : (
                selectedSuperAdminDashboard.debtors.map((debtor) => (
                  <div key={debtor.property} className="superadmin-debtor-item">
                    <span>{debtor.property}</span>
                    <strong>{formatAmount(debtor.debt)}</strong>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      )}

      {selectedSuperAdminDashboard && selectedDashboardCondoId !== "todos" && (
        <section className="dashboard-grid">
          <article className="dashboard-panel">
            <h2>Pagos Mensuales</h2>
            {saMonthlyPayments.every(p => p.value === 0) && (
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted,#94a3b8)", marginBottom: "0.5rem" }}>Sin pagos registrados aún</p>
            )}
            <div className="chart-wrap">
              <svg viewBox="0 0 620 260" className="chart-svg" aria-hidden="true">
                {saGridValues.map((v, i) => {
                  const y = chartTop + chartHeight - (v / saBarMax) * chartHeight;
                  return (
                    <g key={`sa-bar-grid-${v}`}>
                      <line x1={chartLeft} y1={y} x2={chartLeft + chartWidth} y2={y} className="chart-grid-line" />
                      <text x={chartLeft - 8} y={y + 4} className="chart-axis-label chart-axis-label-y">{v}</text>
                      {i === 0 && <line x1={chartLeft} y1={y} x2={chartLeft + chartWidth} y2={y} className="chart-axis-base" />}
                    </g>
                  );
                })}
                {saMonthlyPayments.map((item, idx) => {
                  const x = barBaseX + idx * (barWidth + barGap);
                  const h = (item.value / saBarMax) * chartHeight;
                  const y = chartTop + chartHeight - h;
                  return (
                    <g key={item.label}>
                      <rect x={x} y={y} width={barWidth} height={Math.max(h, 1)} className="bar-rect" />
                      <text x={x + barWidth / 2} y={chartTop + chartHeight + 18} className="chart-axis-label chart-axis-label-x">{item.label}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </article>

          <article className="dashboard-panel">
            <h2>Visitas por Día</h2>
            {saVisitsByDay.every(v => v.value === 0) && (
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted,#94a3b8)", marginBottom: "0.5rem" }}>Sin visitas registradas aún</p>
            )}
            <div className="chart-wrap">
              <svg viewBox="0 0 620 260" className="chart-svg" aria-hidden="true">
                {saVisitGridValues.map(v => {
                  const y = chartTop + chartHeight - (v / saLineMax) * chartHeight;
                  return (
                    <g key={`sa-vgrid-${v}`}>
                      <line x1={chartLeft} y1={y} x2={chartLeft + chartWidth} y2={y} className="chart-grid-line" />
                      <text x={chartLeft - 8} y={y + 4} className="chart-axis-label chart-axis-label-y">{v}</text>
                    </g>
                  );
                })}
                {saVisitPoints.map(pt => (
                  <line key={`sa-vcol-${pt.label}`} x1={pt.x} y1={chartTop} x2={pt.x} y2={chartTop + chartHeight} className="chart-grid-line chart-grid-vertical" />
                ))}
                <polyline points={saVisitPath} className="line-plot" />
                {saVisitPoints.map(pt => <circle key={`sa-vpt-${pt.label}`} cx={pt.x} cy={pt.y} r={3.2} className="line-point" />)}
                {saVisitPoints.map(pt => (
                  <text key={`sa-vlbl-${pt.label}`} x={pt.x} y={chartTop + chartHeight + 18} className="chart-axis-label chart-axis-label-x" textAnchor="middle">{pt.label}</text>
                ))}
                <line x1={chartLeft} y1={chartTop + chartHeight} x2={chartLeft + chartWidth} y2={chartTop + chartHeight} className="chart-axis-base" />
              </svg>
            </div>
          </article>

          <article className="dashboard-panel">
            <h2>Tipo de Ingreso</h2>
            {!saTotalIncome ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "0.5rem", padding: "1.5rem 0", color: "var(--text-muted,#94a3b8)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ width: 36, height: 36, opacity: 0.4 }}>
                  <circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>
                </svg>
                <span style={{ fontSize: "0.82rem" }}>Sin registros de visitas aún</span>
              </div>
            ) : (
              <div className="dashboard-income-wrap">
                <p className="income-label income-label-top">Peatonal {saPedPercent}%</p>
                <div className="income-svg-container">
                  <svg viewBox="0 0 150 150" className="income-pie-svg">
                    <path className="income-sector income-sector-walk" d={saPedPath} />
                    <path className="income-sector income-sector-vehicle" d={saVehPath} />
                    <circle cx="75" cy="75" r="1.2" fill="#ffffff" />
                  </svg>
                </div>
                <p className="income-label income-label-bottom">Vehicular {saVehPercent}%</p>
              </div>
            )}
          </article>

          <article className="dashboard-panel">
            <h2>Lista de Morosos</h2>
            <div className="debtor-list">
              {saDebtors.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted,#94a3b8)", padding: "0.5rem 0" }}>Sin morosos registrados</p>
              ) : saDebtors.map(d => (
                <div className="debtor-item" key={d.property}>
                  <div><strong>{d.property}</strong></div>
                  <span>{d.debt}<small>en mora</small></span>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}
      </>
      )}
    </>
  );
}
