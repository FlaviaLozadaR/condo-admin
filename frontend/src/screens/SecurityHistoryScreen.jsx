import { useState } from "react";
import * as api from "../api.js";

const DOC_TYPES = [
  { type: "front", label: "Carnet (frente)", flag: "hasIdDocumentFront" },
  { type: "back",  label: "Carnet (dorso)",  flag: "hasIdDocumentBack" },
  { type: "plate", label: "Foto de placa",   flag: "hasPlatePhoto", vehicularOnly: true },
];

export default function SecurityHistoryScreen({ visitPasses, setVisitPasses, historialVisitasData = [], onToast }) {
  const [busyKey, setBusyKey] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingVisitaId, setDeletingVisitaId] = useState(null);
  const [deletingVisitaBusy, setDeletingVisitaBusy] = useState(false);

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
    historialVisitasData.forEach((h) => {
      if (h.visitaId) map.set(h.visitaId, h);
    });
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

  return (
    <>
      <header className="dashboard-header visit-header">
        <div>
          <h1>Historial</h1>
          <p>Registro histórico de ingresos validados por seguridad</p>
        </div>
      </header>

      <section className="visit-security-card visit-history-card">
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
              {visitPasses.map((item) => {
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
        </div>
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
