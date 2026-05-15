// Theos Place — Hero with full-bleed theta pattern
function TPHero({ onPrimary, onSecondary }) {
  return (
    <section className="tp-hero">
      <div className="tp-hero-bg" />
      <div className="tp-hero-accent" />
      <svg className="tp-hero-theta" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8"/>
        <rect x="14" y="46" width="72" height="8" fill="currentColor"/>
      </svg>
      <div className="tp-hero-inner">
        <span className="tp-eyebrow tp-eyebrow-light">THEOS · PLACE · MADRID</span>
        <h1 className="tp-display">Ven como estés.<br/><span className="tp-display-coral">Aquí hay sitio.</span></h1>
        <p className="tp-hero-sub">
          Somos una comunidad joven en Madrid. Estudiamos, nos reunimos,
          nos hacemos preguntas reales y disfrutamos de algo bueno — juntos.
        </p>
        <div className="tp-hero-ctas">
          <button className="tp-btn tp-btn-primary tp-btn-lg" onClick={onPrimary}>
            Apúntate al próximo estudio
          </button>
          <button className="tp-btn tp-btn-ghost-light" onClick={onSecondary}>
            Ver todos los estudios →
          </button>
        </div>
      </div>
    </section>
  );
}
Object.assign(window, { TPHero });
