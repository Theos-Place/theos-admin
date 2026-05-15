// Theos Place — Event grid section
function TPEventGrid({ events, onPick }) {
  return (
    <section className="tp-section">
      <div className="tp-section-head">
        <div>
          <span className="tp-eyebrow">PRÓXIMOS · ESTUDIOS</span>
          <h2 className="tp-h2">¿Te vienes?</h2>
        </div>
        <a href="#" className="tp-link-arrow" onClick={(e) => e.preventDefault()}>Ver todo →</a>
      </div>
      <div className="tp-event-grid">
        {events.map((e, i) => (
          <TPEventCard key={e.id} event={e} featured={i === 0} onClick={() => onPick(e)} />
        ))}
      </div>
    </section>
  );
}
Object.assign(window, { TPEventGrid });
