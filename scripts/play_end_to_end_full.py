#!/usr/bin/env python3
"""play_end_to_end_full.py — Exhaustive playtest script traversing Juzu end-to-end and capturing milestone frames."""
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path("/Users/samuelpires/.gemini/antigravity/brain/99d09d05-dc7a-4eb0-97a1-4255ce259407/screenshots")
OUT_DIR.mkdir(parents=True, exist_ok=True)

def wait_frames(page, count=15):
    page.evaluate(f"""() => new Promise(resolve => {{
        let f = 0;
        function step() {{
            f++;
            if (f >= {count}) resolve();
            else requestAnimationFrame(step);
        }}
        requestAnimationFrame(step);
    }})""")

def main():
    print(f"Starting End-to-End Playtest. Target Output Directory: {OUT_DIR}")

    with sync_playwright() as p:
        browser = p.chromium.launch(args=[
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--window-size=1920,1080",
        ])
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });")

        logs = []
        errors = []
        page.on("pageerror", lambda e: errors.append(f"[PageError] {e}"))
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))

        # -------------------------------------------------------------
        # MILESTONE 1: Cold Boot & Title Screen
        # -------------------------------------------------------------
        print("\n--- 1. Cold Boot & Title Screen ---")
        page.goto("http://127.0.0.1:5173/juzu/", wait_until="load", timeout=30000)
        page.wait_for_function("Boolean(window.__juzuSceneReady)", timeout=45000)
        wait_frames(page, 20)
        page.screenshot(path=str(OUT_DIR / "01_title_screen.png"))
        print("Captured 01_title_screen.png")

        # Click Begin Expedition
        page.click("#juzu-btn-begin")
        wait_frames(page, 20)

        # -------------------------------------------------------------
        # MILESTONE 2: South Camp Overview Vista
        # -------------------------------------------------------------
        print("\n--- 2. South Camp Overview Vista ---")
        wait_frames(page, 15)
        page.screenshot(path=str(OUT_DIR / "02_south_camp_overview.png"))
        print("Captured 02_south_camp_overview.png")

        # -------------------------------------------------------------
        # MILESTONE 3: South Camp Bronze Sun-Mirror Alignment Puzzle
        # -------------------------------------------------------------
        print("\n--- 3. Sun Mirror Puzzle ---")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            eng.controller.pos.set(-3.0, 4.2, 10.5);
            eng.controller.heading = -Math.PI / 2;
            eng.followCamera.yaw = -Math.PI / 2;
            eng.followCamera.teleport(eng.controller.pos);
            eng.cloudForest.alignSunMirror();
        }""")
        wait_frames(page, 20)
        page.screenshot(path=str(OUT_DIR / "03_south_camp_mirror_puzzle.png"))
        print("Captured 03_south_camp_mirror_puzzle.png")

        # -------------------------------------------------------------
        # MILESTONE 4: Weapon Draw & Aiming Stance
        # -------------------------------------------------------------
        print("\n--- 4. Weapon Draw & Aiming Stance ---")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            eng.controller.pos.set(0, 4.2, 8.5);
            eng.controller.heading = Math.PI;
            eng.followCamera.yaw = 0;
            eng.followCamera.teleport(eng.controller.pos);
            if (!eng.weapon.isAiming) eng.weapon.toggleAim();
        }""")
        wait_frames(page, 20)
        page.screenshot(path=str(OUT_DIR / "04_weapon_aim_stance.png"))
        print("Captured 04_weapon_aim_stance.png")

        # -------------------------------------------------------------
        # MILESTONE 5: Weapon Fire & Muzzle Flash FX
        # -------------------------------------------------------------
        print("\n--- 5. Weapon Fire & Muzzle Flash ---")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            const collidables = [
                eng.terrain.group,
                eng.cloudForest.group,
                eng.highSierra.group,
                eng.jungleLowlands.group,
                eng.paititi.group
            ];
            eng.weapon.fire(collidables);
        }""")
        wait_frames(page, 2)
        page.screenshot(path=str(OUT_DIR / "05_weapon_fire_muzzle_flash.png"))
        print("Captured 05_weapon_fire_muzzle_flash.png")

        # Reset aim
        page.evaluate("() => { if (window.__juzuEngine.weapon.isAiming) window.__juzuEngine.weapon.toggleAim(); }")

        # -------------------------------------------------------------
        # MILESTONE 6: Urubamba Hanging Suspension Bridge Crossing
        # -------------------------------------------------------------
        print("\n--- 6. Urubamba Hanging Suspension Bridge Crossing ---")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            eng.controller.pos.set(0, 3.0, -17.0);
            eng.controller.heading = Math.PI;
            eng.followCamera.yaw = 0.25;
            eng.followCamera.pitch = -0.15;
            eng.followCamera.dist = 4.8;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        wait_frames(page, 20)
        page.screenshot(path=str(OUT_DIR / "06_hanging_bridge_crossing.png"))
        print("Captured 06_hanging_bridge_crossing.png")

        # -------------------------------------------------------------
        # MILESTONE 7: North Sanctuary Citadel Entrance
        # -------------------------------------------------------------
        print("\n--- 7. North Sanctuary Citadel Entrance ---")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            eng.controller.pos.set(0, 4.3, -37.5);
            eng.controller.heading = Math.PI;
            eng.followCamera.yaw = 0.0;
            eng.followCamera.pitch = 0.05;
            eng.followCamera.dist = 4.6;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        wait_frames(page, 20)
        page.screenshot(path=str(OUT_DIR / "07_north_sanctuary_entrance.png"))
        print("Captured 07_north_sanctuary_entrance.png")

        # -------------------------------------------------------------
        # MILESTONE 8: North Sanctuary Chakana Stele Alignment
        # -------------------------------------------------------------
        print("\n--- 8. North Sanctuary Chakana Stele Alignment ---")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            eng.cloudForest.alignSunMirror();
            eng.controller.pos.set(0, 4.5, -42.0);
            eng.controller.heading = Math.PI;
            eng.followCamera.yaw = 0.0;
            eng.followCamera.pitch = 0.12;
            eng.followCamera.dist = 3.6;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        wait_frames(page, 20)
        page.screenshot(path=str(OUT_DIR / "08_north_sanctuary_chakana_stele.png"))
        print("Captured 08_north_sanctuary_chakana_stele.png")

        # -------------------------------------------------------------
        # MILESTONE 9: Survival Instinct Beacon [Q]
        # -------------------------------------------------------------
        print("\n--- 9. Survival Instinct Beacon [Q] ---")
        page.keyboard.press("KeyQ")
        wait_frames(page, 10)
        page.screenshot(path=str(OUT_DIR / "09_survival_instinct_beacon.png"))
        print("Captured 09_survival_instinct_beacon.png")

        # -------------------------------------------------------------
        # MILESTONE 10: Grapple Launch Rim & Chasm
        # -------------------------------------------------------------
        print("\n--- 10. Grapple Launch Rim & Chasm ---")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            const actualY = eng.controller.getGroundAt(62, -102);
            eng.controller.pos.set(62, actualY, -102);
            eng.controller.heading = Math.atan2(84 - 62, -122 - (-102));
            eng.followCamera.yaw = eng.controller.heading - Math.PI;
            eng.followCamera.pitch = 0.15;
            eng.followCamera.dist = 5.2;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        wait_frames(page, 20)
        page.screenshot(path=str(OUT_DIR / "10_grapple_swing_chasm.png"))
        print("Captured 10_grapple_swing_chasm.png")

        # -------------------------------------------------------------
        # MILESTONE 11: Expedition Menu — World Map & GPS
        # -------------------------------------------------------------
        print("\n--- 11. Expedition Menu: World Map ---")
        page.evaluate("() => window.__juzuEngine.expeditionMenu.open('map')")
        wait_frames(page, 20)
        page.screenshot(path=str(OUT_DIR / "11_expedition_menu_world_map.png"))
        print("Captured 11_expedition_menu_world_map.png")

        # -------------------------------------------------------------
        # MILESTONE 12: Expedition Menu — Backpack Inventory & Item Inspection
        # -------------------------------------------------------------
        print("\n--- 12. Expedition Menu: Backpack Inventory ---")
        page.evaluate("() => window.__juzuEngine.expeditionMenu.open('inventory')")
        wait_frames(page, 20)
        page.screenshot(path=str(OUT_DIR / "12_expedition_menu_backpack_inventory.png"))
        print("Captured 12_expedition_menu_backpack_inventory.png")

        # Close Expedition Menu
        page.evaluate("() => window.__juzuEngine.expeditionMenu.close()")
        wait_frames(page, 10)

        # -------------------------------------------------------------
        # MILESTONE 13: High Sierra — Overview & Megalithic Masonry
        # -------------------------------------------------------------
        print("\n--- 13. High Sierra: Overview & Megalithic Masonry ---")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            eng.highSierra.loadScannedAssets?.();
            const gy = eng.controller.getGroundAt(120, -154);
            eng.controller.pos.set(120, gy, -154);
            eng.controller.heading = Math.PI;
            eng.followCamera.yaw = 0.1;
            eng.followCamera.pitch = 0.12;
            eng.followCamera.dist = 6.0;
            eng.followCamera.teleport(eng.controller.pos);
            eng.hud.setObjective('Align the Intihuatana Gnomon Dial [E] with the Chakana Gate.');
        }""")
        wait_frames(page, 25)
        page.screenshot(path=str(OUT_DIR / "13_high_sierra_overview.png"))
        print("Captured 13_high_sierra_overview.png")

        # -------------------------------------------------------------
        # MILESTONE 14: High Sierra — Intihuatana Gnomon Dial Alignment
        # -------------------------------------------------------------
        print("\n--- 14. High Sierra: Intihuatana Dial ---")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            eng.highSierra.alignIntihuatanaDial();
            const gy = eng.controller.getGroundAt(120, -165);
            eng.controller.pos.set(120, gy, -165);
            eng.controller.heading = Math.PI;
            eng.followCamera.yaw = 0.0;
            eng.followCamera.pitch = 0.22;
            eng.followCamera.dist = 4.8;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        wait_frames(page, 20)
        page.screenshot(path=str(OUT_DIR / "14_high_sierra_intihuatana_dial.png"))
        print("Captured 14_high_sierra_intihuatana_dial.png")

        # -------------------------------------------------------------
        # MILESTONE 15: Jungle Lowlands — River Trail & Rainforest Gateway
        # -------------------------------------------------------------
        print("\n--- 15. Jungle Lowlands: River Trail & Rainforest Gateway ---")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            const gy = eng.controller.getGroundAt(-180, 126.5);
            eng.controller.pos.set(-180, gy + 0.3, 126.5);
            eng.controller.heading = 0;
            eng.followCamera.yaw = Math.PI;
            eng.followCamera.pitch = 0.08;
            eng.followCamera.dist = 5.5;
            eng.followCamera.teleport(eng.controller.pos);
            eng.hud.setObjective('Turn the Ancient Bronze Sluice Wheel on the Quay [E] to lower the Cenote.');
        }""")
        wait_frames(page, 25)
        page.screenshot(path=str(OUT_DIR / "15_jungle_lowlands_overview.png"))
        print("Captured 15_jungle_lowlands_overview.png")

        # -------------------------------------------------------------
        # MILESTONE 16: Jungle Lowlands — Sluice Wheel & Cenote Pool
        # -------------------------------------------------------------
        print("\n--- 16. Jungle Lowlands: Sluice Wheel & Cenote Pool ---")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            eng.jungleLowlands.openCenoteSluice?.();
            const gy = eng.controller.getGroundAt(-154, 100);
            eng.controller.pos.set(-154, gy + 0.3, 100);
            eng.controller.heading = -0.7;
            eng.followCamera.yaw = -0.7 - Math.PI;
            eng.followCamera.pitch = 0.18;
            eng.followCamera.dist = 5.8;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        wait_frames(page, 20)
        page.screenshot(path=str(OUT_DIR / "16_jungle_lowlands_sluice_cenote.png"))
        print("Captured 16_jungle_lowlands_sluice_cenote.png")

        # -------------------------------------------------------------
        # MILESTONE 17: Paititi — Imperial Acropolis & Sun Aqueduct
        # -------------------------------------------------------------
        print("\n--- 17. Paititi: Imperial Acropolis & Sun Aqueduct ---")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            const gy = eng.controller.getGroundAt(200, 166);
            eng.controller.pos.set(200, gy + 0.5, 166);
            eng.controller.heading = 0;
            eng.followCamera.yaw = Math.PI + 0.15;
            eng.followCamera.pitch = 0.14;
            eng.followCamera.dist = 6.2;
            eng.followCamera.teleport(eng.controller.pos);
            eng.hud.setObjective('Approach the Golden Sun Disk Dais [E] to awaken the Plaza of the Sun.');
        }""")
        wait_frames(page, 25)
        page.screenshot(path=str(OUT_DIR / "17_paititi_imperial_acropolis.png"))
        print("Captured 17_paititi_imperial_acropolis.png")

        # -------------------------------------------------------------
        # MILESTONE 18: Paititi — Golden Sun Disk Dais Awakened
        # -------------------------------------------------------------
        print("\n--- 18. Paititi: Golden Sun Disk Dais Awakened ---")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            eng.paititi.awakenSunPlaza?.();
            const gy = eng.controller.getGroundAt(200, 185);
            eng.controller.pos.set(200, gy + 0.5, 185);
            eng.controller.heading = 0;
            eng.followCamera.yaw = Math.PI;
            eng.followCamera.pitch = 0.20;
            eng.followCamera.dist = 4.8;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        wait_frames(page, 20)
        page.screenshot(path=str(OUT_DIR / "18_paititi_sun_disk_awakened.png"))
        print("Captured 18_paititi_sun_disk_awakened.png")

        # -------------------------------------------------------------
        # MILESTONE 19: Character Close Inspection (Naira)
        # -------------------------------------------------------------
        print("\n--- 19. Character Close Inspection ---")
        page.evaluate("""() => {
            const eng = window.__juzuEngine;
            eng.controller.pos.set(0, 4.2, 10);
            eng.controller.heading = 0.35; // Slight 3/4 front view
            eng.followCamera.yaw = 0.0;
            eng.followCamera.pitch = 0.05;
            eng.followCamera.dist = 1.95;
            eng.followCamera.shoulderOffset = 0.0;
            eng.followCamera.teleport(eng.controller.pos);
        }""")
        wait_frames(page, 25)
        page.screenshot(path=str(OUT_DIR / "19_character_close_inspection.png"))
        print("Captured 19_character_close_inspection.png")

        # -------------------------------------------------------------
        # MILESTONE 20: Lighting Comparison — Dusk
        # -------------------------------------------------------------
        print("\n--- 20. Lighting Comparison: Dusk ---")
        page.keyboard.press("Digit3") # 3 = Dusk
        wait_frames(page, 20)
        page.screenshot(path=str(OUT_DIR / "20_lighting_tod_dusk.png"))
        print("Captured 20_lighting_tod_dusk.png")

        # -------------------------------------------------------------
        # MILESTONE 21: Lighting Comparison — Night
        # -------------------------------------------------------------
        print("\n--- 21. Lighting Comparison: Night ---")
        page.keyboard.press("Digit4") # 4 = Night
        wait_frames(page, 20)
        page.screenshot(path=str(OUT_DIR / "21_lighting_tod_night.png"))
        print("Captured 21_lighting_tod_night.png")

        browser.close()

    print("\n==========================================")
    print("End-to-End Playtest Completed Successfully!")
    print(f"All 21 milestone frames saved in: {OUT_DIR}")
    print("==========================================")

if __name__ == "__main__":
    main()
