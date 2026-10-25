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

def capture_phase7():
    print(f"Launching browser to verify Phase 7 AC Pivots, Foot IK & Volumetric Atmosphere at {URL}...")
    with sync_playwright() as p:
        browser = p.chromium.launch(args=[
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
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
        try:
            page.wait_for_function(
                "window.__juzuReady === true && window.__juzuEngine && window.__juzuEngine.naira && window.__juzuEngine.naira.isLoaded",
                timeout=30000
            )
            print("Engine and Naira character verified loaded!")
        except Exception as e:
            print(f"Wait warning: {e}, proceeding...")

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
        time.sleep(2.0)

        # 1. Shot 1: Canopy Crepuscular Sun Shafts Vista
        print("1. Capturing Shot 1: Volumetric Sun Shafts (God Rays) streaming through canopy...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            // Frame camera looking slightly upward toward the forest canopy and gateway to catch the sun shafts
            eng.controller.pos.set(0, 4.2, 9.5);
            eng.followCamera.yaw = 0.05;
            eng.followCamera.pitch = 0.28;
            eng.followCamera.baseDist = 5.2;
            eng.followCamera.dist = 5.2;
            eng.followCamera.shoulderOffset = 0.0;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        page.evaluate("""() => new Promise(resolve => {
            let f = 0;
            function step() {
                f++;
                if (f >= 18) { resolve(); return; }
                requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        })""")
        shot1_path = OUT_DIR / "phase7_01_god_rays_canopy_vista.png"
        page.screenshot(path=str(shot1_path))
        print(f"✓ Saved Shot 1: {shot1_path}")

        # 2. Shot 2: Procedural Slope Foot IK Conformation (Framing boots on slope)
        print("2. Capturing Shot 2: Procedural Slope Foot IK on mountain incline...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            // Position Naira on the sloping mountain terrace path
            eng.controller.pos.set(-3.5, 4.6, 6.2);
            eng.controller.heading = 0.85;
            eng.controller.slopePitch = 0.35;
            eng.controller.slopeRoll = 0.20;
            eng.followCamera.yaw = 0.85 + Math.PI * 0.48; // Side-quarter view of boots
            eng.followCamera.pitch = 0.22; // Elevate camera to frame head to boots on slope
            eng.followCamera.baseDist = 3.6;
            eng.followCamera.dist = 3.6;
            eng.followCamera.shoulderOffset = 0.0;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        page.evaluate("""() => new Promise(resolve => {
            let f = 0;
            function step() {
                f++;
                if (f >= 18) { resolve(); return; }
                requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        })""")
        shot2_path = OUT_DIR / "phase7_02_slope_foot_ik_conformation.png"
        page.screenshot(path=str(shot2_path))
        print(f"✓ Saved Shot 2: {shot2_path}")

        # 3. Shot 3: Active Plant-and-Turn 180° Skid Pivot
        print("3. Capturing Shot 3: Active Plant-and-Turn 180° Skid Pivot with dust skid particles...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            eng.controller.pos.set(0, 4.2, 8.0);
            eng.followCamera.yaw = Math.PI * 0.42; // Side-quarter 3/4 view
            eng.followCamera.pitch = 0.08;
            eng.followCamera.baseDist = 3.6;
            eng.followCamera.dist = 3.6;
            eng.followCamera.shoulderOffset = 0.0;
            eng.followCamera.teleport(eng.controller.pos);

            // Drive forward sprint
            eng.input.setVirtualMove(0, 1.0);
            eng.input.boost = true;
        }""")
        # Step forward 20 frames into full sprint
        page.evaluate("""() => new Promise(resolve => {
            let f = 0;
            function step() {
                f++;
                if (f >= 20) { resolve(); return; }
                requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        })""")
        # Abruptly reverse input 180 degrees to trigger skid pivot
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            eng.input.setVirtualMove(0, -1.0);
        }""")
        # Step 5 frames into the pivot skid
        page.evaluate("""() => new Promise(resolve => {
            let f = 0;
            function step() {
                f++;
                if (f >= 5) { resolve(); return; }
                requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        })""")
        shot3_path = OUT_DIR / "phase7_03_plant_and_turn_pivot_skid.png"
        page.screenshot(path=str(shot3_path))
        print(f"✓ Saved Shot 3: {shot3_path}")

        # 4. Shot 4: Gorge Suspension Bridge Vista with atmospheric sun shafts & motes
        print("4. Capturing Shot 4: Gorge Suspension Bridge Vista with atmospheric sun shafts...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            eng.input.setVirtualMove(0, 0);
            eng.input.boost = false;
            eng.controller.pos.set(0, 4.2, 0.5);
            eng.controller.heading = Math.PI;
            eng.followCamera.yaw = Math.PI; // Look North across gorge
            eng.followCamera.pitch = 0.16;
            eng.followCamera.baseDist = 5.6;
            eng.followCamera.dist = 5.6;
            eng.followCamera.shoulderOffset = 0.0;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        page.evaluate("""() => new Promise(resolve => {
            let f = 0;
            function step() {
                f++;
                if (f >= 18) { resolve(); return; }
                requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        })""")
        shot4_path = OUT_DIR / "phase7_04_gorge_bridge_sun_shafts.png"
        page.screenshot(path=str(shot4_path))
        print(f"✓ Saved Shot 4: {shot4_path}")

        browser.close()
        print("Phase 7 captures completed successfully!")

if __name__ == "__main__":
    capture_phase7()
