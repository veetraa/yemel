"""Genera scripts/library-links.json (vínculos verificados a mano entre ejercicios propios y fuentes)."""
import re, json
s = open('src/modules/gym/data/exercises.ts').read()
M = {
'press-banca': ('barbell-bench-press', 'bench-press', 'Barbell_Bench_Press_-_Medium_Grip'),
'press-banca-inclinado': ('barbell-incline-bench-press', 'incline-bench-press', 'Barbell_Incline_Bench_Press_-_Medium_Grip'),
'press-inclinado-mancuernas': ('incline-dumbbell-press', 'incline-db-press', 'Incline_Dumbbell_Press'),
'press-mancuernas': ('dumbbell-bench-press', 'db-bench-press', 'Dumbbell_Bench_Press'),
'press-pecho-maquina': ('machine-bench-press', 'chest-press-machine', 'Machine_Bench_Press'),
'aperturas-mancuernas': ('dumbbell-flyes', 'db-fly', 'Dumbbell_Flyes'),
'cruces-polea': ('cable-crossover', None, 'Cable_Crossover'),
'flexiones': ('push-up', 'push-up', 'Pushups'),
'fondos': ('parallel-bar-dip', 'dips', 'Parallel_Bar_Dip'),
'dominadas': ('pull-up', 'pull-up', 'Pullups'),
'jalon-pecho': ('wide-grip-lat-pulldown', 'lat-pulldown', 'Wide-Grip_Lat_Pulldown'),
'remo-barra': ('bent-over-barbell-row', 'barbell-row', 'Bent_Over_Barbell_Row'),
'remo-mancuerna': ('one-arm-dumbbell-row', 'single-arm-db-row', 'One-Arm_Dumbbell_Row'),
'remo-polea': ('seated-cable-rows', 'seated-cable-row', 'Seated_Cable_Rows'),
'peso-muerto': ('barbell-deadlift', 'deadlift', 'Barbell_Deadlift'),
'face-pull': ('face-pull', 'face-pull', 'Face_Pull'),
'press-militar': ('standing-military-press', 'ohp', 'Standing_Military_Press'),
'press-hombro-mancuernas': ('dumbbell-shoulder-press', 'dumbbell-shoulder-press', 'Dumbbell_Shoulder_Press'),
'elevaciones-laterales': ('side-lateral-raise', 'lateral-raise', 'Side_Lateral_Raise'),
'elevaciones-frontales': ('front-dumbbell-raise', 'dumbbell-front-raise', 'Front_Dumbbell_Raise'),
'pajaros': ('seated-bent-over-rear-delt-raise', 'rear-delt-fly', 'Seated_Bent-Over_Rear_Delt_Raise'),
'encogimientos': ('dumbbell-shrug', 'db-shrug', 'Dumbbell_Shrug'),
'curl-barra': ('barbell-curl', 'barbell-curl', 'Barbell_Curl'),
'curl-mancuernas': ('dumbbell-bicep-curl', 'bicep-curl', 'Dumbbell_Bicep_Curl'),
'curl-martillo': ('hammer-curls', 'hammer-curl', 'Hammer_Curls'),
'curl-polea': ('standing-biceps-cable-curl', 'cable-curl', 'Standing_Biceps_Cable_Curl'),
'extension-triceps-polea': ('triceps-pushdown', 'tricep-pushdown', 'Triceps_Pushdown'),
'press-frances': ('ez-bar-skullcrusher', 'ez-bar-lying-tricep-extension', 'EZ-Bar_Skullcrusher'),
'sentadilla': ('barbell-squat', 'squat', 'Barbell_Squat'),
'sentadilla-goblet': ('goblet-squat', 'goblet-squat', 'Goblet_Squat'),
'prensa': ('leg-press', 'leg-press', 'Leg_Press'),
'zancadas': ('dumbbell-lunges', 'db-lunge', 'Dumbbell_Lunges'),
'sentadilla-bulgara': ('split-squat-with-dumbbells', 'bulgarian-split-squat', 'Split_Squat_with_Dumbbells'),
'extension-cuadriceps': ('leg-extensions', 'leg-extension', 'Leg_Extensions'),
'curl-femoral': ('lying-leg-curls', 'leg-curl', 'Lying_Leg_Curls'),
'peso-muerto-rumano': ('romanian-deadlift', 'romanian-deadlift', 'Romanian_Deadlift'),
'hip-thrust': ('barbell-hip-thrust', 'hip-thrust', 'Barbell_Hip_Thrust'),
'puente-gluteos': ('butt-lift-bridge', 'glute-bridge', 'Butt_Lift_Bridge'),
'gemelos-pie': ('standing-calf-raises', 'standing-calf-raise', 'Standing_Calf_Raises'),
'gemelos-sentado': ('seated-calf-raise', 'seated-calf-raise', 'Seated_Calf_Raise'),
'remo-apoyado': ('dumbbell-incline-row', 'chest-supported-db-row', 'Dumbbell_Incline_Row'),
'step-ups': ('dumbbell-step-ups', None, 'Dumbbell_Step_Ups'),
'press-landmine': (None, 'landmine-press', None),
'farmer-walk': ('farmer-s-walk', 'dumbbell-farmers-walk', 'Farmers_Walk'),
'pallof-press': ('pallof-press', 'cable-pallof-press', 'Pallof_Press'),
'plancha': ('plank', 'plank', 'Plank'),
'crunch': ('crunches', None, 'Crunches'),
'elevacion-piernas': ('hanging-leg-raise', 'hanging-leg-raise', 'Hanging_Leg_Raise'),
}
lst = lambda t: [x.strip().strip("'") for x in t.split(',') if x.strip()]
core = []
for m in re.finditer(r"^  E\('([a-z0-9-]+)', '([^']+)', '([^']+)', \[([^\]]*)\], \[([^\]]*)\], '([a-zA-Z]+)'", s, re.M):
    i = m.group(1); k, r, y = M[i]
    core.append({'id': i, 'name': m.group(2), 'primary': m.group(3), 'secondary': lst(m.group(4)), 'equipment': lst(m.group(5)), 'kinetic': k, 'repdb': r, 'yuhonas': y})
assert len(core) == len(M), (len(core), len(M))
json.dump({'note': 'Vínculos verificados a mano entre los ejercicios propios de YEMEL GYM y las fuentes. null = no hay equivalente exacto.', 'core': core}, open('scripts/library-links.json', 'w'), ensure_ascii=False, indent=1)
print(len(core))
