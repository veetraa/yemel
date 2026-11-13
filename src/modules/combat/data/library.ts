/**
 * Biblioteca técnica de COMBAT. Cada disciplina tiene sus propias técnicas, entrenos y consejos.
 * Contenido de referencia para practicar; no sustituye a un entrenador.
 */
import type { CombatSport } from '../types'

export interface Technique {
  id: string
  name: string
  category: string
  level: 'Básico' | 'Intermedio' | 'Avanzado'
  summary: string
  steps: string[]
  cues: string[]
  mistakes: string[]
  /** Plantilla de figura animada (ejercicios en solitario) */
  anim?: string
}

export interface TrainingBlock { name: string; minutes: number; detail: string }
export interface Training {
  id: string
  name: string
  minutes: number
  /** Intensidad orientativa: se registra la real al terminar */
  intensity: 'light' | 'moderate' | 'hard'
  goal: string
  blocks: TrainingBlock[]
  techniques: string[]
}

export interface SportLibrary {
  sport: CombatSport
  tagline: string
  description: string
  techniques: Technique[]
  trainings: Training[]
  tips: string[]
}

const T = (id: string, name: string, category: string, level: Technique['level'], summary: string, steps: string[], cues: string[], mistakes: string[], anim?: string): Technique =>
  ({ id, name, category, level, summary, steps, cues, mistakes, anim })

