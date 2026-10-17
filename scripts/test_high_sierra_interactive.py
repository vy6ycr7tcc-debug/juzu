#!/usr/bin/env python3
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

def main():
    out = Path("shots_inspect/high_sierra")
    out.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(args=[
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
        ])
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });")

        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)

        print("1. Booting High Sierra...")
        page.goto("http://127.0.0.1:5173/juzu/?region=highSierra", wait_until="load", timeout=30000)
        page.wait_for_function("() => window.__juzuReady === true", timeout=30000)
        time.sleep(2.0)

        # Milestone 1: Starting approach vista
        page.screenshot(path=str(out / "01_high_sierra_approach.png"), timeout=90000)
        print("Captured 01_high_sierra_approach.png")

        # Milestone 2: Approach the Intihuatana gnomon
        print("2. Approaching Intihuatana gnomon altar...")
        page.evaluate("""() => {
            const c = window.__juzuEngine.controller;
            const cam = window.__juzuEngine.followCamera;
            const px = 120.0;
            const pz = -162.2;
            const py = window.__juzuEngine.controller.getGroundAt(px, pz, 28.5);
            c.pos.set(px, py, pz);
            c.heading = Math.PI;
            cam.yaw = 0.0;
            cam.dist = 4.8;
            cam.pitch = 0.08;
            cam.shoulderOffset = 0.32;
            cam.teleport(c.pos);
        }""")
        time.sleep(1.0)
        page.screenshot(path=str(out / "02_high_sierra_gnomon_close.png"), timeout=90000)
        print("Captured 02_high_sierra_gnomon_close.png")

        # Milestone 3: Trigger [E] to align gnomon dial
        print("3. Pressing [E] to align the Solstice Gnomon...")
        page.keyboard.press("KeyE")
        time.sleep(1.5)

        hud_obj = page.evaluate("() => document.getElementById('juzu-objective-hud')?.innerText")
        print(f"HUD Objective: {hud_obj}")
        page.screenshot(path=str(out / "03_high_sierra_gnomon_aligned.png"), timeout=90000)
        print("Captured 03_high_sierra_gnomon_aligned.png")

        # Milestone 4: Through the Chakana Gate overlooking the High Mountain Pass
        print("4. Crossing through the Chakana Gate...")
        page.evaluate("""() => {
            const c = window.__juzuEngine.controller;
            const cam = window.__juzuEngine.followCamera;
            const px = 120.0;
            const pz = -182.5;
            const py = window.__juzuEngine.controller.getGroundAt(px, pz, 28.5);
            c.pos.set(px, py, pz);
            c.heading = Math.PI;
            cam.yaw = 0.0;
            cam.dist = 5.8;
            cam.pitch = 0.12;
            cam.shoulderOffset = 0.25;
            cam.teleport(c.pos);
        }""")
        time.sleep(1.0)
        page.screenshot(path=str(out / "04_high_sierra_pass_vista.png"), timeout=90000)
        print("Captured 04_high_sierra_pass_vista.png")

        browser.close()

    print("\nErrors logged:")
    for err in errors[:10]:
        print("  ", err)

    print("Interactive playtest completed successfully!")

if __name__ == "__main__":
    main()
