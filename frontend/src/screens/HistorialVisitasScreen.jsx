import { useEffect, useState } from "react";
import * as api from "../api.js";
import Pagination from "../components/Pagination.jsx";
import { parseFecha } from "./dashboardUtils.js";

const PAGE_SIZE = 20;
const MESES_LARGOS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function HistorialVisitasScreen({ user, isSuperAdministrator, condominiosData, propiedadesData, historialVisitasData, onToast, exportToPDF }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [condoFilter, setCondoFilter] = useState("todos");
  const [condoDropdownOpen, setCondoDropdownOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState({ data: [], total: 0, totalPeatonales: 0, totalVehiculares: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [exportMonthsFilter, setExportMonthsFilter] = useState(new Set());
  const [exportMonthsDropdownOpen, setExportMonthsDropdownOpen] = useState(false);
  const [deletingHistorialId, setDeletingHistorialId] = useState(null);
  const canDeleteHistorial = ["Super Admin", "Administrador", "Seguridad"].includes(user.role);

  const confirmDeleteHistorial = async () => {
    if (!deletingHistorialId) return;
    try {
      await api.deleteHistorialVisita(String(deletingHistorialId));
      setPageData((prev) => ({
        ...prev,
        data: prev.data.filter((h) => h.id !== deletingHistorialId),
        total: Math.max(0, prev.total - 1),
      }));
      onToast?.("Registro eliminado.", "success");
    } catch (err) {
      onToast?.(err.message || "No se pudo eliminar el registro.", "error");
    } finally {
      setDeletingHistorialId(null);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter, condoFilter]);

  const selectedCondoName = (user.role === "Administrador" || user.role === "Seguridad")
    ? (user.condo || "")
    : condoFilter === "todos"
      ? ""
      : (condominiosData.find((condo) => String(condo.id) === condoFilter)?.name || "");

  useEffect(() => {
    setLoading(true);
    api.getHistorialVisitasPaged({
      page,
      limit: PAGE_SIZE,
      tipo: typeFilter,
      q: debouncedSearch,
      condo: selectedCondoName,
    })
      .then(setPageData)
      .catch((err) => onToast?.(err.message, "error"))
      .finally(() => setLoading(false));
  }, [page, typeFilter, debouncedSearch, selectedCondoName]);

  // Meses disponibles para exportar — derivados de las fechas reales de las visitas,
  // desde la primera registrada hasta la más reciente.
  const exportMonthOptions = (() => {
    const map = new Map();
    historialVisitasData.forEach((r) => {
      const d = parseFecha(r.fecha);
      if (!d || isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, { key, year: d.getFullYear(), month: d.getMonth(), label: `${MESES_LARGOS[d.getMonth()]} ${d.getFullYear()}` });
    });
    return Array.from(map.values()).sort((a, b) => (b.year - a.year) || (b.month - a.month));
  })();

  const toggleExportMonth = (key) => {
    setExportMonthsFilter((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  const toggleAllExportMonths = () => {
    setExportMonthsFilter((prev) =>
      prev.size === exportMonthOptions.length ? new Set() : new Set(exportMonthOptions.map((o) => o.key))
    );
  };

  const condoByPropLabel = new Map((propiedadesData || []).map((p) => [`${p.street} - ${p.code}`, p.condo]));
  const resolveCondoDeVisita = (r) => condoByPropLabel.get(r.propiedad) || "";

  const fmtRegistrado = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return `${d.toLocaleDateString("es-AR")} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const handleExportHistorial = async (format) => {
    const query = searchTerm.toLowerCase().trim();
    const toExport = historialVisitasData.filter((item) => {
      const matchesQuery =
        !query ||
        item.visitante.toLowerCase().includes(query) ||
        item.cedula.toLowerCase().includes(query) ||
        item.placa.toLowerCase().includes(query);
      const matchesType = typeFilter === "todos" || item.tipo === typeFilter;
      const matchesCondo = !selectedCondoName || (item.condo || resolveCondoDeVisita(item)) === selectedCondoName;
      const matchesMonth = exportMonthsFilter.size === 0 || (() => {
        const d = parseFecha(item.fecha);
        if (!d || isNaN(d)) return false;
        return exportMonthsFilter.has(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      })();
      return matchesQuery && matchesType && matchesCondo && matchesMonth;
    }).sort((a, b) => (parseFecha(a.fecha) || 0) - (parseFecha(b.fecha) || 0));

    if (toExport.length === 0) {
      onToast?.("No hay registros para exportar con los filtros seleccionados.", "warning");
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    const periodoLabel = exportMonthsFilter.size === 0
      ? "Todos los periodos"
      : `Periodo: ${exportMonthOptions.filter((o) => exportMonthsFilter.has(o.key)).map((o) => o.label).join(", ")}`;

    const peatonales  = toExport.filter((r) => !(r.placa && r.placa !== "-"));
    const vehiculares = toExport.filter((r) => r.placa && r.placa !== "-");

    if (format === "excel") {
      // xlsx se carga bajo demanda: pesa ~400KB y solo se necesita al exportar
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(toExport.map(r => ({
        Condominio: resolveCondoDeVisita(r) || "—",
        Visitante:  r.visitante || "",
        Cédula:     r.cedula   || "",
        Propiedad:  r.propiedad || "",
        Tipo:       (r.placa && r.placa !== "-") ? "Vehicular" : "Peatonal",
        Placa:      r.placa    || "-",
        Fecha:      r.fecha    || "",
        Entrada:    r.entrada  || "",
        Salida:     r.salida   || "-",
        Motivo:     r.motivo   || r.method || "",
        Guardia:    r.guard    || "",
        "Registrado el": fmtRegistrado(r.insertedAt),
      })));
      ws["!cols"] = [
        { wch: 22 }, { wch: 24 }, { wch: 14 }, { wch: 28 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 18 }, { wch: 18 },
      ];

      // Resumen por mes — cantidad de visitas peatonales/vehiculares de cada periodo
      const resumenPorMes = new Map();
      toExport.forEach((r) => {
        const d   = parseFecha(r.fecha);
        const key = d && !isNaN(d) ? `${MESES_LARGOS[d.getMonth()]} ${d.getFullYear()}` : "Sin fecha";
        if (!resumenPorMes.has(key)) resumenPorMes.set(key, { mes: key, total: 0, peatonales: 0, vehiculares: 0 });
        const r2 = resumenPorMes.get(key);
        r2.total++;
        (r.placa && r.placa !== "-") ? r2.vehiculares++ : r2.peatonales++;
      });
      const wsResumen = XLSX.utils.json_to_sheet([
        ...Array.from(resumenPorMes.values()).map((r) => ({
          Mes: r.mes,
          "Total visitas": r.total,
          Peatonales: r.peatonales,
          Vehiculares: r.vehiculares,
        })),
        { Mes: "TOTAL", "Total visitas": toExport.length, Peatonales: peatonales.length, Vehiculares: vehiculares.length },
      ]);
      wsResumen["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Historial");
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
      XLSX.writeFile(wb, `historial_visitas_${date}.xlsx`);
      onToast?.(`${toExport.length} registros exportados a Excel.`, "success");
    } else {
      exportToPDF({
        title:    "Historial de Visitas",
        subtitle: `Generado el ${new Date().toLocaleDateString("es-AR")} · ${toExport.length} registros · ${periodoLabel}`,
        headers:  ["Condominio", "Visitante", "Cédula", "Propiedad", "Tipo", "Placa", "Fecha", "Entrada", "Salida", "Motivo", "Guardia", "Registrado el"],
        rows:     toExport.map(r => [
          resolveCondoDeVisita(r) || "—",
          r.visitante  || "",
          r.cedula     || "",
          r.propiedad  || "",
          (r.placa && r.placa !== "-") ? "Vehicular" : "Peatonal",
          r.placa      || "-",
          r.fecha      || "",
          r.entrada    || "",
          r.salida     || "-",
          r.motivo     || r.method || "",
          r.guard      || "",
          fmtRegistrado(r.insertedAt),
        ]),
      });
    }
  };

  return (
    <>
      <header className="dashboard-header historial-header">
        <div>
          <h1>Historial de Visitas</h1>
          <p>Registro completo de entradas y salidas</p>
        </div>
        <div className="export-actions-wrap">
          <div className="management-condo-field export-months-field">
            <label>Período a exportar</label>
            <div className="condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setExportMonthsDropdownOpen(false); }} tabIndex={-1}>
              <button
                type="button"
                className="condo-dropdown-trigger"
                onClick={() => setExportMonthsDropdownOpen((o) => !o)}
                aria-expanded={exportMonthsDropdownOpen}
              >
                <span className="condo-dropdown-value">
                  {exportMonthsFilter.size === 0
                    ? "Todos los meses"
                    : `${exportMonthsFilter.size} mes${exportMonthsFilter.size !== 1 ? "es" : ""} seleccionado${exportMonthsFilter.size !== 1 ? "s" : ""}`}
                </span>
                <svg className={`condo-dropdown-chevron${exportMonthsDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {exportMonthsDropdownOpen && (
                <ul className="condo-dropdown-list export-months-list" role="listbox">
                  <li
                    className="condo-dropdown-item export-months-item export-months-item-all"
                    onMouseDown={(e) => { e.preventDefault(); toggleAllExportMonths(); }}
                  >
                    <input type="checkbox" readOnly checked={exportMonthOptions.length > 0 && exportMonthsFilter.size === exportMonthOptions.length} />
                    <span>{exportMonthsFilter.size === exportMonthOptions.length ? "Quitar todos" : "Seleccionar todos"}</span>
                  </li>
                  {exportMonthOptions.length === 0 ? (
                    <li className="export-months-empty">Sin visitas registradas todavía.</li>
                  ) : exportMonthOptions.map((opt) => (
                    <li
                      key={opt.key}
                      role="option"
                      aria-selected={exportMonthsFilter.has(opt.key)}
                      className="condo-dropdown-item export-months-item"
                      onMouseDown={(e) => { e.preventDefault(); toggleExportMonth(opt.key); }}
                    >
                      <input type="checkbox" readOnly checked={exportMonthsFilter.has(opt.key)} />
                      <span>{opt.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="export-btn-group">
            <button type="button" className="export-btn export-btn-excel" onClick={() => handleExportHistorial("excel")} title="Exportar a Excel">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
              </svg>
              Excel
            </button>
            <button type="button" className="export-btn export-btn-pdf" onClick={() => handleExportHistorial("pdf")} title="Exportar a PDF">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="11" y2="17"/>
              </svg>
              PDF
            </button>
          </div>
        </div>
      </header>

      <section className="historial-controls-wrap">
        <div className="historial-search-wrap">
          <svg className="historial-search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 16C13.3 16 16 13.3 16 10C16 6.7 13.3 4 10 4C6.7 4 4 6.7 4 10C4 13.3 6.7 16 10 16ZM18 18L14.3 14.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            type="text"
            className="historial-search-input"
            placeholder="Buscar por nombre, cedula o placa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="historial-filter-wrap">
          <div className="condo-dropdown historial-filter-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setTypeDropdownOpen(false); }} tabIndex={-1}>
            <button
              type="button"
              className="condo-dropdown-trigger historial-filter-trigger"
              onClick={() => setTypeDropdownOpen((open) => !open)}
              aria-expanded={typeDropdownOpen}
            >
              <span className="condo-dropdown-value">
                {typeFilter === "todos" ? "Todos los tipos" : typeFilter === "peatonal" ? "Peatonal" : "Vehicular"}
              </span>
              <svg className={`condo-dropdown-chevron${typeDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {typeDropdownOpen && (
              <ul className="condo-dropdown-list historial-filter-list" role="listbox">
                {[
                  { value: "todos", label: "Todos los tipos" },
                  { value: "peatonal", label: "Peatonal" },
                  { value: "vehicular", label: "Vehicular" }
                ].map((item) => (
                  <li
                    key={item.value}
                    role="option"
                    aria-selected={typeFilter === item.value}
                    className={`condo-dropdown-item${typeFilter === item.value ? " selected" : ""}`}
                    onMouseDown={() => { setTypeFilter(item.value); setTypeDropdownOpen(false); }}
                  >
                    {item.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {isSuperAdministrator && (
          <div className="historial-filter-wrap">
            <div className="condo-dropdown historial-filter-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setCondoDropdownOpen(false); }} tabIndex={-1}>
              <button
                type="button"
                className="condo-dropdown-trigger historial-filter-trigger"
                onClick={() => setCondoDropdownOpen((open) => !open)}
                aria-expanded={condoDropdownOpen}
              >
                <span className="condo-dropdown-value">
                  {condoFilter === "todos"
                    ? "Todos los condominios"
                    : (condominiosData.find((item) => String(item.id) === condoFilter)?.name || "Todos los condominios")}
                </span>
                <svg className={`condo-dropdown-chevron${condoDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {condoDropdownOpen && (
                <ul className="condo-dropdown-list historial-filter-list" role="listbox">
                  <li role="option" aria-selected={condoFilter === "todos"} className={`condo-dropdown-item${condoFilter === "todos" ? " selected" : ""}`} onMouseDown={() => { setCondoFilter("todos"); setCondoDropdownOpen(false); }}>
                    Todos los condominios
                  </li>
                  {condominiosData.map((item) => (
                    <li key={item.id} role="option" aria-selected={condoFilter === String(item.id)} className={`condo-dropdown-item${condoFilter === String(item.id) ? " selected" : ""}`} onMouseDown={() => { setCondoFilter(String(item.id)); setCondoDropdownOpen(false); }}>
                      {item.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {!isSuperAdministrator && (
          <div className="historial-filter-wrap">
            <div className="condo-dropdown-trigger historial-filter-trigger" style={{cursor:'default', background:'#f9fafb'}}>
              <span className="condo-dropdown-value" style={{color:'#374151', fontWeight:600}}>
                {condominiosData.find(c => c.name === user.condo)
                  ? `${condominiosData.find(c => c.name === user.condo).type}: ${user.condo}`
                  : user.condo || '—'}
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="historial-kpi-grid">
        <article className="historial-kpi historial-kpi-total">
          <div className="historial-kpi-head">
            <p>Total Visitas Este Mes</p>
            <span className="historial-kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 8V12L15 14M3 12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
          </div>
          <strong>{pageData.total}</strong>
          <small>visitantes registrados este mes</small>
        </article>

        <article className="historial-kpi historial-kpi-walk">
          <div className="historial-kpi-head">
            <p>Visitas Peatonales</p>
            <span className="historial-kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 5C13.1 5 14 4.1 14 3C14 1.9 13.1 1 12 1C10.9 1 10 1.9 10 3C10 4.1 10.9 5 12 5ZM8 22V14H6V8C6 6.9 6.9 6 8 6H16C17.1 6 18 6.9 18 8V14H16V22H14V15H10V22H8Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
          <strong>{pageData.totalPeatonales}</strong>
          <small>accesos a pie este mes</small>
        </article>

        <article className="historial-kpi historial-kpi-vehicle">
          <div className="historial-kpi-head">
            <p>Visitas Vehiculares</p>
            <span className="historial-kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M3 17H5M19 17H21M6 17H18M7 17L9 10H15L17 17M8 21H16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
          <strong>{pageData.totalVehiculares}</strong>
          <small>accesos vehiculares este mes</small>
        </article>
      </section>

      <section className="historial-table-wrap">
        <table className="historial-table">
          <thead>
            <tr>
              <th>Visitante</th>
              <th>Cedula</th>
              <th>Propiedad</th>
              <th>Tipo</th>
              <th>Placa</th>
              <th>Fecha</th>
              <th>Entrada</th>
              <th>Salida</th>
              <th>Motivo</th>
              {canDeleteHistorial && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={canDeleteHistorial ? 10 : 9}>Cargando...</td></tr>
            ) : pageData.data.length === 0 ? (
              <tr><td colSpan={canDeleteHistorial ? 10 : 9}>No se encontraron registros.</td></tr>
            ) : pageData.data.map((item) => (
              <tr key={item.id}>
                <td>{item.visitante}</td>
                <td>{item.cedula}</td>
                <td>{item.propiedad}</td>
                <td>
                  <span className={`historial-type-chip ${item.tipo === "vehicular" ? "historial-type-vehicle" : "historial-type-walk"}`}>
                    {item.tipo}
                  </span>
                </td>
                <td>{item.placa}</td>
                <td>{item.fecha}</td>
                <td>{item.entrada}</td>
                <td>
                  {(!item.salida || item.salida === '-' || item.salida === '') ? (
                    <span className="badge-dentro">Dentro</span>
                  ) : item.salida}
                </td>
                <td>{item.motivo}</td>
                {canDeleteHistorial && (
                  <td>
                    <button type="button" className="historial-delete-btn" title="Eliminar registro" onClick={() => setDeletingHistorialId(item.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM8 9H16V19H8V9ZM15.5 4L14.5 3H9.5L8.5 4H5V6H19V4H15.5Z"/></svg>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {deletingHistorialId && (
        <div className="modal-overlay modal-overlay-centered" onClick={() => setDeletingHistorialId(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-icon confirm-modal-icon-danger" aria-hidden="true">!</div>
            <h2>¿Eliminar este registro?</h2>
            <p>Esta acción no se puede deshacer — usalo solo si fue un duplicado o un error de registro.</p>
            <div className="confirm-modal-actions">
              <button type="button" className="confirm-modal-cancel" onClick={() => setDeletingHistorialId(null)}>Cancelar</button>
              <button type="button" className="confirm-modal-accept confirm-modal-accept-danger" onClick={confirmDeleteHistorial}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <Pagination page={page} totalPages={pageData.totalPages} onPageChange={setPage} />
    </>
  );
}
