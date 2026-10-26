/** Proleptic Gregorian dates and Julian Day (0h TT scale, ΔT ignored). */

export const J2000_JD = 2451545.0;

export type Civil = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayFraction: number;
};

export function isLeapYear(year: number): boolean {
  if (year % 4 !== 0) return false;
  if (year % 100 !== 0) return true;
  return year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1] ?? 30;
}

/**
 * Julian Day for a proleptic Gregorian calendar date.
 * `day` is the civil day number and may include a fraction (1.5 = noon on the 1st).
 */
export function gregorianToJd(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}

/** Inverse of {@link gregorianToJd}, always on the proleptic Gregorian calendar. */
export function jdToCivil(jd: number): Civil {
  const z = Math.floor(jd + 0.5);
  let f = jd + 0.5 - z;
  if (f < 0) f = 0;
  if (f >= 1) f = 0.999999;
  const alpha = Math.floor((z - 1867216.25) / 36524.25);
  const a = z + 1 + alpha - Math.floor(alpha / 4);
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const dayFloat = b - d - Math.floor(30.6001 * e) + f;
  let day = Math.floor(dayFloat);
  let dayFraction = dayFloat - day;
  if (dayFraction < 1e-10) dayFraction = 0;
  if (dayFraction > 1 - 1e-10) dayFraction = 0;
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  const hours = dayFraction * 24;
  const hour = Math.floor(hours);
  const minuteFloat = (hours - hour) * 60;
  const minute = Math.floor(minuteFloat);
  const second = Math.min(59, Math.floor((minuteFloat - minute) * 60));
  return { year, month, day, hour, minute, second, dayFraction };
}

/** Astronomical year → 公元前 / 公元. Year 0 is 公元前1年. */
export function formatEraYear(year: number): { era: "公元前" | "公元"; year: number } {
  if (year > 0) return { era: "公元", year };
  return { era: "公元前", year: 1 - year };
}

export function formatCivil(civil: Civil, withTime: boolean): string {
  const era = formatEraYear(civil.year);
  const date = `${era.era}${era.year}年${civil.month}月${civil.day}日`;
  if (!withTime) return date;
  const hh = String(civil.hour).padStart(2, "0");
  const mm = String(civil.minute).padStart(2, "0");
  return `${date} ${hh}:${mm} 世界时`;
}

export function formatJd(jd: number, withTime = true): string {
  return formatCivil(jdToCivil(jd), withTime);
}

/** 公元前10000年1月1日 0h — astronomical year −9999. */
export const RANGE_START_JD = gregorianToJd(-9999, 1, 1);
/** 公元10000年1月1日 0h. */
export const RANGE_END_JD = gregorianToJd(10000, 1, 1);

export function clampJd(jd: number): number {
  return Math.min(RANGE_END_JD, Math.max(RANGE_START_JD, jd));
}

export function nowJd(): number {
  const now = new Date();
  const day =
    now.getUTCDate() +
    (now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600) / 24;
  return clampJd(gregorianToJd(now.getUTCFullYear(), now.getUTCMonth() + 1, day));
}

/** JPL's published fit for the planetary elements used here. */
export function inPublishedPlanetRange(jd: number): boolean {
  const year = jdToCivil(jd).year;
  return year >= -2999 && year <= 3000;
}

export function centuriesSinceJ2000(jd: number): number {
  return (jd - J2000_JD) / 36525;
}
