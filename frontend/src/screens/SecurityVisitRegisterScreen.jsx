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
  propiedadesData,
}) {
  const isSecurity = user.role === "Seguridad";

  const handleSecurityRegisterVisit = async () => {
    if (!visitRegistrationForm.fullName.trim() || !visitRegistrationForm.idNumber.trim() || !visitRegistrationForm.property.trim() || !visitRegistrationForm.motive.trim() || !visitFiles.idDocument) {
      return;
    }
    if (visitMode === "vehicular" && (!visitRegistrationForm.plate.trim() || !visitFiles.platePhoto)) {
      return;
    }
    try {
      const newPass = await api.createVisita({
        mode: visitMode,
        fullName: visitRegistrationForm.fullName.trim(),
        idNumber: visitRegistrationForm.idNumber.trim(),
        property: visitRegistrationForm.property.trim(),
        motive: visitRegistrationForm.motive.trim(),
        plate: visitMode === "vehicular" ? visitRegistrationForm.plate.trim() || "-" : "-",
        idDocumentName: visitFiles.idDocument?.name || "sin-archivo",
        platePhotoName: visitMode === "vehicular" ? visitFiles.platePhoto?.name || "sin-archivo" : "-",
        createdBy: user.name,
        status: "Registrado"
      });
      setVisitPasses([newPass, ...visitPasses]);
      setSelectedVisitPassId(newPass.id);
    } catch (err) {
      console.error("Error registrando visita:", err.message);
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
    setVisitFiles({ idDocument: null, platePhoto: null });
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
              <input type="text" placeholder="Nombre del visitante" value={visitRegistrationForm.fullName} onChange={(e) => setVisitRegistrationForm({ ...visitRegistrationForm, fullName: e.target.value })} />
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
              <select value={visitRegistrationForm.property} onChange={(e) => setVisitRegistrationForm({ ...visitRegistrationForm, property: e.target.value })}>
                <option value="">Seleccionar propiedad</option>
                {(isSecurity && user.condo
                  ? propiedadesData.filter(p => p.condo === user.condo)
                  : propiedadesData
                ).map((item) => (
                  <option key={item.id} value={`${item.street} - ${item.code}`}>
                    {item.street} - {item.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="visit-form-field visit-form-full">
              <span>Motivo de Ingreso *</span>
              <textarea placeholder="Describe el motivo de la visita" value={visitRegistrationForm.motive} onChange={(e) => setVisitRegistrationForm({ ...visitRegistrationForm, motive: e.target.value })} />
            </label>
            <label className="visit-form-field visit-form-full">
              <span>Foto de Identificación (ambos lados) *</span>
              <label className="visit-upload-box">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="visit-upload-input"
                  onChange={(e) => setVisitFiles({ ...visitFiles, idDocument: e.target.files?.[0] || null })}
                />
                <span className="visit-upload-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 16V6M8 10L12 6L16 10M5 14V17C5 18.1 5.9 19 7 19H17C18.1 19 19 18.1 19 17V14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="visit-upload-text">{visitFiles.idDocument ? visitFiles.idDocument.name : "Click para subir fotos"}</span>
              </label>
            </label>

            {visitMode === "vehicular" && (
              <label className="visit-form-field visit-form-full">
                <span>Foto de la Placa *</span>
                <label className="visit-upload-box">
                  <input
                    type="file"
                    accept="image/*"
                    className="visit-upload-input"
                    onChange={(e) => setVisitFiles({ ...visitFiles, platePhoto: e.target.files?.[0] || null })}
                  />
                  <span className="visit-upload-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 16V6M8 10L12 6L16 10M5 14V17C5 18.1 5.9 19 7 19H17C18.1 19 19 18.1 19 17V14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="visit-upload-text">{visitFiles.platePhoto ? visitFiles.platePhoto.name : "Click para subir foto de placa"}</span>
                </label>
              </label>
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
