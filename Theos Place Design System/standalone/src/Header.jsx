// Theos Place — Header component
function TPHeader({ onNavigate, current }) {
  const links = [
    { id: 'home', label: 'Inicio' },
    { id: 'events', label: 'Estudios' },
    { id: 'community', label: 'Comunidad' },
    { id: 'about', label: 'Nosotros' },
  ];
  return (
    <header className="tp-header">
      <div className="tp-header-inner">
        <a href="#" className="tp-logo" onClick={(e) => { e.preventDefault(); onNavigate('home'); }}>
          <img src="assets/logo-theos-original.png" alt="Theos Place" />
        </a>
        <nav className="tp-nav">
          {links.map(l => (
            <a
              key={l.id}
              href="#"
              className={`tp-nav-link${current === l.id ? ' is-active' : ''}`}
              onClick={(e) => { e.preventDefault(); onNavigate(l.id); }}
            >{l.label}</a>
          ))}
        </nav>
        <button className="tp-btn tp-btn-primary tp-btn-sm" onClick={() => onNavigate('signup')}>
          Apúntate
        </button>
      </div>
    </header>
  );
}
Object.assign(window, { TPHeader });
