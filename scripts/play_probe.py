#!/usr/bin/env python3
"""play_probe.py — Playtest agent that simulates player gameplay and captures milestones."""
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

def main():
    out = Path("shots_inspect/playtest")
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

        print("1. Booting game at South Camp...")
        page.goto("http://127.0.0.1:5173/juzu/?play=true", wait_until="load", timeout=30000)
        page.wait_for_function("() => window.__shotReady === true || (window.__juzuEngine && window.__juzuEngine.foliage && window.__juzuEngine.foliage.isLoaded)", timeout=45000)
        time.sleep(1.0)

        # Milestone 1: South Camp starting vista
        page.screenshot(path=str(out / "01_south_camp_start.png"), timeout=90000)
        print("Captured 01_south_camp_start.png")

        # Milestone 2: Sprint toward bridge entrance (z: 10 -> 2.0)
        print("2. Sprinting toward Urubamba suspension bridge entrance...")
        page.evaluate("""() => new Promise(resolve => {
            window.__juzuEngine.input.setVirtualMove(0, 1);
            window.__juzuEngine.input.setVirtualBoost(true);
            const startT = performance.now();
            function step() {
                const c = window.__juzuEngine.controller;
                if (c.pos.z <= 2.2 || performance.now() - startT > 2500) {
                    window.__juzuEngine.input.setVirtualMove(0, 0);
                    window.__juzuEngine.input.setVirtualBoost(false);
                    resolve();
                } else {
                    requestAnimationFrame(step);
                }
            }
            requestAnimationFrame(step);
        })""")

        pos2 = page.evaluate("() => ({ x: window.__juzuEngine.controller.pos.x, y: window.__juzuEngine.controller.pos.y, z: window.__juzuEngine.controller.pos.z, pose: window.__juzuEngine.controller.pose, surface: window.__juzuEngine.controller.getSurfaceType() })")
        print(f"Player state at bridgehead: {pos2}")
        page.screenshot(path=str(out / "02_bridge_entrance.png"), timeout=90000)
        print("Captured 02_bridge_entrance.png")

        # Milestone 3: Run across the hanging bridge to mid-span (z: 2 -> -17)
        print("3. Running onto the hanging bridge over Urubamba Gorge...")
        page.evaluate("""() => new Promise(resolve => {
            window.__juzuEngine.input.setVirtualMove(0, 1);
            window.__juzuEngine.input.setVirtualBoost(true);
            const startT = performance.now();
            function step() {
                const c = window.__juzuEngine.controller;
                if (c.pos.z <= -16.5 || performance.now() - startT > 4500) {
                    window.__juzuEngine.input.setVirtualMove(0, 0);
                    window.__juzuEngine.input.setVirtualBoost(false);
                    resolve();
                } else {
                    requestAnimationFrame(step);
                }
            }
            requestAnimationFrame(step);
        })""")

        pos3 = page.evaluate("() => ({ x: window.__juzuEngine.controller.pos.x, y: window.__juzuEngine.controller.pos.y, z: window.__juzuEngine.controller.pos.z, grounded: window.__juzuEngine.controller.grounded, surface: window.__juzuEngine.controller.getSurfaceType() })")
        print(f"Player state on bridge: {pos3}")
        page.screenshot(path=str(out / "03_on_bridge_gorge.png"), timeout=90000)
        print("Captured 03_on_bridge_gorge.png")

        # Milestone 4: Cross bridge into North Sanctuary Citadel (z: -17 -> -38)
        print("4. Crossing into North Sanctuary Citadel...")
        page.evaluate("""() => new Promise(resolve => {
            window.__juzuEngine.input.setVirtualMove(0, 1);
            window.__juzuEngine.input.setVirtualBoost(true);
            const startT = performance.now();
            function step() {
                const c = window.__juzuEngine.controller;
                if (c.pos.z <= -37.5 || performance.now() - startT > 4500) {
                    window.__juzuEngine.input.setVirtualMove(0, 0);
                    window.__juzuEngine.input.setVirtualBoost(false);
                    resolve();
                } else {
                    requestAnimationFrame(step);
                }
            }
            requestAnimationFrame(step);
        })""")

        pos4 = page.evaluate("() => ({ x: window.__juzuEngine.controller.pos.x, y: window.__juzuEngine.controller.pos.y, z: window.__juzuEngine.controller.pos.z, grounded: window.__juzuEngine.controller.grounded, surface: window.__juzuEngine.controller.getSurfaceType() })")
        print(f"Player state in sanctuary: {pos4}")
        page.screenshot(path=str(out / "04_sanctuary_arrival.png"), timeout=90000)
        print("Captured 04_sanctuary_arrival.png")

        # Milestone 5: Trigger Survival Instinct in Sanctuary
        print("5. Triggering Survival Instinct [Q] in Sanctuary...")
        page.keyboard.press("KeyQ")
        time.sleep(0.5)
        page.screenshot(path=str(out / "05_sanctuary_instinct.png"), timeout=90000)
        print("Captured 05_sanctuary_instinct.png")

        browser.close()

    print("\nErrors logged during playtest:")
    for err in errors[:15]:
        print("  ", err)

    print("\nPlaytest finished successfully!")
    return 0

if __name__ == "__main__":
    main()
