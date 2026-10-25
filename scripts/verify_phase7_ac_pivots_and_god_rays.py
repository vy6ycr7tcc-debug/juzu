#!/usr/bin/env python3
"""
verify_phase7_ac_pivots_and_god_rays.py
Captures visual evidence for Phase 7:
1. Volumetric Crepuscular Sun Shafts (God Rays) streaming through the cloud forest canopy.
2. Procedural Slope Foot IK & Ankle Conformation on inclined mountain terrain (camera looking down at feet).
3. Active Plant-and-Turn 180° Skid Pivot showing lowered center of mass, inward banking & mineral dust skid debris.
4. Gorge Suspension Bridge Vista with atmospheric sun shafts & mountain motes.
"""
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path(__file__).resolve().parent / "shots"
OUT_DIR.mkdir(parents=True, exist_ok=True)

URL = "http://localhost:5173/juzu/"

def wait_frames(page, count=18, timeout_ms=1200):
    page.evaluate(f"""() => new Promise(resolve => {{
        let f = 0;
        const timer = setTimeout(resolve, {timeout_ms});
        function step() {{
            f++;
            if (f >= {count}) {{ clearTimeout(timer); resolve(); return; }}
            requestAnimationFrame(step);
        }}
        requestAnimationFrame(step);
    }})""")

