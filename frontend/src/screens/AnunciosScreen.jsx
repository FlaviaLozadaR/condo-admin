import { useEffect, useState } from "react";
import * as api from "../api.js";
import Pagination from "../components/Pagination.jsx";

const PAGE_SIZE = 20;

export default function AnunciosScreen({
  user,
  isSuperAdministrator,
  condominiosData,
  anunciosData,
  setAnunciosData,
  setIsCreateAnnouncementModalOpen,
  setEditingAnuncio,
  setIsEditAnuncioModalOpen,
  onToast,
}) {
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState({ data: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [announcementCondoFilter, setAnnouncementCondoFilter] = useState("todos");
  const [announcementCondoDropdownOpen, setAnnouncementCondoDropdownOpen] = useState(false);

  const canManageAnnouncements = ["Super Admin", "Administrador"].includes(user.role);

  const targetLabelMap = {
    todos: "Todos",
    propietarios: "Propietarios",
    inquilinos: "Inquilinos",
    seguridad: "Seguridad"
  };

  const selectedAnnouncementCondoName =
    announcementCondoFilter === "todos"
      ? ""
      : (condominiosData.find((condo) => String(condo.id) === announcementCondoFilter)?.name || "");

  const condoParam = isSuperAdministrator
    ? (selectedAnnouncementCondoName || undefined)
    : user.role === "Administrador" ? user.condo : undefined;

  useEffect(() => {
    setPage(1);
  }, [condoParam]);

  useEffect(() => {
    setLoading(true);
    api.getAnunciosPaged({ page, limit: PAGE_SIZE, condo: condoParam })
      .then(setPageData)
      .catch((err) => onToast?.(err.message, "error"))
      .finally(() => setLoading(false));
  }, [page, condoParam, anunciosData]);

  const handleDeleteAnuncio = async (id) => {
    if (!window.confirm("¿Eliminar este anuncio?")) return;
    try {
      await api.deleteAnuncio(String(id));
      setAnunciosData((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Error eliminando anuncio:", err.message);
    }
  };

  return (
    <>
      <header className="dashboard-header anuncios-header">
        <div>
          <h1>Anuncios</h1>
          <p>{user.role === "Propietario" ? "Mantente informado sobre el condominio" : "Gestiona los anuncios del condominio"}</p>
          {user.role === "Propietario" && <p className="anuncios-owner-subtext">Solo ves los anuncios dirigidos a tu perfil.</p>}
        </div>
        {canManageAnnouncements && (
          <button className="btn btn-primary anuncios-new-btn" type="button" onClick={() => setIsCreateAnnouncementModalOpen(true)}>
            <span>+</span> Nuevo Anuncio
          </button>
        )}
      </header>

      <section className="module-filters-row">
        <div className="management-condo-field anuncios-condo-field">
          <label>Condominio / Edificio</label>
          {isSuperAdministrator ? (
            <div className="condo-dropdown anuncios-condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setAnnouncementCondoDropdownOpen(false); }} tabIndex={-1}>
              <button
                type="button"
                className="condo-dropdown-trigger"
                onClick={() => setAnnouncementCondoDropdownOpen((open) => !open)}
                aria-expanded={announcementCondoDropdownOpen}
              >
                <span className="condo-dropdown-value">
                  {announcementCondoFilter === "todos"
                    ? "Todos los condominios y edificios"
                    : (() => {
                      const selectedCondo = condominiosData.find((item) => String(item.id) === announcementCondoFilter);
                      return selectedCondo ? `${selectedCondo.type}: ${selectedCondo.name}` : "Todos los condominios y edificios";
                    })()}
                </span>
                <svg className={`condo-dropdown-chevron${announcementCondoDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {announcementCondoDropdownOpen && (
                <ul className="condo-dropdown-list anuncios-condo-list" role="listbox">
                  <li
                    role="option"
                    aria-selected={announcementCondoFilter === "todos"}
                    className={`condo-dropdown-item${announcementCondoFilter === "todos" ? " selected" : ""}`}
                    onMouseDown={() => { setAnnouncementCondoFilter("todos"); setAnnouncementCondoDropdownOpen(false); }}
                  >
                    Todos los condominios y edificios
                  </li>
                  {condominiosData.map((item) => (
                    <li
                      key={item.id}
                      role="option"
                      aria-selected={announcementCondoFilter === String(item.id)}
                      className={`condo-dropdown-item${announcementCondoFilter === String(item.id) ? " selected" : ""}`}
                      onMouseDown={() => { setAnnouncementCondoFilter(String(item.id)); setAnnouncementCondoDropdownOpen(false); }}
                    >
                      {item.type}: {item.name}
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
      </section>

      <section className={`anuncios-grid${user.role === "Propietario" ? " anuncios-grid-owner anuncios-grid-profile" : ""}`}>
        {loading ? (
          <p>Cargando...</p>
        ) : pageData.data.length === 0 ? (
          <p>No hay anuncios.</p>
        ) : pageData.data.map((anuncio) => (
          <article key={anuncio.id} className="anuncio-card">
            <div className="anuncio-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22ZM18 16V11C18 7.9 16.4 5.3 13.5 4.3V4C13.5 3.2 12.8 2.5 12 2.5C11.2 2.5 10.5 3.2 10.5 4V4.3C7.6 5.3 6 7.9 6 11V16L4 18V19H20V18L18 16Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <div className="anuncio-content">
              <div className="anuncio-top-row">
                <h3>{anuncio.title}</h3>
                <span className={`anuncio-target-chip anuncio-target-${anuncio.target}`}>{targetLabelMap[anuncio.target] || "Todos"}</span>
              </div>
              <p>{anuncio.message}</p>
              <small>{anuncio.dateLabel}</small>
            </div>

            {canManageAnnouncements && (
              <div className="anuncio-actions">
                <button type="button" className="anuncio-action-btn" title="Editar" onClick={() => { setEditingAnuncio({ ...anuncio }); setIsEditAnuncioModalOpen(true); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25Z"/></svg>
                </button>
                <button type="button" className="anuncio-action-btn anuncio-action-delete" title="Eliminar" onClick={() => handleDeleteAnuncio(anuncio.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM8 9H16V19H8V9ZM15.5 4L14.5 3H9.5L8.5 4H5V6H19V4H15.5Z"/></svg>
                </button>
              </div>
            )}
          </article>
        ))}
      </section>

      <Pagination page={page} totalPages={pageData.totalPages} onPageChange={setPage} />
    </>
  );
}
