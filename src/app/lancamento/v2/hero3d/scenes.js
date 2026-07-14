/* eslint-disable */
// @ts-nocheck
import * as THREE from "three"
let SCENES = null
/* ════════════════════════════════════════════════════════════
   Audere — Hero 3D v3 · CENAS (sólidas)
   Partículas = tecido de transição; ao chegar, cada cena se
   condensa em elementos SÓLIDOS (esferas, linhas, micro-UI),
   espelhando as animações das seções do site.
   Expõe window.AudereH3DScenes { N, order, states }
   ════════════════════════════════════════════════════════════ */

try {
  const N = 36000;
  const PI = Math.PI;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const gauss = (r) => (r() + r() + r() + r() - 2) * 0.72;
  const put = (f, i, x, y, z, sh, or) => {
    f.pos[i * 3] = x; f.pos[i * 3 + 1] = y; f.pos[i * 3 + 2] = z;
    f.shade[i] = sh; f.order[i] = or;
  };
  const mkForm = () => ({ pos: new Float32Array(N * 3), shade: new Float32Array(N), order: new Float32Array(N) });
  /* poeira ambiente com teto — excedente sai de cena */
  function dust(f, i0, r, cap) {
    const end = Math.min(N, i0 + (cap || 2000));
    for (let i = i0; i < end; i++)
      put(f, i, (r() * 2 - 1) * 4.2, (r() * 2 - 1) * 2.6, -0.8 - r() * 2.6, 0.5 + gauss(r) * 0.1, r());
    for (let i = end; i < N; i++) put(f, i, 0, 0, -60, 0.5, r());
  }
  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  function liveLine(THREE, n, mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const obj = new THREE.Line(g, mat);
    obj.frustumCulled = false;
    return {
      obj,
      set(fn) {
        const a = g.attributes.position.array;
        for (let i = 0; i < n; i++) { const p = fn(i, i / (n - 1)); a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2]; }
        g.attributes.position.needsUpdate = true;
      },
    };
  }
  function lineMat(THREE, color, opacity, dark) {
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity,
      blending: dark ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false });
    m.userData.base = opacity;
    return m;
  }
  function ptsMat(THREE, color, size, opacity, dark) {
    const m = new THREE.PointsMaterial({ color, size, transparent: true, opacity, sizeAttenuation: false,
      blending: dark ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false });
    m.userData.base = opacity;
    return m;
  }
  function solidMat(THREE, color, opts = {}) {
    const m = new THREE.MeshStandardMaterial({
      color, roughness: opts.rough ?? 0.42, metalness: 0.06,
      emissive: color, emissiveIntensity: opts.glow ?? 0.18,
      transparent: true, opacity: opts.opacity ?? 1,
    });
    m.userData.base = m.opacity;
    return m;
  }
  function basicMat(THREE, color, opacity) {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    m.userData.base = opacity;
    return m;
  }
  /* cilindro fino entre dois pontos (aresta sólida) */
  function rod(THREE, a, b, radius, mat) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const dir = B.clone().sub(A);
    const len = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 6, 1, true), mat);
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return mesh;
  }
  /* cadência de "digitação" com ritmo de fala: limiares por traço */
  function cadence(count, rows, r) {
    const th = [];
    let acc = 0;
    for (let k = 0; k < count; k++) {
      acc += 0.6 + r() * 0.9 + (rows.includes(k) ? 2.6 : 0);   /* pausa entre frases */
      th.push(acc);
    }
    return th.map((v) => v / acc);
  }

  /* ════════ INTRO · espiral fina da marca ════════ */
  const spiral = {
    mode: "light", bg: "#f6f4ee", c: ["#6a4ec8", "#4a349a", "#5a9e8a"], alpha: 0.9,
    cam: { pos: [0, 0, 5.1], look: [0, 0, 0] }, rotAmp: 0.1,
    form() {
      const f = mkForm(), r = mulberry32(101);
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        /* sentido e assimetria batendo com a marca (winding horário, raio não-uniforme) */
        const ang = PI * 0.55 - u * PI * 2 * 1.9 + Math.sin(u * 2.3 + 0.4) * 0.14;
        const rad = (0.14 + 1.5 * Math.pow(u, 0.9)) * (1 + 0.07 * Math.sin(u * 3.6 + 0.7));
        const j = 0.007 + 0.006 * u;
        put(f, i,
          Math.cos(ang) * rad + gauss(r) * j,
          Math.sin(ang) * rad * 0.96 + gauss(r) * j,
          Math.sin(u * PI * 2) * 0.1 + gauss(r) * j,
          u, Math.min(1, u + r() * 0.01));
      }
      return f;
    },
  };

  /* ════════ 01 · PREPARAR — o contexto do caso se reúne antes da sessão ════════ */
  const PREP_ROWY = [0.30, -0.02, -0.34, -0.66];
  const PREP_COLORS = ["#b07d40", "#6a4ec8", "#5a9e8a", "#948da9"];
  const preparar = {
    mode: "light", bg: "#f6f4ee", c: ["#291860", "#6a4ec8", "#b07d40"], alpha: 0.82, alphaIdle: 0.14,
    cam: { pos: [0, 0, 6.15], look: [0, -0.02, 0], via: [0, 0.85, 5.7] }, rotAmp: 0.07,
    transDur: 3.6,
    form() {
      const f = mkForm(), r = mulberry32(151);
      let i = 0;
      /* banda de cabeçalho */
      for (let n = 0; n < 1200; n++, i++)
        put(f, i, -1.0 + r() * 1.98 + gauss(r) * 0.01, 0.62 + gauss(r) * 0.02, gauss(r) * 0.02, 0.12, r());
      /* linhas dos 4 itens (traços) */
      for (let rIdx = 0; rIdx < 4; rIdx++) {
        const y = PREP_ROWY[rIdx], reach = 1.02 - (rIdx % 2) * 0.28;
        for (let d = 0; d < 11; d++) {
          const x0 = -0.66 + (d / 11) * (reach + 0.66) + r() * 0.02, len = 0.06 + r() * 0.07;
          if (x0 > reach) break;
          for (let n = 0; n < 34; n++, i++)
            put(f, i, x0 + (n / 34) * len, y + gauss(r) * 0.007, gauss(r) * 0.01, 0.34 + rIdx * 0.1, r());
        }
      }
      /* dots dos itens (marcadores coloridos) */
      for (let rIdx = 0; rIdx < 4; rIdx++)
        for (let n = 0; n < 240; n++, i++)
          put(f, i, -0.92 + gauss(r) * 0.03, PREP_ROWY[rIdx] + gauss(r) * 0.03, gauss(r) * 0.03, 0.55 + rIdx * 0.1, r());
      /* moldura do painel (retângulo arredondado) */
      const bx = 1.2, by = 0.98, rad = 0.17, perim = 2200;
      for (let n = 0; n < perim; n++, i++) {
        const u = n / perim, t = u * 4;
        let x, y;
        if (t < 1) { x = -bx + t * 2 * bx; y = by; }
        else if (t < 2) { x = bx; y = by - (t - 1) * 2 * by; }
        else if (t < 3) { x = bx - (t - 2) * 2 * bx; y = -by; }
        else { x = -bx; y = -by + (t - 3) * 2 * by; }
        /* suaviza cantos empurrando pra dentro */
        const cx = Math.max(-bx + rad, Math.min(bx - rad, x));
        const cy = Math.max(-by + rad, Math.min(by - rad, y));
        const dx = x - cx, dy = y - cy, dl = Math.hypot(dx, dy);
        if (dl > rad) { x = cx + (dx / dl) * rad; y = cy + (dy / dl) * rad; }
        put(f, i, x + gauss(r) * 0.008, y + gauss(r) * 0.008, gauss(r) * 0.015, 0.2, r());
      }
      dust(f, i, r, 1000);
      return f;
    },
    build(THREE) {
      const g = new THREE.Group(), mats = [];
      /* régua sob o cabeçalho */
      const hm = lineMat(THREE, "#6a4ec8", 0.42, false); mats.push(hm);
      const hg = new THREE.BufferGeometry();
      hg.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1.0, 0.5, 0.01, 1.0, 0.5, 0.01]), 3));
      const hline = new THREE.Line(hg, hm); hline.frustumCulled = false; g.add(hline);
      /* dots coloridos que surgem em sequência */
      const sph = new THREE.SphereGeometry(1, 18, 14);
      const dots = PREP_ROWY.map((y, k) => {
        const m = solidMat(THREE, PREP_COLORS[k], { glow: 0.3, rough: 0.4 }); mats.push(m);
        const s = new THREE.Mesh(sph, m);
        s.position.set(-0.92, y, 0.03); s.scale.setScalar(0.001);
        g.add(s);
        return s;
      });
      return {
        group: g, mats,
        update(dt, t, age) {
          hm.opacity = hm.userData.base * clamp01((age - 0.3) / 0.8);
          dots.forEach((s, k) => {
            const inR = clamp01((age - (0.8 + k * 0.95)) / 0.7);
            const e = inR * inR * (3 - 2 * inR);
            s.scale.setScalar(Math.max(0.001, 0.06 * e));
            s.position.y = PREP_ROWY[k] + Math.sin(t * 0.7 + k) * 0.006;
          });
        },
      };
    },
  };

  /* ════════ 02 · SESSÕES — gravação → transcrição ════════ */
  const sessoes = {
    mode: "light", bg: "#f6f4ee", c: ["#291860", "#6a4ec8", "#5a9e8a"], alpha: 0.85, alphaIdle: 0.1,
    cam: { pos: [0, 0, 7], look: [0, -0.05, 0], via: [-1.3, 0.4, 6.2] }, rotAmp: 0.14,
    form() {
      const f = mkForm(), r = mulberry32(202);
      let i = 0;
      for (let k = 0; k < 8; k++)
        for (let n = 0; n < 170; n++, i++) {
          const on = k === 5;
          put(f, i, -2.0 + k * 0.57 + gauss(r) * (on ? 0.05 : 0.028),
            -0.95 + gauss(r) * (on ? 0.05 : 0.028), gauss(r) * 0.03,
            on ? 0.9 : 0.35, r());
        }
      for (let row = 0; row < 4; row++) {
        const y = 0.32 - row * 0.21, wEnd = row === 3 ? 0.55 : 1;
        for (let d = 0; d < 11 * wEnd; d++) {
          const x0 = -1.35 + d * 0.25 + r() * 0.05, len = 0.1 + r() * 0.13;
          for (let n = 0; n < 42; n++, i++)
            put(f, i, x0 + (n / 42) * len, y + gauss(r) * 0.008, gauss(r) * 0.012,
              0.15 + 0.3 * (row / 4), r());
        }
      }
      dust(f, i, r, 1500);
      return f;
    },
    build(THREE) {
      const dark = false, g = new THREE.Group(), mats = [];
      const mLine = lineMat(THREE, "#6a4ec8", 0.32, dark); mats.push(mLine);
      const mWave = lineMat(THREE, "#6a4ec8", 0.85, dark); mats.push(mWave);
      const mTx = lineMat(THREE, "#3d3852", 0.6, dark); mats.push(mTx);
      const mDotP = solidMat(THREE, "#a79ac9", { glow: 0, opacity: 0.9 }); mats.push(mDotP);
      const mDotA = solidMat(THREE, "#6a4ec8", { glow: 0.25 }); mats.push(mDotA);
      /* linha do tempo + sessões sólidas */
      const tl = liveLine(THREE, 2, mLine);
      tl.set((i) => [i ? 2.3 : -2.3, -0.95, 0]);
      g.add(tl.obj);
      const sph = new THREE.SphereGeometry(1, 18, 14);
      for (let k = 0; k < 8; k++) {
        const on = k === 5;
        const m = new THREE.Mesh(sph, on ? mDotA : mDotP);
        m.position.set(-2.0 + k * 0.57, -0.95, 0);
        m.scale.setScalar(on ? 0.062 : 0.034);
        g.add(m);
      }
      const stem = liveLine(THREE, 2, mLine);
      stem.set((i) => [0.85, i ? 0.58 : -0.9, 0]);
      g.add(stem.obj);
      /* waveform viva */
      const wave = liveLine(THREE, 130, mWave);
      g.add(wave.obj);
      /* transcrição sólida digitando com ritmo de fala */
      const rr = mulberry32(31);
      const segs = [], rowBreaks = [];
      for (let row = 0; row < 4; row++) {
        const y = 0.32 - row * 0.21, wEnd = row === 3 ? 0.55 : 1;
        rowBreaks.push(segs.length);
        for (let d = 0; d < 11 * wEnd; d++) {
          const x0 = -1.35 + d * 0.25 + rr() * 0.05, len = 0.1 + rr() * 0.13;
          segs.push([x0, y, 0, x0 + len, y, 0]);
        }
      }
      const ta = new Float32Array(segs.length * 6);
      segs.forEach((s, k) => ta.set(s, k * 6));
      const tg = new THREE.BufferGeometry();
      tg.setAttribute("position", new THREE.BufferAttribute(ta, 3));
      const tline = new THREE.LineSegments(tg, mTx);
      tline.frustumCulled = false;
      g.add(tline);
      const th = cadence(segs.length, rowBreaks, rr);
      return {
        group: g, mats,
        update(dt, t, age) {
          wave.set((i, u) => {
            const x = -1.35 + u * 2.7;
            const env = Math.sin(u * PI);
            const y = 0.72 + env * (Math.sin(u * 26 + t * 5.2) * 0.055 + Math.sin(u * 61 - t * 8.1) * 0.03
              + Math.sin(u * 9 + t * 2.1) * 0.05) * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.9)));
            return [x, y, 0];
          });
          /* digitação em loop */
          const p = (Math.max(0, age) % 12) / 12;
          const typed = Math.min(1, p / 0.8);
          let cnt = 0;
          while (cnt < th.length && th[cnt] <= typed) cnt++;
          tline.geometry.setDrawRange(0, cnt * 2);
          mTx.opacity = mTx.userData.base * (p > 0.93 ? 1 - (p - 0.93) / 0.07 : 1) * (mWave.opacity / mWave.userData.base);
        },
      };
    },
  };

  /* ════════ 02 · TEMAS — grafo semântico sólido (dados reais do GraphFigure) ════════ */
  const NATURE = {
    emocional:   "#c4607a",
    relacional:  "#6a4ec8",
    situacional: "#b07d40",
    cognitivo:   "#5a9e8a",
  };
  const TNODES = [
    { id: "mãe",            nat: "relacional",  freq: 12, p: [-1.10, 0.65, -0.2] },
    { id: "ansiedade",      nat: "emocional",   freq: 11, p: [0.17, 1.02, 0.3] },
    { id: "trabalho",       nat: "situacional", freq: 9,  p: [0.85, -0.17, 0.15] },
    { id: "cobrança",       nat: "situacional", freq: 8,  p: [1.24, 0.71, 0.15] },
    { id: "autoestima",     nat: "cognitivo",   freq: 7,  p: [-0.37, -0.11, -0.35] },
    { id: "culpa",          nat: "emocional",   freq: 6,  p: [-1.25, -0.35, 0.3] },
    { id: "relacionamento", nat: "relacional",  freq: 8,  p: [-0.54, -0.99, -0.2] },
    { id: "sono",           nat: "situacional", freq: 5,  p: [0.42, -0.85, 0.15] },
    { id: "sumir",          nat: "emocional",   freq: 4,  p: [1.31, -0.42, 0.3] },
  ];
  /* [origem, destino, peso] — clusters naturais, nem tudo se conecta */
  const TEDGES = [
    ["cobrança", "ansiedade", 6], ["cobrança", "autoestima", 4], ["trabalho", "ansiedade", 5],
    ["trabalho", "cobrança", 5], ["mãe", "culpa", 5], ["mãe", "relacionamento", 6],
    ["sumir", "ansiedade", 4], ["autoestima", "relacionamento", 4], ["sono", "trabalho", 4],
    ["ansiedade", "culpa", 3], ["autoestima", "mãe", 3],
  ].map(([a, b, w]) => [TNODES.findIndex((n) => n.id === a), TNODES.findIndex((n) => n.id === b), w]);
  const FOCUS = TNODES.findIndex((n) => n.id === "autoestima");
  const NATSH = { relacional: 0.0, situacional: 0.4, emocional: 0.5, cognitivo: 1.0 };
  /* quotes do tema-foco, na ordem das arestas que tocam FOCUS */
  const T_QUOTES = [
    "“autoestima” costuma surgir junto de “cobrança” — em 4 sessões",
    "“autoestima” aparece ao lado de “relacionamento” — em 4 sessões",
    "“autoestima” se conecta com “mãe” — em 3 sessões",
  ];

  /* ritmo do grafo — mais lento na abertura/meio, câmera assentando no fim */
  const G_SHIFT_X = -1.1;             /* deslocamento de composição (some da coluna de copy, sem cortar cobrança) */
  const G_NEAR_Z = 5.2;
  const G_REVEAL_START = 3.2, G_REVEAL_STEP = 6.5, G_REVEAL_DUR = 2.0;
  const G_PULLBACK_START = 20.5, G_PULLBACK_DUR = 7.0;
  /* janela suave (C¹ contínua) de destaque em torno de um instante — sem saltos entre vizinhos */
  const smoothWin = (age, center, half) => {
    const d = Math.abs(age - center);
    if (d >= half) return 0;
    const c = Math.cos((d / half) * (Math.PI / 2));
    return c * c;
  };

  const temas = {
    mode: "dark", bg: "#15101f", c: ["#8d72e8", "#c4607a", "#5a9e8a"], alpha: 0.62, alphaIdle: 0.14,
    cam: { pos: [-0.19 + G_SHIFT_X, 0.24, G_NEAR_Z], look: [-0.37 + G_SHIFT_X, -0.11, -0.35], via: [0.4, 0.35, 5.9] },
    transDur: 4.4, rotAmp: 0.045,
    /* foco (pausa contemplando um tema + vizinhos, câmera deslocada p/ liberar a coluna de copy)
       + giro suave e contínuo em direção ao vizinho que acende → recua devagar → contexto (grafo todo) */
    camProg(age) {
      const A = [-0.19 + G_SHIFT_X, 0.24, G_NEAR_Z], AL0 = [-0.37 + G_SHIFT_X, -0.11, -0.35];
      const B = [0, 0.15, 6.6], BL = [0, 0, 0];
      const e = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
      const p = e((age - G_PULLBACK_START) / G_PULLBACK_DUR);
      const dr = Math.sin(age * 0.35) * 0.035;
      /* giro cont\u00ednuo: m\u00e9dia ponderada por janelas C\u00b9 suaves entre os vizinhos e o foco — sem trocas abruptas */
      const focusIdxLocal = TEDGES.reduce((a2, e2, k) => { if (e2[0] === FOCUS || e2[1] === FOCUS) a2.push(k); return a2; }, []);
      let sumW = 0, ax = 0, ay = 0, az = 0;
      focusIdxLocal.forEach((k, fi) => {
        const center = G_REVEAL_START + fi * G_REVEAL_STEP + 0.5;
        const w = smoothWin(age, center, G_REVEAL_STEP * 0.62);
        if (w <= 0) return;
        sumW += w;
        const other = TEDGES[k][0] === FOCUS ? TEDGES[k][1] : TEDGES[k][0];
        ax += w * (TNODES[other].p[0] + G_SHIFT_X);
        ay += w * TNODES[other].p[1];
        az += w * TNODES[other].p[2];
      });
      const restW = Math.max(0, 1 - sumW);
      ax += restW * AL0[0]; ay += restW * AL0[1]; az += restW * AL0[2];
      const totalW = sumW + restW;
      const swivelStrength = Math.min(1, sumW) * 0.4;
      const targetX = ax / totalW, targetY = ay / totalW, targetZ = az / totalW;
      const AL = [
        AL0[0] + (targetX - AL0[0]) * swivelStrength,
        AL0[1] + (targetY - AL0[1]) * swivelStrength,
        AL0[2] + (targetZ - AL0[2]) * swivelStrength,
      ];
      return {
        pos: [A[0] + (B[0] - A[0]) * p, A[1] + (B[1] - A[1]) * p + dr, A[2] + (B[2] - A[2]) * p],
        look: [AL[0] + (BL[0] - AL[0]) * p, AL[1] + (BL[1] - AL[1]) * p, AL[2] + (BL[2] - AL[2]) * p],
      };
    },
    nodes: TNODES,
    form() {
      const f = mkForm(), r = mulberry32(303);
      let i = 0;
      const total = TNODES.reduce((s, n) => s + n.freq, 0);
      for (const nd of TNODES) {
        const cnt = Math.floor(5200 * nd.freq / total);
        const sg = 0.035 * (0.6 + nd.freq / 12);
        for (let n = 0; n < cnt; n++, i++)
          put(f, i, nd.p[0] + gauss(r) * sg, nd.p[1] + gauss(r) * sg, nd.p[2] + gauss(r) * sg,
            clamp01(NATSH[nd.nat] + gauss(r) * 0.04), r());
      }
      for (let n = 0; n < 1800; n++, i++) {
        const th = Math.acos(2 * r() - 1), ph = r() * 2 * PI, rad = 1.0 + r() * 1.1;
        put(f, i, Math.sin(th) * Math.cos(ph) * rad, Math.sin(th) * Math.sin(ph) * rad, Math.cos(th) * rad,
          0.5 + gauss(r) * 0.15, r());
      }
      dust(f, i, r, 3200);
      return f;
    },
    build(THREE) {
      const dark = true, g = new THREE.Group(), mats = [];
      const cl01 = (x) => Math.max(0, Math.min(1, x));
      const DIM_OP = 0.14, DIM_SCALE = 0.8;
      /* texturas de glow / anel, geradas por canvas — sprites sempre de frente p/ câmera */
      const mkTex = (draw) => {
        const cv = document.createElement("canvas"); cv.width = cv.height = 128;
        draw(cv.getContext("2d"));
        const tx = new THREE.CanvasTexture(cv);
        tx.needsUpdate = true;
        return tx;
      };
      const glowTex = mkTex((cx) => {
        const g2 = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
        g2.addColorStop(0, "rgba(255,255,255,1)"); g2.addColorStop(0.35, "rgba(255,255,255,.55)");
        g2.addColorStop(1, "rgba(255,255,255,0)");
        cx.fillStyle = g2; cx.fillRect(0, 0, 128, 128);
      });
      const ringTex = mkTex((cx) => {
        cx.strokeStyle = "rgba(255,255,255,1)"; cx.lineWidth = 5;
        cx.beginPath(); cx.arc(64, 64, 52, 0, Math.PI * 2); cx.stroke();
        cx.filter = "blur(2px)"; cx.stroke();
      });
      /* planetas: esferas acetinadas metálicas, vivas */
      const sph = new THREE.SphereGeometry(1, 48, 36);
      const nodes = TNODES.map((nd, i) => {
        const col = new THREE.Color(NATURE[nd.nat]);
        const m = new THREE.MeshPhysicalMaterial({
          color: col.clone(), roughness: 0.24, metalness: 0.35,
          clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 1.4,
          emissive: col.clone(), emissiveIntensity: 0.22,
          transparent: true, opacity: 1,
        });
        m.userData.base = 1;
        mats.push(m);
        const mesh = new THREE.Mesh(sph, m);
        mesh.position.set(...nd.p);
        const s = 0.05 + (nd.freq / 12) * 0.09;
        mesh.scale.setScalar(s);
        g.add(mesh);
        /* halo aditivo por trás da esfera */
        const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: col.clone(),
          transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
        glowMat.userData.base = 1;
        mats.push(glowMat);
        const glow = new THREE.Sprite(glowMat);
        glow.position.copy(mesh.position);
        glow.scale.setScalar(s * 3.4);
        g.add(glow);
        let ring = null;
        if (i === FOCUS) {
          const ringMat = new THREE.SpriteMaterial({ map: ringTex, color: col.clone(),
            transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
          ringMat.userData.base = 1;
          mats.push(ringMat);
          ring = new THREE.Sprite(ringMat);
          ring.position.copy(mesh.position);
          g.add(ring);
        }
        return { mesh, mat: m, glow, glowMat, ring, base: col, s, ph: i * 1.7, isFocus: i === FOCUS };
      });
      /* arestas: uma haste por conexão, cor única — a do nó de origem (a) */
      const edges = TEDGES.map(([a, b]) => {
        const m = new THREE.MeshBasicMaterial({ color: NATURE[TNODES[a].nat], transparent: true, opacity: 0.04, depthWrite: false });
        m.userData.base = 0.85;
        mats.push(m);
        g.add(rod(THREE, TNODES[a].p, TNODES[b].p, 0.0075, m));
        return { a, b, mat: m, br: 0 };
      });
      const focusIdx = [];
      TEDGES.forEach((e, k) => { if (e[0] === FOCUS || e[1] === FOCUS) focusIdx.push(k); });
      /* bolinhas de luz viajando — núcleo brilhante + halo pulsante, cor do nó de origem */
      const mP = new THREE.PointsMaterial({ size: 10, map: glowTex, transparent: true, opacity: 0.98,
        sizeAttenuation: false, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false });
      mP.userData.base = 0.98;
      mats.push(mP);
      const mPHalo = new THREE.PointsMaterial({ size: 30, map: glowTex, transparent: true, opacity: 0.55,
        sizeAttenuation: false, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false });
      mPHalo.userData.base = 0.55;
      mats.push(mPHalo);
      const nE = TEDGES.length;
      const pg = new THREE.BufferGeometry();
      pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(nE * 3), 3));
      const pc = new Float32Array(nE * 3);
      TEDGES.forEach(([a], k) => {
        const c = new THREE.Color(NATURE[TNODES[a].nat]);
        pc[k * 3] = c.r; pc[k * 3 + 1] = c.g; pc[k * 3 + 2] = c.b;
      });
      pg.setAttribute("color", new THREE.BufferAttribute(pc, 3));
      const pulseHalo = new THREE.Points(pg, mPHalo);
      pulseHalo.frustumCulled = false;
      g.add(pulseHalo);
      const pulses = new THREE.Points(pg, mP);
      pulses.frustumCulled = false;
      g.add(pulses);
      const REVEAL_STEP = G_REVEAL_STEP, REVEAL_START = G_REVEAL_START, REVEAL_DUR = G_REVEAL_DUR;
      return {
        group: g, mats,
        update(dt, t, age) {
          const allT = cl01((age - G_PULLBACK_START) / G_PULLBACK_DUR);          /* contexto: tudo acende ao recuar */
          /* arestas do foco acendem uma a uma; demais ficam quase invisíveis até o contexto */
          edges.forEach((ed, k) => {
            const fi = focusIdx.indexOf(k);
            let b = 0;
            if (fi >= 0) b = cl01((age - (REVEAL_START + fi * REVEAL_STEP)) / REVEAL_DUR);
            b = Math.max(b, allT);
            ed.br = b;
            ed.mat.opacity = ed.mat.userData.base * (0.035 + 0.965 * b);
          });
          /* esferas: foco sempre pleno + anel pulsante; vizinhos acendem com a aresta; resto dim até o contexto */
          nodes.forEach((nd, i) => {
            let d = nd.isFocus ? 1 : 0;
            focusIdx.forEach((k, fi) => {
              const e = TEDGES[k], other = e[0] === FOCUS ? e[1] : e[0];
              if (other === i) d = Math.max(d, cl01((age - (REVEAL_START + fi * REVEAL_STEP + 0.4)) / 0.8));
            });
            d = Math.max(d, allT);
            const op = DIM_OP + (1 - DIM_OP) * d;
            nd.mat.opacity = op;
            nd.mat.emissiveIntensity = 0.08 + 0.62 * d;
            const scaleBoost = DIM_SCALE + (1 - DIM_SCALE) * d;
            const pulseAmt = nd.isFocus ? 0.09 : 0.045;
            const breathe = 1 + pulseAmt * Math.sin(t * (nd.isFocus ? 1.6 : 1.1) + nd.ph);
            const w = nd.s * scaleBoost * breathe;
            nd.mesh.scale.set(
              w * (1 + 0.03 * Math.sin(t * 0.8 + nd.ph * 2.1)), w,
              w * (1 + 0.03 * Math.cos(t * 0.95 + nd.ph)));
            /* halo aditivo cresce com o destaque */
            nd.glow.scale.setScalar(nd.s * (2.6 + 1.6 * d) * (1 + 0.05 * Math.sin(t * 1.3 + nd.ph)));
            nd.glowMat.opacity = 0.55 * d * d;
            if (nd.ring) {
              const pulse = (Math.sin(t * 1.9) + 1) / 2;
              nd.ring.scale.setScalar(nd.s * (2.3 + 1.1 * pulse));
              nd.ring.material.opacity = d * (0.35 + 0.4 * (1 - pulse));
            }
          });
          /* pulsos de luz percorrendo as arestas acesas — glow pulsante */
          mPHalo.opacity = mPHalo.userData.base * (0.55 + 0.45 * Math.sin(t * 3.6));
          mP.opacity = mP.userData.base * (0.75 + 0.25 * Math.sin(t * 3.6 + 1.2));
          const a = pg.attributes.position.array;
          edges.forEach((ed, k) => {
            if (ed.br > 0.3) {
              const u = (t * 0.15 + k * 0.41) % 1;
              const A = TNODES[ed.a].p, B = TNODES[ed.b].p;
              a[k * 3] = A[0] + (B[0] - A[0]) * u;
              a[k * 3 + 1] = A[1] + (B[1] - A[1]) * u;
              a[k * 3 + 2] = A[2] + (B[2] - A[2]) * u;
            } else { a[k * 3] = 0; a[k * 3 + 1] = 0; a[k * 3 + 2] = -60; }
          });
          pg.attributes.position.needsUpdate = true;
        },
      };
    },
  };

  /* ════════ 03 · OBJETIVOS — fase 1: dashboard (particulas ambiente) · fase 2: crawl 3D ════════ */
  const OBJ_PHASE1_DUR = 13.5;  /* dashboard HTML visível (fase única) */
  const OBJ_CRAWL_DUR = 0;      /* crawl removido */

  /* dados do T-Score e da evolução longitudinal (10 medições cada) */
  const OBJ_TSCORE = [38, 38, 50, 50, 69, 44, 62, 44, 56, 62];
  const OBJ_LONG_A = [-1, -1, 0, -2, 2, -1, 1, 0, 0, 1];      /* reduzir uso diário */
  const OBJ_LONG_B = [-1, -1, 2, 1, 0, -1, 1, -2, 1, 1];      /* reduzir uso associado */
  const OBJ_N = OBJ_TSCORE.length;
  /* "página" do crawl inclinada RECEDENDO pra longe do espectador (estilo Star Wars):
     v=0 é o topo do gráfico (longe, alto, pequeno); v cresce vindo pra frente e pra baixo,
     em direção à câmera. A câmera fica embaixo/à frente olhando pra cima ao longo do plano,
     e desliza pra baixo revelando o gráfico 2 depois do 1. */
  const OBJ_PITCH = 0.86;
  const _cosP = Math.cos(OBJ_PITCH), _sinP = Math.sin(OBJ_PITCH);
  const OBJ_X = (k) => -1.0 + (k / (OBJ_N - 1)) * 2.0;
  const OBJ_V1_BASE = 0.0, OBJ_V1_H = 1.3;
  const OBJ_V2_BASE = 1.8, OBJ_V2_H = 1.3;
  const objVtoYZ = (v) => [1.05 - v * _sinP, -1.9 + v * _cosP];
  const objV1 = (score) => OBJ_V1_BASE + (1 - (score - 20) / 60) * OBJ_V1_H;
  const objV2 = (val) => OBJ_V2_BASE + (1 - (val + 2) / 4) * OBJ_V2_H;

  const GAS_DATA = [-1, -1, -0.5, 0, -0.5, 0.5, 1, 1, 1.5];
  const gasXY = (k) => [0.18 + (k / (GAS_DATA.length - 1)) * 1.55, -0.32 + GAS_DATA[k] * 0.24];

  const objetivos = {
    mode: "light", bg: "#f3efe6", c: ["#291860", "#b07d40", "#6a4ec8"], alpha: 0.85, alphaIdle: 0.1,
    cam: { pos: [0, 0.3, 3.3], look: [0, 0.3, -1], via: [0.9, 0.7, 3.0] },
    transDur: 3.8, rotAmp: 0.02,
    /* apenas o dashboard HTML (fase única) — câmera com deriva suave contemplando a poeira
       ambiente durante todo o tempo (sem crawl / gráficos 3D) */
    camProg(age) {
      return { pos: [0, 0.3 + Math.sin(age * 0.22) * 0.05, 3.3], look: [0, 0.3, -1] };
    },
    nodes: null,
    form() {
      const f = mkForm(), r = mulberry32(404);
      let i = 0;
      /* poeira ambiente elegante — o dashboard HTML carrega toda a informação */
      for (let n = 0; n < 2600; n++, i++) {
        put(f, i, (r() * 2 - 1) * 2.2, (r() * 2 - 1) * 1.3, -r() * 4, 0.4 + gauss(r) * 0.15, r());
      }
      dust(f, i, r, 900);
      return f;
    },
  };

  /* ════════ 04 · EVOLUÇÃO — séries longitudinais ════════ */
  const EV_N = 90;
  const evPt = (u) => {
    const x = -2.3 + u * 4.6;
    return [x, -0.75 + u * 1.75 + Math.sin(u * 6.2) * 0.16 + Math.sin(u * 13.7) * 0.06, 0.5 - u * 0.9];
  };
  const evPt2 = (u) => {
    const p = evPt(u);
    return [p[0], p[1] - 0.22 + Math.sin(u * 7.1 + 2.1) * 0.1, p[2] - 0.15];
  };
  const EV_MARKS = [0.22, 0.55, 0.86];
  const evolucao = {
    mode: "dark", bg: "#0f1916", c: ["#9c85ea", "#d8cff8", "#7fd6b8"], alpha: 0.62, alphaIdle: 0.15,
    cam: { pos: [0, 0.15, 6.9], look: [0, 0.15, 0], via: [-2.3, -0.5, 6.1] }, rotAmp: 0.13,
    form() {
      const f = mkForm(), r = mulberry32(505);
      let i = 0;
      for (let n = 0; n < 4200; n++, i++) {
        const u = r(), p = evPt(u);
        put(f, i, p[0] + gauss(r) * 0.012, p[1] + gauss(r) * 0.012, p[2] + gauss(r) * 0.012, u, r());
      }
      for (let n = 0; n < 1600; n++, i++) {
        const u = r(), p = evPt2(u);
        put(f, i, p[0] + gauss(r) * 0.01, p[1] + gauss(r) * 0.01, p[2] + gauss(r) * 0.01, 0.5, r());
      }
      for (const u of EV_MARKS)
        for (let n = 0; n < 160; n++, i++) {
          const p = evPt(u);
          put(f, i, p[0] + gauss(r) * 0.03, p[1] + gauss(r) * 0.03, p[2] + gauss(r) * 0.03, 0.95, r());
        }
      dust(f, i, r, 3200);
      return f;
    },
    build(THREE) {
      const dark = true, g = new THREE.Group(), mats = [];
      const mCur = lineMat(THREE, "#7fd6b8", 0.85, dark); mats.push(mCur);
      const mCur2 = lineMat(THREE, "#9c85ea", 0.7, dark); mats.push(mCur2);
      const mMark = lineMat(THREE, "#d9a05e", 0.35, dark); mats.push(mMark);
      const mMarkDot = solidMat(THREE, "#d9a05e", { glow: 0.4 }); mats.push(mMarkDot);
      const mk = (fn, mat) => {
        const cg = new THREE.BufferGeometry();
        const ca = new Float32Array(EV_N * 3);
        for (let k = 0; k < EV_N; k++) ca.set(fn(k / (EV_N - 1)), k * 3);
        cg.setAttribute("position", new THREE.BufferAttribute(ca, 3));
        const cl = new THREE.Line(cg, mat);
        cl.frustumCulled = false;
        g.add(cl);
        return cl;
      };
      const l1 = mk(evPt, mCur), l2 = mk(evPt2, mCur2);
      /* marcos: linha vertical + esfera */
      const sph = new THREE.SphereGeometry(1, 14, 10);
      const marks = EV_MARKS.map((u) => {
        const p = evPt(u);
        const vg = new THREE.BufferGeometry();
        vg.setAttribute("position", new THREE.BufferAttribute(new Float32Array([p[0], p[1] - 0.42, p[2], p[0], p[1] + 0.42, p[2]]), 3));
        const vl = new THREE.Line(vg, mMark);
        g.add(vl);
        const d = new THREE.Mesh(sph, mMarkDot);
        d.position.set(...p);
        d.scale.setScalar(0.03);
        g.add(d);
        return { vl, d, u };
      });
      return {
        group: g, mats,
        update(dt, t, age) {
          const p = clamp01(Math.max(0, age) / 2.8);
          l1.geometry.setDrawRange(0, Math.max(2, Math.ceil(EV_N * p)));
          l2.geometry.setDrawRange(0, Math.max(2, Math.ceil(EV_N * clamp01(p * 1.1 - 0.08))));
          marks.forEach((m) => { const on = p > m.u; m.vl.visible = on; m.d.visible = on; });
        },
      };
    },
  };

  /* ════════ 05 · PRONTUÁRIO — documento se escrevendo ════════ */
  const prontuario = {
    mode: "light", bg: "#f8f6f1", c: ["#1a1825", "#3d3852", "#6a4ec8"], alpha: 0.8, alphaIdle: 0.08,
    cam: { pos: [0, -0.05, 6.7], look: [0, 0.05, 0], via: [0, -1.5, 6.5] }, rotAmp: 0.05,
    form() {
      const f = mkForm(), r = mulberry32(606);
      let i = 0;
      for (let n = 0; n < 700; n++, i++)
        put(f, i, -0.73 + gauss(r) * 0.006, -1.25 + r() * 2.55, gauss(r) * 0.006, 0.9, r());
      for (let n = 0; n < 2600; n++, i++)
        put(f, i, -0.45 + r() * 2.3, -1.2 + r() * 2.45, -0.12 + gauss(r) * 0.03, 0.45 + gauss(r) * 0.1, r());
      dust(f, i, r, 1300);
      return f;
    },
    build(THREE) {
      const dark = false, g = new THREE.Group(), mats = [];
      const mTx = lineMat(THREE, "#3d3852", 0.6, dark); mats.push(mTx);
      const mMg = lineMat(THREE, "#6a4ec8", 0.4, dark); mats.push(mMg);
      /* margem sólida */
      const mg = new THREE.BufferGeometry();
      mg.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.73, -1.25, 0, -0.73, 1.3, 0]), 3));
      g.add(new THREE.Line(mg, mMg));
      /* linhas de texto — máquina de escrever */
      const rr = mulberry32(77);
      const rowsY = [];
      for (let rI = 0; rI < 12; rI++) rowsY.push(1.05 - rI * 0.185);
      const HEAD = [0, 4, 8];
      const segs = [], rowBreaks = [];
      rowsY.forEach((y, rI) => {
        if (HEAD.includes(rI)) return;
        rowBreaks.push(segs.length);
        let x = -0.5;
        const wMax = rI % 4 === 3 ? 0.9 : 1.7;
        while (x < wMax) {
          const len = 0.09 + rr() * 0.2;
          segs.push([x, y, 0, x + len, y, 0]);
          x += len + 0.07 + rr() * 0.06;
        }
      });
      const ta = new Float32Array(segs.length * 6);
      segs.forEach((s, k) => ta.set(s, k * 6));
      const tg = new THREE.BufferGeometry();
      tg.setAttribute("position", new THREE.BufferAttribute(ta, 3));
      const tl = new THREE.LineSegments(tg, mTx);
      tl.frustumCulled = false;
      g.add(tl);
      const th = cadence(segs.length, rowBreaks, rr);
      return {
        group: g, mats,
        update(dt, t, age) {
          const p = clamp01(Math.max(0, age) / 7);
          let cnt = 0;
          while (cnt < th.length && th[cnt] <= p) cnt++;
          tl.geometry.setDrawRange(0, cnt * 2);
        },
      };
    },
  };

  /* ════════ 06 · VÍDEO — duas presenças humanas em wireframe 3D ════════ */
  /* superfície paramétrica de busto (ombros→pescoço→cabeça) com feições:
     u = azimute (0 = frente, ±PI = nuca) · v = 0 (peito) → 1 (topo da cabeça) */
  const gsn = (a, b) => Math.exp(-(a * a) / (2 * b * b));
  function bustXYZ(u, v, fem) {
    let y, wx, wz, hv = 0;
    if (v < 0.24) {                               /* ombros / peito */
      const s = v / 0.24;
      y = -1.05 + s * 0.42;
      wx = (fem ? 0.72 : 0.88) * (1 - 0.70 * Math.pow(s, 1.7));
      wz = 0.29 - 0.11 * s;
    } else if (v < 0.34) {                        /* pescoço */
      const s = (v - 0.24) / 0.10;
      y = -0.63 + s * 0.20;
      wx = fem ? 0.145 : 0.17; wz = fem ? 0.14 : 0.16;
    } else {                                      /* cabeça */
      hv = (v - 0.34) / 0.66;
      y = -0.43 + hv * 0.98;
      wx = Math.max(0.13, 0.34 * Math.pow(Math.sin(PI * (0.10 + 0.90 * hv)), 0.75));
      if (hv < 0.42) {                            /* afunilamento do maxilar */
        const j = fem ? 0.74 : 0.86;
        wx *= j + (1 - j) * (hv / 0.42);
      }
      wz = wx * 1.18;
      /* orelhas */
      const ear = 1 + 0.13 * gsn(Math.abs(u) - 1.5, 0.13) * gsn(hv - 0.48, 0.09);
      wx *= ear;
    }
    let x = wx * Math.sin(u), z = wz * Math.cos(u);
    if (v >= 0.34) {                              /* feições (frente, u≈0) */
      z += 0.105 * gsn(u, 0.13) * gsn(hv - 0.40, 0.050);   /* nariz */
      z += 0.030 * gsn(u, 0.40) * gsn(hv - 0.58, 0.045);   /* arco da testa */
      z -= 0.038 * (gsn(u - 0.30, 0.09) + gsn(u + 0.30, 0.09)) * gsn(hv - 0.53, 0.035); /* olhos */
      z += 0.026 * gsn(u, 0.22) * gsn(hv - 0.235, 0.028);  /* lábios */
      z += 0.050 * (gsn(u - 0.40, 0.13) + gsn(u + 0.40, 0.13)) * gsn(hv - 0.33, 0.07);  /* bochechas erguidas (sorriso) */
      z -= 0.018 * gsn(u, 0.30) * gsn(hv - (0.185 + 0.045 * (1 - gsn(u, 0.30))), 0.018); /* vinco do sorriso, cantos pra cima */
      z += 0.032 * gsn(u, 0.18) * gsn(hv - 0.08, 0.050);   /* queixo */
    }
    return [x, y, z];
  }
  /* cabelo: casca deslocada + cortina (mulher) / coroa curta (homem) */
  function hairXYZ(r, fem) {
    if (fem && r() < 0.45) {                      /* cortina lateral/trás até os ombros */
      const side = r() < 0.5 ? 1 : -1;
      const u = side * (0.85 + r() * 1.9);
      const t = r();
      const p = bustXYZ(u, 0.34 + 0.5 * 0.66, true);
      const fl = 1.10 + t * 0.10;
      return [p[0] * fl, p[1] + 0.42 - t * (0.42 + 0.68), p[2] * fl - t * 0.03];
    }
    const lo = fem ? 0.52 : 0.55;
    for (;;) {
      const hv = lo + r() * (1 - lo);
      const u = (r() * 2 - 1) * PI;
      const front = Math.abs(u) < 0.6;
      if (front && hv < (fem ? 0.78 : 0.80)) continue;   /* rosto livre */
      const p = bustXYZ(u, 0.34 + hv * 0.66, fem);
      const off = 1.05 + r() * 0.035;
      return [p[0] * off, p[1] + 0.015, p[2] * off];
    }
  }
  const BUSTS = [
    { fem: true,  cx: -1.08, cy: 0.14, cz: 0.14,  yaw: 0.52,  shade: 0.12 },
    { fem: false, cx: 1.08,  cy: 0.10, cz: -0.18, yaw: -0.50, shade: 0.85 },
  ];
  const bustPlace = (b, p) => {
    const ca = Math.cos(b.yaw), sa = Math.sin(b.yaw);
    return [b.cx + p[0] * ca + p[2] * sa, b.cy + p[1], b.cz - p[0] * sa + p[2] * ca];
  };

  /* ════════ 06 · VÍDEO — duas presenças esculturais em "areia" (estilo Foundation) ════════
     Cabeças 3D reais (malhas de exemplo do three.js, fetch em runtime) viram:
     crosta densa de grãos na superfície + sólido escultural por baixo + cabelo de areia.
     Fallback: bustos paramétricos, se o fetch falhar. */

  function parseOBJ(text) {
    const verts = [];
    const tris = [];
    const lines = text.split("\n");
    for (let li = 0; li < lines.length; li++) {
      const L = lines[li];
      if (L.charCodeAt(0) === 118 && L.charCodeAt(1) === 32) {          /* "v " */
        const p = L.slice(2).trim().split(/\s+/);
        verts.push(+p[0], +p[1], +p[2]);
      } else if (L.charCodeAt(0) === 102 && L.charCodeAt(1) === 32) {   /* "f " */
        const p = L.slice(2).trim().split(/\s+/).map((s) => {
          let ix = parseInt(s.split("/")[0], 10);
          if (ix < 0) ix = verts.length / 3 + ix + 1;
          return (ix - 1) * 3;
        });
        for (let k = 2; k < p.length; k++) {
          const a = p[0], b = p[k - 1], c = p[k];
          tris.push(verts[a], verts[a + 1], verts[a + 2],
                    verts[b], verts[b + 1], verts[b + 2],
                    verts[c], verts[c + 1], verts[c + 2]);
        }
      }
    }
    return new Float32Array(tris);
  }

  /* normaliza (centraliza, escala p/ altura h) e posiciona (yaw + translação) IN PLACE */
  function placeTris(t, h, cx, cy, cz, yaw) {
    let mnx = 1e9, mny = 1e9, mnz = 1e9, mxx = -1e9, mxy = -1e9, mxz = -1e9;
    for (let i = 0; i < t.length; i += 3) {
      mnx = Math.min(mnx, t[i]); mxx = Math.max(mxx, t[i]);
      mny = Math.min(mny, t[i + 1]); mxy = Math.max(mxy, t[i + 1]);
      mnz = Math.min(mnz, t[i + 2]); mxz = Math.max(mxz, t[i + 2]);
    }
    const s = h / (mxy - mny);
    const ox = (mnx + mxx) / 2, oy = (mny + mxy) / 2, oz = (mnz + mxz) / 2;
    const ca = Math.cos(yaw), sa = Math.sin(yaw);
    for (let i = 0; i < t.length; i += 3) {
      const x = (t[i] - ox) * s, y = (t[i + 1] - oy) * s, z = (t[i + 2] - oz) * s;
      t[i] = cx + x * ca + z * sa;
      t[i + 1] = cy + y;
      t[i + 2] = cz - x * sa + z * ca;
    }
  }

  /* amostragem ponderada por área: devolve { sample(r, out) } com ponto + normal */
  function meshSampler(t) {
    const nt = t.length / 9;
    const cum = new Float64Array(nt);
    let acc = 0;
    for (let k = 0; k < nt; k++) {
      const i = k * 9;
      const ux = t[i + 3] - t[i], uy = t[i + 4] - t[i + 1], uz = t[i + 5] - t[i + 2];
      const vx = t[i + 6] - t[i], vy = t[i + 7] - t[i + 1], vz = t[i + 8] - t[i + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      acc += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
      cum[k] = acc;
    }
    return {
      sample(r, out) {
        const target = r() * acc;
        let lo = 0, hi = nt - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < target) lo = mid + 1; else hi = mid; }
        const i = lo * 9;
        let a = r(), b = r();
        if (a + b > 1) { a = 1 - a; b = 1 - b; }
        const ux = t[i + 3] - t[i], uy = t[i + 4] - t[i + 1], uz = t[i + 5] - t[i + 2];
        const vx = t[i + 6] - t[i], vy = t[i + 7] - t[i + 1], vz = t[i + 8] - t[i + 2];
        out[0] = t[i] + ux * a + vx * b;
        out[1] = t[i + 1] + uy * a + vy * b;
        out[2] = t[i + 2] + uz * a + vz * b;
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        out[3] = nx / nl; out[4] = ny / nl; out[5] = nz / nl;
      },
    };
  }

  /* configuração das duas presenças */
  const VID_HEADS = [
    { id: "fem", url: "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r152/examples/models/obj/ninja/ninjaHead_Low.obj",
      h: 1.18, cx: -0.98, cy: 0.30, cz: 0.14, yaw: 0.5, shade: 0.12, solid: "#b7a6f0", glow: 0.42,
      crust: 8600, hair: 5200 },
    { id: "man", url: "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r152/examples/models/obj/walt/WaltHead.obj",
      h: 1.22, cx: 1.02, cy: 0.28, cz: -0.16, yaw: -0.5, shade: 0.85, solid: "#6fc4a4", glow: 0.34,
      crust: 8800, hair: 2000 },
  ];
  let vidForm = null;        /* ref do form p/ refill assíncrono */
  let vidBuild = null;       /* ref do build p/ anexar sólidos */
  const vidModels = {};      /* id → { tris, sampler } */

  function vidFillForm(f) {
    const r = mulberry32(707);
    let i = 0;
    const out = new Float32Array(6);
    for (const H of VID_HEADS) {
      const mdl = vidModels[H.id];
      if (mdl) {
        const hc = [H.cx, H.cy + 0.1, H.cz];
        /* crosta de grãos — rala na frente do rosto (o sólido esculpido aparece),
           densa nas laterais/trás (areia assentada) */
        const fx = Math.sin(H.yaw), fz = Math.cos(H.yaw);
        for (let n = 0; n < H.crust; n++, i++) {
          mdl.sampler.sample(r, out);
          const d = Math.pow(r(), 2.2) * 0.022;
          put(f, i, out[0] + out[3] * d, out[1] + out[4] * d, out[2] + out[5] * d, H.shade, r());
        }
        /* cabelo de areia: nuvem densa atrás/topo, com fios escorrendo */
        for (let n = 0; n < H.hair; n++, i++) {
          for (let tries = 0; tries < 8; tries++) {
            mdl.sampler.sample(r, out);
            const dx = out[0] - hc[0], dy = out[1] - hc[1], dz = out[2] - hc[2];
            /* frente da cabeça no espaço da cena (local +z rotacionado pelo yaw) */
            const fx = Math.sin(H.yaw), fz = Math.cos(H.yaw);
            const front = (dx * fx + dz * fz) / (Math.hypot(dx, dy, dz) || 1);
            if (front > 0.05 && dy < 0.34) continue;   /* rosto e têmpora ficam livres */
            const puff = 1 + Math.pow(r(), 1.6) * (H.id === "fem" ? 0.42 : 0.18);
            let px = hc[0] + dx * puff, py = hc[1] + dy * puff, pz = hc[2] + dz * puff;
            if (H.id === "fem" && r() < 0.4) {          /* mechas caindo até os ombros */
              const drop = r() * 0.85;
              py -= drop; px += gauss(r) * 0.05 * drop * 4; pz += gauss(r) * 0.04;
            }
            put(f, i, px + gauss(r) * 0.012, py + gauss(r) * 0.012, pz + gauss(r) * 0.012,
              H.shade < 0.5 ? 0.30 : 0.68, r());
            break;
          }
        }
      } else {
        /* fallback paramétrico */
        const fem = H.id === "fem";
        const B = { fem, cx: H.cx, cy: H.cy, cz: H.cz, yaw: H.yaw, shade: H.shade };
        for (let n = 0; n < H.crust; n++, i++) {
          const u = (r() * 2 - 1) * PI, v = Math.pow(r(), 0.92);
          const p = bustPlace(B, bustXYZ(u, v, fem));
          put(f, i, p[0], p[1], p[2], H.shade, r());
        }
        for (let n = 0; n < H.hair; n++, i++) {
          const p = bustPlace(B, hairXYZ(r, fem));
          put(f, i, p[0], p[1], p[2], H.shade < 0.5 ? 0.30 : 0.68, r());
        }
      }
      /* pescoço + ombros paramétricos sob a cabeça (sempre), subidos até encostar na malha */
      const B2 = { fem: H.id === "fem", cx: H.cx, cy: H.cy + 0.42, cz: H.cz, yaw: H.yaw };
      for (let n = 0; n < 2300; n++, i++) {
        const u = (r() * 2 - 1) * PI, v = r() * 0.36;   /* inclui a faixa do pescoço */
        const p = bustPlace(B2, bustXYZ(u, v, B2.fem));
        put(f, i, p[0], p[1], p[2], H.shade, r());
      }
    }
    dust(f, i, r, 2400);
  }

  function vidAttachSolid(H) {
    /* sólidos desativados — visão aprovada é só grãos densos (estilo Foundation),
       sem revelar a identidade das malhas-fonte */
    return;
    mdl.attached = true;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(mdl.tris, 3));
    geo.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({
      color: H.solid, roughness: 0.5, metalness: 0.08,
      emissive: H.solid, emissiveIntensity: H.glow || 0.34,
      side: THREE.DoubleSide,
      transparent: true, opacity: 0,
    });
    m.userData.base = 1;
    const mesh = new THREE.Mesh(geo, m);
    mesh.frustumCulled = false;
    if (vidBuild.group.visible) m.opacity = m.userData.base;
    vidBuild.group.add(mesh);
    vidBuild.mats.push(m);
  }

  /* fetch assíncrono das malhas; ao chegar, refaz o form e anexa os sólidos */
  (function loadVidHeads() {
    if (typeof fetch !== "function") return;
    VID_HEADS.forEach((H) => {
      fetch(H.url).then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      }).then((txt) => {
        const tris = parseOBJ(txt);
        if (tris.length < 900) throw new Error("obj vazio");
        placeTris(tris, H.h, H.cx, H.cy + 0.1, H.cz, H.yaw);
        vidModels[H.id] = { tris, sampler: meshSampler(tris) };
        if (vidForm) vidFillForm(vidForm);
        vidAttachSolid(H);
      }).catch((err) => console.warn("[h3d] cabeça 3D não carregou (" + H.id + "):", err.message));
    });
  })();

  const video = {
    mode: "dark", bg: "#170f28", c: ["#b9a6f5", "#efe9ff", "#5ad6ae"], alpha: 0.55, alphaIdle: 0.15,
    cam: { pos: [1.5, 0.55, 4.0], look: [0, 0.15, 0], via: [0.3, 1.3, 5.2] }, rotAmp: 0.05,
    /* câmera diagonal deslizando devagar, sem parar */
    camProg(age) {
      const e = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
      const p = e(age / 11);
      return {
        pos: [1.5 - 0.65 * p, 0.55 - 0.28 * p, 4.0 + 0.4 * p],
        look: [0, 0.15 + 0.04 * p, 0],
      };
    },
    form() {
      const f = mkForm();
      vidFillForm(f);
      vidForm = f;
      return f;
    },
    build(THREE) {
      const dark = true, g = new THREE.Group(), mats = [];
      /* fio de conversa vivo entre os dois */
      const mWave = lineMat(THREE, "#5ad6ae", 0.65, dark); mats.push(mWave);
      const wave = liveLine(THREE, 110, mWave);
      g.add(wave.obj);
      vidBuild = { group: g, mats };
      VID_HEADS.forEach(vidAttachSolid);   /* modelos que chegaram antes do mount */
      return {
        group: g, mats,
        update(dt, t) {
          wave.set((i, u) => {
            const x = -0.5 + u * 1.0;
            const env = Math.sin(u * PI);
            return [x, -0.08 + env * (Math.sin(u * 21 + t * 4.6) * 0.055 + Math.sin(u * 47 - t * 7.3) * 0.028), 0.4];
          });
        },
      };
    },
  };

  SCENES = {
    N,
    order: ["preparar", "sessoes", "temas", "objetivos", "evolucao", "prontuario", "video"],
    states: { spiral, preparar, sessoes, temas, objetivos, evolucao, prontuario, video },
    quotes: T_QUOTES,
    tedges: TEDGES,
    focusNode: FOCUS,
    focusIdx: TEDGES.reduce((a, e, k) => { if (e[0] === FOCUS || e[1] === FOCUS) a.push(k); return a; }, []),
    quoteTiming: { start: G_REVEAL_START, step: G_REVEAL_STEP, dur: G_REVEAL_DUR, transDur: temas.transDur },
    objTiming: { phase1: OBJ_PHASE1_DUR, crawl: OBJ_CRAWL_DUR, transDur: objetivos.transDur },
  };
} catch (err) {
  console.error("[h3d-scenes] fatal error building scenes:", err);
}

export { SCENES }
