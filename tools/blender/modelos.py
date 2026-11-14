# Modela en Blender los módulos principales de HORIZONTE, los exporta a .glb y renderiza vistas previas.
# Uso:  blender -b --python tools/blender/modelos.py -- --glb assets/modelos --previas /ruta/previas [--solo habitat,reactor]
#
# Convenciones para el juego (js/mundo3d.js):
#   - metros reales, apoyado en el suelo (Z = 0), centrado en el origen
#   - material "ventana" (brilla de noche), objeto "baliza" (parpadea), material "placa" (panel dañado), objeto "nucleo"
import bpy
import math
import os
import sys
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(nombre, defecto=None):
    return args[args.index(nombre) + 1] if nombre in args else defecto
SALIDA_GLB = arg('--glb', 'assets/modelos')
SALIDA_PREVIAS = arg('--previas')
SOLO = arg('--solo', 'habitat,reactor,panel').split(',')

# ───────────────────────── utilidades ─────────────────────────
def limpiar():
    bpy.ops.wm.read_factory_settings(use_empty=True)

MATS = {}
def mat(nombre, color, rough=0.5, metal=0.0, emis=None, fuerza=0.0, alpha=1.0):
    if nombre in MATS:
        return MATS[nombre]
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emis:
        b.inputs['Emission Color'].default_value = (*emis, 1)
        b.inputs['Emission Strength'].default_value = fuerza
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND'
    MATS[nombre] = m
    return m

def poner(obj, material, nombre=None, coleccion=None, suave=True, bisel=0.0):
    if nombre:
        obj.name = nombre
        obj.data.name = nombre
    obj.data.materials.clear()
    obj.data.materials.append(material)
    if bisel:
        mod = obj.modifiers.new('bisel', 'BEVEL')
        mod.width = bisel
        mod.segments = 2
        mod.limit_method = 'ANGLE'
    if suave:
        for p in obj.data.polygons:
            p.use_smooth = True
        mod = obj.modifiers.new('normales', 'WEIGHTED_NORMAL') if bisel else None
        if hasattr(obj.data, 'use_auto_smooth'):
            obj.data.use_auto_smooth = True
            obj.data.auto_smooth_angle = math.radians(40)
    if coleccion:
        for c in obj.users_collection:
            c.objects.unlink(obj)
        coleccion.objects.link(obj)
    return obj

def cil(r, h, pos, verts=48, r2=None, rot=(0, 0, 0)):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=verts, location=pos, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=h, vertices=verts, location=pos, rotation=rot)
    return bpy.context.active_object

def caja(dim, pos, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos, rotation=rot)
    o = bpy.context.active_object
    o.scale = dim
    bpy.ops.object.transform_apply(scale=True)
    return o

def toro(R, r, pos, rot=(0, 0, 0), mayor=48, menor=12):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=mayor, minor_segments=menor, location=pos, rotation=rot)
    return bpy.context.active_object

def esfera(r, pos, seg=32, anillos=16):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=anillos, location=pos)
    return bpy.context.active_object

def nueva_coleccion(nombre):
    c = bpy.data.collections.new(nombre)
    bpy.context.scene.collection.children.link(c)
    return c

# ───────────────────────── materiales ─────────────────────────
def materiales():
    return {
        'tela': mat('tela', (0.86, 0.84, 0.79), rough=0.85),
        'blanco': mat('blanco', (0.9, 0.91, 0.93), rough=0.4),
        'gris': mat('gris', (0.42, 0.45, 0.5), rough=0.45, metal=0.6),
        'oscuro': mat('oscuro', (0.06, 0.07, 0.09), rough=0.4, metal=0.7),
        'metal': mat('metal', (0.75, 0.77, 0.8), rough=0.22, metal=1.0),
        'oro': mat('oro', (0.83, 0.58, 0.18), rough=0.28, metal=1.0),
        'amarillo': mat('amarillo', (0.95, 0.68, 0.05), rough=0.5),
        'naranja': mat('naranja', (0.95, 0.35, 0.05), rough=0.5),
        'vidrio': mat('ventana', (0.12, 0.1, 0.06), rough=0.08, emis=(1.0, 0.72, 0.35), fuerza=0.3),
        'baliza': mat('baliza', (1, 0.1, 0.1), emis=(1, 0.08, 0.08), fuerza=6),
        'luz': mat('luz_blanca', (1, 1, 1), emis=(0.8, 0.9, 1.0), fuerza=4),
        'nucleo': mat('nucleo', (1, 0.55, 0.15), emis=(1, 0.45, 0.1), fuerza=8),
        'radiador': mat('radiador', (0.78, 0.82, 0.9), rough=0.3, metal=0.2),
    }

