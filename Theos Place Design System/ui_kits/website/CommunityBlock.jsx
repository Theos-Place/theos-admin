// Theos Place — Full-bleed teal community block
function TPCommunityBlock({ onJoin }) {
  return (
    <section className="tp-community">
      <div className="tp-community-inner">
        <span className="tp-eyebrow tp-eyebrow-coral-solid">COMUNIDAD</span>
        <h2 className="tp-h1-on-teal">Personas reales.<br/>Conversaciones honestas.</h2>
        <p className="tp-community-sub">
          No hace falta tener respuestas. Tráete tus preguntas y
          nos las hacemos juntos — con café, con tiempo, sin prisa.
        </p>
        <button className="tp-btn tp-btn-navy" onClick={onJoin}>
          Únete a un grupo
        </button>
      </div>
    </section>
  );
}
Object.assign(window, { TPCommunityBlock });
