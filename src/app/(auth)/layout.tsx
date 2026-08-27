import Image from 'next/image'

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
      className="block"
      style={{ opacity }}
    >
      <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="10" />
      <rect x="14" y="45" width="72" height="10" fill="white" />
    </svg>
  )
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">

      {/* Panel decorativo — solo desktop */}
      <div
        className="hidden lg:flex w-[60%] bg-navy relative overflow-hidden items-center justify-center shrink-0"
      >
        {/* Patrón de thetas */}
        {THETA_POSITIONS.map((pos, i) => (
          <div
            key={i}
            className="absolute"
            style={{
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
          className="relative z-[1] text-center px-12 max-w-[480px]"
        >
          {/* Logo Theos Place */}
          <div className="mb-7 flex justify-center">
            <Image
              src="/logo-theos-white.png"
              alt="Theos Place"
              width={2526}
              height={1280}
              priority
              className="w-[280px] h-auto"
            />
          </div>

          {/* Tagline */}
          <p
            className="font-body text-base text-[rgba(255,255,255,0.7)] leading-[1.6] mb-9 max-w-[340px] mx-auto"
          >
            disfrutá de una relación cada vez más cercana con Dios
          </p>
        </div>
      </div>

      {/* Panel del formulario */}
      <div
        className="flex-1 flex flex-col items-center justify-center py-12 px-8 bg-[#F8FAFB] min-h-screen"
      >
        {/* Logo para MÓVIL/TABLET. El panel decorativo de arriba es `hidden
            lg:flex`, así que abajo de lg no había logo en ninguna parte: la
            pantalla de entrar no decía de quién era. Este es `lg:hidden`, el
            complemento exacto, así que nunca se muestran los dos a la vez.
            Va la versión oscura (logo-theos-original) porque este panel tiene
            fondo claro; la blanca del otro panel desaparecería. */}
        <div className="mb-10 flex justify-center lg:hidden">
          <Image
            src="/logo-theos-original.png"
            alt="Theos Place"
            width={661}
            height={337}
            priority
            className="h-auto w-[180px]"
          />
        </div>
        {children}
      </div>

    </div>
  )
}
