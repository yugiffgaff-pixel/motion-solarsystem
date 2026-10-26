import { BODY_BY_ID } from "../src/ephemeris/catalog";
import { bodyState, orbitPath, osculating } from "../src/ephemeris/positions";
import {
  formatJd,
  gregorianToJd,
  inPublishedPlanetRange,
  jdToCivil,
  J2000_JD,
  RANGE_END_JD,
  RANGE_START_JD,
} from "../src/ephemeris/time";
import { KM_PER_AU, len } from "../src/ephemeris/vec";

let failed = 0;

function check(name: string, ok: boolean, detail: string): void {
  if (ok) {
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}: ${detail}`);
}

function roundTrip(year: number, month: number, day: number): void {
  const jd = gregorianToJd(year, month, day);
  const civil = jdToCivil(jd);
  const back = gregorianToJd(civil.year, civil.month, civil.day + civil.dayFraction);
  check(
    `round-trip ${year}-${month}-${day}`,
    civil.year === year && civil.month === month && civil.day === day && Math.abs(back - jd) < 1e-6,
    `got ${civil.year}-${civil.month}-${civil.day} fraction ${civil.dayFraction} jd ${jd} back ${back}`,
  );
}

roundTrip(2000, 1, 1);
roundTrip(1582, 10, 15);
roundTrip(-9999, 1, 1);
roundTrip(10000, 1, 1);
roundTrip(-2999, 6, 15);
roundTrip(0, 3, 1);
roundTrip(-1, 12, 31);
roundTrip(2026, 10, 26);
roundTrip(1900, 3, 1);

check("J2000 noon", Math.abs(gregorianToJd(2000, 1, 1.5) - J2000_JD) < 1e-6, String(gregorianToJd(2000, 1, 1.5)));
check(
  "Gregorian 1582-10-15",
  Math.abs(gregorianToJd(1582, 10, 15) - 2299160.5) < 1e-6,
  String(gregorianToJd(1582, 10, 15)),
);
check("range start label", formatJd(RANGE_START_JD, false) === "公元前10000年1月1日", formatJd(RANGE_START_JD, false));
check("range end label", formatJd(RANGE_END_JD, false) === "公元10000年1月1日", formatJd(RANGE_END_JD, false));
// Proleptic Gregorian drops century leap days, so 20,000 calendar years are a few hundred days short of 20000 × 365.25.
check(
  "span about 20000 years",
  Math.abs(RANGE_END_JD - RANGE_START_JD - 20000 * 365.25) < 800,
  String(RANGE_END_JD - RANGE_START_JD),
);
check("published window includes year -2999", inPublishedPlanetRange(gregorianToJd(-2999, 6, 1)), "");
check("published window excludes year -3000", !inPublishedPlanetRange(gregorianToJd(-3000, 6, 1)), "");
check("published window includes year 3000", inPublishedPlanetRange(gregorianToJd(3000, 6, 1)), "");
check("published window excludes year 3001", !inPublishedPlanetRange(gregorianToJd(3001, 1, 2)), "");

const emb = bodyState("earth", J2000_JD);
console.log(
  `earth@J2000 r=${emb.distanceAu.toFixed(5)} AU lon=${emb.lonDeg.toFixed(3)} lat=${emb.latDeg.toFixed(4)}`,
);
check("earth distance near perihelion", emb.distanceAu > 0.978 && emb.distanceAu < 0.99, emb.distanceAu.toFixed(5));
check("earth longitude near 100.5°", emb.lonDeg > 99 && emb.lonDeg < 102.5, emb.lonDeg.toFixed(3));
check("earth latitude near 0", Math.abs(emb.latDeg) < 0.05, emb.latDeg.toFixed(4));

const moon = bodyState("moon", J2000_JD);
const moonKm = moon.relativeKm ?? 0;
console.log(`moon@J2000 distance ${moonKm.toFixed(0)} km`);
check("moon distance", moonKm > 355000 && moonKm < 415000, moonKm.toFixed(0));
const offsetKm = (moon.relativeKm ?? 0) / (81.300568 + 1);
check("barycenter offset", offsetKm > 4400 && offsetKm < 5000, offsetKm.toFixed(1));

const samples = [
  gregorianToJd(-9999, 1, 1),
  gregorianToJd(-2999, 1, 1),
  J2000_JD,
  gregorianToJd(2026, 10, 26),
  gregorianToJd(3000, 1, 1),
  gregorianToJd(10000, 1, 1),
];

const bounds: Record<string, [number, number]> = {
  mercury: [0.25, 0.55],
  venus: [0.65, 0.8],
  earth: [0.95, 1.06],
  mars: [1.3, 1.75],
  jupiter: [4.8, 5.6],
  saturn: [8.8, 10.4],
  uranus: [17.5, 21],
  neptune: [29.2, 31.2],
  ceres: [2.4, 3.1],
  pluto: [29, 50],
  haumea: [34, 52],
  makemake: [37, 54],
  eris: [37, 99],
};

for (const jd of samples) {
  const label = formatJd(jd, false);
  for (const [id, [lo, hi]] of Object.entries(bounds)) {
    const state = bodyState(id, jd);
    const osc = osculating(id, jd);
    const finite = Number.isFinite(state.distanceAu) && state.eclipticAu.x === state.eclipticAu.x;
    check(
      `${id} @ ${label}`,
      finite && state.distanceAu >= lo && state.distanceAu <= hi && !!osc && osc.e > 0 && osc.e < 0.8,
      `r=${state.distanceAu} e=${osc?.e}`,
    );
  }
  const moonState = bodyState("moon", jd);
  check(
    `moon @ ${label}`,
    (moonState.relativeKm ?? 0) > 350000 && (moonState.relativeKm ?? 0) < 420000,
    String(moonState.relativeKm),
  );
}

function maxAbsZ(id: string, jd: number): number {
  const path = orbitPath(id, jd);
  if (!path) return 0;
  return Math.max(...path.points.map((point) => Math.abs(point.z))) * KM_PER_AU;
}

const ioZ = maxAbsZ("io", J2000_JD);
console.log(`io orbit max |z| ${ioZ.toFixed(0)} km`);
check("io tilted off the ecliptic", ioZ > 15000 && ioZ < 80000, ioZ.toFixed(0));
const titanZ = maxAbsZ("titan", J2000_JD);
console.log(`titan orbit max |z| ${titanZ.toFixed(0)} km`);
check("titan follows Saturn's tilt", titanZ > 350000 && titanZ < 800000, titanZ.toFixed(0));

const io = bodyState("io", J2000_JD);
check("io distance", (io.relativeKm ?? 0) > 415000 && (io.relativeKm ?? 0) < 428000, String(io.relativeKm));

const earthPath = orbitPath("earth", J2000_JD)!;
const onPath = earthPath.points.reduce((best, point) => {
  const d = len({
    x: point.x - emb.eclipticAu.x,
    y: point.y - emb.eclipticAu.y,
    z: point.z - emb.eclipticAu.z,
  });
  return Math.min(best, d);
}, Infinity);
// 220 samples around 1 AU leave about 0.014 AU between neighbors.
check("earth sits on its orbit curve", onPath < 0.02, onPath.toFixed(5));

for (const body of BODY_BY_ID.values()) {
  if (body.id === "sun") continue;
  const path = orbitPath(body.id, J2000_JD);
  check(`${body.id} orbit`, !!path && path.points.length > 10 && path.points.every((p) => Number.isFinite(p.x)), "");
}

if (failed > 0) {
  throw new Error(`${failed} checks failed`);
}
console.log("all checks passed");
