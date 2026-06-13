import { useEffect } from "react";

export default function Landing({ onStartLogin, isDarkMode, onToggleDark }) {
  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <>
      <div className="bg-shape bg-shape-top" aria-hidden="true" />
      <div className="bg-shape bg-shape-bottom" aria-hidden="true" />

      <header className="topbar">
        <div className="container nav-wrap">
          <button className="brand" type="button" onClick={() => {}}>
            <img className="brand-logo" src="/images/logo-ignitel.png" alt="Ignitel" />
          </button>

          <button className="btn btn-login" type="button" onClick={onStartLogin}>
            <span className="btn-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M7 11V8.5C7 5.46 9.46 3 12.5 3C15.54 3 18 5.46 18 8.5V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <rect x="5" y="11" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </span>
            Iniciar Sesion
          </button>
        </div>
      </header>

      <main className="landing-main-centered">
        <section className="hero">
          <div className="container hero-content">
            <p className="eyebrow">Software Residencial</p>
            <h1>Gestion Inteligente para<span> Tu Condominio</span></h1>
            <p className="subtitle">
              Plataforma completa de administracion condominial con control de accesos, pagos
              digitales, reservas, asambleas virtuales y mucho mas.
            </p>
            <div className="cta-row">
              <button className="btn btn-primary" type="button" onClick={onStartLogin}>Empezar Ahora</button>
            </div>
            <div className="stats-grid" aria-label="Indicadores de plataforma">
              <article className="stat-card"><strong>100%</strong><span>Digital</span></article>
              <article className="stat-card"><strong>24/7</strong><span>Disponible</span></article>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