# ───────────────────────── HÁBITAT (inflable, estilo Artemis) ─────────────────────────
def habitat(M):
    C = nueva_coleccion('habitat')
    R, ALTO = 3.15, 2.5
    poner(cil(R + 0.15, 0.3, (0, 0, 0.15), 64), M['gris'], 'zocalo', C, bisel=0.03)
    poner(cil(R, ALTO, (0, 0, 0.3 + ALTO / 2), 64), M['tela'], 'cuerpo', C)
    # Cúpula achatada
    bpy.ops.mesh.primitive_uv_sphere_add(radius=R, segments=48, ring_count=24, location=(0, 0, 0.3 + ALTO))
    cupula = bpy.context.active_object
    cupula.scale.z = 0.62
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.object.mode_set(mode='OBJECT')
    for v in cupula.data.vertices:
        v.select = v.co.z < -0.001
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.delete(type='VERT')
    bpy.ops.object.mode_set(mode='OBJECT')
    poner(cupula, M['tela'], 'cupula', C)
    # Costillas horizontales (estructura inflable)
    for z in (0.55, 1.25, 1.95, 2.65):
        poner(toro(R + 0.02, 0.055, (0, 0, z), mayor=64, menor=6), M['blanco'], None, C)
    for lat in (0.35, 0.68):
        rr = R * math.cos(math.asin(lat))
        poner(toro(rr + 0.02, 0.05, (0, 0, 0.3 + ALTO + R * 0.62 * lat), mayor=64, menor=6), M['blanco'], None, C)
    # Correas verticales
    for i in range(16):
        a = i / 16 * math.tau
        poner(caja((0.07, 0.12, ALTO), (math.cos(a) * (R + 0.03), math.sin(a) * (R + 0.03), 0.3 + ALTO / 2), (0, 0, a)), M['blanco'], None, C)
    # Escotilla superior (cúpula de observación)
    tope = 0.3 + ALTO + R * 0.62
    poner(cil(0.85, 0.25, (0, 0, tope - 0.02), 48), M['gris'], 'escotilla', C, bisel=0.02)
    poner(esfera(0.62, (0, 0, tope + 0.1), 32, 16), M['vidrio'], 'cupula_vidrio', C)
    # Ojos de buey (brillan de noche)
    for i in range(6):
        a = i / 6 * math.tau + math.radians(30)
        x, y = math.cos(a) * (R + 0.04), math.sin(a) * (R + 0.04)
        poner(toro(0.36, 0.07, (x, y, 1.75), (math.pi / 2, 0, a + math.pi / 2), 32, 10), M['gris'], None, C)
        poner(cil(0.33, 0.06, (x, y, 1.75), 32, rot=(math.pi / 2, 0, a + math.pi / 2)), M['vidrio'], f'ventana_{i}', C)
    # Esclusa (hacia +X)
    poner(cil(0.95, 2.3, (R + 0.9, 0, 1.3), 48, rot=(0, math.pi / 2, 0)), M['blanco'], 'esclusa', C, bisel=0.02)
    for x in (R + 0.1, R + 1.0, R + 1.95):
        poner(toro(0.97, 0.06, (x, 0, 1.3), (0, math.pi / 2, 0), 48, 8), M['gris'], None, C)
    poner(cil(0.72, 0.12, (R + 2.08, 0, 1.3), 40, rot=(0, math.pi / 2, 0)), M['gris'], 'compuerta', C, bisel=0.02)
    poner(toro(0.3, 0.035, (R + 2.16, 0, 1.3), (0, math.pi / 2, 0), 24, 8), M['amarillo'], 'manija', C)
    for dz in (-0.55, 0.55):
        poner(caja((1.8, 0.05, 0.05), (R + 1.05, 0.97, 1.3 + dz)), M['amarillo'], None, C)
    # Rampa y escalones
    for k in range(4):
        poner(caja((0.5, 1.2, 0.08), (R + 2.35 + k * 0.28, 0, 0.9 - k * 0.24)), M['gris'], None, C)
    # Tanques de gas (O₂ / N₂)
    for y in (-1.3, 1.3):
        poner(esfera(0.48, (-R - 1.05, y, 0.75), 32, 16), M['blanco'], None, C)
        poner(toro(0.49, 0.03, (-R - 1.05, y, 0.75), mayor=48, menor=6), M['naranja'], None, C)
        poner(cil(0.07, 0.75, (-R - 1.05, y, 0.25), 12), M['metal'], None, C)
        poner(cil(0.05, 0.9, (-R - 0.6, y, 0.85), 12, rot=(0, math.pi / 2, 0)), M['metal'], None, C)
    # Antena con baliza
    poner(cil(0.06, 2.4, (-1.2, -1.0, tope + 0.6), 12), M['metal'], 'mastil', C)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.8, segments=32, ring_count=16, location=(-1.2, -1.0, tope + 1.6))
    plato = bpy.context.active_object
    for v in plato.data.vertices:
        v.co.z = min(v.co.z, -0.45)
    plato.rotation_euler = (math.radians(35), 0, math.radians(-30))
    poner(plato, M['metal'], 'antena', C)
    poner(esfera(0.13, (-1.2, -1.0, tope + 1.9), 16, 8), M['baliza'], 'baliza', C, suave=True)
    # Luces exteriores
    for a in (0.2, 2.3, 4.4):
        poner(caja((0.25, 0.1, 0.12), (math.cos(a) * (R + 0.06), math.sin(a) * (R + 0.06), 2.85), (0, 0, a)), M['luz'], None, C)
    return C

