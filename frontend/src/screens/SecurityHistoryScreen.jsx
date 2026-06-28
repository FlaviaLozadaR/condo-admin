import { useState } from "react";
import * as api from "../api.js";
import Pagination from "../components/Pagination.jsx";

const DOC_TYPES = [
  { type: "front", label: "Carnet (frente)", flag: "hasIdDocumentFront" },
  { type: "back",  label: "Carnet (dorso)",  flag: "hasIdDocumentBack" },
  { type: "plate", label: "Foto de placa",   flag: "hasPlatePhoto", vehicularOnly: true },
];

const MESES_LARGOS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const PAGE_SIZE = 15;

export default function SecurityHistoryScreen({ visitPasses, setVisitPasses, historialVisitasData = [], onToast }) {
  const [busyKey, setBusyKey] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingVisitaId, setDeletingVisitaId] = useState(null);
  const [deletingVisitaBusy, setDeletingVisitaBusy] = useState(false);
  const [historyMonthFilter, setHistoryMonthFilter] = useState("todos");
  const [historyMonthDropdownOpen, setHistoryMonthDropdownOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);

  const confirmDeleteVisita = async () => {
    if (!deletingVisitaId) return;
    setDeletingVisitaBusy(true);
    try {
      await api.deleteVisita(String(deletingVisitaId));
      setVisitPasses((prev) => prev.filter((v) => v.id !== deletingVisitaId));
      onToast?.("Pase eliminado.", "success");
    } catch (err) {
      onToast?.(err.message || "No se pudo eliminar el pase.", "error");
    } finally {
      setDeletingVisitaBusy(false);
      setDeletingVisitaId(null);
    }
  };

  // Empareja cada pase con su registro de historial por la relación directa
  // (visitaId) que queda guardada al crear el historial — ya no se adivina
  // por nombre+cédula, que se rompía con duplicados o registros fuera de orden.
  const historialByPassId = (() => {
    const map = new Map();
    const sinEnlace = [];
    historialVisitasData.forEach((h) => {
      if (h.visitaId) map.set(h.visitaId, h);
      else sinEnlace.push(h);
    });

    // Plan B para historial de antes de tener esta relación directa: adivinar
    // por nombre+cédula y orden de creación, solo para lo que quedó sin enlazar.
    if (sinEnlace.length) {
      const groups = new Map();
      [...sinEnlace]
        .sort((a, b) => new Date(a.insertedAt) - new Date(b.insertedAt))
        .forEach((h) => {
          const key = `${h.visitante}|${h.cedula}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(h);
        });

      [...visitPasses]
        .filter((p) => !map.has(p.id))
        .sort((a, b) => new Date(a.insertedAt) - new Date(b.insertedAt))
        .forEach((p) => {
          const key = `${p.fullName}|${p.idNumber}`;
          const list = groups.get(key);
          if (list?.length) map.set(p.id, list.shift());
        });
    }

    return map;
  })();

  const handleView = async (id, type) => {
    const key = `${id}-${type}-view`;
    setBusyKey(key);
    try {
      const { url } = await api.getVisitaDocumentUrl(id, type);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      onToast?.(err.message || "No se pudo abrir el documento.", "error");
    } finally {
      setBusyKey(null);
    }
  };

  const handleDelete = async (id, type, flag) => {
    const key = `${id}-${type}-delete`;
    setBusyKey(key);
    try {
      await api.deleteVisitaDocument(id, type);
      setVisitPasses(visitPasses.map((v) => (v.id === id ? { ...v, [flag]: false } : v)));
      onToast?.("Documento eliminado.", "success");
    } catch (err) {
      onToast?.(err.message || "No se pudo eliminar el documento.", "error");
    } finally {
      setBusyKey(null);
    }
  };

  const closeDetail = () => {
    setDetailItem(null);
    setEditForm(null);
  };

  const startEdit = (item) => {
    setEditForm({
      fullName: item.fullName || "",
      idNumber: item.idNumber || "",
      property: item.property || "",
      motive:   item.motive   || "",
      mode:     item.mode === "vehicular" ? "vehicular" : "peatonal",
      plate:    item.plate && item.plate !== "-" ? item.plate : "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.fullName.trim() || !editForm.idNumber.trim() || !editForm.property.trim() || !editForm.motive.trim()) {
      onToast?.("Completá todos los campos requeridos.", "error");
      return;
    }
    if (editForm.mode === "vehicular" && !editForm.plate.trim()) {
      onToast?.("La placa es requerida para modalidad vehicular.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        fullName: editForm.fullName.trim(),
        idNumber: editForm.idNumber.trim(),
        property: editForm.property.trim(),
        motive:   editForm.motive.trim(),
        mode:     editForm.mode,
        plate:    editForm.mode === "vehicular" ? editForm.plate.trim() : "-",
      };
      const updated = await api.updateVisita(detailItem.id, payload);
      setVisitPasses((prev) => prev.map((v) => (v.id === detailItem.id ? { ...v, ...updated } : v)));
      setDetailItem((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditForm(null);
      onToast?.("Datos del visitante actualizados.", "success");
    } catch (err) {
      onToast?.(err.message || "No se pudo guardar los cambios.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Meses disponibles para filtrar, según la fecha real de registro de cada pase.
  const monthOptions = (() => {
    const map = new Map();
    visitPasses.forEach((p) => {
      const d = new Date(p.insertedAt);
      if (isNaN(d)) return;
      const key = monthKey(d);
      if (!map.has(key)) map.set(key, { key, year: d.getFullYear(), month: d.getMonth(), label: `${MESES_LARGOS[d.getMonth()]} ${d.getFullYear()}` });
    });
    return Array.from(map.values()).sort((a, b) => (b.year - a.year) || (b.month - a.month));
  })();

  const filteredVisitPasses = (historyMonthFilter === "todos"
    ? visitPasses
    : visitPasses.filter((p) => {
        const d = new Date(p.insertedAt);
        return !isNaN(d) && monthKey(d) === historyMonthFilter;
      })
  ).slice().sort((a, b) => new Date(b.insertedAt) - new Date(a.insertedAt));

  const historyTotalPages = Math.max(1, Math.ceil(filteredVisitPasses.length / PAGE_SIZE));
  const pagedVisitPasses = filteredVisitPasses.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE);

  const selectedHistoryMonthLabel = historyMonthFilter === "todos"
    ? "Todos los meses"
    : (monthOptions.find((m) => m.key === historyMonthFilter)?.label || "Todos los meses");

  return (
    <>
      <header className="dashboard-header visit-header">
        <div>
          <h1>Historial</h1>
          <p>Registro histórico de ingresos validados por seguridad</p>
        </div>
      </header>

      <section className="visit-security-card visit-history-card">
        <div className="management-condo-field panic-month-field" style={{maxWidth:260,marginBottom:'1rem'}}>
          <label>Período</label>
          <div className="condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHistoryMonthDropdownOpen(false); }} tabIndex={-1}>
            <button
              type="button"
              className="condo-dropdown-trigger"
              onClick={() => setHistoryMonthDropdownOpen((o) => !o)}
              aria-expanded={historyMonthDropdownOpen}
            >
              <span className="condo-dropdown-value">{selectedHistoryMonthLabel}</span>
              <svg className={`condo-dropdown-chevron${historyMonthDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {historyMonthDropdownOpen && (
              <ul className="condo-dropdown-list" role="listbox">
                <li
                  role="option"
                  aria-selected={historyMonthFilter === "todos"}
                  className={`condo-dropdown-item${historyMonthFilter === "todos" ? " selected" : ""}`}
                  onMouseDown={() => { setHistoryMonthFilter("todos"); setHistoryPage(1); setHistoryMonthDropdownOpen(false); }}
                >
                  Todos los meses
                </li>
                {monthOptions.map((opt) => (
                  <li
                    key={opt.key}
                    role="option"
                    aria-selected={historyMonthFilter === opt.key}
                    className={`condo-dropdown-item${historyMonthFilter === opt.key ? " selected" : ""}`}
                    onMouseDown={() => { setHistoryMonthFilter(opt.key); setHistoryPage(1); setHistoryMonthDropdownOpen(false); }}
                  >
                    {opt.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="visit-history-table-wrap">
          <table className="visit-history-table">
            <thead>
              <tr>
                <th>Visitante</th>
                <th>Cédula</th>
                <th>Propiedad</th>
                <th>Tipo</th>
                <th>Placa</th>
                <th>Estado</th>
                <th>Ingreso</th>
                <th>Salida</th>
                {DOC_TYPES.map((doc) => (
                  <th key={doc.type}>{doc.label}</th>
                ))}
                <th>Detalle</th>
                <th>Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {pagedVisitPasses.map((item) => {
                const historial = historialByPassId.get(item.id);
                return (
                <tr key={item.id}>
                  <td>{item.fullName}</td>
                  <td>{item.idNumber}</td>
                  <td>{item.property}</td>
                  <td>{item.mode === "vehicular" ? "Vehicular" : "Peatonal"}</td>
                  <td>{item.plate}</td>
                  <td>{item.status}</td>
                  <td>{historial?.entrada || "-"}</td>
                  <td>
                    {!historial ? "-" : (!historial.salida || historial.salida === "-") ? (
                      <span className="badge-dentro">Dentro</span>
                    ) : historial.salida}
                  </td>
                  {DOC_TYPES.map((doc) => {
                    if (doc.vehicularOnly && item.mode !== "vehicular") {
                      return <td key={doc.type}><span className="visit-doc-empty">—</span></td>;
                    }
                    if (!item[doc.flag]) {
                      return <td key={doc.type}><span className="visit-doc-empty">—</span></td>;
                    }
                    const viewBusy = busyKey === `${item.id}-${doc.type}-view`;
                    const deleteBusy = busyKey === `${item.id}-${doc.type}-delete`;
                    return (
                      <td key={doc.type}>
                        <div className="visit-doc-actions">
                          <button
                            type="button"
                            className="visit-doc-btn"
                            disabled={viewBusy || deleteBusy}
                            onClick={() => handleView(item.id, doc.type)}
                            title={`Ver ${doc.label.toLowerCase()}`}
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            className="visit-doc-btn visit-doc-btn-danger"
                            disabled={viewBusy || deleteBusy}
                            onClick={() => handleDelete(item.id, doc.type, doc.flag)}
                            title={`Eliminar ${doc.label.toLowerCase()}`}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    );
                  })}
                  <td>
                    <button
                      type="button"
                      className="visit-doc-btn"
                      onClick={() => setDetailItem(item)}
                      title="Ver detalle del visitante"
                    >
                      Ver detalle
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="visit-doc-btn visit-doc-btn-danger"
                      onClick={() => setDeletingVisitaId(item.id)}
                      title="Eliminar este pase"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {pagedVisitPasses.length === 0 && (
            <p style={{textAlign:'center',color:'#9ca3af',padding:'1.2rem 0'}}>No hay registros para ese período.</p>
          )}
        </div>
        <Pagination page={historyPage} totalPages={historyTotalPages} onPageChange={setHistoryPage} />
      </section>

      {detailItem && (
        <div className="modal-overlay" onClick={closeDetail}>
          <div className="modal-content modal-edit-user" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
            <h2>{editForm ? "Editar Visitante" : "Detalle del Visitante"}</h2>

            <div className="modal-body-simple">
              {!editForm ? (
                <div className="visit-data-grid">
                  <div><span>Visitante</span><strong>{detailItem.fullName}</strong></div>
                  <div><span>Cédula</span><strong>{detailItem.idNumber}</strong></div>
                  <div><span>Propiedad</span><strong>{detailItem.property}</strong></div>
                  <div><span>Motivo</span><strong>{detailItem.motive}</strong></div>
                  <div><span>Modalidad</span><strong>{detailItem.mode === "vehicular" ? "Vehicular" : "Peatonal"}</strong></div>
                  {detailItem.mode === "vehicular" && <div><span>Placa</span><strong>{detailItem.plate}</strong></div>}
                  <div><span>Estado</span><strong>{detailItem.status}</strong></div>
                  <div><span>Registrado por</span><strong>{detailItem.createdBy}</strong></div>
                  <div><span>Fecha de registro</span><strong>{detailItem.createdAt}</strong></div>
                  <div><span>Ingreso</span><strong>{historialByPassId.get(detailItem.id)?.entrada || "-"}</strong></div>
                  <div>
                    <span>Salida</span>
                    <strong>
                      {(() => {
                        const h = historialByPassId.get(detailItem.id);
                        if (!h) return "-";
                        return (!h.salida || h.salida === "-") ? "Dentro" : h.salida;
                      })()}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="visit-form-grid">
                  <label className="visit-form-field">
                    <span>Nombre Completo *</span>
                    <input type="text" value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
                  </label>
                  <label className="visit-form-field">
                    <span>Cédula *</span>
                    <input type="text" value={editForm.idNumber} onChange={(e) => setEditForm({ ...editForm, idNumber: e.target.value })} />
                  </label>
                  <label className="visit-form-field">
                    <span>Propiedad *</span>
                    <input type="text" value={editForm.property} onChange={(e) => setEditForm({ ...editForm, property: e.target.value })} />
                  </label>
                  <label className="visit-form-field">
                    <span>Motivo *</span>
                    <input type="text" value={editForm.motive} onChange={(e) => setEditForm({ ...editForm, motive: e.target.value })} />
                  </label>
                  <div className="visit-form-field visit-form-full">
                    <span>Modalidad</span>
                    <div className="visit-mode-toggle">
                      <button type="button" className={`visit-mode-btn${editForm.mode === "peatonal" ? " visit-mode-btn-active" : ""}`} onClick={() => setEditForm({ ...editForm, mode: "peatonal" })}>Peatonal</button>
                      <button type="button" className={`visit-mode-btn${editForm.mode === "vehicular" ? " visit-mode-btn-active" : ""}`} onClick={() => setEditForm({ ...editForm, mode: "vehicular" })}>Vehicular</button>
                    </div>
                  </div>
                  {editForm.mode === "vehicular" && (
                    <label className="visit-form-field visit-form-full">
                      <span>Placa *</span>
                      <input type="text" value={editForm.plate} onChange={(e) => setEditForm({ ...editForm, plate: e.target.value })} />
                    </label>
                  )}
                </div>
              )}
            </div>

            <footer className="modal-footer-simple">
              {!editForm ? (
                <>
                  <button className="btn btn-secondary" type="button" onClick={closeDetail}>Cerrar</button>
                  <button className="btn btn-primary" type="button" onClick={() => startEdit(detailItem)}>Editar</button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary" type="button" disabled={saving} onClick={() => setEditForm(null)}>Cancelar</button>
                  <button className="btn btn-primary" type="button" disabled={saving} onClick={handleSaveEdit}>
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                </>
              )}
            </footer>
          </div>
        </div>
      )}

      {deletingVisitaId && (
        <div className="modal-overlay modal-overlay-centered" onClick={() => !deletingVisitaBusy && setDeletingVisitaId(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-icon confirm-modal-icon-danger" aria-hidden="true">!</div>
            <h2>¿Eliminar este pase?</h2>
            <p>Esta acción no se puede deshacer — también se borran sus fotos de documento, si tiene.</p>
            <div className="confirm-modal-actions">
              <button type="button" className="confirm-modal-cancel" disabled={deletingVisitaBusy} onClick={() => setDeletingVisitaId(null)}>Cancelar</button>
              <button type="button" className="confirm-modal-accept confirm-modal-accept-danger" disabled={deletingVisitaBusy} onClick={confirmDeleteVisita}>
                {deletingVisitaBusy ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
