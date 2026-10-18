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
    
    # Simulate iOS Mobile Safari
    ctx = browser.new_context(
        viewport={"width": 393, "height": 852},
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
        is_mobile=True,
        has_touch=True
    )
    page = ctx.new_page()

    console_logs = []
    page_errors = []
    page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: page_errors.append(str(err)))

    print("1. Opening clean game URL (no query params, default cold boot)...")
    page.goto("http://127.0.0.1:5173/juzu/", wait_until="load", timeout=30000)

    print("2. Waiting for __juzuSceneReady...")
    start_t = time.time()
    while time.time() - start_t < 15:
        ready = page.evaluate("Boolean(window.__juzuSceneReady)")
        if ready:
            print(f"Scene ready after {time.time() - start_t:.2f}s!")
            break
        time.sleep(0.1)

    time.sleep(1.0)
    
    boot_shot = OUT_DIR / "cold_boot_title_ready.png"
    page.screenshot(path=str(boot_shot), timeout=60000)
    print(f"Captured {boot_shot}")

    print("3. Clicking '✦ Begin Expedition ✦' button...")
    page.click("#juzu-btn-begin")
    time.sleep(0.8)

    state_after_click = page.evaluate("""() => {
        const eng = window.__juzuEngine;
        const titleEl = document.getElementById('juzu-title-screen');
        const loadEl = document.getElementById('juzu-loading-screen');
        const hudEl = document.getElementById('juzu-hud');
        return {
            isTitleOpen: eng?.hud?.isTitleOpen,
            titleDisplay: titleEl ? window.getComputedStyle(titleEl).display : null,
            loadingDisplay: loadEl ? window.getComputedStyle(loadEl).display : null,
            hudDisplay: hudEl ? window.getComputedStyle(hudEl).display : null,
            nairaLoaded: eng?.naira?.isLoaded,
            nairaVisible: eng?.naira?.modelRoot?.visible,
            nairaInScene: Boolean(eng?.naira?.modelRoot?.parent),
            controllerPos: eng?.controller?.pos
        };
    }""")
    print("State after clicking Begin Expedition:", state_after_click)

    play_shot = OUT_DIR / "gameplay_active_after_begin.png"
    page.screenshot(path=str(play_shot), timeout=60000)
    print(f"Captured {play_shot}")

    print("4. Moving forward with virtual joystick...")
    page.evaluate("() => window.__juzuEngine.input.setVirtualMove(0, 1)")
    page.evaluate('''() => new Promise(resolve => {
        let f = 0;
        function step() {
            f++;
            if (f >= 30) {
                resolve();
                return;
            }
            requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    })''')

    move_state = page.evaluate("""() => {
        const eng = window.__juzuEngine;
        return {
            controllerPos: eng?.controller?.pos,
            speed: eng?.controller?.speed,
            pose: eng?.controller?.pose,
            animAction: eng?.naira?.currentAction?.getClip()?.name
        };
    }""")
    print("State during movement:", move_state)

    move_shot = OUT_DIR / "gameplay_moving_after_begin.png"
    page.screenshot(path=str(move_shot), timeout=60000)
    print(f"Captured {move_shot}")

    page.evaluate("() => window.__juzuEngine.input.setVirtualMove(0, 0)")

    print("\n--- Console Logs ---")
    for log in console_logs[-15:]:
        print(log)

    print("\n--- Page Errors ---")
    for err in page_errors:
        print("ERROR:", err)

    browser.close()
