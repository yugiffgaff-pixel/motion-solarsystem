import { KM_PER_AU } from "./vec";

export type BodyGroup = "star" | "planet" | "moon" | "dwarf";

export type BodyInfo = {
  id: string;
  name: string;
  group: BodyGroup;
  parentId?: string;
  /** Volumetric mean radius, km. Shown in the readout. */
  radiusKm: number;
  /** Equatorial radius used for the mesh, km. */
  equatorialKm: number;
  polarKm: number;
  /** Optional triaxial radii, local Y is the short axis. */
  triaxialKm?: { x: number; y: number; z: number };
  /**
   * Largest displayed equatorial radius. Keeps a real-distance moon
   * outside the mesh, and keeps the Sun inside Mercury's perihelion.
   */
  capRadiusKm?: number;
  color: string;
  texture?: string;
  clouds?: string;
  ring?: { innerRe: number; outerRe: number; texture: string };
  procedural?: { base: string; mottling: string; seed: number };
  /** IAU north pole, ICRF right ascension and declination, degrees. */
  pole?: { ra: number; dec: number };
  spinDegPerDay: number;
  periodDays: number;
  /** How far the camera may be and still show this moon's label, AU. */
  labelReachAu?: number;
  summary: string;
};

const PLANET =
  "八大行星用 NASA JPL 公布的开普勒根数（相对 J2000 平黄道，3000 BC–3000 AD 那一组，木星到海王星另加表 2b 的周期修正）。";
const SAT =
  "卫星用 JPL 行星卫星平根数（历元 2000-01-01.5 TDB）。伽利略卫星和土卫六在拉普拉斯平面上，再转到 J2000 黄道。这是轨道形状的拟合，不是完整数值星历。";

