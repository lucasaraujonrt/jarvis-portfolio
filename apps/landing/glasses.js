import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const LENS_X = 0.72;
const LENS_OUTLINE = [
  [-0.5, 0.33], [-0.12, 0.37], [0.32, 0.39], [0.55, 0.37], [0.56, 0.12],
  [0.46, -0.19], [0.26, -0.35], [-0.04, -0.39], [-0.33, -0.33], [-0.48, -0.12],
];
const FRONT_DEPTH = 0.1;
const HINGE_X = 1.4;

export const POSE_KEYS = ["x", "y", "z", "rx", "ry", "rz", "s", "fold", "lens", "shadow"];

function sampleClosed(points, count) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, "centripetal");
  return curve.getSpacedPoints(count).slice(0, count).map((p) => new THREE.Vector2(p.x, p.y));
}

function lensPoints(side) {
  return sampleClosed(LENS_OUTLINE, 96).map((p) => new THREE.Vector2(p.x * side + side * LENS_X, p.y));
}

function offsetOutline(points, width) {
  const c = points.reduce((a, p) => a.add(p), new THREE.Vector2()).divideScalar(points.length);
  return points.map((p, i) => {
    const prev = points[(i - 1 + points.length) % points.length];
    const next = points[(i + 1) % points.length];
    const t = next.clone().sub(prev).normalize();
    const n = new THREE.Vector2(t.y, -t.x);
    if (n.dot(p.clone().sub(c)) < 0) n.negate();
    return p.clone().add(n.multiplyScalar(width(p)));
  });
}

function rimGeometry(side) {
  const hole = lensPoints(side);
  const outer = offsetOutline(hole, (p) => 0.058 + 0.07 * THREE.MathUtils.smoothstep(p.y, 0.05, 0.36));
  const shape = new THREE.Shape(outer);
  shape.holes.push(new THREE.Path(hole));
  return new THREE.ExtrudeGeometry(shape, {
    depth: FRONT_DEPTH, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.022, bevelSegments: 4, curveSegments: 1,
  });
}

const WRAP = 0.06;
function wrapZ(x) {
  return -WRAP * x * x;
}
function bend(geometry) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + wrapZ(pos.getX(i)));
  return geometry;
}

function bridgeGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.19, 0.46);
  s.quadraticCurveTo(0, 0.445, 0.19, 0.46);
  s.lineTo(0.19, 0.18);
  s.quadraticCurveTo(0.09, 0.19, 0, 0.26);
  s.quadraticCurveTo(-0.09, 0.19, -0.19, 0.18);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: FRONT_DEPTH - 0.008, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 4, curveSegments: 16,
  });
  return g.translate(0, 0, 0.004);
}

function templeGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.13);
  s.bezierCurveTo(0.8, 0.12, 1.5, 0.07, 2.25, 0.04);
  s.quadraticCurveTo(2.5, 0.02, 2.62, -0.22);
  s.quadraticCurveTo(2.66, -0.34, 2.56, -0.36);
  s.quadraticCurveTo(2.48, -0.36, 2.42, -0.2);
  s.quadraticCurveTo(2.34, -0.06, 2.2, -0.05);
  s.bezierCurveTo(1.5, -0.04, 0.8, -0.1, 0, -0.12);
  s.closePath();
  const depth = 0.07;
  const g = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 4, curveSegments: 24,
  });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

function planarUV(geometry, minX, maxX, minY, maxY) {
  const pos = geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - minX) / (maxX - minX);
    uv[i * 2 + 1] = (pos.getY(i) - minY) / (maxY - minY);
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geometry;
}