const MMA: SportLibrary = {
  sport: 'MMA',
  tagline: 'Striking, lucha y suelo en un mismo sistema',
  description: 'Artes marciales mixtas: lo que importa son las transiciones entre golpeo, derribo y control. Entrena cada fase y, sobre todo, el paso de una a otra.',
  techniques: [
    T('mma-stance', 'Postura de MMA', 'Fundamentos', 'Básico', 'Base versátil: lista para golpear, defender un derribo y moverse.', ['Pies algo más anchos que los hombros, pie retrasado de puntillas.', 'Rodillas flexionadas y peso ligeramente adelantado.', 'Manos altas, codos cerrados, barbilla baja.', 'Muévete con pasos cortos sin cruzar nunca los pies.'], ['Cabeza fuera de la línea central.', 'Mantén la guardia aunque estés cansado.'], ['Pies demasiado juntos.', 'Peso atrás: te desequilibra ante un derribo.']),
    T('mma-jab-cross', 'Jab–directo (1-2)', 'Striking', 'Básico', 'La combinación base: mide la distancia y conecta con la mano retrasada.', ['Lanza el jab y recoge la mano a la mejilla.', 'Rota cadera y pie trasero para el directo.', 'Termina en guardia o con un paso lateral de salida.'], ['La potencia nace del suelo y la cadera.', 'Respira al golpear.'], ['Bajar la mano contraria al lanzar.', 'Golpear sin recuperar la guardia.'], 'jab'),
    T('mma-low-kick', 'Low kick', 'Striking', 'Básico', 'Patada baja a la pierna adelantada del rival: castiga y frena su avance.', ['Da un paso de salida con el pie delantero.', 'Gira cadera y pie de apoyo mientras lanzas la patada.', 'Impacta con la espinilla en el muslo, no en la rodilla.', 'Recoge la pierna y vuelve a guardia.'], ['Cadera abierta, tronco ligeramente atrás.', 'Mira por encima del hombro adelantado.'], ['Patear sin girar el pie de apoyo.', 'Bajar la guardia al lanzar.'], 'lowKick'),
    T('mma-sprawl', 'Sprawl (defensa de derribo)', 'Defensa de derribo', 'Básico', 'Lanza las caderas atrás y abajo para frenar la entrada a las piernas.', ['Al ver el cambio de nivel, lanza las piernas hacia atrás.', 'Caderas pesadas hacia el suelo, pecho sobre la espalda del rival.', 'Controla los brazos y gira para quedar arriba o recuperar la base.'], ['Rápido y pesado a la vez.', 'Cabeza arriba, mirada al rival.'], ['Llegar tarde: reacciona al cambio de nivel, no al contacto.', 'Dejar las caderas altas.'], 'sprawl'),
    T('mma-shot', 'Entrada a las piernas (single/double)', 'Wrestling', 'Intermedio', 'Cambio de nivel y penetración para derribar.', ['Finta con la mano para desviar su atención.', 'Cambia de nivel con la espalda recta y da un paso de penetración.', 'Cabeza pegada a la cadera del rival; agarra y levanta.', 'Termina empujando con las piernas, no tirando con los brazos.'], ['Rodilla de penetración casi al suelo.', 'Hombros sobre las caderas, espalda recta.'], ['Entrar sin finta: es predecible.', 'Agachar la cabeza hacia el suelo.'], 'shot'),
    T('mma-clinch', 'Control en el clinch (cage/pared)', 'Transiciones', 'Intermedio', 'Controla la distancia corta: golpea, desequilibra o derriba.', ['Entra con las manos arriba y toma el control de cuello y bíceps.', 'Mantén los codos dentro y la cadera pegada.', 'Desequilibra con empujes y tirones alternos.', 'Elige: rodillazo, derribo o salida.'], ['Frente con frente: tu cabeza manda.', 'Pasos cortos, siempre en base.'], ['Cruzar los pies.', 'Agarrar con los brazos rígidos y quedar expuesto.']),
    T('mma-gnp', 'Control y golpeo desde arriba (ground and pound)', 'Suelo', 'Avanzado', 'Domina la posición antes de golpear.', ['Asegura la posición (side control o montada).', 'Controla su cadera y su brazo más cercano.', 'Golpea con base amplia sin perder el control.', 'Si se defiende, transiciona a sumisión.'], ['Posición antes que daño.', 'Pesa sobre él, no te apoyes en el suelo.'], ['Golpear con la base estrecha y rodar.', 'Sacrificar la posición por un golpe.']),
    T('mma-getup', 'Levantarse con la pared / técnico', 'Escapes', 'Intermedio', 'Vuelve a pie desde el suelo sin exponerte.', ['Apoya una mano y el pie cercano; mantén la otra mano defendiendo la cabeza.', 'Sube las caderas y apóyate en la pared o la jaula.', 'Sube la espalda por la pared hasta ponerte de pie en guardia.'], ['Una mano siempre cuida la cabeza.', 'Pegado a la pared.'], ['Levantarte sin controlar sus muñecas.', 'Dar la espalda al rival.']),
  ],
  trainings: [
    { id: 'mma-technical', name: 'Sesión técnica integrada', minutes: 75, intensity: 'light', goal: 'Mejorar transiciones sin buscar fatiga', blocks: [{ name: 'Calentamiento y movilidad', minutes: 10, detail: 'Movilidad de cadera y hombros, desplazamientos.' }, { name: 'Striking técnico', minutes: 20, detail: 'Jab–directo, low kick y defensa, a ritmo controlado.' }, { name: 'Lucha y derribos', minutes: 20, detail: 'Entradas, sprawl y control en clinch con compañero.' }, { name: 'Suelo', minutes: 15, detail: 'Escapes y levantarse con resistencia ligera.' }, { name: 'Enfriamiento', minutes: 10, detail: 'Respiración y estiramientos suaves.' }], techniques: ['mma-jab-cross', 'mma-sprawl', 'mma-shot'] },
    { id: 'mma-rounds', name: 'Rondas de situaciones', minutes: 60, intensity: 'moderate', goal: 'Aplicar la técnica a ritmo real sin sparring completo', blocks: [{ name: 'Calentamiento', minutes: 10, detail: 'Cuerda o sombra, movilidad.' }, { name: '5 × 4 min de situaciones', minutes: 30, detail: 'Cada ronda: una situación (clinch, derribo, escape) con resistencia progresiva.' }, { name: 'Condición específica', minutes: 10, detail: 'Intervalos de sprawl + levantarse.' }, { name: 'Enfriamiento', minutes: 10, detail: 'Movilidad y respiración.' }], techniques: ['mma-clinch', 'mma-getup'] },
    { id: 'mma-sparring', name: 'Sparring controlado', minutes: 70, intensity: 'hard', goal: 'Probar tu juego con presión; solo si estás recuperado', blocks: [{ name: 'Calentamiento', minutes: 15, detail: 'Sombra, movilidad y técnica ligera.' }, { name: 'Rondas de sparring', minutes: 30, detail: '4–6 rondas de 5 min, contacto y ritmo pactados con el compañero.' }, { name: 'Análisis', minutes: 10, detail: 'Anota lo que funcionó y lo que no.' }, { name: 'Enfriamiento', minutes: 15, detail: 'Vuelta a la calma y movilidad.' }], techniques: ['mma-stance', 'mma-gnp'] },
  ],
  tips: ['Aprende las transiciones: ahí se ganan y se pierden los combates.', 'No todo entreno es sparring: alterna técnica ligera, situaciones y rondas.', 'Antes de un sparring duro, evita piernas muy cargadas el día anterior.', 'Anota tras cada sesión una cosa que corregir; es el mejor progreso.', 'Hidratación y sueño pesan más que otra ronda extra.'],
}

