import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { BODIES, visualEquatorialKm, type BodyInfo } from "./ephemeris/catalog";
import { bodyState, maxChildApsisKm, orbitPath } from "./ephemeris/positions";
import { J2000_JD } from "./ephemeris/time";
import { eclipticToScene, equatorialToEcliptic, KM_PER_AU, poleEquatorial, type Vec3 } from "./ephemeris/vec";
import { keplerPosition } from "./ephemeris/kepler";

type Hooks = { onPick: (id: string) => void };

type Anim = {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  started: number;
  duration: number;
  followAfter: string | null;
};

type BodyView = {
  info: BodyInfo;
  group: THREE.Group;
  mesh: THREE.Mesh;
  hit: THREE.Mesh;
  label: CSS2DObject;
  labelEl: HTMLElement;
  ring?: THREE.Mesh;
  clouds?: THREE.Mesh;
  selectRing: THREE.Mesh;
  orbit?: THREE.Line;
  pole: THREE.Quaternion;
};

export type SceneApi = {
  setJd: (jd: number) => void;
  setScale: (scale: number) => void;
  setOrbits: (visible: boolean) => void;
  setLabels: (visible: boolean) => void;
  setBelt: (visible: boolean) => void;
  select: (id: string) => void;
  focus: (id: string) => void;
  showAll: () => void;
  showInner: () => void;
  update: (dt: number) => void;
  resize: () => void;
};

const VIEW_ALL = new THREE.Vector3(62, 108, 198);
const VIEW_INNER = new THREE.Vector3(0.55, 1.7, 3.5);

