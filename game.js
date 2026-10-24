// =====================================================================
//  ホルムズ海峡を駆け抜けろ！ — メインゲーム
//  ※地名をモチーフにした架空のゲームです。数値・兵器は全てゲーム用の架空設定です。
// =====================================================================
(() => {
'use strict';
const C = window.CONFIG;

// ---------------------------------------------------------------- debug（開発用）
// デバッグモードは開発用の起動ページから開いたときだけ有効（開発用スクリプトが設定を用意する）。
// デバッグ用の開始・終了の印で囲んだ部分は、公開用ビルド（build_public）で丸ごと削除される。
// 公開版では DBG は常に null なので、無敵などは一切働かない。
let DBG = null;
function invincible() { return !!(DBG && DBG.invincible); }

// ---------------------------------------------------------------- utils
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrapAngle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const rand = (a, b) => a + Math.random() * (b - a);
const fmtUSD = (v) => (v < 0 ? '-' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- map
// プレイヤーは -z 方向（北）へ進むと湾内。右手(+x)がイラン側、左手(-x)がオマーン側。
// 航路の長さ方向（z）だけを L 倍する。海峡の幅・船や施設の大きさ・船速は変えない。
const L = C.MAP_LENGTH_SCALE || 1;
const MAP = { Z_VLCC: 960 * L, Z_TERM: -960 * L, STRAIT_ENTRY_Z: 400 * L, STRAIT_HALF: 115, OPEN_HALF: 430, ZMAX: 960 * L + 290, IRAN_WATERS: 60,
  HAZARD_Z: 900 * L,      // 浅瀬・領海ライン・敵が活動する範囲
  LAND_Z: 960 * L + 840 };
const halfWidth = (z) => lerp(MAP.STRAIT_HALF, MAP.OPEN_HALF, smoothstep(250 * L, 600 * L, Math.abs(z)));
const centerX = (z) => 90 * Math.sin(z / (420 * L));
const omanShore = (z) => centerX(z) - halfWidth(z);
const iranShore = (z) => centerX(z) + halfWidth(z);
const shoalWidth = (z) => { const k = 1 - smoothstep(500 * L, 800 * L, Math.abs(z)); return 6 + k * (16 + 12 * (0.5 + 0.5 * Math.sin(z / 55))); };
const VLCC_POS = { x: centerX(MAP.Z_VLCC), z: MAP.Z_VLCC + 48 };
const VLCC_ZONE = { x: centerX(MAP.Z_VLCC), z: MAP.Z_VLCC, r: 60 };
const TERM_ZONE = { x: centerX(MAP.Z_TERM), z: MAP.Z_TERM, r: 60 };
const TERM_ISLAND = { x: centerX(MAP.Z_TERM), z: MAP.Z_TERM - 150, r: 55 };

// ---------------------------------------------------------------- three setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
// スマートフォン（タッチ端末）は描画解像度を少し下げて、処理負荷と発熱を抑える（PCは従来どおり最大2倍）
const COARSE_POINTER = !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, COARSE_POINTER ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const SKY = 0xbfd4dc;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 350, 1300);
function setSky(hex) { scene.background.setHex(hex); scene.fog.color.setHex(hex); }
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 5000);
camera.position.set(0, 300, 1400);
scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x445566, 0.8));
const sun = new THREE.DirectionalLight(0xfff1d6, 0.8);
sun.position.set(-300, 500, 200);
scene.add(sun);
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
// スマートフォンの画面回転では、回転が終わってからもう一度サイズを合わせる
window.addEventListener('orientationchange', () => setTimeout(onResize, 300));

const mat = (color, extra) => new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {}));
const box = (w, h, d, color, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.position.set(x, y, z); return m; };

// ---------------------------------------------------------------- static world
function buildWorld() {
  // 海面
  const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshPhongMaterial({ color: 0x1e6e8e, shininess: 70, specular: 0x446677 }));
  water.rotation.x = -Math.PI / 2;
  scene.add(water);

  // 陸地（左右の帯状メッシュ）
  for (const side of [-1, 1]) {
    const rows = [], cols = 26, pos = [], col = [], idx = [];
    for (let z = -MAP.LAND_Z; z <= MAP.LAND_Z; z += 20) rows.push(z);
    rows.forEach((z, i) => {
      const shore = side < 0 ? omanShore(z) : iranShore(z);
      for (let j = 0; j < cols; j++) {
        const u = j / (cols - 1);
        const d = j === 0 ? -5 : 3 + Math.pow(u, 1.6) * 2600;
        const x = shore + side * d;
        let h;
        if (j === 0) h = -3;
        else if (j === 1) h = 0.8;
        else {
          const n = 0.55 + 0.25 * Math.sin(x * 0.011 + z * 0.006) + 0.2 * Math.sin(x * 0.031 - z * 0.022);
          h = 0.8 + Math.min(d / 120, 1) * (side > 0 ? 55 : 34) * n + Math.min(d / 900, 1) * (side > 0 ? 70 : 28);
        }
        pos.push(x, h, z);
        const c = new THREE.Color();
        if (h < 2.5) c.setRGB(0.86, 0.79, 0.6);
        else {
          const t = clamp(h / 120, 0, 1);
          if (side > 0) c.setRGB(lerp(0.66, 0.52, t), lerp(0.53, 0.45, t), lerp(0.38, 0.4, t));
          else c.setRGB(lerp(0.72, 0.55, t), lerp(0.58, 0.43, t), lerp(0.4, 0.32, t));
        }
        col.push(c.r, c.g, c.b);
        if (i > 0 && j > 0) {
          const a = (i - 1) * cols + (j - 1), b = (i - 1) * cols + j, c2 = i * cols + (j - 1), d2 = i * cols + j;
          idx.push(a, b, d2, a, d2, c2);
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  }

  // 浅瀬（オマーン側の明るい帯）とイラン側領海ライン
  scene.add(ribbon((z) => omanShore(z) - 2, (z) => omanShore(z) + shoalWidth(z), -MAP.HAZARD_Z, MAP.HAZARD_Z, 0.12, 0x5fd0c0, 0.55));
  scene.add(ribbon((z) => iranShore(z) - MAP.IRAN_WATERS - 1, (z) => iranShore(z) - MAP.IRAN_WATERS + 1, -MAP.HAZARD_Z, MAP.HAZARD_Z, 0.15, 0xff4030, 0.55));

  // 推奨航路ブイ
  for (let z = -860 * L; z <= 860 * L; z += 72) {
    const cx = centerX(z);
    scene.add(buoy(cx - 48, z, 0xd03a2a));
    scene.add(buoy(cx + 48, z, 0x2aa04a));
  }
  // 海峡入口（契約破棄限界線）の黄色ブイ列
  const ez = MAP.STRAIT_ENTRY_Z;
  for (let x = omanShore(ez) + 8; x < iranShore(ez) - 4; x += 22) scene.add(buoy(x, ez, 0xf2c14e, 1.3));

  // VLCC
  const vlcc = makeTanker({ len: 120, wid: 22, hull: 0x2b3a4a, upper: 0x1d2730, deck: 0x6d6f60, scale: 1 });
  vlcc.position.set(VLCC_POS.x, -1, VLCC_POS.z);
  vlcc.rotation.y = Math.PI / 2;
  scene.add(vlcc);

  // 原油ターミナル（島＋タンク＋桟橋）
  const isl = new THREE.Mesh(new THREE.CylinderGeometry(TERM_ISLAND.r, TERM_ISLAND.r + 8, 6, 20), mat(0xcbb98a));
  isl.position.set(TERM_ISLAND.x, 0, TERM_ISLAND.z);
  scene.add(isl);
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 10, 16), mat(0xe6e6e0));
    t.position.set(TERM_ISLAND.x - 28 + (i % 3) * 26, 8, TERM_ISLAND.z - 15 + Math.floor(i / 3) * 26);
    scene.add(t);
  }
  const flare = box(1.5, 30, 1.5, 0x777777, TERM_ISLAND.x + 40, 15, TERM_ISLAND.z - 25); scene.add(flare);
  scene.add(box(6, 2, 50, 0x8a8a80, TERM_ISLAND.x, 2, TERM_ISLAND.z + 80));
  scene.add(box(30, 3, 8, 0x8a8a80, TERM_ISLAND.x, 2.5, TERM_ISLAND.z + 105));
  const arm = box(1.2, 12, 1.2, 0xf2a03a, TERM_ISLAND.x + 10, 9, TERM_ISLAND.z + 105); scene.add(arm);

  // 3Dラベル
  addLabel('VLCC（依頼主）', VLCC_POS.x, 30, VLCC_POS.z);
  addLabel('原油積込ターミナル', TERM_ISLAND.x, 30, TERM_ISLAND.z);
  addLabel('▼ 海峡入口（契約破棄 限界線）', centerX(ez), 8, ez);
  addLabel('ホルムズ海峡', centerX(0), 14, 0);
  addLabel('イラン側（武装艇に注意）', iranShore(150) + 120, 70, 150);
  addLabel('オマーン側（浅瀬・岩礁注意）', omanShore(-150) - 100, 45, -150);
}

function ribbon(fLo, fHi, z0, z1, y, color, opacity) {
  const pos = [], idx = [];
  let n = 0;
  for (let z = z0; z <= z1; z += 10) {
    pos.push(fLo(z), y, z, fHi(z), y, z);
    if (n > 0) { const a = (n - 1) * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
}

function buoy(x, z, color, s = 1) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6 * s, 0.9 * s, 2.4 * s, 8), mat(color));
  b.position.y = 1 * s;
  g.add(b);
  g.position.set(x, 0, z);
  return g;
}

function makeTanker(o) {
  const g = new THREE.Group();
  const L = o.len, W = o.wid, s = L / 30;
  g.add(box(W, 2.6 * s, L * 0.86, o.hull, 0, 0.3 * s, -L * 0.04));
  g.add(box(W * 1.02, 1.6 * s, L * 0.86, o.upper, 0, 2.3 * s, -L * 0.04));
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.5, W * 0.5, 4.2 * s, 3, 1), mat(o.upper));
  bow.position.set(0, 1.1 * s, L * 0.39);
  bow.scale.z = 0.9;
  bow.rotation.y = Math.PI / 6 + Math.PI;
  g.add(bow);
  g.add(box(W * 0.86, 0.25 * s, L * 0.8, o.deck, 0, 3.15 * s, -L * 0.02));
  g.add(box(W * 0.12, 0.5 * s, L * 0.7, 0x9a8a50, 0, 3.4 * s, 0));
  const sup = box(W * 0.85, 5 * s, L * 0.17, 0xeeeeea, 0, 5.6 * s, -L * 0.33);
  g.add(sup);
  g.add(box(W * 1.1, 0.8 * s, L * 0.08, 0xdedede, 0, 7.6 * s, -L * 0.3));
  g.add(box(W * 0.25, 3 * s, W * 0.25, 0xb8322a, 0, 8.6 * s, -L * 0.4));
  return g;
}

// ---------------------------------------------------------------- labels
const labels = [];
function addLabel(text, x, y, z, dyn) {
  const el = document.createElement('div');
  el.textContent = text;
  $('labels').appendChild(el);
  const l = { el, pos: new THREE.Vector3(x, y, z), dyn };
  labels.push(l);
  return l;
}
const _v = new THREE.Vector3();
function updateLabels() {
  const show = G.mode !== 'title';
  for (const l of labels) {
    _v.copy(l.pos).project(camera);
    const d = camera.position.distanceTo(l.pos);
    if (!show || _v.z > 1 || d > 1500 || (l.hidden)) { l.el.style.display = 'none'; continue; }
    l.el.style.display = 'block';
    l.el.style.left = ((_v.x + 1) / 2 * window.innerWidth) + 'px';
    l.el.style.top = ((1 - _v.y) / 2 * window.innerHeight) + 'px';
    l.el.style.opacity = clamp(1.4 - d / 1100, 0.2, 1);
  }
}

// ---------------------------------------------------------------- particles
const geoSphere = new THREE.IcosahedronGeometry(1, 0);
const geoDisc = new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2);
const geoRing = new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2);
const particles = [];
function spawn(o) {
  const m = new THREE.Mesh(o.geo || geoSphere, new THREE.MeshBasicMaterial({ color: o.color, transparent: true, opacity: o.opacity == null ? 1 : o.opacity, depthWrite: false, fog: o.fog !== false }));
  m.position.copy(o.pos);
  m.scale.setScalar(o.size || 1);
  scene.add(m);
  particles.push({ m, vel: o.vel || new THREE.Vector3(), life: o.life, max: o.life, size: o.size || 1, grow: o.grow || 0, op: o.opacity == null ? 1 : o.opacity, grav: o.grav || 0, drag: o.drag || 0 });
  return m;
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { scene.remove(p.m); p.m.material.dispose(); particles.splice(i, 1); continue; }
    const t = 1 - p.life / p.max;
    p.vel.y -= p.grav * dt;
    if (p.drag) p.vel.multiplyScalar(Math.exp(-p.drag * dt));
    p.m.position.addScaledVector(p.vel, dt);
    p.m.scale.setScalar(p.size * (1 + p.grow * t));
    p.m.material.opacity = p.op * (1 - t);
  }
}
function explosion(x, y, z, power = 1, fiery = false) {
  const P = new THREE.Vector3(x, y, z);
  spawn({ pos: P, color: 0xfff0b0, size: 3 * power, grow: 4, life: 0.45, fog: false });
  const nf = Math.round((fiery ? 16 : 9) * power);
  for (let i = 0; i < nf; i++) {
    spawn({ pos: P.clone().add(new THREE.Vector3(rand(-2, 2), rand(0, 2), rand(-2, 2))), vel: new THREE.Vector3(rand(-14, 14), rand(6, 24), rand(-14, 14)).multiplyScalar(power), color: Math.random() < 0.5 ? 0xff8a20 : 0xffc040, size: rand(1.5, 3) * power, grow: 1.5, life: rand(0.5, 1.1), drag: 2 });
  }
  for (let i = 0; i < nf; i++) {
    spawn({ pos: P.clone().add(new THREE.Vector3(rand(-3, 3), rand(1, 4), rand(-3, 3))), vel: new THREE.Vector3(rand(-3, 3), rand(4, 9), rand(-3, 3)), color: fiery ? 0x2a2522 : 0x777777, size: rand(1.2, 2.4) * power, grow: 2.2, life: rand(1.6, 2.8), opacity: 0.6, drag: 0.6 });
  }
  if (y < 4) for (let i = 0; i < 10 * power; i++) {
    spawn({ pos: P.clone(), vel: new THREE.Vector3(rand(-6, 6), rand(14, 28), rand(-6, 6)), color: 0xeef6ff, size: rand(1, 2) * power, grow: 0.5, life: rand(0.8, 1.4), grav: 25 });
  }
  shake(Math.min(3, 0.6 * power + (fiery ? 0.8 : 0)));
}
function splash(x, z, s = 1) {
  for (let i = 0; i < 4; i++) spawn({ pos: new THREE.Vector3(x, 0.2, z), vel: new THREE.Vector3(rand(-2, 2), rand(5, 10), rand(-2, 2)).multiplyScalar(s), color: 0xeef6ff, size: 0.5 * s, grow: 0.5, life: 0.6, grav: 22 });
}