const BJJ: SportLibrary = {
  sport: 'Brazilian Jiu-Jitsu',
  tagline: 'Control, palancas y estrangulaciones en el suelo',
  description: 'El arte suave: usa técnica, posición y apalancamiento. Progresa posición antes que sumisión y entrena a un ritmo que permita aprender.',
  techniques: [
    T('bjj-shrimp', 'Hip escape (shrimp)', 'Movimiento', 'Básico', 'El movimiento base para crear espacio y recuperar guardia.', ['Tumbado boca arriba, apoya un pie y el hombro contrario.', 'Empuja con el pie y lleva las caderas hacia un lado.', 'Gira sobre el hombro y recoge la rodilla hacia dentro.', 'Repite al otro lado.'], ['Caderas ligeras, hombros pegados al suelo.', 'Ritmo constante, sin saltos.'], ['Moverse con los brazos en vez de con las caderas.', 'Levantar los hombros del suelo.'], 'shrimp'),
    T('bjj-bridge', 'Puente (upa)', 'Escapes', 'Básico', 'Eleva y gira las caderas para desequilibrar desde la montada.', ['Atrapa un brazo y su pie del mismo lado.', 'Apoya los pies y sube las caderas.', 'Gira sobre el hombro hacia el brazo atrapado.', 'Termina arriba en posición de control.'], ['Atrapar brazo y pie evita que se apoye.', 'Explosivo, pero con control.'], ['Puentear sin atrapar el brazo.', 'Empujar con la cabeza en vez de las caderas.'], 'bridge'),
    T('bjj-closed-guard', 'Guardia cerrada: control', 'Guardia', 'Básico', 'Controla postura y distancia con las piernas.', ['Cruza los tobillos tras su espalda.', 'Rompe su postura con las manos y las piernas.', 'Controla sus mangas y colócalo para atacar.', 'Abre y cambia de ángulo si te defiende.'], ['Caderas activas: muévelas siempre.', 'Controla la postura antes de atacar.'], ['Cerrar solo las piernas sin controlar los brazos.', 'Estar pegado al suelo sin mover las caderas.']),
    T('bjj-guard-pass', 'Pasaje de guardia (toreando)', 'Pasaje', 'Intermedio', 'Evita las piernas y pasa al control lateral.', ['Agarra los pantalones a la altura de las rodillas.', 'Empuja las piernas hacia un lado y camina al otro.', 'Cae en control lateral con presión de hombro.', 'Estabiliza antes de buscar sumisión.'], ['Pasa por encima de las piernas con ritmo.', 'Cabeza arriba.'], ['Pasar con la espalda curvada.', 'Dejar un hueco entre tu pecho y el suyo.']),
    T('bjj-side-control', 'Control lateral: presión y escape', 'Control', 'Intermedio', 'Mantén o escapa del control lateral.', ['Arriba: presión de pecho, brazo por encima de la cabeza.', 'Abajo: crea marcos con los antebrazos y gira hacia él.', 'Escapa con hip escape y recupera guardia.'], ['Abajo, los marcos antes que el empuje.', 'Arriba, peso en el pecho.'], ['Quedarse boca arriba sin marcos.', 'Empujar con los brazos estirados.']),
    T('bjj-armbar', 'Armbar desde guardia', 'Sumisiones', 'Intermedio', 'Palanca al codo desde guardia cerrada.', ['Controla su muñeca y abre su postura.', 'Sube la cadera y pasa una pierna sobre su cabeza.', 'Une las rodillas y aprieta el brazo contra tu pecho.', 'Extiende las caderas con control; suelta al primer toque.'], ['Pulgar hacia arriba, rodillas juntas.', 'Aplica la palanca de forma progresiva.'], ['Soltar la muñeca antes de pasar la pierna.', 'Aplicar fuerza de golpe.']),
    T('bjj-rnc', 'Estrangulación por detrás (RNC)', 'Sumisiones', 'Avanzado', 'Control de espalda y estrangulación.', ['Consigue control de espalda con ganchos y arnés.', 'Pasa el brazo bajo la barbilla y asegura con el otro.', 'Cierra el codo y expande el pecho.', 'Suelta de inmediato al golpeo de tapping.'], ['Control de espalda antes que estrangulación.', 'Codo bajo la barbilla, nunca sobre la cara.'], ['Estrangular sin control de caderas.', 'Seguir apretando tras el aviso del compañero.']),
    T('bjj-guard-retention', 'Retención de guardia', 'Guardia', 'Intermedio', 'Evita que te pasen la guardia con marcos y ángulos.', ['Mantén los pies entre tú y el rival.', 'Usa los marcos de rodilla y antebrazo.', 'Gira sobre las caderas para mantenerte de frente.'], ['Piernas activas entre vosotros.', 'Cadera móvil, no pegada al suelo.'], ['Dejar las rodillas separadas.', 'Girar de espaldas sin recuperar guardia.']),
  ],
  trainings: [
    { id: 'bjj-drill', name: 'Sesión de drills técnicos', minutes: 60, intensity: 'light', goal: 'Grabar el movimiento con repeticiones limpias', blocks: [{ name: 'Calentamiento de suelo', minutes: 10, detail: 'Shrimp, puente, rollos y movilidad.' }, { name: 'Drill de la técnica del día', minutes: 25, detail: '3 series de 8 repeticiones por lado, ritmo lento y sin resistencia.' }, { name: 'Rolas ligeras de posición', minutes: 15, detail: 'Empezando desde una posición concreta, 3 min por ronda.' }, { name: 'Enfriamiento', minutes: 10, detail: 'Respiración y estiramientos.' }], techniques: ['bjj-shrimp', 'bjj-bridge'] },
    { id: 'bjj-positional', name: 'Rolas posicionales', minutes: 60, intensity: 'moderate', goal: 'Aplicar posiciones con resistencia progresiva', blocks: [{ name: 'Calentamiento', minutes: 10, detail: 'Movilidad y movimientos de suelo.' }, { name: 'Rondas posicionales', minutes: 35, detail: '6 rondas de 5 min desde guardia/control lateral/espalda.' }, { name: 'Análisis', minutes: 5, detail: 'Anota una posición que mejorar.' }, { name: 'Enfriamiento', minutes: 10, detail: 'Vuelta a la calma.' }], techniques: ['bjj-guard-pass', 'bjj-side-control'] },
    { id: 'bjj-rolling', name: 'Rolas libres', minutes: 75, intensity: 'hard', goal: 'Probar tu juego a ritmo real', blocks: [{ name: 'Calentamiento', minutes: 15, detail: 'Movilidad y técnica ligera.' }, { name: 'Rolas', minutes: 40, detail: '5–7 rondas de 5 min con distintos compañeros.' }, { name: 'Revisión', minutes: 10, detail: 'Qué te pasaron y qué quieres aprender.' }, { name: 'Enfriamiento', minutes: 10, detail: 'Movilidad.' }], techniques: ['bjj-closed-guard', 'bjj-armbar'] },
  ],
  tips: ['Posición antes que sumisión: sin control no hay finalización.', 'Haz tapping pronto y a menudo; protege tus articulaciones.', 'Relájate al rolar: la tensión gasta energía y limita la técnica.', 'Aprende pocas técnicas y repítelas muchas veces.', 'Cuida la piel y el equipo: higiene y uñas cortas.'],
}

