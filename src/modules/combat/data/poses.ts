/** Plantillas de animación de COMBAT (ejercicios en solitario). Independientes de las de Gym. */
import { P, type Template } from '../../../shared/lib/pose'

const STANCE = { head: [122, 32], shoulder: [120, 52], hip: [116, 96], knee: [126, 132], foot: [134, 166], knee2: [104, 134], foot2: [92, 166] } as const
const stance = (elbow: [number, number], hand: [number, number], over: Partial<{ head: [number, number]; shoulder: [number, number]; hip: [number, number] }> = {}) =>
  P(over.head ?? [...STANCE.head], over.shoulder ?? [...STANCE.shoulder], over.hip ?? [...STANCE.hip], elbow, hand, [...STANCE.knee], [...STANCE.foot], { knee2: [...STANCE.knee2], foot2: [...STANCE.foot2] })

export const COMBAT_TEMPLATES: Record<string, Template> = {
  jab: { prop: 'none', A: stance([130, 74], [142, 54]), B: stance([152, 58], [180, 52], { head: [126, 32], shoulder: [123, 52] }) },
  cross: { prop: 'none', A: stance([130, 74], [142, 54]), B: stance([154, 62], [182, 54], { head: [130, 32], shoulder: [127, 52], hip: [114, 96] }) },
  lowKick: {
    prop: 'none',
    A: stance([122, 74], [134, 56]),
    B: P([108, 32], [112, 52], [112, 96], [122, 74], [134, 56], [152, 108], [188, 128], { knee2: [108, 134], foot2: [104, 166] }),
  },
  teep: {
    prop: 'none',
    A: stance([122, 74], [134, 56]),
    B: P([110, 32], [113, 52], [114, 96], [122, 74], [134, 56], [150, 98], [184, 104], { knee2: [112, 134], foot2: [108, 166] }),
  },
  knee: {
    prop: 'none',
    A: stance([138, 70], [148, 56]),
    B: P([128, 34], [124, 54], [114, 98], [138, 70], [148, 56], [148, 84], [134, 120], { knee2: [112, 134], foot2: [108, 166] }),
  },
  sprawl: {
    prop: 'none',
    A: stance([130, 74], [142, 54]),
    B: P([156, 98], [140, 106], [92, 138], [150, 128], [152, 152], [66, 152], [38, 160], { knee2: [64, 154], foot2: [36, 162] }),
  },
  shot: {
    prop: 'none',
    A: stance([130, 74], [142, 54]),
    B: P([154, 86], [138, 96], [104, 116], [160, 112], [178, 132], [138, 140], [146, 166], { knee2: [80, 148], foot2: [52, 166] }),
  },
  shrimp: {
    prop: 'none', floor: true,
    A: P([50, 150], [66, 154], [118, 154], [80, 138], [92, 126], [150, 126], [160, 156], { knee2: [150, 138], foot2: [186, 158] }),
    B: P([50, 152], [66, 156], [98, 150], [80, 140], [94, 128], [128, 124], [112, 154], { knee2: [132, 140], foot2: [160, 160] }),
  },
  bridge: {
    prop: 'none', floor: true,
    A: P([50, 152], [66, 152], [118, 152], [80, 136], [96, 120], [146, 118], [164, 156]),
    B: P([50, 154], [68, 146], [120, 110], [80, 138], [96, 122], [150, 112], [168, 156]),
  },
}