// ---------------------------------------------------------------- audio
let AC = null;
function ac() { if (G.quit) return null; if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } } return AC; }
function noise(dur, vol, freq) {
  const a = ac(); if (!a) return;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = a.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(sfxOut(a)); src.start();
}
function beep(freq, dur, vol = 0.08, type = 'square') {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g); g.connect(sfxOut(a)); o.start(); o.stop(a.currentTime + dur);
}
// 効果音はすべてこの出口を通る（効果音の音量はBGMとは別に調整）
function sfxOut(a) {
  if (!a.sfxGain) { a.sfxGain = a.createGain(); a.sfxGain.connect(a.destination); }
  a.sfxGain.gain.value = sound.sfxVol;
  return a.sfxGain;
}

// ---------------------------------------------------------------- sound settings
// プレイヤーのサウンド設定（BGMのON/OFF・BGM音量・効果音音量）。ブラウザ内に保存する。
const BGMC = window.BGM_CONFIG || { SCENES: {}, DEFAULTS: {}, LOOP_CROSSFADE_SEC: 3 };
const SOUND_KEY = 'hormuz_sound_settings_v1';
const sound = (() => {
  const d = BGMC.DEFAULTS || {};
  const s = { bgmOn: d.BGM_ON !== false, bgmVol: d.BGM_VOLUME == null ? 0.6 : d.BGM_VOLUME, sfxVol: d.SFX_VOLUME == null ? 0.8 : d.SFX_VOLUME };
  try {
    const v = JSON.parse(localStorage.getItem(SOUND_KEY) || 'null');
    if (v) { if (typeof v.bgmOn === 'boolean') s.bgmOn = v.bgmOn; if (isFinite(v.bgmVol)) s.bgmVol = clamp(+v.bgmVol, 0, 1); if (isFinite(v.sfxVol)) s.sfxVol = clamp(+v.sfxVol, 0, 1); }
  } catch (e) { /* 保存できない環境では初期値のまま */ }
  return s;
})();
function saveSound() {
  try { localStorage.setItem(SOUND_KEY, JSON.stringify(sound)); } catch (e) { /* 保存できない環境では無視 */ }
  if (AC && AC.sfxGain) AC.sfxGain.gain.value = sound.sfxVol;
}

// ---------------------------------------------------------------- BGM
// 場面ごとの曲は bgm_config.js で設定する。ここでは「再生・ループ・フェード・音量」だけを扱う。
// ・同じ曲が続く場面では曲を最初に戻さず、音量だけをなめらかに変える（二重再生しない）
// ・ループは曲の終わり際に頭から重ねてつなぐ（クロスフェード）
// ・ブラウザの自動再生制限のため、プレイヤーが最初にクリックかキー操作をするまで鳴らさない
// iPhone/iPad の Safari は音声要素の音量（volume）を変更できないため、その環境だけ
// Web Audio の音量調整（GainNode）を経由させ、操作時に許可を得た音声要素を使い回す。PC・Android は従来どおり。
const VOLUME_LOCKED = (() => { try { const a = new Audio(); a.volume = 0.5; return Math.abs(a.volume - 0.5) > 0.01; } catch (e) { return false; } })();
const bgm = {
  unlocked: false, scene: undefined, track: null, voices: [], suspended: false, pool: [],
  // 再生用の音声要素を用意する（iOSでは使い回しの要素を貸し出す）
  takeEl(src) {
    if (!VOLUME_LOCKED) { const el = new Audio(src); el.preload = 'auto'; return el; }
    let el = this.pool.find((p) => !p._inUse);
    if (!el) { el = new Audio(); el.preload = 'auto'; el._pooled = true; this.pool.push(el); this.route(el); }
    el._inUse = true; el.src = src;
    return el;
  },
  // iOS用：音声要素 → 音量調整 → スピーカー の経路を作る（AudioContext ができてから）
  route(el) {
    if (!VOLUME_LOCKED || el._gain || !AC) return;
    try { const srcNode = AC.createMediaElementSource(el); el._gain = AC.createGain(); el._gain.gain.value = 0; srcNode.connect(el._gain); el._gain.connect(AC.destination); } catch (e) { /* 無視 */ }
  },
  setVol(v, x) {
    if (v.el._gain) v.el._gain.gain.value = x; else v.el.volume = x;
  },
  releaseEl(el) {
    try { el.pause(); } catch (e) { /* 無視 */ }
    el.onended = null; el.onerror = null; el.onloadedmetadata = null;
    if (el._pooled) { el._inUse = false; if (el._gain) el._gain.gain.value = 0; return; }
    try { el.removeAttribute('src'); el.load(); } catch (e) { /* 無視 */ }
  },
  // 画面が隠れたとき（アプリ切り替え・着信など）は止め、戻ったら同じ曲の続きから再開する（二重再生しない）
  suspend() { this.suspended = true; for (const v of this.voices) { try { v.el.pause(); } catch (e) { /* 無視 */ } } },
  resume() {
    if (!this.suspended) return;
    this.suspended = false;
    for (const v of this.voices) if (v.started && !G.quit) { const p = v.el.play(); if (p && p.catch) p.catch(() => { v.started = false; }); }
  },
  // iOS用：プレイヤーの操作中に、使い回し用の音声要素へ再生の許可を与える
  bless() {
    if (!VOLUME_LOCKED || !AC) return;
    while (this.pool.length < 4) { const el = new Audio(); el.preload = 'auto'; el._pooled = true; this.pool.push(el); }
    const any = Object.values(BGMC.SCENES || {}).find((s) => s && s.file);
    for (const el of this.pool) {
      this.route(el);
      if (el._blessed) continue;
      el._blessed = true;
      if (!el._inUse && any) {
        el.src = encodeURI(any.file);
        const p = el.play();
        if (p && p.then) p.then(() => { if (!el._inUse) el.pause(); }).catch(() => { el._blessed = false; });
      }
    }
  },
  sceneCfg(name) { return (BGMC.SCENES && BGMC.SCENES[name]) || { file: null, fade: 1 }; },
  setScene(name) {
    if (name === this.scene) return;
    this.scene = name;
    const cfg = this.sceneCfg(name);
    const fade = Math.max(0.05, cfg.fade == null ? 1.5 : cfg.fade);
    if (this.track && cfg.file && this.track.file === cfg.file) { // 同じ曲：音量だけ変える
      this.track.cfg = cfg; this.track.volRate = 1 / fade; return;
    }
    for (const v of this.voices) { v.target = 0; v.rate = 1 / fade; v.retire = true; }
    this.track = null;
    if (cfg.file) {
      this.track = { file: cfg.file, cfg, vol: cfg.volume == null ? 1 : cfg.volume, volRate: 1 / fade };
      this.startVoice(cfg.loopStart || 0, fade);
    }
  },
  startVoice(at, fadeSec) {
    const t = this.track;
    const el = this.takeEl(encodeURI(t.file));
    el.onloadedmetadata = at > 0 ? () => { try { el.currentTime = at; } catch (e) { /* 無視 */ } } : null;
    const v = { el, track: t, fade: 0, target: 1, rate: 1 / Math.max(0.05, fadeSec), started: false, retire: false, handed: false };
    this.setVol(v, 0);
    el.onended = () => { if (!v.handed && !v.retire && this.track === t && t.cfg.loop !== false) { v.handed = true; v.retire = true; this.startVoice(t.cfg.loopStart || 0, 0.2); } };
    el.onerror = () => { v.retire = true; v.fade = 0; };
    this.voices.push(v);
    this.tryPlay(v);
  },
  tryPlay(v) {
    if (!this.unlocked || v.started || G.quit || this.suspended) return;
    v.started = true;
    const p = v.el.play();
    if (p && p.catch) p.catch(() => { v.started = false; }); // 自動再生が拒否されたら次の操作で再挑戦
  },
  update(dt) {
    if (this.suspended) return;
    const master = sound.bgmOn ? sound.bgmVol : 0;
    const t = this.track;
    if (t) {
      const goal = t.cfg.volume == null ? 1 : t.cfg.volume;
      t.vol += clamp(goal - t.vol, -t.volRate * dt, t.volRate * dt);
    }
    const XF = Math.max(0.5, BGMC.LOOP_CROSSFADE_SEC || 3);
    for (let i = this.voices.length - 1; i >= 0; i--) {
      const v = this.voices[i];
      this.tryPlay(v);
      v.fade += clamp(v.target - v.fade, -v.rate * dt, v.rate * dt);
      this.setVol(v, clamp(v.fade * (v.track.vol) * master, 0, 1));
      // ループ：終わりが近づいたら、頭から新しく再生して重ねる
      const c = v.track.cfg, d = v.el.duration;
      if (!v.retire && !v.handed && c.loop !== false && this.track === v.track && isFinite(d) && d > XF * 2) {
        const end = c.loopEnd || d;
        if (v.el.currentTime >= end - XF) { v.handed = true; v.retire = true; v.target = 0; v.rate = 1 / XF; this.startVoice(c.loopStart || 0, XF); }
      }
      if (v.retire && v.fade <= 0.001) { this.releaseEl(v.el); this.voices.splice(i, 1); }
    }
  },
  stopAll() {
    for (const v of this.voices) this.releaseEl(v.el);
    this.voices = []; this.track = null; this.scene = undefined;
  },
};
// 自動再生制限：最初のクリック・タップ・キー操作で音を解禁する。
// スマートフォンでは「操作の最中」に再生を始める必要があるため、ここで待機中の曲の再生も試みる。
function unlockAudio() {
  if (G.quit) return;
  bgm.unlocked = true;
  const a = ac();
  if (a && a.state === 'suspended' && !document.hidden) a.resume().catch(() => {});
  bgm.bless();
  for (const v of bgm.voices) bgm.tryPlay(v);
}
window.addEventListener('pointerdown', unlockAudio, true);
window.addEventListener('keydown', unlockAudio, true);
window.addEventListener('touchend', unlockAudio, true);
window.addEventListener('click', unlockAudio, true);
// 今の場面に合うBGMを選ぶ（場面と曲の対応は bgm_config.js）
function bgmSceneFor() {
  switch (G.mode) {
    case 'title': case 'intro': case 'captain': return 'TITLE';
    case 'play': case 'paused': case 'confirm': return G.stage >= 11 ? 'STAGE11' : (G.loaded ? 'VOYAGE_LOADED' : 'VOYAGE');
    case 'dying': return 'SINKING';
    case 'stage11': {
      const s = G.s11 || {};
      if (s.good) return s.quiet ? 'LEGEND_QUIET' : 'LEGEND_RADIO';
      return s.flash ? 'NORMAL_BLAST' : 'NORMAL_ALERT';
    }
    case 'result':
      if (G.resultReason === 'legend') return 'GAME_CLEAR';
      return (G.resultReason === 'retreat' || G.resultReason === 'cancel') ? 'RETREAT' : 'GAME_OVER';
    default: return null;
  }
}
// サウンド設定の操作部品（タイトル画面と一時停止画面に表示）
function soundPanelHtml() {
  return `<div class="soundPanel">
    <span class="lbl">BGM</span><button class="btn mini${sound.bgmOn ? ' on' : ''}" data-snd="toggle">${sound.bgmOn ? 'ON' : 'OFF'}</button>
    <input type="range" min="0" max="100" value="${Math.round(sound.bgmVol * 100)}" data-snd="bgm" aria-label="BGM音量">
    <span class="lbl">効果音</span><input type="range" min="0" max="100" value="${Math.round(sound.sfxVol * 100)}" data-snd="sfx" aria-label="効果音の音量">
    <span class="lbl hint pcOnly">M キーでBGMのON/OFF</span>
  </div>`;
}
function toggleBgm() {
  sound.bgmOn = !sound.bgmOn; saveSound();
  document.querySelectorAll('[data-snd="toggle"]').forEach((b) => { b.textContent = sound.bgmOn ? 'ON' : 'OFF'; b.classList.toggle('on', sound.bgmOn); });
}

// ---------------------------------------------------------------- game state
const G = {
  mode: 'title', stage: 1, banked: 0, cleared: 0, history: [], time: 0,
  throttle: 2, dash: false, gps: true, shakeAmt: 0,
  ship: { x: 0, z: 0, heading: Math.PI, speed: 0, vx: 0, vz: 0, rudder: 0, yawRate: 0, grounded: false },
};
let P = C.stageParams(1);
const shake = (a) => { G.shakeAmt = Math.max(G.shakeAmt, a); };

// プレイヤー船
const playerMesh = makeTanker({ len: 30, wid: 8, hull: 0x8a2a20, upper: 0x23303a, deck: 0x6b6f5a });
scene.add(playerMesh);
// GPS矢印 & 目的地ビーコン
const gpsArrow3D = new THREE.Group();
{
  const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6, 4).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd36a }));
  cone.position.z = 9;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 8), new THREE.MeshBasicMaterial({ color: 0xffd36a }));
  shaft.position.z = 3;
  gpsArrow3D.add(cone, shaft);
}
scene.add(gpsArrow3D);
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 260, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, fog: false }));
scene.add(beacon);
const zoneRing = new THREE.Mesh(geoRing, new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.6, depthWrite: false }));
scene.add(zoneRing);

// 動的オブジェクト
let rocks = [], mines = [], boats = [], bullets = [], drones = [], missiles = [];
function clearDynamic() {
  for (const arr of [rocks, mines, boats, bullets, drones, missiles]) for (const o of arr) { scene.remove(o.mesh); if (o.ring) scene.remove(o.ring); }
  rocks = []; mines = []; boats = []; bullets = []; drones = []; missiles = [];
}

function setupStage(s) {
  clearDynamic();
  P = C.stageParams(Math.min(s, 10));
  // 航路が L 倍に伸びた分、機雷・岩礁は L 倍にして配置密度を保つ（武装艇は BOAT_COUNT_SCALE 倍）
  const nRocks = Math.round(P.rocks * L), nMines = Math.round(P.mines * L), nBoats = Math.round(P.boats * (C.BOAT_COUNT_SCALE || L));
  // 岩礁
  for (let i = 0; i < nRocks; i++) {
    const z = rand(-650 * L, 650 * L), r = rand(3, 6.5);
    const x = omanShore(z) + shoalWidth(z) + rand(-4, 28);
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat(0x6e675e));
    m.position.set(x, r * 0.25, z);
    m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    m.scale.y = 0.7;
    scene.add(m);
    rocks.push({ x, z, r, mesh: m, cd: 0 });
  }
  // 機雷（回避可能な配置）
  let tries = 0;
  while (mines.length < nMines && tries++ < 6000) {
    const z = Math.random() < 0.7 ? rand(-450 * L, 450 * L) : rand(-800 * L, 800 * L);
    const lo = omanShore(z) + shoalWidth(z) + 10, hi = iranShore(z) - 14;
    const x = rand(lo, hi);
    if (mines.some((m) => Math.hypot(m.x - x, m.z - z) < C.MINE_MIN_SPACING)) continue;
    if (rocks.some((r) => Math.hypot(r.x - x, r.z - z) < r.r + 25)) continue;
    if (mines.filter((m) => Math.abs(m.z - z) < 30).length >= 2) continue;
    mines.push({ x, z, mesh: makeMine(x, z), ph: rand(0, 6) });
  }
  // 武装小型艇
  for (let i = 0; i < nBoats; i++) {
    const z = lerp(-600 * L, 600 * L, (i + 0.5) / nBoats) + rand(-40, 40);
    const x = iranShore(z) - rand(30, 60);
    const m = makeBoat();
    scene.add(m);
    // 警戒マーカー（黄=警戒中、赤=発見）
    const mk = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), new THREE.MeshBasicMaterial({ color: 0xffd040, fog: false }));
    mk.position.y = 6; mk.visible = false; m.add(mk);
    boats.push({ mesh: m, marker: mk, x, z, homeX: x, homeZ: z, heading: rand(0, 6), speed: 0, state: 'patrol', t: rand(0, 10), cool: 0, fireCd: 2, burstLeft: 0, burstT: 0, warned: false, warnBurst: false, chaseT: 0, ph: rand(0, 6), bumpCd: 0,
      alert: 0, vigilance: rand(0.8, 1.2), vx: 0, vz: 0 });
  }
}

