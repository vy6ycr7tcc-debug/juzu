#!/usr/bin/env python3
"""shot.py — capture rendered frames of the running Juzu game for visual verification."""
import argparse
import sys
import time
from pathlib import Path

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True, help="Local URL of running game")
    ap.add_argument("--out", required=True, help="Output directory for PNGs")
    ap.add_argument("--shots", type=int, default=1, help="Frames to capture (default 1)")
    ap.add_argument("--gap", type=float, default=2.0, help="Seconds between frames")
    ap.add_argument("--ready-timeout", type=int, default=15000, help="ms to wait for window.__shotReady")
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=720)
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(args=[
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
        ])
        context = browser.new_context(viewport={"width": args.width, "height": args.height})
        page = context.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });")
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

        print(f"loading {args.url}")
        page.goto(args.url, wait_until="load", timeout=30000)
        try:
            page.wait_for_function("window.__shotReady === true || window.__juzuReady === true", timeout=args.ready_timeout)
            print("game signalled ready")
        except Exception as e:
            print(f"Wait failed ({e}), capturing anyway...")

        # Allow Three.js a moment to warm shaders and render frame
        time.sleep(1.0)

        paths = []
        for i in range(args.shots):
            if i > 0:
                time.sleep(args.gap)
            path = out / f"frame{i+1}.png"
            page.screenshot(path=str(path))
            paths.append(path)
            print(f"captured {path}")

        browser.close()

    if errors:
        print("\nConsole errors:", file=sys.stderr)
        for e in errors[:10]:
            print(f"  - {e}", file=sys.stderr)

    return 0

if __name__ == "__main__":
    sys.exit(main())
