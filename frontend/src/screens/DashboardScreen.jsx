import { useState } from "react";
import {
  parseFecha,
  MONTH_NAMES,
  DAY_NAMES,
  describeSector,
  chartLeft,
  chartTop,
  chartWidth,
  chartHeight,
  barWidth,
  barGap,
  barBaseX,
} from "./dashboardUtils.js";
import { getPropertyTenantsText } from "../utils/tenants.js";

export default function DashboardScreen({
  user,
  adminCondoName,
  propiedadesData,
  pagosData,
  historialVisitasData,
  visitPasses,
  panicAlerts = [],
  setActiveSection,
  exportToPDF,
  onToast,
}) {
  const [hoveredSector, setHoveredSector] = useState(null);

  // ── Exportar Morosos ──────────────────────────────────────────────────────────
  const handleExportMorosos = async (format) => {
    const morososList = propiedadesData
      .filter(p => (!adminCondoName || p.condo === adminCondoName) && (Number(p.debt) || 0) > 0)
      .sort((a, b) => (Number(b.debt) || 0) - (Number(a.debt) || 0));
    if (morososList.length === 0) { onToast("No hay morosos para exportar.", "warning"); return; }
    const date       = new Date().toISOString().slice(0, 10);
    const totalDeuda = morososList.reduce((s, p) => s + (Number(p.debt) || 0), 0);

    if (format === "excel") {
      // xlsx se carga bajo demanda: pesa ~400KB y solo se necesita al exportar
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(morososList.map(p => ({
        Condominio:    p.condo || p.street,
        Unidad:        p.code,
        Bloque:        p.block,
        Propietario:   p.owner,
        Inquilino:     getPropertyTenantsText(p) !== "-" ? getPropertyTenantsText(p) : "",
        "Deuda ($)":   p.debt,
      })));
      ws["!cols"] = [{ wch: 22 }, { wch: 10 }, { wch: 8 }, { wch: 22 }, { wch: 22 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Morosos");
      XLSX.writeFile(wb, `morosos_${date}.xlsx`);
      onToast(`${morososList.length} morosos exportados a Excel.`, "success");
    } else {
      exportToPDF({
        title:    "Reporte de Morosos",
        subtitle: `Generado el ${new Date().toLocaleDateString("es-AR")} · Total en mora: Bs. ${totalDeuda.toLocaleString("es-AR")}`,
        headers:  ["Condominio", "Unidad", "Bloque", "Propietario", "Inquilino", "Deuda"],
        rows:     morososList.map(p => [
          p.condo || p.street, p.code, p.block, p.owner,
          getPropertyTenantsText(p), `Bs. ${p.debt}`,
        ]),
        totals:   ["", "", "", "", "Total en mora:", `Bs. ${totalDeuda.toLocaleString("es-AR")}`],
      });
    }
  };

  // ── Dashboard: datos reales computados desde el estado del backend ───────────
  const nowDate    = new Date();
  const curMonth   = nowDate.getMonth();
  const curYear    = nowDate.getFullYear();

  const adminProps = propiedadesData.filter(p =>
    !adminCondoName || p.condo === adminCondoName
  );
  const adminPropIds    = new Set(adminProps.map(p => `${p.street} - ${p.code}`));
  const adminOwnerNames = new Set(adminProps.map(p => p.owner).filter(o => o && o !== '-'));

  // Pagos mensuales — últimos 4 meses
  const monthlyPayments = Array.from({ length: 4 }, (_, i) => {
    let m = curMonth - 3 + i;
    let y = curYear;
    if (m < 0) { m += 12; y -= 1; }
    const total = pagosData
      .filter(p => {
        if (p.estado !== 'aprobado') return false;
        const d = parseFecha(p.fecha);
        if (!d || d.getMonth() !== m || d.getFullYear() !== y) return false;
        if (adminCondoName && !adminPropIds.has(p.propiedad) && !adminOwnerNames.has(p.propietario)) return false;
        return true;
      })
      .reduce((sum, p) => sum + (Number(p.monto) || 0), 0);
    return { label: MONTH_NAMES[m], value: total };
  });

  // Para gráficas: filtrar por condo del usuario (sin afectar búsqueda/tipo del filtro de tabla)
  const condoHistorial = user.condo
    ? historialVisitasData.filter(v => v.propiedad?.toLowerCase().includes(user.condo.toLowerCase()))
    : historialVisitasData;

  // Visitas por día — últimos 7 días
  const dayBuckets = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(nowDate);
    d.setDate(nowDate.getDate() - i);
    dayBuckets[d.toDateString()] = { label: DAY_NAMES[d.getDay()], value: 0 };
  }
  condoHistorial.forEach(v => {
    const d = parseFecha(v.fecha);
    if (d) {
      const k = d.toDateString();
      if (dayBuckets[k]) dayBuckets[k].value += 1;
    }
  });
  const visitsByDay = Object.values(dayBuckets);

  // Tipo de ingreso: sin placa → peatonal, con placa → vehicular
  const pedCount = condoHistorial.filter(v => !v.placa || v.placa === '-').length;
  const vehCount = condoHistorial.filter(v => v.placa && v.placa !== '-').length;
  const incomeType = [
    { label: 'Peatonal', value: pedCount },
    { label: 'Vehicular', value: vehCount },
  ];

  // Pagos del condominio del admin (por label de propiedad O por nombre del propietario)
  const adminPagos    = pagosData.filter(p => adminPropIds.has(p.propiedad) || adminOwnerNames.has(p.propietario));
  const pendingPagos  = adminPagos.filter(p => p.estado === 'pendiente');
  const approvedPagos = adminPagos.filter(p => p.estado === 'aprobado');

  // Cobrado este mes — pagos aprobados del mes actual
  const cobradoMes = approvedPagos
    .filter(p => {
      const d = parseFecha(p.fecha);
      return d && d.getMonth() === curMonth && d.getFullYear() === curYear;
    })
    .reduce((sum, p) => sum + (Number(p.monto) || 0), 0);

  // Propiedades con expensa asignada que NO tienen pago aprobado → son morosos reales
  const propsConExpensa = adminProps.filter(p => (Number(p.expensaMensual) || 0) > 0);
  const propsConPagoAprobado = new Set(
    approvedPagos.map(pay => pay.propietario).filter(Boolean)
  );

  const propsMorosas = propsConExpensa.filter(p =>
    !propsConPagoAprobado.has(p.owner) &&
    (!p.owner || p.owner === '-' ? false : true)
  );

  // En mora = expensa + cargo extra de propiedades sin pago aprobado + pagos pendientes
  const enMoraDeProps  = propsMorosas.reduce((s, p) => s + (Number(p.expensaMensual) || 0) + (Number(p.cargoExtra) || 0), 0);
  const enMoraDePagos  = pendingPagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const enMoraDeDebt   = adminProps.reduce((s, p) => s + (Number(p.debt) || 0), 0);
  const enMoraTotal    = enMoraDeProps + enMoraDePagos + enMoraDeDebt;

  // Morosos = propietarios de props con expensa sin pagar + con pagos pendientes
  const morososSet = new Set([
    ...propsMorosas.map(p => p.owner),
    ...pendingPagos.map(p => p.propietario),
    ...adminProps.filter(p => (Number(p.debt) || 0) > 0).map(p => p.owner),
  ].filter(Boolean));
  const morososCount = morososSet.size;

  // Lista morosos — propiedades con deuda o sin pago aprobado
  const debtors = adminProps
    .map(p => {
      const label      = `${p.street} - ${p.code}`;
      const pending    = pendingPagos.filter(pay => pay.propiedad === label || pay.propietario === p.owner);
      const pendingAmt = pending.reduce((s, pay) => s + (Number(pay.monto) || 0), 0);
      const sinPago    = propsConExpensa.includes(p) && !propsConPagoAprobado.has(p.owner)
        ? (Number(p.expensaMensual) || 0) + (Number(p.cargoExtra) || 0)
        : 0;
      const totalDebt  = pendingAmt + sinPago + (Number(p.debt) || 0);
      return { property: label, block: p.block, debt: totalDebt };
    })
    .filter(d => d.debt > 0)
    .sort((a, b) => b.debt - a.debt)
    .map(d => ({ ...d, debt: `Bs. ${d.debt.toLocaleString()}` }));

  // KPIs de seguridad
  const todayKey        = nowDate.toDateString();
  const visitasHoyCount = historialVisitasData.filter(v => {
    const d = parseFecha(v.fecha);
    return d && d.toDateString() === todayKey;
  }).length;

  const kpis =
    user.role === 'Administrador'
      ? [
          { label: 'Total Propiedades', value: adminProps.length,                  icon: 'building', tone: 'blue'   },
          { label: 'Cobrado Este Mes',  value: `Bs. ${cobradoMes.toLocaleString()}`,  icon: 'money',    tone: 'green'  },
          { label: 'En Mora',           value: `Bs. ${enMoraTotal.toLocaleString()}`, icon: 'alert',    tone: 'red'    },
          { label: 'Morosos',           value: morososCount,                        icon: 'users',    tone: 'yellow' },
        ]
      : user.role === 'Seguridad'
      ? [
          { label: 'Visitas Hoy',   value: visitasHoyCount,    icon: 'users',    tone: 'blue'   },
          { label: 'QR Validados',  value: visitPasses.length, icon: 'building', tone: 'green'  },
          { label: 'Peatonales',    value: pedCount,           icon: 'users',    tone: 'yellow' },
          { label: 'Vehiculares',   value: vehCount,           icon: 'alert',    tone: 'red'    },
        ]
      : [];

  // Escalas dinámicas para los gráficos
  const rawBarMax  = Math.max(...monthlyPayments.map(p => p.value), 1000);
  const barMax     = Math.ceil(rawBarMax / 1000) * 1000;
  const gridStep   = barMax / 4;
  const gridValues = [0, gridStep, gridStep * 2, gridStep * 3, barMax].map(Math.round);

  const rawLineMax      = Math.max(...visitsByDay.map(v => v.value), 5);
  const lineMax         = Math.ceil(rawLineMax / 5) * 5 || 5;
  const visitGridStep   = lineMax / 4;
  const visitGridValues = [0, visitGridStep, visitGridStep * 2, visitGridStep * 3, lineMax].map(Math.round);

  const pedestrianIncome = incomeType.find((item) => item.label.toLowerCase().includes("peatonal")) || { label: "Peatonal", value: 0 };
  const vehicularIncome  = incomeType.find((item) => item.label.toLowerCase().includes("vehicular")) || { label: "Vehicular", value: 0 };
  const totalIncomeValue = (pedestrianIncome.value || 0) + (vehicularIncome.value || 0);
  const hasIncomeData    = totalIncomeValue > 0;
  const pedestrianPercent = hasIncomeData ? Math.round(((pedestrianIncome.value || 0) / totalIncomeValue) * 100) : 0;
  const vehicularPercent  = hasIncomeData ? 100 - pedestrianPercent : 0;

  const pieStartAngle = 0;
  const piePedestrianEnd = pieStartAngle + (pedestrianPercent / 100) * 360;
  const pieEndAngle = pieStartAngle + 360;
  const pedestrianSectorPath = describeSector(75, 75, 74, pieStartAngle, piePedestrianEnd);
  const vehicularSectorPath = describeSector(75, 75, 74, piePedestrianEnd, pieEndAngle);

  const visitPoints = visitsByDay.map((item, index) => {
    const x = chartLeft + (index / Math.max(visitsByDay.length - 1, 1)) * chartWidth;
    const y = chartTop + chartHeight - (item.value / lineMax) * chartHeight;
    return { x, y, label: item.label };
  });

  const visitPath = visitPoints.map((point) => `${point.x},${point.y}`).join(" ");

  const recentVisits = historialVisitasData.slice(0, 8).map(v => ({
    name:     v.visitante || v.visitorName || "—",
    property: v.propiedad || v.unit || "—",
    type:     (v.placa && v.placa !== "-") ? "vehicular" : "peatonal",
    inTime:   v.entrada || v.timestamp || "—",
    outTime:  v.salida  || "—",
    fecha:    v.fecha   || "—",
    guard:    v.guard   || "—",
  }));

  return (
    <>
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Resumen general del condominio segun el usuario autenticado.</p>
      </header>

      <section className="dashboard-kpi-grid">
        {kpis.map((kpi) => (
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

      {user.role === 'Seguridad' && (() => {
        const activePanicAlerts = panicAlerts.filter((a) => a.status !== 'Atendida').slice(0, 3);
        return (
          <section className="panic-security-panel dashboard-panic-widget">
            <h2>🚨 Alertas de Pánico Activas</h2>
            <p>Personas que activaron el botón de pánico y requieren asistencia inmediata.</p>
            {activePanicAlerts.length === 0 ? (
              <div className="panic-empty">No hay alertas activas en este momento.</div>
            ) : (
              <div className="panic-alert-list">
                {activePanicAlerts.map((alert) => (
                  <article key={alert.id} className="panic-alert-item">
                    <div>
                      <strong>{alert.resident}</strong>
                      <p>{alert.address} - {alert.unit}</p>
                      <small>Tel: {alert.phone} · {alert.createdAt}</small>
                    </div>
                    <span className={`panic-alert-status panic-alert-status-${alert.status === "Pendiente" ? "pending" : "way"}`}>{alert.status}</span>
                  </article>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-secondary dashboard-panic-widget-link" onClick={() => setActiveSection?.("Botón de Pánico")}>
              Ver todas las alertas →
            </button>
          </section>
        );
      })()}

      <section className="dashboard-grid">
        {user.role !== 'Seguridad' && (
          <article className="dashboard-panel">
            <h2>Pagos Mensuales</h2>
            {monthlyPayments.every(p => (p.value || 0) === 0) && (
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted,#94a3b8)", marginBottom: "0.5rem" }}>Sin pagos registrados aún</p>
            )}
            <div className="chart-wrap" role="img" aria-label="Pagos mensuales del usuario">
              <svg viewBox="0 0 620 260" className="chart-svg" aria-hidden="true">
                {gridValues.map((gridValue, index) => {
                  const y = chartTop + chartHeight - (gridValue / barMax) * chartHeight;
                  return (
                    <g key={`bar-grid-${gridValue}`}>
                      <line x1={chartLeft} y1={y} x2={chartLeft + chartWidth} y2={y} className="chart-grid-line" />
                      <text x={chartLeft - 8} y={y + 4} className="chart-axis-label chart-axis-label-y">{gridValue}</text>
                      {index === 0 && <line x1={chartLeft} y1={y} x2={chartLeft + chartWidth} y2={y} className="chart-axis-base" />}
                    </g>
                  );
                })}

                {monthlyPayments.map((item, index) => {
                  const x = barBaseX + index * (barWidth + barGap);
                  const height = (item.value / barMax) * chartHeight;
                  const y = chartTop + chartHeight - height;
                  return (
                    <g key={item.label}>
                      <rect x={x} y={y} width={barWidth} height={Math.max(height, 1)} className="bar-rect" />
                      <text x={x + barWidth / 2} y={chartTop + chartHeight + 18} className="chart-axis-label chart-axis-label-x">{item.label}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </article>
        )}

        <article className="dashboard-panel">
          <h2>Visitas por Dia</h2>
          {visitsByDay.every(v => (v.value || 0) === 0) && (
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted,#94a3b8)", marginBottom: "0.5rem" }}>Sin visitas registradas aún</p>
          )}
          <div className="chart-wrap" role="img" aria-label="Visitas por dia del usuario">
            <svg viewBox="0 0 620 260" className="chart-svg" aria-hidden="true">
              {visitGridValues.map((gridValue) => {
                const y = chartTop + chartHeight - (gridValue / lineMax) * chartHeight;
                return (
                  <g key={`visit-grid-${gridValue}`}>
                    <line x1={chartLeft} y1={y} x2={chartLeft + chartWidth} y2={y} className="chart-grid-line" />
                    <text x={chartLeft - 8} y={y + 4} className="chart-axis-label chart-axis-label-y">{gridValue}</text>
                  </g>
                );
              })}

              {visitsByDay.map((item, index) => {
                const x = chartLeft + (index / Math.max(visitsByDay.length - 1, 1)) * chartWidth;
                return (
                  <line key={`visit-col-${item.label}`} x1={x} y1={chartTop} x2={x} y2={chartTop + chartHeight} className="chart-grid-line chart-grid-vertical" />
                );
              })}

              <polyline points={visitPath} className="line-plot" />
              {visitPoints.map((point, index) => (
                <circle key={`visit-point-${point.label}`} cx={point.x} cy={point.y} r={3.2} className="line-point" />
              ))}

              {visitPoints.map((point) => (
                <text key={`visit-label-${point.label}`} x={point.x} y={chartTop + chartHeight + 18} className="chart-axis-label chart-axis-label-x" textAnchor="middle">{point.label}</text>
              ))}

              <line x1={chartLeft} y1={chartTop + chartHeight} x2={chartLeft + chartWidth} y2={chartTop + chartHeight} className="chart-axis-base" />
            </svg>
          </div>
        </article>

        <article className="dashboard-panel">
          <h2>Tipo de Ingreso</h2>
          {!hasIncomeData ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "0.5rem", padding: "1.5rem 0", color: "var(--text-muted, #94a3b8)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ width: 36, height: 36, opacity: 0.4 }}>
                <circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>
              </svg>
              <span style={{ fontSize: "0.82rem" }}>Sin registros de visitas aún</span>
            </div>
          ) : (
            <div className="dashboard-income-wrap">
              <p className="income-label income-label-top">{pedestrianIncome.label} {pedestrianPercent}%</p>
              <div className="income-svg-container">
                <svg viewBox="0 0 150 150" className="income-pie-svg" aria-label="Distribucion de tipo de ingreso">
                  <path
                    className="income-sector income-sector-walk"
                    d={pedestrianSectorPath}
                    onMouseEnter={() => setHoveredSector({ label: pedestrianIncome.label, value: pedestrianIncome.value })}
                    onMouseLeave={() => setHoveredSector(null)}
                  />
                  <path
                    className="income-sector income-sector-vehicle"
                    d={vehicularSectorPath}
                    onMouseEnter={() => setHoveredSector({ label: vehicularIncome.label, value: vehicularIncome.value })}
                    onMouseLeave={() => setHoveredSector(null)}
                  />
                  <circle cx="75" cy="75" r="1.2" fill="#ffffff" />
                </svg>
                {hoveredSector && (
                  <div className="income-tooltip">
                    <strong>{hoveredSector.label}</strong>
                    <span>{hoveredSector.value}</span>
                  </div>
                )}
              </div>
              <p className="income-label income-label-bottom">{vehicularIncome.label} {vehicularPercent}%</p>
            </div>
          )}
        </article>

        {user.role !== 'Seguridad' && (
          <article className="dashboard-panel">
            <div className="panel-header-with-actions">
              <h2>Lista de Morosos</h2>
              <div className="export-btn-group export-btn-group-sm">
                <button type="button" className="export-btn export-btn-excel" onClick={() => handleExportMorosos("excel")} title="Exportar a Excel">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  Excel
                </button>
                <button type="button" className="export-btn export-btn-pdf" onClick={() => handleExportMorosos("pdf")} title="Exportar a PDF">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  PDF
                </button>
              </div>
            </div>
            <div className="debtor-list">
              {debtors.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted,#94a3b8)", padding: "0.5rem 0" }}>Sin morosos registrados</p>
              ) : debtors.map((debtor) => (
                <div className="debtor-item" key={debtor.property}>
                  <div>
                    <strong>{debtor.property}</strong>
                    <p>{debtor.block}</p>
                  </div>
                  <span>
                    {debtor.debt}
                    <small>en mora</small>
                  </span>
                </div>
              ))}
            </div>
          </article>
        )}
      </section>

      <section className="dashboard-panel recent-visits-panel">
        <div className="panel-header-with-actions">
          <h2>Visitas Recientes</h2>
          {recentVisits.length > 0 && (
            <span className="recent-visits-count">{recentVisits.length} último{recentVisits.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        {recentVisits.length === 0 ? (
          <div className="recent-visits-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M16 8C17.7 8 19 6.7 19 5C19 3.3 17.7 2 16 2C14.3 2 13 3.3 13 5C13 6.7 14.3 8 16 8ZM8 10C9.7 10 11 8.7 11 7C11 5.3 9.7 4 8 4C6.3 4 5 5.3 5 7C5 8.7 6.3 10 8 10ZM4 20V18.8C4 16.7 5.8 15 8 15H10C12.2 15 14 16.7 14 18.8V20M13 20V18.7C13 17.5 12.5 16.4 11.7 15.6C12.3 15.2 13 15 13.8 15H16.2C18.4 15 20 16.6 20 18.8V20" />
            </svg>
            <p>Sin visitas registradas aún</p>
          </div>
        ) : (
          <div className="recent-visits-wrap">
            <table className="recent-visits-table">
              <thead>
                <tr>
                  <th>Visitante</th>
                  <th>Propiedad</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                </tr>
              </thead>
              <tbody>
                {recentVisits.map((visit, index) => (
                  <tr key={`${visit.name}-${index}`}>
                    <td>{visit.name}</td>
                    <td>{visit.property}</td>
                    <td>
                      <span className={`visit-type-chip ${visit.type === "vehicular" ? "visit-type-vehicle" : "visit-type-walk"}`}>
                        {visit.type}
                      </span>
                    </td>
                    <td>{visit.fecha}</td>
                    <td>{visit.inTime}</td>
                    <td className={visit.outTime === "—" || visit.outTime === "-" ? "visit-pending" : ""}>{visit.outTime === "-" ? "En curso" : visit.outTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
