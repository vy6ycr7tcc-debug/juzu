
import bpy
import bmesh
import math
from mathutils import Vector, Matrix

# Clear scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# 1. Create base mesh block (1.8m x 0.95m x 0.85m)
w, h, d = 1.8, 0.95, 0.85
bpy.ops.mesh.primitive_cube_add(size=1.0)
obj = bpy.context.active_object
obj.name = "Inca_Ashlar_Megalith"
obj.scale = (w, d, h)
bpy.ops.object.transform_apply(scale=True)

# 2. Subdivide & apply organic pillowing curvature to faces
bpy.ops.object.mode_set(mode='EDIT')
bm = bmesh.from_edit_mesh(obj.data)

# Bevel boundary edges with chamfer
bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=6, use_grid_fill=True)
bmesh.ops.triangulate(bm, faces=bm.faces)

# Apply outward pillowing bulge to front (+Y), back (-Y), left (+X), right (-X), top (+Z)
for v in bm.verts:
    # Normalized position (-1 to 1)
    nx = v.co.x / (w * 0.5)
    ny = v.co.y / (d * 0.5)
    nz = v.co.z / (h * 0.5)
    
    # Pillowing envelope: maximum in center of face, 0 at edges
    # Front/Back face bulge (+Y / -Y)
    if abs(ny) > 0.35:
        edgeFalloff = max(0.0, (1.0 - nx*nx) * (1.0 - nz*nz))
        bulge = math.copysign(0.065 * edgeFalloff, ny)
        v.co.y += bulge
        
    # Left/Right face bulge (+X / -X)
    if abs(nx) > 0.35:
        edgeFalloff = max(0.0, (1.0 - ny*ny) * (1.0 - nz*nz))
        bulge = math.copysign(0.055 * edgeFalloff, nx)
        v.co.x += bulge
        
    # Top face subtle crowning (+Z)
    if nz > 0.35:
        edgeFalloff = max(0.0, (1.0 - nx*nx) * (1.0 - ny*ny))
        v.co.z += 0.038 * edgeFalloff

bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bmesh.update_edit_mesh(obj.data)
bpy.ops.object.mode_set(mode='OBJECT')

# 3. Add Bevel Modifier for authentic Inca chamfered seams
bev = obj.modifiers.new(name="IncaBevel", type='BEVEL')
bev.width = 0.045
bev.segments = 3
bev.profile = 0.72

# Add Subdivision Surface
sub = obj.modifiers.new(name="Subsurf", type='SUBSURF')
sub.levels = 1
sub.render_levels = 2

# Auto-smooth
for p in obj.data.polygons:
    p.use_smooth = True

# 4. PBR Material Setup
mat = bpy.data.materials.new(name="IncaAshlarStone")
mat.use_nodes = True
nodes = mat.node_tree.nodes
bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
bsdf.inputs['Roughness'].default_value = 0.82
bsdf.inputs['Base Color'].default_value = (0.72, 0.68, 0.61, 1.0) # Authentic limestone ashlar

obj.data.materials.append(mat)

# 5. Export clean GLB
bpy.ops.export_scene.gltf(
    filepath=r"/Users/samuelpires/Documents/juzu/public/models/inca_megalith_block.glb",
    export_format='GLB',
    use_selection=True,
    export_apply=True
)
print(">>> EXPORTED GLB TO: /Users/samuelpires/Documents/juzu/public/models/inca_megalith_block.glb")

# 6. Render proof frame
cam_data = bpy.data.cameras.new("ProofCam")
cam_data.lens = 50
cam = bpy.data.objects.new("ProofCam", cam_data)
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

# Position camera for cinematic 3/4 hero angle
cam.location = (2.6, -3.2, 1.6)
direction = Vector((0, 0, 0.1)) - cam.location
rot_quat = direction.to_track_quat('-Z', 'Y')
cam.rotation_euler = rot_quat.to_euler()

# Sunlight key & sky fill
sun_data = bpy.data.lights.new("Sun", 'SUN')
sun_data.energy = 4.5
sun_data.color = (1.0, 0.96, 0.90)
sun = bpy.data.objects.new("Sun", sun_data)
sun.rotation_euler = (math.radians(52), math.radians(18), math.radians(-35))
bpy.context.scene.collection.objects.link(sun)

# Fill light
fill_data = bpy.data.lights.new("Fill", 'SUN')
fill_data.energy = 1.2
fill_data.color = (0.72, 0.82, 0.95)
fill = bpy.data.objects.new("Fill", fill_data)
fill.rotation_euler = (math.radians(-40), 0, math.radians(145))
bpy.context.scene.collection.objects.link(fill)

bpy.context.scene.render.resolution_x = 960
bpy.context.scene.render.resolution_y = 540
bpy.context.scene.render.image_settings.file_format = 'PNG'
bpy.context.scene.render.filepath = r"/Users/samuelpires/Documents/juzu/scripts/shots/blender_inca_block_proof.png"

bpy.ops.render.render(write_still=True)
print(">>> RENDERED PROOF TO: /Users/samuelpires/Documents/juzu/scripts/shots/blender_inca_block_proof.png")
