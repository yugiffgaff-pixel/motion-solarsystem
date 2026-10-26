import { keplerPosition } from "./kepler";
import { BODY_BY_ID } from "./catalog";
import { centuriesSinceJ2000, J2000_JD } from "./time";
import {
  equatorialToEcliptic,
  KM_PER_AU,
  laplaceToEquatorial,
  len,
  lonLat,
  scale,
  sub,
  add,
  type Vec3,
} from "./vec";

type Extra = { b: number; c: number; s: number; f: number };

type PlanetEl = {
  id: string;
  a0: number;
  ad: number;
  e0: number;
  ed: number;
  I0: number;
  Id: number;
  L0: number;
  Ld: number;
  w0: number;
  wd: number;
  O0: number;
  Od: number;
  extra?: Extra;
};

/** JPL approximate elements, 3000 BC–3000 AD (table 2a / 2b). Rates are per Julian century. */
const PLANETS: PlanetEl[] = [
  {
    id: "mercury",
    a0: 0.38709843,
    ad: 0,
    e0: 0.20563661,
    ed: 0.00002123,
    I0: 7.00559432,
    Id: -0.00590158,
    L0: 252.25166724,
    Ld: 149472.67486623,
    w0: 77.45771895,
    wd: 0.15940013,
    O0: 48.33961819,
    Od: -0.12214182,
  },
  {
    id: "venus",
    a0: 0.72332102,
    ad: -0.00000026,
    e0: 0.00676399,
    ed: -0.00005107,
    I0: 3.39777545,
    Id: 0.00043494,
    L0: 181.9797085,
    Ld: 58517.8156026,
    w0: 131.76755713,
    wd: 0.05679648,
    O0: 76.67261496,
    Od: -0.27274174,
  },
  {
    id: "emb",
    a0: 1.00000018,
    ad: -0.00000003,
    e0: 0.01673163,
    ed: -0.00003661,
    I0: -0.00054346,
    Id: -0.01337178,
    L0: 100.46691572,
    Ld: 35999.37306329,
    w0: 102.93005885,
    wd: 0.3179526,
    O0: -5.11260389,
    Od: -0.24123856,
  },
  {
    id: "mars",
    a0: 1.52371243,
    ad: 0.00000097,
    e0: 0.09336511,
    ed: 0.00009149,
    I0: 1.85181869,
    Id: -0.00724757,
    L0: -4.56813164,
    Ld: 19140.29934243,
    w0: -23.91744784,
    wd: 0.45223625,
    O0: 49.71320984,
    Od: -0.26852431,
  },
  {
    id: "jupiter",
    a0: 5.20248019,
    ad: -0.00002864,
    e0: 0.0485359,
    ed: 0.00018026,
    I0: 1.29861416,
    Id: -0.00322699,
    L0: 34.33479152,
    Ld: 3034.90371757,
    w0: 14.27495244,
    wd: 0.18199196,
    O0: 100.29282654,
    Od: 0.13024619,
    extra: { b: -0.00012452, c: 0.0606406, s: -0.35635438, f: 38.35125 },
  },
  {
    id: "saturn",
    a0: 9.54149883,
    ad: -0.00003065,
    e0: 0.05550825,
    ed: -0.00032044,
    I0: 2.49424102,
    Id: 0.00451969,
    L0: 50.07571329,
    Ld: 1222.11494724,
    w0: 92.86136063,
    wd: 0.54179478,
    O0: 113.63998702,
    Od: -0.25015002,
    extra: { b: 0.00025899, c: -0.13434469, s: 0.87320147, f: 38.35125 },
  },
  {
    id: "uranus",
    a0: 19.18797948,
    ad: -0.00020455,
    e0: 0.0468574,
    ed: -0.0000155,
    I0: 0.77298127,
    Id: -0.00180155,
    L0: 314.20276625,
    Ld: 428.49512595,
    w0: 172.43404441,
    wd: 0.09266985,
    O0: 73.96250215,
    Od: 0.05739699,
    extra: { b: 0.00058331, c: -0.97731848, s: 0.17689245, f: 7.67025 },
  },
  {
    id: "neptune",
    a0: 30.06952752,
    ad: 0.00006447,
    e0: 0.00895439,
    ed: 0.00000818,
    I0: 1.7700552,
    Id: 0.000224,
    L0: 304.22289287,
    Ld: 218.46515314,
    w0: 46.68158724,
    wd: 0.01009938,
    O0: 131.78635853,
    Od: -0.00606302,
    extra: { b: -0.00041348, c: 0.68346318, s: -0.10162547, f: 7.67025 },
  },
];

