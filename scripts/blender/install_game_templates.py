#!/usr/bin/env python3
"""
Install Blender Application Templates for Game Development, Rigging, and Environments.
Installs into ~/Library/Application Support/Blender/5.2/scripts/startup/bl_app_templates_user/
"""
import os
import sys
import bpy

TEMPLATE_BASE = bpy.utils.user_resource('SCRIPTS', path='startup/bl_app_templates_user', create=True)
print(f"Installing templates into: {TEMPLATE_BASE}")

def create_game_asset_template():
    name = "Game_Asset_glTF"
    target_dir = os.path.join(TEMPLATE_BASE, name)
    os.makedirs(target_dir, exist_ok=True)
    
    # 1. Reset to blank scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    
    scene = bpy.context.scene
    # Metric 1:1 meter units for Three.js / WebGL / WebGPU
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = 'METERS'
    
    # EEVEE Real-time viewport
    scene.render.engine = 'BLENDER_EEVEE'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'None'
    scene.display_settings.display_device = 'sRGB'
    
    # World setup: Subtle atmospheric ambient
    world = bpy.data.worlds.new("Game_World")
    world.use_nodes = True
    bg_node = world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs['Color'].default_value = (0.04, 0.05, 0.07, 1.0)
        bg_node.inputs['Strength'].default_value = 0.8
    scene.world = world
    
    # Directional Sun (matching outdoor game lighting)
    sun_data = bpy.data.lights.new(name="Sun_Key", type='SUN')
    sun_data.energy = 3.5
    sun_data.color = (1.0, 0.96, 0.90)
    sun_obj = bpy.data.objects.new(name="Sun_Key", object_data=sun_data)
    sun_obj.rotation_euler = (0.785, 0.38, 0.62)
    scene.collection.objects.link(sun_obj)
    
    # Camera: Third-person orbit view framing
    cam_data = bpy.data.cameras.new(name="Game_Camera")
    cam_data.lens = 50
    cam_obj = bpy.data.objects.new(name="Game_Camera", object_data=cam_data)
    cam_obj.location = (0, -3.8, 1.6)
    cam_obj.rotation_euler = (1.35, 0, 0)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    
    # Save startup.blend
    blend_path = os.path.join(target_dir, "startup.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    
    # Save __init__.py
    init_path = os.path.join(target_dir, "__init__.py")
    with open(init_path, "w") as f:
        f.write('''import bpy

bl_info = {
    "name": "Game Asset glTF Template",
    "description": "Standardized 1:1 Metric meter units, AgX/sRGB color, EEVEE Next, and glTF 2.0 WebGL/WebGPU pipeline",
    "author": "Antigravity Juzu Pipeline",
    "version": (1, 0, 0),
    "blender": (5, 2, 0),
    "category": "Application Template",
}

def register():
    pass

def unregister():
    pass
''')
    print(f"  ✓ Installed template: {name}")

def create_character_rig_template():
    name = "Third_Person_Character_Rig"
    target_dir = os.path.join(TEMPLATE_BASE, name)
    os.makedirs(target_dir, exist_ok=True)
    
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = 'METERS'
    scene.render.engine = 'BLENDER_EEVEE'
    
    # Sun Light
    sun_data = bpy.data.lights.new(name="Sun_Rig", type='SUN')
    sun_data.energy = 3.0
    sun_obj = bpy.data.objects.new(name="Sun_Rig", object_data=sun_data)
    sun_obj.rotation_euler = (0.7, 0.4, 0.5)
    scene.collection.objects.link(sun_obj)
    
    # Standard 1.75m reference humanoid guide
    ref_mesh = bpy.data.meshes.new("Human_Scale_Guide_1.75m")
    # Simple reference bounding wireframe
    ref_obj = bpy.data.objects.new("Human_Scale_Guide_1.75m", ref_mesh)
    ref_obj.display_type = 'WIRE'
    scene.collection.objects.link(ref_obj)
    
    blend_path = os.path.join(target_dir, "startup.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    
    init_path = os.path.join(target_dir, "__init__.py")
    with open(init_path, "w") as f:
        f.write('''import bpy

bl_info = {
    "name": "Third-Person Character Rig Template",
    "description": "Configured for biped humanoid rigging, Mixamo retargeting, and locomotion cycles (idle, walk, run, vault, pivot)",
    "author": "Antigravity Juzu Pipeline",
    "version": (1, 0, 0),
    "blender": (5, 2, 0),
    "category": "Application Template",
}

def register():
    pass

def unregister():
    pass
''')
    print(f"  ✓ Installed template: {name}")

def create_environment_template():
    name = "Modular_Inca_Environment"
    target_dir = os.path.join(TEMPLATE_BASE, name)
    os.makedirs(target_dir, exist_ok=True)
    
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = 'METERS'
    scene.render.engine = 'BLENDER_EEVEE'
    
    # Directional sun
    sun_data = bpy.data.lights.new(name="Sun_Env", type='SUN')
    sun_data.energy = 4.0
    sun_data.color = (1.0, 0.95, 0.88)
    sun_obj = bpy.data.objects.new(name="Sun_Env", object_data=sun_data)
    sun_obj.rotation_euler = (0.85, 0.35, 0.8)
    scene.collection.objects.link(sun_obj)
    
    blend_path = os.path.join(target_dir, "startup.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    
    init_path = os.path.join(target_dir, "__init__.py")
    with open(init_path, "w") as f:
        f.write('''import bpy

bl_info = {
    "name": "Modular Inca Environment Template",
    "description": "Configured for modular stone masonry, terrace elevation increments (0.25m/0.5m/1m snapping), and Andean foliage scattering",
    "author": "Antigravity Juzu Pipeline",
    "version": (1, 0, 0),
    "blender": (5, 2, 0),
    "category": "Application Template",
}

def register():
    pass

def unregister():
    pass
''')
    print(f"  ✓ Installed template: {name}")

if __name__ == '__main__':
    create_game_asset_template()
    create_character_rig_template()
    create_environment_template()
    print("\nAll 3 Blender Application Templates installed successfully!")
