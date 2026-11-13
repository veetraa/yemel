import type { Quote } from '../types'

/** Citas estoicas adaptadas al español (no son traducciones literales). */
const Q = (id: string, author: string, work: string, text: string, themes: Quote['themes']): Quote => ({ id, author, work, text, themes })

export const QUOTES: Quote[] = [
  Q('ma-obstaculo', 'Marco Aurelio', 'Meditaciones 5.20', 'Lo que obstaculiza la acción la impulsa; lo que se interpone en el camino se convierte en el camino.', ['resiliencia', 'accion']),
  Q('ma-juicio', 'Marco Aurelio', 'Meditaciones 8.47', 'Si algo externo te inquieta, no es eso lo que te molesta, sino tu juicio sobre ello; y está en tu mano borrar ese juicio ahora.', ['autocontrol', 'calma']),
  Q('ma-ser-bueno', 'Marco Aurelio', 'Meditaciones 10.16', 'Deja de discutir sobre cómo debe ser una buena persona. Sé una.', ['disciplina', 'accion']),
  Q('ma-amanecer', 'Marco Aurelio', 'Meditaciones 5.1', 'Cuando te cueste levantarte al amanecer, recuerda: me levanto para hacer el trabajo de un ser humano.', ['disciplina']),
  Q('ma-venganza', 'Marco Aurelio', 'Meditaciones 6.6', 'La mejor manera de responder a una ofensa es no parecerse a quien la cometió.', ['autocontrol']),
  Q('ma-pocos', 'Marco Aurelio', 'Meditaciones 7.67', 'Hace falta muy poco para una vida feliz; todo está dentro de ti, en tu manera de pensar.', ['calma']),
  Q('ma-mente', 'Marco Aurelio', 'Meditaciones 5.16', 'Tu mente toma el color de tus pensamientos: cuida, pues, lo que piensas a menudo.', ['autocontrol']),
  Q('ma-posible', 'Marco Aurelio', 'Meditaciones 6.19', 'No creas imposible para ti lo que es posible para el ser humano.', ['resiliencia', 'accion']),
  Q('ma-ultimo-dia', 'Marco Aurelio', 'Meditaciones 7.69', 'La perfección del carácter es vivir cada día como si fuera el último: sin agitación, sin apatía y sin fingimiento.', ['calma', 'disciplina']),
  Q('ma-retiro', 'Marco Aurelio', 'Meditaciones 4.3', 'Siempre puedes retirarte dentro de ti mismo; en ningún sitio hay un refugio más tranquilo.', ['calma']),
  Q('se-imaginacion', 'Séneca', 'Cartas a Lucilio 13', 'Sufrimos más a menudo en la imaginación que en la realidad.', ['resiliencia', 'calma']),
  Q('se-tiempo', 'Séneca', 'Sobre la brevedad de la vida 1', 'No es que tengamos poco tiempo, sino que perdemos mucho.', ['accion', 'disciplina']),
  Q('se-larga', 'Séneca', 'Sobre la brevedad de la vida 1', 'La vida es larga si sabes usarla.', ['accion']),
  Q('se-viento', 'Séneca', 'Cartas a Lucilio 71', 'Ningún viento es favorable para quien no sabe a qué puerto se dirige.', ['accion', 'disciplina']),
  Q('se-oro', 'Séneca', 'Sobre la providencia 5', 'El fuego prueba el oro; la desgracia, a las personas fuertes.', ['resiliencia']),
  Q('se-aplazar', 'Séneca', 'Cartas a Lucilio 1', 'Mientras aplazamos, la vida pasa.', ['accion', 'disciplina']),
  Q('se-mandarse', 'Séneca', 'Cartas a Lucilio 113', 'Mandarse a uno mismo es el mayor de los mandatos.', ['autocontrol', 'disciplina']),
  Q('se-destino', 'Séneca', 'Cartas a Lucilio 107', 'El destino guía a quien lo acepta y arrastra a quien se resiste.', ['resiliencia', 'calma']),
  Q('se-incomodidad', 'Séneca', 'Cartas a Lucilio 18', 'Reserva unos días para vivir con lo mínimo y pregúntate: ¿esto es lo que temía?', ['resiliencia', 'disciplina']),
  Q('ep-juicios', 'Epicteto', 'Enquiridión 5', 'No son las cosas las que perturban a las personas, sino las opiniones que tienen sobre ellas.', ['autocontrol', 'calma']),
  Q('ep-depende', 'Epicteto', 'Enquiridión 1', 'Algunas cosas dependen de nosotros y otras no. Pon tu esfuerzo en las primeras.', ['autocontrol']),
  Q('ep-como-ocurren', 'Epicteto', 'Enquiridión 8', 'No pidas que las cosas ocurran como quieres; desea que ocurran como ocurren, y vivirás en paz.', ['resiliencia', 'calma']),
  Q('ep-quien-ser', 'Epicteto', 'Discursos 3.23', 'Primero dite a ti mismo quién quieres ser; luego haz lo que tengas que hacer.', ['disciplina']),
  Q('ep-asas', 'Epicteto', 'Enquiridión 43', 'Toda cosa tiene dos asas: una por la que se puede sostener y otra por la que no. Cógela por la buena.', ['autocontrol', 'calma']),
  Q('ep-insulto', 'Epicteto', 'Enquiridión 20', 'Recuerda que no te daña quien te insulta, sino tu juicio de que te ha dañado.', ['autocontrol']),
  Q('ep-progreso', 'Epicteto', 'Enquiridión 13', 'Si quieres progresar, acepta parecer torpe e ignorante en lo que aún no dominas.', ['disciplina', 'resiliencia']),
  Q('mu-esfuerzo', 'Musonio Rufo', 'Fragmentos (Aulo Gelio)', 'Si haces algo bueno con esfuerzo, el esfuerzo pasa y lo bueno permanece; si haces algo vergonzoso con placer, el placer pasa y lo vergonzoso permanece.', ['disciplina']),
  Q('mu-entrenar', 'Musonio Rufo', 'Disertaciones 5-6', 'La virtud se entrena como cualquier arte: nadie se hace valiente sin ejercitarse.', ['disciplina', 'resiliencia']),
  Q('ze-poco-a-poco', 'Zenón de Citio', 'Plutarco', 'El bienestar se alcanza poco a poco, y sin embargo no es poca cosa.', ['disciplina', 'accion']),
  Q('cl-guiame', 'Cleantes', 'Himno (Enquiridión 52)', 'Guíame, destino, adonde hayas dispuesto; te seguiré sin vacilar.', ['resiliencia', 'calma']),
]

export const THEMES: { key: Quote['themes'][number]; label: string }[] = [
  { key: 'disciplina', label: 'Disciplina' }, { key: 'autocontrol', label: 'Autocontrol' }, { key: 'resiliencia', label: 'Resiliencia' },
  { key: 'accion', label: 'Acción' }, { key: 'calma', label: 'Calma' },
]
