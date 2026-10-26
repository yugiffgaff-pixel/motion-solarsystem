import { BODIES, isSizeCapped, type BodyInfo } from "./ephemeris/catalog";
import { bodyState } from "./ephemeris/positions";
import {
  clampJd,
  daysInMonth,
  formatEraYear,
  formatJd,
  gregorianToJd,
  inPublishedPlanetRange,
  jdToCivil,
  nowJd,
  RANGE_END_JD,
  RANGE_START_JD,
} from "./ephemeris/time";
import { KM_PER_AU } from "./ephemeris/vec";
import { createScene } from "./scene";

const viewport = document.querySelector<HTMLElement>("#viewport");
const loading = document.querySelector<HTMLElement>("#loading");
if (!viewport || !loading) throw new Error("页面结构缺失");

const dateReadout = must<HTMLElement>("#date-readout");
const accuracyNote = must<HTMLElement>("#accuracy-note");
const bodyList = must<HTMLElement>("#body-list");
const scaleSlider = must<HTMLInputElement>("#scale-slider");
const scaleReadout = must<HTMLElement>("#scale-readout");
const capNote = must<HTMLElement>("#cap-note");
const timeSlider = must<HTMLInputElement>("#time-slider");
const fineSlider = must<HTMLInputElement>("#fine-slider");
const playButton = must<HTMLButtonElement>("#btn-play");
const speedSlider = must<HTMLInputElement>("#speed-slider");
const speedReadout = must<HTMLElement>("#speed-readout");
const eraSelect = must<HTMLSelectElement>("#era-select");
const yearInput = must<HTMLInputElement>("#year-input");
const monthInput = must<HTMLInputElement>("#month-input");
const dayInput = must<HTMLInputElement>("#day-input");
const side = must<HTMLElement>("#side");
const panelToggle = must<HTMLButtonElement>("#panel-toggle");

const scene = await createScene(viewport, { onPick: pick });
loading.classList.add("is-gone");
if (window.matchMedia("(max-width: 800px)").matches) {
  side.classList.add("is-collapsed");
  panelToggle.textContent = "目录";
  panelToggle.setAttribute("aria-expanded", "false");
}

let jd = nowJd();
let playing = false;
let fineAnchor = jd;
let selected = "earth";

timeSlider.min = String(RANGE_START_JD);
timeSlider.max = String(RANGE_END_JD);
buildList();
applyJd(jd, true);
scene.select(selected);
scene.setScale(Number(scaleSlider.value));
updateScaleNote();
updateSpeed();
fillInfo();

scaleSlider.addEventListener("input", () => {
  scene.setScale(Number(scaleSlider.value));
  updateScaleNote();
});
must<HTMLButtonElement>("#btn-real").addEventListener("click", () => setScale(1));
must<HTMLButtonElement>("#btn-view").addEventListener("click", () => setScale(8));
must<HTMLButtonElement>("#btn-large").addEventListener("click", () => setScale(24));
must<HTMLButtonElement>("#btn-all").addEventListener("click", () => scene.showAll());
must<HTMLButtonElement>("#btn-inner").addEventListener("click", () => scene.showInner());
must<HTMLButtonElement>("#btn-focus").addEventListener("click", () => scene.focus(selected));

must<HTMLInputElement>("#toggle-orbits").addEventListener("change", (event) => {
  scene.setOrbits((event.target as HTMLInputElement).checked);
});
must<HTMLInputElement>("#toggle-labels").addEventListener("change", (event) => {
  scene.setLabels((event.target as HTMLInputElement).checked);
});
must<HTMLInputElement>("#toggle-belt").addEventListener("change", (event) => {
  scene.setBelt((event.target as HTMLInputElement).checked);
});

