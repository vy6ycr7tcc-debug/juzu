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

    print("1. Loading game as iOS Mobile Safari...")
    page.goto("http://127.0.0.1:5173/juzu/?play=1", wait_until="load", timeout=30000)

    # Wait for window.__juzuSceneReady (up to 15 seconds)
    print("2. Waiting for window.__juzuSceneReady...")
    start_t = time.time()
    while time.time() - start_t < 15:
        ready_info = page.evaluate("""() => {
            const eng = window.__juzuEngine;
            return {
                sceneReady: Boolean(window.__juzuSceneReady),
                nairaLoaded: eng?.naira?.isLoaded,
                foliageLoaded: eng?.foliage?.isLoaded,
                cloudForestLoaded: eng?.cloudForest?.isLoaded
            };
        }""")
        if ready_info.get("sceneReady"):
            print(f"Scene ready after {time.time() - start_t:.2f}s! Info: {ready_info}")
            break
        time.sleep(0.2)

    time.sleep(1.0) # let initial frame settle
    
    status_text = page.evaluate("""() => {
        const eng = window.__juzuEngine;
        return {
            sceneReady: window.__juzuSceneReady,
            nairaLoaded: eng?.naira?.isLoaded,
            nairaRootInScene: Boolean(eng?.naira?.modelRoot?.parent),
            nairaVisible: eng?.naira?.modelRoot?.visible,
            controllerPos: eng?.controller?.pos,
            loadingDismissed: document.getElementById('juzu-loading-screen')?.style?.display === 'none'
        };
    }""")
    print("Engine status at ready:", status_text)

    ready_shot = OUT_DIR / "safari_webgl_ready.png"
    page.screenshot(path=str(ready_shot), timeout=60000)
    print(f"Captured {ready_shot}")

    # Simulate locomotion (moving forward via virtual joystick)
    print("3. Simulating character movement via virtual joystick (forward for 25 frames)...")
    page.evaluate("() => window.__juzuEngine.input.setVirtualMove(0, 1)")
    page.evaluate('''() => new Promise(resolve => {
        let f = 0;
        function step() {
            f++;
            if (f >= 25) {
                resolve();
                return;
            }
            requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    })''')
    move_status = page.evaluate("""() => {
        const eng = window.__juzuEngine;
        return {
            controllerPos: eng?.controller?.pos,
            nairaPos: eng?.naira?.modelRoot?.position,
            animAction: eng?.naira?.currentAction?.getClip()?.name,
            speed: eng?.controller?.speed,
            pose: eng?.controller?.pose
        };
    }""")
    print("Engine status during move:", move_status)

    move_shot = OUT_DIR / "safari_webgl_move.png"
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