function makeMine(x, z) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), mat(0x2a1d18)));
  const band = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.3, 6, 16), mat(0xe0a020));
  band.rotation.x = Math.PI / 2;
  g.add(band);
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.6, 4), mat(0x2a201a));
    const a = (i / 8) * Math.PI * 2, b = i % 2 ? 0.4 : -0.3;
    sp.position.set(Math.cos(a) * 2.3 * Math.cos(b), Math.sin(b) * 2.3, Math.sin(a) * 2.3 * Math.cos(b));
    sp.lookAt(0, 0, 0); sp.rotateX(Math.PI / 2);
    g.add(sp);
  }
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2010, fog: false }));
  light.position.y = 2.8;
  g.add(light);
  g.userData.light = light;
  const ripple = new THREE.Mesh(geoRing, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
  ripple.scale.setScalar(5);
  ripple.position.y = -0.2;
  g.add(ripple);
  g.scale.setScalar(1.3);
  g.position.set(x, 0.3, z);
  scene.add(g);
  return g;
}
function makeBoat() {
  const g = new THREE.Group();
  g.add(box(3.4, 1.2, 10, 0x55625e, 0, 0.4, 0));
  g.add(box(2.6, 1.5, 3, 0x3e4a47, 0, 1.6, -1));
  const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.4, 6), mat(0x111111));
  gun.rotation.x = Math.PI / 2; gun.position.set(0, 1.8, 3.2);
  g.add(gun);
  g.add(box(0.1, 0.9, 1.4, 0xc02020, 0, 3.0, -2));
  return g;
}
function makeDrone() {
  const g = new THREE.Group();
  g.add(box(0.9, 0.6, 4, 0x3a3f44));
  g.add(box(6, 0.15, 1.5, 0x4a5056, 0, 0, -0.6));
  g.add(box(2.2, 0.15, 0.8, 0x4a5056, 0, 0, -1.9));
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff3020, fog: false }));
  light.position.set(0, 0.5, 0);
  g.add(light);
  g.userData.light = light;
  g.scale.setScalar(1.3);
  return g;
}
function makeMissile() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 8).rotateX(Math.PI / 2), mat(0xdddddd));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 8).rotateX(Math.PI / 2), mat(0xaa2222));
  nose.position.z = 3.7;
  g.add(body, nose);
  return g;
}

// ---------------------------------------------------------------- ship helpers
function shipFwd() { return { x: Math.sin(G.ship.heading), z: Math.cos(G.ship.heading) }; }
// 船体（長方形）と点との距離
function shipDist(px, pz, halfL = 15, halfW = 4.2) {
  const S = G.ship, f = shipFwd();
  const dx = px - S.x, dz = pz - S.z;
  const along = dx * f.x + dz * f.z, side = dx * f.z - dz * f.x;
  return Math.hypot(Math.max(Math.abs(along) - halfL, 0), Math.max(Math.abs(side) - halfW, 0));
}
function shipSpeed() { return Math.hypot(G.ship.vx, G.ship.vz); }
function inZone(zn) { return Math.hypot(G.ship.x - zn.x, G.ship.z - zn.z) < zn.r; }

// ---------------------------------------------------------------- economy
function charge(amount, label, kind) {
  G.pending -= amount;
  G.losses += amount;
  G.lossBy[kind] = (G.lossBy[kind] || 0) + amount;
  const el = document.createElement('div');
  if (kind === 'fuel') el.className = 'fuel';
  el.textContent = `${label} -${fmtUSD(amount)}`;
  $('costs').appendChild(el);
  setTimeout(() => el.remove(), 3300);
  while ($('costs').children.length > 7) $('costs').firstChild.remove();
}
function damageHull(v) { if (invincible()) return; G.hull = Math.max(0, G.hull - v); }

let msgTimer = null;
function showMsg(text, color = '#fff', dur = 2.4) {
  const m = $('msg');
  m.textContent = text;
  m.style.color = color;
  m.style.opacity = 1;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => { m.style.opacity = 0; }, dur * 1000);
}

// ---------------------------------------------------------------- overlay screens
function overlay(html) { const o = $('overlay'); o.innerHTML = html; o.classList.remove('hidden'); }
function hideOverlay() { $('overlay').classList.add('hidden'); }
// 音量スライダー（BGM・効果音）。動かすとすぐ反映して保存する
$('overlay').addEventListener('input', (e) => {
  const k = e.target.dataset && e.target.dataset.snd;
  if (k === 'bgm') { sound.bgmVol = clamp(e.target.value / 100, 0, 1); saveSound(); }
  if (k === 'sfx') { sound.sfxVol = clamp(e.target.value / 100, 0, 1); saveSound(); }
});
$('overlay').addEventListener('change', (e) => { if (e.target.dataset && e.target.dataset.snd === 'sfx') beep(880, 0.12, 0.08, 'triangle'); e.target.blur && e.target.blur(); });
$('overlay').addEventListener('click', (e) => {
  if (G.quit) return; // 終了後は何も受け付けない
  if (e.target.closest('[data-snd="toggle"]')) { toggleBgm(); return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'quit') { quitGame(); return; }
  ac();
  if (act === 'start') { newGame(); }
  else if (act === 'sail') { beginSail(); }
  else if (act === 'next') { G.stage++; showIntro(); }
  else if (act === 'retreat') { endGame('retreat'); }
  else if (act === 'cancelYes') { doCancel(); }
  else if (act === 'cancelNo' || act === 'resume') { hideOverlay(); G.mode = 'play'; }
  else if (act === 'title') { showTitle(); }
});

function showTitle() {
  G.mode = 'title';
  $('hud').style.display = 'none';
  $('whiteout').style.opacity = 0; $('whiteout').textContent = '';
  clearDynamic();
  resetEventUI();
  setSky(SKY);
  overlay(`<div class="card">
    <div class="catch">君は世界を救えるか？</div>
    <h1>ホルムズ海峡を駆け抜けろ！</h1>
    <p class="sub">STRAIT RUNNER — 架空の海域を舞台にした船舶アクション</p>
    <p>あなたは小型タンカーの船長。インド洋側に停泊する超大型タンカー（VLCC）の船長から、<b>危険な海峡の向こうにある原油ターミナルから原油を運んでくる</b>仕事を請け負った。</p>
    <p>VLCCを出発し、ホルムズ海峡を抜けて湾内のターミナルで原油を積み込み、再び海峡を越えてVLCCへ戻れば契約完了。</p>
    <table>
      <tr><td>契約報酬（1往復）</td><td>$3,000,000</td></tr>
      <tr><td>被弾・座礁・ペナルティ</td><td>報酬から差し引き</td></tr>
      <tr><td>機雷・ミサイル直撃 / ドローン被弾上限</td><td class="neg">即ゲームオーバー</td></tr>
      <tr><td>ゲームオーバー時</td><td class="neg">累計報酬は全て失われる</td></tr>
      <tr><td>全ステージ</td><td>10</td></tr>
    </table>
    <p><b>稼ぐことより、どこで手を引くかが問われる。</b>契約を終えるたびに、次の仕事を受けるか撤退するかを選べる。</p>
    <p class="keys pcOnly"><b>操舵：</b>A/D または ←/→（押している間だけ舵が切れ、離すと中央に戻る。船は前進しながら弧を描いて曲がる）<br>
      <b>その他：</b>W/S・↑/↓ スロットル　Space ダッシュ　G GPS　P 一時停止（画面下のスイッチはマウスでも操作可）<br>
      <b>積み込み／引き渡し：</b>黄色い円の中で「停止」または十分に減速する</p>
    <p class="keys touchOnly"><b>操舵：</b>左下の ◀ ▶ を押している間だけ舵が切れ、離すと中央に戻る<br>
      <b>その他：</b>右下の ▲加速・▼減速、DASH、GPS　上の II で一時停止（横向きでプレイ）<br>
      <b>積み込み／引き渡し：</b>黄色い円の中で ▼ を押して「停止」にする</p>
    ${soundPanelHtml()}
    <div class="btns"><button class="btn on" data-act="start">世界を救ってみる</button><button class="btn" data-act="quit">他の仕事を探す</button></div>
  </div>`);
}

// 「他の仕事を探す」：ゲームを開始せずに終了する。
// 更新・入力・音を止め、タブを閉じられる環境なら閉じる。閉じられない場合は終了画面を出して停止したままにする。
function quitGame() {
  G.mode = 'quit';
  G.quit = true;
  cancelAnimationFrame(rafId);
  for (const k in keys) keys[k] = false;
  clearTimeout(msgTimer);
  if (AC) { try { AC.close(); } catch (e) { /* 無視 */ } AC = null; }
  bgm.stopAll();
  $('hud').style.display = 'none';
  $('labels').style.display = 'none';
  $('msg').style.opacity = 0;
  overlay(`<div class="card quitCard">
    <h2>お仕事探し、頑張ってください。</h2>
    <p>ゲームを終了しました。このタブを閉じてください。</p>
  </div>`);
  try { window.close(); } catch (e) { /* 閉じられない環境では終了画面のまま */ }
}

function newGame() {
  Object.assign(G, { stage: 1, banked: 0, cleared: 0, history: [] });
  showIntro();
}

function dangerBar(s) { const n = Math.min(s, 10); return '■'.repeat(n) + '□'.repeat(10 - n); }
function showIntro() {
  G.mode = 'intro';
  const s = G.stage;
  if (s >= 11) {
    overlay(`<div class="card"><h2>STAGE 11</h2>
      <p>契約報酬 <b>$3,000,000</b></p>
      <table><tr><td>危険度</td><td class="danger-meter">■■■■■■■■■■■ 測定不能</td></tr>
      <tr><td>海域情報</td><td>— 通信が混線している —</td></tr></table>
      <div class="btns"><button class="btn on" data-act="sail">出航</button></div></div>`);
    return;
  }
  const p = C.stageParams(s);
  const threats = ['機雷 ' + Math.round(p.mines * L) + '基', '武装小型艇 ' + Math.round(p.boats * (C.BOAT_COUNT_SCALE || L)) + '隻', '岩礁・浅瀬'];
  if (p.droneInterval) threats.push('自爆ドローン');
  if (p.missileInterval) threats.push('対艦ミサイル');
  if (p.gpsJam) threats.push('GPS妨害');
  overlay(`<div class="card"><h2>STAGE ${s} / ${C.STAGE_COUNT}</h2>
    <table>
      <tr><td>契約報酬（未清算）</td><td class="pos">${fmtUSD(C.CONTRACT_REWARD)}</td></tr>
      <tr><td>清算済み累計スコア</td><td>${fmtUSD(G.banked)}</td></tr>
      <tr><td>危険度</td><td class="danger-meter">${dangerBar(s)}</td></tr>
      <tr><td>確認された脅威</td><td>${threats.join(' / ')}</td></tr>
    </table>
    <p class="sub">ルート：VLCC出発 → 海峡通過 → 原油ターミナルで積込 → 海峡通過 → VLCCへ帰還<br>
    海峡入口（黄色いブイ列）を越えるまでは「契約破棄」が可能（違約金 ${fmtUSD(C.CANCEL_PENALTY)}）。</p>
    <div class="btns"><button class="btn on" data-act="sail">出航</button></div></div>`);
}

function resetShip() {
  Object.assign(G.ship, { x: VLCC_ZONE.x, z: VLCC_ZONE.z - 5, heading: Math.PI, speed: 0, vx: 0, vz: 0, rudder: 0, yawRate: 0, grounded: false });
}
function beginSail() {
  hideOverlay();
  Object.assign(G, {
    pending: C.CONTRACT_REWARD, losses: 0, lossBy: {}, loaded: false, hull: 100, droneHits: 0, droneDmg: 0,
    gunHits: 0, crewInjured: 0, phase: 'outbound', cancelLocked: false, progress: 0, stopTimer: 0, stopPenT: 0,
    iranT: 0, shoalT: 0, droneT: P.droneInterval, missileT: 0, gpsJam: 0, gpsJamCd: rand(8, 16),
    stageTime: 0, dash: false, throttle: 2, fireT: 0, boatAlert: false, s11: null, fuelT: 0, exposure: 1, omanSide: false,
  });
  resetShip();
  snapCamera();
  setSky(SKY);
  playerMesh.rotation.set(0, Math.PI, 0);
  $('hud').style.display = 'block';
  $('whiteout').style.opacity = 0; $('whiteout').textContent = '';
  resetEventUI();
  if (G.stage >= 11) {
    // 高評価ルート判定：ステージ1〜10の清算済み累計スコア（全ての減額を反映済み）で判定
    let good = G.cleared >= C.STAGE_COUNT && G.banked >= C.HIGH_RANK.THRESHOLD_USD;
    // 第11ステージも通常どおり出航して操船する。契約解除ラインに近づくと最終イベントが始まる（startFinalEvent）
    G.s11 = { t: 0, good, started: false };
  }
  updateButtons();
  setupStage(G.stage);
  P = C.stageParams(Math.min(G.stage, 10));
  G.droneT = P.droneInterval ? 18 : 0;
  G.missileT = P.missileInterval ? 25 : 0;
  G.mode = 'play';
  showMsg(`STAGE ${G.stage} 出航！\n原油ターミナルへ向かえ`, '#ffd36a', 2.6);
}

// 船長のセリフは dialogues.js で管理する。改行は画面でも改行し、記号はそのまま表示する。
// dialogues.js が読み込めなかった場合も、ゲームが止まらないよう予備のセリフを使う。
function captainLine(stage) {
  const D = window.DIALOGUES || {};
  const table = D.CAPTAIN_AFTER_STAGE || {};
  const text = String(table[stage] || D.DEFAULT || 'よく戻ったな。報酬は振り込んでおいた。もう一回頼めないか？').trim();
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/\r?\n/g, '<br>');
}

