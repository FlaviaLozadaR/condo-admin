import { useEffect, useState } from "react";
import * as api from "../api.js";
import Pagination from "../components/Pagination.jsx";

const PAGE_SIZE = 20;
const ROLE_ORDER = ["Super Admin", "Administrador", "Propietario", "Inquilino", "Seguridad"];

export default function UsuariosScreen({
  user,
  isSuperAdministrator,
  condominiosData,
  superAdminDashboards,
  usuariosData,
  setUsuariosData,
  selectedManagementCondoId,
  setSelectedManagementCondoId,
  condoDropdownOpen,
  setCondoDropdownOpen,
  selectedManagementCondoName,
  setEditingCondo,
  setIsEditCondoModalOpen,
  setIsCreateCondoModalOpen,
  setCondoToDelete,
  setIsDeleteCondoConfirmOpen,
  setNewUserForm,
  setNewUserError,
  setIsCreateUserModalOpen,
  genTempPassword,
  setEditingUser,
  setIsEditUserModalOpen,
  onToast,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState({ data: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const condoParam = isSuperAdministrator
    ? (selectedManagementCondoId === 0 ? undefined : selectedManagementCondoName)
    : user.condo;

  // Roles presentes en el condominio (o en todos, si no hay condominio seleccionado)
  const availableRoles = ROLE_ORDER.filter(role =>
    usuariosData.some(u => u.role === role && (!condoParam || u.condo === condoParam))
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, condoParam, selectedRole]);

  // Si cambia el condominio y el rol elegido ya no existe ahí, volver a "Todos"
  useEffect(() => {
    if (selectedRole && !availableRoles.includes(selectedRole)) setSelectedRole("");
  }, [condoParam]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true);
    api.getUsuariosPaged({ page, limit: PAGE_SIZE, q: debouncedSearch, condo: condoParam, role: selectedRole })
      .then(setPageData)
      .catch((err) => onToast?.(err.message, "error"))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, condoParam, selectedRole, usuariosData]);

  const getRoleColor = (role) => {
    const colors = {
      "Super Admin": "#4f46e5",
      "Administrador": "#3b82f6",
      "Propietario": "#00c853",
      "Inquilino": "#ff9800",
      "Seguridad": "#9ca3af"
    };
    return colors[role] || "#6b7280";
  };

  const handleDeleteCondo = (id) => {
    const condo = condominiosData.find(c => c.id === id);
    setCondoToDelete(condo);
    setIsDeleteCondoConfirmOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete?.id) return;
    const id = userToDelete.id;
    try {
      await api.deleteUsuario(String(id));
      setUsuariosData(usuariosData.filter(u => u.id !== id && String(u.id) !== String(id)));
      onToast?.("Usuario eliminado.", "success");
    } catch (err) {
      onToast?.("Error al eliminar el usuario.", "error");
    } finally {
      setUserToDelete(null);
    }
  };

  return (
    <>
      <header className="dashboard-header">
        <h1>Gestión de Usuarios</h1>
        {isSuperAdministrator
          ? <p>Crea administradores y asígnalos a sus condominios. Ellos luego registrarán a sus residentes.</p>
          : <p>Administra los usuarios de <strong>{user.condo}</strong>.</p>
        }
      </header>

      <section className="usuarios-section">
        {isSuperAdministrator ? (
          <>
            <div className="management-condo-bar">
              <div className="management-condo-field">
                <label>Filtrar por Condominio</label>
                <div className="condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setCondoDropdownOpen(false); }} tabIndex={-1}>
                  <button
                    type="button"
                    className="condo-dropdown-trigger"
                    onClick={() => setCondoDropdownOpen((o) => !o)}
                    aria-expanded={condoDropdownOpen}
                  >
                    <span className="condo-dropdown-value">
                      {selectedManagementCondoId === 0
                        ? "— Todos —"
                        : (() => { const c = condominiosData.find(c => c.id === selectedManagementCondoId); return c ? `${c.type}: ${c.name}` : "— Todos —"; })()
                      }
                    </span>
                    <svg className={`condo-dropdown-chevron${condoDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {condoDropdownOpen && (
                    <ul className="condo-dropdown-list" role="listbox">
                      {[{ id: 0, type: "", name: "— Todos —" }, ...condominiosData].map((item) => (
                        <li
                          key={item.id}
                          role="option"
                          aria-selected={selectedManagementCondoId === item.id}
                          className={`condo-dropdown-item${selectedManagementCondoId === item.id ? " selected" : ""}`}
                          onMouseDown={() => { setSelectedManagementCondoId(item.id); setCondoDropdownOpen(false); }}
                        >
                          {item.id === 0 ? "— Todos —" : `${item.type}: ${item.name}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
            {/* Tarjetas de condominios con métricas */}
            {(() => {
              const visibleCondos = selectedManagementCondoId === 0
                ? condominiosData
                : condominiosData.filter(c => c.id === selectedManagementCondoId);
              return visibleCondos.length > 0 && (
                <div className="condo-cards-grid">
                  {visibleCondos.map(condo => {
                    const stats = superAdminDashboards.find(d => d.id === condo.id);
                    return (
                      <article key={condo.id} className="condo-metric-card">
                        <div className="condo-metric-header">
                          <div>
                            <span className="condo-metric-type">{condo.type}</span>
                            <h3 className="condo-metric-name">{condo.name}</h3>
                            {condo.address && <p className="condo-metric-address">{condo.address}</p>}
                          </div>
                          <div className="condo-metric-actions">
                            <button type="button" className="condo-metric-btn" title="Editar"
                              onClick={() => { setEditingCondo({ ...condo }); setIsEditCondoModalOpen(true); }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25Z"/>
                              </svg>
                            </button>
                            <button type="button" className="condo-metric-btn condo-metric-btn-danger" title="Eliminar"
                              onClick={() => handleDeleteCondo(condo.id)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6H21M8 6V4H16V6M19 6L18 20H6L5 6"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="condo-metric-stats">
                          <div className="condo-metric-stat">
                            <strong>{stats?.propertiesCount ?? 0}</strong>
                            <span>Unidades</span>
                          </div>
                          <div className="condo-metric-stat">
                            <strong>Bs. {(stats?.collectedAmount ?? 0).toLocaleString()}</strong>
                            <span>Cobrado</span>
                          </div>
                          <div className="condo-metric-stat">
                            <strong>{stats?.debtorsCount ?? 0}</strong>
                            <span>Morosos</span>
                          </div>
                          <div className="condo-metric-stat condo-metric-stat-danger">
                            <strong>Bs. {(stats?.debtTotal ?? 0).toLocaleString()}</strong>
                            <span>En mora</span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              );
            })()}

            <div className="usuarios-action-grid">
              <button className="btn btn-secondary" type="button" onClick={() => setIsCreateCondoModalOpen(true)}>
                <span>+</span> Nuevo Condominio
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  setNewUserForm({ nombre: "", apellido: "", email: "", rol: "Administrador", telefono: "", contrasena: genTempPassword(), condoId: "" });
                  setNewUserError("");
                  setIsCreateUserModalOpen(true);
                }}
              >
                <span>+</span> Crear Administrador
              </button>
            </div>
          </>
        ) : (
          <div className="usuarios-top-bar">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                setNewUserForm({ nombre: "", apellido: "", email: "", rol: "Propietario", telefono: "", contrasena: genTempPassword(), condoId: "" });
                setNewUserError("");
                setIsCreateUserModalOpen(true);
              }}
            >
              <span>+</span> Crear Usuario
            </button>
          </div>
        )}

        <div className="usuarios-filters-row">
          <div className="usuarios-search-wrap">
            <svg className="usuarios-search-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 16C13.3 16 16 13.3 16 10C16 6.7 13.3 4 10 4C6.7 4 4 6.7 4 10C4 13.3 6.7 16 10 16ZM18 18L14.3 14.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              className="usuarios-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {availableRoles.length > 1 && (
            <RoleFilterField
              selectedRole={selectedRole}
              availableRoles={availableRoles}
              open={roleDropdownOpen}
              setOpen={setRoleDropdownOpen}
              setSelectedRole={setSelectedRole}
            />
          )}
        </div>

        <div className="usuarios-table-wrap">
          <table className="usuarios-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Rol</th>
                <th>Propiedad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && pageData.data.length === 0 ? (
                <tr><td colSpan={6}>Cargando...</td></tr>
              ) : pageData.data.length === 0 ? (
                <tr><td colSpan={6}>No se encontraron usuarios.</td></tr>
              ) : pageData.data.map((usuario) => (
                <tr key={usuario.id}>
                  <td>
                    <div className="usuario-cell-name">
                      <div className="usuario-avatar" style={{ background: getRoleColor(usuario.role) }}>
                        {usuario.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span>{usuario.name}</span>
                    </div>
                  </td>
                  <td>{usuario.email}</td>
                  <td>{usuario.phone}</td>
                  <td>
                    <span className="usuario-role-badge" style={{ borderColor: getRoleColor(usuario.role), color: getRoleColor(usuario.role) }}>
                      {usuario.role}
                    </span>
                  </td>
                  <td>{usuario.property}</td>
                  <td>
                    <div className="usuario-actions">
                      <button className="usuario-action-btn" title="Editar" type="button" onClick={() => {
                        setEditingUser(usuario);
                        setIsEditUserModalOpen(true);
                      }}>
                        <svg viewBox="0 0 24 24">
                          <path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button className="usuario-action-btn usuario-action-delete" title="Eliminar" type="button" onClick={() => setUserToDelete(usuario)}>
                        <svg viewBox="0 0 24 24">
                          <path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM8 9H16V19H8V9ZM15.5 4L14.5 3H9.5L8.5 4H5V6H19V4H15.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalPages={pageData.totalPages} onPageChange={setPage} />
        </div>
      </section>

      {userToDelete && (
        <div className="modal-overlay" onClick={() => setUserToDelete(null)}>
          <div className="modal-content" style={{ maxWidth: "420px" }} onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Eliminar usuario</h2>
              <button className="modal-close" type="button" onClick={() => setUserToDelete(null)}>✕</button>
            </header>
            <div className="modal-body-simple" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "1.75rem 1.5rem 0.75rem" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(239,68,68,0.10)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.25rem" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </div>
              <p style={{ margin: "0 0 0.4rem", fontWeight: 700, fontSize: "1.05rem", width: "100%" }}>
                ¿Eliminar a "{userToDelete.name}"?
              </p>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--dash-text-2, #667085)", lineHeight: 1.5, width: "100%" }}>
                Esta acción no se puede deshacer.
              </p>
            </div>
            <footer className="modal-footer">
              <button className="btn btn-secondary" type="button" onClick={() => setUserToDelete(null)}>
                Cancelar
              </button>
              <button
                className="btn"
                type="button"
                style={{ background: "#ef4444", color: "#fff", border: "none" }}
                onClick={confirmDeleteUser}
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

function RoleFilterField({ selectedRole, availableRoles, open, setOpen, setSelectedRole }) {
  return (
    <div className="management-condo-field">
      <label>Filtrar por Rol</label>
      <div className="condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }} tabIndex={-1}>
        <button
          type="button"
          className="condo-dropdown-trigger"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span className="condo-dropdown-value">{selectedRole || "— Todos —"}</span>
          <svg className={`condo-dropdown-chevron${open ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {open && (
          <ul className="condo-dropdown-list" role="listbox">
            {["", ...availableRoles].map((role) => (
              <li
                key={role || "todos"}
                role="option"
                aria-selected={selectedRole === role}
                className={`condo-dropdown-item${selectedRole === role ? " selected" : ""}`}
                onMouseDown={() => { setSelectedRole(role); setOpen(false); }}
              >
                {role || "— Todos —"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
