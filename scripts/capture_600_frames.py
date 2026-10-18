#!/usr/bin/env python3
"""capture_600_frames.py — Capture 600 comprehensive visual frames across all biomes, mechanics, assets, and lighting conditions."""
import json
import math
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path("/Users/samuelpires/.gemini/antigravity/brain/99d09d05-dc7a-4eb0-97a1-4255ce259407/screenshots")
OUT_DIR.mkdir(parents=True, exist_ok=True)

manifest = []
frame_idx = 0

def capture(page, region, landmark, pose, description):
    global frame_idx
    frame_idx += 1
    filename = f"frame_{frame_idx:03d}.png"
    filepath = OUT_DIR / filename
    page.screenshot(path=str(filepath))
    meta = {
        "index": frame_idx,
        "filename": filename,
        "region": region,
        "landmark": landmark,
        "pose": pose,
        "description": description
    }
    manifest.append(meta)
    if frame_idx % 25 == 0 or frame_idx == 1 or frame_idx == 600:
        print(f"[{frame_idx:03d}/600] Captured {filename}: {region} - {landmark} ({description})", flush=True)

def wait_frames(page, count=5):
    page.evaluate(f"""() => new Promise(resolve => {{
        let f = 0;
        function step() {{
            f++;
            if (f >= {count}) resolve();
            else requestAnimationFrame(step);
        }}
        requestAnimationFrame(step);
    }})""")