const BOX: SportLibrary = {
  sport: 'Boxeo',
  tagline: 'Golpeo con las manos, juego de pies y defensa',
  description: 'El boxeo se construye sobre una buena postura, juego de pies y defensa. La potencia llega cuando la técnica es limpia.',
  techniques: [
    T('box-stance', 'Guardia y postura', 'Fundamentos', 'Básico', 'La base de todo: equilibrio, protección y movilidad.', ['Pies a la anchura de los hombros, el retrasado levemente girado.', 'Rodillas flexionadas, peso entre ambos pies.', 'Manos cerca de la cara, codos protegiendo las costillas.', 'Barbilla baja y hombros relajados.'], ['Pies sin cruzar nunca.', 'Mirada al rival, no a sus manos.'], ['Manos bajas.', 'Postura demasiado rígida.']),
    T('box-jab', 'Jab', 'Golpes', 'Básico', 'El golpe más rápido: mide, distrae y prepara.', ['Extiende la mano delantera en línea recta.', 'Gira el puño al final y recoge a la misma ruta.', 'Acompáñalo con un pequeño paso adelante.'], ['Hombro protege la barbilla.', 'Rápido a la ida y a la vuelta.'], ['Bajar la mano antes de golpear.', 'Echar el cuerpo adelante.'], 'jab'),
    T('box-cross', 'Directo (cross)', 'Golpes', 'Básico', 'Golpe de potencia con la mano retrasada.', ['Empuja con el pie trasero y rota cadera y hombro.', 'Extiende el brazo en línea recta.', 'La mano delantera protege la barbilla.', 'Vuelve a guardia.'], ['La potencia es de piernas y cadera.', 'El talón trasero gira.'], ['Golpear solo con el brazo.', 'Perder el equilibrio hacia adelante.'], 'cross'),
    T('box-hook', 'Gancho', 'Golpes', 'Intermedio', 'Golpe circular a la cabeza o al cuerpo.', ['Gira el pie delantero y la cadera.', 'Codo a la altura del puño, ángulo de ~90°.', 'El golpe lo da la rotación del cuerpo.', 'Recupera la guardia.'], ['Rota como una puerta sobre su bisagra.', 'Compacto y cerca.'], ['Abrir demasiado el brazo.', 'Mover solo el hombro.']),
    T('box-uppercut', 'Uppercut', 'Golpes', 'Intermedio', 'Golpe ascendente a corta distancia.', ['Flexiona ligeramente las rodillas.', 'Extiende las piernas y rota la cadera.', 'Lleva el puño en vertical, palma hacia ti.', 'Vuelve a guardia.'], ['Sube desde las piernas.', 'Solo a corta distancia.'], ['Bajar la mano demasiado.', 'Lanzarlo de lejos.']),
    T('box-slip', 'Esquiva (slip) y roll', 'Defensa', 'Intermedio', 'Esquiva golpes moviendo la cabeza sin retroceder.', ['Flexiona rodillas y desplaza la cabeza hacia un lado.', 'El golpe pasa por encima del hombro.', 'Contraataca de inmediato.'], ['Mueve el cuerpo, no solo el cuello.', 'Los ojos siempre en el rival.'], ['Agachar la cabeza sin flexionar las rodillas.', 'Cerrar los ojos.']),
    T('box-footwork', 'Juego de pies', 'Movimiento', 'Básico', 'Controla distancia y ángulos.', ['Da pasos cortos manteniendo la base.', 'Avanza con el pie delantero, retrocede con el trasero.', 'Practica pasos laterales para ángulos.'], ['El pie que está más cerca del movimiento sale primero.', 'Siempre en equilibrio.'], ['Cruzar los pies.', 'Saltar demasiado.']),
    T('box-shadow', 'Sombra (shadowboxing)', 'Entrenamiento', 'Básico', 'Trabaja técnica y movimiento sin oponente.', ['Visualiza un rival y muévete.', 'Combina golpes y defensas con ritmo.', 'Trabaja rondas de 3 min con 1 min de descanso.'], ['Calidad antes que velocidad.', 'Respira de forma constante.'], ['Golpear al aire sin equilibrio.', 'Olvidar la defensa.'], 'jab'),
  ],
  trainings: [
    { id: 'box-technical', name: 'Técnica de boxeo', minutes: 60, intensity: 'light', goal: 'Pulir golpes, defensa y juego de pies', blocks: [{ name: 'Calentamiento', minutes: 10, detail: 'Cuerda y movilidad de hombros y cadera.' }, { name: 'Sombra', minutes: 15, detail: '4 rondas de 3 min trabajando una técnica por ronda.' }, { name: 'Saco o manoplas', minutes: 20, detail: '4 rondas de 3 min con combinaciones a ritmo controlado.' }, { name: 'Core y enfriamiento', minutes: 15, detail: 'Abdomen suave y estiramientos.' }], techniques: ['box-jab', 'box-cross', 'box-footwork'] },
    { id: 'box-bag', name: 'Saco y condición', minutes: 55, intensity: 'moderate', goal: 'Resistencia con golpeo', blocks: [{ name: 'Calentamiento', minutes: 10, detail: 'Cuerda y sombra.' }, { name: 'Saco pesado', minutes: 30, detail: '6 rondas de 3 min, combinaciones de 3–5 golpes.' }, { name: 'Core', minutes: 5, detail: 'Abdominales controlados.' }, { name: 'Enfriamiento', minutes: 10, detail: 'Estiramientos.' }], techniques: ['box-hook', 'box-uppercut'] },
    { id: 'box-sparring', name: 'Sparring técnico', minutes: 60, intensity: 'hard', goal: 'Probar defensa y reacción con ritmo pactado', blocks: [{ name: 'Calentamiento', minutes: 15, detail: 'Sombra y movilidad.' }, { name: 'Sparring', minutes: 30, detail: '5–8 rondas de 3 min con contacto pactado y protecciones.' }, { name: 'Análisis', minutes: 5, detail: 'Qué defensa funcionó.' }, { name: 'Enfriamiento', minutes: 10, detail: 'Estiramientos.' }], techniques: ['box-slip'] },
  ],
  tips: ['Los pies primero: un buen equilibrio multiplica la potencia.', 'Respira con cada golpe para no atragantarte en las rondas.', 'Mantén la mano trasera pegada a la cara cuando lances el jab.', 'Entrena la defensa tanto como el ataque.', 'Protege las muñecas con vendas bien colocadas.'],
}

