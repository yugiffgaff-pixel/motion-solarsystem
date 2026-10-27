export type Vec3 = { x: number; y: number; z: number };

export const KM_PER_AU = 149597870.7;
/** Mean obliquity of the ecliptic at J2000, degrees. */
export const OBLIQUITY_J2000_DEG = 23.4392911;

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function len(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function equatorialToEcliptic(v: Vec3): Vec3 {
  const e = (OBLIQUITY_J2000_DEG * Math.PI) / 180;
  const c = Math.cos(e);
  const s = Math.sin(e);
  return { x: v.x, y: c * v.y + s * v.z, z: -s * v.y + c * v.z };
}

/** Scene is Y-up. The ecliptic is the XZ plane, ecliptic north is +Y. */
export function eclipticToScene(v: Vec3): Vec3 {
  return { x: v.x, y: v.z, z: -v.y };
}

export function lonLat(v: Vec3): { lonDeg: number; latDeg: number; r: number } {
  const r = len(v);
  const lon = (Math.atan2(v.y, v.x) * 180) / Math.PI;
  const lat = (Math.asin(Math.max(-1, Math.min(1, v.z / (r || 1)))) * 180) / Math.PI;
  return { lonDeg: (lon + 360) % 360, latDeg: lat, r };
}

/**
 * Vector in the Laplace-plane frame (X toward that plane's ascending node on
 * the ICRF equator, Z toward the Laplace pole) → ICRF equatorial.
 */
export function laplaceToEquatorial(local: Vec3, raDeg: number, decDeg: number): Vec3 {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const X = { x: -Math.sin(ra), y: Math.cos(ra), z: 0 };
  const Z = {
    x: Math.cos(dec) * Math.cos(ra),
    y: Math.cos(dec) * Math.sin(ra),
    z: Math.sin(dec),
  };
  const Y = {
    x: Z.y * X.z - Z.z * X.y,
    y: Z.z * X.x - Z.x * X.z,
    z: Z.x * X.y - Z.y * X.x,
  };
  return {
    x: local.x * X.x + local.y * Y.x + local.z * Z.x,
    y: local.x * X.y + local.y * Y.y + local.z * Z.y,
    z: local.x * X.z + local.y * Y.z + local.z * Z.z,
  };
}

export function poleEquatorial(raDeg: number, decDeg: number): Vec3 {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return {
    x: Math.cos(dec) * Math.cos(ra),
    y: Math.cos(dec) * Math.sin(ra),
    z: Math.sin(dec),
  };
}
