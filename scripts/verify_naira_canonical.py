#!/usr/bin/env python3
"""verify_naira_canonical.py — Capture the 3 canonical scenes + portrait of Naira Quispe."""
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path("/Users/samuelpires/.gemini/antigravity/brain/99d09d05-dc7a-4eb0-97a1-4255ce259407/canonical_scenes")
OUT_DIR.mkdir(parents=True, exist_ok=True)

URL = "http://localhost:5173/juzu/"

def capture():
    print(f"Launching browser to verify Naira Quispe canonical scenes at {URL}...")
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

        # Wait for engine and Naira model to be fully initialized
        print("Waiting for engine and sourced character to load...")
        try:
            page.wait_for_function(
                "window.__juzuReady === true && window.__juzuEngine && window.__juzuEngine.naira && window.__juzuEngine.naira.isLoaded",
                timeout=30000
            )
            print("Engine and Naira character verified loaded!")
        except Exception as e:
            print(f"Wait warning: {e}, proceeding...")

        # Dismiss loading screen and title screen
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

        # 1. Scene 1: Forest Clearing Vista
        print("Capturing Scene 1: Forest Clearing Vista (Idle stance, feet grounded)...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            // Place player in forest clearing campsite
            eng.controller.pos.set(0, 4.2, 10.0);
            eng.controller.heading = Math.PI; // Face north
            eng.controller.vel.set(0, 0, 0);
            eng.controller.speed = 0;
            eng.controller.pose = 'idle';
            eng.followCamera.yaw = 0;
            eng.followCamera.pitch = 0.08;
            eng.followCamera.distance = 4.2;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        time.sleep(1.5)
        shot1 = OUT_DIR / "01_forest_clearing_vista.png"
        page.screenshot(path=str(shot1), timeout=90000)
        print(f"Captured Scene 1 -> {shot1}")

        # 2. Scene 2: Sun-Mirror Gate
        print("Capturing Scene 2: Sun-Mirror Gate (Interaction framing)...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            // Place player near the Inti Sun-Mirror
            eng.controller.pos.set(-3.2, 4.6, 4.8);
            eng.controller.heading = 2.45; // Facing toward Sun-Mirror
            eng.controller.vel.set(0, 0, 0);
            eng.controller.speed = 0;
            eng.controller.pose = 'idle';
            eng.followCamera.yaw = -0.65;
            eng.followCamera.pitch = 0.05;
            eng.followCamera.distance = 3.2;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        time.sleep(1.5)
        shot2 = OUT_DIR / "02_sun_mirror_gate.png"
        page.screenshot(path=str(shot2), timeout=90000)
        print(f"Captured Scene 2 -> {shot2}")

        # 3. Scene 3: Hanging Bridge
        print("Capturing Scene 3: Hanging Bridge (Locomotion walk stride across gorge)...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            // Place player on the bridge planks over the gorge
            const targetZ = -10.0;
            const targetY = eng.controller.getGroundAt(0, targetZ, 10.0);
            eng.controller.pos.set(0, targetY, targetZ);
            eng.controller.heading = Math.PI; // Face north across bridge
            eng.controller.speed = 2.75;
            eng.controller.pose = 'walk';
            eng.followCamera.yaw = 0;
            eng.followCamera.pitch = 0.06;
            eng.followCamera.distance = 3.8;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        time.sleep(1.2) # allow walk cycle to step forward
        shot3 = OUT_DIR / "03_hanging_bridge_walk.png"
        page.screenshot(path=str(shot3), timeout=90000)
        print(f"Captured Scene 3 -> {shot3}")

        # 4. Portrait: Close-up Face & Field Gear
        print("Capturing Close-up Portrait (Facial readability, hair bun, skin tone, gear)...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            // Place player in flattering clearing light
            eng.controller.pos.set(0, 4.2, 10.0);
            eng.controller.heading = 0; // Face south (+Z)
            eng.controller.speed = 0;
            eng.controller.pose = 'idle';

            // Directly position main camera in front of Naira's face for close-up portrait framing
            const headY = eng.controller.pos.y + 1.48;
            eng.camera.position.set(0, headY + 0.02, 10.0 + 1.25);
            eng.camera.lookAt(0, headY, 10.0);
            eng.camera.updateMatrixWorld(true);

            // Temporarily bypass followCamera override for this frame
            eng.followCamera.update = () => {};
        }""")
        time.sleep(1.5)
        shot4 = OUT_DIR / "04_naira_portrait_closeup.png"
        page.screenshot(path=str(shot4), timeout=90000)
        print(f"Captured Portrait -> {shot4}")

        browser.close()
        print("\nAll canonical frames successfully captured!")

if __name__ == "__main__":
    capture()