export async function createScene(viewport: HTMLElement, hooks: Hooks): Promise<SceneApi> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x07080b, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.style.position = "absolute";
  labels.domElement.style.inset = "0";
  labels.domElement.style.pointerEvents = "none";
  viewport.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 1e-6, 30000);
  camera.position.copy(VIEW_ALL);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1e-4;
  controls.maxDistance = 1200;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xfff4e2, 0.34));
  const sunLight = new THREE.PointLight(0xfff6ea, 4.2, 0, 0);
  scene.add(sunLight);

  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const loader = new THREE.TextureLoader();
  const textures = new Map<string, THREE.Texture>();
  await Promise.all(
    BODIES.filter((body) => body.texture).map(async (body) => {
      textures.set(body.id, await loadTexture(loader, textureUrl(body.texture!), body.color, anisotropy));
    }),
  );
  const cloudTex = await loadCloudTexture(loader, textureUrl("earth-clouds.jpg"), anisotropy);
  const ringTex = await loadRingTexture(loader, textureUrl("saturn-ring.png"), anisotropy);

  scene.add(makeStars());
  const belt = makeBelt();
  scene.add(belt);

  const views = new Map<string, BodyView>();
  let jd = J2000_JD;
  let scale = 8;
  let orbitsOn = true;
  let labelsOn = true;
  let selected = "earth";
  let followId: string | null = null;
  let anim: Anim | null = null;
  let orbitKey = Number.NaN;

  for (const info of BODIES) {
    const view = buildBody(info, textures, cloudTex, ringTex, hooks);
    views.set(info.id, view);
    scene.add(view.group);
  }
  for (const view of views.values()) {
    const path = orbitPath(view.info.id, jd);
    if (!path) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((path.points.length) * 3), 3));
    const line = new THREE.Line(
      geo,
      orbitMaterial(view.info.color, path.space === "parent" ? 0.0012 : 0.6),
    );
    view.orbit = line;
    if (path.space === "parent" && path.parentId) views.get(path.parentId)?.group.add(line);
    else scene.add(line);
  }

  const pointer = { x: 0, y: 0, moved: false };
  renderer.domElement.addEventListener("pointerdown", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.moved = false;
  });
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 5) pointer.moved = true;
  });
  renderer.domElement.addEventListener("pointerup", (event) => {
    if (pointer.moved) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const hits = [...views.values()].map((view) => view.hit);
    const found = ray.intersectObjects(hits, false)[0];
    if (found) hooks.onPick(String(found.object.userData.id));
  });

  function applyScale(): void {
    for (const view of views.values()) {
      const eqAu = visualEquatorialKm(view.info, scale) / KM_PER_AU;
      const factor = eqAu / (view.info.equatorialKm / KM_PER_AU);
      if (view.info.triaxialKm) view.mesh.scale.setScalar((view.info.radiusKm / KM_PER_AU) * factor);
      else view.mesh.scale.setScalar(eqAu);
      if (view.ring) view.ring.scale.setScalar(eqAu);
      view.selectRing.scale.setScalar(Math.max(eqAu, 1e-6));
    }
    const sun = views.get("sun");
    if (sun) {
      const glow = sun.group.getObjectByName("glow") as THREE.Sprite | undefined;
      if (glow) {
        const radius = visualEquatorialKm(sun.info, scale) / KM_PER_AU;
        glow.scale.setScalar(radius * 7);
      }
    }
  }

  function writeOrbit(view: BodyView, points: Vec3[]): void {
    const attr = view.orbit?.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!attr) return;
    if (attr.count !== points.length) {
      view.orbit!.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(points.length * 3), 3));
    }
    const next = view.orbit!.geometry.getAttribute("position") as THREE.BufferAttribute;
    points.forEach((point, index) => {
      const scenePoint = eclipticToScene(point);
      next.setXYZ(index, scenePoint.x, scenePoint.y, scenePoint.z);
    });
    next.needsUpdate = true;
  }

  function refreshOrbits(): void {
    for (const view of views.values()) {
      if (!view.orbit) continue;
      const path = orbitPath(view.info.id, jd);
      if (path) writeOrbit(view, path.points);
      view.orbit.visible = orbitsOn;
    }
  }

  function applyPositions(): void {
    for (const view of views.values()) {
      const state = bodyState(view.info.id, jd);
      const at = eclipticToScene(state.eclipticAu);
      view.group.position.set(at.x, at.y, at.z);
      const spin = ((jd - J2000_JD) * view.info.spinDegPerDay * Math.PI) / 180;
      const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin);
      view.mesh.quaternion.copy(view.pole).multiply(turn);
      if (view.ring) view.ring.quaternion.copy(view.pole);
      if (view.clouds) view.clouds.rotation.y = (jd - J2000_JD) * 0.08;
    }
    if (Math.floor(jd) !== orbitKey) {
      orbitKey = Math.floor(jd);
      refreshOrbits();
    }
  }

  function applySelection(): void {
    for (const view of views.values()) {
      const on = view.info.id === selected;
      view.selectRing.visible = on;
      view.labelEl.classList.toggle("is-selected", on);
    }
  }

  function updateLabels(): void {
    for (const view of views.values()) {
      if (!labelsOn) {
        view.label.visible = false;
        continue;
      }
      if (view.info.group === "moon" && view.info.parentId) {
        const parent = views.get(view.info.parentId);
        const dist = parent ? camera.position.distanceTo(parent.group.position) : Infinity;
        const reach = view.info.labelReachAu ?? 0.1;
        view.label.visible = dist < reach || view.info.id === selected;
      } else {
        view.label.visible = true;
      }
    }
  }

  function updateHits(): void {
    for (const view of views.values()) {
      const dist = Math.max(camera.position.distanceTo(view.group.position), 1e-4);
      const visual = visualEquatorialKm(view.info, scale) / KM_PER_AU;
      const cap = hitCapAu(view.info);
      const radius = Math.min(Math.max(visual * 1.5, Math.min(dist * 0.02, cap)), dist * 0.42);
      view.hit.scale.setScalar(Math.max(radius, visual));
    }
  }

  function ease(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  }

  function flyTo(position: THREE.Vector3, target: THREE.Vector3, followAfter: string | null): void {
    anim = {
      fromPos: camera.position.clone(),
      toPos: position.clone(),
      fromTarget: controls.target.clone(),
      toTarget: target.clone(),
      started: performance.now(),
      duration: 900,
      followAfter,
    };
    controls.enabled = false;
  }

  function focus(id: string): void {
    const view = views.get(id);
    if (!view) return;
    const radiusKm = visualEquatorialKm(view.info, scale);
    const radius = Math.max(radiusKm / KM_PER_AU, view.info.radiusKm / KM_PER_AU);
    const ringKm = view.info.ring ? radiusKm * view.info.ring.outerRe : 0;
    const familyKm = Math.max(ringKm, maxChildApsisKm(id));
    const familyAu = familyKm > 0 ? familyKm / KM_PER_AU / Math.tan(THREE.MathUtils.degToRad(17)) : 0;
    const dist = Math.max(radius * 6.5, familyAu, 0.0003);
    const offset = camera.position.clone().sub(controls.target);
    if (offset.lengthSq() < 1e-12) offset.set(0.35, 0.45, 1);
    offset.normalize().multiplyScalar(dist);
    flyTo(view.group.position.clone().add(offset), view.group.position.clone(), id);
  }

  applyScale();
  applyPositions();
  applySelection();
  resize();

  return {
    setJd(next) {
      jd = next;
      applyPositions();
    },
    setScale(next) {
      scale = next;
      applyScale();
    },
    setOrbits(visible) {
      orbitsOn = visible;
      for (const view of views.values()) if (view.orbit) view.orbit.visible = visible;
    },
    setLabels(visible) {
      labelsOn = visible;
      updateLabels();
    },
    setBelt(visible) {
      belt.visible = visible;
    },
    select(id) {
      selected = id;
      applySelection();
    },
    focus,
    showAll() {
      followId = null;
      flyTo(VIEW_ALL, new THREE.Vector3(0, 0, 0), null);
    },
    showInner() {
      followId = null;
      flyTo(VIEW_INNER, new THREE.Vector3(0, 0, 0), null);
    },
    update() {
      if (anim) {
        if (anim.followAfter) {
          const moving = views.get(anim.followAfter);
          if (moving) {
            const delta = moving.group.position.clone().sub(anim.toTarget);
            anim.toTarget.add(delta);
            anim.toPos.add(delta);
          }
        }
        const t = ease(Math.min(1, (performance.now() - anim.started) / anim.duration));
        camera.position.lerpVectors(anim.fromPos, anim.toPos, t);
        controls.target.lerpVectors(anim.fromTarget, anim.toTarget, t);
        if (t >= 1) {
          followId = anim.followAfter;
          anim = null;
          controls.enabled = true;
          controls.update();
        }
      } else if (followId) {
        const view = views.get(followId);
        if (view) {
          const delta = view.group.position.clone().sub(controls.target);
          controls.target.copy(view.group.position);
          camera.position.add(delta);
        }
        controls.update();
      } else {
        controls.update();
      }
      updateHits();
      updateLabels();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    },
    resize,
  };

  function resize(): void {
    const width = viewport.clientWidth || window.innerWidth;
    const height = viewport.clientHeight || window.innerHeight;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    labels.setSize(width, height);
  }
}

