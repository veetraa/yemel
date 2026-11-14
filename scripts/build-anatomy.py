"""
Construye public/models/anatomy/anatomy.glb a partir del modelo muscular de Z-Anatomy (CC BY-SA 4.0).

  git clone --depth 1 --filter=blob:none --no-checkout -b PC-Version https://github.com/LluisV/Z-Anatomy z
  (cd z && git checkout HEAD -- Resources/Models/FBX/MuscularSystem100.fbx)
  pip install bpy numpy
  python3 scripts/build-anatomy.py /ruta/a/MuscularSystem100.fbx

Cambios respecto al original (obligatorio indicarlos por la licencia):
  · Se descartan fascias, ligamentos, bolsas, vainas, vasos, nervios y músculos profundos (laringe, ojos, lengua…).
  · Se simplifica la malla (decimación) hasta ~250 000 triángulos.
  · Los músculos se agrupan por zona (chest, back, traps, delts, biceps, triceps, forearm, quads, hams, glutes,
    calves, core, other) para poder iluminarlos por separado.
  · Se añade un esqueleto de 17 huesos con pesos de piel por distancia y se pasa a glTF binario (GLB), eje Y arriba,
    mirando a +X, en metros.
"""
import bpy, json, math, re, struct, sys
import numpy as np

SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/models/anatomy/anatomy.glb'
BUDGET = 250_000  # triángulos

HIDE = re.compile(r'sheath|bursa|ligament|vein|artery|nerve|membrane|capsule|septum|fat|gland|cartilage|disc|fascia|cross section|retinaculum|tract|tarsus|tendinous ring|arch|'
                  r'diaphragm|intercostal|psoas|iliacus|quadratus lumborum|multifidus|rotatores|interspinales|intertransvers|levatores|longus colli|longus capitis|'
                  r'rectus (anterior|lateralis|posterior) capitis|obliquus|pharyng|genio|hyo|mylo|crico|thyro|arytenoid|pterygoid|oculi|rectus muscle|oblique muscle|palpebrae|'
                  r'digastric|omohyoid|scalenus|coccyg|pubo|anal|gemellus|obturator|piriformis|quadratus femoris|popliteus|trachea|larynx|tongue|aponeurosis|linea alba', re.I)
ZONES = [
    ('chest', r'pectoralis'),
    ('delts', r'deltoid'),
    ('biceps', r'biceps brachii|brachialis|coracobrachialis'),
    ('triceps', r'triceps brachii|anconeus'),
    ('forearm', r'brachioradialis|flexor|extensor|pronator|supinator|palmaris|pollicis|carpi|digit|indicis|interossei|lumbrical|opponens|abductor'),
    ('quads', r'rectus femoris|vastus|sartorius'),
    ('hams', r'biceps femoris|semitendinosus|semimembranosus'),
    ('glutes', r'gluteus|tensor fasciae'),
    ('calves', r'gastrocnemius|soleus|plantaris|calcaneal'),
    ('core', r'rectus abdominis|abdominal oblique|transversus abdominis|pyramidalis|serratus anterior'),
    ('traps', r'trapezius|levator scapulae'),
    ('back', r'latissimus|rhomboid|erector|iliocostalis|longissimus|spinalis|teres|infraspinatus|supraspinatus|subscapularis|serratus posterior|splenius|semispinalis'),
]
ZONE_ORDER = [z for z, _ in ZONES] + ['other']

# ── Esqueleto (hitos del esqueleto de Z-Anatomy; Blender: +X izquierda, −Y delante, Z arriba) ──
def app(p):  # Blender → app: X delante, Y arriba, Z lateral (la izquierda anatómica queda en −Z)
    return np.array([-p[1], p[2], -p[0]], dtype=np.float64)
M = {'sh': (0.171, 0.016, 1.411), 'el': (0.217, 0.009, 1.098), 'wr': (0.262, -0.02, 0.875), 'hand': (0.285, -0.088, 0.70),
     'hip': (0.075, 0.0, 0.894), 'kn': (0.076, 0.02, 0.43), 'an': (0.075, 0.037, 0.075), 'toe': (0.08, -0.124, 0.02)}
MID = {'hips': (0, -0.01, 0.93), 'spine': (0, -0.01, 1.06), 'chest': (0, -0.01, 1.25), 'neck': (0, -0.01, 1.43), 'head': (0, 0.0, 1.52), 'headTip': (0, 0.0, 1.72)}
def side(p, sign):  # sign=+1 lado +X de Blender, -1 el otro
    return (p[0] * sign, p[1], p[2])
BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'uaL', 'faL', 'handL', 'uaR', 'faR', 'handR', 'thL', 'shL', 'ftL', 'thR', 'shR', 'ftR']
PARENT = {'hips': None, 'spine': 'hips', 'chest': 'spine', 'neck': 'chest', 'head': 'neck', 'uaL': 'chest', 'faL': 'uaL', 'handL': 'faL', 'uaR': 'chest', 'faR': 'uaR', 'handR': 'faR',
          'thL': 'hips', 'shL': 'thL', 'ftL': 'shL', 'thR': 'hips', 'shR': 'thR', 'ftR': 'shR'}
REST, TAIL = {}, {}
for n, k, t in [('hips', 'hips', 'spine'), ('spine', 'spine', 'chest'), ('chest', 'chest', 'neck'), ('neck', 'neck', 'head'), ('head', 'head', 'headTip')]:
    REST[n] = app(MID[k]); TAIL[n] = app(MID[t])
for sd, sg in (('L', -1), ('R', 1)):  # L = +Z de la app (lado −X de Blender)
    s = lambda k: app(side(M[k], sg))
    REST['ua' + sd], TAIL['ua' + sd] = s('sh'), s('el')
    REST['fa' + sd], TAIL['fa' + sd] = s('el'), s('wr')
    REST['hand' + sd], TAIL['hand' + sd] = s('wr'), s('hand')
    REST['th' + sd], TAIL['th' + sd] = s('hip'), s('kn')
    REST['sh' + sd], TAIL['sh' + sd] = s('kn'), s('an')
    REST['ft' + sd], TAIL['ft' + sd] = s('an'), s('toe')

# ── Importar, filtrar, decimar ──
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
objs = [o for o in bpy.data.objects if o.type == 'MESH' and not HIDE.search(o.name)]
total = sum(len(o.data.polygons) for o in objs)
def ntris(o):
    o.data.calc_loop_triangles(); return len(o.data.loop_triangles)
tris_total = sum(ntris(o) for o in objs)
ratio = min(1.0, BUDGET / tris_total)
print('piezas', len(objs), 'triángulos', tris_total, 'ratio', round(ratio, 3))
dg = bpy.context.evaluated_depsgraph_get()

def zone_of(name):
    for z, rx in ZONES:
        if re.search(rx, name, re.I): return z
    return 'other'

groups = {z: {'p': [], 'f': [], 'n': 0} for z in ZONE_ORDER}
for o in objs:
    if len(o.data.polygons) > 80:
        mod = o.modifiers.new('d', 'DECIMATE'); mod.ratio = max(0.02, ratio)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
dg.update()
for o in objs:
    z = zone_of(o.name)
    ev = o.evaluated_get(dg); me = ev.to_mesh()
    me.calc_loop_triangles()
    mw = np.array(o.matrix_world)
    v = np.array([vv.co[:] for vv in me.vertices], dtype=np.float64)
    if not len(v): continue
    vw = (mw[:3, :3] @ v.T).T + mw[:3, 3]
    va = np.stack([-vw[:, 1], vw[:, 2], -vw[:, 0]], axis=1)  # a espacio de la app
    tri = np.array([t.vertices[:] for t in me.loop_triangles], dtype=np.int64).reshape(-1, 3)
    g = groups[z]; g['p'].append(va); g['f'].append(tri + g['n']); g['n'] += len(va)
    ev.to_mesh_clear()

# ── Pesos de piel: 4 huesos más cercanos ──
segA = np.array([REST[b] for b in BONES]); segB = np.array([TAIL[b] for b in BONES])
def weights(P):
    ab = segB - segA; ab2 = (ab * ab).sum(1)
    d = np.empty((len(P), len(BONES)))
    for i in range(len(BONES)):
        t = np.clip(((P - segA[i]) @ ab[i]) / ab2[i], 0, 1)
        d[:, i] = np.linalg.norm(P - (segA[i] + t[:, None] * ab[i]), axis=1)
    idx = np.argsort(d, axis=1)[:, :4]
    dd = np.take_along_axis(d, idx, 1)
    w = 1.0 / np.power(dd + 0.012, 4); w /= w.sum(1, keepdims=True)
    q = np.round(w * 255).astype(np.int32); q[:, 0] += 255 - q.sum(1)  # cuantizar a 8 bits sumando 255
    return idx.astype(np.uint8), np.clip(q, 0, 255).astype(np.uint8)

