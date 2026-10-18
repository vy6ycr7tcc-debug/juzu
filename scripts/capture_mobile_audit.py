#!/usr/bin/env python3
import sys
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

    # 1. Cold Boot in Portrait (what the player sees the instant they load the game)
    print("Testing Cold Boot...")
    ctx_cold = browser.new_context(viewport={"width": 412, "height": 915})
    page_cold = ctx_cold.new_page()
    page_cold.add_init_script("Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });")
    page_cold.goto("http://127.0.0.1:5173/juzu/", wait_until="load", timeout=30000)
    time.sleep(2.5)
    page_cold.screenshot(path=str(OUT_DIR / "cold_boot_v2.png"), animations="disabled")
    print("Captured cold_boot_v2.png")
    ctx_cold.close()

    # 2. Portrait Active Gameplay with Naira up close & touch controls
    print("Testing Portrait Gameplay...")
    ctx_portrait = browser.new_context(viewport={"width": 412, "height": 915})
    page_portrait = ctx_portrait.new_page()
    page_portrait.add_init_script("Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });")
    page_portrait.goto("http://127.0.0.1:5173/juzu/?play=1", wait_until="load", timeout=30000)
    time.sleep(2.5)
    page_portrait.screenshot(path=str(OUT_DIR / "portrait_gameplay_v2.png"), animations="disabled")
    print("Captured portrait_gameplay_v2.png")
    ctx_portrait.close()

    # 3. Landscape Active Gameplay
    print("Testing Landscape Gameplay...")
    ctx_land = browser.new_context(viewport={"width": 915, "height": 412})
    page_land = ctx_land.new_page()
    page_land.add_init_script("Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });")
    page_land.goto("http://127.0.0.1:5173/juzu/?play=1", wait_until="load", timeout=30000)
    time.sleep(2.5)
    page_land.screenshot(path=str(OUT_DIR / "landscape_gameplay_v2.png"))
    print("Captured landscape_gameplay_v2.png")
    ctx_land.close()

    # 4. Floating Thumbstick in Action
    print("Testing Floating Thumbstick...")
    ctx_stick = browser.new_context(viewport={"width": 412, "height": 915}, has_touch=True)
    page_stick = ctx_stick.new_page()
    page_stick.add_init_script("Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });")
    page_stick.goto("http://127.0.0.1:5173/juzu/?play=1", wait_until="load", timeout=30000)
    time.sleep(2.0)
    page_stick.touchscreen.tap(120, 680)
    time.sleep(0.5)
    page_stick.screenshot(path=str(OUT_DIR / "floating_thumbstick_test.png"))
    print("Captured floating_thumbstick_test.png")
    ctx_stick.close()

    browser.close()