# ───────────────────────── REACTOR (inspirado en Fission Surface Power) ─────────────────────────
def reactor(M):
    C = nueva_coleccion('reactor')
    poner(cil(1.75, 0.45, (0, 0, 0.22), 48, r2=1.55), M['oscuro'], 'base', C, bisel=0.03)
    poner(cil(1.05, 2.4, (0, 0, 1.65), 48), M['gris'], 'vasija', C, bisel=0.03)
    for z, color in ((1.0, 'amarillo'), (1.18, 'oscuro'), (1.36, 'amarillo')):
        poner(cil(1.08, 0.16, (0, 0, z), 48), M[color], None, C)
    poner(cil(1.05, 0.7, (0, 0, 3.2), 48, r2=0.55), M['gris'], 'blindaje_superior', C, bisel=0.02)
    poner(toro(1.0, 0.09, (0, 0, 2.86), mayor=64, menor=12), M['nucleo'], 'nucleo', C)
    for i in range(8):
        a = i / 8 * math.tau
        poner(caja((0.12, 0.25, 2.2), (math.cos(a) * 1.08, math.sin(a) * 1.08, 1.75), (0, 0, a)), M['oscuro'], None, C)
    # Mástil y radiadores (las "alas" que disipan el calor)
    poner(cil(0.14, 4.0, (0, 0, 5.5), 16), M['metal'], 'mastil', C)
    for lado in (-1, 1):
        ala = caja((2.6, 0.05, 3.2), (lado * 1.55, 0, 5.6))
        poner(ala, M['radiador'], f'radiador_{"izq" if lado < 0 else "der"}', C, suave=False)
        for k in range(7):
            for cara in (-0.05, 0.05):  # tubos de calor visibles por ambos lados
                poner(caja((0.05, 0.06, 3.1), (lado * (0.45 + k * 0.36), cara, 5.6)), M['oscuro'], None, C, suave=False)
        poner(caja((0.06, 0.08, 3.5), (lado * 1.55, 0, 5.6), (0, lado * 0.68, 0)), M['metal'], None, C, suave=False)
        poner(caja((2.7, 0.1, 0.1), (lado * 1.55, 0, 7.25)), M['metal'], None, C)
        poner(caja((2.7, 0.1, 0.1), (lado * 1.55, 0, 3.95)), M['metal'], None, C)
    poner(cil(0.3, 0.3, (0, 0, 7.6), 24), M['gris'], None, C)
    poner(esfera(0.1, (0, 0, 7.8), 12, 6), M['baliza'], 'baliza_reactor', C)
    # Carrete de cable
    poner(cil(0.5, 0.5, (1.9, 0.9, 0.5), 32, rot=(math.pi / 2, 0, 0)), M['naranja'], 'carrete', C)
    poner(cil(0.62, 0.06, (1.9, 0.62, 0.5), 32, rot=(math.pi / 2, 0, 0)), M['oscuro'], None, C)
    poner(cil(0.62, 0.06, (1.9, 1.18, 0.5), 32, rot=(math.pi / 2, 0, 0)), M['oscuro'], None, C)
    # Señal de radiación (triángulo amarillo)
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.32, depth=0.03, location=(0, -1.12, 1.85), rotation=(math.pi / 2, 0, 0))
    poner(bpy.context.active_object, M['amarillo'], 'senal', C, suave=False)
    return C

