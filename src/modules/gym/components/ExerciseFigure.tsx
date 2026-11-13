import { StickFigure } from '../../../shared/components/StickFigure'
import { TEMPLATES } from '../data/poses'

/** Figura animada de un ejercicio de musculación (plantillas propias de GYM). */
export function ExerciseFigure({ anim, primary, animated = true, className = '' }: { anim: string; primary?: string; animated?: boolean; className?: string }) {
  return <StickFigure template={TEMPLATES[anim] ?? TEMPLATES.squat} primary={primary} animated={animated} className={className} />
}
