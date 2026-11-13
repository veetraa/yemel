import { normalize } from '../../../shared/lib/utils'

export interface Exercise {
  id: string
  name: string
  aliases: string[]
  primary: string
  secondary: string[]
  equipment: string[]
  anim: string
  steps: string[]
  tips: string[]
  /** Peso de trabajo orientativo (8-10 reps) como fracción del peso corporal, nivel intermedio */
  ratio?: number
  /** Incremento mínimo de carga (kg) */
  step: number
}

export { MUSCLES } from '../../../shared/lib/muscles'

const E = (
  id: string, name: string, primary: string, secondary: string[], equipment: string[], anim: string,
  steps: string[], tips: string[], o: { aliases?: string[]; ratio?: number; step?: number } = {},
): Exercise => ({
  id, name, primary, secondary, equipment, anim, steps, tips,
  aliases: o.aliases ?? [], ratio: o.ratio, step: o.step ?? 2.5,
})

export const EXERCISES: Exercise[] = [
  // PECHO
  E('press-banca', 'Press banca', 'Pecho', ['Tríceps', 'Hombros'], ['Barra', 'Banco'], 'bench',
    ['Túmbate con los ojos bajo la barra, escápulas juntas y pies firmes en el suelo.', 'Agarra la barra algo más ancha que los hombros y desbloquéala.', 'Baja controlado hasta rozar la parte media del pecho.', 'Empuja hacia arriba y ligeramente atrás hasta extender los codos.'],
    ['Mantén las muñecas rectas sobre los codos.', 'Codos a unos 45–70° del torso, no abiertos a 90°.'],
    { aliases: ['press de banca', 'bench press', 'press banca plano', 'banca plana', 'press plano con barra'], ratio: 0.7 }),
  E('press-banca-inclinado', 'Press inclinado con barra', 'Pecho', ['Hombros', 'Tríceps'], ['Barra', 'Banco inclinado'], 'incline',
    ['Banco a 30°. Escápulas juntas y pecho alto.', 'Baja la barra hasta la parte alta del pecho.', 'Empuja en línea recta hasta extender.'],
    ['Un ángulo mayor de 40° desplaza el trabajo a los hombros.'],
    { aliases: ['incline bench press', 'press inclinado'], ratio: 0.55 }),
  E('press-inclinado-mancuernas', 'Press inclinado con mancuernas', 'Pecho', ['Hombros', 'Tríceps'], ['Mancuernas', 'Banco inclinado'], 'incline',
    ['Banco a 30°, mancuernas a la altura del pecho.', 'Empuja hacia arriba juntando ligeramente las mancuernas.', 'Baja despacio hasta sentir estiramiento en el pecho.'],
    ['Rango completo: las mancuernas permiten bajar más que la barra.'],
    { aliases: ['incline dumbbell press', 'press inclinado mancuernas', 'press inclinado con mancuerna'], ratio: 0.22, step: 2 }),
  E('press-mancuernas', 'Press con mancuernas', 'Pecho', ['Tríceps', 'Hombros'], ['Mancuernas', 'Banco'], 'bench',
    ['Siéntate con las mancuernas sobre los muslos y túmbate impulsándolas.', 'Empuja hasta casi juntarlas arriba sin chocar.', 'Baja controlado hasta que los codos queden justo bajo el pecho.'],
    ['Escápulas retraídas durante todo el movimiento.'],
    { aliases: ['dumbbell bench press', 'press plano con mancuernas', 'press banca mancuernas', 'press de pecho con mancuernas'], ratio: 0.3, step: 2 }),
  E('press-pecho-maquina', 'Press de pecho en máquina', 'Pecho', ['Tríceps', 'Hombros'], ['Máquina'], 'bench',
    ['Ajusta el asiento para que las asas queden a la altura del pecho.', 'Empuja sin bloquear los codos.', 'Vuelve despacio hasta notar estiramiento.'],
    ['Buena opción para llegar al fallo con seguridad.'],
    { aliases: ['chest press', 'press pecho maquina', 'press de pecho'], ratio: 0.6 }),
  E('aperturas-mancuernas', 'Aperturas con mancuernas', 'Pecho', ['Hombros'], ['Mancuernas', 'Banco'], 'fly',
    ['Túmbate con las mancuernas sobre el pecho y codos ligeramente flexionados.', 'Abre los brazos en arco hasta notar estiramiento.', 'Cierra el arco como si abrazaras un árbol.'],
    ['Peso moderado: es un ejercicio de estiramiento, no de carga máxima.'],
    { aliases: ['aperturas', 'dumbbell fly', 'flyes', 'aperturas planas'], ratio: 0.1, step: 1 }),
  E('cruces-polea', 'Cruces en polea', 'Pecho', ['Hombros'], ['Polea'], 'fly',
    ['Poleas altas, un paso adelante y torso ligeramente inclinado.', 'Lleva las manos hacia delante y abajo hasta juntarlas.', 'Vuelve controlado abriendo el pecho.'],
    ['Aprieta el pecho al juntar las manos durante 1 segundo.'],
    { aliases: ['cable crossover', 'cruce de poleas', 'cruces de polea', 'aperturas en polea', 'aperturas polea'], ratio: 0.12, step: 2.5 }),
  E('flexiones', 'Flexiones', 'Pecho', ['Tríceps', 'Hombros', 'Core'], ['Peso corporal'], 'pushup',
    ['Manos algo más anchas que los hombros, cuerpo en línea recta.', 'Baja el pecho hasta casi tocar el suelo.', 'Empuja hasta extender los brazos sin hundir la cadera.'],
    ['Si no puedes hacer las repeticiones, apoya las manos en un banco.'],
    { aliases: ['push up', 'push-up', 'lagartijas', 'pushups', 'flexiones de brazos'], step: 0 }),
  E('fondos', 'Fondos en paralelas', 'Tríceps', ['Pecho', 'Hombros'], ['Peso corporal', 'Paralelas'], 'dip',
    ['Sujétate en las paralelas con los brazos extendidos.', 'Baja flexionando codos hasta ~90°.', 'Empuja hasta volver arriba.'],
    ['Inclina el torso adelante para implicar más el pecho.'],
    { aliases: ['dips', 'fondos paralelas', 'fondos de triceps', 'fondos en paralelas'], step: 2.5 }),

  // ESPALDA
  E('dominadas', 'Dominadas', 'Espalda', ['Bíceps', 'Antebrazos'], ['Peso corporal', 'Barra de dominadas'], 'pullup',
    ['Agarre algo más ancho que los hombros, colgado con brazos extendidos.', 'Tira llevando los codos hacia las caderas hasta pasar la barbilla.', 'Baja controlado hasta extensión completa.'],
    ['Evita balancearte; inicia el movimiento bajando las escápulas.'],
    { aliases: ['pull up', 'pull-up', 'pullups', 'dominada', 'dominadas pronas'], step: 2.5 }),
  E('jalon-pecho', 'Jalón al pecho', 'Espalda', ['Bíceps', 'Antebrazos'], ['Polea', 'Máquina'], 'pulldown',
    ['Ajusta el rodillo sobre los muslos y agarra la barra ancha.', 'Inclina ligeramente el torso y tira hacia la parte alta del pecho.', 'Sube controlando hasta estirar los dorsales.'],
    ['Piensa en llevar los codos al bolsillo, no en tirar con las manos.'],
    { aliases: ['lat pulldown', 'jalon', 'jalon al pecho', 'polea al pecho', 'jalones', 'jalon dorsal'], ratio: 0.6 }),
  E('remo-barra', 'Remo con barra', 'Espalda', ['Bíceps', 'Trapecio', 'Antebrazos'], ['Barra'], 'row',
    ['Torso inclinado ~45°, espalda neutra y rodillas semiflexionadas.', 'Tira de la barra hacia el abdomen bajo.', 'Baja controlado sin perder la postura.'],
    ['No uses impulso de cadera; pausa 1 s arriba.'],
    { aliases: ['barbell row', 'remo inclinado', 'remo con barra inclinado', 'remo con barra agarre prono', 'bent over row'], ratio: 0.6 }),
  E('remo-mancuerna', 'Remo con mancuerna a una mano', 'Espalda', ['Bíceps', 'Antebrazos'], ['Mancuernas', 'Banco'], 'row',
    ['Apoya mano y rodilla en el banco, espalda paralela al suelo.', 'Tira de la mancuerna hacia la cadera.', 'Baja hasta estirar completamente el dorsal.'],
    ['Evita rotar el torso al subir.'],
    { aliases: ['one arm dumbbell row', 'remo unilateral', 'remo con mancuerna', 'remo con mancuernas', 'remo a una mano'], ratio: 0.3, step: 2 }),
  E('remo-polea', 'Remo en polea baja', 'Espalda', ['Bíceps', 'Trapecio'], ['Polea'], 'seatedRow',
    ['Siéntate con el torso erguido y rodillas ligeramente flexionadas.', 'Tira del agarre hacia el abdomen juntando escápulas.', 'Vuelve extendiendo los brazos sin encorvarte.'],
    ['Pausa 1 s con las escápulas juntas.'],
    { aliases: ['seated cable row', 'remo sentado', 'remo en polea', 'remo en maquina', 'remo sentado en polea', 'remo con polea'], ratio: 0.55 }),
  E('peso-muerto', 'Peso muerto', 'Espalda', ['Glúteos', 'Isquiotibiales', 'Antebrazos', 'Trapecio'], ['Barra'], 'deadlift',
    ['Pies bajo la barra, agarre a la anchura de los hombros.', 'Pecho alto, espalda neutra; empuja el suelo con las piernas.', 'Extiende cadera y rodillas a la vez hasta quedar erguido.', 'Baja la barra pegada al cuerpo con control.'],
    ['La barra debe moverse siempre en línea vertical, rozando las piernas.'],
    { aliases: ['deadlift', 'peso muerto convencional', 'peso muerto con barra'], ratio: 1.1 }),
  E('face-pull', 'Face pull', 'Hombros', ['Espalda', 'Trapecio'], ['Polea', 'Cuerda'], 'facePull',
    ['Polea a la altura del rostro con cuerda.', 'Tira hacia la cara separando las manos.', 'Vuelve despacio sin mover el torso.'],
    ['Codos altos; rota externamente al final.'],
    { aliases: ['face pulls', 'tirones a la cara', 'jalon a la cara', 'facepull'], ratio: 0.2, step: 2.5 }),

  // HOMBROS
  E('press-militar', 'Press militar con barra', 'Hombros', ['Tríceps', 'Core', 'Trapecio'], ['Barra'], 'ohp',
    ['De pie, barra a la altura de la clavícula, glúteos y abdomen apretados.', 'Empuja la barra por encima de la cabeza hasta extender.', 'Baja controlado hasta la clavícula.'],
    ['Mete la cabeza "por la ventana" al pasar la barra.'],
    { aliases: ['overhead press', 'press militar', 'press de hombros con barra', 'military press', 'ohp'], ratio: 0.45 }),
  E('press-hombro-mancuernas', 'Press de hombros con mancuernas', 'Hombros', ['Tríceps', 'Trapecio'], ['Mancuernas'], 'ohp',
    ['Sentado o de pie, mancuernas a la altura de las orejas.', 'Empuja hacia arriba hasta casi juntarlas.', 'Baja controlado hasta 90° de codos.'],
    ['No arquees la zona lumbar.'],
    { aliases: ['shoulder press', 'dumbbell shoulder press', 'press de hombro', 'press hombros mancuernas', 'press de hombros', 'press hombro'], ratio: 0.18, step: 2 }),
  E('elevaciones-laterales', 'Elevaciones laterales', 'Hombros', ['Trapecio'], ['Mancuernas'], 'lateral',
    ['De pie con mancuernas a los lados y codos ligeramente flexionados.', 'Eleva los brazos hasta la altura de los hombros.', 'Baja despacio, sin balanceo.'],
    ['Lidera con los codos y piensa en "verter agua" con el meñique arriba.'],
    { aliases: ['lateral raise', 'elevacion lateral', 'vuelos laterales', 'elevaciones laterales con mancuernas'], ratio: 0.07, step: 1 }),
  E('elevaciones-frontales', 'Elevaciones frontales', 'Hombros', ['Pecho'], ['Mancuernas'], 'lateral',
    ['De pie con las mancuernas frente a los muslos.', 'Eleva un brazo al frente hasta la altura del hombro.', 'Baja controlado y alterna.'],
    ['Sin impulso de espalda.'],
    { aliases: ['front raise', 'elevacion frontal'], ratio: 0.07, step: 1 }),
  E('pajaros', 'Pájaros (deltoides posterior)', 'Hombros', ['Espalda', 'Trapecio'], ['Mancuernas'], 'facePull',
    ['Inclínate con el torso casi paralelo al suelo.', 'Abre los brazos hacia los lados con codos ligeramente flexionados.', 'Baja controlado.'],
    ['Peso ligero y tempo lento.'],
    { aliases: ['reverse fly', 'vuelos posteriores', 'elevaciones posteriores', 'pajaro', 'aperturas inversas', 'deltoides posterior'], ratio: 0.06, step: 1 }),
  E('encogimientos', 'Encogimientos de trapecio', 'Trapecio', ['Antebrazos'], ['Mancuernas', 'Barra'], 'shrug',
    ['De pie con mancuernas a los lados.', 'Eleva los hombros hacia las orejas.', 'Pausa 1 s y baja controlado.'],
    ['No rotes los hombros; sube y baja en línea recta.'],
    { aliases: ['shrugs', 'encogimientos', 'encogimiento de hombros', 'trapecio'], ratio: 0.3, step: 2 }),

  // BRAZOS
  E('curl-barra', 'Curl con barra', 'Bíceps', ['Antebrazos'], ['Barra'], 'curl',
    ['De pie, agarre supino a la anchura de los hombros.', 'Flexiona los codos llevando la barra a los hombros.', 'Baja despacio hasta extender del todo.'],
    ['Codos pegados al torso, sin balanceo.'],
    { aliases: ['barbell curl', 'curl con barra z', 'curl biceps barra', 'curl barra z', 'curl con barra ez'], ratio: 0.3 }),
  E('curl-mancuernas', 'Curl con mancuernas', 'Bíceps', ['Antebrazos'], ['Mancuernas'], 'curl',
    ['De pie con mancuernas en agarre neutro.', 'Sube girando la palma hacia arriba.', 'Baja controlado.'],
    ['Alterna o hazlo a la vez; mantén los codos fijos.'],
    { aliases: ['dumbbell curl', 'curl biceps', 'curl de biceps', 'curl alterno', 'curl biceps mancuernas'], ratio: 0.14, step: 2 }),
  E('curl-martillo', 'Curl martillo', 'Bíceps', ['Antebrazos'], ['Mancuernas'], 'curl',
    ['Agarre neutro (palmas enfrentadas).', 'Flexiona manteniendo la muñeca neutra.', 'Baja despacio.'],
    ['Trabaja braquial y braquiorradial: más grosor del brazo.'],
    { aliases: ['hammer curl', 'curl en martillo', 'curl martillo con mancuernas'], ratio: 0.14, step: 2 }),
  E('curl-polea', 'Curl en polea', 'Bíceps', ['Antebrazos'], ['Polea'], 'curl',
    ['Polea baja con barra recta o cuerda.', 'Flexiona los codos sin moverlos.', 'Baja hasta tensión constante.'],
    ['La polea mantiene tensión incluso abajo.'],
    { aliases: ['cable curl', 'curl con polea'], ratio: 0.2 }),
  E('extension-triceps-polea', 'Extensión de tríceps en polea', 'Tríceps', [], ['Polea'], 'pushdown',
    ['De pie frente a la polea alta, codos pegados al cuerpo.', 'Extiende los codos hasta bloquear abajo.', 'Sube controlado hasta ~90°.'],
    ['Solo se mueven los antebrazos.'],
    { aliases: ['pushdown', 'triceps pushdown', 'jalon de triceps', 'triceps en polea', 'extension de triceps', 'extensiones de triceps en polea', 'press down', 'triceps polea'], ratio: 0.3 }),
  E('press-frances', 'Press francés', 'Tríceps', ['Hombros'], ['Barra Z', 'Banco'], 'skull',
    ['Túmbate con la barra sobre el pecho, brazos verticales.', 'Flexiona solo los codos llevando la barra hacia la frente.', 'Extiende hasta volver arriba.'],
    ['Codos apuntando al techo, sin abrirlos.'],
    { aliases: ['skull crusher', 'skullcrusher', 'rompecraneos', 'extension de triceps tumbado', 'press frances con barra z'], ratio: 0.25, step: 2.5 }),

  // PIERNAS
  E('sentadilla', 'Sentadilla con barra', 'Cuádriceps', ['Glúteos', 'Isquiotibiales', 'Core'], ['Barra', 'Rack'], 'squat',
    ['Barra sobre los trapecios, pies a la anchura de hombros, puntas algo abiertas.', 'Inspira, abdomen firme y baja con rodillas siguiendo las puntas.', 'Desciende al menos hasta paralelo.', 'Empuja el suelo y sube con el pecho alto.'],
    ['Peso repartido en todo el pie; talones siempre en el suelo.'],
    { aliases: ['squat', 'back squat', 'sentadillas', 'sentadilla trasera', 'sentadilla libre', 'sentadilla con barra'], ratio: 0.9 }),
  E('sentadilla-goblet', 'Sentadilla goblet', 'Cuádriceps', ['Glúteos', 'Core'], ['Mancuernas', 'Kettlebell'], 'squat',
    ['Sujeta una mancuerna contra el pecho.', 'Baja entre las rodillas manteniendo el torso erguido.', 'Sube empujando el suelo.'],
    ['Ideal para aprender el patrón de sentadilla.'],
    { aliases: ['goblet squat', 'sentadilla con mancuerna', 'sentadilla copa'], ratio: 0.3, step: 2 }),
  E('prensa', 'Prensa de piernas', 'Cuádriceps', ['Glúteos', 'Isquiotibiales'], ['Máquina'], 'legPress',
    ['Espalda y cadera pegadas al respaldo, pies a la anchura de los hombros.', 'Baja hasta ~90° de rodillas sin despegar la pelvis.', 'Empuja sin bloquear las rodillas.'],
    ['Pies más altos = más glúteo e isquios; más bajos = más cuádriceps.'],
    { aliases: ['leg press', 'prensa de pierna', 'prensa de piernas', 'prensa 45', 'prensa inclinada'], ratio: 1.8, step: 5 }),
  E('zancadas', 'Zancadas', 'Cuádriceps', ['Glúteos', 'Isquiotibiales'], ['Mancuernas', 'Peso corporal'], 'lunge',
    ['De pie con mancuernas a los lados.', 'Da un paso largo y baja hasta que ambas rodillas formen ~90°.', 'Empuja con la pierna delantera para volver.'],
    ['Torso erguido; la rodilla delantera no colapsa hacia dentro.'],
    { aliases: ['lunges', 'lunge', 'zancada', 'estocadas', 'zancadas caminando', 'zancadas con mancuernas'], ratio: 0.2, step: 2 }),
  E('sentadilla-bulgara', 'Sentadilla búlgara', 'Cuádriceps', ['Glúteos', 'Core'], ['Mancuernas', 'Banco'], 'lunge',
    ['Pie trasero apoyado en un banco, pie delantero a ~60 cm.', 'Baja verticalmente hasta que el muslo quede paralelo.', 'Sube empujando con la pierna delantera.'],
    ['Inclina el torso adelante para más glúteo.'],
    { aliases: ['bulgarian split squat', 'sentadilla bulgara', 'zancada bulgara', 'split squat'], ratio: 0.2, step: 2 }),
  E('extension-cuadriceps', 'Extensión de cuádriceps', 'Cuádriceps', [], ['Máquina'], 'legExt',
    ['Ajusta el respaldo para que las rodillas queden en el eje de giro.', 'Extiende las piernas hasta arriba.', 'Baja despacio sin dejar caer la pila.'],
    ['Pausa 1 s arriba apretando el cuádriceps.'],
    { aliases: ['leg extension', 'extensiones de cuadriceps', 'extension de piernas', 'extensiones de piernas', 'sillon de cuadriceps'], ratio: 0.5, step: 2.5 }),
  E('curl-femoral', 'Curl femoral tumbado', 'Isquiotibiales', ['Gemelos'], ['Máquina'], 'legCurl',
    ['Túmbate boca abajo con el rodillo sobre los tobillos.', 'Flexiona las rodillas llevando los talones a los glúteos.', 'Baja controlado.'],
    ['No levantes la cadera del banco.'],
    { aliases: ['leg curl', 'curl de piernas', 'curl femoral', 'curl femoral sentado', 'curl isquios', 'curl de isquiotibiales', 'femoral tumbado'], ratio: 0.4, step: 2.5 }),
  E('peso-muerto-rumano', 'Peso muerto rumano', 'Isquiotibiales', ['Glúteos', 'Espalda', 'Antebrazos'], ['Barra', 'Mancuernas'], 'hinge',
    ['De pie con la barra a la altura de la cadera, rodillas semiflexionadas.', 'Lleva la cadera atrás deslizando la barra por los muslos.', 'Baja hasta notar tensión en isquios y vuelve empujando la cadera adelante.'],
    ['Espalda neutra todo el recorrido.'],
    { aliases: ['romanian deadlift', 'rdl', 'peso muerto rumano con barra', 'peso muerto rumano con mancuernas', 'pm rumano', 'peso muerto piernas rigidas'], ratio: 0.8 }),
  E('hip-thrust', 'Hip thrust', 'Glúteos', ['Isquiotibiales', 'Core'], ['Barra', 'Banco'], 'hipThrust',
    ['Espalda alta apoyada en el banco, barra sobre la cadera.', 'Empuja con los talones hasta alinear rodillas, cadera y hombros.', 'Aprieta glúteos 1 s y baja controlado.'],
    ['Mentón recogido; costillas abajo, sin hiperextender la lumbar.'],
    { aliases: ['hip thrusts', 'empuje de cadera', 'puente de gluteos con barra', 'elevacion de cadera'], ratio: 1.0 }),
  E('puente-gluteos', 'Puente de glúteos', 'Glúteos', ['Isquiotibiales', 'Core'], ['Peso corporal'], 'hipThrust',
    ['Tumbado con rodillas flexionadas y pies en el suelo.', 'Eleva la cadera apretando glúteos.', 'Baja sin apoyar del todo.'],
    ['Añade peso sobre la cadera cuando sea fácil.'],
    { aliases: ['glute bridge', 'puente de gluteo', 'puente'], step: 2.5 }),
  E('gemelos-pie', 'Elevación de gemelos de pie', 'Gemelos', [], ['Máquina', 'Mancuernas'], 'calf',
    ['Apoya la parte delantera del pie en un escalón.', 'Sube lo máximo posible sobre las puntas.', 'Baja hasta estirar completamente el gemelo.'],
    ['Pausa 1–2 s abajo y arriba; evita rebotar.'],
    { aliases: ['calf raise', 'elevacion de talones', 'elevaciones de gemelos', 'gemelos de pie', 'gemelos', 'elevacion de gemelos', 'standing calf raise'], ratio: 0.6 }),
  E('gemelos-sentado', 'Elevación de gemelos sentado', 'Gemelos', [], ['Máquina'], 'calf',
    ['Rodillas a 90° con las almohadillas sobre los muslos.', 'Sube sobre las puntas.', 'Baja hasta estiramiento completo.'],
    ['Trabaja más el sóleo que la versión de pie.'],
    { aliases: ['seated calf raise', 'gemelos sentado', 'gemelo sentado'], ratio: 0.4 }),
  E('remo-apoyado', 'Remo con apoyo en pecho', 'Espalda', ['Bíceps', 'Trapecio', 'Antebrazos'], ['Mancuernas', 'Banco inclinado'], 'chestRow',
    ['Túmbate boca abajo sobre un banco inclinado a 30-45°, pecho apoyado.', 'Deja los brazos colgando con una mancuerna en cada mano.', 'Tira de los codos hacia las caderas juntando las escápulas.', 'Baja despacio hasta estirar la espalda.'],
    ['El apoyo elimina el impulso: usa menos peso y más control.', 'Ideal cuando las piernas están cargadas por el combate.'],
    { aliases: ['chest supported row', 'remo apoyado', 'remo con apoyo', 'remo en banco inclinado', 'seal row'], ratio: 0.25, step: 2 }),
  E('step-ups', 'Step-ups', 'Cuádriceps', ['Glúteos', 'Isquiotibiales', 'Core'], ['Cajón', 'Mancuernas'], 'stepup',
    ['Apoya todo un pie sobre un cajón o banco a la altura de la rodilla.', 'Sube empujando con la pierna de arriba, sin impulsarte con la de abajo.', 'Baja controlado y repite por pierna antes de cambiar.'],
    ['Torso erguido y rodilla alineada con el pie.', 'Excelente trabajo unilateral para estabilidad en combate.'],
    { aliases: ['step up', 'subidas al cajon', 'subidas al banco', 'step-up'], ratio: 0.15, step: 2 }),
  E('press-landmine', 'Press landmine', 'Hombros', ['Pecho', 'Tríceps', 'Core'], ['Barra', 'Landmine'], 'landmine',
    ['Fija un extremo de la barra en el suelo o un soporte y sujeta el otro a la altura del hombro.', 'Empuja hacia arriba y adelante hasta extender el brazo.', 'Vuelve controlado sin rotar el torso.'],
    ['Trayectoria diagonal, amable con el hombro y cercana a un golpe.', 'Apriétate glúteos y abdomen para transmitir fuerza desde el suelo.'],
    { aliases: ['landmine press', 'press con landmine', 'press landmine a una mano'], ratio: 0.2, step: 2.5 }),
  E('farmer-walk', 'Farmer walks', 'Antebrazos', ['Trapecio', 'Core', 'Glúteos'], ['Mancuernas', 'Kettlebell'], 'carry',
    ['Levanta una mancuerna pesada en cada mano con la espalda neutra.', 'Camina 30-40 m con pasos cortos, hombros atrás y abdomen firme.', 'Deja las pesas con control y descansa antes del siguiente recorrido.'],
    ['El agarre manda: no sueltes ni te inclines hacia un lado.', 'Úsalo como acondicionamiento integrado en el gimnasio.'],
    { aliases: ['farmer walk', 'farmers walk', 'paseo del granjero', 'paseo del granjero con mancuernas', 'farmer carry', 'farmer walks'], ratio: 0.4, step: 2 }),
  E('pallof-press', 'Pallof press', 'Core', ['Hombros', 'Glúteos'], ['Polea', 'Bandas elásticas'], 'pallof',
    ['De pie y de lado a la polea a la altura del pecho, manos pegadas al esternón.', 'Estira los brazos al frente resistiendo que la polea te gire.', 'Mantén 1-2 s y vuelve al pecho sin rotar.'],
    ['Es anti-rotación: lo difícil es no moverse.', 'Repite por ambos lados con la misma carga.'],
    { aliases: ['pallof', 'press pallof', 'anti rotacion con polea'], ratio: 0.1, step: 2.5 }),

  // CORE
  E('plancha', 'Plancha', 'Core', ['Hombros', 'Glúteos'], ['Peso corporal'], 'plank',
    ['Antebrazos en el suelo, codos bajo los hombros.', 'Cuerpo en línea recta de cabeza a talones.', 'Mantén abdomen y glúteos apretados respirando con calma.'],
    ['Si la cadera cae o sube, termina la serie.'],
    { aliases: ['plank', 'plancha abdominal', 'plancha frontal'], step: 0 }),
  E('crunch', 'Crunch abdominal', 'Core', [], ['Peso corporal'], 'crunch',
    ['Tumbado con rodillas flexionadas y manos tras la cabeza.', 'Enrolla el torso levantando los omóplatos.', 'Baja sin relajar del todo.'],
    ['El movimiento es corto: piensa en acercar costillas a pelvis.'],
    { aliases: ['crunches', 'abdominales', 'crunch abdominales', 'abdominales crunch'], step: 0 }),
  E('elevacion-piernas', 'Elevación de piernas colgado', 'Core', ['Antebrazos'], ['Barra de dominadas'], 'legRaise',
    ['Colgado de la barra con el cuerpo estable.', 'Eleva las piernas hasta la horizontal o más.', 'Baja controlado sin balancear.'],
    ['Inclina la pelvis hacia atrás para trabajar abdomen, no solo flexores de cadera.'],
    { aliases: ['hanging leg raise', 'elevaciones de piernas', 'elevacion de piernas', 'leg raise', 'elevacion de rodillas colgado'], step: 0 }),
]

