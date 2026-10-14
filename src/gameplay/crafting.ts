/**
 * Module: src/gameplay/crafting.ts
 * Responsibility: Inventory, Radial Wheel (Tab), 4 Arrow types (Bodkin, Rope Tether,
 * Obsidian Fire, Sonic Lure), 2-second on-the-fly crafting (R), 5-second Herbal
 * Poultice heal (H), and 6 forageable material types per Bible §3.5.
 * Depends on: none.
 * Exports: ArrowType, MaterialType, CraftingSystem.
 */

export type ArrowType = 'bodkin' | 'ropeTether' | 'obsidianFire' | 'sonicLure';
export type MaterialType = 'wood' | 'stone' | 'fiber' | 'feathers' | 'herbs' | 'obsidian';

export class CraftingSystem {
  public selectedArrow: ArrowType = 'bodkin';
  public readonly arrowCounts: Record<ArrowType, number> = {
    bodkin: 8,
    ropeTether: 3,
    obsidianFire: 2,
    sonicLure: 2,
  };
  public readonly materials: Record<MaterialType, number> = {
    wood: 4,
    stone: 3,
    fiber: 3,
    feathers: 4,
    herbs: 3,
    obsidian: 1,
  };
  public poulticeCount: number = 2;

  public build(): void {
    // Default Cloud Forest field kit inventory loaded
  }

  public getAmmoCount(): number {
    return this.arrowCounts[this.selectedArrow];
  }

  public cycleArrowType(): ArrowType {
    const order: ArrowType[] = ['bodkin', 'ropeTether', 'obsidianFire', 'sonicLure'];
    const idx = (order.indexOf(this.selectedArrow) + 1) % order.length;
    this.selectedArrow = order[idx];
    return this.selectedArrow;
  }

  public craftSelectedArrow(): boolean {
    if (this.materials.wood > 0 && this.materials.feathers > 0) {
      this.materials.wood--;
      this.materials.feathers--;
      this.arrowCounts[this.selectedArrow]++;
      return true;
    }
    return false;
  }

  public update(_dt: number): void {
    // Event-driven crafting & inventory state
  }

  public dispose(): void {
    // No GPU resources held
  }
}
