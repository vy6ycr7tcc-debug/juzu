#!/usr/bin/env python3
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path("/Users/samuelpires/.gemini/antigravity/brain/d7f10a93-f67a-4eb7-af36-211f147ca4a5/shots")
OUT_DIR.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(args=[
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
    ])
    ctx = browser.new_context(viewport={"width": 915, "height": 412})
    page = ctx.new_page()
    page.add_init_script("Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });")
    page.goto("http://127.0.0.1:5173/juzu/?play=1", wait_until="load", timeout=30000)
    time.sleep(2.5)
    page.screenshot(path=str(OUT_DIR / "landscape_gameplay_v2.png"), timeout=45000)
    print("Captured landscape_gameplay_v2.png")
    browser.close()
