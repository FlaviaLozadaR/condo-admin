import { useEffect, useState } from "react";
import * as api from "../api.js";
import Pagination from "../components/Pagination.jsx";

const PAGE_SIZE = 20;

export default function AsambleasScreen({
  user,
  isSuperAdministrator,
  condominiosData,
  asambleasData,
  setAsambleasData,
  setIsCreateAsambleaModalOpen,
  setEditingAsamblea,
  setEditAsambleaForm,
  setEditAsambleaFile,
  setIsEditAsambleaModalOpen,
  onToast,
}) {
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState({ data: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [asambleaCondoFilter, setAsambleaCondoFilter] = useState("todos");
  const [asambleaCondoDropdownOpen, setAsambleaCondoDropdownOpen] = useState(false);
  const [asambleaVotes, setAsambleaVotes] = useState({});

  const canManageAsambleas = ["Super Admin", "Administrador"].includes(user.role);
  const canVoteAsambleas   = user.role === "Propietario";
  const canSeeVotes        = ["Super Admin", "Administrador"].includes(user.role);
  const isTenant           = user.role === "Inquilino";

  const selectedAsambleaCondoName =
    asambleaCondoFilter === "todos"
      ? ""
      : (condominiosData.find((condo) => String(condo.id) === asambleaCondoFilter)?.name || "");

  const condoParam = isSuperAdministrator
    ? (selectedAsambleaCondoName || undefined)
    : user.role === "Administrador" ? user.condo : undefined;

  useEffect(() => {
    setPage(1);
  }, [condoParam]);

  useEffect(() => {
    setLoading(true);
    api.getAsambleasPaged({ page, limit: PAGE_SIZE, condo: condoParam })
      .then(setPageData)
      .catch((err) => onToast?.(err.message, "error"))
      .finally(() => setLoading(false));
  }, [page, condoParam, asambleasData]);

  const handleOpenEditAsamblea = (item) => {
    setEditingAsamblea(item);
    setEditAsambleaForm({
      title:       item.title || "",
      startDate:   item.startDate || "",
      dueDate:     item.dueDate || "",
      description: item.description || "",
    });
    setEditAsambleaFile(null);
    setIsEditAsambleaModalOpen(true);
  };

  const [deletingAsambleaId, setDeletingAsambleaId] = useState(null);

  const confirmDeleteAsamblea = async () => {
    if (!deletingAsambleaId) return;
    try {
      await api.deleteAsamblea(deletingAsambleaId);
      setAsambleasData((prev) => prev.filter((a) => String(a.id) !== String(deletingAsambleaId)));
    } catch (err) {
      console.error("Error eliminando asamblea:", err.message);
      onToast?.(err.message || "Error al eliminar la asamblea.", "error");
    } finally {
      setDeletingAsambleaId(null);
    }
  };

  return (
    <>
      <header className="dashboard-header asambleas-header">
        <div>
          <h1>Asambleas</h1>
          <p>{canVoteAsambleas ? "Vota en las asambleas activas" : isTenant ? "Consulta las asambleas activas" : "Gestiona las asambleas del condominio"}</p>
        </div>
        {canManageAsambleas && (
          <button className="btn btn-primary asambleas-new-btn" type="button" onClick={() => setIsCreateAsambleaModalOpen(true)}>
            <span>+</span> Nueva Asamblea
          </button>
        )}
      </header>

      <section className="module-filters-row">
        <div className="management-condo-field">
          <label>Condominio / Edificio</label>
          {isSuperAdministrator ? (
            <div className="condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setAsambleaCondoDropdownOpen(false); }} tabIndex={-1}>
              <button
                type="button"
                className="condo-dropdown-trigger"
                onClick={() => setAsambleaCondoDropdownOpen((open) => !open)}
                aria-expanded={asambleaCondoDropdownOpen}
              >
                <span className="condo-dropdown-value">
                  {asambleaCondoFilter === "todos"
                    ? "Todos los condominios y edificios"
                    : (() => {
                      const selectedCondo = condominiosData.find((item) => String(item.id) === asambleaCondoFilter);
                      return selectedCondo ? `${selectedCondo.type}: ${selectedCondo.name}` : "Todos los condominios y edificios";
                    })()}
                </span>
                <svg className={`condo-dropdown-chevron${asambleaCondoDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {asambleaCondoDropdownOpen && (
                <ul className="condo-dropdown-list" role="listbox">
                  <li role="option" aria-selected={asambleaCondoFilter === "todos"} className={`condo-dropdown-item${asambleaCondoFilter === "todos" ? " selected" : ""}`} onMouseDown={() => { setAsambleaCondoFilter("todos"); setAsambleaCondoDropdownOpen(false); }}>
                    Todos los condominios y edificios
                  </li>
                  {condominiosData.map((item) => (
                    <li key={item.id} role="option" aria-selected={asambleaCondoFilter === String(item.id)} className={`condo-dropdown-item${asambleaCondoFilter === String(item.id) ? " selected" : ""}`} onMouseDown={() => { setAsambleaCondoFilter(String(item.id)); setAsambleaCondoDropdownOpen(false); }}>
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

      {loading && pageData.data.length > 0 && (
        <div className="section-refresh-indicator">
          <span className="section-refresh-spinner" aria-hidden="true" />
          Actualizando...
        </div>
      )}

      <section className="asambleas-grid">
        {loading && pageData.data.length === 0 ? (
          <p>Cargando...</p>
        ) : pageData.data.length === 0 ? (
          <p>No hay asambleas.</p>
        ) : pageData.data.map((item) => {
          const userVoteKey = user.id || user.email;
          const myVote = asambleaVotes[item.id] || (item.userVotes && item.userVotes[userVoteKey]);
          const isExpired = (() => {
            if (!item.dueDate) return false;
            const due = new Date(item.dueDate);
            if (isNaN(due)) return false;
            due.setHours(23, 59, 59, 999);
            return due < new Date();
          })();
          const fmtDate = (d) => {
            if (!d) return '';
            if (d.includes('T') || d.includes('-')) {
              const dt = new Date(d);
              return isNaN(dt) ? d : `${dt.getDate()}/${dt.getMonth()+1}/${dt.getFullYear()}`;
            }
            return d;
          };
          const fmtDateTime = (d) => {
            if (!d) return '';
            const dt = new Date(d);
            if (isNaN(dt)) return d;
            return `${dt.getDate()}/${dt.getMonth()+1}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
          };
          return (
            <article key={item.id} className="asamblea-card">
              <div className="asamblea-card-head">
                <span className="asamblea-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M6 3H14L18 7V21H6V3ZM14 3V7H18M9 12H15M9 16H15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div style={{ flex: 1 }}>
                  <h3>{item.title}</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #888)', marginTop: 2 }}>
                    {item.startDate && <span>Inicio: {fmtDate(item.startDate)} &nbsp;·&nbsp; </span>}
                    Vence: {fmtDate(item.dueDate)}
                  </p>
                  {item.createdAt && (
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #aaa)', marginTop: 1 }}>
                      Publicado: {fmtDateTime(item.createdAt)}
                    </p>
                  )}
                </div>
                {canManageAsambleas && (
                  <div className="asamblea-admin-actions">
                    <button type="button" className="anuncio-action-btn" title="Editar" onClick={() => handleOpenEditAsamblea(item)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25Z"/></svg>
                    </button>
                    <button type="button" className="anuncio-action-btn anuncio-action-delete" title="Eliminar" onClick={() => setDeletingAsambleaId(item.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM8 9H16V19H8V9ZM15.5 4L14.5 3H9.5L8.5 4H5V6H19V4H15.5Z"/></svg>
                    </button>
                  </div>
                )}
              </div>

              <p className="asamblea-description">{item.description}</p>

              {item.documentName ? (
                <a
                  href={api.getAsambleaDocumentUrl(item.id)}
                  className="asamblea-doc-link"
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    const token = localStorage.getItem('condo_token');
                    fetch(api.getAsambleaDocumentUrl(item.id), { headers: { Authorization: `Bearer ${token}` } })
                      .then(r => r.blob()).then(blob => {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = item.documentName; a.click();
                        URL.revokeObjectURL(url);
                      });
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 3H14L18 7V21H6V3ZM14 3V7H18M9 12H15M9 16H13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Descargar: {item.documentName}</span>
                </a>
              ) : null}

              {canSeeVotes && item.votes && (
                <div className="asamblea-votes-grid">
                  <div className="asamblea-vote-box asamblea-vote-favor">
                    <strong>{item.votes.favor ?? 0}</strong>
                    <span>A favor</span>
                  </div>
                  <div className="asamblea-vote-box asamblea-vote-contra">
                    <strong>{item.votes.contra ?? 0}</strong>
                    <span>En contra</span>
                  </div>
                  <div className="asamblea-vote-box asamblea-vote-abstencion">
                    <strong>{item.votes.abstencion ?? 0}</strong>
                    <span>Abstención</span>
                  </div>
                </div>
              )}

              {canVoteAsambleas && (
                myVote ? (
                  <div className="asamblea-voted-banner">
                    Ya has votado: {myVote === "favor" ? "A favor" : myVote === "contra" ? "En contra" : "Abstención"}
                  </div>
                ) : isExpired ? (
                  <div className="asamblea-expired-banner">Esta asamblea ya venció — ya no se puede votar.</div>
                ) : (
                  <div className="asamblea-owner-actions">
                    {["favor", "contra", "abstencion"].map((tipo) => (
                      <button
                        key={tipo}
                        type="button"
                        className={`asamblea-owner-btn asamblea-owner-btn-${tipo}`}
                        onClick={async () => {
                          try {
                            await api.voteAsamblea(String(item.id), tipo, user.id || user.email);
                            setAsambleaVotes({ ...asambleaVotes, [item.id]: tipo });
                          } catch (err) {
                            onToast?.(err.message || "Error al registrar el voto.", "error");
                          }
                        }}
                      >
                        <span className="asamblea-owner-btn-icon" aria-hidden="true">
                          {tipo === "favor" ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11v10H4a1 1 0 01-1-1v-8a1 1 0 011-1h3zm0 0l4.5-8a2 2 0 013.6 1.2L14 9h5.5a2 2 0 012 2.4l-1.6 7A2 2 0 0117.9 20H10a3 3 0 01-3-3v-6z"/></svg>
                          ) : tipo === "contra" ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 13V3h3a1 1 0 011 1v8a1 1 0 01-1 1h-3zm0 0l-4.5 8a2 2 0 01-3.6-1.2L10 15H4.5a2 2 0 01-2-2.4l1.6-7A2 2 0 016.1 4H14a3 3 0 013 3v6z"/></svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                          )}
                        </span>
                        <span>{tipo === "favor" ? "A Favor" : tipo === "contra" ? "En Contra" : "Abstención"}</span>
                      </button>
                    ))}
                  </div>
                )
              )}
            </article>
          );
        })}
      </section>

      <Pagination page={page} totalPages={pageData.totalPages} onPageChange={setPage} />

      {deletingAsambleaId && (
        <div className="modal-overlay modal-overlay-centered" onClick={() => setDeletingAsambleaId(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-icon confirm-modal-icon-danger" aria-hidden="true">!</div>
            <h2>¿Eliminar esta asamblea?</h2>
            <p>Esta acción no se puede deshacer.</p>
            <div className="confirm-modal-actions">
              <button type="button" className="confirm-modal-cancel" onClick={() => setDeletingAsambleaId(null)}>Cancelar</button>
              <button type="button" className="confirm-modal-accept confirm-modal-accept-danger" onClick={confirmDeleteAsamblea}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
