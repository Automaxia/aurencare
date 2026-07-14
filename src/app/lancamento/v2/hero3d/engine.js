/* eslint-disable */
// @ts-nocheck
import * as THREE from "three"
/* ════════════════════════════════════════════════════════════
   Audere — Hero 3D v3 · ENGINE
   Partículas finas com morph + camadas de linha por estado +
   câmera viajando entre cenas + âncoras HTML projetadas.
   Expõe window.AudereH3D.mount(container, scenes, opts)
   ════════════════════════════════════════════════════════════ */

  const NOISE = `
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }`;

  const VERT = NOISE + `
  attribute vec3 posB;
  attribute float shadeA, shadeB, seed, srand, order;
  uniform float uTime, uMorph, uTurb, uStag, uReveal, uSize, uDpr;
  varying float vShade, vFade;
  float ease3(float x){ return x*x*(3.0-2.0*x); }
  void main(){
    float mm = ease3(clamp((uMorph*(1.0+uStag)-seed*uStag), 0.0, 1.0));
    vec3 p = mix(position, posB, mm);
    vShade = mix(shadeA, shadeB, mm);
    float t = uTime*0.2;
    float amp = 0.016 + uTurb*sin(3.14159*mm)*(0.45+seed*0.85);
    vec3 np = p*0.9 + seed*0.35;
    p += vec3(
      snoise(np+vec3(t,0.0,0.0)),
      snoise(np+vec3(0.0,t+13.7,0.0)),
      snoise(np+vec3(0.0,0.0,t+41.3))
    )*amp;
    float vis = 1.0 - smoothstep(uReveal-0.07, uReveal, order);
    vFade = vis;
    vec4 mv = modelViewMatrix*vec4(p,1.0);
    float tw = 0.85 + 0.3*sin(uTime*1.7+seed*40.0);
    gl_PointSize = uSize*uDpr*(0.45+srand)*tw*(7.0/max(1.0,-mv.z))*max(vis,0.001);
    gl_Position = projectionMatrix*mv;
  }`;

  const FRAG = `
  precision highp float;
  uniform vec3 uC1, uC2, uC3;
  uniform float uAlpha;
  varying float vShade, vFade;
  void main(){
    float d = length(gl_PointCoord-0.5);
    float a = smoothstep(0.5, 0.14, d)*uAlpha*vFade;
    if (a < 0.012) discard;
    vec3 c = vShade < 0.5 ? mix(uC1, uC2, vShade*2.0) : mix(uC2, uC3, vShade*2.0-1.0);
    gl_FragColor = vec4(c, a);
  }`;

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const easeIO = (x) => x * x * (3 - 2 * x);

  function mount(container, SCN, opts = {}) {
    const ST = SCN.states, N = SCN.N;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const FORMS = {};
    for (const k in ST) FORMS[k] = ST[k].form();

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(dpr);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
    const world = new THREE.Group();
    scene.add(world);
    /* ambiente procedural — reflexos suaves p/ superfícies acetinadas */
    const envCanvas = document.createElement("canvas");
    envCanvas.width = 128; envCanvas.height = 64;
    const ectx = envCanvas.getContext("2d");
    const eg = ectx.createLinearGradient(0, 0, 0, 64);
    eg.addColorStop(0, "#e8e4f7"); eg.addColorStop(0.35, "#9d8fce");
    eg.addColorStop(0.6, "#2c2440"); eg.addColorStop(1, "#0b0912");
    ectx.fillStyle = eg; ectx.fillRect(0, 0, 128, 64);
    ectx.fillStyle = "rgba(255,255,255,.9)";
    ectx.beginPath(); ectx.ellipse(30, 10, 14, 5, 0, 0, 7); ectx.fill();
    ectx.beginPath(); ectx.ellipse(96, 16, 10, 4, 0, 0, 7); ectx.fill();
    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    envTex.colorSpace = THREE.SRGBColorSpace || envTex.colorSpace;
    scene.environment = envTex;
    /* luzes — volume real nos sólidos (sombra própria + realce), sem lavar o dimming */
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(3, 5, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8d72e8, 0.45);
    fill.position.set(-4, -2, 3);
    scene.add(fill);
    const rim = new THREE.PointLight(0xefe9ff, 0.8, 12);
    rim.position.set(-1, 1.5, 4);
    scene.add(rim);

    /* partículas */
    const start = reduced ? SCN.order[0] : "spiral";
    const geo = new THREE.BufferGeometry();
    const seedArr = new Float32Array(N), srandArr = new Float32Array(N);
    { let s = 9; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      for (let i = 0; i < N; i++) { seedArr[i] = r(); srandArr[i] = r(); } }
    geo.setAttribute("position", new THREE.BufferAttribute(FORMS[start].pos.slice(), 3));
    geo.setAttribute("posB",     new THREE.BufferAttribute(FORMS[start].pos.slice(), 3));
    geo.setAttribute("shadeA",   new THREE.BufferAttribute(FORMS[start].shade.slice(), 1));
    geo.setAttribute("shadeB",   new THREE.BufferAttribute(FORMS[start].shade.slice(), 1));
    geo.setAttribute("order",    new THREE.BufferAttribute(FORMS[start].order.slice(), 1));
    geo.setAttribute("seed",     new THREE.BufferAttribute(seedArr, 1));
    geo.setAttribute("srand",    new THREE.BufferAttribute(srandArr, 1));

    const st0 = ST[start];
    const uni = {
      uTime: { value: 0 }, uMorph: { value: 0 }, uTurb: { value: 0 }, uStag: { value: 0.45 },
      uReveal: { value: reduced ? 2 : 0 }, uSize: { value: 2.4 }, uDpr: { value: dpr },
      uAlpha: { value: st0.alpha },
      uC1: { value: new THREE.Color(st0.c[0]) },
      uC2: { value: new THREE.Color(st0.c[1]) },
      uC3: { value: new THREE.Color(st0.c[2]) },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: uni,
      transparent: true, depthWrite: false,
      blending: st0.mode === "dark" ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    world.add(points);

    /* camadas de linha por estado */
    const BUILT = {};
    for (const k in ST) {
      if (!ST[k].build) continue;
      let b;
      try {
        b = ST[k].build(THREE);
      } catch (err) {
        console.error("[h3d] build failed for state", k, err);
        continue;
      }
      b.group.visible = false;
      world.add(b.group);
      BUILT[k] = b;
    }
    const fadeVal = {};
    for (const k in ST) fadeVal[k] = 0;
    fadeVal[start] = reduced ? 1 : (start === "spiral" ? 1 : 0);
    function applyFade(k, f) {
      fadeVal[k] = f;
      const b = BUILT[k];
      if (!b) return;
      b.group.visible = f > 0.02;
      for (const m of b.mats) m.opacity = m.userData.base * f;
    }
    if (reduced) applyFade(start, 1);

    /* fundo/cores */
    const bg = new THREE.Color(st0.bg);
    renderer.setClearColor(bg);
    const colFrom = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
    const colTo = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
    const bgFrom = new THREE.Color(), bgTo = new THREE.Color();
    let alphaFrom = st0.alpha, alphaTo = st0.alpha;

    /* câmera */
    const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    let camPos = v3(st0.cam.pos), camLook = v3(st0.cam.look);
    let rotAmp = st0.rotAmp || 0.12;
    const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpV = new THREE.Vector3();

    /* transição */
    let cur = start, trans = null, clockT = 0;
    const ageStart = {};
    ageStart[start] = 0;

    function startTrans(key, dur, turb, stag) {
      geo.attributes.position.array.set(FORMS[cur].pos);
      geo.attributes.shadeA.array.set(FORMS[cur].shade);
      geo.attributes.posB.array.set(FORMS[key].pos);
      geo.attributes.shadeB.array.set(FORMS[key].shade);
      ["position", "shadeA", "posB", "shadeB"].forEach((n) => geo.attributes[n].needsUpdate = true);
      colFrom[0].copy(uni.uC1.value); colFrom[1].copy(uni.uC2.value); colFrom[2].copy(uni.uC3.value);
      const s = ST[key];
      colTo[0].set(s.c[0]); colTo[1].set(s.c[1]); colTo[2].set(s.c[2]);
      bgFrom.copy(bg); bgTo.set(s.bg);
      alphaFrom = uni.uAlpha.value; alphaTo = s.alpha;
      uni.uTurb.value = turb;
      uni.uStag.value = stag;
      uni.uMorph.value = 0;
      trans = {
        key, t0: clockT, dur, swapped: false,
        camA: camPos.clone(), lookA: camLook.clone(),
        camB: v3(s.cam.pos), lookB: v3(s.cam.look),
        via: s.cam.via ? v3(s.cam.via) : null,
        focus: s.cam.focus ? v3(s.cam.focus) : null,
        rotA: rotAmp, rotB: s.rotAmp || 0.12,
        offA: offCur, offB: key === "spiral" ? 0 : offX,
      };
      ageStart[key] = clockT + dur * 0.5;
    }

    /* âncoras HTML */
    let anchorEls = [];
    function attachAnchors(root) {
      anchorEls = Array.from(root.querySelectorAll("[data-anchor]")).map((el) => {
        const p = el.dataset.pos.split(",").map(Number);
        return { el, state: el.dataset.state, pos: new THREE.Vector3(p[0], p[1], p[2]),
          delay: parseFloat(el.dataset.delay || 0),
          hold: el.dataset.hold != null ? parseFloat(el.dataset.hold) : Infinity,
          outDur: parseFloat(el.dataset.out || 0.7),
          avoidLeft: el.dataset.avoid !== "none",
          left: el.dataset.align === "left" };
      });
    }
    function updateAnchors(w, h) {
      world.updateMatrixWorld();
      const copyEl = container.parentElement && container.parentElement.querySelector(".h3d-copy");
      let copyBound = null;
      if (copyEl && w > 1100) {
        const cr = copyEl.getBoundingClientRect(), sr = container.getBoundingClientRect();
        copyBound = cr.right - sr.left + 28;
      }
      for (const a of anchorEls) {
        const f = fadeVal[a.state] || 0;
        if (f < 0.03) { a.el.style.opacity = 0; continue; }
        tmpV.copy(a.pos);
        world.localToWorld(tmpV);
        const dist = tmpV.distanceTo(camera.position);
        tmpV.project(camera);
        if (tmpV.z > 1) { a.el.style.opacity = 0; continue; }
        const x = (tmpV.x * 0.5 + 0.5) * w, y = (-tmpV.y * 0.5 + 0.5) * h;
        const narrow = w <= 1100;
        const s = narrow ? Math.max(0.4, Math.min(0.85, 6.8 / dist)) : Math.max(0.55, Math.min(1.5, 6.8 / dist));
        const age = clockT - (ageStart[a.state] ?? -99);
        const inR = clamp01((age - a.delay) / 0.7);
        const outStart = a.delay + 0.7 + a.hold;
        const outR = a.hold === Infinity ? 1 : 1 - clamp01((age - outStart) / a.outDur);
        let ramp = Math.min(inR, outR);
        /* o confinamento por dolly+pan já mantém a cena à direita da copy, então as
           etiquetas ficam SEMPRE ancoradas na sua esfera (sem reposição que as descolava) */
        const xPos = x;
        a.el.style.transform = (a.left ? "translate(0,-50%)" : "translate(-50%,-50%)") +
          ` translate(${xPos.toFixed(1)}px,${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
        a.el.style.opacity = (f * ramp).toFixed(3);
      }
    }

    /* mouse */
    let mx = 0, my = 0, rx = 0, ry = 0;
    const onMove = (e) => {
      const b = container.getBoundingClientRect();
      mx = ((e.clientX - b.left) / b.width - 0.5) * 2;
      my = ((e.clientY - b.top) / b.height - 0.5) * 2;
    };
    container.addEventListener("mousemove", onMove);

    /* resize */
    let offX = 0, offCur = 0, regionW = 1, cw = 0, ch = 0;
    const REF_ASPECT = 1.78;   /* proporção 16:9 para a qual as cenas foram compostas */
    function resize() {
      cw = container.clientWidth; ch = container.clientHeight;
      if (!cw || !ch) return;
      renderer.setSize(cw, ch);
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      const desktop = cw > 1100;
      /* confinamento à direita é feito por CSS (a caixa .h3d-stage/.h3d-anchors já vive
         à direita da copy). Aqui NÃO deslocamos a câmera — só ajustamos o tamanho do ponto
         conforme o aspecto da caixa, que muda com a viewport. */
      offX = 0; regionW = 1;
      world.position.y = desktop ? 0 : 0.5;
      const aspectScale = Math.max(0.46, Math.min(1, camera.aspect / REF_ASPECT));
      world.scale.setScalar(1);
      uni.uSize.value = 2.4 * aspectScale * (desktop ? 1 : 0.72);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    let inView = true;
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; }, { threshold: 0 });
    io.observe(container);

    /* loop */
    let raf = 0, rafIsTimeout = false, last = performance.now(), disposed = false;
    let phase = reduced ? "live" : "draw";
    let exploded = reduced, readyNotified = reduced;
    if (reduced) setTimeout(() => { opts.onExplode && opts.onExplode(); opts.onReady && opts.onReady(); }, 60);

    /* rAF pausa quando a aba/iframe fica oculta — usamos setTimeout como fallback
       pra a história continuar avançando (mais devagar) em vez de travar de vez */
    function scheduleFrame() {
      if (typeof document !== "undefined" && document.hidden) {
        rafIsTimeout = true;
        raf = setTimeout(() => frame(performance.now()), 200);
      } else {
        rafIsTimeout = false;
        raf = requestAnimationFrame(frame);
      }
    }

    function frame(now) {
      if (disposed) return;
      scheduleFrame();
      try {
      const dt = Math.min(rafIsTimeout ? 1.2 : 0.05, (now - last) / 1000);
      last = now;
      if (!inView) return;
      clockT += dt;
      uni.uTime.value = clockT;

      if (phase === "draw") {
        uni.uReveal.value = Math.min(1.15, 1.18 * easeIO(Math.min(1, clockT / 2.4)));
        if (clockT > 2.9) {
          phase = "trans";
          uni.uReveal.value = 2;
          startTrans(SCN.order[0], 2.6, 0.5, 0.9);
          if (!exploded) { exploded = true; opts.onExplode && opts.onExplode(); }
        }
      }

      if (trans) {
        const p = clamp01((clockT - trans.t0) / trans.dur);
        const e = easeIO(p);
        uni.uMorph.value = p;
        uni.uC1.value.lerpColors(colFrom[0], colTo[0], e);
        uni.uC2.value.lerpColors(colFrom[1], colTo[1], e);
        uni.uC3.value.lerpColors(colFrom[2], colTo[2], e);
        uni.uAlpha.value = alphaFrom + (alphaTo - alphaFrom) * e;
        bg.lerpColors(bgFrom, bgTo, e);
        renderer.setClearColor(bg);
        /* câmera: foco→contexto (mergulho + vira + sai de ré) ou bézier */
        const A = trans.camA, B = trans.camB, V = trans.via;
        if (trans.focus) {
          const F = trans.focus;
          /* ponto de aproximação: quase encostando no tema-foco */
          tmpA.set(F.x * 0.55, F.y * 0.55, F.z * 0.55 + 1.0);
          if (p < 0.45) {
            const e1 = easeIO(p / 0.45);
            camPos.lerpVectors(A, tmpA, e1);
            camLook.lerpVectors(trans.lookA, F, easeIO(Math.min(1, p / 0.3)));
          } else {
            const e2 = easeIO((p - 0.45) / 0.55);
            camPos.lerpVectors(tmpA, B, e2);
            camLook.lerpVectors(F, trans.lookB, e2);
          }
        } else if (V) {
          tmpA.lerpVectors(A, V, e); tmpB.lerpVectors(V, B, e);
          camPos.lerpVectors(tmpA, tmpB, e);
          camLook.lerpVectors(trans.lookA, trans.lookB, e);
        } else {
          camPos.lerpVectors(A, B, e);
          camLook.lerpVectors(trans.lookA, trans.lookB, e);
        }
        rotAmp = trans.rotA + (trans.rotB - trans.rotA) * e;
        offCur = trans.offA + (trans.offB - trans.offA) * e;
        /* fades de camada */
        applyFade(cur, 1 - clamp01(p / 0.35));
        applyFade(trans.key, clamp01((p - 0.5) / 0.45));
        if (!trans.swapped && p >= 0.5) {
          trans.swapped = true;
          mat.blending = ST[trans.key].mode === "dark" ? THREE.AdditiveBlending : THREE.NormalBlending;
          mat.needsUpdate = true;
        }
        if (p >= 1) {
          cur = trans.key;
          geo.attributes.position.array.set(FORMS[cur].pos);
          geo.attributes.shadeA.array.set(FORMS[cur].shade);
          geo.attributes.position.needsUpdate = true;
          geo.attributes.shadeA.needsUpdate = true;
          uni.uMorph.value = 0;
          uni.uTurb.value = 0;
          trans = null;
          applyFade(cur, 1);
          if (phase === "trans") {
            phase = "live";
            if (!readyNotified) { readyNotified = true; opts.onReady && opts.onReady(); }
          }
        }
      }

      world.position.x = 0;

      /* condensação: partículas decaem após a chegada */
      if (!trans && phase === "live") {
        const target = ST[cur].alphaIdle ?? ST[cur].alpha;
        uni.uAlpha.value += (target - uni.uAlpha.value) * Math.min(1, dt * 1.3);
        if (ST[cur].camProg) {
          const rC = ST[cur].camProg(clockT - (ageStart[cur] ?? 0));
          camPos.set(rC.pos[0], rC.pos[1], rC.pos[2]);
          camLook.set(rC.look[0], rC.look[1], rC.look[2]);
        }
      }

      /* updates das cenas visíveis */
      for (const k in BUILT) {
        if (fadeVal[k] > 0.02 && BUILT[k].update)
          BUILT[k].update(dt, clockT, clockT - (ageStart[k] ?? 0), fadeVal[k]);
      }

      /* rotação de mundo: deriva + mouse */
      rx += ((my * 0.14) - rx) * 0.04;
      ry += ((mx * 0.26) - ry) * 0.04;
      world.rotation.x = rx + Math.sin(clockT * 0.05) * rotAmp * 0.3;
      world.rotation.y = ry + Math.sin(clockT * 0.07) * rotAmp;

      /* câmera: posição/alvo definidos em espaço local do grupo — transformamos pelo
         matrixWorld do grupo (mesma escala/posição/rotação que os nós realmente usam),
         assim o enquadramento bate no mobile e com a leve rotação do mundo. Deriva orgânica
         contínua por cima, para a câmera nunca ficar totalmente parada. */
      world.updateMatrixWorld();
      tmpA.copy(camPos); world.localToWorld(tmpA);
      tmpB.copy(camLook); world.localToWorld(tmpB);
      camera.position.set(
        tmpA.x + Math.sin(clockT * 0.17) * 0.11 + Math.sin(clockT * 0.07) * 0.05,
        tmpA.y + Math.cos(clockT * 0.14) * 0.09 + Math.sin(clockT * 0.05) * 0.04,
        tmpA.z + Math.sin(clockT * 0.09) * 0.05);
      tmpV.set(
        tmpB.x + Math.sin(clockT * 0.12 + 1.1) * 0.05,
        tmpB.y + Math.cos(clockT * 0.1) * 0.035,
        tmpB.z);

      /* confinamento à região à direita da copy — tudo em espaço de MUNDO:
         (1) dolly-back afasta a câmera ao longo da direção de visão até o conteúdo
         ocupar ~regionW da largura (funciona até p/ cenas com camProg, como o grafo,
         onde world.scale não teria efeito); (2) pan lateral proporcional à distância
         mantém o mesmo deslocamento de tela em qualquer zoom. */
      if (regionW < 0.999) {
        tmpB.subVectors(tmpV, camera.position);        /* forward */
        const d0 = tmpB.length() || 1;
        tmpB.multiplyScalar(1 / d0);                    /* forward normalizado */
        const back = d0 * (1 / regionW - 1);
        camera.position.x -= tmpB.x * back;
        camera.position.y -= tmpB.y * back;
        camera.position.z -= tmpB.z * back;
      }
      if (offCur > 0.0001) {
        const dist = camera.position.distanceTo(tmpV);
        const halfW = dist * Math.tan((camera.fov * Math.PI / 180) / 2) * camera.aspect;
        const shift = offCur * halfW;
        tmpB.subVectors(tmpV, camera.position);          /* forward */
        tmpA.set(tmpB.z, 0, -tmpB.x);                     /* right ≈ forward × up(0,1,0) */
        const rl = Math.hypot(tmpA.x, tmpA.z) || 1;
        const dx = (tmpA.x / rl) * shift, dz = (tmpA.z / rl) * shift;
        camera.position.x -= dx; camera.position.z -= dz;
        tmpV.x -= dx; tmpV.z -= dz;
      }
      camera.lookAt(tmpV);

      renderer.render(scene, camera);
      updateAnchors(cw, ch);
      } catch (err) {
        console.error("[h3d] frame error:", err);
      }
    }
    scheduleFrame();

    return {
      goTo(key) {
        if (phase !== "live" || trans || !ST[key] || key === cur) return false;
        startTrans(key, ST[key].transDur || 2.4, 0.4, 0.45);
        return true;
      },
      attachAnchors,
      get current() { return cur; },
      dispose() {
        disposed = true;
        if (rafIsTimeout) clearTimeout(raf); else cancelAnimationFrame(raf);
        ro.disconnect(); io.disconnect();
        container.removeEventListener("mousemove", onMove);
        geo.dispose(); mat.dispose();
        for (const k in BUILT) BUILT[k].group.traverse((o) => { o.geometry && o.geometry.dispose(); });
        renderer.dispose();
        renderer.domElement.remove();
      },
    };
  }
export { mount }