const PLANET_BY_ID = new Map(PLANETS.map((planet) => [planet.id, planet]));

type SatEl = {
  id: string;
  aKm: number;
  e: number;
  argDeg: number;
  Mdeg: number;
  iDeg: number;
  nodeDeg: number;
  periodDays: number;
  pApsisYears: number;
  pNodeYears: number;
  frame: "ecliptic" | "laplace";
  poleRa: number;
  poleDec: number;
};

/** JPL planetary satellite mean elements, epoch 2000-01-01.5 TDB. */
const SATS: SatEl[] = [
  {
    id: "moon",
    aKm: 384400,
    e: 0.0554,
    argDeg: 318.15,
    Mdeg: 135.27,
    iDeg: 5.16,
    nodeDeg: 125.08,
    periodDays: 27.322,
    pApsisYears: 5.997,
    pNodeYears: 18.6,
    frame: "ecliptic",
    poleRa: 0,
    poleDec: 0,
  },
  {
    id: "io",
    aKm: 421800,
    e: 0.004,
    argDeg: 49.1,
    Mdeg: 330.9,
    iDeg: 0,
    nodeDeg: 0,
    periodDays: 1.762732,
    pApsisYears: 1.333,
    pNodeYears: 0,
    frame: "laplace",
    poleRa: 268.1,
    poleDec: 64.5,
  },
  {
    id: "europa",
    aKm: 671100,
    e: 0.009,
    argDeg: 45,
    Mdeg: 345.4,
    iDeg: 0.5,
    nodeDeg: 184,
    periodDays: 3.525463,
    pApsisYears: 1.394,
    pNodeYears: 30.202,
    frame: "laplace",
    poleRa: 268.1,
    poleDec: 64.5,
  },
  {
    id: "ganymede",
    aKm: 1070400,
    e: 0.001,
    argDeg: 198.3,
    Mdeg: 324.8,
    iDeg: 0.2,
    nodeDeg: 58.5,
    periodDays: 7.155588,
    pApsisYears: 68.301,
    pNodeYears: 137.812,
    frame: "laplace",
    poleRa: 268.2,
    poleDec: 64.6,
  },
  {
    id: "callisto",
    aKm: 1882700,
    e: 0.007,
    argDeg: 43.8,
    Mdeg: 87.4,
    iDeg: 0.3,
    nodeDeg: 309.1,
    periodDays: 16.69044,
    pApsisYears: 277.921,
    pNodeYears: 577.264,
    frame: "laplace",
    poleRa: 268.7,
    poleDec: 64.8,
  },
  {
    id: "titan",
    aKm: 1221900,
    e: 0.029,
    argDeg: 78.3,
    Mdeg: 11.7,
    iDeg: 0.3,
    nodeDeg: 78.6,
    periodDays: 15.945448,
    pApsisYears: 346.68,
    pNodeYears: 687.37,
    frame: "laplace",
    poleRa: 36.4,
    poleDec: 84,
  },
];

const SAT_BY_ID = new Map(SATS.map((sat) => [sat.id, sat]));

/** Farthest a satellite of this body gets, in kilometres. 0 if it has none. */
export function maxChildApsisKm(parentId: string): number {
  let max = 0;
  for (const sat of SATS) {
    if (BODY_BY_ID.get(sat.id)?.parentId !== parentId) continue;
    max = Math.max(max, sat.aKm * (1 + sat.e));
  }
  return max;
}

type DwarfEl = {
  id: string;
  epochJd: number;
  a: number;
  e: number;
  i: number;
  om: number;
  w: number;
  M: number;
  n: number;
};

