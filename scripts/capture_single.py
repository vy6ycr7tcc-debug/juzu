#!/usr/bin/env python3
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path("/Users/samuelpires/.gemini/antigravity/brain/d7f10a93-f67a-4eb7-af36-211f147ca4a5/shots")
OUT_DIR.mkdir(parents=True, exist_ok=True)

mode = sys.argv[1] if len(sys.argv) > 1 else "inventory"
url = "http://127.0.0.1:5173/juzu/?region=highSierra&shot=vista"

with sync_playwright() as p:
    browser = p.chromium.launch(args=[
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
    ])
    
    if mode == "inventory":
        ctx = browser.new_context(viewport={"width": 412, "height": 915})
        page = ctx.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });")
        page.goto(url, wait_until="load", timeout=25000)
        time.sleep(2.0)
        page.evaluate("() => { if (window.__juzuEngine && window.__juzuEngine.expeditionMenu) window.__juzuEngine.expeditionMenu.open('inventory'); }")
        time.sleep(1.0)
        page.screenshot(path=str(OUT_DIR / "03_inventory_tab.png"), animations="disabled")
        print("Captured 03_inventory_tab.png")
    elif mode == "landscape":
        ctx = browser.new_context(viewport={"width": 915, "height": 412})
        page = ctx.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });")
        page.goto(url, wait_until="load", timeout=25000)
        time.sleep(2.5)
        page.screenshot(path=str(OUT_DIR / "04_landscape_gameplay.png"), animations="disabled")
        print("Captured 04_landscape_gameplay.png")
    elif mode == "aim":
        ctx = browser.new_context(viewport={"width": 915, "height": 412})
        page = ctx.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });")
        page.goto(url, wait_until="load", timeout=25000)
        time.sleep(2.5)
        page.evaluate("() => { if (window.__juzuEngine && window.__juzuEngine.weapon) window.__juzuEngine.weapon.setAim(true); }")
        time.sleep(1.2)
        page.screenshot(path=str(OUT_DIR / "05_weapon_aim_stance.png"), timeout=60000, animations="disabled")
        print("Captured 05_weapon_aim_stance.png")

    browser.close()