function orbitMaterial(color: string, fadeOutAu: number): THREE.LineBasicMaterial {
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const inner = (fadeOutAu * 0.22).toFixed(4);
  const outer = fadeOutAu.toFixed(4);
  material.customProgramCacheKey = () => `orbit-fade-${outer}`;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vViewDistance;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvViewDistance = -mvPosition.z;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vViewDistance;")
      .replace(
        "#include <opaque_fragment>",
        `diffuseColor.a *= smoothstep(${inner}, ${outer}, vViewDistance);\n#include <opaque_fragment>`,
      );
  };
  return material;
}

function textureUrl(file: string): string {
  return `${import.meta.env.BASE_URL}textures/${file}`;
}

function loadTexture(loader: THREE.TextureLoader, url: string, color: string, anisotropy: number): Promise<THREE.Texture> {
  return new Promise((resolve) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = anisotropy;
        resolve(tex);
      },
      undefined,
      () => resolve(solidTexture(color)),
    );
  });
}

async function loadCloudTexture(loader: THREE.TextureLoader, url: string, anisotropy: number): Promise<THREE.Texture | null> {
  try {
    const tex = await loader.loadAsync(url);
    const image = tex.image as HTMLImageElement;
    const canvas = document.createElement("canvas");
    const width = image.width || 2048;
    const height = image.height || 1024;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const lum = pixels.data[i] * 0.3 + pixels.data[i + 1] * 0.59 + pixels.data[i + 2] * 0.11;
      pixels.data[i] = 245;
      pixels.data[i + 1] = 248;
      pixels.data[i + 2] = 252;
      pixels.data[i + 3] = lum > 18 ? Math.min(255, lum * 1.15) : 0;
    }
    ctx.putImageData(pixels, 0, 0);
    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace = THREE.SRGBColorSpace;
    next.anisotropy = anisotropy;
    return next;
  } catch {
    return null;
  }
}

