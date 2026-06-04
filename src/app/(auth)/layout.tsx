const THETA_POSITIONS = [
  { top: '8%',  left:  '12%',  size: 120, opacity: 0.06 },
  { top: '15%', right: '8%',   size: 60,  opacity: 0.04 },
  { top: '45%', left:  '5%',   size: 80,  opacity: 0.08 },
  { top: '60%', right: '15%',  size: 140, opacity: 0.05 },
  { top: '75%', left:  '25%',  size: 50,  opacity: 0.07 },
  { top: '85%', right: '5%',   size: 90,  opacity: 0.04 },
  { top: '30%', left:  '40%',  size: 200, opacity: 0.03 },
  { top: '5%',  left:  '55%',  size: 40,  opacity: 0.06 },
]

function ThetaSVG({ size, opacity }: { size: number; opacity: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      style={{ opacity, display: 'block' }}
    >
      <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="10" />
      <rect x="14" y="45" width="72" height="10" fill="white" />
    </svg>
  )
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* Panel decorativo — solo desktop */}
      <div
        className="hidden lg:flex"
        style={{
          width: '60%',
          background: '#161440',
          position: 'relative',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {/* Patrón de thetas */}
        {THETA_POSITIONS.map((pos, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top:    pos.top,
              left:   (pos as { left?: string }).left,
              right:  (pos as { right?: string }).right,
            }}
          >
            <ThetaSVG size={pos.size} opacity={pos.opacity} />
          </div>
        ))}

        {/* Contenido central */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            padding: '0 48px',
            maxWidth: 480,
          }}
        >
          {/* Logo texto */}
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 72,
                fontWeight: 800,
                color: 'white',
                lineHeight: 0.9,
                letterSpacing: '-0.03em',
              }}
            >
              Theos
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 800,
                color: '#70BDC2',
                letterSpacing: '0.35em',
                marginTop: 4,
              }}
            >
              PLACE
            </div>
          </div>

          {/* Tagline */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 16,
              color: 'rgba(255,255,255,0.7)',
              lineHeight: 1.6,
              marginBottom: 36,
              maxWidth: 340,
              margin: '0 auto 36px',
            }}
          >
            disfrutá de una relación cada vez más cercana con Dios
          </p>
        </div>
      </div>

      {/* Panel del formulario */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 32px',
          background: '#F8FAFB',
          minHeight: '100vh',
        }}
      >
        {children}
      </div>

    </div>
  )
}
