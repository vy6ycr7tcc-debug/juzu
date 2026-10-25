#!/usr/bin/env python3
"""
verify_phase6_ac_locomotion.py
Captures visual evidence for Phase 6:
1. Walk stride & pelvic weight transfer during active forward locomotion.
2. Sprint acceleration forward torso lean & full knee extension during active sprint.
3. Tactile suspension bridge dynamic plank depression underfoot.
4. Close-up portrait showing upgraded PBR hair sheen & warm skin tone.
"""
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path(__file__).resolve().parent / "shots"
OUT_DIR.mkdir(parents=True, exist_ok=True)

URL = "http://localhost:5173/juzu/"

def capture_phase6():
    print(f"Launching browser to verify Phase 6 AC Locomotion & Visuals at {URL}...")
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

        # 1. Walk stride & weight transfer (side profile) with active virtual move
        print("1. Capturing Walk Stride & Weight Transfer (Side Profile)...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            eng.controller.pos.set(0, 4.2, 8.0);
            eng.controller.heading = Math.PI; // Face North
            eng.followCamera.yaw = Math.PI * 0.5; // Side view from East
            eng.followCamera.pitch = 0.04;
            eng.followCamera.baseDist = 3.6;
            eng.followCamera.dist = 3.6;
            eng.followCamera.shoulderOffset = 0.0;
            eng.followCamera.teleport(eng.controller.pos);

            // Drive forward walk
            eng.input.setVirtualMove(0, 1.0);
        }""")
        # Step through frames to capture mid-stride extension
        page.evaluate("""() => new Promise(resolve => {
            let f = 0;
            function step() {
                f++;
                if (f >= 28) { resolve(); return; }
                requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        })""")
        shot1 = OUT_DIR / "phase6_01_stride_weight_transfer.png"
        page.screenshot(path=str(shot1), timeout=90000)
        print(f"   ✓ Captured Walk Stride -> {shot1.name}")

        # 2. Sprint acceleration forward torso lean & full knee extension
        print("2. Capturing Sprint Acceleration Lean (Side/Quarter Profile)...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            eng.controller.pos.set(0, 4.2, 6.0);
            eng.controller.heading = Math.PI;
            eng.followCamera.yaw = Math.PI * 0.42;
            eng.followCamera.pitch = 0.06;
            eng.followCamera.baseDist = 4.0;
            eng.followCamera.dist = 4.0;
            eng.followCamera.shoulderOffset = 0.0;
            eng.followCamera.teleport(eng.controller.pos);

            // Boost sprint
            eng.input.setVirtualMove(0, 1.0);
            eng.input.boost = true;
        }""")
        page.evaluate("""() => new Promise(resolve => {
            let f = 0;
            function step() {
                f++;
                if (f >= 24) { resolve(); return; }
                requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        })""")
        shot2 = OUT_DIR / "phase6_02_sprint_acceleration_lean.png"
        page.screenshot(path=str(shot2), timeout=90000)
        print(f"   ✓ Captured Sprint Lean -> {shot2.name}")

        # 3. Tactile suspension bridge dynamic plank depression underfoot
        print("3. Capturing Dynamic Bridge Depression...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            // Stop sprint, place player mid-bridge walking forward
            eng.input.boost = false;
            const bz = -16.0;
            eng.controller.pos.set(0, 4.2, bz);
            eng.controller.heading = Math.PI;
            eng.followCamera.yaw = 0.0;
            eng.followCamera.pitch = -0.15;
            eng.followCamera.baseDist = 3.2;
            eng.followCamera.dist = 3.2;
            eng.followCamera.shoulderOffset = 0.35;
            eng.followCamera.teleport(eng.controller.pos);

            eng.input.setVirtualMove(0, 0.8);
        }""")
        page.evaluate("""() => new Promise(resolve => {
            let f = 0;
            function step() {
                f++;
                if (f >= 16) { resolve(); return; }
                requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        })""")
        shot3 = OUT_DIR / "phase6_03_bridge_dynamic_depression.png"
        page.screenshot(path=str(shot3), timeout=90000)
        print(f"   ✓ Captured Bridge Depression -> {shot3.name}")

        # 4. Close-up portrait showing upgraded PBR hair sheen & skin tone
        print("4. Capturing Portrait with PBR Hair Sheen...")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            if (!eng) return;
            eng.input.setVirtualMove(0, 0);
            eng.controller.pos.set(0, 4.2, 10.0);
            eng.controller.heading = 0.32;
            eng.controller.speed = 0;
            eng.controller.pose = 'idle';
            eng.followCamera.yaw = 0.0;
            eng.followCamera.pitch = 0.02;
            eng.followCamera.baseDist = 1.35;
            eng.followCamera.dist = 1.35;
            eng.followCamera.shoulderOffset = 0.18;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        time.sleep(1.0)
        shot4 = OUT_DIR / "phase6_04_naira_portrait_pbr_hair.png"
        page.screenshot(path=str(shot4), timeout=90000)
        print(f"   ✓ Captured Portrait -> {shot4.name}")

        browser.close()
        print("All Phase 6 verification captures complete!")

if __name__ == "__main__":
    capture_phase6()
