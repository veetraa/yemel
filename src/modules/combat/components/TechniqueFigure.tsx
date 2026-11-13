import { StickFigure } from '../../../shared/components/StickFigure'
import { COMBAT_TEMPLATES } from '../data/poses'

/** Figura animada de una técnica de combate en solitario (plantillas propias de COMBAT). */
export function TechniqueFigure({ anim, animated = true, className = '' }: { anim: string; animated?: boolean; className?: string }) {
  return <StickFigure template={COMBAT_TEMPLATES[anim]} animated={animated} className={className} />
}
