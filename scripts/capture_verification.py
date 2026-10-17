#!/usr/bin/env python3
"""Capture full suite of mobile and gameplay verification screenshots."""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path("/Users/samuelpires/.gemini/antigravity/brain/d7f10a93-f67a-4eb7-af36-211f147ca4a5/shots")
OUT_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = "http://127.0.0.1:5173/juzu/?region=highSierra&shot=vista"

def capture():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=[
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
        ])

        # 1. Mobile Portrait Gameplay (412 x 915)
        print("1. Capturing Mobile Portrait Gameplay...")
        ctx_portrait = browser.new_context(viewport={"width": 412, "height": 915})
        page1 = ctx_portrait.new_page()
        page1.add_init_script("Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });")
        page1.goto(BASE_URL, wait_until="load", timeout=30000)
        time.sleep(3.0)
        page1.screenshot(path=str(OUT_DIR / "01_portrait_gameplay.png"))

        # 2. World Map Tab
        print("2. Capturing World Map Tab...")
        page1.evaluate("() => { if (window.__juzuEngine && window.__juzuEngine.expeditionMenu) window.__juzuEngine.expeditionMenu.open('map'); }")
        time.sleep(1.5)
        page1.screenshot(path=str(OUT_DIR / "02_world_map_tab.png"))

        # 3. Inventory Tab
        print("3. Capturing Inventory Tab...")
        ctx_inv = browser.new_context(viewport={"width": 412, "height": 915})
        page_inv = ctx_inv.new_page()
        page_inv.add_init_script("Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });")
        page_inv.goto(BASE_URL, wait_until="load", timeout=25000)
        time.sleep(2.0)
        page_inv.evaluate("() => { if (window.__juzuEngine && window.__juzuEngine.expeditionMenu) window.__juzuEngine.expeditionMenu.open('inventory'); }")
        time.sleep(1.0)
        page_inv.screenshot(path=str(OUT_DIR / "03_inventory_tab.png"), timeout=15000)
        ctx_inv.close()

        # 4. Mobile Landscape Gameplay (915 x 412)
        print("4. Capturing Mobile Landscape Gameplay...")
        ctx_landscape = browser.new_context(viewport={"width": 915, "height": 412})
        page2 = ctx_landscape.new_page()
        page2.add_init_script("Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });")
        page2.goto(BASE_URL, wait_until="load", timeout=25000)
        time.sleep(2.5)
        page2.screenshot(path=str(OUT_DIR / "04_landscape_gameplay.png"), timeout=15000)

        # 5. Weapon Aim Stance & Reticle
        print("5. Capturing Weapon Aim Stance & Reticle...")
        page2.evaluate("() => { if (window.__juzuEngine && window.__juzuEngine.weapon) window.__juzuEngine.weapon.setAim(true); }")
        time.sleep(1.0)
        page2.screenshot(path=str(OUT_DIR / "05_weapon_aim_stance.png"), timeout=15000)
        ctx_landscape.close()

        browser.close()
        print("All verification screenshots successfully captured!")

if __name__ == "__main__":
    capture()
