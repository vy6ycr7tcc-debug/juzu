#!/usr/bin/env python3
"""
verify_phase5_immersion.py
Captures visual evidence for Phase 5:
1. Weapon fire & supersonic bullet tracer ribbon + muzzle flash.
2. Surface impact debris (stone dust/sparks, wood splinters, water plume).
3. Survival instinct expanding golden solar Chakana sonar ripple wave.
"""
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path(__file__).resolve().parent / "shots"
OUT_DIR.mkdir(parents=True, exist_ok=True)

URL = "http://localhost:5173/juzu/"

def capture_immersion():
    print(f"Launching browser to verify Phase 5 Immersion & Ballistics at {URL}...")
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

        # 1. Weapon fire & supersonic bullet tracer ribbon + muzzle flash
        print("1. Capturing Weapon Fire Tracer & Muzzle Flash...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            // Place player in clearing, aim and fire
            eng.controller.pos.set(0, 4.2, 10.0);
            eng.controller.heading = Math.PI;
            eng.followCamera.yaw = 0;
            eng.followCamera.pitch = 0.04;
            eng.followCamera.dist = 2.8;
            eng.followCamera.shoulderOffset = 0.45;
            eng.followCamera.teleport(eng.controller.pos);

            // Aim and fire
            eng.weapon.setAim(true);
            const collidables = [eng.terrain.group, eng.cloudForest.group];
            eng.weapon.fire(collidables);
        }""")
        time.sleep(0.04) # Catch the muzzle flash and tracer while active
        shot1 = OUT_DIR / "phase5_01_weapon_tracer.png"
        page.screenshot(path=str(shot1), timeout=90000)
        print(f"   ✓ Captured Weapon Tracer -> {shot1.name}")

        # 2. Surface impact debris (stone dust & ricochet sparks)
        print("2. Capturing Surface Impact Debris...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            // Frame camera close to impact point on cliff rock
            eng.followCamera.yaw = 0;
            eng.followCamera.pitch = -0.05;
            eng.followCamera.dist = 3.6;
            eng.followCamera.shoulderOffset = 0.35;
            eng.followCamera.teleport(eng.controller.pos);

            // Fire multiple rounds into rock face to show debris and sparks
            const collidables = [eng.terrain.group, eng.cloudForest.group];
            eng.weapon.fire(collidables);
        }""")
        time.sleep(0.08)
        shot2 = OUT_DIR / "phase5_02_impact_debris.png"
        page.screenshot(path=str(shot2), timeout=90000)
        print(f"   ✓ Captured Impact Debris -> {shot2.name}")

        # 3. Survival Instinct Expanding Golden Solar Chakana Sonar Wave
        print("3. Capturing Survival Instinct Sonar Wave...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            // Reset to vista framing
            eng.weapon.setAim(false);
            eng.followCamera.dist = 6.2;
            eng.followCamera.pitch = 0.22;
            eng.followCamera.shoulderOffset = 0.0;
            eng.followCamera.teleport(eng.controller.pos);

            // Trigger instinct
            eng.input.triggerVirtualInstinct();
        }""")
        time.sleep(0.35) # Wait for sonar wave to expand into mid-radius
        shot3 = OUT_DIR / "phase5_03_survival_instinct_wave.png"
        page.screenshot(path=str(shot3), timeout=90000)
        print(f"   ✓ Captured Survival Instinct Wave -> {shot3.name}")

        browser.close()
        print("All Phase 5 immersion captures complete!")

if __name__ == "__main__":
    capture_immersion()