timeSlider.addEventListener("input", () => {
  playing = false;
  playButton.textContent = "播放";
  applyJd(Number(timeSlider.value), true);
});
fineSlider.addEventListener("input", () => {
  playing = false;
  playButton.textContent = "播放";
  applyJd(fineAnchor + Number(fineSlider.value), false);
});
playButton.addEventListener("click", () => {
  playing = !playing;
  playButton.textContent = playing ? "暂停" : "播放";
});
speedSlider.addEventListener("input", updateSpeed);
must<HTMLButtonElement>("#btn-today").addEventListener("click", () => {
  playing = false;
  playButton.textContent = "播放";
  applyJd(nowJd(), true);
});
must<HTMLButtonElement>("#btn-day-minus").addEventListener("click", () => stepDays(-1));
must<HTMLButtonElement>("#btn-day-plus").addEventListener("click", () => stepDays(1));
must<HTMLButtonElement>("#btn-year-minus").addEventListener("click", () => stepDays(-3652));
must<HTMLButtonElement>("#btn-year-plus").addEventListener("click", () => stepDays(3652));

must<HTMLFormElement>("#date-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const era = eraSelect.value;
  const yearNumber = clamp(Math.round(Number(yearInput.value)), 1, 10000);
  const astroYear = era === "bce" ? 1 - yearNumber : yearNumber;
  const month = clamp(Math.round(Number(monthInput.value)), 1, 12);
  const day = clamp(Math.round(Number(dayInput.value)), 1, daysInMonth(astroYear, month));
  playing = false;
  playButton.textContent = "播放";
  applyJd(gregorianToJd(astroYear, month, day), true);
});

panelToggle.addEventListener("click", () => {
  const collapsed = side.classList.toggle("is-collapsed");
  panelToggle.textContent = collapsed ? "目录" : "收起目录";
  panelToggle.setAttribute("aria-expanded", String(!collapsed));
  requestAnimationFrame(() => scene.resize());
});

window.addEventListener("resize", () => scene.resize());
window.addEventListener("keydown", (event) => {
  const tag = (event.target as HTMLElement | null)?.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  if (event.code === "Space") {
    event.preventDefault();
    playButton.click();
  } else if (event.key === "ArrowLeft") {
    stepDays(event.shiftKey ? -365 : -1);
  } else if (event.key === "ArrowRight") {
    stepDays(event.shiftKey ? 365 : 1);
  } else if (event.key === "Home") {
    playing = false;
    playButton.textContent = "播放";
    applyJd(nowJd(), true);
  }
});

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (playing) {
    const next = clampJd(jd + daysPerSecond() * dt);
    if (next === RANGE_START_JD || next === RANGE_END_JD) {
      playing = false;
      playButton.textContent = "播放";
    }
    applyJd(next, true);
  }
  scene.setJd(jd);
  scene.update(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function pick(id: string): void {
  selected = id;
  scene.select(id);
  scene.focus(id);
  fillInfo();
  for (const button of bodyList.querySelectorAll<HTMLButtonElement>(".nav-btn")) {
    button.classList.toggle("is-selected", button.dataset.id === id);
  }
}

function stepDays(days: number): void {
  playing = false;
  playButton.textContent = "播放";
  applyJd(jd + days, true);
}

function applyJd(next: number, resetFine: boolean): void {
  jd = clampJd(next);
  if (resetFine) {
    fineAnchor = jd;
    fineSlider.value = "0";
  }
  timeSlider.value = String(jd);
  const civil = jdToCivil(jd);
  dateReadout.textContent = formatJd(jd, true);
  timeSlider.setAttribute("aria-valuetext", dateReadout.textContent);
  accuracyNote.textContent = inPublishedPlanetRange(jd)
    ? "行星位置落在 JPL 公布精度区间内（公元前 3000 年至公元 3000 年）。"
    : "已超出公元前 3000 年至公元 3000 年。轨道仍按同一公式外推，相位误差会变大。";
  const active = document.activeElement;
  if (active !== yearInput && active !== monthInput && active !== dayInput && active !== eraSelect) {
    const era = formatEraYear(civil.year);
    eraSelect.value = era.era === "公元前" ? "bce" : "ce";
    yearInput.value = String(era.year);
    monthInput.value = String(civil.month);
    dayInput.value = String(civil.day);
  }
  fillInfo();
}

function fillInfo(): void {
  const info = BODIES.find((body) => body.id === selected);
  if (!info) return;
  const state = bodyState(selected, jd);
  must<HTMLElement>("#info-name").textContent = info.name;
  must<HTMLElement>("#info-kind").textContent = kindLabel(info);
  const rows: [string, string][] = [
    ["日心距离", formatAu(state.distanceAu)],
    ["黄经", `${state.lonDeg.toFixed(2)}°`],
    ["黄纬", `${state.latDeg.toFixed(2)}°`],
  ];
  if (state.relativeKm !== null && info.parentId) {
    const parent = BODIES.find((body) => body.id === info.parentId);
    rows.push([`距${parent?.name ?? "母星"}`, `${Math.round(state.relativeKm).toLocaleString("zh-CN")} km`]);
  }
  rows.push(["平均半径", `${Math.round(info.radiusKm).toLocaleString("zh-CN")} km`]);
  if (info.periodDays > 0) rows.push(["公转周期", formatPeriod(info.periodDays)]);
  const stats = must<HTMLElement>("#info-stats");
  stats.replaceChildren();
  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    stats.append(dt, dd);
  }
  must<HTMLElement>("#info-model").textContent = info.summary;
}

