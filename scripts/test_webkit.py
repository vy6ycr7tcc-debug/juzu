#!/usr/bin/env python3
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path("/Users/samuelpires/.gemini/antigravity/brain/d7f10a93-f67a-4eb7-af36-211f147ca4a5/shots")
OUT_DIR.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.webkit.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 393, "height": 852},
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
        is_mobile=True,
        has_touch=True
    )
    page = ctx.new_page()

    console_logs = []
    page_errors = []
    page.on("console", lambda m: console_logs.append(f"[{m.type}] {m.text}"))
    page.on("pageerror", lambda e: page_errors.append(str(e)))

    print("1. Loading http://127.0.0.1:5173/juzu/ in REAL WebKit...")
    page.goto("http://127.0.0.1:5173/juzu/", wait_until="load", timeout=30000)

    # Wait for scene ready
    page.wait_for_function("Boolean(window.__juzuSceneReady)", timeout=15000)
    print("Scene ready in WebKit!")

    time.sleep(0.5)
    page.screenshot(path=str(OUT_DIR / "webkit_title_screen.png"), timeout=30000)
    print("Captured webkit_title_screen.png")

    print("2. Tapping '✦ Begin Expedition ✦' in WebKit...")
    page.click("#juzu-btn-begin")
    time.sleep(0.6)

    after_begin_state = page.evaluate("""() => ({
        isTitleOpen: window.__juzuEngine?.hud?.isTitleOpen,
        nairaLoaded: window.__juzuEngine?.naira?.isLoaded,
        nairaVisible: window.__juzuEngine?.naira?.modelRoot?.visible,
        pos: window.__juzuEngine?.controller?.pos
    })""")
    print("State after Begin Expedition in WebKit:", after_begin_state)

    page.screenshot(path=str(OUT_DIR / "webkit_gameplay_active.png"), timeout=30000)
    print("Captured webkit_gameplay_active.png")

    print("3. Moving forward via virtual joystick in WebKit...")
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

    move_state = page.evaluate("""() => ({
        pos: window.__juzuEngine?.controller?.pos,
        speed: window.__juzuEngine?.controller?.speed,
        pose: window.__juzuEngine?.controller?.pose,
        anim: window.__juzuEngine?.naira?.currentAction?.getClip()?.name
    })""")
    print("State during movement in WebKit:", move_state)

    page.screenshot(path=str(OUT_DIR / "webkit_gameplay_moving.png"), timeout=30000)
    print("Captured webkit_gameplay_moving.png")

    page.evaluate("() => window.__juzuEngine.input.setVirtualMove(0, 0)")

    print("\n--- WebKit Console Logs ---")
    for log in console_logs[-10:]:
        print(log)

    print("\n--- WebKit Page Errors ---")
    for err in page_errors:
        print("ERROR:", err)

    browser.close()
