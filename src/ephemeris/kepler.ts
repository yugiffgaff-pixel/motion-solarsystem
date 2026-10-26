import type { Vec3 } from "./vec";

/** Position in the reference plane, X toward the ascending node of that plane. */
export function keplerPosition(
  a: number,
  eIn: number,
  iDeg: number,
  argDeg: number,
  nodeDeg: number,
  meanAnomalyDeg: number,
): Vec3 {
  const e = Math.min(0.95, Math.max(0, eIn));
  const M = (meanAnomalyDeg * Math.PI) / 180;
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 20; k += 1) {
    const dE = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  const xOrb = a * (Math.cos(E) - e);
  const yOrb = a * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E);
  const i = (iDeg * Math.PI) / 180;
  const w = (argDeg * Math.PI) / 180;
  const O = (nodeDeg * Math.PI) / 180;
  const cosw = Math.cos(w);
  const sinw = Math.sin(w);
  const cosO = Math.cos(O);
  const sinO = Math.sin(O);
  const cosi = Math.cos(i);
  const sini = Math.sin(i);
  return {
    x: (cosw * cosO - sinw * sinO * cosi) * xOrb + (-sinw * cosO - cosw * sinO * cosi) * yOrb,
    y: (cosw * sinO + sinw * cosO * cosi) * xOrb + (-sinw * sinO + cosw * cosO * cosi) * yOrb,
    z: sinw * sini * xOrb + cosw * sini * yOrb,
  };
}
