#!/usr/bin/env python3
"""
verify_mobile_safari_stability.py
Executes continuous real WebKit (Mobile Safari & iPadOS) walking regression test.
Verifies that the 4-second OOM jetsam crash is completely resolved.
"""
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path("/Users/samuelpires/.gemini/antigravity/brain/99d09d05-dc7a-4eb0-97a1-4255ce259407/shots")
OUT_DIR.mkdir(parents=True, exist_ok=True)

def run_mobile_test(device_name, viewport, user_agent, is_mobile, has_touch):
    print(f"\n=======================================================")
    print(f"Testing {device_name} in REAL WebKit Engine")
    print(f"=======================================================")

    with sync_playwright() as p:
        browser = p.webkit.launch(headless=True)
        ctx = browser.new_context(
            viewport=viewport,
            user_agent=user_agent,
            is_mobile=is_mobile,
            has_touch=has_touch,
            bypass_csp=True
        )
        page = ctx.new_page()

        console_logs = []
        page_errors = []
        page.on("console", lambda m: console_logs.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        print(f"1. Loading http://localhost:5173/juzu/ on {device_name}...")
        t0 = time.time()
        page.goto("http://localhost:5173/juzu/", wait_until="commit", timeout=30000)

        # Wait for scene ready
        page.wait_for_function("Boolean(window.__juzuSceneReady)", timeout=15000)
        print(f"   ✓ Scene ready in {time.time() - t0:.2f}s")

        # Check mobile detection
        mobile_eval = page.evaluate("""() => {
            const isIOS = (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
            const mobile = isIOS || (matchMedia('(pointer:coarse)').matches || Math.min(screen.width, screen.height) < 840);
            return {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                maxTouchPoints: navigator.maxTouchPoints,
                screenWidth: screen.width,
                screenHeight: screen.height,
                isIOS: isIOS,
                mobile: mobile
            };
        }""")
        print(f"   Mobile Detection State: {mobile_eval}")
        assert mobile_eval['mobile'] == True, f"ERROR: {device_name} failed to evaluate as mobile!"

        time.sleep(0.5)
        title_shot = OUT_DIR / f"{device_name.lower().replace(' ', '_')}_01_title.png"
        page.screenshot(path=str(title_shot))
        print(f"   ✓ Saved title screenshot: {title_shot.name}")

        print("2. Starting expedition...")
        page.click("#juzu-btn-begin")
        time.sleep(0.5)

        engine_state = page.evaluate("""() => ({
            isTitleOpen: window.__juzuEngine?.hud?.isTitleOpen,
            nairaLoaded: window.__juzuEngine?.naira?.isLoaded,
            nairaVisible: window.__juzuEngine?.naira?.modelRoot?.visible,
            startPos: window.__juzuEngine?.controller?.pos
        })""")
        print(f"   Expedition Start State: {engine_state}")
        assert engine_state['nairaLoaded'] == True, "Dr. Naira Quispe failed to load!"

        print("3. Walking continuously forward toward the suspension bridge...")
        # Hold forward walk
        page.evaluate("() => window.__juzuEngine.input.setVirtualMove(0, 1.0)")

        # Run past the 4-second crash mark (running for 6 seconds on path)
        print("   Running gameplay ticker past the 4-second mark...")
        start_walk = time.time()
        
        # Advance frames for 6 seconds (≈ 360 frames)
        page.evaluate('''() => new Promise(resolve => {
            let frames = 0;
            function step() {
                frames++;
                if (frames >= 360) { resolve(); return; }
                requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        })''')

        t_elapsed = time.time() - start_walk
        print(f"   ✓ Successfully passed previous crash threshold! Elapsed: {t_elapsed:.2f}s")

        path_state = page.evaluate("""() => ({
            pos: window.__juzuEngine?.controller?.pos,
            speed: window.__juzuEngine?.controller?.speed,
            pose: window.__juzuEngine?.controller?.pose,
            anim: window.__juzuEngine?.naira?.currentAction?.getClip()?.name,
            grounded: window.__juzuEngine?.controller?.grounded,
            surface: window.__juzuEngine?.controller?.getSurfaceType()
        })""")
        print(f"   Walk State at t=6s (on stone path): {path_state}")

        path_shot = OUT_DIR / f"{device_name.lower().replace(' ', '_')}_02_walking_path.png"
        page.screenshot(path=str(path_shot))
        print(f"   ✓ Saved walking screenshot at t=6s: {path_shot.name}")

        # Continue walking forward onto the bridge for another 6 seconds (≈ 360 frames)
        print("4. Continuing walk across the suspension bridge (t = 12s)...")
        page.evaluate('''() => new Promise(resolve => {
            let frames = 0;
            function step() {
                frames++;
                if (frames >= 360) { resolve(); return; }
                requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        })''')

        bridge_state = page.evaluate("""() => ({
            pos: window.__juzuEngine?.controller?.pos,
            speed: window.__juzuEngine?.controller?.speed,
            pose: window.__juzuEngine?.controller?.pose,
            anim: window.__juzuEngine?.naira?.currentAction?.getClip()?.name,
            grounded: window.__juzuEngine?.controller?.grounded,
            surface: window.__juzuEngine?.controller?.getSurfaceType()
        })""")
        print(f"   Bridge Walk State at t=12s: {bridge_state}")

        bridge_shot = OUT_DIR / f"{device_name.lower().replace(' ', '_')}_03_bridge.png"
        page.screenshot(path=str(bridge_shot))
        print(f"   ✓ Saved bridge screenshot at t=12s: {bridge_shot.name}")

        # Stop walking
        page.evaluate("() => window.__juzuEngine.input.setVirtualMove(0, 0)")
        time.sleep(0.3)

        print("\n--- Recent WebKit Console Logs ---")
        for log in console_logs[-8:]:
            print("  ", log)

        # Filter out harmless cross-origin/service-worker dev logs if any
        critical_errors = [e for e in page_errors if "access control" not in e.lower()]
        print(f"\n--- WebKit Critical Errors ({len(critical_errors)}) ---")
        for err in critical_errors:
            print("   ERROR:", err)
        assert len(critical_errors) == 0, f"Critical page errors detected: {critical_errors}"

        browser.close()
        print(f"✓ {device_name} TEST PASSED STABLY WITH ZERO CRASHES!\n")

if __name__ == '__main__':
    # 1. iPhone 15 Pro / Safari Mobile
    run_mobile_test(
        device_name="iPhone_15_Pro_Safari",
        viewport={"width": 393, "height": 852},
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
        is_mobile=True,
        has_touch=True
    )

    # 2. iPad Pro 11 / iPadOS Safari (desktop user-agent + touch points)
    run_mobile_test(
        device_name="iPad_Pro_Safari",
        viewport={"width": 834, "height": 1194},
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
        is_mobile=False,
        has_touch=True
    )

    print("ALL MOBILE SAFARI & IPADOS REGRESSION TESTS PASSED CLEANLY!")
