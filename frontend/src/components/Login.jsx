import { useState } from "react";
import * as api from "../api.js";

export default function Login({ onBack, onLogin, expiredMsg }) {
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [message, setMessage]       = useState(expiredMsg || "");
  const [mode, setMode]             = useState("login");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg]   = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [loading, setLoading]       = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage("Iniciando sesion...");
    setLoading(true);
    try {
      const result = await api.login(email.trim(), password);
      setMessage("");
      onLogin(result.user);
    } catch (err) {
      setMessage(err.message || "Credenciales invalidas. Verifica correo y contrasena.");
    } finally {
      setLoading(false);
    }
  };

  const onForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMsg("");
    try {
      await api.forgotPassword(forgotEmail.trim());
      setMode("forgot-sent");
    } catch (err) {
      setForgotMsg(err.message || "Error al enviar el email.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <main className="login-screen">
      <button className="login-back-link" type="button" onClick={onBack} aria-label="Volver al inicio">
        ← Volver al inicio
      </button>

      <section className="login-container">
        <div className="login-card">

          <div className="login-brand">
            <img src="/images/logo-ignitel-tight.png" alt="Ignitel" className="login-logo" />
          </div>

          {mode === "login" && (
            <>
              <div className="login-header">
                <h1>Bienvenido de nuevo</h1>
                <p>Ingresa tus credenciales para acceder al sistema</p>
              </div>

              <form onSubmit={onSubmit} className="login-form">
                <div className="login-field">
                  <label htmlFor="login-email">Correo electronico</label>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="usuario@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="login-field">
                  <label htmlFor="login-password">Contrasena</label>
                  <input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>

                {message && (
                  <p className={`login-message${message.includes("Iniciando") ? " login-message-info" : ""}`}>
                    {message}
                  </p>
                )}

                <button className="login-submit-btn" type="submit" disabled={loading}>
                  {loading ? "Iniciando sesion..." : "Iniciar Sesion"}
                </button>

                <button type="button" className="login-forgot-link" onClick={() => { setMode("forgot"); setForgotEmail(email); setForgotMsg(""); }}>
                  ¿Olvidaste tu contrasena?
                </button>
              </form>
            </>
          )}

          {mode === "forgot" && (
            <>
              <div className="login-header">
                <h1>Recuperar acceso</h1>
                <p>Te enviamos un link para restablecer tu contrasena.</p>
              </div>
              <form onSubmit={onForgotSubmit} className="login-form">
                <div className="login-field">
                  <label htmlFor="forgot-email">Correo electronico</label>
                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
                {forgotMsg && <p className="login-message">{forgotMsg}</p>}
                <button className="login-submit-btn" type="submit" disabled={forgotLoading}>
                  {forgotLoading ? "Enviando..." : "Enviar link de recuperacion"}
                </button>
                <button type="button" className="login-forgot-link" onClick={() => setMode("login")}>
                  ← Volver al inicio de sesion
                </button>
              </form>
            </>
          )}

          {mode === "forgot-sent" && (
            <>
              <div className="login-header" style={{ textAlign: "center" }}>
                <div className="login-sent-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <h1>Revisa tu correo</h1>
                <p>Si el correo esta registrado, recibiras un link para restablecer tu contrasena.</p>
              </div>
              <button type="button" className="login-submit-btn" style={{ marginTop: "1.5rem" }} onClick={() => setMode("login")}>
                Volver al inicio de sesion
              </button>
            </>
          )}

        </div>
      </section>
    </main>
  );
}