// ───────── Ejercicios personalizados (importados o creados por el usuario) ─────────
let CUSTOM: Exercise[] = []
let index: { e: Exercise; names: string[] }[] = []
const rebuild = () => { index = [...EXERCISES, ...CUSTOM].map((e) => ({ e, names: [e.name, ...e.aliases].map(normalize) })) }
rebuild()

export const setCustomExercises = (list: Exercise[]) => { CUSTOM = list; rebuild() }
export const customExercises = () => CUSTOM
export const allExercises = () => [...EXERCISES, ...CUSTOM]
export const exerciseById = (id?: string) => (id ? allExercises().find((e) => e.id === id) : undefined)

/** Busca un ejercicio de la biblioteca por nombre (con alias y coincidencia difusa). */
export function matchExercise(name: string): Exercise | undefined {
  const n = normalize(name)
  if (!n) return undefined
  for (const it of index) if (it.names.includes(n)) return it.e
  const tokens = new Set(n.split(' ').filter((t) => t.length > 2))
  if (!tokens.size) return undefined
  let best: { e: Exercise; score: number } | undefined
  for (const it of index) {
    for (const cand of it.names) {
      const ct = new Set(cand.split(' ').filter((t) => t.length > 2))
      let inter = 0
      tokens.forEach((t) => ct.has(t) && inter++)
      const score = inter / Math.max(tokens.size, ct.size)
      if (score > (best?.score ?? 0)) best = { e: it.e, score }
    }
  }
  return best && best.score >= 0.67 ? best.e : undefined
}

export function searchExercises(q: string, muscle?: string): Exercise[] {
  const n = normalize(q)
  return allExercises().filter((e) => {
    if (muscle && e.primary !== muscle && !e.secondary.includes(muscle)) return false
    if (!n) return true
    return [e.name, e.primary, ...e.aliases, ...e.equipment].some((s) => normalize(s).includes(n))
  })
}