function stageClear() {
  G.mode = 'captain';
  G.banked += G.pending;
  G.cleared++;
  G.history.push({ stage: G.stage, pnl: G.pending, note: '清算' });
  beep(660, 0.15, 0.08, 'triangle'); setTimeout(() => beep(880, 0.25, 0.08, 'triangle'), 160);
  const last = G.stage >= C.STAGE_COUNT;
  const captain = captainLine(G.stage);
  overlay(`<div class="card captainCard"><h2>STAGE ${G.stage} 契約完了</h2>
    <div class="captain">VLCC船長：「${captain}」</div>
    <table>
      <tr><td>契約報酬</td><td>${fmtUSD(C.CONTRACT_REWARD)}</td></tr>
      ${lossRows()}
      <tr><td>今回の清算額</td><td class="${G.pending >= 0 ? 'pos' : 'neg'}">${fmtUSD(G.pending)}</td></tr>
      <tr><td>清算済み累計スコア</td><td class="pos">${fmtUSD(G.banked)}</td></tr>
    </table>
    <p class="sub">撤退すれば累計スコアが確定します。次の契約中に沈めば、全てを失います。</p>
    <div class="btns">
      <button class="btn on" data-act="next">${last ? 'さらに進む' : '次の契約を受ける'}</button>
      <button class="btn" data-act="retreat">仕事を終えて撤退する</button>
    </div></div>`);
}
function lossRows() {
  const names = { repair: '船体修理費', injury: '乗組員負傷補償', penalty: 'ペナルティ', fuel: '燃料費（ダッシュ）', minor: 'その他の軽微な損傷' };
  return Object.keys(names).filter((k) => G.lossBy[k]).map((k) => `<tr><td>${names[k]}</td><td class="neg">-${fmtUSD(G.lossBy[k])}</td></tr>`).join('');
}

function openCancel() {
  if (G.mode !== 'play' || G.phase !== 'outbound' || G.cancelLocked || G.stage >= 11) return; // 第11ステージは契約破棄不可
  G.mode = 'confirm';
  const pnl = G.pending - C.CANCEL_PENALTY;
  overlay(`<div class="card"><h2>契約を破棄しますか？</h2>
    <table>
      <tr><td>未清算の契約報酬</td><td>${fmtUSD(G.pending)}</td></tr>
      <tr><td>違約金</td><td class="neg">-${fmtUSD(C.CANCEL_PENALTY)}</td></tr>
      <tr><td>このステージの損益</td><td class="${pnl >= 0 ? 'pos' : 'neg'}">${fmtUSD(pnl)}</td></tr>
      <tr><td>破棄後の確定スコア</td><td>${fmtUSD(G.banked + pnl)}</td></tr>
    </table>
    <p class="sub">契約を破棄すると、その時点で仕事を終えて撤退となります。</p>
    <div class="btns"><button class="btn danger" data-act="cancelYes">破棄して撤退する</button><button class="btn" data-act="cancelNo">航行を続ける</button></div></div>`);
}
function doCancel() {
  const pnl = G.pending - C.CANCEL_PENALTY;
  G.banked += pnl;
  G.history.push({ stage: G.stage, pnl, note: '契約破棄' });
  endGame('cancel');
}

function gameOver(reason) {
  if (G.mode !== 'play' || invincible()) return; // 無敵中はダメージによるゲームオーバーなし
  G.mode = 'dying';
  G.dieT = 0;
  G.dieReason = reason;
  G.history.push({ stage: G.stage, pnl: -G.losses, note: '失敗' });
  const S = G.ship;
  explosion(S.x, 3, S.z, 2.2, true);
  noise(1.6, 0.5, 600);
  const texts = { mine: '機雷に接触！', missile: 'ミサイル直撃！', drone_empty: '航行不能！', drone_loaded: '積荷炎上・沈没！', hull: '船体損傷・航行不能！', collision: '激突・船体大破！' };
  showMsg(texts[reason] || 'ゲームオーバー', '#ff6b5e', 3);
}

const TITLES = [
  [0, '赤字の船長', '海峡を前に、帳簿だけが沈んだ。'],
  [1, '慎重すぎる見習い', '命あっての物種。悪くない判断だ。'],
  [3000000, '堅実な運び屋', '危険と報酬の天秤を、きちんと読めている。'],
  [9000000, '海峡の古狸', '危ない橋を渡りつつ、落ちる前に引き返す。'],
  [15000000, '命知らずの船長', 'その度胸、保険屋が泣いている。'],
  [21000000, '海峡の古強者', '酒場では、もうあなたの噂で持ちきりだ。'],
  [27000000, '引き際の神', '全てを手に入れ、そして生きて帰った。完璧だ。'],
];
function endGame(reason) {
  G.resultReason = reason; // BGMの選曲に使う
  G.mode = 'result';
  $('progress').style.display = 'none';
  const legend = reason === 'legend';
  const over = !['retreat', 'cancel', 'legend'].includes(reason);
  const reasonText = {
    retreat: '自主撤退', cancel: '自主撤退（契約破棄）', mine: '沈没（機雷に接触）', missile: '沈没（ミサイル直撃）',
    drone_empty: '航行不能（自爆ドローン被弾上限）', drone_loaded: '沈没（自爆ドローン被弾・積荷炎上）', hull: '航行不能（船体損傷）',
    collision: '航行不能（高速衝突による船体大破）', stage11: '第11ステージ', legend: 'ゲームクリア（高評価ルート・第11ステージ）',
  }[reason];
  const finalScore = over ? 0 : G.banked;
  let title, comment;
  if (legend) { title = 'ホルムズ海峡の伝説'; comment = '大量破壊兵器は使われなかった。あなたの航海が、この海峡を守り抜いた。'; }
  else if (reason === 'stage11') { title = '強欲の閃光'; comment = '欲張りすぎた。海峡は、もうどこにもない。'; }
  else if (over) { title = '海の藻屑'; comment = '引き際を見誤った。稼いだ金は、海の底へ。'; }
  else { for (const t of TITLES) if (finalScore >= t[0]) { title = t[1]; comment = t[2]; } if (finalScore <= 0) { title = TITLES[0][1]; comment = TITLES[0][2]; } }
  const hist = G.history.map((h) => `<tr><td>STAGE ${h.stage}（${h.note}）</td><td class="${h.pnl >= 0 ? 'pos' : 'neg'}">${fmtUSD(h.pnl)}</td></tr>`).join('');
  overlay(`<div class="card${legend ? ' legend' : ''}"><h2>${legend ? 'GAME CLEAR' : (over ? 'GAME OVER' : '航海終了')}</h2>
    ${legend ? '<p class="legendLabel">称号獲得</p>' : ''}
    <div class="titleName">「${title}」</div>
    <p style="text-align:center" class="sub">${comment}</p>
    <table>
      ${legend ? `<tr><td>ステージ1〜10の累計獲得額</td><td class="pos">${fmtUSD(G.banked)}</td></tr><tr><td>高評価ライン</td><td>${fmtUSD(C.HIGH_RANK.THRESHOLD_USD)} 以上</td></tr>` : ''}
      <tr><td>終了理由</td><td>${reasonText}</td></tr>
      <tr><td>到達ステージ</td><td>STAGE ${G.stage}</td></tr>
      <tr><td>成功した往復回数</td><td>${G.cleared} 回</td></tr>
      <tr><td>確定スコア</td><td class="${finalScore > 0 ? 'pos' : (finalScore < 0 ? 'neg' : '')}" style="font-size:20px">${fmtUSD(finalScore)}</td></tr>
      ${over ? `<tr><td>失敗した契約の損益（損害額）</td><td class="neg">${fmtUSD(-G.losses)}</td></tr>
      <tr><td>参考記録：ゲームオーバー前の累計獲得額</td><td>${fmtUSD(G.banked)}</td></tr>` : ''}
    </table>
    ${hist ? `<p class="sub" style="margin-bottom:0">ステージ別損益</p><table>${hist}</table>` : ''}
    <div class="btns"><button class="btn on" data-act="start">もう一度世界を救う</button><button class="btn" data-act="title">故郷へ帰る</button></div></div>`);
}

// ---------------------------------------------------------------- input
const keys = {};
const STEER_KEYS = ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
renderer.domElement.addEventListener('pointerdown', () => ac());
window.addEventListener('keydown', (e) => {
  if (G.quit) return;
  if (STEER_KEYS.includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (G.mode === 'play') {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') setThrottle(G.throttle + 1);
    if (e.code === 'KeyS' || e.code === 'ArrowDown') setThrottle(G.throttle - 1);
    if (e.code === 'Space') { e.preventDefault(); toggleDash(); }
    if (e.code === 'KeyG') toggleGps();
  }
  if (e.code === 'KeyM') { toggleBgm(); if (G.mode === 'play') showMsg(sound.bgmOn ? 'BGM ON' : 'BGM OFF', '#ffffff', 1.0); }
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});
// 一時停止／再開（キーボードの P・Esc と、スマートフォンの一時停止ボタンで共通）
function togglePause(forcePause) {
  if (G.mode === 'play') { G.mode = 'paused'; releaseAllInput(); overlay(`<div class="card" style="max-width:560px;text-align:center"><h2>一時停止</h2>${soundPanelHtml()}<div class="btns"><button class="btn on" data-act="resume">再開</button></div></div>`); }
  else if (G.mode === 'paused' && !forcePause) { hideOverlay(); G.mode = 'play'; }
}

// ---------------------------------------------------------------- touch（スマートフォン）
// タッチ端末では html に touch クラスを付け、画面上のタッチボタンを表示する（PCでは表示しない）。
const touchMQ = window.matchMedia ? window.matchMedia('(hover: none) and (pointer: coarse)') : null;
let forceTouchUI = false; // デバッグ用（PCでタッチUIを確認するとき）
function applyTouchMode() { document.documentElement.classList.toggle('touch', forceTouchUI || !!(touchMQ && touchMQ.matches)); }
applyTouchMode();
if (touchMQ && touchMQ.addEventListener) touchMQ.addEventListener('change', applyTouchMode);
const isTouchUI = () => document.documentElement.classList.contains('touch');
// 押している間だけ有効な操舵ボタン。指ごと（pointerId）に管理するので、複数の指が混線しない
const touchHold = { left: new Set(), right: new Set() };
function releaseAllInput() {
  for (const k in keys) keys[k] = false;
  touchHold.left.clear(); touchHold.right.clear();
  document.querySelectorAll('.tbtn.pressed').forEach((b) => b.classList.remove('pressed'));
}
window.addEventListener('blur', releaseAllInput);
document.querySelectorAll('#touchUI [data-hold]').forEach((btn) => {
  const set = touchHold[btn.dataset.hold];
  const release = (e) => { set.delete(e.pointerId); if (!set.size) btn.classList.remove('pressed'); };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { btn.setPointerCapture(e.pointerId); } catch (err) { /* 無視 */ }
    set.add(e.pointerId); btn.classList.add('pressed');
  });
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('lostpointercapture', release);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
});
// 押した瞬間に1回だけ反応するボタン（加速・減速・ダッシュ・GPS・一時停止・契約破棄）
const TAP_ACTIONS = {
  up: () => { if (G.mode === 'play') setThrottle(G.throttle + 1); },
  down: () => { if (G.mode === 'play') setThrottle(G.throttle - 1); },
  dash: () => { if (G.mode === 'play') toggleDash(); },
  gps: () => { if (G.mode === 'play') toggleGps(); },
  pause: () => togglePause(),
  cancel: () => openCancel(),
};
document.querySelectorAll('#touchUI [data-tap]').forEach((btn) => {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (btn.disabled || G.quit) return;
    ac();
    btn.classList.add('pressed');
    TAP_ACTIONS[btn.dataset.tap]();
  });
  const off = () => btn.classList.remove('pressed');
  btn.addEventListener('pointerup', off); btn.addEventListener('pointercancel', off); btn.addEventListener('pointerleave', off);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
});
// iOS のピンチ・ダブルタップによる拡大を防ぐ
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => { if (isTouchUI()) e.preventDefault(); });
// 縦画面になったら航行中は一時停止（横向きの案内は CSS で表示）
const portraitMQ = window.matchMedia ? window.matchMedia('(orientation: portrait)') : null;
function onOrientation() { if (isTouchUI() && portraitMQ && portraitMQ.matches && G.mode === 'play') togglePause(true); }
if (portraitMQ && portraitMQ.addEventListener) portraitMQ.addEventListener('change', onOrientation);
// アプリ切り替え・着信などで画面が隠れたら：入力を解除し、航行中なら一時停止、音を止める
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    releaseAllInput();
    if (isTouchUI() && G.mode === 'play') togglePause(true);
    bgm.suspend();
    if (AC && AC.state === 'running') AC.suspend().catch(() => {});
  } else {
    if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
    bgm.resume();
  }
});

function setThrottle(v) { G.throttle = clamp(v, 0, 2); updateButtons(); }
function toggleDash() { G.dash = !G.dash; updateButtons(); }
function toggleGps() { G.gps = !G.gps; updateButtons(); }
document.querySelectorAll('[data-throttle]').forEach((b) => b.addEventListener('click', () => { ac(); setThrottle(+b.dataset.throttle); }));
$('btnDash').addEventListener('click', () => { ac(); toggleDash(); });
$('btnGps').addEventListener('click', () => { ac(); toggleGps(); });
$('btnCancel').addEventListener('click', () => { ac(); openCancel(); });
function updateButtons() {
  document.querySelectorAll('[data-throttle]').forEach((b) => b.classList.toggle('on', +b.dataset.throttle === G.throttle));
  $('btnDash').classList.toggle('on', G.dash);
  $('btnDash').textContent = G.dash ? 'DASH ON' : 'DASH OFF';
  $('btnGps').classList.toggle('on', G.gps);
  $('btnGps').textContent = G.gps ? 'GPS ON' : 'GPS OFF';
  $('btnCancel').disabled = !(G.phase === 'outbound' && !G.cancelLocked) || G.stage >= 11;
  // スマートフォン用ボタンの表示も同じ状態にそろえる
  $('tDash').classList.toggle('dashOn', G.dash);
  $('tGps').classList.toggle('on', G.gps);
  $('tGps').textContent = G.gps ? 'GPS ON' : 'GPS OFF';
  $('tThr').textContent = ['停止', '半速', '通常'][G.throttle];
  $('tCancel').disabled = $('btnCancel').disabled;
  $('tCancel').style.visibility = $('btnCancel').disabled ? 'hidden' : 'visible';
}

// ---------------------------------------------------------------- ship physics
function updateShip(dt) {
  const S = G.ship, H = G.loaded ? C.HANDLING.LOADED : C.HANDLING.EMPTY, ST = C.STEERING;
  // 舵：キーを押している間は舵角が変化し、離すと中央へ戻る（正=左舵）
  // 演出中の自動航行は、プレイヤーのキーの代わりに autoSteer（-1/0/1）で同じ舵を操作する
  const steer = G.mode === 'play'
    ? ((keys.KeyA || keys.ArrowLeft || touchHold.left.size) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight || touchHold.right.size) ? 1 : 0)
    : (G.autoSteer || 0);
  if (steer !== 0) S.rudder = clamp(S.rudder + steer * ST.RUDDER_SPEED_DEG * dt, -ST.MAX_RUDDER_DEG, ST.MAX_RUDDER_DEG);
  else S.rudder -= clamp(S.rudder, -ST.RUDDER_RETURN_DEG * dt, ST.RUDDER_RETURN_DEG * dt);
  let target = [0, C.SHIP_SPEED.HALF, C.SHIP_SPEED.NORMAL][G.throttle];
  if (G.dash && G.throttle > 0) target = C.SHIP_SPEED.DASH;
  if (G.loaded) target *= C.LOADED_SPEED_MULTIPLIER;
  if (S.grounded) target = Math.min(target, 4);
  const a = target > S.speed ? H.ACCEL : H.DECEL;
  S.speed += clamp(target - S.speed, -a * dt, a * dt);
  if (S.grounded && S.speed > 4) S.speed = Math.max(4, S.speed - 12 * dt);

  // 旋回は前進速度に比例して効く（停船中は回らない＝弧を描いて曲がる）
  const sp = shipSpeed();
  const lowF = clamp(sp / ST.FULL_TURN_SPEED, 0, 1);
  const n = C.SHIP_SPEED.NORMAL * 0.8;
  const highF = 1 - C.HIGH_SPEED_TURN_PENALTY * clamp((sp - n) / (C.SHIP_SPEED.DASH - n), 0, 1);
  const targetYaw = (S.rudder / ST.MAX_RUDDER_DEG) * H.TURN_RATE * lowF * highF;
  S.yawRate += clamp(targetYaw - S.yawRate, -H.YAW_ACCEL * dt, H.YAW_ACCEL * dt);
  S.heading = wrapAngle(S.heading + S.yawRate * dt);

  const f = shipFwd();
  const k = 1 - Math.exp(-H.GRIP * dt);
  S.vx += (f.x * S.speed - S.vx) * k;
  S.vz += (f.z * S.speed - S.vz) * k;
  S.x += S.vx * dt;
  S.z += S.vz * dt;
}