def normals(P, F):
    n = np.zeros_like(P); fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    for k in range(3): np.add.at(n, F[:, k], fn)
    l = np.linalg.norm(n, axis=1, keepdims=True); l[l == 0] = 1
    return (n / l).astype(np.float32)

# ── Escritor GLB ──
blob = bytearray(); views = []; accs = []
def add(arr, target=None, comp=None, typ=None, minmax=False, normalized=False):
    while len(blob) % 4: blob.append(0)
    off = len(blob); blob.extend(arr.tobytes())
    views.append({'buffer': 0, 'byteOffset': off, 'byteLength': arr.nbytes, **({'target': target} if target else {})})
    a = {'bufferView': len(views) - 1, 'componentType': comp, 'count': len(arr), 'type': typ}
    if minmax: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    if comp == 5121 and typ == 'VEC4' and arr.dtype == np.uint8 and normalized: a['normalized'] = True
    accs.append(a); return len(accs) - 1

nodes = []
for b in BONES:
    p = PARENT[b]; t = (REST[b] - (REST[p] if p else 0)).tolist()
    nodes.append({'name': b, 'translation': t, 'children': []})
for i, b in enumerate(BONES):
    if PARENT[b]: nodes[BONES.index(PARENT[b])]['children'].append(i)
ibm = np.zeros((len(BONES), 16), dtype=np.float32)
for i, b in enumerate(BONES):
    m = np.eye(4); m[:3, 3] = -REST[b]; ibm[i] = m.T.reshape(16)  # column-major
ibm_acc = add(ibm, comp=5126, typ='MAT4')

meshes = []; mesh_nodes = []; info = {}
for z in ZONE_ORDER:
    g = groups[z]
    if not g['p']: continue
    P = np.concatenate(g['p']); F = np.concatenate(g['f'])
    key = np.round(P * 1e5).astype(np.int64)  # soldar vértices coincidentes
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    P = P[first].astype(np.float32); F = inv.reshape(-1)[F].astype(np.uint32)
    F = F[(F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])]
    J, W = weights(P.astype(np.float64)); N = normals(P.astype(np.float64), F.astype(np.int64))
    J4 = np.zeros((len(P), 4), dtype=np.uint8); J4[:] = J
    prim = {'attributes': {'POSITION': add(P, 34962, 5126, 'VEC3', True), 'NORMAL': add(N, 34962, 5126, 'VEC3'),
                           'JOINTS_0': add(J4, 34962, 5121, 'VEC4'), 'WEIGHTS_0': add(W, 34962, 5121, 'VEC4', normalized=True)},
            'indices': add(F.reshape(-1), 34963, 5125, 'SCALAR'), 'material': 0, 'mode': 4}
    meshes.append({'name': 'm_' + z, 'primitives': [prim]})
    mesh_nodes.append({'name': 'm_' + z, 'mesh': len(meshes) - 1, 'skin': 0})
    info[z] = {'verts': len(P), 'tris': len(F)}
base = len(nodes); nodes.extend(mesh_nodes)
gltf = {
    'asset': {'version': '2.0', 'generator': 'YEMEL GYM build-anatomy.py', 'copyright': 'Z-Anatomy (CC BY-SA 4.0), modificado'},
    'scene': 0, 'scenes': [{'nodes': [0] + list(range(base, base + len(mesh_nodes))), 'extras': {'rig': {'rest': {b: REST[b].tolist() for b in BONES}, 'tail': {b: TAIL[b].tolist() for b in BONES}}}}],
    'nodes': nodes, 'meshes': meshes, 'skins': [{'joints': list(range(len(BONES))), 'inverseBindMatrices': ibm_acc, 'skeleton': 0}],
    'materials': [{'name': 'grey', 'pbrMetallicRoughness': {'baseColorFactor': [0.6, 0.63, 0.67, 1], 'metallicFactor': 0.75, 'roughnessFactor': 0.38}}],
    'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(blob)}],
}
js = json.dumps(gltf, separators=(',', ':')).encode()
js += b' ' * ((4 - len(js) % 4) % 4)
while len(blob) % 4: blob.append(0)
import os; os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(blob), 0x004E4942)); f.write(bytes(blob))
print(json.dumps(info), os.path.getsize(OUT) / 1048576, 'MB')