def capture_phase7():
    print(f"Launching browser to verify Phase 7 AC Pivots, Foot IK & Volumetric Atmosphere at {URL}...")
    with sync_playwright() as p:
        browser = p.chromium.launch(args=[
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
        ])
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()
        page.set_default_timeout(90000)
        page.add_init_script("Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });")

        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: print(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)

        print(f"Loading {URL}...")
        page.goto(URL, wait_until="load", timeout=35000)

        print("Waiting for engine and character to load...")
        for _ in range(30):
            if page.evaluate("() => !!(window.__juzuReady && window.__juzuEngine && window.__juzuEngine.naira && window.__juzuEngine.naira.isLoaded)"):
                print("Engine and Naira character verified loaded!")
                break
            time.sleep(1.0)

        # Dismiss title screen
        time.sleep(1.0)
        page.evaluate("""() => {
            if (window.__juzuDismissLoading) window.__juzuDismissLoading();
            const btn = document.getElementById('juzu-btn-begin');
            if (btn) btn.click();
            if (window.__juzuEngine && window.__juzuEngine.hud) {
                window.__juzuEngine.hud.isTitleOpen = false;
            }
        }""")
        time.sleep(1.5)

        # 1. Shot 1: Canopy Crepuscular Sun Shafts Vista
        print("1. Capturing Shot 1: Volumetric Sun Shafts (God Rays) streaming through canopy...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            // Frame camera looking slightly upward toward the forest canopy and gateway to catch the sun shafts
            eng.controller.pos.set(0, 4.2, 9.5);
            eng.controller.teleport(eng.controller.pos);
            eng.followCamera.yaw = 0.05;
            eng.followCamera.pitch = 0.28;
            eng.followCamera.baseDist = 5.2;
            eng.followCamera.dist = 5.2;
            eng.followCamera.shoulderOffset = 0.0;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        wait_frames(page, 18)
        shot1_path = OUT_DIR / "phase7_01_god_rays_canopy_vista.png"
        page.screenshot(path=str(shot1_path))
        print(f"✓ Saved Shot 1: {shot1_path}")

        # 2. Shot 2: Procedural Slope Foot IK Conformation (Authentic Inca Terrace Ramp)
        print("2. Capturing Shot 2: Procedural Slope Foot IK on authentic Inca terrace ramp...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            // Position Naira on the authentic inclined stone terrace ramp
            eng.controller.heading = Math.PI * 0.55; // Facing downhill across the ramp
            eng.controller.pos.set(-4.8, 5.0, 9.5);
            eng.controller.teleport(eng.controller.pos);

            // Frame camera with clear profile of the inclined stone ramp and centered feet
            eng.followCamera.yaw = 1.15; // Look South-East towards open clearing & camp
            eng.followCamera.pitch = 0.22; // Elevate slightly to clearly frame full body and ground contact
            eng.followCamera.baseDist = 3.4;
            eng.followCamera.dist = 3.4;
            eng.followCamera.shoulderOffset = 0.0;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        wait_frames(page, 20)
        slopeState = page.evaluate("""() => {
            const c = window.__juzuEngine.controller;
            return { pos: c.pos, heading: c.heading, slopePitch: c.slopePitch, slopeRoll: c.slopeRoll };
        }""")
        print(f"   Slope IK state at capture: {slopeState}")
        shot2_path = OUT_DIR / "phase7_02_slope_foot_ik_conformation.png"
        page.screenshot(path=str(shot2_path))
        print(f"✓ Saved Shot 2: {shot2_path}")

        # 3. Shot 3: Active Plant-and-Turn 180° Skid Pivot (Unobstructed open clearing corridor)
        print("3. Capturing Shot 3: Active Plant-and-Turn 180° Skid Pivot with dust skid particles...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            // Start position in the open clearing corridor facing North
            eng.controller.pos.set(0, 4.2, 9.0);
            eng.controller.teleport(eng.controller.pos);
            eng.controller.heading = Math.PI; // Face North
            eng.followCamera.yaw = 0.04; // Look North along the wide open Qhapaq Ñan corridor
            eng.followCamera.pitch = 0.10;
            eng.followCamera.baseDist = 3.8;
            eng.followCamera.dist = 3.8;
            eng.followCamera.shoulderOffset = 0.0;
            eng.followCamera.teleport(eng.controller.pos);

            // Drive forward sprint for 20 simulation frames
            eng.input.keys.add('w');
            eng.input.keys.add('shift');
            eng.input.virtualBoost = true;
            eng.input.setVirtualMove(0, 1.0);
            for (let i = 0; i < 20; i++) {
                eng.controller.update(eng.input.move, eng.input.boost, eng.input.jump, eng.followCamera.yaw, 0.016, false);
                eng.naira.update(eng.controller, 0.016, eng.followCamera.yaw);
            }

            // Abruptly reverse input 180 degrees to trigger plant-and-turn pivot skid
            eng.input.keys.delete('w');
            eng.input.keys.add('s');
            eng.input.setVirtualMove(0, -1.0);

            // Step 2 frames into the pivot skid
            for (let i = 0; i < 2; i++) {
                eng.controller.update(eng.input.move, eng.input.boost, eng.input.jump, eng.followCamera.yaw, 0.016, false);
                eng.naira.update(eng.controller, 0.016, eng.followCamera.yaw);
            }
            eng.cloudForest.update(performance.now() / 1000, eng.controller.pos, eng.controller.speed, true);
        }""")
        state = page.evaluate("""() => {
            const c = window.__juzuEngine.controller;
            return { isPivoting: c.isPivoting, pivotTimer: c.pivotTimer, speed: c.speed, heading: c.heading };
        }""")
        print(f"   Pivot state at capture: {state}")
        shot3_path = OUT_DIR / "phase7_03_plant_and_turn_pivot_skid.png"
        page.screenshot(path=str(shot3_path))
        print(f"✓ Saved Shot 3: {shot3_path}")

        # 4. Shot 4: Gorge Suspension Bridge Vista with atmospheric sun shafts & motes
        print("4. Capturing Shot 4: Gorge Suspension Bridge Vista with atmospheric sun shafts...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            eng.input.setVirtualMove(0, 0);
            eng.input.virtualBoost = false;
            eng.input.keys.delete('shift');
            eng.controller.pos.set(0, 4.2, 0.5);
            eng.controller.heading = Math.PI;
            eng.followCamera.yaw = Math.PI; // Look North across gorge
            eng.followCamera.pitch = 0.16;
            eng.followCamera.baseDist = 5.6;
            eng.followCamera.dist = 5.6;
            eng.followCamera.shoulderOffset = 0.0;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        wait_frames(page, 18)
        shot4_path = OUT_DIR / "phase7_04_gorge_bridge_sun_shafts.png"
        page.screenshot(path=str(shot4_path))
        print(f"✓ Saved Shot 4: {shot4_path}")

        browser.close()
        print("Phase 7 captures completed successfully!")

if __name__ == "__main__":
    capture_phase7()
