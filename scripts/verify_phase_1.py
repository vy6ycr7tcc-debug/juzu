#!/usr/bin/env python3
"""verify_phase_1.py — Capture post-fix verification frames for Phase 1 terrain & foliage improvements."""
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path("/Users/samuelpires/.gemini/antigravity/brain/99d09d05-dc7a-4eb0-97a1-4255ce259407/phase1_verification")
OUT_DIR.mkdir(parents=True, exist_ok=True)

def wait_frames(page, count=10):
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
    print(f"Capturing Phase 1 Verification Shots to: {OUT_DIR}", flush=True)

    with sync_playwright() as p:
        browser = p.webkit.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 720})
        page = ctx.new_page()

        print("Loading Juzu...", flush=True)
        page.goto("http://127.0.0.1:5173/juzu/", wait_until="load", timeout=30000)
        page.wait_for_function("Boolean(window.__juzuSceneReady)", timeout=30000)
        time.sleep(1.0)

        # Click begin
        page.click("#juzu-btn-begin")
        wait_frames(page, 20)

        # Shot 1: South Camp Vista (Verify no flat green spheres or yellow cards)
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            eng.controller.pos.set(0, 4.2, 10);
            eng.controller.heading = Math.PI;
            eng.followCamera.yaw = 0.5;
            eng.followCamera.pitch = 0.08;
            eng.followCamera.dist = 4.8;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        wait_frames(page, 15)
        path1 = OUT_DIR / "phase1_01_south_camp.png"
        page.screenshot(path=str(path1))
        print(f"Captured: {path1.name}", flush=True)

        # Shot 2: High Sierra Stepped Trail (Verify ashlar textured steps & triplanar cliff rock)
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            eng.highSierra.loadScannedAssets?.();
            const px = 34.0;
            const pz = -74.0;
            const gy = eng.controller.getGroundAt(px, pz);
            eng.controller.pos.set(px, gy, pz);
            eng.controller.heading = Math.atan2(62 - 18, -102 - (-58));
            eng.followCamera.yaw = eng.controller.heading - Math.PI;
            eng.followCamera.pitch = 0.16;
            eng.followCamera.dist = 4.2;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        wait_frames(page, 20)
        path2 = OUT_DIR / "phase1_02_steep_steps_ascent.png"
        page.screenshot(path=str(path2))
        print(f"Captured: {path2.name}", flush=True)

        # Shot 3: High Sierra Vertical Cliff Face (Verify triplanar texture on near-vertical cliff)
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            const px = 62.0;
            const pz = -102.0;
            const gy = eng.controller.getGroundAt(px, pz);
            eng.controller.pos.set(px, gy, pz);
            eng.followCamera.yaw = 2.4;
            eng.followCamera.pitch = 0.12;
            eng.followCamera.dist = 5.5;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        wait_frames(page, 20)
        path3 = OUT_DIR / "phase1_03_high_sierra_cliffs.png"
        page.screenshot(path=str(path3))
        print(f"Captured: {path3.name}", flush=True)

        # Shot 4: Bamboo River Flats (Verify clean ground plane & no yellow placeholder planes)
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            const px = -45.0;
            const pz = 3.0;
            const gy = eng.controller.getGroundAt(px, pz);
            eng.controller.pos.set(px, gy, pz);
            eng.controller.heading = Math.atan2(-58 - (-32), 12 - (-6));
            eng.followCamera.yaw = eng.controller.heading - Math.PI;
            eng.followCamera.pitch = 0.10;
            eng.followCamera.dist = 5.0;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        wait_frames(page, 20)
        path4 = OUT_DIR / "phase1_04_bamboo_river_flats.png"
        page.screenshot(path=str(path4))
        print(f"Captured: {path4.name}", flush=True)

        # Shot 5: Rainforest Gateway Understory (Verify clean forest floor with grass & rocks)
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            const px = -140.0;
            const pz = 88.0;
            const gy = eng.controller.getGroundAt(px, pz);
            eng.controller.pos.set(px, gy, pz);
            eng.controller.heading = Math.atan2(-154 - (-128), 100 - 76);
            eng.followCamera.yaw = eng.controller.heading - Math.PI;
            eng.followCamera.pitch = 0.12;
            eng.followCamera.dist = 5.2;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        wait_frames(page, 20)
        path5 = OUT_DIR / "phase1_05_rainforest_gateway.png"
        page.screenshot(path=str(path5))
        print(f"Captured: {path5.name}", flush=True)

        browser.close()
        print("Verification capture complete!", flush=True)

if __name__ == "__main__":
    main()
