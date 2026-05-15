// Theos Place — Footer
function TPFooter() {
  return (
    <footer className="tp-footer">
      <div className="tp-footer-inner">
        <div className="tp-footer-brand">
          <img src="../../assets/logo-theos-white.png" alt="Theos Place" className="tp-footer-logo" />
          <p className="tp-footer-tag">Comunidad joven · Madrid</p>
        </div>
        <div className="tp-footer-cols">
          <div>
            <div className="tp-footer-head">Vente</div>
            <a>Próximos estudios</a>
            <a>Domingos</a>
            <a>Grupos pequeños</a>
          </div>
          <div>
            <div className="tp-footer-head">Conócenos</div>
            <a>Quiénes somos</a>
            <a>Qué creemos</a>
            <a>Contacto</a>
          </div>
          <div>
            <div className="tp-footer-head">Escríbenos</div>
            <a>hola@theosplace.org</a>
            <a>Gran Vía 22, Madrid</a>
          </div>
        </div>
      </div>
      <div className="tp-footer-bottom">
        <span>© {new Date().getFullYear()} Theos Place</span>
        <span>Hecho con cariño en Madrid</span>
      </div>
    </footer>
  );
}
Object.assign(window, { TPFooter });