function radialTexture(inner, outer) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function visionTexture() {
  const W = 1024;
  const H = 360;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#e9ebef";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#f7f7f9";
  ctx.fillRect(40, 30, W - 80, H - 60);
  const notes = [
    { x: 178, y: 142, r: -0.06, t: ["onboarding", "3 passos?"] },
    { x: 338, y: 222, r: 0.05, t: ["convite", "por link"] },
    { x: 772, y: 175, r: -0.03, t: ["rever preço", "plano Pro"] },
  ];
  ctx.font = "600 25px 'Marker Felt', 'Bradley Hand', 'Segoe Print', cursive";
  for (const n of notes) {
    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.rotate(n.r);
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(-66, -58, 140, 128);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-70, -64, 140, 128);
    ctx.fillStyle = "#1c1c1e";
    ctx.fillText(n.t[0], -56, -12);
    ctx.fillText(n.t[1], -56, 24);
    ctx.restore();
  }
  ctx.strokeStyle = "#007aff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(772, 178, 104, 90, 0.05, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 6;
  const k = 34;
  for (const [x, y, dx, dy] of [[70, 55, 1, 1], [W - 70, 55, -1, 1], [70, H - 55, 1, -1], [W - 70, H - 55, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * k);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * k, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createGlasses(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0xffffff, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, 0, 9);

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfeaff, 0.8);
  rim.position.set(-5, 2, -4);
  scene.add(rim);

  const acetate = new THREE.MeshPhysicalMaterial({
    color: 0x060607, roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.9,
    side: THREE.DoubleSide,
  });
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.22, metalness: 1 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x0b1411, roughness: 0.04, metalness: 0.1, ior: 1.52, specularIntensity: 1,
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.3, transparent: true, opacity: 0.93,
  });

  const root = new THREE.Group();
  scene.add(root);
  const glasses = new THREE.Group();
  root.add(glasses);
  const front = new THREE.Group();
  front.position.z = -FRONT_DEPTH / 2;
  glasses.add(front);

  for (const side of [-1, 1]) {
    front.add(new THREE.Mesh(bend(rimGeometry(side)), acetate));
    const lensGeo = new THREE.ExtrudeGeometry(new THREE.Shape(lensPoints(side)), { depth: 0.018, bevelEnabled: false, curveSegments: 1 });
    lensGeo.translate(0, 0, FRONT_DEPTH / 2 - 0.009);
    front.add(new THREE.Mesh(bend(lensGeo), glass));
  }
  front.add(new THREE.Mesh(bend(bridgeGeometry()), acetate));

  const visionMat = new THREE.MeshBasicMaterial({ map: visionTexture(), transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
  for (const side of [-1, 1]) {
    const g = planarUV(new THREE.ShapeGeometry(new THREE.Shape(lensPoints(side))), -1.3, 1.3, -0.45, 0.45);
    g.translate(0, 0, FRONT_DEPTH / 2 + 0.012);
    const m = new THREE.Mesh(bend(g), visionMat);
    m.renderOrder = 2;
    front.add(m);
  }

  const edgeZ = wrapZ(1.33);
  const endGeo = new RoundedBoxGeometry(0.17, 0.25, 0.24, 3, 0.05);
  for (const side of [-1, 1]) {
    const end = new THREE.Mesh(endGeo, acetate);
    end.position.set(side * 1.33, 0.28, -0.05 + edgeZ);
    end.rotation.y = side * -0.16;
    glasses.add(end);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.19, 20), metal);
    barrel.position.set(side * (HINGE_X - 0.02), 0.27, -0.17 + edgeZ);
    glasses.add(barrel);
  }

  const anchors = {};
  const cameraModule = new THREE.Group();
  cameraModule.position.set(-1.3, 0.3, 0.08 + edgeZ);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.03, 40), metal);
  ring.rotation.x = Math.PI / 2;
  const eye = new THREE.Mesh(
    new THREE.CylinderGeometry(0.046, 0.046, 0.034, 40),
    new THREE.MeshPhysicalMaterial({ color: 0x05070a, roughness: 0.02, clearcoat: 1, envMapIntensity: 2.2 }),
  );
  eye.rotation.x = Math.PI / 2;
  eye.position.z = 0.004;
  cameraModule.add(ring, eye);
  cameraModule.rotation.y = 0.16;
  glasses.add(cameraModule);
  anchors.camera = cameraModule;

  const ledMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2e, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.3 });
  const led = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 24), ledMat);
  led.rotation.set(Math.PI / 2, 0, 0.16);
  led.position.set(1.3, 0.3, 0.075 + edgeZ);
  glasses.add(led);
  anchors.led = led;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture("rgba(120,180,255,0.9)", "rgba(120,180,255,0)"), transparent: true, opacity: 0, depthWrite: false,
  }));
  glow.scale.setScalar(0.5);
  glow.position.set(1.3, 0.3, 0.12 + edgeZ);
  glasses.add(glow);

  const templeGeo = templeGeometry();
  const temples = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * HINGE_X, 0.27, -0.17 + edgeZ);
    const arm = new THREE.Mesh(templeGeo, acetate);
    arm.position.x = side * -0.02;
    pivot.add(arm);
    glasses.add(pivot);
    temples.push({ side, pivot });
    if (side === -1) {
      const mic = new THREE.Object3D();
      mic.position.set(-0.06, -0.08, -0.5);
      const speaker = new THREE.Object3D();
      speaker.position.set(-0.06, -0.01, -1.9);
      pivot.add(mic, speaker);
      anchors.mic = mic;
      anchors.speaker = speaker;
    }
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 1.8),
    new THREE.MeshBasicMaterial({ map: radialTexture("rgba(0,0,0,0.5)", "rgba(0,0,0,0)"), transparent: true, depthWrite: false, opacity: 0 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  const cur = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, fold: 0, lens: 0, shadow: 0 };
  const target = { ...cur };
  let snapNext = true;
  let ledTarget = 0;
  let ledValue = 0;

  const drag = { active: false, id: null, lastX: 0, lastY: 0, yaw: 0, pitch: 0, vYaw: 0, vPitch: 0 };
  const reaction = { kind: null, t: 0 };
  let running = false;
  let raf = 0;
  let last = performance.now();
  let elapsed = 0;
  let dirty = true;

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    drag.active = true;
    drag.id = e.pointerId;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ponteiro sintético sem captura */
    }
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag.active || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.yaw += dx * 0.011;
    drag.pitch = THREE.MathUtils.clamp(drag.pitch + dy * 0.006, -0.7, 0.7);
    drag.vYaw = dx * 0.011 * 60;
    drag.vPitch = dy * 0.006 * 60;
    dirty = true;
  });
  const release = (e) => {
    if (e.pointerId !== drag.id) return;
    drag.active = false;
    canvas.classList.remove("dragging");
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  resize();
  window.addEventListener("resize", resize);

  function reactionOffset(dt) {
    if (!reaction.kind) return { pitch: 0, yaw: 0, roll: 0 };
    reaction.t += dt;
    const t = reaction.t;
    const decay = Math.exp(-t * 3.2);
    let out = { pitch: 0, yaw: 0, roll: 0 };
    if (reaction.kind === "nod") out.pitch = Math.sin(t * 13) * 0.22 * decay;
    if (reaction.kind === "shake") out.yaw = Math.sin(t * 16) * 0.3 * decay;
    if (reaction.kind === "perk") out = { pitch: -0.12 * Math.sin(Math.min(t * 5, Math.PI)), yaw: 0, roll: 0.06 * Math.sin(t * 9) * decay };
    if (t > 1.6) reaction.kind = null;
    return out;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += dt;

    const k = snapNext ? 1 : 1 - Math.exp(-dt * 5.5);
    snapNext = false;
    let moving = false;
    for (const key of POSE_KEYS) {
      const d = target[key] - cur[key];
      if (Math.abs(d) > 1e-4) moving = true;
      cur[key] += d * k;
    }

    if (!drag.active) {
      const stiffness = 38;
      const damping = 10;
      drag.vYaw += (-stiffness * drag.yaw - damping * drag.vYaw) * dt;
      drag.vPitch += (-stiffness * drag.pitch - damping * drag.vPitch) * dt;
      drag.yaw += drag.vYaw * dt;
      drag.pitch += drag.vPitch * dt;
      if (Math.abs(drag.yaw) + Math.abs(drag.vYaw) + Math.abs(drag.pitch) + Math.abs(drag.vPitch) > 1e-3) moving = true;
      else drag.yaw = drag.pitch = drag.vYaw = drag.vPitch = 0;
    } else moving = true;

    ledValue += (ledTarget - ledValue) * (1 - Math.exp(-dt * 10));
    if (Math.abs(ledTarget - ledValue) > 1e-3) moving = true;
    if (reaction.kind) moving = true;

    const idle = !reducedMotion;
    if (!moving && !idle && !dirty) return;
    dirty = false;

    const r = reactionOffset(dt);
    const float = idle ? Math.sin(elapsed * 1.1) * 0.035 : 0;
    const sway = idle ? Math.sin(elapsed * 0.45) * 0.05 : 0;

    root.position.set(cur.x, cur.y + float, cur.z);
    root.scale.setScalar(cur.s);
    glasses.rotation.set(cur.rx + drag.pitch + r.pitch, cur.ry + drag.yaw + sway + r.yaw, cur.rz + r.roll, "YXZ");

    for (const { side, pivot } of temples) {
      pivot.rotation.y = side * (-0.06 + cur.fold * (side === 1 ? 1.5 : 1.62));
      pivot.position.z = -0.17 + edgeZ - (side === -1 ? cur.fold * 0.12 : 0);
    }

    visionMat.opacity = cur.lens;
    glass.opacity = 0.97 - cur.lens * 0.3;
    ledMat.emissiveIntensity = ledValue * 2.4;
    glow.material.opacity = ledValue * 0.9;
    glow.scale.setScalar(0.14 + ledValue * 0.08 + (ledValue > 0.5 && idle ? Math.sin(elapsed * 6) * 0.015 : 0));

    shadow.position.set(cur.x, cur.y - 0.72 * cur.s, cur.z - 0.6 * cur.s);
    shadow.scale.setScalar(cur.s);
    shadow.material.opacity = cur.shadow * 0.32;

    renderer.render(scene, camera);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    dirty = true;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

  const v = new THREE.Vector3();
  function project(name) {
    const obj = anchors[name];
    if (!obj) return null;
    obj.getWorldPosition(v);
    v.project(camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }

  return {
    setTarget(pose, { snap = false } = {}) {
      Object.assign(target, pose);
      if (snap) {
        Object.assign(cur, pose);
        snapNext = true;
      }
      dirty = true;
    },
    setLed(on) {
      ledTarget = on ? 1 : 0;
      dirty = true;
    },
    react(kind) {
      if (reducedMotion) return;
      reaction.kind = kind;
      reaction.t = 0;
    },
    project,
    start,
    stop,
  };
}