function bounce(nx, nz, push) {
  const S = G.ship;
  S.x += nx * push; S.z += nz * push;
  const vn = S.vx * nx + S.vz * nz;
  if (vn < 0) { S.vx -= 1.6 * vn * nx; S.vz -= 1.6 * vn * nz; S.vx *= 0.35; S.vz *= 0.35; S.speed *= 0.3; }
}

// ---- 衝突（岩礁・海岸・武装艇・VLCC・原油基地 共通） ----
// nx,nz：船を押し出す向き、push：めり込み量、ovx/ovz：相手の速度。
// 押し戻しは毎回行い（めり込み・すり抜け防止）、減額は同じ相手につき COOLDOWN_SEC に1回だけ。
const COL_NAMES = { land: '陸岸', rock: '岩礁', boat: '武装艇', tanker: 'VLCC', facility: '原油基地' };
const colKeys = {};
function collide(kind, key, nx, nz, push, ovx = 0, ovz = 0) {
  const S = G.ship, CO = C.COLLISION;
  const closing = Math.max(0, -((S.vx - ovx) * nx + (S.vz - ovz) * nz)); // 衝突面へ向かう相対速度
  if (kind === 'boat') {
    // 小型艇は軽いので、こちらの船はわずかに押されるだけ
    S.x += nx * push * 0.2; S.z += nz * push * 0.2;
    const vn = S.vx * nx + S.vz * nz;
    if (vn < 0) { S.vx -= vn * nx * 0.5; S.vz -= vn * nz * 0.5; S.speed *= 0.9; }
  } else bounce(nx, nz, push);
  const k = typeof key === 'object' ? key : (colKeys[key] = colKeys[key] || {});
  if (closing < CO.MIN_SPEED || G.time - (k.colT == null ? -99 : k.colT) < CO.COOLDOWN_SEC) return;
  k.colT = G.time;
  const mul = CO.KIND[kind] || 1, v2 = closing * closing, name = COL_NAMES[kind] || '構造物';
  const heavy = closing >= CO.HEAVY_SPEED;
  const cost = Math.round((CO.COST_BASE + CO.COST_PER_SPEED2 * v2) * mul / 500) * 500;
  noise(heavy ? 0.7 : 0.35, heavy ? 0.45 : 0.25, heavy ? 350 : 700);
  for (let i = 0; i < (heavy ? 14 : 6); i++) spawn({ pos: new THREE.Vector3(S.x - nx * 4, 2.5, S.z - nz * 4), vel: new THREE.Vector3(rand(-6, 6), rand(3, 10), rand(-6, 6)), color: 0xffd080, size: 0.35, life: 0.4, grav: 20 });
  if (closing >= CO.FATAL_SPEED && CO.FATAL_KINDS.includes(kind) && !invincible()) {
    charge(cost, `${name}に激突 船体大破`, 'repair');
    G.hull = 0;
    gameOver('collision');
    return;
  }
  charge(cost, `${name}と${heavy ? '激突' : '接触'} 船体修理費`, 'repair');
  damageHull(CO.HULL_PER_SPEED2 * v2 * mul);
  shake(heavy ? 1.4 : 0.5);
  if (heavy) showMsg(`${name}に激突！`, '#ff9a6a', 1.4);
}
// 点が軸平行の長方形に入っていたら押し出し方向とめり込み量を返す
function rectHit(px, pz, cx, cz, hx, hz) {
  const dx = px - cx, dz = pz - cz, ox = hx - Math.abs(dx), oz = hz - Math.abs(dz);
  if (ox <= 0 || oz <= 0) return null;
  return ox < oz ? { nx: Math.sign(dx) || 1, nz: 0, push: ox } : { nx: 0, nz: Math.sign(dz) || 1, push: oz };
}
const SHIP_PTS = [0, 13, -13]; // 船体の中央・船首寄り・船尾寄りで判定
function hazards(dt) {
  const S = G.ship;
  // 陸岸
  for (const s of SHIP_PTS) {
    const f = shipFwd(), px = S.x + f.x * s, pz = S.z + f.z * s;
    const lo = omanShore(pz) + 2, hi = iranShore(pz) - 2;
    let push = 0;
    if (px < lo) push = lo - px; else if (px > hi) push = hi - px;
    if (push) { collide('land', 'land', Math.sign(push), 0, Math.abs(push)); break; }
  }
  if (G.mode !== 'play') return;
  // 海域端
  if (S.z > MAP.ZMAX) bounce(0, -1, S.z - MAP.ZMAX);
  if (S.z < -MAP.ZMAX) bounce(0, 1, -MAP.ZMAX - S.z);
  // 原油基地（島・桟橋・桟橋先端）とVLCC船体
  const R = TERM_ISLAND, HW = 4.5; // HW：船の半幅
  for (const s of SHIP_PTS) {
    const f = shipFwd(), px = S.x + f.x * s, pz = S.z + f.z * s;
    const dx = px - R.x, dz = pz - R.z, d = Math.hypot(dx, dz) || 1, lim = R.r + 8 + HW;
    if (d < lim) { collide('facility', 'facility', dx / d, dz / d, lim - d); break; }
    const h = rectHit(px, pz, R.x, R.z + 80, 3 + HW, 25 + HW) || rectHit(px, pz, R.x, R.z + 105, 15 + HW, 4 + HW);
    if (h) { collide('facility', 'facility', h.nx, h.nz, h.push); break; }
    const v = rectHit(px, pz, VLCC_POS.x, VLCC_POS.z, 60 + HW, 11 + HW);
    if (v) { collide('tanker', 'tanker', v.nx, v.nz, v.push); break; }
  }
  if (G.mode !== 'play') return;
  // 浅瀬
  S.grounded = S.x < omanShore(S.z) + shoalWidth(S.z);
  if (S.grounded) {
    G.shoalT += dt;
    damageHull(C.HULL_DAMAGE.SHOAL_PER_SEC * dt);
    if (G.shoalT >= 1) { G.shoalT = 0; charge(C.COSTS.SHOAL_PER_SEC, '浅瀬座礁 船底損傷', 'minor'); }
    if (Math.random() < dt * 8) splash(S.x + rand(-4, 4), S.z + rand(-10, 10), 1.5);
  } else G.shoalT = 0.6;
  // 岩礁
  for (const r of rocks) {
    const d = shipDist(r.x, r.z);
    if (d < r.r * 0.9) {
      const dx = S.x - r.x, dz = S.z - r.z, l = Math.hypot(dx, dz) || 1;
      collide('rock', r, dx / l, dz / l, r.r * 0.9 - d + 0.5);
      if (G.mode !== 'play') return;
    }
  }
  // 機雷
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i];
    if (shipDist(m.x, m.z) < C.MINE_TRIGGER_RADIUS) {
      explosion(m.x, 1, m.z, 2.5, true); scene.remove(m.mesh);
      if (invincible()) { mines.splice(i, 1); showMsg('機雷に接触！（無敵：ノーダメージ）', '#9fd8ff', 1.6); continue; }
      gameOver('mine'); return;
    }
  }
}

// ---------------------------------------------------------------- zones / rules
function rules(dt) {
  const S = G.ship, sp = shipSpeed();
  // 海峡進入で契約破棄ロック
  if (G.phase === 'outbound' && !G.cancelLocked && S.z < MAP.STRAIT_ENTRY_Z) {
    G.cancelLocked = true; updateButtons();
    showMsg('ホルムズ海峡に進入\nもう契約は破棄できない', '#ffd36a', 2.6);
  }
  // 積み込み / 引き渡し
  const zone = G.phase === 'outbound' ? TERM_ZONE : VLCC_ZONE;
  const working = inZone(zone) && sp < C.DOCK_MAX_SPEED && !(G.phase === 'outbound' && G.stageTime < 1);
  const need = G.phase === 'outbound' ? C.LOAD_TIME : C.TRANSFER_TIME;
  const nearZone = inZone(zone);
  if (working && (G.phase === 'return' || G.phase === 'outbound')) {
    G.progress += dt / need;
    $('progress').style.display = 'block';
    $('progLabel').textContent = G.phase === 'outbound' ? '原油積み込み中…' : 'VLCCへ原油を引き渡し中…';
    $('progBar').style.width = (G.progress * 100) + '%';
    if (G.progress >= 1) {
      G.progress = 0;
      if (G.phase === 'outbound') {
        G.phase = 'return'; G.loaded = true; updateButtons();
        boats.forEach((b) => { b.state = 'return'; b.cool = 0; b.warned = false; b.alert = 0; });
        showMsg('原油満載！ VLCCへ帰還せよ\n船が重くなり、操船が鈍くなった', '#ffd36a', 3.2);
        beep(520, 0.2, 0.08, 'triangle');
      } else { $('progress').style.display = 'none'; stageClear(); return; }
    }
  } else {
    $('progress').style.display = nearZone ? 'block' : 'none';
    if (nearZone) { $('progLabel').textContent = `減速せよ（${Math.round(C.DOCK_MAX_SPEED * 0.75)}kt未満で作業開始）`; $('progBar').style.width = (G.progress * 100) + '%'; }
  }
  // 不審停止
  const atDock = inZone(TERM_ZONE) || inZone(VLCC_ZONE);
  if (sp < 2.5 && !atDock && !S.grounded) {
    G.stopTimer += dt;
    if (G.stopTimer >= C.COSTS.STOP_GRACE_SEC) { G.stopTimer = 0; charge(C.COSTS.STOP_PENALTY, '不審停止ペナルティ', 'penalty'); }
  } else G.stopTimer = 0;
  // ダッシュ燃料費（ダッシュ中だけ一定時間ごとに加算）
  if (G.dash && G.throttle > 0) {
    G.fuelT += dt;
    if (G.fuelT >= C.DASH_FUEL.INTERVAL_SEC) { G.fuelT -= C.DASH_FUEL.INTERVAL_SEC; charge(C.DASH_FUEL.COST, '燃料費（ダッシュ）', 'fuel'); }
  }
  // イラン側領海接近
  G.inIran = S.x > iranShore(S.z) - MAP.IRAN_WATERS && Math.abs(S.z) < 850 * L;
  if (G.inIran) {
    G.iranT += dt;
    if (G.iranT >= C.COSTS.IRAN_WATERS_INTERVAL) { G.iranT = 0; charge(C.COSTS.IRAN_WATERS_PENALTY, '危険海域航行ペナルティ', 'penalty'); }
  } else G.iranT = 0;
  // GPS妨害
  if (P.gpsJam) {
    if (G.gpsJam > 0) G.gpsJam -= dt;
    else if (Math.abs(S.z) < 600 * L) { G.gpsJamCd -= dt; if (G.gpsJamCd <= 0) { G.gpsJam = rand(6, 10); G.gpsJamCd = rand(14, 28); beep(220, 0.3, 0.05, 'sawtooth'); } }
  }
  if (G.hull <= 0) gameOver('hull');
}

// ---------------------------------------------------------------- enemies
// ---- GPS・索敵 ----
const gpsFx = () => (G.gps ? C.GPS_EFFECT.ON : C.GPS_EFFECT.OFF);
const randDisk = (r) => { const a = rand(0, Math.PI * 2), d = r * Math.sqrt(Math.random()); return { x: Math.cos(a) * d, z: Math.sin(a) * d }; };
function detectParams() {
  const D = C.DETECTION, s = clamp(G.stage, 1, 10);
  const late = s <= D.EARLY_STAGES_END ? 0 : (s - D.EARLY_STAGES_END) / (10 - D.EARLY_STAGES_END);
  const k = (key) => lerp(D.EARLY[key], D.LATE[key], late);
  return { range: D.RANGE_BASE + D.RANGE_PER_STAGE * (s - 1), rate: D.RATE_BASE + D.RATE_PER_STAGE * (s - 1),
    oman: k('OMAN'), slow: k('SLOW'), dash: k('DASH'), gpsOffExtra: k('GPS_OFF_EXTRA') };
}
// プレイヤーの「見つかりやすさ」倍率（艇との距離以外の要素）
function exposure(dp) {
  const S = G.ship, sp = shipSpeed(), D = C.DETECTION;
  let m = gpsFx().DETECT * (G.gps ? 1 : dp.gpsOffExtra);
  G.omanSide = S.x - (omanShore(S.z) + shoalWidth(S.z)) < D.OMAN_SIDE_DIST && Math.abs(S.z) < MAP.HAZARD_Z;
  if (G.omanSide) m *= dp.oman;
  if (G.dash && G.throttle > 0) m *= dp.dash;
  else if (sp <= C.SHIP_SPEED.HALF * 1.15) m *= dp.slow;
  if (G.inIran) m *= D.IRAN_WATERS;
  if (G.stopTimer > 2) m *= D.STOPPED;
  return m;
}

