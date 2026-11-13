import type { Tab } from '../../nav'

/**
 * Fondo atmosférico de la app: degradado azul acero con destello cálido, una masa oscura desenfocada
 * (como un atleta en movimiento), estelas de velocidad y grano de película. Todo es CSS/SVG local:
 * funciona sin conexión y sin imágenes externas. Cada sección tiene su propia paleta.
 */
type Key = Tab | 'welcome'
interface Pal { top: string; mid: string; bottom: string; bloom: string; at: string }

const PAL: Record<Key, Pal> = {
  home: { top: '#c3d3e4', mid: '#456482', bottom: '#0b141e', bloom: 'rgba(255,196,140,.62)', at: '18% 42%' },
  gym: { top: '#9db9d1', mid: '#2c4a66', bottom: '#09121b', bloom: 'rgba(255,186,120,.55)', at: '24% 38%' },
  combat: { top: '#b98a7e', mid: '#52303a', bottom: '#0d0a10', bloom: 'rgba(255,128,84,.58)', at: '20% 44%' },
  philosophy: { top: '#d1c2a6', mid: '#625c54', bottom: '#0e0f12', bloom: 'rgba(255,226,166,.55)', at: '70% 30%' },
  progress: { top: '#a9c1da', mid: '#34567a', bottom: '#0a121c', bloom: 'rgba(160,210,255,.45)', at: '78% 34%' },
  profile: { top: '#9aa9bb', mid: '#323d4e', bottom: '#0a0d12', bloom: 'rgba(210,225,255,.38)', at: '30% 36%' },
  welcome: { top: '#cfdcea', mid: '#4a6a8c', bottom: '#070c12', bloom: 'rgba(255,200,146,.75)', at: '16% 50%' },
}

const GRAIN = "url(\"data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E\")"

export function Ambient({ tab, photo, strong = false }: { tab: Key; photo?: string; strong?: boolean }) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none bg-[#05080c]">
      {photo ? (
        <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover scale-110" style={{ filter: 'blur(3px) saturate(1.1) brightness(.85)' }} />
      ) : (
        (Object.keys(PAL) as Key[]).map((k) => (
          <div key={k} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: k === tab ? 1 : 0,
            background: `radial-gradient(70% 36% at ${PAL[k].at}, ${PAL[k].bloom}, transparent 72%), linear-gradient(180deg, ${PAL[k].top} 0%, ${PAL[k].mid} 42%, ${PAL[k].bottom} 100%)` }} />
        ))
      )}
      {!photo && (
        <>
          {/* masa oscura desenfocada: atleta en movimiento */}
          <div className="absolute" style={{ left: '34%', top: '8%', width: '78%', height: '62%', transform: 'rotate(-9deg)', filter: 'blur(26px)',
            background: 'radial-gradient(48% 52% at 50% 42%, rgba(4,8,14,.82), rgba(4,8,14,.35) 55%, transparent 75%)' }} />
          {/* estelas de velocidad */}
          <div className="absolute" style={{ left: '-20%', top: '22%', width: '140%', height: '9%', transform: 'rotate(-14deg)', filter: 'blur(16px)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent)' }} />
          <div className="absolute" style={{ left: '-10%', top: '44%', width: '120%', height: '6%', transform: 'rotate(-14deg)', filter: 'blur(14px)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.12), transparent)' }} />
        </>
      )}
      <div className="absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.2, mixBlendMode: 'overlay' }} />
      {/* velo para que el texto siempre se lea */}
      <div className="absolute inset-0" style={{ background: strong
        ? 'linear-gradient(180deg, rgba(5,8,12,.05) 0%, rgba(5,8,12,.2) 40%, rgba(5,8,12,.88) 100%)'
        : 'linear-gradient(180deg, rgba(5,8,12,.34) 0%, rgba(5,8,12,.58) 50%, rgba(5,8,12,.88) 100%)' }} />
    </div>
  )
}