/** Osculating elements from the JPL Small-Body Database, ecliptic J2000. */
const DWARFS: DwarfEl[] = [
  {
    id: "ceres",
    epochJd: 2461200.5,
    a: 2.765552595034094,
    e: 0.07969229514816586,
    i: 10.58802780183462,
    om: 80.24862682043221,
    w: 73.29421453021587,
    M: 274.4193463761342,
    n: 0.21430445064843,
  },
  {
    id: "pluto",
    epochJd: 2457588.5,
    a: 39.58862938517124,
    e: 0.2518378778576892,
    i: 17.14771140999114,
    om: 110.2923840543057,
    w: 113.7090015158565,
    M: 38.68366347318184,
    n: 0.003956838955553025,
  },
  {
    id: "haumea",
    epochJd: 2461200.5,
    a: 43.06029023650952,
    e: 0.1944430148898797,
    i: 28.20847393040364,
    om: 121.7860561329425,
    w: 240.6905472508661,
    M: 223.2104118812299,
    n: 0.003488097731816818,
  },
  {
    id: "makemake",
    epochJd: 2461200.5,
    a: 45.57093317300052,
    e: 0.1588889953992523,
    i: 29.02785603743067,
    om: 79.2948338209406,
    w: 297.0922733397207,
    M: 169.9379962048232,
    n: 0.003203850120050116,
  },
  {
    id: "eris",
    epochJd: 2461200.5,
    a: 67.93394687853566,
    e: 0.4382385347971672,
    i: 43.9258279471791,
    om: 36.00477044417249,
    w: 150.7949235840312,
    M: 211.774434275007,
    n: 0.001760247770619088,
  },
];

const DWARF_BY_ID = new Map(DWARFS.map((dwarf) => [dwarf.id, dwarf]));

/** Mm / (Me + Mm), from the IAU Earth/Moon mass ratio 81.300568. */
const MOON_MASS_FRACTION = 1 / (81.300568 + 1);

export type BodyState = {
  id: string;
  eclipticAu: Vec3;
  distanceAu: number;
  lonDeg: number;
  latDeg: number;
  /** Offset from the parent, ecliptic AU. Null for heliocentric bodies. */
  relativeAu: Vec3 | null;
  relativeKm: number | null;
};

export type OrbitPath = {
  space: "heliocentric" | "parent";
  parentId?: string;
  points: Vec3[];
};

function planetVector(el: PlanetEl, jd: number, meanAnomalyDeg?: number): Vec3 {
  const T = centuriesSinceJ2000(jd);
  const a = el.a0 + el.ad * T;
  const e = el.e0 + el.ed * T;
  const I = el.I0 + el.Id * T;
  const wbar = el.w0 + el.wd * T;
  const Om = el.O0 + el.Od * T;
  const arg = wbar - Om;
  let M = meanAnomalyDeg;
  if (M === undefined) {
    M = el.L0 + el.Ld * T - wbar;
    if (el.extra) {
      const rad = ((el.extra.f * T) * Math.PI) / 180;
      M += el.extra.b * T * T + el.extra.c * Math.cos(rad) + el.extra.s * Math.sin(rad);
    }
  }
  return keplerPosition(a, e, I, arg, Om, M);
}

function satelliteVector(el: SatEl, jd: number, meanAnomalyDeg?: number): Vec3 {
  const days = jd - J2000_JD;
  const dNode = el.pNodeYears > 0 ? -360 / (el.pNodeYears * 365.25) : 0;
  const dArg = el.pApsisYears > 0 ? 360 / (el.pApsisYears * 365.25) : 0;
  const dM = 360 / el.periodDays - dArg - dNode;
  const node = el.nodeDeg + dNode * days;
  const arg = el.argDeg + dArg * days;
  const M = meanAnomalyDeg ?? el.Mdeg + dM * days;
  const local = keplerPosition(el.aKm / KM_PER_AU, el.e, el.iDeg, arg, node, M);
  if (el.frame === "ecliptic") return local;
  return equatorialToEcliptic(laplaceToEquatorial(local, el.poleRa, el.poleDec));
}