function updateBoats(dt) {
  const S = G.ship, f = shipFwd(), sp = shipSpeed(), D = C.DETECTION;
  const dp = detectParams(), expo = exposure(dp);
  G.exposure = expo;
  const active = Math.abs(S.z) < 840 * L;
  const chasers = () => boats.filter((o) => o.state === 'chase').length;
  for (const b of boats) {
    b.t += dt; b.cool -= dt; b.bumpCd -= dt;
    const dxp = S.x - b.x, dzp = S.z - b.z, dist = Math.hypot(dxp, dzp);
    // 警戒度の更新（発見前は距離と条件次第。追跡中は少し遠くまで見張れる）
    const range = b.state === 'chase' ? dp.range * 1.6 : dp.range;
    const prox = clamp(1 - dist / range, 0, 1);
    let rate = active ? dp.rate * 2 * prox * expo * b.vigilance : 0;
    if (active && dist < D.CLOSE_RANGE) rate = Math.max(rate, 1.5);
    b.alert = clamp(b.alert + rate * dt - D.DECAY * (1 - prox) * dt, 0, 1.2);
    const canChase = b.alert >= 1 && b.cool <= 0 && active && chasers() < P.maxChasers;
    const startChase = () => {
      b.state = 'chase'; b.chaseT = 0; b.fireCd = 1.5;
      if (!G.boatAlert || Math.random() < 0.5) showMsg('⚠ 武装小型艇に発見された！', '#ff9a6a', 1.8);
      G.boatAlert = true;
    };
    let tx, tz, spd;
    if (b.state === 'patrol') {
      tx = b.homeX + Math.cos(b.t * 0.3 + b.ph) * 25; tz = b.homeZ + Math.sin(b.t * 0.3 + b.ph) * 25; spd = 7;
      if (canChase) startChase();
      else if (b.alert >= D.SUSPICIOUS && active) { b.state = 'search'; b.searchT = 0; }
    } else if (b.state === 'search') {
      // 警戒中：おおよその位置へ様子を見に行く（正確には追尾しない・撃たない）
      b.searchT -= dt;
      if (b.searchT <= 0) { const e = randDisk(30 + (1 - b.alert) * 80); b.lastX = S.x + e.x; b.lastZ = S.z + e.z; b.searchT = 3; }
      tx = b.lastX; tz = b.lastZ;
      spd = Math.hypot(tx - b.x, tz - b.z) > D.SEARCH_STANDOFF ? 14 : 3; // 推定位置の手前で様子見（突っ込んではこない）
      if (canChase) startChase();
      else if (b.alert < D.SUSPICIOUS * 0.5 || !active) b.state = 'return';
    } else if (b.state === 'chase') {
      b.chaseT += dt;
      const rx = f.z, rz = -f.x;
      const sideSign = Math.sign((b.x - S.x) * rx + (b.z - S.z) * rz) || 1;
      tx = S.x + rx * sideSign * 50 + S.vx * 1.0; tz = S.z + rz * sideSign * 50 + S.vz * 1.0;
      const dT = Math.hypot(tx - b.x, tz - b.z);
      spd = dT > 30 ? P.boatSpeed : Math.max(sp, 8);
      const lost = b.chaseT > D.MIN_CHASE_SEC && b.alert < D.LOSE_TRACK;
      if (lost || b.chaseT > P.boatChaseTime || Math.abs(S.z) > 880 * L || dist > dp.range * 2.2) {
        b.state = 'return'; b.cool = P.boatRest; b.alert = Math.min(b.alert, 0.3);
      }
      // 射撃
      b.fireCd -= dt;
      if (dist < 150 && b.fireCd <= 0 && b.burstLeft <= 0) {
        b.burstLeft = P.boatBurst; b.burstT = 0; b.fireCd = P.boatCooldown + rand(0, 1.2);
        b.warnBurst = P.warningShots && !b.warned; b.warned = true;
        if (b.warnBurst) showMsg('⚠ 警告射撃！', '#ffd36a', 1.6);
      }
    } else {
      tx = b.homeX; tz = b.homeZ; spd = P.boatSpeed * 0.7;
      if (canChase) startChase();
      else if (Math.hypot(tx - b.x, tz - b.z) < 25) b.state = 'patrol';
    }
    // 警戒マーカー：黄=警戒中、赤=発見・追跡中
    const showMk = b.state === 'chase' || b.state === 'search';
    b.marker.visible = showMk;
    if (showMk) { b.marker.material.color.setHex(b.state === 'chase' ? 0xff3020 : 0xffd040); b.marker.rotation.y += dt * 3; }
    if (b.burstLeft > 0) {
      b.burstT -= dt;
      if (b.burstT <= 0) { fireBullet(b, dist); b.burstLeft--; b.burstT = 0.14; }
    }
    // 移動
    const want = Math.atan2(tx - b.x, tz - b.z);
    b.heading = wrapAngle(b.heading + clamp(wrapAngle(want - b.heading), -1.8 * dt, 1.8 * dt));
    b.speed += clamp(spd - b.speed, -10 * dt, 10 * dt);
    b.vx = Math.sin(b.heading) * b.speed; b.vz = Math.cos(b.heading) * b.speed;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    // 衝突（相対速度で損傷。船体どうしがめり込まないよう押し離す）
    const ov = 1.5 - shipDist(b.x, b.z, 15, 5);
    if (ov > 0) {
      const l = Math.hypot(S.x - b.x, S.z - b.z) || 1, nx = (S.x - b.x) / l, nz = (S.z - b.z) / l;
      collide('boat', b, nx, nz, ov, b.vx, b.vz);
      b.x -= nx * (ov * 0.8 + 0.5); b.z -= nz * (ov * 0.8 + 0.5);
      b.speed *= 0.5;
      if (G.mode !== 'play') return;
    }
    b.x = clamp(b.x, omanShore(b.z) + shoalWidth(b.z) + 4, iranShore(b.z) - 6);
    b.mesh.position.set(b.x, 0.3 + Math.sin(G.time * 3 + b.ph) * 0.15, b.z);
    b.mesh.rotation.set(0, b.heading, 0);
    if (b.speed > 6 && Math.random() < dt * 12) spawn({ geo: geoDisc, pos: new THREE.Vector3(b.x - Math.sin(b.heading) * 5, 0.15, b.z - Math.cos(b.heading) * 5), color: 0xffffff, size: 1.2, grow: 2, life: 1.2, opacity: 0.5 });
  }
}

const bulletGeo = new THREE.BoxGeometry(0.3, 0.3, 3);
const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe070, fog: false });
function fireBullet(b, dist) {
  const S = G.ship, f = shipFwd();
  const from = new THREE.Vector3(b.x + Math.sin(b.heading) * 4, 2, b.z + Math.cos(b.heading) * 4);
  let aim;
  if (b.warnBurst) aim = new THREE.Vector3(S.x + f.x * rand(40, 60) + rand(-12, 12), 0, S.z + f.z * rand(40, 60) + rand(-12, 12));
  else {
    const spr = (4 + dist * 0.14 + shipSpeed() * 0.15) * gpsFx().GUN_SPREAD; // 高速航行中ほど・GPS OFFほど当たりにくい
    aim = new THREE.Vector3(S.x + rand(-spr, spr), 2.2, S.z + rand(-spr, spr));
  }
  const dir = aim.clone().sub(from).normalize();
  const m = new THREE.Mesh(bulletGeo, bulletMat);
  m.position.copy(from);
  m.lookAt(from.clone().add(dir));
  scene.add(m);
  bullets.push({ mesh: m, pos: from, vel: dir.multiplyScalar(150), life: dist / 150 * 1.6 + 0.4, warn: b.warnBurst });
  if (dist < 400) noise(0.06, 0.12 * clamp(1 - dist / 400, 0.2, 1), 2500);
}
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const u = bullets[i];
    u.pos.addScaledVector(u.vel, dt);
    u.mesh.position.copy(u.pos);
    u.life -= dt;
    let dead = false;
    if (!u.warn && u.pos.y > 0 && u.pos.y < 6 && shipDist(u.pos.x, u.pos.z) < 0.7) { gunHit(u.pos); dead = true; }
    else if (u.pos.y <= 0 || u.life <= 0) { splash(u.pos.x, u.pos.z, 0.8); dead = true; }
    if (dead) { scene.remove(u.mesh); bullets.splice(i, 1); }
  }
}
function gunHit(p) {
  G.gunHits++;
  const cost = Math.min(C.COSTS.GUN_REPAIR_MAX, C.COSTS.GUN_REPAIR_BASE + C.COSTS.GUN_REPAIR_STEP * (G.gunHits - 1));
  charge(cost, '船体修理費', 'repair');
  damageHull(C.HULL_DAMAGE.GUN);
  for (let i = 0; i < 5; i++) spawn({ pos: p.clone(), vel: new THREE.Vector3(rand(-8, 8), rand(2, 10), rand(-8, 8)), color: 0xffd080, size: 0.3, life: 0.35, grav: 20 });
  beep(1400, 0.05, 0.05, 'square');
  shake(0.25);
  if (G.gunHits % C.COSTS.HITS_PER_INJURY === 0 && G.crewInjured < C.CREW_TOTAL && !invincible()) {
    G.crewInjured++;
    charge(C.COSTS.INJURY_BASE + C.COSTS.INJURY_STEP * (G.crewInjured - 1), '乗組員負傷補償', 'injury');
    showMsg(`乗組員が負傷！（負傷者 ${G.crewInjured}名）`, '#ff6b5e', 2);
  }
}

// ドローン
const droneRingMat = () => new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.7, depthWrite: false });
function updateDrones(dt) {
  const S = G.ship;
  if (P.droneInterval && Math.abs(S.z) < 820 * L) {
    G.droneT -= dt;
    if (G.droneT <= 0 && drones.length < P.droneMax) {
      G.droneT = P.droneInterval * (C.ATTACK_INTERVAL_SCALE || 1) * rand(0.8, 1.2);
      const z = clamp(S.z + rand(-200, 200), -880 * L, 880 * L);
      const m = makeDrone();
      const d = { mesh: m, pos: new THREE.Vector3(iranShore(z) + rand(200, 300), 45, z), phase: 'approach', vel: new THREE.Vector3(), age: 0 };
      m.position.copy(d.pos);
      scene.add(m);
      drones.push(d);
    }
  }
  for (let i = drones.length - 1; i >= 0; i--) {
    const d = drones[i];
    d.age += dt;
    d.mesh.userData.light.visible = Math.floor(G.time * 4) % 2 === 0;
    let remove = false;
    if (d.phase === 'approach') {
      const tgt = new THREE.Vector3(S.x, 45, S.z);
      const dir = tgt.clone().sub(d.pos);
      const hd = Math.hypot(dir.x, dir.z);
      d.vel.copy(dir.normalize().multiplyScalar(50));
      if (hd < 140) {
        d.phase = 'dive';
        const t = d.pos.distanceTo(new THREE.Vector3(S.x, 1, S.z)) / 65;
        const fx = gpsFx(), err = randDisk(fx.DRONE_AIM_ERROR); // 命中精度（GPS OFFだと狙いが甘い）
        d.aim = new THREE.Vector3(S.x + S.vx * t + err.x, 1, S.z + S.vz * t + err.z);
        d.vel = d.aim.clone().sub(d.pos).normalize().multiplyScalar(65);
        // 着弾警告（GPS OFFだと円が大きく、中心もずれる＝着弾位置の不確実性）
        const wr = (C.DRONE_HIT_RADIUS + 3) * fx.WARN_SCALE, wo = randDisk(wr * fx.WARN_OFFSET);
        d.ring = new THREE.Mesh(geoRing, droneRingMat());
        d.ring.position.set(d.aim.x + wo.x, 0.4, d.aim.z + wo.z);
        d.ring.scale.setScalar(wr);
        scene.add(d.ring);
        beep(900, 0.12, 0.06, 'sawtooth');
      }
      if (d.age > 40) remove = true;
    }
    d.pos.addScaledVector(d.vel, dt);
    d.mesh.position.copy(d.pos);
    d.mesh.lookAt(d.pos.clone().add(d.vel));
    if (d.ring) d.ring.material.opacity = 0.4 + 0.4 * Math.sin(G.time * 20);
    if (d.phase === 'dive' && d.pos.y <= 1.5) {
      const hit = shipDist(d.pos.x, d.pos.z) < C.DRONE_HIT_RADIUS;
      if (hit) droneHit(d.pos); else { explosion(d.pos.x, 1, d.pos.z, 0.9); noise(0.6, 0.25, 800); }
      remove = true;
    }
    if (remove) { scene.remove(d.mesh); if (d.ring) scene.remove(d.ring); drones.splice(i, 1); }
    if (G.mode !== 'play') return;
  }
}
function droneHit(p) {
  G.droneHits++;
  const limit = G.loaded ? C.DRONE_LIMIT_LOADED : C.DRONE_LIMIT_EMPTY;
  if (!invincible()) G.droneDmg += 1 / limit;
  if (G.loaded) {
    explosion(p.x, 4, p.z, 1.8, true);
    charge(C.COSTS.DRONE_REPAIR_LOADED, 'ドローン被弾 船体修理費', 'repair');
    charge(C.COSTS.DRONE_CARGO_FIRE, '火災消火・積荷損失', 'minor');
    damageHull(C.HULL_DAMAGE.DRONE_LOADED);
    noise(1.2, 0.5, 500);
    shake(2.5);
  } else {
    explosion(p.x, 3, p.z, 1.1);
    charge(C.COSTS.DRONE_REPAIR_EMPTY, 'ドローン被弾 船体修理費', 'repair');
    damageHull(C.HULL_DAMAGE.DRONE_EMPTY);
    noise(0.8, 0.4, 700);
  }
  if (G.droneDmg >= 0.999) { gameOver(G.loaded ? 'drone_loaded' : 'drone_empty'); return; }
  showMsg(G.loaded ? `自爆ドローン被弾！ 積荷が炎上！\n残り耐久：あと${dronesLeft()}発` : `自爆ドローン被弾！\n残り耐久：あと${dronesLeft()}発`, '#ff6b5e', 2.2);
}
function dronesLeft() { const per = 1 / (G.loaded ? C.DRONE_LIMIT_LOADED : C.DRONE_LIMIT_EMPTY); return Math.max(0, Math.ceil((1 - G.droneDmg) / per - 1e-6)); }

