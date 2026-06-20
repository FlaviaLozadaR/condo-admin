import { useEffect, useState } from "react";
import * as api from "../api.js";
import Pagination from "../components/Pagination.jsx";

const PAGE_SIZE = 20;

export default function PropiedadesScreen({
  user,
  isSuperAdministrator,
  condominiosData,
  propiedadesData,
  setPropiedadesData,
  selectedManagementCondoId,
  setSelectedManagementCondoId,
  selectedManagementCondoName,
  setCreatePropertyForm,
  setIsCreatePropertyModalOpen,
  setEditingPropertyForm,
  setIsEditPropertyModalOpen,
  onToast,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState({ data: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [propertyCondoDropdownOpen, setPropertyCondoDropdownOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState(null);

  const condoParam = isSuperAdministrator
    ? (selectedManagementCondoId === 0 ? undefined : selectedManagementCondoName)
    : user.condo;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, condoParam]);

  useEffect(() => {
    setLoading(true);
    api.getPropiedadesPaged({ page, limit: PAGE_SIZE, q: debouncedSearch, condo: condoParam })
      .then(setPageData)
      .catch((err) => onToast?.(err.message, "error"))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, condoParam, propiedadesData]);

  const getPropertyTenants = (propiedad) => {
    if (Array.isArray(propiedad.tenants)) {
      return propiedad.tenants.filter(Boolean);
    }
    if (propiedad.tenant && propiedad.tenant !== "-") {
      return [propiedad.tenant];
    }
    return [];
  };

  const getPropertyTenantsText = (propiedad) => {
    const tenants = getPropertyTenants(propiedad);
    return tenants.length ? tenants.join(", ") : "-";
  };

  const openEditPropertyModal = (propiedad) => {
    const tenants = getPropertyTenants(propiedad);
    setEditingPropertyForm({
      id: propiedad.id,
      calle: propiedad.street,
      numero: propiedad.code,
      bloque: propiedad.block,
      propietario: propiedad.owner,
      inquilinos: tenants.length ? tenants : [""],
      deuda: propiedad.debt
    });
    setIsEditPropertyModalOpen(true);
  };

  const confirmDeleteProperty = async () => {
    if (!propertyToDelete?.id) return;
    const id = propertyToDelete.id;
    try {
      await api.deletePropiedad(String(id));
      setPropiedadesData(propiedadesData.filter(p => String(p.id) !== String(id)));
      onToast?.("Propiedad eliminada.", "success");
    } catch (err) {
      onToast?.(err.message || "Error al eliminar la propiedad.", "error");
    } finally {
      setPropertyToDelete(null);
    }
  };

  return (
    <>
      <header className="dashboard-header dashboard-header-with-actions">
        <div>
          <h1>Gestion de Propiedades</h1>
          <p>Gestiona las propiedades del condominio seleccionado.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => {
          const defaultCondoId = isSuperAdministrator
            ? String(selectedManagementCondoId || "")
            : String(condominiosData.find(c => c.name === user.condo || c.name === selectedManagementCondoName)?.id || selectedManagementCondoId || "");
          setCreatePropertyForm({ calle: "", numero: "", bloque: "", propietario: "", inquilinos: [""], condoId: defaultCondoId });
          setIsCreatePropertyModalOpen(true);
        }}>
          <span>+</span> Crear Propiedad
        </button>
      </header>

      <section className="propiedades-section">
        <div className="management-condo-bar">
          <div className="management-condo-field">
            <label>Condominio / Edificio</label>
            {isSuperAdministrator ? (
              <div className="condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPropertyCondoDropdownOpen(false); }} tabIndex={-1}>
                <button
                  type="button"
                  className="condo-dropdown-trigger"
                  onClick={() => setPropertyCondoDropdownOpen((open) => !open)}
                  aria-expanded={propertyCondoDropdownOpen}
                >
                  <span className="condo-dropdown-value">
                    {(() => {
                      const selectedCondo = condominiosData.find((item) => item.id === selectedManagementCondoId);
                      return selectedCondo ? selectedCondo.name : "Seleccionar condominio";
                    })()}
                  </span>
                  <svg className={`condo-dropdown-chevron${propertyCondoDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {propertyCondoDropdownOpen && (
                  <ul className="condo-dropdown-list" role="listbox">
                    {condominiosData.map((item) => (
                      <li
                        key={item.id}
                        role="option"
                        aria-selected={selectedManagementCondoId === item.id}
                        className={`condo-dropdown-item${selectedManagementCondoId === item.id ? " selected" : ""}`}
                        onMouseDown={() => { setSelectedManagementCondoId(item.id); setPropertyCondoDropdownOpen(false); }}
                      >
                        {item.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="condo-dropdown-trigger" style={{cursor:'default', background:'#f9fafb'}}>
                <span className="condo-dropdown-value" style={{color:'#374151', fontWeight:600}}>
                  {condominiosData.find(c => c.name === user.condo)
                    ? `${condominiosData.find(c => c.name === user.condo).type}: ${user.condo}`
                    : user.condo || '—'}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="propiedades-search-wrap">
          <svg className="propiedades-search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 16C13.3 16 16 13.3 16 10C16 6.7 13.3 4 10 4C6.7 4 4 6.7 4 10C4 13.3 6.7 16 10 16ZM18 18L14.3 14.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por calle o numero..."
            className="propiedades-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="propiedades-grid">
          {loading && pageData.data.length === 0 ? (
            <p>Cargando...</p>
          ) : pageData.data.length === 0 ? (
            <p>No se encontraron propiedades.</p>
          ) : pageData.data.map((propiedad) => (
            <article key={propiedad.id} className="propiedad-card">
              <div className="propiedad-card-header">
                <div className="propiedad-card-title-wrap">
                  <span className="propiedad-card-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M7 3H17V21H7V3ZM10 7H11M13 7H14M10 11H11M13 11H14M10 15H11M13 15H14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </span>
                  <div>
                    <h3>{propiedad.code}</h3>
                    <p>{propiedad.street}</p>
                  </div>
                </div>

                <div className="propiedad-card-actions">
                  <button className="propiedad-edit-btn" type="button" title="Editar propiedad" onClick={() => openEditPropertyModal(propiedad)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button className="propiedad-edit-btn propiedad-delete-btn" type="button" title="Eliminar propiedad" onClick={() => setPropertyToDelete(propiedad)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM8 9H16V19H8V9ZM15.5 4L14.5 3H9.5L8.5 4H5V6H19V4H15.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="propiedad-card-body">
                <div className="propiedad-line-item"><span>Bloque:</span><strong>{propiedad.block}</strong></div>
                <div className="propiedad-line-item"><span>Propietario:</span><strong>{propiedad.owner}</strong></div>
                <div className="propiedad-line-item"><span>Inquilino(s):</span><strong>{getPropertyTenantsText(propiedad)}</strong></div>
              </div>

              {propiedad.debt > 0 && (
                <div className="propiedad-debt">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 9V13M12 17H12.01M4.6 18H19.4C20.7 18 21.5 16.6 20.8 15.5L13.4 4.2C12.8 3.2 11.3 3.2 10.6 4.2L3.2 15.5C2.5 16.6 3.3 18 4.6 18Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Deuda: ${propiedad.debt}</span>
                </div>
              )}
            </article>
          ))}
        </div>

        <Pagination page={page} totalPages={pageData.totalPages} onPageChange={setPage} />
      </section>

      {propertyToDelete && (
        <div className="modal-overlay" onClick={() => setPropertyToDelete(null)}>
          <div className="modal-content" style={{ maxWidth: "420px" }} onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Eliminar propiedad</h2>
              <button className="modal-close" type="button" onClick={() => setPropertyToDelete(null)}>✕</button>
            </header>
            <div className="modal-body-simple" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "1.75rem 1.5rem 0.75rem" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(239,68,68,0.10)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.25rem" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </div>
              <p style={{ margin: "0 0 0.4rem", fontWeight: 700, fontSize: "1.05rem", width: "100%" }}>
                ¿Eliminar la propiedad "{propertyToDelete.street} - {propertyToDelete.code}"?
              </p>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--dash-text-2, #667085)", lineHeight: 1.5, width: "100%" }}>
                Esta acción no se puede deshacer.
              </p>
            </div>
            <footer className="modal-footer">
              <button className="btn btn-secondary" type="button" onClick={() => setPropertyToDelete(null)}>
                Cancelar
              </button>
              <button
                className="btn"
                type="button"
                style={{ background: "#ef4444", color: "#fff", border: "none" }}
                onClick={confirmDeleteProperty}
              >
                Sí, eliminar
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