# ───────────────────────── PANEL SOLAR ─────────────────────────
def textura_celdas():
    w, h = 512, 320
    img = bpy.data.images.new('celdas', w, h)
    px = [0.0] * (w * h * 4)
    for y in range(h):
        for x in range(w):
            borde = (x % 64 < 3) or (y % 64 < 3)
            dedo = (x % 16 == 0) and not borde
            i = (y * w + x) * 4
            if borde:
                r, g, b = 0.7, 0.72, 0.78
            elif dedo:
                r, g, b = 0.25, 0.3, 0.45
            else:
                t = (x + y) / (w + h)
                r, g, b = 0.03 + 0.03 * t, 0.06 + 0.06 * t, 0.22 + 0.12 * t
            px[i:i + 4] = (r, g, b, 1.0)
    img.pixels = px
    img.pack()
    return img

def panel(M):
    C = nueva_coleccion('panel')
    m = bpy.data.materials.new('placa')
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = textura_celdas()
    nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.18
    b.inputs['Metallic'].default_value = 0.6
    poner(cil(0.3, 0.12, (0, 0, 0.06), 24), M['gris'], 'base', C, bisel=0.02)
    poner(cil(0.07, 1.35, (0, 0, 0.75), 16), M['metal'], 'poste', C)
    poner(caja((0.3, 0.25, 0.2), (0, 0, 1.4)), M['oscuro'], 'motor', C, bisel=0.02)
    # La placa se arma plana en el origen y al final se inclina y se sube como un solo objeto
    piezas = []
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.026))
    celdas = bpy.context.active_object
    celdas.scale = (2.4, 1.6, 1)
    bpy.ops.object.transform_apply(scale=True)
    piezas.append(poner(celdas, m, None, None, suave=False))
    piezas.append(poner(caja((2.42, 1.62, 0.05), (0, 0, 0)), M['oscuro'], None, None, suave=False))
    for dx, dy, sx, sy in ((0, 0.82, 2.5, 0.06), (0, -0.82, 2.5, 0.06), (1.22, 0, 0.06, 1.7), (-1.22, 0, 0.06, 1.7)):
        piezas.append(poner(caja((sx, sy, 0.08), (dx, dy, 0.01)), M['metal'], None, None, suave=False))
    bpy.ops.object.select_all(action='DESELECT')
    for o in piezas:
        o.select_set(True)
    bpy.context.view_layer.objects.active = piezas[0]
    bpy.ops.object.join()
    placa = bpy.context.active_object
    placa.name = placa.data.name = 'placa'
    placa.rotation_euler = (-0.5, 0, 0)
    placa.location = (0, 0, 1.58)
    for c in placa.users_collection:
        c.objects.unlink(placa)
    C.objects.link(placa)
    for dx in (-0.8, 0.8):
        poner(caja((0.05, 0.05, 0.62), (dx, 0.12, 1.27), (0.55, 0, 0)), M['metal'], None, C, suave=False)
    return C

