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

  const handleDeleteAsamblea = async (id) => {
    if (!window.confirm("¿Eliminar esta asamblea? Esta acción no se puede deshacer.")) return;
    try {
      await api.deleteAsamblea(id);
      setAsambleasData((prev) => prev.filter((a) => String(a.id) !== String(id)));
    } catch (err) {
      console.error("Error eliminando asamblea:", err.message);
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

      <section className="asambleas-grid">
        {loading ? (
          <p>Cargando...</p>
        ) : pageData.data.length === 0 ? (
          <p>No hay asambleas.</p>
        ) : pageData.data.map((item) => {
          const userVoteKey = user.id || user.email;
          const myVote = asambleaVotes[item.id] || (item.userVotes && item.userVotes[userVoteKey]);
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
                    <button type="button" className="asamblea-admin-btn asamblea-admin-btn-edit" onClick={() => handleOpenEditAsamblea(item)}>Editar</button>
                    <button type="button" className="asamblea-admin-btn asamblea-admin-btn-delete" onClick={() => handleDeleteAsamblea(item.id)}>Eliminar</button>
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
                          } catch {}
                          setAsambleaVotes({ ...asambleaVotes, [item.id]: tipo });
                        }}
                      >
                        <span>{tipo === "favor" ? "👍" : tipo === "contra" ? "👎" : "–"}</span>
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
    </>
  );
}
