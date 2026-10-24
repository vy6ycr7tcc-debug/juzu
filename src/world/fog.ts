import * as THREE from 'three/webgpu';

export type TimeOfDay = 'day' | 'dawn' | 'noon' | 'dusk' | 'night';

export interface ToDConfig {
  zenithColor: string;
  sunColor: string;
  sunIntensity: number;
  sunElevation: number; // degrees
  sunAzimuth: number; // degrees
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  fogColor: string;
  fogDensity: number;
  fogFalloff: number;
  exposure: number;
  turbidity: number;
  rayleigh: number;
}

export const TOD_PRESETS: Record<TimeOfDay, ToDConfig> = {
  day: {
    zenithColor: '#1b3f78',
    sunColor: '#FFF0D4',
    sunIntensity: 4.8,
    sunElevation: 31,
    sunAzimuth: 138,
    hemiSky: '#6C94BC',
    hemiGround: '#3E382C',
    hemiIntensity: 0.48,
    fogColor: '#8CB2DC',
    fogDensity: 0.0020,
    fogFalloff: 0.010,
    exposure: 1.06,
    turbidity: 9,
    rayleigh: 2.2,
  },
  dawn: {
    zenithColor: '#1f3156',
    sunColor: '#FFA640',
    sunIntensity: 2.6,
    sunElevation: 9,
    sunAzimuth: 95,
    hemiSky: '#D8C4B0',
    hemiGround: '#4A4038',
    hemiIntensity: 0.35,
    fogColor: '#CFA88E',
    fogDensity: 0.0020,
    fogFalloff: 0.012,
    exposure: 1.02,
    turbidity: 12,
    rayleigh: 2.5,
  },
  noon: {
    zenithColor: '#173d78',
    sunColor: '#FFFFFF',
    sunIntensity: 5.2,
    sunElevation: 76,
    sunAzimuth: 180,
    hemiSky: '#C8DCF5',
    hemiGround: '#6A6A55',
    hemiIntensity: 0.65,
    fogColor: '#9BC0FF',
    fogDensity: 0.0010,
    fogFalloff: 0.006,
    exposure: 1.12,
    turbidity: 8,
    rayleigh: 3.0,
  },
  dusk: {
    zenithColor: '#1a2442',
    sunColor: '#FF8824',
    sunIntensity: 2.4,
    sunElevation: 8,
    sunAzimuth: 265,
    hemiSky: '#C4A490',
    hemiGround: '#423A30',
    hemiIntensity: 0.32,
    fogColor: '#B8886C',
    fogDensity: 0.0020,
    fogFalloff: 0.012,
    exposure: 1.0,
    turbidity: 12,
    rayleigh: 2.5,
  },
  night: {
    zenithColor: '#040812',
    sunColor: '#8CAEE0',
    sunIntensity: 1.05,
    sunElevation: 32,
    sunAzimuth: 140,
    hemiSky: '#2E4468',
    hemiGround: '#181E24',
    hemiIntensity: 0.34,
    fogColor: '#101A2C',
    fogDensity: 0.0022,
    fogFalloff: 0.012,
    exposure: 0.95,
    turbidity: 10,
    rayleigh: 1.0,
  },
};

export let activeToD: TimeOfDay = 'day';

export function calculateSunDirection(elevationDeg: number, azimuthDeg: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
  const theta = THREE.MathUtils.degToRad(azimuthDeg);
  return new THREE.Vector3(
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.cos(theta)
  ).normalize();
}

export function sunDirection(tod: TimeOfDay = activeToD): THREE.Vector3 {
  const cfg = TOD_PRESETS[tod] || TOD_PRESETS.day;
  return calculateSunDirection(cfg.sunElevation, cfg.sunAzimuth);
}

export const FOG = {
  get color(): THREE.Color {
    return new THREE.Color(TOD_PRESETS[activeToD].fogColor);
  },
  get sun(): THREE.Color {
    return new THREE.Color(TOD_PRESETS[activeToD].sunColor);
  },
  get density(): number {
    return TOD_PRESETS[activeToD].fogDensity;
  },
  get falloff(): number {
    return TOD_PRESETS[activeToD].fogFalloff;
  },
};

export function setTimeOfDay(tod: TimeOfDay): void {
  if (TOD_PRESETS[tod]) {
    activeToD = tod;
  }
}