function buildList(): void {
  const groups: { title: string; group: BodyInfo["group"] }[] = [
    { title: "恒星", group: "star" },
    { title: "行星", group: "planet" },
    { title: "卫星", group: "moon" },
    { title: "矮行星", group: "dwarf" },
  ];
  for (const group of groups) {
    const heading = document.createElement("div");
    heading.className = "group-label";
    heading.textContent = group.title;
    bodyList.appendChild(heading);
    for (const body of BODIES.filter((item) => item.group === group.group)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nav-btn";
      button.dataset.id = body.id;
      if (body.id === selected) button.classList.add("is-selected");
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = body.color;
      button.append(swatch, document.createTextNode(body.name));
      button.addEventListener("click", () => pick(body.id));
      bodyList.appendChild(button);
    }
  }
}

function setScale(value: number): void {
  scaleSlider.value = String(value);
  scene.setScale(value);
  updateScaleNote();
}

function updateScaleNote(): void {
  const value = Number(scaleSlider.value);
  scaleReadout.textContent = value.toFixed(1).replace(/\.0$/, "");
  const names = BODIES.filter((body) => isSizeCapped(body, value)).map((body) => body.name);
  capNote.textContent = names.length
    ? `${names.join("、")}已放到卫星轨道允许的最大显示尺寸。倍数再高，它们也不会继续变大，免得把卫星包进去。`
    : "";
}

function updateSpeed(): void {
  speedReadout.textContent = formatSpeed(daysPerSecond());
}

function daysPerSecond(): number {
  const t = Number(speedSlider.value) / 1000;
  const min = Math.log(0.5);
  const max = Math.log(36525);
  return Math.exp(min + (max - min) * t);
}

function formatSpeed(days: number): string {
  if (days < 1.5) return `${days.toFixed(1)} 天/秒`;
  if (days < 80) return `${days.toFixed(0)} 天/秒`;
  const years = days / 365.25;
  if (years < 10) return `${years.toFixed(1)} 年/秒`;
  return `${years.toFixed(0)} 年/秒`;
}

function formatAu(au: number): string {
  if (au < 0.01) {
    const km = au * KM_PER_AU;
    return `${Math.round(km).toLocaleString("zh-CN")} km`;
  }
  return `${au.toFixed(au < 10 ? 4 : 3)} AU`;
}

function formatPeriod(days: number): string {
  if (days < 2) return `${days.toFixed(3)} 天`;
  if (days < 500) return `${days.toFixed(2)} 天`;
  const years = days / 365.25;
  return years < 20 ? `${years.toFixed(2)} 年` : `${years.toFixed(1)} 年`;
}

function kindLabel(info: BodyInfo): string {
  if (info.group === "star") return "恒星";
  if (info.group === "planet") return "行星";
  if (info.group === "dwarf") return "矮行星";
  const parent = BODIES.find((body) => body.id === info.parentId);
  return parent ? `${parent.name}的卫星` : "卫星";
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function must<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`缺少 ${selector}`);
  return node;
}