# ───────────────────────── exportar y renderizar ─────────────────────────
def exportar(C, nombre):
    os.makedirs(SALIDA_GLB, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in C.all_objects:
        o.select_set(True)
    ruta = os.path.join(SALIDA_GLB, f'{nombre}.glb')
    bpy.ops.export_scene.gltf(filepath=ruta, export_format='GLB', use_selection=True, export_apply=True, export_yup=True)
    print(f'EXPORTADO {ruta} {os.path.getsize(ruta) / 1024:.1f} KB')

def previa(C, nombre, distancia, altura, objetivo_z, lado=-1):
    escena = bpy.context.scene
    for c in bpy.data.collections:
        c.hide_render = c is not C and c.name not in ('estudio',)
    escena.render.engine = 'CYCLES'
    escena.cycles.device = 'CPU'
    escena.cycles.samples = 128
    escena.cycles.use_denoising = bool(getattr(bpy.app.build_options, 'openimagedenoise', False))
    escena.render.resolution_x, escena.render.resolution_y = 1000, 700
    escena.view_settings.view_transform = 'Filmic' if 'Filmic' in [i.identifier for i in escena.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Standard'
    cam = bpy.data.objects.get('camara')
    cam.location = (distancia, lado * distancia * 0.9, altura)
    direccion = Vector((0, 0, objetivo_z)) - cam.location
    cam.rotation_euler = direccion.to_track_quat('-Z', 'Y').to_euler()
    escena.render.filepath = os.path.join(SALIDA_PREVIAS, f'{nombre}.png')
    bpy.ops.render.render(write_still=True)
    print(f'PREVIA {escena.render.filepath}')

def estudio():
    C = nueva_coleccion('estudio')
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
    suelo = bpy.context.active_object
    poner(suelo, mat('suelo', (0.36, 0.36, 0.38), rough=0.95), 'suelo', C, suave=False)
    bpy.ops.object.light_add(type='SUN', location=(10, -6, 12))
    sol = bpy.context.active_object
    sol.data.energy = 4.5
    sol.data.angle = math.radians(2)
    sol.rotation_euler = (math.radians(50), 0, math.radians(35))
    C.objects.link(sol); bpy.context.scene.collection.objects.unlink(sol)
    bpy.ops.object.camera_add()
    cam = bpy.context.active_object
    cam.name = 'camara'
    cam.data.lens = 40
    bpy.context.scene.camera = cam
    mundo = bpy.data.worlds.new('mundo')
    mundo.use_nodes = True
    mundo.node_tree.nodes['Background'].inputs['Color'].default_value = (0.01, 0.012, 0.03, 1)
    mundo.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.2
    bpy.context.scene.world = mundo

limpiar()
M = materiales()
FABRICAS = {
    'habitat': (habitat, (13, 7.5, 2.4)),
    'reactor': (reactor, (11, 6.5, 3.6)),
    'panel': (panel, (4.2, 2.8, 1.1, 1)),
}
creadas = {n: FABRICAS[n][0](M) for n in SOLO if n in FABRICAS}
for nombre, C in creadas.items():
    exportar(C, nombre)
if SALIDA_PREVIAS:
    os.makedirs(SALIDA_PREVIAS, exist_ok=True)
    estudio()
    for nombre, C in creadas.items():
        previa(C, nombre, *FABRICAS[nombre][1])