def main():
    print(f"Starting 600-Frame Comprehensive Capture to: {OUT_DIR}", flush=True)
    t_start = time.time()

    with sync_playwright() as p:
        browser = p.webkit.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 720})
        page = ctx.new_page()

        print("1. Booting Juzu WebKit instance...", flush=True)
        page.goto("http://127.0.0.1:5173/juzu/", wait_until="load", timeout=30000)
        page.wait_for_function("Boolean(window.__juzuSceneReady)", timeout=30000)
        time.sleep(1.0)

        # -------------------------------------------------------------
        # SECTION 1: TITLE SCREEN & CLOUD FOREST CORRIDOR (Frames 1 - 150)
        # -------------------------------------------------------------
        print("\n--- Section 1: Title Screen & Cloud Forest Corridor (150 frames) ---", flush=True)

        # 1.1 Title Screen camera sweeps (Frames 1 - 10)
        for i in range(10):
            wait_frames(page, 5)
            capture(page, "Title", "Title Screen", "idle", f"Title screen camera sweep step {i+1}/10")

        # Click Begin Expedition
        page.click("#juzu-btn-begin")
        wait_frames(page, 15)

        # 1.2 South Camp 360-degree rotational panorama & camp assets (Frames 11 - 35)
        for i in range(25):
            angle = (i / 25.0) * (2 * 3.14159)
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                eng.controller.pos.set(0, 4.2, 10);
                eng.controller.heading = Math.PI;
                eng.followCamera.yaw = {angle};
                eng.followCamera.pitch = 0.08 + Math.sin({i} * 0.25) * 0.06;
                eng.followCamera.dist = 4.8;
                eng.followCamera.teleport(eng.controller.pos);
            }}""")
            wait_frames(page, 3)
            capture(page, "CloudForest", "South Camp Vista", "idle", f"South Camp 360 panorama angle {int(angle*57.3)} deg")

        # 1.3 Campfire & Expedition Equipment Close-ups (Frames 36 - 50)
        for i in range(15):
            t = i / 14.0
            cx = 2.4 + (t - 0.5) * 1.5
            cz = 10.8 + (t - 0.5) * 1.2
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                eng.controller.pos.set({cx}, 4.2, {cz});
                eng.controller.heading = -2.1;
                eng.followCamera.yaw = 0.8;
                eng.followCamera.pitch = -0.15;
                eng.followCamera.dist = 2.8;
                eng.followCamera.teleport(eng.controller.pos);
            }}""")
            wait_frames(page, 3)
            capture(page, "CloudForest", "Expedition Campfire & Tent", "idle", f"Campfire & gear close inspection step {i+1}/15")

        # 1.4 Sun Mirror Approach, Puzzle, & Solar Beam Alignment (Frames 51 - 70)
        for i in range(20):
            t = i / 19.0
            mx = -0.5 - t * 2.8
            mz = 10.2 + t * 0.3
            align = 1 if i >= 10 else 0
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                eng.controller.pos.set({mx}, 4.2, {mz});
                eng.controller.heading = -Math.PI / 2;
                eng.followCamera.yaw = -Math.PI / 2 + ({t} - 0.5) * 0.4;
                eng.followCamera.pitch = 0.05;
                eng.followCamera.dist = 3.6;
                eng.followCamera.teleport(eng.controller.pos);
                if ({align} === 1) eng.cloudForest.alignSunMirror();
            }}""")
            wait_frames(page, 3)
            state = "aligned beam active" if i >= 10 else "unaligned dial"
            capture(page, "CloudForest", "Bronze Inti Sun Mirror", "interact" if i==9 else "idle", f"Sun mirror puzzle ({state}) step {i+1}/20")

        # 1.5 Walking to Urubamba Bridge Entrance Pylons (Frames 71 - 90)
        for i in range(20):
            t = i / 19.0
            pz = 9.5 - t * 8.2 # z from 9.5 down to 1.3
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                eng.controller.pos.set(0, 4.2, {pz});
                eng.controller.heading = Math.PI;
                eng.followCamera.yaw = 0.0;
                eng.followCamera.pitch = 0.02;
                eng.followCamera.dist = 4.5;
                eng.followCamera.teleport(eng.controller.pos);
            }}""")
            wait_frames(page, 3)
            capture(page, "CloudForest", "Bridge Approach Trail", "walk", f"Walking toward bridge portal pylons z={pz:.1f}")

        # 1.6 Crossing the Urubamba Hanging Suspension Bridge (Frames 91 - 120)
        for i in range(30):
            t = i / 29.0
            bz = 1.0 - t * 37.0 # z from 1.0 to -36.0 across bridge
            by = 4.28 - 1.35 * 4 * t * (1 - t) # catenary bridge sag
            yaw_sway = math.sin(i * 0.4) * 0.18
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                eng.controller.pos.set(0, {by}, {bz});
                eng.controller.heading = Math.PI;
                eng.followCamera.yaw = {yaw_sway};
                eng.followCamera.pitch = -0.12 + Math.sin({i} * 0.3) * 0.08;
                eng.followCamera.dist = 4.6;
                eng.followCamera.teleport(eng.controller.pos);
            }}""")
            wait_frames(page, 3)
            capture(page, "CloudForest", "Urubamba Suspension Bridge", "walk", f"Rope bridge crossing mid-span z={bz:.1f} y={by:.2f}")

        # 1.7 North Sanctuary Citadel Arrival & Chakana Stele Activation (Frames 121 - 150)
        for i in range(30):
            t = i / 29.0
            sz = -37.0 - t * 7.5 # z from -37.0 to -44.5
            sy = 4.3 + t * 0.3
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                eng.controller.pos.set(0, {sy}, {sz});
                eng.controller.heading = Math.PI;
                eng.followCamera.yaw = ({t} - 0.5) * 0.35;
                eng.followCamera.pitch = 0.08 + {t} * 0.08;
                eng.followCamera.dist = 4.2 - {t} * 0.8;
                eng.followCamera.teleport(eng.controller.pos);
                eng.cloudForest.alignSunMirror();
            }}""")
            wait_frames(page, 3)
            capture(page, "CloudForest", "North Sanctuary Chakana Stele", "interact" if i > 20 else "walk", f"Sanctuary courtyard & stele resonance z={sz:.1f}")

        # -------------------------------------------------------------
        # SECTION 2: HIGH SIERRA HANAN SAYA ÑAN ALPINE PASS (Frames 151 - 270)
        # -------------------------------------------------------------
        print("\n--- Section 2: High Sierra Alpine Pass (120 frames) ---", flush=True)

        # Teleport to High Sierra pass
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            eng.highSierra.loadScannedAssets?.();
            eng.hud.setObjective('Align the Intihuatana Gnomon Dial [E] with the Chakana Gate.');
        }""")

        # 2.1 Qhapaq Ñan Stepped Trail & Apacheta Cairns (Frames 151 - 180)
        # Waypoints: (18, -58) -> (34, -74) -> (48, -88) -> (62, -102)
        for i in range(30):
            u = i / 29.0
            px = 18.0 + u * (62.0 - 18.0)
            pz = -58.0 + u * (-102.0 - (-58.0))
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                const gy = eng.controller.getGroundAt({px}, {pz});
                eng.controller.pos.set({px}, gy, {pz});
                eng.controller.heading = Math.atan2(62 - 18, -102 - (-58));
                eng.followCamera.yaw = eng.controller.heading - Math.PI + Math.sin({i} * 0.3) * 0.25;
                eng.followCamera.pitch = 0.12;
                eng.followCamera.dist = 5.2;
                eng.followCamera.teleport(eng.controller.pos);
            }}""")
            wait_frames(page, 3)
            capture(page, "HighSierra", "Qhapaq Ñan Stepped Trail", "run", f"Ascending stone staircase & apacheta cairns u={u:.2f}")

        # 2.2 Huayna Gorge West Rim & Grapple Launch Ramp (Frames 181 - 210)
        for i in range(30):
            u = i / 29.0
            angle = u * (2 * 3.14159)
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                const gy = eng.controller.getGroundAt(62, -102);
                eng.controller.pos.set(62, gy, -102);
                eng.controller.heading = Math.atan2(84 - 62, -122 - (-102));
                eng.followCamera.yaw = {angle};
                eng.followCamera.pitch = 0.14 + Math.cos({i} * 0.2) * 0.08;
                eng.followCamera.dist = 5.5;
                eng.followCamera.teleport(eng.controller.pos);
            }}""")
            wait_frames(page, 3)
            capture(page, "HighSierra", "Huayna Gorge Chasm Launch", "idle", f"Chasm cantilever ramp 360 panorama angle {int(angle*57.3)} deg")

        # 2.3 Chakana Gate & Megalithic Masonry (Frames 211 - 240)
        for i in range(30):
            u = i / 29.0
            px = 108.0 + u * (120.0 - 108.0)
            pz = -152.0 + u * (-165.0 - (-152.0))
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                const gy = eng.controller.getGroundAt({px}, {pz});
                eng.controller.pos.set({px}, gy, {pz});
                eng.controller.heading = Math.PI;
                eng.followCamera.yaw = ({u} - 0.5) * 0.4;
                eng.followCamera.pitch = 0.16;
                eng.followCamera.dist = 5.8;
                eng.followCamera.teleport(eng.controller.pos);
            }}""")
            wait_frames(page, 3)
            capture(page, "HighSierra", "Chakana Solstice Gate", "walk", f"Megalithic ashlar gate approach u={u:.2f}")

        # 2.4 Intihuatana Gnomon Dial & Solar Solstice Alignment (Frames 241 - 270)
        for i in range(30):
            angle = (i / 30.0) * (2 * 3.14159)
            aligned = 1 if i >= 15 else 0
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                const gy = eng.controller.getGroundAt(120, -165);
                eng.controller.pos.set(120, gy, -165);
                eng.controller.heading = Math.PI;
                eng.followCamera.yaw = {angle};
                eng.followCamera.pitch = 0.20;
                eng.followCamera.dist = 4.8;
                eng.followCamera.teleport(eng.controller.pos);
                if ({aligned} === 1) eng.highSierra.alignIntihuatanaDial();
            }}""")
            wait_frames(page, 3)
            dial_state = "aligned to Chakana" if i >= 15 else "unaligned gnomon"
            capture(page, "HighSierra", "Intihuatana Solar Gnomon", "interact" if i==14 else "idle", f"Intihuatana dial ({dial_state}) angle {int(angle*57.3)} deg")

        # -------------------------------------------------------------
        # SECTION 3: JUNGLE LOWLANDS ANTISUYU RAINFOREST TRAIL (Frames 271 - 380)
        # -------------------------------------------------------------
        print("\n--- Section 3: Jungle Lowlands Rainforest Trail (110 frames) ---", flush=True)

        # 3.1 Descent into Bamboo River Flats & Riverbed Rocks (Frames 271 - 300)
        for i in range(30):
            u = i / 29.0
            px = -32.0 + u * (-58.0 - (-32.0))
            pz = -6.0 + u * (12.0 - (-6.0))
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                const gy = eng.controller.getGroundAt({px}, {pz});
                eng.controller.pos.set({px}, gy, {pz});
                eng.controller.heading = Math.atan2(-58 - (-32), 12 - (-6));
                eng.followCamera.yaw = eng.controller.heading - Math.PI + Math.sin({i} * 0.25) * 0.2;
                eng.followCamera.pitch = 0.08;
                eng.followCamera.dist = 5.2;
                eng.followCamera.teleport(eng.controller.pos);
            }}""")
            wait_frames(page, 3)
            capture(page, "JungleLowlands", "Bamboo River Flats", "walk", f"River trail descent rocks & silt u={u:.2f}")

        # 3.2 Rainforest Gateway & Dense Flora Inspection (Frames 301 - 330)
        for i in range(30):
            u = i / 29.0
            px = -128.0 + u * (-154.0 - (-128.0))
            pz = 76.0 + u * (100.0 - 76.0)
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                const gy = eng.controller.getGroundAt({px}, {pz});
                eng.controller.pos.set({px}, gy, {pz});
                eng.controller.heading = Math.atan2(-154 - (-128), 100 - 76);
                eng.followCamera.yaw = eng.controller.heading - Math.PI + Math.cos({i} * 0.2) * 0.25;
                eng.followCamera.pitch = 0.10;
                eng.followCamera.dist = 5.4;
                eng.followCamera.teleport(eng.controller.pos);
            }}""")
            wait_frames(page, 3)
            capture(page, "JungleLowlands", "Rainforest Gateway Flora", "walk", f"Tropical foliage calathea & root clusters u={u:.2f}")

        # 3.3 Expedition River Quay & Bronze Sluice Wheel (Frames 331 - 360)
        for i in range(30):
            angle = (i / 30.0) * (2 * 3.14159)
            turned = 1 if i >= 15 else 0
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                const gy = eng.controller.getGroundAt(-180, 126.5);
                eng.controller.pos.set(-180, gy + 0.3, 126.5);
                eng.controller.heading = 0;
                eng.followCamera.yaw = {angle};
                eng.followCamera.pitch = 0.12;
                eng.followCamera.dist = 5.2;
                eng.followCamera.teleport(eng.controller.pos);
                if ({turned} === 1) eng.jungleLowlands.openCenoteSluice?.();
            }}""")
            wait_frames(page, 3)
            sluice_state = "sluice opened cenote drained" if i >= 15 else "sluice closed"
            capture(page, "JungleLowlands", "River Quay Sluice Wheel", "interact" if i==14 else "idle", f"Ancient bronze sluice ({sluice_state}) angle {int(angle*57.3)} deg")

        # 3.4 Cenote Shallows & Submerged Ruins (Frames 361 - 380)
        for i in range(20):
            u = i / 19.0
            px = -160.0 + u * 20.0
            pz = 115.0 + u * 15.0
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                const gy = eng.controller.getGroundAt({px}, {pz});
                eng.controller.pos.set({px}, gy, {pz});
                eng.controller.heading = 0.8;
                eng.followCamera.yaw = 0.8 - Math.PI;
                eng.followCamera.pitch = -0.05;
                eng.followCamera.dist = 4.8;
                eng.followCamera.teleport(eng.controller.pos);
            }}""")
            wait_frames(page, 3)
            capture(page, "JungleLowlands", "Cenote Silt Shallows", "swim" if i > 12 else "walk", f"Cenote waters & damp mossy rock u={u:.2f}")

        # -------------------------------------------------------------
        # SECTION 4: PAITITI IMPERIAL ACROPOLIS & SUN PLAZA (Frames 381 - 500)
        # -------------------------------------------------------------
        print("\n--- Section 4: Paititi Imperial Acropolis & Sun Plaza (120 frames) ---", flush=True)

        # 4.1 High Cordillera Ridge Traverse into Paititi (Frames 381 - 410)
        for i in range(30):
            u = i / 29.0
            px = 184.0 + u * (194.0 - 184.0)
            pz = 10.0 + u * (108.0 - 10.0)
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                const gy = eng.controller.getGroundAt({px}, {pz});
                eng.controller.pos.set({px}, gy, {pz});
                eng.controller.heading = Math.atan2(194 - 184, 108 - 10);
                eng.followCamera.yaw = eng.controller.heading - Math.PI + Math.sin({i} * 0.2) * 0.25;
                eng.followCamera.pitch = 0.12;
                eng.followCamera.dist = 5.8;
                eng.followCamera.teleport(eng.controller.pos);
            }}""")
            wait_frames(page, 3)
            capture(page, "Paititi", "Alpine Ridge Trail to Paititi", "run", f"Traversing Cordillera crest to Paititi u={u:.2f}")

        # 4.2 Sun Aqueduct Ridge & Imperial Stone Canals (Frames 411 - 440)
        for i in range(30):
            u = i / 29.0
            px = 194.0 + u * 6.0
            pz = 108.0 + u * 45.0
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                const gy = eng.controller.getGroundAt({px}, {pz});
                eng.controller.pos.set({px}, gy, {pz});
                eng.controller.heading = Math.PI * 0.1;
                eng.followCamera.yaw = -Math.PI * 0.9;
                eng.followCamera.pitch = 0.16;
                eng.followCamera.dist = 6.0;
                eng.followCamera.teleport(eng.controller.pos);
            }}""")
            wait_frames(page, 3)
            capture(page, "Paititi", "Sun Aqueduct Ridge", "walk", f"Inca water channels & stone aqueduct u={u:.2f}")

        # 4.3 Paititi Acropolis Imperial Architecture (Frames 441 - 470)
        for i in range(30):
            angle = (i / 30.0) * (2 * 3.14159)
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                const gy = eng.controller.getGroundAt(200, 166);
                eng.controller.pos.set(200, gy + 0.5, 166);
                eng.controller.heading = 0;
                eng.followCamera.yaw = {angle};
                eng.followCamera.pitch = 0.15;
                eng.followCamera.dist = 6.5;
                eng.followCamera.teleport(eng.controller.pos);
            }}""")
            wait_frames(page, 3)
            capture(page, "Paititi", "Imperial Acropolis Gateway", "idle", f"Paititi golden architecture 360 panorama angle {int(angle*57.3)} deg")

        # 4.4 Golden Sun Disk Dais Awakening & Radiant Plaza (Frames 471 - 500)
        for i in range(30):
            angle = (i / 30.0) * (2 * 3.14159)
            awakened = 1 if i >= 10 else 0
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                const gy = eng.controller.getGroundAt(200, 185);
                eng.controller.pos.set(200, gy + 0.5, 185);
                eng.controller.heading = 0;
                eng.followCamera.yaw = {angle};
                eng.followCamera.pitch = 0.22;
                eng.followCamera.dist = 5.2;
                eng.followCamera.teleport(eng.controller.pos);
                if ({awakened} === 1) eng.paititi.awakenSunPlaza?.();
            }}""")
            wait_frames(page, 3)
            plaza_state = "Golden Sun awakened radiant light" if i >= 10 else "dormant dais"
            capture(page, "Paititi", "Golden Sun Disk Dais", "interact" if i==9 else "idle", f"Plaza of the Sun ({plaza_state}) angle {int(angle*57.3)} deg")

        # -------------------------------------------------------------
        # SECTION 5: CHARACTER CLOSE-UP, WEAPONS, MENUS & LIGHTING (Frames 501 - 600)
        # -------------------------------------------------------------
        print("\n--- Section 5: Character Close-ups, Weapons, Menus & Lighting (100 frames) ---", flush=True)

        # 5.1 Naira Character 360-Degree Macro Inspection (Frames 501 - 525)
        for i in range(25):
            angle = (i / 25.0) * (2 * 3.14159)
            pitch = 0.04 + math.sin(i * 0.25) * 0.08
            dist = 1.95 + math.cos(i * 0.2) * 0.35
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                eng.controller.pos.set(0, 4.2, 10);
                eng.controller.heading = 0;
                eng.followCamera.yaw = {angle};
                eng.followCamera.pitch = {pitch};
                eng.followCamera.dist = {dist};
                eng.followCamera.shoulderOffset = 0.0;
                eng.followCamera.teleport(eng.controller.pos);
            }}""")
            wait_frames(page, 3)
            capture(page, "Character", "Naira 3D Rig & Material Close-up", "idle", f"Naira anatomical mesh & clothing 360 angle {int(angle*57.3)} deg")

        # 5.2 Weapon Mechanics: Draw, Aiming Stance, Muzzle Flash, Recoil (Frames 526 - 545)
        for i in range(20):
            is_aiming = 1 if i < 15 else 0
            is_firing = 1 if i in (5, 6, 12, 13) else 0
            page.evaluate(f"""() => {{
                const eng = window.__juzuEngine;
                eng.controller.pos.set(0, 4.2, 9);
                eng.controller.heading = Math.PI;
                eng.followCamera.yaw = ({i} - 10) * 0.05;
                eng.followCamera.pitch = 0.02;
                eng.followCamera.dist = 2.4;
                eng.followCamera.shoulderOffset = 0.35;
                eng.followCamera.teleport(eng.controller.pos);
                if ({is_aiming} === 1 && !eng.weapon.isAiming) eng.weapon.toggleAim();
                if ({is_aiming} === 0 && eng.weapon.isAiming) eng.weapon.toggleAim();
                if ({is_firing} === 1) {{
                    const collidables = [eng.terrain.group, eng.cloudForest.group];
                    eng.weapon.fire(collidables);
                }}
            }}""")
            wait_frames(page, 2)
            w_desc = "firing muzzle flash" if is_firing else "aiming stance with reticle" if is_aiming else "holstered sidearm"
            capture(page, "Weapons", "Colt M1911 Expedition Sidearm", "aim" if is_aiming else "idle", f"Weapon mechanics ({w_desc}) step {i+1}/20")

        # Reset weapon aim
        page.evaluate("() => { if (window.__juzuEngine.weapon.isAiming) window.__juzuEngine.weapon.toggleAim(); }")

        # 5.3 Expedition Menu: World Map GPS & Waypoint Detail (Frames 546 - 555)
        page.evaluate("() => window.__juzuEngine.expeditionMenu.open('map')")
        for i in range(10):
            wait_frames(page, 3)
            capture(page, "UI/Menu", "Expedition World Map", "menu", f"World Map GPS navigation & terrain contours frame {i+1}/10")

        # 5.4 Expedition Menu: Backpack Inventory & 3D Item Inspection (Frames 556 - 565)
        page.evaluate("() => window.__juzuEngine.expeditionMenu.open('inventory')")
        for i in range(10):
            wait_frames(page, 3)
            capture(page, "UI/Menu", "Backpack Inventory", "menu", f"Backpack inventory inspection frame {i+1}/10")

        page.evaluate("() => window.__juzuEngine.expeditionMenu.close()")
        wait_frames(page, 5)

        # 5.5 Locomotion & Athletic Poses: Sprint, Crouch, Jump Apex, Landing Dip (Frames 566 - 580)
        poses = [
            ("sprint", "run", 6.65, 0, 0),
            ("crouch_stealth", "walk", 1.7, 0, 0),
            ("jump_takeoff", "jump_start", 0, 0, 1.2),
            ("jump_apex", "jump", 0, 0, 2.5),
            ("landing_impact", "jump_land", 0, 0, 0),
        ]
        for idx, (pname, pose_type, spd, heading, yoff) in enumerate(poses):
            for sub in range(3):
                page.evaluate(f"""() => {{
                    const eng = window.__juzuEngine;
                    eng.controller.pos.set(0, 4.2 + {yoff}, 10);
                    eng.controller.heading = Math.PI;
                    eng.controller.speed = {spd};
                    eng.controller.pose = '{pose_type}';
                    eng.followCamera.yaw = 0.2 + {sub} * 0.1;
                    eng.followCamera.dist = 3.6;
                    eng.followCamera.teleport(eng.controller.pos);
                }}""")
                wait_frames(page, 2)
                capture(page, "Character/Locomotion", f"Pose: {pname}", pose_type, f"Locomotion athletic dynamic pose {pname} (sub {sub+1}/3)")

        # 5.6 Time of Day Atmospheric Sweeps: Dawn, Day, Dusk, Night (Frames 581 - 600)
        tods = [("dawn", "Digit1"), ("day", "Digit2"), ("dusk", "Digit3"), ("night", "Digit4")]
        for tod_name, key in tods:
            page.keyboard.press(key)
            for sub in range(5):
                angle = (sub / 5.0) * 1.5 - 0.75
                page.evaluate(f"""() => {{
                    const eng = window.__juzuEngine;
                    eng.controller.pos.set(0, 4.2, 10);
                    eng.controller.heading = Math.PI;
                    eng.followCamera.yaw = {angle};
                    eng.followCamera.pitch = 0.12;
                    eng.followCamera.dist = 5.2;
                    eng.followCamera.teleport(eng.controller.pos);
                }}""")
                wait_frames(page, 4)
                capture(page, "Atmosphere/Lighting", f"Time of Day: {tod_name.upper()}", "idle", f"Atmospheric sky & shadow lighting for {tod_name} (angle {sub+1}/5)")

        browser.close()

    total_time = time.time() - t_start
    manifest_path = OUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print("\n=======================================================", flush=True)
    print(f"SUCCESS: Captured all {frame_idx} frames in {total_time:.1f}s ({total_time/frame_idx:.2f}s/frame)!", flush=True)
    print(f"Manifest written to: {manifest_path}", flush=True)
    print("=======================================================", flush=True)

if __name__ == "__main__":
    main()