const KB: SportLibrary = {
  sport: 'Kickboxing',
  tagline: 'Puños y patadas con rodillazos de apoyo',
  description: 'Combina el boxeo con patadas. La clave es la distancia, el equilibrio y llevar la cadera con cada técnica.',
  techniques: [
    T('kb-stance', 'Guardia de kickboxing', 'Fundamentos', 'Básico', 'Postura con peso equilibrado para golpear y patear.', ['Pies al ancho de los hombros, peso más repartido que en boxeo.', 'Manos altas y codos cerrados.', 'Rodillas flexionadas y listos para levantar la pierna.'], ['Peso repartido: poder patear con cualquier pierna.', 'Mirada al pecho del rival.'], ['Apoyar todo el peso en el pie adelantado.', 'Guardia baja al patear.']),
    T('kb-teep', 'Teep (patada frontal de empuje)', 'Patadas', 'Básico', 'Empuja al rival y controla la distancia.', ['Levanta la rodilla de la pierna adelantada.', 'Extiende la cadera y empuja con la planta del pie.', 'Recoge y vuelve a guardia.'], ['Rodilla alta antes de extender.', 'Cadera adelante.'], ['Patear con el pie en lugar de la cadera.', 'Inclinarse hacia atrás.'], 'teep'),
    T('kb-round', 'Roundhouse (patada circular)', 'Patadas', 'Intermedio', 'Patada circular al muslo, costillas o cabeza.', ['Gira el pie de apoyo 90–180°.', 'Rota la cadera y lanza la pierna en arco.', 'Impacta con la espinilla.', 'Recoge la pierna y vuelve a guardia.'], ['La cadera arrastra la pierna.', 'Brazo trasero hacia abajo para equilibrar.'], ['No girar el pie de apoyo.', 'Bajar la guardia.'], 'lowKick'),
    T('kb-check', 'Check de patada', 'Defensa', 'Intermedio', 'Bloquea las patadas con la espinilla.', ['Levanta la rodilla del lado golpeado.', 'Gira la espinilla hacia la patada.', 'Mantén las manos altas y el tronco compacto.'], ['Rodilla alta y espinilla hacia fuera.', 'Responde con un contragolpe.'], ['Bloquear con el pie.', 'Mover solo la pierna sin el tronco.']),
    T('kb-knee', 'Rodillazo (clinch)', 'Clinch', 'Intermedio', 'Rodilla a corta distancia en el clinch.', ['Controla la nuca o los hombros.', 'Tira del rival hacia ti.', 'Sube la rodilla hacia el abdomen con la cadera.', 'Pasa de rodillazo a salida.'], ['La rodilla sube con la cadera.', 'Control de cabeza continuo.'], ['Perder el control del cuello.', 'Rodillazo sin cadera.'], 'knee'),
    T('kb-combo', 'Combinación puños–patada', 'Combinaciones', 'Intermedio', 'Jab–directo seguido de patada a la pierna.', ['Lanza jab–directo.', 'Aprovecha la rotación del directo para la patada.', 'Vuelve a guardia con un paso de salida.'], ['La rotación del directo alimenta la patada.', 'Salida lateral tras el combo.'], ['Detenerse entre la mano y la patada.', 'Quedarse a distancia de contraataque.'], 'jab'),
    T('kb-footwork', 'Desplazamientos y ángulos', 'Movimiento', 'Básico', 'Controla la distancia y los ángulos de salida.', ['Pasos cortos y equilibrados.', 'Practica pasos laterales tras cada combinación.', 'Cambia de ángulo antes de que el rival conteste.'], ['Siempre salir de la línea central.', 'Peso listo para patear.'], ['Quedarse en la línea del rival.', 'Cruzar los pies.']),
  ],
  trainings: [
    { id: 'kb-technical', name: 'Técnica de patadas y puños', minutes: 60, intensity: 'light', goal: 'Mecánica limpia de patadas y combinaciones', blocks: [{ name: 'Calentamiento', minutes: 10, detail: 'Movilidad de cadera y cuerda.' }, { name: 'Patadas en el aire', minutes: 15, detail: '3 series por pierna de teep, circular y check.' }, { name: 'Manoplas', minutes: 25, detail: '5 rondas de 3 min con combinaciones puños–patada.' }, { name: 'Enfriamiento', minutes: 10, detail: 'Estiramientos de cadera y cuádriceps.' }], techniques: ['kb-teep', 'kb-round', 'kb-combo'] },
    { id: 'kb-bag', name: 'Saco pesado', minutes: 55, intensity: 'moderate', goal: 'Potencia y resistencia', blocks: [{ name: 'Calentamiento', minutes: 10, detail: 'Cuerda y sombra.' }, { name: 'Saco', minutes: 30, detail: '6 rondas de 3 min alternando combos y patadas.' }, { name: 'Core', minutes: 5, detail: 'Trabajo abdominal.' }, { name: 'Enfriamiento', minutes: 10, detail: 'Estiramientos.' }], techniques: ['kb-round', 'kb-knee'] },
    { id: 'kb-sparring', name: 'Sparring ligero–medio', minutes: 60, intensity: 'hard', goal: 'Aplicar distancia y defensa de patadas', blocks: [{ name: 'Calentamiento', minutes: 15, detail: 'Sombra y movilidad.' }, { name: 'Sparring', minutes: 30, detail: '5–6 rondas de 3 min con contacto pactado y protecciones.' }, { name: 'Análisis', minutes: 5, detail: 'Qué patadas conectaron.' }, { name: 'Enfriamiento', minutes: 10, detail: 'Estiramientos.' }], techniques: ['kb-check'] },
  ],
  tips: ['La cadera hace la patada: si solo mueves la pierna, pierdes potencia.', 'Calienta bien aductores y flexores antes de patear.', 'Practica con ambas piernas, aunque una sea tu favorita.', 'Tras cada patada, vuelve a guardia: es cuando te contraatacan.', 'Protege espinillas y entrena la zona con progresión.']
}

