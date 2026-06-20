import { useState } from "react";
import * as api from "../api.js";
import { onEnterKey } from "../utils/keyboard.js";

const PHONE_PREFIX = "+591";
const stripPhonePrefix = (phone) => (phone || "").replace(/^\+591[\s-]*/, "");

export default function PerfilScreen({
  user,
  profilePhoto,
  setProfilePhoto,
  isDarkMode,
  toggleDarkMode,
  onProfileUpdated,
}) {
  const [profileForm, setProfileForm] = useState({ name: user?.name || "", email: user?.email || "", phone: stripPhonePrefix(user?.phone) });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [pwForm, setPwForm]   = useState({ current: "", next: "", confirm: "" });
  const [pwMsg,  setPwMsg]    = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const handleProfilePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setProfilePhoto(dataUrl);
      localStorage.setItem(`profilePhoto_${user.email}`, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg("");
    try {
      const phone = profileForm.phone.trim() ? `${PHONE_PREFIX} ${profileForm.phone.trim()}` : "";
      await api.updateUsuario(String(user.id || ""), { name: profileForm.name, email: profileForm.email, phone });
      onProfileUpdated?.({ name: profileForm.name, email: profileForm.email, phone });
      setProfileMsg("Datos actualizados correctamente.");
    } catch (err) {
      setProfileMsg("Error al guardar: " + (err.message || "intenta de nuevo."));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwMsg("");
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) { setPwMsg("Completá todos los campos."); return; }
    if (pwForm.next.length < 8) { setPwMsg("La nueva contraseña debe tener al menos 8 caracteres."); return; }
    if (pwForm.next !== pwForm.confirm) { setPwMsg("Las contraseñas nuevas no coinciden."); return; }
    setPwSaving(true);
    try {
      await api.changePassword(String(user.id || ""), { currentPassword: pwForm.current, newPassword: pwForm.next });
      setPwMsg("Contraseña actualizada correctamente.");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      setPwMsg(err.message || "Error al cambiar la contraseña.");
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="perfil-screen">
      <header className="dashboard-header">
        <h1>Mi Perfil</h1>
        <p>Administrá tu información personal y foto de perfil.</p>
      </header>

      <div className="perfil-layout">
        {/* Foto de perfil */}
        <div className="perfil-photo-card">
          <div className="perfil-avatar-wrap">
            {profilePhoto
              ? <img src={profilePhoto} alt="Foto de perfil" className="perfil-avatar-img" />
              : <span className="perfil-avatar-initials">{(profileForm.name || user.name || "?").split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()}</span>
            }
            <label className="perfil-avatar-edit-btn" title="Cambiar foto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleProfilePhotoChange} />
            </label>
          </div>
          <p className="perfil-photo-name">{profileForm.name || user.name}</p>
          <p className="perfil-photo-role">{user.role}</p>
          {profilePhoto && (
            <button type="button" className="perfil-remove-photo-btn" onClick={() => { setProfilePhoto(null); localStorage.removeItem(`profilePhoto_${user.email}`); }}>
              Quitar foto
            </button>
          )}
        </div>

        {/* Datos personales */}
        <div className="perfil-form-card">
          <h3 className="perfil-form-title">Datos personales</h3>
          <div className="perfil-form-grid">
            <div className="form-group-simple">
              <label>Nombre completo</label>
              <input type="text" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} onKeyDown={onEnterKey(handleSaveProfile, profileSaving)} placeholder="Tu nombre" />
            </div>
            <div className="form-group-simple">
              <label>Correo electrónico</label>
              <input type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} onKeyDown={onEnterKey(handleSaveProfile, profileSaving)} placeholder="correo@ejemplo.com" />
            </div>
            <div className="form-group-simple">
              <label>Teléfono</label>
              <div className="phone-input-group">
                <span className="phone-input-prefix">{PHONE_PREFIX}</span>
                <input type="text" inputMode="numeric" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value.replace(/\D/g, "") })} onKeyDown={onEnterKey(handleSaveProfile, profileSaving)} placeholder="Ej: 69444833" />
              </div>
            </div>
            <div className="form-group-simple">
              <label>Rol</label>
              <input type="text" value={user.role} readOnly className="perfil-rol-input" />
            </div>
          </div>
          {profileMsg && (
            <p className={`perfil-msg${profileMsg.startsWith("Error") ? " perfil-msg-error" : " perfil-msg-ok"}`}>{profileMsg}</p>
          )}
          <div className="perfil-form-footer">
            <button type="button" className="btn btn-primary" disabled={profileSaving} onClick={handleSaveProfile}>
              {profileSaving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>

        {/* Cambio de contraseña */}
        <div className="perfil-form-card">
          <h3 className="perfil-form-title">Cambiar contraseña</h3>
          <div className="perfil-form-grid">
            <div className="form-group-simple" style={{ gridColumn: "1 / -1" }}>
              <label>Contraseña actual</label>
              <input type="password" value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} onKeyDown={onEnterKey(handleChangePassword, pwSaving)} placeholder="Tu contraseña actual" />
            </div>
            <div className="form-group-simple">
              <label>Nueva contraseña</label>
              <input type="password" value={pwForm.next} onChange={e => setPwForm({ ...pwForm, next: e.target.value })} onKeyDown={onEnterKey(handleChangePassword, pwSaving)} placeholder="Mínimo 8 caracteres" />
            </div>
            <div className="form-group-simple">
              <label>Confirmar nueva contraseña</label>
              <input type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} onKeyDown={onEnterKey(handleChangePassword, pwSaving)} placeholder="Repetí la nueva contraseña" />
            </div>
          </div>
          {pwMsg && (
            <p className={`perfil-msg${pwMsg.includes("correctamente") ? " perfil-msg-ok" : " perfil-msg-error"}`}>{pwMsg}</p>
          )}
          <div className="perfil-form-footer">
            <button type="button" className="btn btn-primary" disabled={pwSaving} onClick={handleChangePassword}>
              {pwSaving ? "Guardando…" : "Cambiar contraseña"}
            </button>
          </div>
        </div>

        {/* Apariencia */}
        <div className="perfil-form-card">
          <h3 className="perfil-form-title">Apariencia</h3>
          <div className="perfil-appearance-row">
            <div className="perfil-appearance-info">
              <span className="perfil-appearance-label">Tema</span>
              <span className="perfil-appearance-desc">{isDarkMode ? "Modo oscuro activo" : "Modo claro activo"}</span>
            </div>
            <button
              type="button"
              className={`perfil-theme-toggle${isDarkMode ? " perfil-theme-toggle-dark" : ""}`}
              onClick={toggleDarkMode}
              aria-label={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              <span className="perfil-theme-toggle-knob">
                {isDarkMode ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  </svg>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
