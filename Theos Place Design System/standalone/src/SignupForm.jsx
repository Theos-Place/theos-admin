// Theos Place — Signup form
function TPSignupForm({ event, onSubmit, onCancel }) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [firstTime, setFirstTime] = React.useState(true);
  const [news, setNews] = React.useState(true);
  const [done, setDone] = React.useState(false);

  const submit = (e) => {
    e.preventDefault();
    setDone(true);
    setTimeout(() => onSubmit && onSubmit({ name, email, firstTime, news }), 1200);
  };

  if (done) {
    return (
      <div className="tp-signup-done">
        <div className="tp-signup-check">✓</div>
        <h2 className="tp-h2">¡Nos vemos, {name || 'tú'}!</h2>
        <p className="tp-body-lg">Te hemos guardado sitio para <strong>{event?.title || 'el próximo estudio'}</strong>. Te escribimos con los detalles.</p>
      </div>
    );
  }
  return (
    <form className="tp-signup" onSubmit={submit}>
      <span className="tp-eyebrow">APÚNTATE</span>
      <h2 className="tp-h2">{event ? event.title : 'Al próximo estudio'}</h2>
      {event && <p className="tp-signup-meta">{event.when} · {event.where}</p>}

      <div className="tp-field">
        <label className="tp-label">Cómo te llamas</label>
        <input className="tp-input" value={name} onChange={e => setName(e.target.value)} placeholder="María" required />
      </div>
      <div className="tp-field">
        <label className="tp-label">Tu email</label>
        <input className="tp-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required />
      </div>

      <label className="tp-check">
        <span className={`tp-check-box${firstTime ? ' on' : ''}`}>{firstTime ? '✓' : ''}</span>
        <input type="checkbox" checked={firstTime} onChange={e => setFirstTime(e.target.checked)} style={{ display: 'none' }} />
        <span>Es la primera vez que vengo</span>
      </label>
      <label className="tp-check">
        <span className={`tp-check-box${news ? ' on' : ''}`}>{news ? '✓' : ''}</span>
        <input type="checkbox" checked={news} onChange={e => setNews(e.target.checked)} style={{ display: 'none' }} />
        <span>Quiero que me escribáis con novedades</span>
      </label>

      <div className="tp-signup-actions">
        <button type="button" className="tp-btn tp-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="tp-btn tp-btn-primary tp-btn-lg">Apúntame</button>
      </div>
    </form>
  );
}
Object.assign(window, { TPSignupForm });