// ミサイル
function updateMissiles(dt) {
  const S = G.ship;
  if (P.missileInterval && Math.abs(S.z) < 780 * L) {
    G.missileT -= dt;
    if (G.missileT <= 0 && !inZone(TERM_ZONE)) {
      G.missileT = P.missileInterval * (C.ATTACK_INTERVAL_SCALE || 1) * rand(0.85, 1.15);
      const T = C.MISSILE_FLIGHT_TIME;
      const lz = clamp(S.z + rand(-120, 120), -900 * L, 900 * L);
      const launch = new THREE.Vector3(iranShore(lz) + 140, 20, lz);
      const lead = P.missileLead;
      const fx = gpsFx(), err = randDisk(fx.MISSILE_AIM_ERROR);
      const aim = new THREE.Vector3(S.x + S.vx * T * lead + err.x, 1, S.z + S.vz * T * lead + err.z);
      const m = makeMissile(); scene.add(m);
      const warnR = C.MISSILE_WARNING_RADIUS * fx.WARN_SCALE, wo = randDisk(warnR * fx.WARN_OFFSET);
      const ring = new THREE.Mesh(geoRing, new THREE.MeshBasicMaterial({ color: 0xff1010, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
      ring.position.set(aim.x + wo.x, 0.5, aim.z + wo.z);
      ring.scale.setScalar(warnR);
      scene.add(ring);
      missiles.push({ mesh: m, ring, launch, aim, t: 0, T, prev: launch.clone(), warnR });
      explosion(launch.x, launch.y, launch.z, 0.6);
      showMsg('⚠ ミサイル警報！\n赤い円から離れろ！', '#ff3020', 2.2);
      for (let k = 0; k < 3; k++) setTimeout(() => beep(1200, 0.15, 0.07, 'square'), k * 220);
    }
  }
  for (let i = missiles.length - 1; i >= 0; i--) {
    const ms = missiles[i];
    ms.t += dt;
    const u = Math.min(1, ms.t / ms.T);
    const p = new THREE.Vector3().lerpVectors(ms.launch, ms.aim, u);
    p.y += 4 * 130 * u * (1 - u);
    ms.mesh.position.copy(p);
    ms.mesh.lookAt(p.clone().add(p.clone().sub(ms.prev)));
    ms.prev.copy(p);
    ms.ring.material.opacity = 0.45 + 0.4 * Math.sin(G.time * (10 + u * 25));
    ms.ring.scale.setScalar(ms.warnR * (1.3 - 0.3 * u));
    if (Math.random() < 0.7) spawn({ pos: p.clone(), color: 0xdddddd, size: 1.2, grow: 2, life: 1.5, opacity: 0.6, fog: false });
    if (u >= 1) {
      scene.remove(ms.mesh); scene.remove(ms.ring); missiles.splice(i, 1);
      if (shipDist(ms.aim.x, ms.aim.z) < C.MISSILE_HIT_RADIUS) {
        if (invincible()) { explosion(ms.aim.x, 3, ms.aim.z, 2.4, true); showMsg('ミサイル直撃！（無敵：ノーダメージ）', '#9fd8ff', 1.6); continue; }
        gameOver('missile'); return;
      }
      explosion(ms.aim.x, 1, ms.aim.z, 2.4); noise(1.2, 0.45, 500);
    }
  }
}

// ---------------------------------------------------------------- per-frame play
let wakeT = 0, fireT = 0, hudT = 0;
function updatePlay(dt) {
  G.stageTime += dt;
  updateShip(dt);
  // 第11ステージ：契約解除ラインに EVENT_DISTANCE まで近づいたら最終イベント開始（1回だけ）
  if (G.stage >= 11 && G.s11 && !G.s11.started && G.ship.z - MAP.STRAIT_ENTRY_Z <= C.STAGE11.EVENT_DISTANCE) { startFinalEvent(); return; }
  hazards(dt); if (G.mode !== 'play') return;
  rules(dt); if (G.mode !== 'play') return;
  updateBoats(dt);
  updateBullets(dt); if (G.mode !== 'play') return;
  updateDrones(dt); if (G.mode !== 'play') return;
  updateMissiles(dt); if (G.mode !== 'play') return;
  shipEffects(dt);
}
function shipEffects(dt) {
  const S = G.ship, f = shipFwd(), sp = shipSpeed();
  wakeT -= dt;
  if (sp > 3 && wakeT <= 0) {
    wakeT = 0.07;
    spawn({ geo: geoDisc, pos: new THREE.Vector3(S.x - f.x * 15 + rand(-1, 1), 0.12, S.z - f.z * 15 + rand(-1, 1)), color: 0xffffff, size: 1.6, grow: 2.2, life: 2.2, opacity: 0.3 });
    if (sp > 15) spawn({ geo: geoDisc, pos: new THREE.Vector3(S.x + f.x * 14 + f.z * rand(-4, 4), 0.12, S.z + f.z * 14 - f.x * rand(-4, 4)), color: 0xffffff, size: 1.5, grow: 2, life: 1, opacity: 0.4 });
  }
  // 炎上・煙
  fireT -= dt;
  const fireLevel = G.loaded ? G.droneHits : 0;
  const smokeLevel = (100 - G.hull) / 25 + (G.loaded ? 0 : G.droneHits * 0.4);
  if (fireT <= 0 && (fireLevel > 0 || smokeLevel > 0.8)) {
    fireT = fireLevel > 0 ? 0.22 / fireLevel : 0.5 / smokeLevel;
    const s = rand(-11, 9), w = rand(-3, 3);
    const p = new THREE.Vector3(S.x + f.x * s + f.z * w, 4, S.z + f.z * s - f.x * w);
    if (fireLevel > 0) spawn({ pos: p.clone(), vel: new THREE.Vector3(rand(-1, 1), rand(6, 10), rand(-1, 1)), color: Math.random() < 0.5 ? 0xff7a20 : 0xffb040, size: rand(1.2, 2.2), grow: 0.8, life: 0.8 });
    spawn({ pos: p.add(new THREE.Vector3(0, 3, 0)), vel: new THREE.Vector3(rand(-1, 1) - f.x * 4, rand(5, 8), rand(-1, 1) - f.z * 4), color: 0x3a3532, size: rand(0.7, 1.2), grow: 2.2, life: 2.2, opacity: 0.4 });
  }
}

function syncShipMesh(dt) {
  const S = G.ship, sp = shipSpeed();
  playerMesh.position.set(S.x, (G.loaded ? -0.9 : 0) + Math.sin(G.time * 1.6) * 0.15, S.z);
  playerMesh.rotation.set(Math.sin(G.time * 1.2) * 0.012, S.heading, -S.yawRate * 0.18 * clamp(sp / 26, 0, 1.5) + Math.sin(G.time * 0.9) * 0.01);
  // 機雷・岩などのアニメ
  for (const m of mines) { m.mesh.position.y = 0.2 + Math.sin(G.time * 1.5 + m.ph) * 0.25; m.mesh.userData.light.visible = Math.floor(G.time * 1.6 + m.ph) % 2 === 0; }
  // GPS
  const dest = G.phase === 'outbound' ? TERM_ZONE : VLCC_ZONE;
  const showGps = G.gps && G.mode === 'play';
  const jam = G.gpsJam > 0;
  const bearing = Math.atan2(dest.x - S.x, dest.z - S.z);
  gpsArrow3D.visible = showGps;
  gpsArrow3D.position.set(S.x, 16 + Math.sin(G.time * 3) * 0.6, S.z);
  gpsArrow3D.rotation.y = jam ? bearing + Math.sin(G.time * 7) * 2.5 + rand(-0.5, 0.5) : bearing;
  beacon.visible = showGps && !jam;
  beacon.position.set(dest.x, 130, dest.z);
  zoneRing.visible = G.mode === 'play' || G.mode === 'captain';
  zoneRing.position.set(dest.x, 0.3, dest.z);
  zoneRing.scale.setScalar(dest.r);
  zoneRing.material.opacity = 0.45 + 0.25 * Math.sin(G.time * 3);
}

// ---------------------------------------------------------------- HUD
const warnEl = $('warn');
function updateHud() {
  const S = G.ship, sp = shipSpeed();
  $('hStage').textContent = `${Math.min(G.stage, 99)} / ${C.STAGE_COUNT}`;
  $('hCargo').textContent = G.loaded ? '原油満載' : '空荷';
  $('hCargo').style.color = G.loaded ? '#ffb070' : '#e8f0f4';
  $('hHull').textContent = Math.ceil(G.hull) + '%';
  $('hHullBar').style.width = G.hull + '%';
  $('hHullBar').style.background = G.hull > 60 ? '#5fd17a' : G.hull > 30 ? '#f2c14e' : '#ff5a4a';
  const limit = G.loaded ? C.DRONE_LIMIT_LOADED : C.DRONE_LIMIT_EMPTY;
  $('hDrone').textContent = `${G.droneHits || 0}回 / 上限${limit}（あと${dronesLeft()}）`;
  $('hDroneBar').style.width = Math.min(100, (G.droneDmg || 0) * 100) + '%';
  $('hGun').textContent = `${G.gunHits || 0}発`;
  $('hCrew').textContent = `負傷 ${G.crewInjured || 0} / ${C.CREW_TOTAL}名`;
  $('hCrew').style.color = G.crewInjured ? '#ff8a7a' : '#e8f0f4';
  const ex = G.exposure == null ? 1 : G.exposure;
  const exLv = ex < 0.3 ? ['低（隠密）', '#7ee08a'] : ex < 0.8 ? ['中', '#f2c14e'] : ['高', '#ff8a7a'];
  $('hExpo').textContent = exLv[0] + (G.omanSide ? '・オマーン側' : '');
  $('hExpo').style.color = exLv[1];
  const eng = S.grounded ? '座礁中（出力制限）' : G.throttle === 0 ? '正常（停止）' : G.dash ? '正常（ダッシュ）' : G.throttle === 1 ? '正常（半速）' : '正常（通常）';
  $('hEngine').textContent = eng;
  $('hSpeed').textContent = (sp * 0.75).toFixed(1) + ' kt';
  const rd = S.rudder, rp = Math.abs(rd) / C.STEERING.MAX_RUDDER_DEG * 50;
  $('hRudder').textContent = Math.abs(rd) < 0.5 ? '中央' : `${rd > 0 ? '左' : '右'} ${Math.round(Math.abs(rd))}°`;
  $('hRudBar').style.left = (rd > 0 ? 50 - rp : 50) + '%';
  $('hRudBar').style.width = rp + '%';
  $('hPending').textContent = fmtUSD(G.pending);
  $('hPending').className = 'big ' + (G.pending >= 0 ? 'pos' : 'neg');
  $('hLoss').textContent = '-' + fmtUSD(G.losses);
  $('hBanked').textContent = fmtUSD(G.banked);
  $('hObjective').textContent = G.phase === 'outbound' ? '目的：原油ターミナルで原油を積み込め' : '目的：VLCCへ帰還し、原油を引き渡せ';
  const dest = G.phase === 'outbound' ? TERM_ZONE : VLCC_ZONE;
  const jam = G.gpsJam > 0;
  if (G.gps) {
    $('hGps').style.display = 'block';
    const rel = wrapAngle(Math.atan2(dest.x - S.x, dest.z - S.z) - S.heading) + (jam ? rand(-3, 3) : 0);
    $('gpsArrow').style.transform = `rotate(${-rel}rad)`;
    $('hDist').textContent = jam ? 'GPS妨害中 ---- m' : `${G.phase === 'outbound' ? 'ターミナル' : 'VLCC'}まで ${Math.round(Math.hypot(dest.x - S.x, dest.z - S.z) * 10).toLocaleString()} m`;
  } else $('hGps').style.display = 'none';
  // 警告
  const w = [];
  if (missiles.length) w.push('⚠ ミサイル接近 — 赤い円から離れろ');
  if (drones.length) w.push(`⚠ 自爆ドローン接近（${drones.length}機）— 方位 ${relDir(drones[0].pos)}`);
  if (boats.some((b) => b.state === 'chase')) w.push('⚠ 武装小型艇に追跡されている');
  else if (boats.some((b) => b.state === 'search')) w.push('⚠ 武装小型艇が警戒している（まだ発見されていない）');
  if (G.inIran) w.push('⚠ イラン側領海に接近中 — 危険海域ペナルティ');
  if (S.grounded) w.push('⚠ 浅瀬に乗り上げている！');
  if (G.stopTimer > 1.5) w.push(`停船中：あと${Math.ceil(C.COSTS.STOP_GRACE_SEC - G.stopTimer)}秒で不審停止ペナルティ`);
  if (jam) w.push('📡 GPS妨害を受けている');
  const info = [];
  if (G.phase === 'outbound' && !G.cancelLocked && G.stage < 11) info.push('海峡入口までは契約破棄が可能');
  warnEl.innerHTML = w.map((t) => `<div>${t}</div>`).join('') + info.map((t) => `<div class="info">${t}</div>`).join('');
}
function relDir(p) {
  const S = G.ship;
  const rel = wrapAngle(Math.atan2(p.x - S.x, p.z - S.z) - S.heading);
  const a = Math.abs(rel);
  if (a < 0.6) return '前方';
  if (a > 2.5) return '後方';
  return rel > 0 ? '左舷' : '右舷';
}

// ミニマップ
const mm = $('minimap'), mctx = mm.getContext('2d');
const MM = { W: mm.width, H: mm.height, sc: mm.height / (MAP.ZMAX * 2) };
const mmX = (x) => MM.W / 2 + x * MM.sc, mmY = (z) => MM.H / 2 + z * MM.sc;
const mmBg = document.createElement('canvas');
mmBg.width = MM.W; mmBg.height = MM.H;
{
  const c = mmBg.getContext('2d');
  c.fillStyle = '#8a7350'; c.fillRect(0, 0, MM.W, MM.H);
  c.fillStyle = '#1e5f7a'; c.beginPath();
  for (let z = -MAP.ZMAX; z <= MAP.ZMAX; z += 20) c.lineTo(mmX(omanShore(z)), mmY(z));
  for (let z = MAP.ZMAX; z >= -MAP.ZMAX; z -= 20) c.lineTo(mmX(iranShore(z)), mmY(z));
  c.fill();
  c.fillStyle = 'rgba(95,208,192,0.7)'; c.beginPath();
  for (let z = -MAP.HAZARD_Z; z <= MAP.HAZARD_Z; z += 20) c.lineTo(mmX(omanShore(z)), mmY(z));
  for (let z = MAP.HAZARD_Z; z >= -MAP.HAZARD_Z; z -= 20) c.lineTo(mmX(omanShore(z) + shoalWidth(z)), mmY(z));
  c.fill();
  c.strokeStyle = 'rgba(255,70,50,0.8)'; c.beginPath();
  for (let z = -MAP.HAZARD_Z; z <= MAP.HAZARD_Z; z += 20) c.lineTo(mmX(iranShore(z) - MAP.IRAN_WATERS), mmY(z));
  c.stroke();
  c.strokeStyle = '#f2c14e'; c.setLineDash([3, 2]); c.beginPath();
  c.moveTo(mmX(omanShore(MAP.STRAIT_ENTRY_Z)), mmY(MAP.STRAIT_ENTRY_Z)); c.lineTo(mmX(iranShore(MAP.STRAIT_ENTRY_Z)), mmY(MAP.STRAIT_ENTRY_Z)); c.stroke();
  c.setLineDash([]);
  c.fillStyle = '#ccc'; c.fillRect(mmX(VLCC_POS.x) - 5, mmY(VLCC_POS.z) - 1.5, 10, 3);
  c.beginPath(); c.arc(mmX(TERM_ISLAND.x), mmY(TERM_ISLAND.z), 4, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.font = '9px sans-serif';
  c.fillText('IRAN', MM.W - 30, 60); c.fillText('OMAN', 4, 150); c.fillText('N↑', 4, 12);
}
function drawMinimap() {
  mctx.drawImage(mmBg, 0, 0);
  const S = G.ship;
  const dest = G.phase === 'outbound' ? TERM_ZONE : VLCC_ZONE;
  if (G.gps && !(G.gpsJam > 0)) {
    mctx.strokeStyle = 'rgba(255,211,106,0.7)'; mctx.setLineDash([2, 2]);
    mctx.beginPath(); mctx.moveTo(mmX(S.x), mmY(S.z)); mctx.lineTo(mmX(dest.x), mmY(dest.z)); mctx.stroke(); mctx.setLineDash([]);
    mctx.fillStyle = '#ffd36a'; mctx.beginPath(); mctx.arc(mmX(dest.x), mmY(dest.z), 4 + Math.sin(G.time * 5), 0, 7); mctx.fill();
  }
  mctx.fillStyle = '#ff5040';
  for (const b of boats) if (b.state === 'chase' || Math.hypot(b.x - S.x, b.z - S.z) < 300) mctx.fillRect(mmX(b.x) - 1.5, mmY(b.z) - 1.5, 3, 3);
  mctx.save();
  mctx.translate(mmX(S.x), mmY(S.z));
  mctx.rotate(Math.PI - S.heading);
  mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.moveTo(0, -6); mctx.lineTo(4, 5); mctx.lineTo(-4, 5); mctx.fill();
  mctx.restore();
  if (G.gps === false) { mctx.fillStyle = 'rgba(0,0,0,0.5)'; mctx.fillRect(0, MM.H - 14, MM.W, 14); mctx.fillStyle = '#fff'; mctx.font = '9px sans-serif'; mctx.fillText('GPS OFF', 4, MM.H - 4); }
}

// ---------------------------------------------------------------- camera
// カメラは「向き（camYaw）」を船首方向へ滑らかに回り込ませ、その向きの後方斜め上に置く。
// 向きと位置を別々に補間するので、旋回中も急に振られず、船首は常に画面奥側を向く。
const camPos = new THREE.Vector3(0, 300, 1400), camLook = new THREE.Vector3();
let camYaw = Math.PI;
camera.fov = C.CAMERA.FOV; camera.updateProjectionMatrix();
function snapCamera() { G.camSnap = true; }
function updateCamera(dt) {
  const S = G.ship, CAM = C.CAMERA;
  let tp, tl;
  if (G.mode === 'title') {
    const a = G.time * 0.05;
    tp = new THREE.Vector3(Math.sin(a) * 700, 260, Math.cos(a) * 700);
    tl = new THREE.Vector3(0, 0, 0);
    camPos.copy(tp); camLook.copy(tl);
  } else {
    if (G.camSnap) camYaw = S.heading;
    else camYaw = wrapAngle(camYaw + wrapAngle(S.heading - camYaw) * (1 - Math.exp(-CAM.ROTATION_FOLLOW * dt)));
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const sp = shipSpeed();
    const back = CAM.DISTANCE + sp * CAM.SPEED_DISTANCE_GAIN, up = CAM.HEIGHT + sp * CAM.SPEED_HEIGHT_GAIN;
    tp = new THREE.Vector3(S.x - fx * back, up, S.z - fz * back);
    tl = new THREE.Vector3(S.x + fx * CAM.LOOK_AHEAD, G.mode === 'stage11' && G.s11 && !G.s11.good ? 20 : 0, S.z + fz * CAM.LOOK_AHEAD);
    if (G.camSnap) { camPos.copy(tp); camLook.copy(tl); G.camSnap = false; }
    const k = 1 - Math.exp(-CAM.POSITION_FOLLOW * dt);
    camPos.lerp(tp, k); camLook.lerp(tl, k);
  }
  camera.position.copy(camPos);
  if (G.shakeAmt > 0.01) {
    const st = G.time; // フレームごとの乱数ではなく連続した揺れにして、視点が急に跳ねないようにする
    camera.position.add(new THREE.Vector3(Math.sin(st * 29), Math.sin(st * 23 + 1.3) * 0.6, Math.sin(st * 19 + 2.1)).multiplyScalar(G.shakeAmt * CAM.SHAKE_SCALE));
    G.shakeAmt *= Math.exp(-4 * dt);
  }
  camera.lookAt(camLook);
}

// ---------------------------------------------------------------- dying / stage 11
function updateDying(dt) {
  G.dieT += dt;
  const S = G.ship;
  S.vx *= Math.exp(-1.5 * dt); S.vz *= Math.exp(-1.5 * dt);
  S.x += S.vx * dt; S.z += S.vz * dt;
  playerMesh.position.set(S.x, -G.dieT * 2.2, S.z);
  playerMesh.rotation.z = Math.min(0.5, G.dieT * 0.18);
  playerMesh.rotation.x = Math.min(0.25, G.dieT * 0.08);
  if (Math.random() < dt * 14) {
    const f = shipFwd(), s = rand(-12, 12);
    spawn({ pos: new THREE.Vector3(S.x + f.x * s, 2, S.z + f.z * s), vel: new THREE.Vector3(rand(-1, 1), rand(6, 10), rand(-1, 1)), color: 0xff7a20, size: rand(1.5, 3), grow: 1, life: 0.9 });
    spawn({ pos: new THREE.Vector3(S.x + f.x * s, 5, S.z + f.z * s), vel: new THREE.Vector3(rand(-1, 1), rand(5, 9), rand(-1, 1)), color: 0x222222, size: rand(2, 3.5), grow: 3, life: 3.5, opacity: 0.6 });
  }
  if (G.dieT > 3.8) endGame(G.dieReason);
}

let blast = null;

// ---- 第11ステージの最終イベント ----
// 画面の演出要素（警報・無線・フェード・HUD）を通常の状態に戻す
function resetEventUI() {
  $('alertFrame').style.display = 'none';
  $('alertText').style.display = 'none';
  $('radio').style.display = 'none'; $('radio').style.opacity = 1; $('radioLines').innerHTML = '';
  $('fade').style.transition = 'none'; $('fade').style.opacity = 0;
  $('hud').style.opacity = 1; $('labels').style.opacity = 1;
  G.autoSteer = 0;
}
// 契約解除ラインに近づいた瞬間に1回だけ呼ばれる
function startFinalEvent() {
  const s = G.s11, S = G.ship;
  s.started = true; s.t = 0;
  G.mode = 'stage11';
  G.dash = false; G.throttle = 1; G.autoSteer = 0;
  updateButtons();
  $('progress').style.display = 'none';
  // 攻撃をすべて止める：飛んでいる弾・ドローン・ミサイルは空中で消え、武装艇は引き返す
  for (const u of bullets) { scene.remove(u.mesh); splash(u.pos.x, u.pos.z, 0.6); }
  bullets = [];
  for (const d of drones) { explosion(d.pos.x, d.pos.y, d.pos.z, 0.5); scene.remove(d.mesh); if (d.ring) scene.remove(d.ring); }
  drones = [];
  for (const ms of missiles) { explosion(ms.mesh.position.x, ms.mesh.position.y, ms.mesh.position.z, 0.5); scene.remove(ms.mesh); scene.remove(ms.ring); }
  missiles = [];
  for (const b of boats) { b.state = 'return'; b.burstLeft = 0; b.marker.visible = false; }
  // 自動航行する航路上（前方の中央付近）の機雷は取り除き、演出中にぶつからないようにする
  mines = mines.filter((m) => {
    const inPath = m.z < S.z + 20 && m.z > S.z - 520 && Math.abs(m.x - centerX(m.z)) < 50;
    if (inPath) scene.remove(m.mesh);
    return !inPath;
  });
  if (!s.good) { s.blastX = centerX(S.z - 1000); s.blastZ = S.z - 1000; }
}
// 演出中の自動航行：航路の中央線上の少し先を目指して、通常の舵で静かに進む
function autopilot() {
  const S = G.ship, tz = S.z - 140, tx = centerX(tz);
  const err = wrapAngle(Math.atan2(tx - S.x, tz - S.z) - S.heading) - S.yawRate * 0.8;
  G.autoSteer = err > 0.03 ? 1 : (err < -0.03 ? -1 : 0);
}
// 演出中の武装艇：撃たずに母港へ戻る
function calmBoats(dt) {
  for (const b of boats) {
    const want = Math.atan2(b.homeX - b.x, b.homeZ - b.z);
    b.heading = wrapAngle(b.heading + clamp(wrapAngle(want - b.heading), -1.2 * dt, 1.2 * dt));
    const far = Math.hypot(b.homeX - b.x, b.homeZ - b.z) > 15;
    b.speed += clamp((far ? 10 : 0) - b.speed, -6 * dt, 6 * dt);
    b.x += Math.sin(b.heading) * b.speed * dt; b.z += Math.cos(b.heading) * b.speed * dt;
    b.mesh.position.set(b.x, 0.3 + Math.sin(G.time * 3 + b.ph) * 0.15, b.z);
    b.mesh.rotation.set(0, b.heading, 0);
  }
}
const textLines = (arr, fallback) => (Array.isArray(arr) && arr.length ? arr : fallback).map((t) => String(t).trim());

function updateStage11(dt) {
  const s = G.s11; s.t += dt;
  autopilot();
  updateShip(dt);
  calmBoats(dt);
  shipEffects(dt);
  if (s.good) updateLegendFinal(dt); else updateNormalFinal(dt);
}

// 高評価ルート：緊急無線 → 停戦合意 → 静かな航海 → ゆっくり暗転 → ゲームクリア
function updateLegendFinal(dt) {
  const s = G.s11, LG = C.STAGE11.LEGEND;
  const D = window.DIALOGUES || {};
  const lines = textLines(D.STAGE11_LEGEND_RADIO, ['関係各国による停戦合意が成立した。']);
  const once = (key, t, fn) => { if (s.t >= t && !s[key]) { s[key] = true; fn(); } };
  // 1. 着信音と「緊急無線 受信中」
  once('ring', 0, () => {
    $('radio').style.display = 'block'; $('radio').style.opacity = 1; $('radioLines').innerHTML = '';
    for (let k = 0; k < 3; k++) { setTimeout(() => beep(1046, 0.12, 0.06, 'sine'), k * 520); setTimeout(() => beep(1318, 0.12, 0.06, 'sine'), k * 520 + 150); }
  });
  // 2〜4. 無線メッセージを1行ずつ表示（最後の行がプレイヤーの功績）
  lines.forEach((text, i) => once('line' + i, LG.RING_SEC + i * LG.LINE_SEC, () => {
    const el = document.createElement('div');
    el.className = 'line'; el.textContent = text;
    $('radioLines').appendChild(el);
    setTimeout(() => el.classList.add('show'), 30);
    noise(0.12, 0.05, 3000); // 無線のノイズ
  }));
  const radioEnd = LG.RING_SEC + lines.length * LG.LINE_SEC + LG.AFTER_RADIO_SEC;
  // 5. 無線とHUDを消し、文字のない静かな海を航行する
  once('quiet', radioEnd, () => {
    $('radio').style.opacity = 0;
    setTimeout(() => { if (G.mode === 'stage11') $('radio').style.display = 'none'; }, 1600);
    $('hud').style.opacity = 0; $('labels').style.opacity = 0;
  });
  // 6. ゆっくり暗転
  const fadeAt = radioEnd + LG.QUIET_SEC;
  once('fade', fadeAt, () => { $('fade').style.transition = `opacity ${LG.FADE_SEC}s ease-in`; $('fade').style.opacity = 1; });
  // 7. ゲームクリア画面（称号「ホルムズ海峡の伝説」）
  once('end', fadeAt + LG.FADE_SEC + 0.4, () => { endGame('legend'); });
}

// 通常ルート：緊急警報 → 間 → 閃光 → 大量破壊兵器と衝撃波（既存演出）→ ゲームオーバー
function updateNormalFinal(dt) {
  const s = G.s11, S = G.ship, NM = C.STAGE11.NORMAL;
  const D = window.DIALOGUES || {};
  const W = $('whiteout');
  const BX = s.blastX, BZ = s.blastZ, F = NM.FLASH_AT_SEC;
  const once = (key, t, fn) => { if (s.t >= t && !s[key]) { s[key] = true; fn(); } };
  // 1〜2. 警告音と緊急警報
  once('alarm', 0, () => {
    for (let k = 0; k < 4; k++) setTimeout(() => beep(1180, 0.16, 0.08, 'square'), k * 260);
    $('alertFrame').style.display = 'block';
    $('alertText').textContent = textLines(D.STAGE11_NORMAL_ALERT, ['緊急警報！']).join('\n');
    $('alertText').style.display = 'block';
  });
  once('alarmOff', NM.ALERT_SEC, () => { $('alertText').style.display = 'none'; $('alertFrame').style.display = 'none'; });
  // 3. 少し間を置いて、水平線の先に光点
  if (s.t > F - 1.4 && !s.point) {
    s.point = true;
    blast = { core: new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true })) };
    blast.core.position.set(BX, 30, BZ);
    scene.add(blast.core);
    beep(180, 1.2, 0.05, 'sine');
  }
  if (blast && blast.core && !s.flash) blast.core.scale.setScalar(1 + (s.t - (F - 1.4)) * 6);
  // 4. 強烈な閃光と、既存の大量破壊兵器・衝撃波の演出
  if (s.t > F && !s.flash) {
    s.flash = true;
    W.style.transition = 'opacity 0.12s'; W.style.opacity = 1;
    setTimeout(() => { W.style.transition = 'opacity 1.4s'; W.style.opacity = 0.35; }, 260);
    blast.fire = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({ color: 0xffcf80, fog: false, transparent: true, opacity: 0.95 }));
    blast.fire.position.set(BX, 0, BZ);
    blast.wave = new THREE.Mesh(geoRing, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    blast.wave.position.set(BX, 1, BZ);
    blast.stem = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24), new THREE.MeshBasicMaterial({ color: 0xd8b890, fog: false, transparent: true, opacity: 0.85 }));
    blast.stem.position.set(BX, 0, BZ);
    scene.add(blast.fire, blast.wave, blast.stem);
    noise(5, 0.9, 120); noise(2.5, 0.6, 900);
    shake(4);
  }
  if (s.flash) {
    const u = s.t - F;
    const R = 40 + u * 140;
    blast.fire.scale.set(R, R * 0.8, R);
    blast.fire.position.y = Math.min(260, u * 45);
    blast.fire.material.color.setHSL(0.08, 1, Math.max(0.55, 0.9 - u * 0.08));
    blast.stem.scale.set(R * 0.22, Math.min(260, u * 45) * 2, R * 0.22);
    const wr = 30 + u * 460;
    blast.wave.scale.setScalar(wr);
    G.shakeAmt = Math.max(G.shakeAmt, 1.2);
    const dShip = Math.hypot(S.x - BX, S.z - BZ);
    if (wr > dShip && !s.hitWave) {
      s.hitWave = true;
      shake(6);
      W.style.transition = 'opacity 0.5s'; W.style.opacity = 1;
      noise(3, 0.8, 300);
    }
  }
  // 5. 通信途絶 → ゲームオーバー画面
  if (s.hitWave) {
    s.after = (s.after || 0) + dt;
    if (s.after > 2.2 && !s.text) { s.text = true; W.style.color = '#666'; W.textContent = '— 通信途絶 —'; }
    if (s.after > NM.AFTER_WAVE_SEC && !s.ended) { s.ended = true; cleanupBlast(); W.style.transition = 'opacity 0.2s'; endGame('stage11'); }
  }
}
function cleanupBlast() {
  if (!blast) return;
  for (const k of ['core', 'fire', 'wave', 'stem']) if (blast[k]) scene.remove(blast[k]);
  blast = null;
}