function dwarfVector(el: DwarfEl, jd: number, meanAnomalyDeg?: number): Vec3 {
  const M = meanAnomalyDeg ?? el.M + el.n * (jd - el.epochJd);
  return keplerPosition(el.a, el.e, el.i, el.w, el.om, M);
}

function stateFrom(id: string, eclipticAu: Vec3, relativeAu: Vec3 | null): BodyState {
  const sph = lonLat(eclipticAu);
  return {
    id,
    eclipticAu,
    distanceAu: sph.r,
    lonDeg: sph.lonDeg,
    latDeg: sph.latDeg,
    relativeAu,
    relativeKm: relativeAu ? len(relativeAu) * KM_PER_AU : null,
  };
}

export function bodyState(id: string, jd: number): BodyState {
  if (id === "sun") return stateFrom(id, { x: 0, y: 0, z: 0 }, null);
  if (id === "earth" || id === "moon") {
    const emb = planetVector(PLANET_BY_ID.get("emb")!, jd);
    const moonRel = satelliteVector(SAT_BY_ID.get("moon")!, jd);
    const earth = sub(emb, scale(moonRel, MOON_MASS_FRACTION));
    if (id === "earth") return stateFrom(id, earth, null);
    return stateFrom(id, add(earth, moonRel), moonRel);
  }
  const planet = PLANET_BY_ID.get(id);
  if (planet) return stateFrom(id, planetVector(planet, jd), null);
  const dwarf = DWARF_BY_ID.get(id);
  if (dwarf) return stateFrom(id, dwarfVector(dwarf, jd), null);
  const sat = SAT_BY_ID.get(id);
  if (sat) {
    const parentId = BODY_BY_ID.get(id)?.parentId;
    if (!parentId) throw new Error(`Satellite ${id} has no parent`);
    const parent = bodyState(parentId, jd);
    const rel = satelliteVector(sat, jd);
    return stateFrom(id, add(parent.eclipticAu, rel), rel);
  }
  throw new Error(`Unknown body ${id}`);
}

function sampleEllipse(count: number, at: (meanAnomalyDeg: number) => Vec3): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i <= count; i += 1) points.push(at((i / count) * 360));
  return points;
}

export function orbitPath(id: string, jd: number): OrbitPath | null {
  if (id === "sun") return null;
  if (id === "earth") {
    return {
      space: "heliocentric",
      points: sampleEllipse(220, (M) => planetVector(PLANET_BY_ID.get("emb")!, jd, M)),
    };
  }
  if (id === "moon") {
    return {
      space: "parent",
      parentId: "earth",
      points: sampleEllipse(120, (M) => satelliteVector(SAT_BY_ID.get("moon")!, jd, M)),
    };
  }
  const planet = PLANET_BY_ID.get(id);
  if (planet) {
    return { space: "heliocentric", points: sampleEllipse(220, (M) => planetVector(planet, jd, M)) };
  }
  const dwarf = DWARF_BY_ID.get(id);
  if (dwarf) {
    return { space: "heliocentric", points: sampleEllipse(220, (M) => dwarfVector(dwarf, jd, M)) };
  }
  const sat = SAT_BY_ID.get(id);
  if (sat) {
    return {
      space: "parent",
      parentId: BODY_BY_ID.get(id)?.parentId,
      points: sampleEllipse(100, (M) => satelliteVector(sat, jd, M)),
    };
  }
  return null;
}

export function osculating(id: string, jd: number): { a: number; e: number; i: number } | null {
  const planetId = id === "earth" ? "emb" : id;
  const planet = PLANET_BY_ID.get(planetId);
  if (planet) {
    const T = centuriesSinceJ2000(jd);
    return { a: planet.a0 + planet.ad * T, e: planet.e0 + planet.ed * T, i: planet.I0 + planet.Id * T };
  }
  const dwarf = DWARF_BY_ID.get(id);
  if (dwarf) return { a: dwarf.a, e: dwarf.e, i: dwarf.i };
  const sat = SAT_BY_ID.get(id);
  if (sat) return { a: sat.aKm / KM_PER_AU, e: sat.e, i: sat.iDeg };
  return null;
}
