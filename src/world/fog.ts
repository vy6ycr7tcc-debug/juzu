import * as THREE from 'three/webgpu';

export type TimeOfDay = 'day' | 'dawn' | 'noon' | 'dusk' | 'night';

export interface ToDConfig {
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
    sunColor: '#FFF4E5',
    sunIntensity: 4.5,
    sunElevation: 25,
    sunAzimuth: 135,
    hemiSky: '#BDD3F0',
    hemiGround: '#5A5A48',
    hemiIntensity: 0.5,
    fogColor: '#87B5FF',
    fogDensity: 0.0012,
    fogFalloff: 0.008,
    exposure: 1.1,
    turbidity: 10,
    rayleigh: 2.0,
  },
  dawn: {
    sunColor: '#FFA500',
    sunIntensity: 2.2,
    sunElevation: 6,
    sunAzimuth: 90,
    hemiSky: '#D8C4B0',
    hemiGround: '#4A4038',
    hemiIntensity: 0.25,
    fogColor: '#D0B49F',
    fogDensity: 0.0022,
    fogFalloff: 0.012,
    exposure: 1.0,
    turbidity: 12,
    rayleigh: 2.5,
  },
  noon: {
    sunColor: '#FFFFFF',
    sunIntensity: 5.5,
    sunElevation: 82,
    sunAzimuth: 180,
    hemiSky: '#C8DCF5',
    hemiGround: '#6A6A55',
    hemiIntensity: 0.65,
    fogColor: '#9BC0FF',
    fogDensity: 0.0011,
    fogFalloff: 0.006,
    exposure: 1.15,
    turbidity: 8,
    rayleigh: 3.0,
  },
  dusk: {
    sunColor: '#FF8C00',
    sunIntensity: 2.0,
    sunElevation: 6,
    sunAzimuth: 270,
    hemiSky: '#C4A490',
    hemiGround: '#423A30',
    hemiIntensity: 0.25,
    fogColor: '#B28C70',
    fogDensity: 0.0022,
    fogFalloff: 0.012,
    exposure: 1.0,
    turbidity: 12,
    rayleigh: 2.5,
  },
  night: {
    sunColor: '#9FB8DD',
    sunIntensity: 0.5,
    sunElevation: 35,
    sunAzimuth: 135,
    hemiSky: '#2A3A55',
    hemiGround: '#1A1A18',
    hemiIntensity: 0.15,
    fogColor: '#1E2A3A',
    fogDensity: 0.0028,
    fogFalloff: 0.014,
    exposure: 0.85,
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