async function loadRingTexture(loader: THREE.TextureLoader, url: string, anisotropy: number): Promise<THREE.Texture | null> {
  try {
    const tex = await loader.loadAsync(url);
    const image = tex.image as HTMLImageElement;
    const canvas = document.createElement("canvas");
    canvas.width = image.width || 2048;
    canvas.height = image.height || 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return tex;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let minA = 255;
    let maxA = 0;
    for (let i = 3; i < pixels.data.length; i += 4) {
      minA = Math.min(minA, pixels.data[i]);
      maxA = Math.max(maxA, pixels.data[i]);
    }
    if (maxA - minA < 8) {
      for (let i = 0; i < pixels.data.length; i += 4) {
        const lum = Math.max(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]);
        pixels.data[i + 3] = lum;
      }
      ctx.putImageData(pixels, 0, 0);
    }
    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace = THREE.SRGBColorSpace;
    next.anisotropy = anisotropy;
    return next;
  } catch {
    return null;
  }
}

function solidTexture(color: string): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 8;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 8, 8);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function proceduralTexture(base: string, mottling: string, seed: number): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const rand = mulberry32(seed);
  ctx.fillStyle = mottling;
  for (let i = 0; i < 70; i += 1) {
    ctx.globalAlpha = 0.08 + rand() * 0.2;
    ctx.beginPath();
    ctx.ellipse(rand() * 1024, rand() * 512, 20 + rand() * 120, 10 + rand() * 40, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildBody(
  info: BodyInfo,
  textures: Map<string, THREE.Texture>,
  cloudTex: THREE.Texture | null,
  ringTex: THREE.Texture | null,
  hooks: Hooks,
): BodyView {
  const group = new THREE.Group();
  group.name = info.id;
  const geo = new THREE.SphereGeometry(1, info.group === "moon" ? 40 : 64, info.group === "moon" ? 28 : 48);
  if (info.triaxialKm) {
    const mean = Math.cbrt(info.triaxialKm.x * info.triaxialKm.y * info.triaxialKm.z);
    geo.scale(info.triaxialKm.x / mean, info.triaxialKm.y / mean, info.triaxialKm.z / mean);
  } else if (info.polarKm !== info.equatorialKm) {
    geo.scale(1, info.polarKm / info.equatorialKm, 1);
  }
  geo.computeVertexNormals();
  const map = info.procedural
    ? proceduralTexture(info.procedural.base, info.procedural.mottling, info.procedural.seed)
    : textures.get(info.id) ?? solidTexture(info.color);
  const material =
    info.id === "sun"
      ? new THREE.MeshBasicMaterial({ map })
      : new THREE.MeshLambertMaterial({ map });
  const mesh = new THREE.Mesh(geo, material);
  group.add(mesh);

  let clouds: THREE.Mesh | undefined;
  if (info.clouds && cloudTex) {
    clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.012, 48, 32),
      new THREE.MeshLambertMaterial({ map: cloudTex, transparent: true, depthWrite: false }),
    );
    mesh.add(clouds);
  }

  let ring: THREE.Mesh | undefined;
  if (info.ring && ringTex) {
    const ringGeo = new THREE.RingGeometry(info.ring.innerRe, info.ring.outerRe, 192, 4);
    const pos = ringGeo.attributes.position;
    const uv = ringGeo.attributes.uv;
    for (let i = 0; i < pos.count; i += 1) {
      const radius = Math.hypot(pos.getX(i), pos.getY(i));
      const t = (radius - info.ring.innerRe) / (info.ring.outerRe - info.ring.innerRe);
      uv.setXY(i, THREE.MathUtils.clamp(t, 0, 1), 0.5);
    }
    ringGeo.rotateX(-Math.PI / 2);
    ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshLambertMaterial({
        map: ringTex,
        transparent: true,
        side: THREE.DoubleSide,
        alphaTest: 0.05,
        depthWrite: false,
      }),
    );
    group.add(ring);
  }

  if (info.id === "sun") {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sprite.name = "glow";
    group.add(sprite);
  }

  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  );
  hit.userData.id = info.id;
  group.add(hit);

  const selectRing = new THREE.Mesh(
    new THREE.RingGeometry(1.28, 1.42, 80),
    new THREE.MeshBasicMaterial({ color: 0xe0c17a, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  selectRing.rotation.x = -Math.PI / 2;
  selectRing.visible = false;
  group.add(selectRing);

  const labelEl = document.createElement("div");
  labelEl.className = "tag";
  const span = document.createElement("span");
  span.textContent = info.name;
  span.addEventListener("pointerdown", (event) => event.stopPropagation());
  span.addEventListener("click", (event) => {
    event.stopPropagation();
    hooks.onPick(info.id);
  });
  labelEl.appendChild(span);
  const label = new CSS2DObject(labelEl);
  group.add(label);

  const poleTarget = info.pole
    ? eclipticToScene(equatorialToEcliptic(poleEquatorial(info.pole.ra, info.pole.dec)))
    : { x: 0, y: 1, z: 0 };
  const pole = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(poleTarget.x, poleTarget.y, poleTarget.z).normalize(),
  );

  return { info, group, mesh, hit, label, labelEl, ring, clouds, selectRing, pole };
}

function glowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(128, 128, 16, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255, 248, 230, 0.95)");
  gradient.addColorStop(0.18, "rgba(255, 214, 130, 0.55)");
  gradient.addColorStop(0.42, "rgba(255, 170, 70, 0.12)");
  gradient.addColorStop(1, "rgba(255, 160, 40, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeStars(): THREE.Points {
  const count = 4500;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const rand = mulberry32(2026);
  for (let i = 0; i < count; i += 1) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const radius = 2800;
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const tone = 0.65 + rand() * 0.35;
    colors[i * 3] = tone;
    colors[i * 3 + 1] = tone * (0.92 + rand() * 0.08);
    colors[i * 3 + 2] = tone * (0.85 + rand() * 0.15);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  points.renderOrder = -1;
  return points;
}

function makeBelt(): THREE.Points {
  const count = 3200;
  const positions = new Float32Array(count * 3);
  const rand = mulberry32(77);
  for (let i = 0; i < count; i += 1) {
    const a = 2.15 + rand() * 1.15;
    const e = rand() * 0.16;
    const inc = (rand() ** 1.4) * 15;
    const point = keplerPosition(a, e, inc, rand() * 360, rand() * 360, rand() * 360);
    const at = eclipticToScene(point);
    positions[i * 3] = at.x;
    positions[i * 3 + 1] = at.y;
    positions[i * 3 + 2] = at.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0xb7a48a, size: 1.35, sizeAttenuation: false, transparent: true, opacity: 0.45, depthWrite: false }),
  );
}

function hitCapAu(info: BodyInfo): number {
  if (info.id === "sun") return 0.12;
  if (info.group === "moon") return 0.006;
  const caps: Record<string, number> = {
    mercury: 0.045,
    venus: 0.05,
    earth: 0.06,
    mars: 0.08,
    jupiter: 0.35,
    saturn: 0.5,
    uranus: 0.7,
    neptune: 0.85,
    ceres: 0.08,
    pluto: 0.7,
    haumea: 0.7,
    makemake: 0.7,
    eris: 0.9,
  };
  return caps[info.id] ?? 0.2;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