export const BODIES: BodyInfo[] = [
  {
    id: "sun",
    name: "太阳",
    group: "star",
    radiusKm: 695700,
    equatorialKm: 695700,
    polarKm: 695700,
    capRadiusKm: 0.18 * KM_PER_AU,
    color: "#f2c14e",
    texture: "sun.jpg",
    pole: { ra: 286.13, dec: 63.87 },
    spinDegPerDay: 14.1844,
    periodDays: 0,
    summary: "放在坐标原点。自转取卡林顿周量级，只为看清表面。",
  },
  {
    id: "mercury",
    name: "水星",
    group: "planet",
    radiusKm: 2439.7,
    equatorialKm: 2439.7,
    polarKm: 2439.7,
    color: "#b7b2a8",
    texture: "mercury.jpg",
    pole: { ra: 281.01, dec: 61.41 },
    spinDegPerDay: 6.1385025,
    periodDays: (360 * 36525) / 149472.67486623,
    summary: PLANET,
  },
  {
    id: "venus",
    name: "金星",
    group: "planet",
    radiusKm: 6051.8,
    equatorialKm: 6051.8,
    polarKm: 6051.8,
    color: "#e6d3a1",
    texture: "venus.jpg",
    pole: { ra: 272.76, dec: 67.16 },
    spinDegPerDay: -1.4813688,
    periodDays: (360 * 36525) / 58517.8156026,
    summary: `${PLANET}贴图是云层，不是岩石表面。`,
  },
  {
    id: "earth",
    name: "地球",
    group: "planet",
    radiusKm: 6371.0,
    equatorialKm: 6378.1,
    polarKm: 6356.8,
    capRadiusKm: 0.62 * 384400,
    color: "#6ea8d9",
    texture: "earth.jpg",
    clouds: "earth-clouds.jpg",
    pole: { ra: 0, dec: 90 },
    spinDegPerDay: 360.9856235,
    periodDays: (360 * 36525) / 35999.37306329,
    summary: `${PLANET}地心由地月质心减去月球质量比得到，所以地球会绕质心轻轻晃动。`,
  },
  {
    id: "moon",
    name: "月球",
    group: "moon",
    parentId: "earth",
    radiusKm: 1737.4,
    equatorialKm: 1737.4,
    polarKm: 1737.4,
    color: "#d5d0c8",
    texture: "moon.jpg",
    pole: { ra: 269.99, dec: 66.54 },
    spinDegPerDay: 13.17635815,
    periodDays: 27.322,
    labelReachAu: 0.15,
    summary:
      "JPL 月球平根数，参考面是黄道。交点约 18.6 年退行一圈，近地点约 6.0 年进动一圈。出差等短周期项没有逐项展开，近历元时相位大约差几度。",
  },
  {
    id: "mars",
    name: "火星",
    group: "planet",
    radiusKm: 3389.5,
    equatorialKm: 3396.2,
    polarKm: 3376.2,
    color: "#d4764e",
    texture: "mars.jpg",
    pole: { ra: 317.68, dec: 52.89 },
    spinDegPerDay: 350.89198226,
    periodDays: (360 * 36525) / 19140.29934243,
    summary: PLANET,
  },
  {
    id: "jupiter",
    name: "木星",
    group: "planet",
    radiusKm: 69911,
    equatorialKm: 71492,
    polarKm: 66854,
    capRadiusKm: 0.55 * 421800,
    color: "#e0c39a",
    texture: "jupiter.jpg",
    pole: { ra: 268.057, dec: 64.495 },
    spinDegPerDay: 870.536642,
    periodDays: (360 * 36525) / 3034.90371757,
    summary: PLANET,
  },
  {
    id: "io",
    name: "木卫一",
    group: "moon",
    parentId: "jupiter",
    radiusKm: 1821.6,
    equatorialKm: 1821.6,
    polarKm: 1821.6,
    color: "#e6d35a",
    texture: "io.jpg",
    pole: { ra: 268.057, dec: 64.495 },
    spinDegPerDay: 360 / 1.762732,
    periodDays: 1.762732,
    labelReachAu: 0.08,
    summary: SAT,
  },
  {
    id: "europa",
    name: "木卫二",
    group: "moon",
    parentId: "jupiter",
    radiusKm: 1560.8,
    equatorialKm: 1560.8,
    polarKm: 1560.8,
    color: "#e4dece",
    texture: "europa.jpg",
    pole: { ra: 268.057, dec: 64.495 },
    spinDegPerDay: 360 / 3.525463,
    periodDays: 3.525463,
    labelReachAu: 0.08,
    summary: SAT,
  },
  {
    id: "ganymede",
    name: "木卫三",
    group: "moon",
    parentId: "jupiter",
    radiusKm: 2631.2,
    equatorialKm: 2631.2,
    polarKm: 2631.2,
    color: "#b7a48a",
    texture: "ganymede.jpg",
    pole: { ra: 268.057, dec: 64.495 },
    spinDegPerDay: 360 / 7.155588,
    periodDays: 7.155588,
    labelReachAu: 0.1,
    summary: SAT,
  },
  {
    id: "callisto",
    name: "木卫四",
    group: "moon",
    parentId: "jupiter",
    radiusKm: 2410.3,
    equatorialKm: 2410.3,
    polarKm: 2410.3,
    color: "#8e8578",
    texture: "callisto.jpg",
    pole: { ra: 268.057, dec: 64.495 },
    spinDegPerDay: 360 / 16.69044,
    periodDays: 16.69044,
    labelReachAu: 0.12,
    summary: SAT,
  },
  {
    id: "saturn",
    name: "土星",
    group: "planet",
    radiusKm: 58232,
    equatorialKm: 60268,
    polarKm: 54364,
    capRadiusKm: (0.72 * 1221900) / 2.27,
    color: "#ead7a8",
    texture: "saturn.jpg",
    ring: { innerRe: 1.15, outerRe: 2.27, texture: "saturn-ring.png" },
    pole: { ra: 40.589, dec: 83.537 },
    spinDegPerDay: 810.7939024,
    periodDays: (360 * 36525) / 1222.11494724,
    summary: `${PLANET}光环画在赤道面上，内外半径取主环的大致范围。`,
  },
  {
    id: "titan",
    name: "土卫六",
    group: "moon",
    parentId: "saturn",
    radiusKm: 2574.7,
    equatorialKm: 2574.7,
    polarKm: 2574.7,
    color: "#d7a441",
    texture: "titan.jpg",
    pole: { ra: 40.589, dec: 83.537 },
    spinDegPerDay: 360 / 15.945448,
    periodDays: 15.945448,
    labelReachAu: 0.25,
    summary: `${SAT}贴图是低分辨率的雾霾外观，表面细节被大气盖住。`,
  },
  {
    id: "uranus",
    name: "天王星",
    group: "planet",
    radiusKm: 25362,
    equatorialKm: 25559,
    polarKm: 24973,
    color: "#9fd6d2",
    texture: "uranus.jpg",
    pole: { ra: 257.311, dec: -15.175 },
    spinDegPerDay: -501.1600928,
    periodDays: (360 * 36525) / 428.49512595,
    summary: `${PLANET}自转轴几乎倒在轨道面上。`,
  },
  {
    id: "neptune",
    name: "海王星",
    group: "planet",
    radiusKm: 24622,
    equatorialKm: 24764,
    polarKm: 24341,
    color: "#4f73c9",
    texture: "neptune.jpg",
    pole: { ra: 299.36, dec: 43.46 },
    spinDegPerDay: 536.3128492,
    periodDays: (360 * 36525) / 218.46515314,
    summary: PLANET,
  },
  {
    id: "ceres",
    name: "谷神星",
    group: "dwarf",
    radiusKm: 469.7,
    equatorialKm: 482.6,
    polarKm: 445.6,
    color: "#b7aea4",
    texture: "ceres.jpg",
    pole: { ra: 291.4, dec: 66.8 },
    spinDegPerDay: 952.15,
    periodDays: 1679.853119758983,
    summary:
      "JPL 小行星数据库密切轨道，历元 JD 2461200.5（2026-06-09），两体传播。贴图是 Dawn 全球地形设色图，颜色表示高低，不是照片本色；原图上的经纬网会一起贴到球面上。",
  },
  {
    id: "pluto",
    name: "冥王星",
    group: "dwarf",
    radiusKm: 1188.3,
    equatorialKm: 1188.3,
    polarKm: 1188.3,
    color: "#d7c4b4",
    texture: "pluto.jpg",
    pole: { ra: 132.99, dec: -6.16 },
    spinDegPerDay: 56.3625225,
    periodDays: 90981.71647718345,
    summary:
      "JPL SBDB 密切轨道，历元 JD 2457588.5（2016-07-31），两体传播，没有放进与海王星的 3:2 共振。贴图是新视野号彩色镶嵌图，黑色部分是当时没覆盖到的区域。",
  },
  {
    id: "haumea",
    name: "妊神星",
    group: "dwarf",
    radiusKm: 780,
    equatorialKm: 1161,
    polarKm: 513,
    triaxialKm: { x: 1161, y: 513, z: 852 },
    color: "#f4f1ea",
    procedural: { base: "#f4f7fb", mottling: "#c5ced8", seed: 7 },
    spinDegPerDay: 921.6,
    periodDays: 103208.1173403618,
    summary:
      "JPL SBDB 密切轨道，历元 JD 2461200.5，两体传播。形状按约 2322×1704×1026 km 的三轴椭球。没有全球影像，表面只按亮冰的色调铺开，自转轴也没有按实测指向摆。",
  },
  {
    id: "makemake",
    name: "鸟神星",
    group: "dwarf",
    radiusKm: 715,
    equatorialKm: 715,
    polarKm: 715,
    color: "#c4896a",
    procedural: { base: "#c4896a", mottling: "#8d5340", seed: 11 },
    spinDegPerDay: 360 / 0.951,
    periodDays: 112364.8068762869,
    summary:
      "JPL SBDB 密切轨道，历元 JD 2461200.5，两体传播。没有全球影像，红褐色只按公开的色调，不是照片。",
  },
  {
    id: "eris",
    name: "阋神星",
    group: "dwarf",
    radiusKm: 1163,
    equatorialKm: 1163,
    polarKm: 1163,
    color: "#f7f5f2",
    procedural: { base: "#f7f6f3", mottling: "#d5d8e0", seed: 19 },
    spinDegPerDay: 360 / 1.08,
    periodDays: 204516.6629430732,
    summary:
      "JPL SBDB 密切轨道，历元 JD 2461200.5，两体传播。没有全球影像，近白的颜色只按高反照率的描述。",
  },
];

export const BODY_BY_ID = new Map(BODIES.map((body) => [body.id, body]));

export function visualEquatorialKm(body: BodyInfo, sizeScale: number): number {
  const grown = body.equatorialKm * sizeScale;
  const capped = body.capRadiusKm ? Math.min(grown, body.capRadiusKm) : grown;
  return Math.max(body.equatorialKm, capped);
}

export function isSizeCapped(body: BodyInfo, sizeScale: number): boolean {
  if (!body.capRadiusKm) return false;
  return body.equatorialKm * sizeScale > body.capRadiusKm + 1;
}
