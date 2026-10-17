#!/usr/bin/env python3
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

def main():
    out = Path("shots_inspect/paititi")
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

        print("1. Booting Paititi (Plaza of the Sun)...")
        page.goto("http://127.0.0.1:5173/juzu/?region=paititi", wait_until="load", timeout=30000)
        page.wait_for_function("() => window.__juzuReady === true", timeout=30000)
        time.sleep(2.0)

        # Milestone 1: Starting approach vista
        page.screenshot(path=str(out / "01_paititi_approach.png"), timeout=90000)
        print("Captured 01_paititi_approach.png")

        # Milestone 2: Approach the Golden Sun Disk Dais
        print("2. Approaching Golden Sun Disk Dais...")
        page.evaluate("""() => {
            const c = window.__juzuEngine.controller;
            const cam = window.__juzuEngine.followCamera;
            const px = 200.0;
            const pz = 177.0;
            c.pos.set(px, 27.0, pz);
            c.heading = 0.0;
            c.pos.y = c.getGroundAt(px, pz, 28.0);
            cam.yaw = Math.PI;
            cam.dist = 6.8;
            cam.pitch = 0.12;
            cam.shoulderOffset = 0.35;
            cam.teleport(c.pos);
        }""")
        time.sleep(1.0)
        pos2 = page.evaluate("() => ({ x: window.__juzuEngine.controller.pos.x, y: window.__juzuEngine.controller.pos.y, z: window.__juzuEngine.controller.pos.z, surface: window.__juzuEngine.controller.getSurfaceType() })")
        print(f"Player pos at dais: {pos2}")
        page.screenshot(path=str(out / "02_paititi_sun_dais_close.png"), timeout=90000)
        print("Captured 02_paititi_sun_dais_close.png")

        # Milestone 3: Trigger virtual interact to awaken the Sun Disk and Plaza
        print("3. Triggering interact to awaken the Golden Sun Disk...")
        page.evaluate("""() => {
            window.__juzuEngine.input.triggerVirtualInteract();
        }""")
        time.sleep(1.0)

        pstate = page.evaluate("() => window.__juzuEngine.puzzleState")
        print(f"Puzzle State: {pstate}")
        hud_obj = page.evaluate("() => document.getElementById('juzu-objective-text')?.innerText")
        print(f"HUD Objective: {hud_obj}")
        page.screenshot(path=str(out / "03_paititi_plaza_awakened.png"), timeout=90000)
        print("Captured 03_paititi_plaza_awakened.png")

        # Milestone 4: Broad Rotunda and Cirque Vista
        print("4. Capturing broad Sun Temple Rotunda and Mountain Cirque vista...")
        page.evaluate("""() => {
            const c = window.__juzuEngine.controller;
            const cam = window.__juzuEngine.followCamera;
            const px = 200.0;
            const pz = 166.0;
            const py = c.getGroundAt(px, pz, 28.0);
            c.pos.set(px, py, pz);
            c.heading = 0.0;
            cam.yaw = Math.PI;
            cam.dist = 8.5;
            cam.pitch = 0.16;
            cam.shoulderOffset = 0.0;
            cam.teleport(c.pos);
        }""")
        time.sleep(1.0)
        page.screenshot(path=str(out / "04_paititi_rotunda_cirque_vista.png"), timeout=90000)
        print("Captured 04_paititi_rotunda_cirque_vista.png")

        browser.close()

    print("\nErrors logged:")
    for err in errors[:10]:
        print("  ", err)

    print("Paititi playtest completed successfully!")

if __name__ == "__main__":
    main()
