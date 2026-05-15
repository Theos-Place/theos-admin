// Theos Place — Event card
function TPEventCard({ event, featured, onClick }) {
  return (
    <article className={`tp-card tp-event-card${featured ? ' is-featured' : ''}`} onClick={onClick}>
      <div className="tp-event-media" style={{ backgroundImage: `url(${event.image})` }}>
        {featured && <span className="tp-badge tp-badge-coral-solid">Destacado</span>}
      </div>
      <div className="tp-event-body">
        <span className="tp-eyebrow">{event.eyebrow}</span>
        <h3 className="tp-event-title">{event.title}</h3>
        <p className="tp-event-meta">{event.when} · {event.where}</p>
        <div className="tp-event-cta">Apúntate →</div>
      </div>
    </article>
  );
}
Object.assign(window, { TPEventCard });
