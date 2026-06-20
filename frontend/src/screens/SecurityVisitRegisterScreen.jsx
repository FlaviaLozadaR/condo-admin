import { useState } from "react";
import * as api from "../api.js";

export default function SecurityVisitRegisterScreen({
  user,
  visitMode,
  setVisitMode,
  visitRegistrationForm,
  setVisitRegistrationForm,
  visitFiles,
  setVisitFiles,
  visitPasses,
  setVisitPasses,
  setSelectedVisitPassId,
  setHistorialVisitasData,
  propiedadesData,
  onToast,
}) {
  const isSecurity = user.role === "Seguridad";
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false);
  const [propertySearch, setPropertySearch] = useState("");
  const [nameDropdownOpen, setNameDropdownOpen] = useState(false);

  const availableProperties = isSecurity && user.condo
    ? propiedadesData.filter(p => p.condo === user.condo)
    : propiedadesData;

  const filteredProperties = propertySearch.trim()
    ? availableProperties.filter(p =>
        `${p.street} - ${p.code}`.toLowerCase().includes(propertySearch.trim().toLowerCase())
      )
    : availableProperties;

  // Sugerencias de visitantes ya registrados antes, para autocompletar el formulario
  const nameQuery = visitRegistrationForm.fullName.trim().toLowerCase();
  const nameSuggestions = nameQuery.length < 2 ? [] : Array.from(
    new Map(
      visitPasses
        .filter(p => p.fullName?.toLowerCase().includes(nameQuery))
        .map(p => [p.idNumber || p.fullName, p])
    ).values()
  ).slice(0, 5);

  const handleSelectSuggestion = (pass) => {
    setVisitRegistrationForm({
      ...visitRegistrationForm,
      fullName: pass.fullName || "",
      idNumber: pass.idNumber || "",
      property: pass.property || "",
      motive: pass.motive || "",
      plate: pass.plate && pass.plate !== "-" ? pass.plate : "",
    });
    setVisitMode(pass.mode === "vehicular" ? "vehicular" : "peatonal");
    setNameDropdownOpen(false);
    onToast?.("Datos completados desde un registro anterior. Subí las fotos nuevamente.", "info");
  };

  const handleSecurityRegisterVisit = async () => {
    if (!visitRegistrationForm.fullName.trim() || !visitRegistrationForm.idNumber.trim() || !visitRegistrationForm.property.trim() || !visitRegistrationForm.motive.trim() || !visitFiles.idDocument || !visitFiles.idDocumentBack) {
      onToast?.("Completa todos los campos requeridos, incluyendo ambas fotos del carnet.", "error");
      return;
    }
    if (visitMode === "vehicular" && (!visitRegistrationForm.plate.trim() || !visitFiles.platePhoto)) {
      onToast?.("Completa la placa y la foto del vehículo.", "error");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("mode", visitMode);
      formData.append("fullName", visitRegistrationForm.fullName.trim());
      formData.append("idNumber", visitRegistrationForm.idNumber.trim());
      formData.append("property", visitRegistrationForm.property.trim());
      formData.append("motive", visitRegistrationForm.motive.trim());
      formData.append("plate", visitMode === "vehicular" ? visitRegistrationForm.plate.trim() || "-" : "-");
      formData.append("createdBy", user.name);
      formData.append("status", "Registrado");
      formData.append("idDocumentFront", visitFiles.idDocument);
      formData.append("idDocumentBack", visitFiles.idDocumentBack);
      if (visitMode === "vehicular" && visitFiles.platePhoto) {
        formData.append("platePhoto", visitFiles.platePhoto);
      }

      const { historialEntry, ...newPass } = await api.createVisita(formData);
      setVisitPasses([newPass, ...visitPasses]);
      setSelectedVisitPassId(newPass.id);
      if (historialEntry) setHistorialVisitasData?.(prev => [historialEntry, ...prev]);
      clearSecurityRegisterForm();
      onToast?.("Visita registrada correctamente.", "success");
    } catch (err) {
      onToast?.(err.message || "No se pudo registrar la visita.", "error");
    }
  };

  const clearSecurityRegisterForm = () => {
    setVisitRegistrationForm({
      fullName: "",
      idNumber: "",
      property: "",
      motive: "",
      plate: ""
    });
    setVisitFiles({ idDocument: null, idDocumentBack: null, platePhoto: null });
  };

  return (
    <>
      <header className="dashboard-header visit-header">
        <div>
          <h1>Registro de Visitas</h1>
          <p>Registre el ingreso de visitantes al condominio</p>
        </div>
      </header>

      <section className="visit-owner-layout">
        <article className="visit-owner-card visit-owner-form-card">
          <div className="visit-mode-toggle">
            <button type="button" className={`visit-mode-btn${visitMode === "peatonal" ? " visit-mode-btn-active" : ""}`} onClick={() => setVisitMode("peatonal")}>Portería Peatonal</button>
            <button type="button" className={`visit-mode-btn${visitMode === "vehicular" ? " visit-mode-btn-active" : ""}`} onClick={() => setVisitMode("vehicular")}>Portería Vehicular</button>
          </div>

          <h2>{visitMode === "vehicular" ? "Registro Vehicular" : "Registro Peatonal"}</h2>

          <div className="visit-form-grid">
            <label className="visit-form-field">
              <span>Nombre Completo *</span>
              <div
                className="condo-dropdown"
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setNameDropdownOpen(false); }}
                tabIndex={-1}
              >
                <input
                  type="text"
                  placeholder="Nombre del visitante"
                  autoComplete="off"
                  value={visitRegistrationForm.fullName}
                  onChange={(e) => { setVisitRegistrationForm({ ...visitRegistrationForm, fullName: e.target.value }); setNameDropdownOpen(true); }}
                  onFocus={() => setNameDropdownOpen(true)}
                />
                {nameDropdownOpen && nameSuggestions.length > 0 && (
                  <ul className="condo-dropdown-list" role="listbox">
                    {nameSuggestions.map((pass) => (
                      <li
                        key={pass.id}
                        role="option"
                        className="condo-dropdown-item"
                        onMouseDown={() => handleSelectSuggestion(pass)}
                      >
                        <strong>{pass.fullName}</strong> — CI {pass.idNumber} — {pass.property}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </label>
            <label className="visit-form-field">
              <span>Número de Carnet *</span>
              <input type="text" placeholder="12345678" value={visitRegistrationForm.idNumber} onChange={(e) => setVisitRegistrationForm({ ...visitRegistrationForm, idNumber: e.target.value })} />
            </label>
            {visitMode === "vehicular" && (
              <label className="visit-form-field visit-form-full">
                <span>Placa del Vehículo *</span>
                <input type="text" placeholder="ABC-123" value={visitRegistrationForm.plate} onChange={(e) => setVisitRegistrationForm({ ...visitRegistrationForm, plate: e.target.value })} />
              </label>
            )}
            <label className="visit-form-field visit-form-full">
              <span>Propiedad a Visitar *</span>
              <div
                className="condo-dropdown"
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) { setPropertyDropdownOpen(false); setPropertySearch(""); } }}
                tabIndex={-1}
              >
                <button
                  type="button"
                  className="condo-dropdown-trigger"
                  onClick={() => setPropertyDropdownOpen((open) => !open)}
                  aria-expanded={propertyDropdownOpen}
                >
                  <span className="condo-dropdown-value">
                    {visitRegistrationForm.property || "Seleccionar propiedad"}
                  </span>
                  <svg className={`condo-dropdown-chevron${propertyDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {propertyDropdownOpen && (
                  <div className="property-dropdown-panel">
                    <div className="property-dropdown-search">
                      <input
                        type="text"
                        placeholder="Buscar por calle o numero..."
                        value={propertySearch}
                        onChange={(e) => setPropertySearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <ul className="property-dropdown-list" role="listbox">
                      {filteredProperties.length === 0 ? (
                        <li className="property-dropdown-empty">Sin resultados</li>
                      ) : filteredProperties.map((item) => (
                        <li
                          key={item.id}
                          role="option"
                          aria-selected={visitRegistrationForm.property === `${item.street} - ${item.code}`}
                          className={`condo-dropdown-item${visitRegistrationForm.property === `${item.street} - ${item.code}` ? " selected" : ""}`}
                          onMouseDown={() => {
                            setVisitRegistrationForm({ ...visitRegistrationForm, property: `${item.street} - ${item.code}` });
                            setPropertyDropdownOpen(false);
                            setPropertySearch("");
                          }}
                        >
                          {item.street} - {item.code}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </label>
            <label className="visit-form-field visit-form-full">
              <span>Motivo de Ingreso *</span>
              <textarea placeholder="Describe el motivo de la visita" value={visitRegistrationForm.motive} onChange={(e) => setVisitRegistrationForm({ ...visitRegistrationForm, motive: e.target.value })} />
            </label>
            <div className="visit-form-field visit-form-full">
              <span>Foto de Identificación (ambos lados) *</span>
              <div className="visit-upload-pair">
                <UploadBox
                  title="Anverso (frente)"
                  file={visitFiles.idDocument}
                  accept="image/*,.pdf"
                  onSelect={(e) => setVisitFiles({ ...visitFiles, idDocument: e.target.files?.[0] || null })}
                  onRemove={() => setVisitFiles({ ...visitFiles, idDocument: null })}
                />
                <UploadBox
                  title="Reverso (dorso)"
                  file={visitFiles.idDocumentBack}
                  accept="image/*,.pdf"
                  onSelect={(e) => setVisitFiles({ ...visitFiles, idDocumentBack: e.target.files?.[0] || null })}
                  onRemove={() => setVisitFiles({ ...visitFiles, idDocumentBack: null })}
                />
              </div>
            </div>

            {visitMode === "vehicular" && (
              <div className="visit-form-field visit-form-full">
                <span>Foto de la Placa *</span>
                <UploadBox
                  file={visitFiles.platePhoto}
                  accept="image/*"
                  placeholder="Click para subir foto de placa"
                  onSelect={(e) => setVisitFiles({ ...visitFiles, platePhoto: e.target.files?.[0] || null })}
                  onRemove={() => setVisitFiles({ ...visitFiles, platePhoto: null })}
                />
              </div>
            )}
          </div>

          <div className="security-register-actions">
            <button type="button" className="security-register-clear" onClick={clearSecurityRegisterForm}>Limpiar</button>
            <button type="button" className="security-register-submit" onClick={handleSecurityRegisterVisit}>Registrar Ingreso</button>
          </div>
        </article>
      </section>
    </>
  );
}

function UploadBox({ title, file, accept, placeholder, onSelect, onRemove }) {
  return (
    <label className="visit-upload-box">
      <input
        type="file"
        accept={accept}
        className="visit-upload-input"
        onChange={onSelect}
      />
      {file && (
        <button
          type="button"
          className="visit-upload-remove"
          title="Quitar foto"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6L18 18M6 18L18 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      )}
      <span className="visit-upload-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M12 16V6M8 10L12 6L16 10M5 14V17C5 18.1 5.9 19 7 19H17C18.1 19 19 18.1 19 17V14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="visit-upload-text">
        {title && <strong className="visit-upload-title">{title}</strong>}
        {file ? file.name : (placeholder || "Click para subir")}
      </span>
    </label>
  );
}
