#!/usr/bin/env python3
"""shot.py — capture rendered frames of the running Juzu game for the judge loop.

The builder runs this after every change. The judge scores the PNGs.
Never call a visual done without these files existing.

Usage:
    python3 shot.py --url http://localhost:5173/ --out shots/pass1-exposure/
    python3 shot.py --url "http://localhost:5173/?shot=forest&t=5" --out shots/forest/ --shots 3

Requires: playwright (pip install playwright && playwright install chromium)
"""
import argparse
import sys
import time
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True, help="Local URL of the running game")
    ap.add_argument("--out", required=True, help="Output directory for PNGs")
    ap.add_argument("--shots", type=int, default=2, help="Frames to capture (default 2)")
    ap.add_argument("--gap", type=float, default=3.0, help="Seconds between frames (default 3)")
    ap.add_argument("--ready-timeout", type=int, default=20000,
                    help="ms to wait for window.__shotReady (default 20000)")
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=800)
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        import subprocess
        # Node playwright fallback
        node_script = Path(__file__).resolve().parent.parent / "screenshot.cjs"
        cmd = ["node", str(node_script), args.url, "webgl2"]
        res = subprocess.run(cmd, capture_output=False)
        return res.returncode

    with sync_playwright() as p:
        browser = p.chromium.launch(args=[
            "--use-gl=angle", "--use-angle=swiftshader",  # software WebGL: works headless
            "--enable-unsafe-swiftshader",
        ])
        context = browser.new_context(viewport={"width": args.width, "height": args.height}, service_workers="block")
        page = context.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });")
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

        print(f"loading {args.url}")
        page.goto(args.url, wait_until="load", timeout=60000)
        try:
            page.wait_for_function("window.__shotReady === true",
                                   timeout=args.ready_timeout)
            print("game signalled ready")
        except Exception as e:
            print(f"WARNING: __shotReady wait failed ({e}) — capturing anyway; "
                  "frames may show a loading state", file=sys.stderr)

        paths = []
        for i in range(args.shots):
            if i:
                time.sleep(args.gap)
            path = out / f"frame{i+1}.png"
            page.screenshot(path=str(path))
            paths.append(path)
            print(f"captured {path}")

        browser.close()

    if errors:
        print("\nconsole/page errors observed (first 10):", file=sys.stderr)
        for e in errors[:10]:
            print(f"  - {e}", file=sys.stderr)

    print(f"\ndone: {len(paths)} frames in {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