// ---------------------------------------------------------------- loop
let last = performance.now(), rafId = 0;
function frame(now) {
  if (G.quit) return; // 終了後は再開しない
  rafId = requestAnimationFrame(frame);
  // フレームレートが下がっても（20fps未満）ゲーム内の時間が遅れないよう、1回分を0.05秒以下に分けて進める。
  // 60fpsなど通常は1回で済むので、PCでの動きは従来と同じ。画面復帰時などの大きな間隔は0.25秒で打ち切る。
  const elapsed = Math.min(0.25, Math.max(0, (now - last) / 1000));
  last = now;
  const n = Math.max(1, Math.ceil(elapsed / 0.05 - 1e-6));
  const step = elapsed / n;
  for (let i = 0; i < n - 1; i++) tick(step, true);
  tick(step);
}
function tick(dt, noRender) {
  if (G.quit) return;
  const frozen = G.mode === 'paused' || G.mode === 'confirm';
  if (!frozen) G.time += dt;
  if (G.mode === 'play') updatePlay(dt);
  else if (G.mode === 'dying') updateDying(dt);
  else if (G.mode === 'stage11') updateStage11(dt);
  if (!frozen) updateParticles(dt);
  if (G.mode !== 'dying') syncShipMesh(dt);
  updateCamera(frozen ? 0 : dt);
  bgm.setScene(bgmSceneFor());
  bgm.update(dt);
  if (G.mode !== 'title') {
    hudT -= dt;
    if (hudT <= 0) { hudT = 0.08; updateHud(); }
    drawMinimap();
  }
  if (noRender) return;
  updateLabels();
  renderer.render(scene, camera);
}

buildWorld();
resetShip();
Object.assign(G, { pending: C.CONTRACT_REWARD, losses: 0, lossBy: {}, phase: 'outbound', hull: 100 });
showTitle();
rafId = requestAnimationFrame(frame);

// デバッグ用（ブラウザのコンソールから参照可）
})();