const WR: SportLibrary = {
  sport: 'Wrestling',
  tagline: 'Derribos, control y presión constante',
  description: 'La lucha libre construye base, control y derribos. Es un deporte físico: respeta la progresión y el calentamiento de cuello y hombros.',
  techniques: [
    T('wr-stance', 'Postura de lucha', 'Fundamentos', 'Básico', 'Base baja y equilibrada para atacar y defender.', ['Pies más anchos que los hombros, rodillas flexionadas.', 'Espalda recta, cabeza arriba.', 'Brazos al frente listos para el contacto de manos.', 'Muévete con pasos cortos y en equilibrio.'], ['Caderas bajas, espalda recta.', 'Siempre en movimiento.'], ['Inclinarse hacia delante.', 'Cruzar los pies.']),
    T('wr-level', 'Cambio de nivel', 'Entradas', 'Básico', 'Baja la cadera y la altura sin inclinarte.', ['Flexiona las rodillas manteniendo la espalda recta.', 'Mira al rival, no al suelo.', 'Combina con una finta de manos.'], ['Cambia de nivel con las piernas, no con la espalda.', 'Cabeza arriba.'], ['Bajar la cabeza hacia el suelo.', 'Hacerlo sin finta.'], 'shot'),
    T('wr-double', 'Double leg', 'Derribos', 'Intermedio', 'Derribo a las dos piernas con penetración.', ['Cambio de nivel y paso de penetración.', 'Cabeza junto a la cadera, manos tras las rodillas.', 'Empuja con las piernas y gira hacia un lado.', 'Termina arriba en control.'], ['Rodilla de penetración casi al suelo.', 'Hombros sobre las caderas.'], ['Entrar con la cabeza baja.', 'Tirar de las piernas solo con los brazos.'], 'shot'),
    T('wr-single', 'Single leg', 'Derribos', 'Intermedio', 'Derribo a una pierna con varias finalizaciones.', ['Cambio de nivel hacia la pierna adelantada.', 'Agarra el muslo y mantén la cabeza pegada.', 'Levántate con la pierna entre tus manos.', 'Termina con un barrido o un giro.'], ['Cabeza pegada a la cadera.', 'Pasos cortos y constantes.'], ['Quedarse parado con la pierna agarrada.', 'Perder el contacto de cabeza.'], 'shot'),
    T('wr-sprawl', 'Sprawl', 'Defensa', 'Básico', 'Defiende el derribo lanzando las caderas atrás.', ['Reacciona al cambio de nivel.', 'Lanza las piernas atrás y baja las caderas.', 'Controla los brazos y gira para quedar arriba.'], ['Cadera pesada al suelo.', 'Control de cabeza y brazos.'], ['Reaccionar tarde.', 'Dejar las caderas altas.'], 'sprawl'),
    T('wr-whizzer', 'Whizzer', 'Defensa', 'Intermedio', 'Brazo por encima para frenar una entrada.', ['Pasa el brazo por encima del suyo.', 'Aprieta el codo contra su costado.', 'Gira las caderas para escapar o contraatacar.'], ['Codo apretado y cadera girada.', 'Combínalo con el sprawl.'], ['Mantenerse recto sin girar.', 'Soltar el brazo demasiado pronto.']),
    T('wr-stand-up', 'Stand-up desde abajo', 'Escapes', 'Intermedio', 'Vuelve a pie cuando estás en el suelo bajo control.', ['Construye una base con la mano y el pie.', 'Sube las caderas y gira hacia el rival.', 'Escapa las manos y recupera el equilibrio.'], ['Base con las manos y los pies.', 'Sube las caderas antes que la cabeza.'], ['Intentar levantarte sin base.', 'Estirarte hacia delante.']),
  ],
  trainings: [
    { id: 'wr-technical', name: 'Técnica de derribos', minutes: 60, intensity: 'light', goal: 'Mecánica limpia de entradas y defensas', blocks: [{ name: 'Calentamiento', minutes: 10, detail: 'Cuello, hombros y cadera.' }, { name: 'Entradas', minutes: 20, detail: '3 series por lado de cambio de nivel + penetración sin resistencia.' }, { name: 'Defensa', minutes: 15, detail: 'Sprawl y whizzer con compañero cooperativo.' }, { name: 'Enfriamiento', minutes: 15, detail: 'Movilidad y cuello.' }], techniques: ['wr-level', 'wr-sprawl'] },
    { id: 'wr-live', name: 'Lucha situacional', minutes: 60, intensity: 'moderate', goal: 'Aplicar derribos con resistencia progresiva', blocks: [{ name: 'Calentamiento', minutes: 10, detail: 'Movilidad y juegos de lucha.' }, { name: 'Rondas situacionales', minutes: 35, detail: '7 rondas de 5 min: entrada, defensa y control.' }, { name: 'Condición', minutes: 5, detail: 'Intervalos de sprawl.' }, { name: 'Enfriamiento', minutes: 10, detail: 'Estiramientos.' }], techniques: ['wr-double', 'wr-single'] },
    { id: 'wr-match', name: 'Lucha libre (live)', minutes: 70, intensity: 'hard', goal: 'Probar tu juego a ritmo real', blocks: [{ name: 'Calentamiento', minutes: 15, detail: 'Técnica ligera.' }, { name: 'Rondas live', minutes: 40, detail: '6–8 rondas de 4–5 min con distintos compañeros.' }, { name: 'Análisis', minutes: 5, detail: 'Qué entradas funcionaron.' }, { name: 'Enfriamiento', minutes: 10, detail: 'Movilidad.' }], techniques: ['wr-stand-up', 'wr-whizzer'] },
  ],
  tips: ['El cuello se entrena y se calienta: no lo olvides.', 'Cambia de nivel con las piernas, no con la espalda.', 'La condición física es parte de la técnica en lucha.', 'Cuida la piel y la higiene de colchonetas.', 'Pasos cortos y constantes ganan a los movimientos grandes.']
}

export const LIBRARY: Record<CombatSport, SportLibrary> = { MMA, 'Brazilian Jiu-Jitsu': BJJ, Boxeo: BOX, Kickboxing: KB, Wrestling: WR }
