(function () {
  "use strict";
  /* ===== A · núcleo ===== */
  const W = window,
    D = document,
    root = D.documentElement;
  const $ = (s, c) => (c || D).querySelector(s);
  const $$ = (s, c) => Array.prototype.slice.call((c || D).querySelectorAll(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const easeIO = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const TAU = Math.PI * 2;
  const qs = new URLSearchParams(W.location.search);
  const TEST = qs.has("test");
  const reduceMQ = W.matchMedia("(prefers-reduced-motion: reduce)");
  const FINE = W.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const NARROW = () => W.innerWidth < 900;

  /* estado */
  const S = {
    mode: "lite",
    glOK: false,
    phase: "intro",
    introDone: false,
    y: 0,
    vel: 0,
    sT: 0,
    sS: 0,
    time: 0,
    last: 0,
    frameN: 0,
    pt: { x: 0, y: 0 },
    pm: { x: 0, y: 0 },
    pf: { x: 0, y: 0 },
    px: -999,
    py: -999,
    ptAt: -99,
    gw: 0,
    pulse: 0,
    rafOn: false,
    dts: [],
    auto: true,
    pg: -1,
    hp: -1,
    hx: 0,
    hy: 0,
    hpx: 0,
    hpy: 0,
    chAct: -1,
    bandOff: 0,
    mg: { x: 0, y: 0 },
    liqA: 0,
    liqT: 0,
    liqHint: false,
  };
  const M = {
    vw: 1,
    vh: 1,
    chTop: 0,
    chLen: 1,
    dgTop: 0,
    dgLen: 1,
    exTop: 0,
    exLen: 1,
    ctaTop: 1e9,
    cbTop: 0,
    cbBot: 0,
    bandTop: 0,
    docH: 1,
    trackDist: 0,
    bandW: 1,
    magX: 0,
    magY: 0,
    planTops: [],
    planH: 1,
  };
  const LAY = { sx: 0, sy: 0, sc: 1 };
  const el = {};

  function grab() {
    const ids = {
      gl: "#gl",
      hero: "#topo",
      chap: "#montagem",
      band: "#band",
      diag: "#pratos",
      track: "#track",
      expd: "#chapa",
      vframe: "#vframe",
      chefCv: "#chefCv",
      expCopy: "#expCopy",
      cardapio: "#cardapio",
      combos: "#combos",
      cta: "#pedir",
      liq: "#cta-t",
      liqD: "#liqD",
      liqT: "#liqT",
      mag: "#mag",
      progI: "#progI",
      toast: "#toast",
      modeBtn: "#modeBtn",
      modeLbl: "#modeLbl",
      themeBtn: "#themeBtn",
      themeIco: "#themeIco",
      intro: "#intro",
      introCv: "#introCv",
      introFx: "#introFx",
      introSkip: "#introSkip",
      knife: "#knife",
      main: "#conteudo",
      hdr: "#hdr",
      foot: "footer.ft",
      enso: ".enso",
      heroIn: ".hero-in",
      arch: ".arch",
      kanji: ".kanji",
    };
    Object.keys(ids).forEach((k) => {
      el[k] = $(ids[k]);
    });
    el.steps = $$(".st", el.chap);
    el.rail = $$(".rail i");
    el.plans = $$(".plan");
  }

  let toastT = 0;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(() => el.toast.classList.remove("on"), 2800);
  }

  const topOf = (n) => n.getBoundingClientRect().top + (W.pageYOffset || 0);

  /* métricas de layout (recalculadas ao redimensionar e ao trocar de modo) */
  function measure() {
    M.vw = W.innerWidth;
    M.vh = W.innerHeight;
    const pinned = root.classList.contains("pinned");
    M.chTop = topOf(el.chap);
    M.chLen = Math.max(1, el.chap.offsetHeight - (pinned ? M.vh : 0));
    M.dgTop = topOf(el.diag);
    M.dgLen = Math.max(1, el.diag.offsetHeight - M.vh);
    M.exTop = topOf(el.expd);
    M.exLen = Math.max(1, el.expd.offsetHeight - M.vh);
    M.ctaTop = topOf(el.cta);
    M.bandTop = topOf(el.band);
    M.cbTop = topOf(el.combos);
    M.cbBot = M.cbTop + el.combos.offsetHeight;
    M.docH = root.scrollHeight;
    M.trackDist = Math.max(
      0,
      el.track.scrollWidth - M.vw + Math.round(M.vw * 0.14),
    );
    const g = el.band.firstElementChild;
    M.bandW = g ? Math.max(1, g.getBoundingClientRect().width) : 1;
    const keep = el.mag.style.transform;
    el.mag.style.transform = "";
    const mb0 = el.mag.getBoundingClientRect();
    el.mag.style.transform = keep;
    M.magX = mb0.left + mb0.width / 2;
    M.magY = mb0.top + mb0.height / 2 + (W.pageYOffset || 0);
    M.planTops = el.plans.map(topOf);
    M.planH = el.plans[0] ? el.plans[0].offsetHeight : 1;
  }

  /* modos: completo (WebGL + seções fixadas) e leve (sem 3D, rolagem normal) */
  function applyMode(m) {
    const cl = root.classList;
    S.mode = m;
    cl.toggle("full", m === "full");
    cl.toggle("lite", m === "lite");
    cl.toggle("pinned", m === "full");
    cl.toggle("no-gl", m !== "full");
    cl.toggle("rm", reduceMQ.matches);
    el.modeLbl.textContent = m === "full" ? "Completo" : "Leve";
    el.modeBtn.setAttribute("aria-pressed", String(m === "lite"));
  }

  function resetPinnedStyles() {
    el.steps.forEach((s) => {
      s.style.opacity = "";
      s.style.transform = "";
      s.style.visibility = "";
    });
    el.track.style.transform = "";
    el.track.style.removeProperty("--sk");
    ["--cx", "--cy", "--cr", "--vo"].forEach((v) =>
      el.vframe.style.removeProperty(v),
    );
    el.chefCv.style.transform = "";
    el.expCopy.style.opacity = "";
    [el.enso, el.arch, el.kanji].forEach((n) => {
      ["--hp", "--px", "--py"].forEach((v) => n.style.removeProperty(v));
    });
    el.band.style.transform = "";
    el.mag.style.transform = "";
    el.liq.classList.remove("on");
    el.plans.forEach((p) => {
      p.style.removeProperty("--rx");
      p.style.removeProperty("--ry");
    });
  }

  function pickAnchor() {
    const list = [
      el.hero,
      el.cardapio,
      el.band,
      el.chap,
      el.diag,
      el.expd,
      el.combos,
      el.cta,
    ];
    for (let i = 0; i < list.length; i++) {
      if (list[i].getBoundingClientRect().bottom > M.vh * 0.35) return list[i];
    }
    return null;
  }

  function setMode(m, msg) {
    if (m === S.mode) return;
    if (m === "full") {
      if (!initGL()) {
        toast("Seu navegador não liberou os gráficos 3D.");
        return;
      }
    }
    const anchor = pickAnchor();
    applyMode(m);
    if (m === "full") {
      resizeGL();
    } else {
      stopLoop();
      resetPinnedStyles();
    }
    measure();
    if (anchor) W.scrollTo(0, Math.max(0, topOf(anchor)));
    S.y = W.pageYOffset || 0;
    if (m === "full") {
      S.sS = S.sT = storyTarget();
      startLoop();
    }
    chefModeChanged();
    toast(
      msg ||
        (m === "full"
          ? "Modo completo: 3D e rolagem animada."
          : "Modo leve: sem 3D, rolagem normal."),
    );
  }

  /* mede quadros por segundo em janelas de tempo (contando as travadas) e avisa quando duas janelas seguidas ficam abaixo do mínimo */
  const fpsNew = (min, win) => ({
    t0: 0,
    n: 0,
    bad: 0,
    skip: 1,
    min: min,
    win: win || 1000,
  });
  function fpsStep(f, now) {
    if (!f.t0) {
      f.t0 = now;
      f.n = 0;
      return false;
    }
    f.n++;
    const dt = now - f.t0;
    if (dt < f.win) return false;
    const fps = (f.n * 1000) / dt;
    f.t0 = now;
    f.n = 0;
    if (f.skip > 0) {
      f.skip--;
      return false;
    }
    f.bad = fps < f.min ? f.bad + 1 : 0;
    if (f.bad < 2) return false;
    f.bad = 0;
    f.skip = 1;
    return true;
  }

  /* matrizes (coluna-principal) */
  const persp = (f, a, n, fa) => {
    const t = 1 / Math.tan(f / 2),
      nf = 1 / (n - fa);
    return [
      t / a,
      0,
      0,
      0,
      0,
      t,
      0,
      0,
      0,
      0,
      (fa + n) * nf,
      -1,
      0,
      0,
      2 * fa * n * nf,
      0,
    ];
  };
  const mul = (a, b) => {
    const o = new Array(16);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        o[i * 4 + j] = s;
      }
    return o;
  };
  const rotX = (r) => {
    const c = Math.cos(r),
      s = Math.sin(r);
    return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
  };
  const rotY = (r) => {
    const c = Math.cos(r),
      s = Math.sin(r);
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  };
  const trans = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];

  /* ===== B · formas (nuvens de pontos) ===== */
  function mulberry(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* monta uma forma a partir de primitivas e amostra N pontos; o quarto valor de cada ponto é o "tom" (cor) */
  function Builder() {
    const P = [];
    let tot = 0;
    const api = {};
    const add = (w, tone, fn) => {
      if (w > 0) {
        P.push({ w: w, tone: tone, fn: fn });
        tot += w;
      }
      return api;
    };
    api.add = add;
    api.seg = (a, b, tone, wm) => {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        dz = (b[2] || 0) - (a[2] || 0);
      return add(Math.hypot(dx, dy, dz) * (wm || 1), tone, (u) => [
        a[0] + dx * u,
        a[1] + dy * u,
        (a[2] || 0) + dz * u,
      ]);
    };
    api.build = (n, seed) => {
      const r = mulberry(seed),
        cum = [];
      let acc = 0;
      P.forEach((p) => {
        acc += p.w;
        cum.push(acc);
      });
      const pts = new Array(n);
      for (let i = 0; i < n; i++) {
        const t = ((i + r()) / n) * tot;
        let lo = 0,
          hi = cum.length - 1;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (cum[m] < t) lo = m + 1;
          else hi = m;
        }
        const p = P[lo],
          st = lo ? cum[lo - 1] : 0,
          u = clamp((t - st) / p.w, 0, 1),
          q = p.fn(u, r),
          j = 0.006;
        pts[i] = [
          q[0] + (r() - 0.5) * j,
          q[1] + (r() - 0.5) * j,
          q[2] + (r() - 0.5) * j,
          clamp(
            (q[3] !== undefined ? q[3] : p.tone) + (r() - 0.5) * 0.12,
            0,
            1,
          ),
        ];
      }
      /* ordena por ângulo: partículas vizinhas numa forma ficam vizinhas na outra, e a transição vira um redemoinho coerente */
      let cx = 0,
        cy = 0;
      pts.forEach((q) => {
        cx += q[0];
        cy += q[1];
      });
      cx /= n;
      cy /= n;
      const keyed = pts.map((q) => ({
        k: Math.atan2(q[1] - cy, q[0] - cx) + (r() - 0.5) * 0.35,
        q: q,
      }));
      keyed.sort((a, b) => a.k - b.k);
      const out = new Float32Array(n * 4);
      keyed.forEach((o, i) => {
        out[i * 4] = o.q[0];
        out[i * 4 + 1] = o.q[1];
        out[i * 4 + 2] = o.q[2];
        out[i * 4 + 3] = o.q[3];
      });
      return out;
    };
    return api;
  }

  /* tons: 0 alga · .14 cebolinha · .28 arroz · .56 salmão · .8 vermelho · 1 dourado (a rampa de cores está no shader) */
  const TN = {
    nori: 0.05,
    green: 0.12,
    rice: 0.28,
    salmon: 0.56,
    red: 0.8,
    gold: 0.98,
  };

  function makeShapes(N) {
    const out = [];

    /* 0 · brasas (ponto de partida do capítulo) */
    out.push(
      Builder()
        .add(1, 0.7, (u, r) => {
          const th = r() * TAU,
            ph = Math.acos(2 * r() - 1),
            rad = 1.3 + r() * 1.7;
          return [
            rad * Math.sin(ph) * Math.cos(th),
            rad * Math.cos(ph) * 0.7,
            rad * Math.sin(ph) * Math.sin(th),
            0.5 + r() * 0.5,
          ];
        })
        .build(N, 5),
    );

    /* 1 · arroz: montinho sobre o prato */
    {
      const b = Builder();
      const ring = (rx, rz, y, tone, wm) =>
        b.add(TAU * Math.max(rx, rz) * wm, tone, (u) => {
          const a = u * TAU;
          return [rx * Math.cos(a), y, rz * Math.sin(a)];
        });
      ring(1.1, 0.66, -0.66, TN.gold, 1.2);
      ring(0.94, 0.56, -0.64, TN.gold - 0.08, 0.9);
      b.add(1.6, TN.gold - 0.1, (u, r) => {
        const a = r() * TAU,
          rd = Math.sqrt(r());
        return [0.98 * rd * Math.cos(a), -0.66, 0.6 * rd * Math.sin(a)];
      });
      b.add(42, TN.rice, (u, r) => {
        const th = r() * TAU,
          c = Math.pow(r(), 0.8),
          s = Math.sqrt(1 - c * c),
          k = 0.9 + 0.1 * r();
        return [
          0.8 * s * Math.cos(th) * k,
          -0.64 + 0.96 * c * k,
          0.52 * s * Math.sin(th) * k,
          0.22 + 0.1 * c,
        ];
      });
      b.add(2.4, TN.rice + 0.02, (u, r) => {
        const a = r() * TAU,
          rd = 0.74 + r() * 0.2;
        return [
          rd * 1.0 * Math.cos(a),
          -0.64 + r() * 0.03,
          rd * 0.6 * Math.sin(a),
        ];
      });
      out.push(b.build(N, 11));
    }

    /* 2 · alga nori com arroz espalhado */
    {
      const b = Builder(),
        ang = -0.2,
        ca = Math.cos(ang),
        sa = Math.sin(ang),
        hw = 0.84,
        hh = 0.6;
      const R = (x, y, z) => [x * ca - y * sa, x * sa + y * ca, z];
      const C = [
        [-hw, -hh],
        [hw, -hh],
        [hw, hh],
        [-hw, hh],
      ];
      for (let i = 0; i < 4; i++) {
        const a = C[i],
          c = C[(i + 1) % 4];
        b.add(Math.hypot(c[0] - a[0], c[1] - a[1]) * 2.2, 0.1, (u, r) =>
          R(
            a[0] + (c[0] - a[0]) * u,
            a[1] + (c[1] - a[1]) * u,
            (r() - 0.5) * 0.03,
          ),
        );
      }
      b.add(hw * hh * 4 * 24, TN.nori, (u, r) =>
        R((r() - 0.5) * 2 * hw, (r() - 0.5) * 2 * hh, (r() - 0.5) * 0.04),
      );
      for (let k = 0; k < 12; k++) {
        const y = -hh + ((k + 0.5) / 12) * 2 * hh,
          h1 = (k * 0.6180339887) % 1,
          x0 = -hw + 0.08 + h1 * 0.5,
          x1 = hw - 0.08 - ((k * 0.3819660113) % 1) * 0.5;
        b.add(Math.max(0.2, x1 - x0) * 1.6, 0.16, (u) =>
          R(x0 + (x1 - x0) * u, y, 0.02),
        );
      }
      b.add(18, TN.rice, (u, r) => {
        const a = r() * TAU,
          rd = Math.sqrt(r());
        return R(
          -0.3 + 0.54 * rd * Math.cos(a),
          -0.1 + 0.38 * rd * Math.sin(a),
          0.05 + r() * 0.06,
          0.24 + 0.08 * r(),
        );
      });
      out.push(b.build(N, 13));
    }

    /* 3 · recheio: salmão, cream cheese e cebolinha sobre a alga */
    {
      const b = Builder(),
        ang = -0.2,
        ca = Math.cos(ang),
        sa = Math.sin(ang),
        hw = 0.84,
        hh = 0.6;
      const R = (x, y, z) => [x * ca - y * sa, x * sa + y * ca, z];
      const C = [
        [-hw, -hh],
        [hw, -hh],
        [hw, hh],
        [-hw, hh],
      ];
      for (let i = 0; i < 4; i++) {
        const a = C[i],
          c = C[(i + 1) % 4];
        b.add(Math.hypot(c[0] - a[0], c[1] - a[1]) * 1.6, 0.1, (u, r) =>
          R(
            a[0] + (c[0] - a[0]) * u,
            a[1] + (c[1] - a[1]) * u,
            (r() - 0.5) * 0.03,
          ),
        );
      }
      b.add(hw * hh * 4 * 9, TN.nori, (u, r) =>
        R((r() - 0.5) * 2 * hw, (r() - 0.5) * 2 * hh, (r() - 0.5) * 0.04),
      );
      b.add(8, TN.rice, (u, r) => {
        const a = r() * TAU,
          rd = Math.sqrt(r());
        return R(
          -0.3 + 0.54 * rd * Math.cos(a),
          -0.1 + 0.38 * rd * Math.sin(a),
          0.05 + r() * 0.05,
          0.24 + 0.08 * r(),
        );
      });
      const slab = (cx, cy, w, h, a, z) => {
        const c = Math.cos(a),
          s = Math.sin(a);
        const Q = (x, y, zz) => R(cx + x * c - y * s, cy + x * s + y * c, zz);
        b.add(w * h * 70, TN.salmon, (u, r) =>
          Q((r() - 0.5) * w, (r() - 0.5) * h, z + r() * 0.05),
        );
        const e = [
          [-w / 2, -h / 2],
          [w / 2, -h / 2],
          [w / 2, h / 2],
          [-w / 2, h / 2],
        ];
        for (let i = 0; i < 4; i++) {
          const p0 = e[i],
            p1 = e[(i + 1) % 4];
          b.add(
            Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 2.4,
            TN.salmon + 0.12,
            (u) =>
              Q(
                p0[0] + (p1[0] - p0[0]) * u,
                p0[1] + (p1[1] - p0[1]) * u,
                z + 0.03,
              ),
          );
        }
        for (let i = -1; i <= 1; i++)
          b.add(w * 1.5, TN.rice, (u) =>
            Q(
              (u - 0.5) * w * 0.86,
              i * h * 0.24 + Math.sin(u * 9 + i) * 0.015,
              z + 0.07,
            ),
          );
      };
      slab(-0.32, 0.16, 0.66, 0.24, 0.34, 0.1);
      slab(0.14, 0.04, 0.7, 0.24, 0.2, 0.15);
      slab(0.5, -0.14, 0.5, 0.22, 0.08, 0.2);
      b.add(3.2, TN.rice, (u, r) =>
        R(
          -0.55 + u * 1.2 + (r() - 0.5) * 0.05,
          -0.34 + 0.2 * Math.sin(u * 3.1) + (r() - 0.5) * 0.05,
          0.24 + r() * 0.05,
        ),
      );
      const rr = mulberry(41);
      for (let i = 0; i < 26; i++) {
        const x = (rr() - 0.5) * 1.5,
          y = (rr() - 0.5) * 0.9,
          a = rr() * Math.PI,
          l = 0.07 + rr() * 0.07;
        b.add(0.5, TN.green, (u) =>
          R(
            x + Math.cos(a) * l * (u - 0.5),
            y + Math.sin(a) * l * (u - 0.5),
            0.27,
          ),
        );
      }
      for (let i = 0; i < 12; i++) {
        const x = (rr() - 0.5) * 1.4,
          y = (rr() - 0.5) * 0.8;
        b.add(0.18, TN.gold, (u, r) =>
          R(x + (r() - 0.5) * 0.02, y + (r() - 0.5) * 0.02, 0.29),
        );
      }
      out.push(b.build(N, 17));
    }

    /* 4 · cone: o temaki enrolado, com o recheio aparecendo na boca */
    {
      const b = Builder(),
        al = 0.5,
        dX = Math.sin(al),
        dY = Math.cos(al),
        e1 = [Math.cos(al), -Math.sin(al)];
      const A = [-0.62, -0.88],
        L = 1.62,
        r1 = 0.44;
      const P = (u, th, k) => {
        const rad = r1 * u * (k === undefined ? 1 : k);
        return [
          A[0] + dX * L * u + rad * Math.cos(th) * e1[0],
          A[1] + dY * L * u + rad * Math.cos(th) * e1[1],
          rad * Math.sin(th),
        ];
      };
      const PX = (ex, th, k) => {
        const rad = r1 * k;
        return [
          A[0] + dX * (L + ex) + rad * Math.cos(th) * e1[0],
          A[1] + dY * (L + ex) + rad * Math.cos(th) * e1[1],
          rad * Math.sin(th),
        ];
      };
      b.add(34, TN.nori, (u, r) => P(Math.sqrt(r()), r() * TAU));
      for (let k = 0; k < 2; k++)
        b.add(7, 0.2, (u) => P(u, u * TAU * 2.1 + k * Math.PI + 0.4));
      b.add(TAU * r1 * 2.2, 0.2, (u) => P(1, u * TAU));
      b.add(7, TN.rice, (u, r) => P(1, r() * TAU, Math.sqrt(r()) * 0.92));
      b.add(11, TN.salmon, (u, r) =>
        PX(0.02 + r() * 0.3, r() * TAU, Math.sqrt(r()) * 0.8),
      );
      b.add(4, TN.rice + 0.02, (u, r) =>
        PX(0.04 + r() * 0.16, r() * TAU, 0.3 + Math.sqrt(r()) * 0.4),
      );
      const rr = mulberry(55);
      for (let i = 0; i < 9; i++) {
        const th = rr() * TAU,
          k = 0.2 + rr() * 0.6,
          lean = (rr() - 0.5) * 0.9,
          ln = 0.28 + rr() * 0.3;
        b.add(1.4, TN.green, (u) => {
          const q = PX(0.05 + ln * u, th, k);
          q[0] += lean * u * ln * 0.8;
          return q;
        });
      }
      for (let i = 0; i < 10; i++) {
        const th = rr() * TAU,
          k = rr() * 0.8,
          ex = 0.1 + rr() * 0.3;
        b.add(0.16, TN.gold, () => PX(ex, th, k));
      }
      out.push(b.build(N, 19));
    }

    /* 5 · entrega: pino no mapa, anéis de 5 km e uma casinha */
    {
      const b = Builder(),
        tl = 0.95,
        ct = Math.cos(tl),
        st = Math.sin(tl);
      const add = (w, tone, fn) =>
        b.add(w, tone, (u, r) => {
          const q = fn(u, r);
          const p = [q[0], q[1] * ct - q[2] * st, q[1] * st + q[2] * ct];
          if (q[3] !== undefined) p[3] = q[3];
          return p;
        });
      [
        [0.4, TN.gold],
        [0.74, TN.salmon + 0.1],
        [1.08, TN.salmon],
      ].forEach((o, i) =>
        add((TAU * o[0] * 6) / (1 + i * 0.35), o[1], (u) => {
          const a = u * TAU;
          return [o[0] * Math.cos(a), 0, o[0] * Math.sin(a)];
        }),
      );
      add(3, TN.salmon - 0.05, (u, r) => {
        const a = r() * TAU,
          rd = Math.sqrt(r()) * 1.05;
        return [rd * Math.cos(a), 0, rd * Math.sin(a), 0.4 + r() * 0.15];
      });
      add(1.2, TN.gold, (u) => [
        1.08 * u * Math.cos(-0.5),
        0,
        1.08 * u * Math.sin(-0.5),
      ]);
      const h = 0.66,
        rho = 0.2,
        del = Math.acos(rho / h),
        cy = h;
      add(TAU * rho * 7, TN.red, (u) => {
        const a = -Math.PI / 2 + del + u * (TAU - 2 * del);
        return [rho * Math.cos(a), cy + rho * Math.sin(a), 0];
      });
      [-1, 1].forEach((sg) =>
        add(h * 6, TN.red, (u) => {
          const a = -Math.PI / 2 + sg * del;
          const tx = rho * Math.cos(a),
            ty = cy + rho * Math.sin(a);
          return [tx * u, ty * u, 0];
        }),
      );
      add(16, TN.red, (u, r) => {
        const a = r() * TAU,
          rd = Math.sqrt(r()) * rho * 0.92;
        return [rd * Math.cos(a), cy + rd * Math.sin(a), (r() - 0.5) * 0.06];
      });
      add(5, TN.rice, (u, r) => {
        const a = r() * TAU,
          rd = Math.sqrt(r()) * rho * 0.42;
        return [rd * Math.cos(a), cy + rd * Math.sin(a), 0.06];
      });
      const hx = 0.74,
        hz = 0.5;
      add(5, TN.gold, (u) => [hx + (u - 0.5) * 0.26, 0.0, hz]);
      add(5, TN.gold, (u) => [hx + (u - 0.5) * 0.26, 0.2, hz]);
      add(2.6, TN.gold, (u) => [hx - 0.13, 0.2 * u, hz]);
      add(2.6, TN.gold, (u) => [hx + 0.13, 0.2 * u, hz]);
      add(5, TN.gold, (u) => [hx - 0.17 + u * 0.17, 0.2 + 0.14 * u, hz]);
      add(5, TN.gold, (u) => [hx + u * 0.17, 0.34 - 0.14 * u, hz]);
      add(3, TN.gold, (u, r) => [hx - 0.13 + r() * 0.26, r() * 0.2, hz]);
      for (let k = 0; k < 8; k++)
        add(0.8, TN.salmon + 0.12, (u) => {
          const t = (k + u * 0.55) / 8;
          return [hx * t, 0, hz * t + 0.32 * Math.sin(Math.PI * t)];
        });
      out.push(b.build(N, 23));
    }
    return out;
  }
  const SEQ = [0, 1, 2, 3, 4, 5];

  /* ===== C · WebGL (montagem do temaki) ===== */
  const GLS = {
    ok: false,
    ctx: null,
    N: 0,
    fov: Math.PI / 4,
    cam: 4.2,
    dpr: 1,
    aspect: 1,
    w: 1,
    h: 1,
    shapes: [],
    proj: null,
  };

  const VS_CLOUD = [
    "precision highp float;",
    "attribute vec4 aA;attribute vec4 aB;attribute vec4 aR;",
    "uniform mat4 uProj;uniform mat4 uView;",
    "uniform float uMix,uTime,uScale,uCam,uSize,uPush,uAlpha,uSwirl,uPulse;",
    "uniform vec2 uMouse,uShift;",
    "varying float vA;varying vec3 vC;",
    "vec3 ramp(float t){",
    " vec3 c0=vec3(0.10,0.36,0.26),c1=vec3(1.0,0.95,0.86),c2=vec3(1.0,0.47,0.33),c3=vec3(0.92,0.18,0.21),c4=vec3(0.99,0.85,0.54);",
    " vec3 c=mix(c0,c1,smoothstep(0.0,0.28,t));",
    " c=mix(c,c2,smoothstep(0.28,0.56,t));",
    " c=mix(c,c3,smoothstep(0.56,0.8,t));",
    " c=mix(c,c4,smoothstep(0.8,1.0,t));",
    " return c;}",
    "void main(){",
    " float st=aR.x*0.46;",
    " float t=clamp((uMix-st)/0.54,0.0,1.0);t=t*t*(3.0-2.0*t);",
    " vec3 p=mix(aA.xyz,aB.xyz,t);",
    " float fl=sin(3.14159265*t);",
    " vec3 dir=vec3(sin(aR.z*6.2831+uTime*0.3),cos(aR.w*6.2831),sin(aR.y*6.2831+1.3));",
    " p+=dir*fl*uSwirl*(0.35+aR.y*0.65);",
    " float ang=fl*uSwirl*(aR.w-0.5)*2.4;float cs=cos(ang),sn=sin(ang);",
    " p.xz=vec2(cs*p.x-sn*p.z,sn*p.x+cs*p.z);",
    " p+=0.010*vec3(sin(uTime*1.1+aR.z*60.0),cos(uTime*0.9+aR.y*55.0),sin(uTime*1.3+aR.w*50.0));",
    " p*=uScale;",
    " vec4 mv=uView*vec4(p,1.0);",
    " float depth=max(0.6,-mv.z);",
    " vec2 sp=mv.xy*(uCam/depth);",
    " vec2 dm=sp-uMouse;float d2=dot(dm,dm);",
    " float f=exp(-d2*3.2)*uPush;",
    " mv.xy+=normalize(dm+vec2(0.0001))*f*0.24*(depth/uCam);",
    " mv.z+=f*0.16;",
    " vec4 pos=uProj*mv;",
    " pos.xy+=uShift*pos.w;",
    " gl_Position=pos;",
    " float tone=mix(aA.w,aB.w,t);",
    " gl_PointSize=uSize*(0.55+aR.y*0.9)*(uCam/max(0.5,-mv.z))*(1.0+f*1.2+fl*0.35);",
    " vec3 c=ramp(tone);",
    " c+=vec3(0.30,0.18,0.08)*f+vec3(0.22,0.12,0.04)*fl*0.6+vec3(0.18)*uPulse*aR.w;",
    " vC=c;",
    " vA=uAlpha*(0.40+0.60*aR.y)*clamp(1.15-(depth-uCam)/9.0,0.12,1.0);",
    "}",
  ].join("\n");
  const FS_CLOUD = [
    "precision mediump float;",
    "varying float vA;varying vec3 vC;",
    "void main(){",
    " float d=length(gl_PointCoord-0.5)*2.0;",
    " float a=1.0-smoothstep(0.0,1.0,d);a*=a;",
    " vec3 col=vC*a*vA;",
    " gl_FragColor=vec4(col,max(col.r,max(col.g,col.b)));",
    "}",
  ].join("\n");
  /* brasas que sobem devagar atrás da forma */
  const VS_EMB = [
    "precision highp float;",
    "attribute vec4 aP;",
    "uniform mat4 uProj;uniform mat4 uView;",
    "uniform float uTime,uCam,uPS;",
    "varying float vF;",
    "void main(){",
    " vec3 p=aP.xyz;",
    " p.y=-2.4+mod(aP.y+2.4+uTime*(0.10+aP.w*0.24),5.2);",
    " p.x+=0.14*sin(uTime*0.6+aP.z*7.0+aP.w*20.0);",
    " vec4 mv=uView*vec4(p,1.0);",
    " gl_Position=uProj*mv;",
    " gl_PointSize=uPS*(0.5+aP.w)*(uCam/max(0.5,-mv.z));",
    " vF=smoothstep(-2.4,-1.5,p.y)*(1.0-smoothstep(1.3,2.7,p.y))*(0.55+0.45*sin(uTime*(1.0+aP.w*3.0)+aP.z*30.0));",
    "}",
  ].join("\n");
  const FS_EMB = [
    "precision mediump float;",
    "varying float vF;uniform float uAl;",
    "void main(){",
    " float d=length(gl_PointCoord-0.5)*2.0;d=1.0-smoothstep(0.0,1.0,d);d*=d;",
    " vec3 col=mix(vec3(1.0,0.42,0.14),vec3(1.0,0.82,0.46),vF)*d*vF*uAl;",
    " gl_FragColor=vec4(col,max(col.r,max(col.g,col.b)));",
    "}",
  ].join("\n");

  function mkProg(gl, vs, fs, attrs, unis) {
    const p = gl.createProgram();
    [
      [gl.VERTEX_SHADER, vs],
      [gl.FRAGMENT_SHADER, fs],
    ].forEach((a) => {
      const s = gl.createShader(a[0]);
      gl.shaderSource(s, a[1]);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    });
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p));
    const o = { p: p };
    attrs.forEach((n) => {
      o[n] = gl.getAttribLocation(p, n);
    });
    unis.forEach((n) => {
      o[n] = gl.getUniformLocation(p, n);
    });
    return o;
  }
  function mkBuf(gl, data) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return b;
  }
  function attribs(gl, list) {
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    list.forEach((l) => gl.enableVertexAttribArray(l));
  }

  function initGL() {
    if (GLS.ok) return true;
    try {
      const opt = {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: "high-performance",
      };
      const gl =
        el.gl.getContext("webgl", opt) ||
        el.gl.getContext("experimental-webgl", opt);
      if (!gl) return false;
      const t0 = performance.now();
      GLS.ctx = gl;
      GLS.N = NARROW() ? 9000 : 15000;
      GLS.cloud = mkProg(
        gl,
        VS_CLOUD,
        FS_CLOUD,
        ["aA", "aB", "aR"],
        [
          "uProj",
          "uView",
          "uMix",
          "uTime",
          "uScale",
          "uCam",
          "uSize",
          "uPush",
          "uAlpha",
          "uSwirl",
          "uPulse",
          "uMouse",
          "uShift",
        ],
      );
      GLS.emb = mkProg(
        gl,
        VS_EMB,
        FS_EMB,
        ["aP"],
        ["uProj", "uView", "uTime", "uCam", "uPS", "uAl"],
      );
      GLS.shapes = makeShapes(GLS.N).map((a) => mkBuf(gl, a));
      const r = mulberry(99),
        rn = new Float32Array(GLS.N * 4);
      for (let i = 0; i < rn.length; i++) rn[i] = r();
      GLS.rnd = mkBuf(gl, rn);
      const rr = mulberry(77),
        Dp = [],
        nd = NARROW() ? 90 : 170;
      for (let i = 0; i < nd; i++)
        Dp.push((rr() - 0.5) * 7, (rr() - 0.5) * 5.2, (rr() - 0.6) * 4, rr());
      GLS.dust = mkBuf(gl, new Float32Array(Dp));
      GLS.nDust = nd;
      el.gl.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        GLS.ok = false;
        S.glOK = false;
        if (S.mode === "full")
          setMode("lite", "Gráficos 3D indisponíveis, voltei ao modo leve.");
      });
      GLS.ok = true;
      S.glOK = true;
      if (TEST)
        console.log(
          "[temaki] GL pronto em " +
            Math.round(performance.now() - t0) +
            " ms, N=" +
            GLS.N,
        );
      return true;
    } catch (err) {
      console.warn("[temaki] WebGL indisponível", err);
      return false;
    }
  }

  function resizeGL() {
    if (!GLS.ok) return;
    const dpr = Math.min(W.devicePixelRatio || 1, NARROW() ? 1.5 : 1.75);
    const cw = el.gl.clientWidth || W.innerWidth,
      ch = el.gl.clientHeight || W.innerHeight;
    const w = Math.max(1, Math.floor(cw * dpr)),
      h = Math.max(1, Math.floor(ch * dpr));
    if (el.gl.width !== w || el.gl.height !== h) {
      el.gl.width = w;
      el.gl.height = h;
    }
    GLS.dpr = dpr;
    GLS.aspect = w / h;
    GLS.w = cw;
    GLS.h = ch;
    GLS.proj = new Float32Array(persp(GLS.fov, GLS.aspect, 0.1, 80));
  }

  /* a história: a coordenada s percorre a sequência de formas conforme a rolagem do capítulo (0 a 5) */
  function storyTarget() {
    const p = clamp((S.y - M.chTop) / Math.max(1, M.chLen), 0, 1);
    return 5 * p;
  }
  function sceneNow() {
    const s = S.sS,
      n = SEQ.length - 1,
      k = Math.min(n - 1, Math.floor(s)),
      u = s - k;
    return { a: SEQ[k], b: SEQ[k + 1], mix: s >= n ? 1 : sstep(0.28, 0.8, u) };
  }
  const mixL = (a, b, t) => ({
    sx: lerp(a.sx, b.sx, t),
    sy: lerp(a.sy, b.sy, t),
    sc: lerp(a.sc, b.sc, t),
  });
  function layoutNow() {
    const asp = GLS.w / GLS.h,
      hH = Math.tan(GLS.fov / 2) * GLS.cam,
      hW = hH * asp,
      wide = GLS.w >= 900 && asp > 1.05;
    return wide
      ? { sx: 0.44, sy: 0, sc: Math.min(hW * 0.34, hH * 0.7) }
      : { sx: 0, sy: 0.3, sc: Math.min(hW * 0.78, hH * 0.3) };
  }

  function updateScene(dt) {
    const tg = layoutNow(),
      k = 1 - Math.exp(-dt * 4);
    LAY.sx += (tg.sx - LAY.sx) * k;
    LAY.sy += (tg.sy - LAY.sy) * k;
    LAY.sc += (tg.sc - LAY.sc) * k;
    S.pulse = Math.max(0, S.pulse - dt * 1.2);
  }

  function drawGL() {
    const gl = GLS.ctx,
      sc = sceneNow(),
      cam = GLS.cam;
    const hH = Math.tan(GLS.fov / 2) * cam,
      hW = hH * GLS.aspect;
    const yaw =
      S.pm.x * 0.34 +
      0.12 * Math.sin(S.time * 0.23) +
      clamp(S.vel * 0.00004, -0.25, 0.25);
    const pitch = -S.pm.y * 0.2 + 0.05 * Math.sin(S.time * 0.31);
    const view = new Float32Array(
      mul(trans(0, 0, -cam), mul(rotX(pitch), rotY(yaw))),
    );
    const viewE = new Float32Array(
      mul(trans(0, 0, -cam), mul(rotX(pitch * 0.6), rotY(yaw * 0.6))),
    );
    const mx = (S.pf.x - LAY.sx) * hW,
      my = (S.pf.y - LAY.sy) * hH;
    const push = (FINE ? 0.9 : 0.55) * lerp(1, 0.5, S.gw);
    gl.viewport(0, 0, el.gl.width, el.gl.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    const E = GLS.emb;
    gl.useProgram(E.p);
    attribs(gl, [E.aP]);
    gl.uniformMatrix4fv(E.uProj, false, GLS.proj);
    gl.uniformMatrix4fv(E.uView, false, viewE);
    gl.uniform1f(E.uTime, S.time);
    gl.uniform1f(E.uCam, cam);
    gl.uniform1f(E.uPS, 4.2 * GLS.dpr);
    gl.uniform1f(E.uAl, 0.85);
    gl.bindBuffer(gl.ARRAY_BUFFER, GLS.dust);
    gl.vertexAttribPointer(E.aP, 4, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, GLS.nDust);

    const C = GLS.cloud;
    gl.useProgram(C.p);
    attribs(gl, [C.aA, C.aB, C.aR]);
    gl.bindBuffer(gl.ARRAY_BUFFER, GLS.shapes[sc.a]);
    gl.vertexAttribPointer(C.aA, 4, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, GLS.shapes[sc.b]);
    gl.vertexAttribPointer(C.aB, 4, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, GLS.rnd);
    gl.vertexAttribPointer(C.aR, 4, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(C.uProj, false, GLS.proj);
    gl.uniformMatrix4fv(C.uView, false, view);
    gl.uniform1f(C.uMix, sc.mix);
    gl.uniform1f(C.uTime, S.time);
    gl.uniform1f(C.uScale, LAY.sc * (1 + 0.012 * Math.sin(S.time * 0.8)));
    gl.uniform1f(C.uCam, cam);
    gl.uniform1f(C.uSize, 3.3 * GLS.dpr * (NARROW() ? 0.85 : 1));
    gl.uniform1f(C.uPush, push);
    gl.uniform1f(C.uAlpha, 1);
    gl.uniform1f(C.uSwirl, 0.6);
    gl.uniform1f(C.uPulse, S.pulse);
    gl.uniform2f(C.uMouse, mx, my);
    gl.uniform2f(C.uShift, LAY.sx, LAY.sy);
    gl.drawArrays(gl.POINTS, 0, GLS.N);
  }

  /* ===== F · cena da chapa (canvas 2D; cada quadro é função pura do tempo, então dá para ir e voltar) ===== */
  const ChefScene = (function () {
    const PI = Math.PI,
      TAU = PI * 2;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const mix = (a, b, t) => a + (b - a) * t;
    const sm = (a, b, x) => {
      const t = clamp((x - a) / (b - a), 0, 1);
      return t * t * (3 - 2 * t);
    };
    const eo3 = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
    const eio = (t) => {
      t = clamp(t, 0, 1);
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };
    const H = (i, s) => {
      const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453123;
      return x - Math.floor(x);
    };
    const DUR = 5.0;

    /* linha do tempo (segundos) */
    const TL = {
      ign: 0.72,
      grab: 0.98,
      rel: 1.26,
      fly: 0.92,
      chop: [2.38, 2.5, 2.62, 2.74],
      put: 2.9,
      toss: [3.02, 3.2, 3.38],
      tfly: 0.42,
      flick: 3.86,
      sfly: 0.66,
    };
    TL.catchK = TL.rel + TL.fly;
    TL.catchS = TL.flick + TL.sfly;
    const GRAV = 2000;
    const FIRE = { x: 52, y: 200 };

    /* planos de câmera: de [x,y,zoom] para [x,y,zoom] */
    const SHOTS = [
      { a: 0.0, b: 0.72, f: [0, 214, 2.3], t: [0, 214, 2.1], e: eio },
      { a: 0.72, b: 1.4, f: [0, 190, 1.95], t: [0, 24, 1.02], e: eo3 },
      { a: 1.4, b: 2.3, f: [-120, 20, 1.18], t: [-150, -10, 1.28], e: eio },
      { a: 2.3, b: 3.0, f: [-185, 112, 1.85], t: [-198, 116, 1.95], e: eio },
      { a: 3.0, b: 3.75, f: [-30, 150, 1.5], t: [50, 175, 1.55], e: eio },
      { a: 3.75, b: 5.01, f: [70, 140, 1.4], t: [20, 50, 1.0], e: eo3 },
    ];
    function camAt(t) {
      let s = SHOTS[SHOTS.length - 1],
        idx = SHOTS.length - 1;
      for (let i = 0; i < SHOTS.length; i++) {
        if (t < SHOTS[i].b) {
          s = SHOTS[i];
          idx = i;
          break;
        }
      }
      const k = s.e(clamp((t - s.a) / (s.b - s.a), 0, 1));
      return {
        x: mix(s.f[0], s.t[0], k),
        y: mix(s.f[1], s.t[1], k),
        z: mix(s.f[2], s.t[2], k),
        shot: idx,
        since: t - s.a,
      };
    }

    /* explosões de fogo, faíscas, marolas */
    const BURSTS = [
      {
        t0: TL.ign,
        dur: 0.5,
        n: 150,
        x: FIRE.x,
        y: FIRE.y + 6,
        spread: 84,
        h: 360,
        pk: 1.0,
      },
      {
        t0: TL.toss[0] + TL.tfly,
        dur: 0.16,
        n: 26,
        x: 36,
        y: 216,
        spread: 40,
        h: 120,
        pk: 0.45,
      },
      {
        t0: TL.toss[1] + TL.tfly,
        dur: 0.16,
        n: 26,
        x: 62,
        y: 216,
        spread: 40,
        h: 120,
        pk: 0.45,
      },
      {
        t0: TL.toss[2] + TL.tfly,
        dur: 0.16,
        n: 26,
        x: 88,
        y: 216,
        spread: 40,
        h: 120,
        pk: 0.45,
      },
      {
        t0: TL.catchS,
        dur: 0.36,
        n: 200,
        x: FIRE.x + 6,
        y: FIRE.y + 6,
        spread: 120,
        h: 430,
        pk: 1.15,
      },
    ];
    const SPARKS = [
      { t0: TL.ign, n: 46, x: FIRE.x, y: 210, v: 520, life: 0.9, up: 0.9 },
      { t0: TL.catchK, n: 10, x: -212, y: 108, v: 300, life: 0.45, up: 1.6 },
      {
        t0: TL.toss[0] + TL.tfly,
        n: 12,
        x: 36,
        y: 222,
        v: 280,
        life: 0.5,
        up: 1.4,
      },
      {
        t0: TL.toss[1] + TL.tfly,
        n: 12,
        x: 62,
        y: 222,
        v: 280,
        life: 0.5,
        up: 1.4,
      },
      {
        t0: TL.toss[2] + TL.tfly,
        n: 12,
        x: 88,
        y: 222,
        v: 280,
        life: 0.5,
        up: 1.4,
      },
      { t0: TL.catchS, n: 78, x: 92, y: 212, v: 660, life: 1.0, up: 1.2 },
    ];
    const RIPPLES = [
      TL.toss[0] + TL.tfly,
      TL.toss[1] + TL.tfly,
      TL.toss[2] + TL.tfly,
    ];
    const burstEnv = (b, t) => {
      const a = t - b.t0;
      if (a < 0) return 0;
      return a < 0.12 ? a / 0.12 : Math.exp(-(a - 0.12) / 0.55);
    };
    const lightAt = (t) => {
      let I = 0.42;
      for (let i = 0; i < BURSTS.length; i++)
        I += burstEnv(BURSTS[i], t) * BURSTS[i].pk;
      return I;
    };

    /* sprites macios, pré-renderizados */
    const SP = {};
    function mkSprite(stops) {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const x = c.getContext("2d"),
        gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      stops.forEach((s) => gr.addColorStop(s[0], s[1]));
      x.fillStyle = gr;
      x.fillRect(0, 0, 64, 64);
      return c;
    }
    function initSprites() {
      if (SP.hot) return;
      SP.hot = mkSprite([
        [0, "rgba(255,250,222,1)"],
        [0.25, "rgba(255,220,130,.85)"],
        [0.6, "rgba(255,160,60,.3)"],
        [1, "rgba(255,120,30,0)"],
      ]);
      SP.yel = mkSprite([
        [0, "rgba(255,214,110,.95)"],
        [0.5, "rgba(255,150,40,.4)"],
        [1, "rgba(255,110,20,0)"],
      ]);
      SP.org = mkSprite([
        [0, "rgba(255,140,40,.8)"],
        [0.5, "rgba(230,80,20,.35)"],
        [1, "rgba(200,50,10,0)"],
      ]);
      SP.red = mkSprite([
        [0, "rgba(210,56,22,.6)"],
        [0.5, "rgba(150,30,15,.25)"],
        [1, "rgba(100,20,10,0)"],
      ]);
      SP.smoke = mkSprite([
        [0, "rgba(226,214,206,.55)"],
        [0.6, "rgba(176,164,158,.2)"],
        [1, "rgba(130,120,116,0)"],
      ]);
      SP.glow = mkSprite([
        [0, "rgba(255,206,140,.6)"],
        [1, "rgba(255,160,80,0)"],
      ]);
      SP.star = (function () {
        const c = document.createElement("canvas");
        c.width = c.height = 128;
        const x = c.getContext("2d");
        x.translate(64, 64);
        const gr = x.createRadialGradient(0, 0, 0, 0, 0, 22);
        gr.addColorStop(0, "rgba(255,255,255,1)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        x.fillStyle = gr;
        x.beginPath();
        x.arc(0, 0, 22, 0, TAU);
        x.fill();
        [0, PI / 2].forEach((a) => {
          x.save();
          x.rotate(a);
          const g2 = x.createLinearGradient(-64, 0, 64, 0);
          g2.addColorStop(0, "rgba(255,255,255,0)");
          g2.addColorStop(0.5, "rgba(255,255,255,.95)");
          g2.addColorStop(1, "rgba(255,255,255,0)");
          x.fillStyle = g2;
          x.fillRect(-64, -1.6, 128, 3.2);
          x.restore();
        });
        return c;
      })();
      SP.grain = (function () {
        const c = document.createElement("canvas");
        c.width = c.height = 128;
        const x = c.getContext("2d"),
          d = x.createImageData(128, 128);
        for (let i = 0; i < d.data.length; i += 4) {
          const v = (H(i, 4) * 255) | 0;
          d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
          d.data[i + 3] = 26;
        }
        x.putImageData(d, 0, 0);
        return c;
      })();
    }

    /* trilhas de movimento: chaves [t, a, b...] com suavização entre elas */
    function trk(t, K) {
      if (t <= K[0][0]) return K[0].slice(1);
      for (let i = 1; i < K.length; i++) {
        if (t <= K[i][0]) {
          const a = K[i - 1],
            b = K[i],
            u = sm(a[0], b[0], t),
            o = [];
          for (let j = 1; j < a.length; j++) o.push(mix(a[j], b[j], u));
          return o;
        }
      }
      return K[K.length - 1].slice(1);
    }
    const pulse = (t, tc, w) => {
      const d = Math.abs(t - tc);
      return d < w ? Math.pow(Math.cos(((PI / 2) * d) / w), 2) : 0;
    };

    /* posições das fatias: corte, repouso na tábua, destino na chapa */
    const sliceCut = (i) => [-110 - 28 * i - 14, 134];
    const sliceRest = (i) => [-92 - 26 * i, 156 - (i % 2) * 5];
    const sliceLand = (j) => [28 + 50 * j, 226 - (j % 2) * 14];
    const SHR = { x: 100, y: 214, a: -0.35 };

    /* mãos: direita (do cozinheiro; esquerda da tela) e esquerda */
    const HRK = [
      [0.0, -350, 150],
      [0.62, -350, 150],
      [0.98, -236, 158],
      [1.14, -222, 134],
      [1.26, -212, 104],
      [1.5, -214, 118],
      [1.9, -214, 114],
      [2.18, -212, 104],
      [2.3, -218, 100],
      [2.88, -302, 100],
      [2.98, -236, 158],
      [3.16, -170, 190],
      [3.5, -60, 214],
      [4.3, 4, 222],
      [5.1, 4, 222],
    ];
    function handR(t) {
      const b = trk(t, HRK);
      const w = sm(2.18, 2.34, t) * (1 - sm(2.82, 2.94, t));
      if (w > 0) {
        let cx = -218,
          py = 0;
        for (let i = 0; i < 3; i++)
          cx -= 28 * sm(TL.chop[i] + 0.04, TL.chop[i] + 0.16, t);
        for (let i = 0; i < 4; i++) py += pulse(t, TL.chop[i], 0.06);
        b[0] = mix(b[0], cx, w);
        b[1] = mix(b[1], 84 + 44 * py, w);
      }
      return b;
    }
    function handL(t) {
      const K = [
        [0, 350, 150],
        [0.62, 350, 150],
        [0.98, 176, 152],
        [1.5, 176, 148],
        [1.7, 172, 160],
        [2.6, 172, 160],
      ];
      for (let j = 0; j < 3; j++) {
        const tf = TL.toss[j],
          r = sliceRest(j),
          gx = r[0] + 58,
          gy = r[1] - 6;
        K.push([tf - 0.09, gx, gy], [tf + 0.05, gx + 34, gy - 46]);
      }
      K.push(
        [3.62, SHR.x + 58, SHR.y + 8],
        [TL.flick - 0.02, SHR.x + 58, SHR.y + 8],
        [TL.flick + 0.1, SHR.x + 40, SHR.y - 44],
        [TL.flick + 0.34, 180, 196],
        [TL.catchS - 0.1, 182, 208],
        [TL.catchS, 182, 208],
        [5.1, 182, 208],
      );
      return trk(t, K);
    }

    /* esqueleto: ombros, braços (IK) e centro de cada mão */
    const LEANK = [
      [0, 0, 0],
      [1.2, -10, 4],
      [2.3, -14, 6],
      [3.1, 4, 8],
      [3.9, 14, 26],
      [4.6, 8, 12],
      [5.1, 0, 0],
    ];
    function handCenter(A) {
      const ang = Math.atan2(A.W[1] - A.E[1], A.W[0] - A.E[0]);
      return [A.W[0] + Math.cos(ang) * 17, A.W[1] + Math.sin(ang) * 17];
    }
    function rig(t) {
      const hr = handR(t),
        hl = handL(t),
        lean = trk(t, LEANK);
      const P = {
        x0: 10 + lean[0] + Math.sin(t * 1.7) * 3,
        sy: lean[1] + Math.sin(t * 2.3) * 1.6,
      };
      const SR = [P.x0 - 104, P.sy - 118],
        SL = [P.x0 + 104, P.sy - 118];
      const aR = ik(SR, hr, 170, 150, -1),
        aL = ik(SL, hl, 170, 150, 1);
      return {
        P: P,
        SR: SR,
        SL: SL,
        aR: aR,
        aL: aL,
        cR: handCenter(aR),
        cL: handCenter(aL),
      };
    }

    /* estado da faca e das espátulas */
    const KS = 0.52,
      SS = 0.6;
    const KNIFE_REST = { x: -236, y: 156, a: -0.06 };
    function knifeAt(t, R) {
      if (t < TL.grab + 0.02)
        return {
          x: KNIFE_REST.x,
          y: KNIFE_REST.y,
          a: KNIFE_REST.a,
          held: false,
        };
      if (t < TL.rel) {
        const u = sm(TL.grab, TL.rel, t);
        return {
          x: R.cR[0],
          y: R.cR[1],
          a: mix(KNIFE_REST.a, -1.571, u),
          held: true,
        };
      }
      if (t < TL.catchK) {
        const tau = t - TL.rel,
          v0 = (-GRAV * TL.fly) / 2,
          A = rig(TL.rel).cR,
          w = sm(TL.catchK - 0.08, TL.catchK, t);
        return {
          x: mix(A[0], R.cR[0], w),
          y: mix(A[1] + v0 * tau + (GRAV * tau * tau) / 2, R.cR[1], w),
          a: -1.571 - TAU * 2 * (tau / TL.fly),
          held: false,
          fly: true,
        };
      }
      if (t < TL.put) {
        let a = mix(-1.571, 0.1, sm(TL.catchK, TL.catchK + 0.14, t));
        for (let i = 0; i < 4; i++) a += 0.1 * pulse(t, TL.chop[i], 0.06);
        a = mix(a, KNIFE_REST.a, sm(TL.put - 0.1, TL.put, t));
        return { x: R.cR[0], y: R.cR[1], a: a, held: true };
      }
      return { x: KNIFE_REST.x, y: KNIFE_REST.y, a: KNIFE_REST.a, held: false };
    }
    function shrimpAt(t) {
      if (t < TL.flick) return { x: SHR.x, y: SHR.y, a: SHR.a };
      if (t < TL.catchS) {
        const tau = t - TL.flick,
          v0 = (-GRAV * TL.sfly) / 2,
          vx = -58;
        return {
          x: SHR.x + vx * tau,
          y: SHR.y + v0 * tau + (GRAV * tau * tau) / 2,
          a: SHR.a + TAU * 2 * (tau / TL.sfly),
          fly: true,
        };
      }
      return { x: SHR.x - 58 * TL.sfly, y: SHR.y, a: SHR.a };
    }

    /* braço de dois ossos; o cotovelo fica para baixo e para fora */
    function ik(S, T, a, b, side) {
      const dx = T[0] - S[0],
        dy = T[1] - S[1],
        d = Math.hypot(dx, dy) || 1e-3;
      const dd = clamp(d, Math.abs(a - b) + 1, a + b - 1),
        ux = dx / d,
        uy = dy / d;
      const proj = (a * a + dd * dd - b * b) / (2 * dd),
        h = Math.sqrt(Math.max(0, a * a - proj * proj));
      const nx = -uy,
        ny = ux;
      const e1 = [S[0] + ux * proj + nx * h, S[1] + uy * proj + ny * h],
        e2 = [S[0] + ux * proj - nx * h, S[1] + uy * proj - ny * h];
      const sc = (e) => e[1] + 0.35 * side * e[0];
      return {
        E: sc(e1) >= sc(e2) ? e1 : e2,
        W: [S[0] + ux * dd, S[1] + uy * dd],
      };
    }

    /* ---------- desenho ---------- */
    function limb(g, ax, ay, bx, by, wa, wb) {
      const ang = Math.atan2(by - ay, bx - ax);
      g.beginPath();
      g.arc(ax, ay, wa / 2, ang + PI / 2, ang + PI * 1.5, false);
      g.arc(bx, by, wb / 2, ang - PI / 2, ang + PI / 2, false);
      g.closePath();
    }
    function limbFill(g, ax, ay, bx, by, wa, wb, cDark, cLit, fx, fy) {
      const dx = bx - ax,
        dy = by - ay,
        L = Math.hypot(dx, dy) || 1;
      let nx = -dy / L,
        ny = dx / L;
      const mx = (ax + bx) / 2,
        my = (ay + by) / 2;
      if (nx * (fx - mx) + ny * (fy - my) < 0) {
        nx = -nx;
        ny = -ny;
      }
      const w = Math.max(wa, wb) / 2;
      const gr = g.createLinearGradient(
        mx - nx * w,
        my - ny * w,
        mx + nx * w,
        my + ny * w,
      );
      gr.addColorStop(0, cDark);
      gr.addColorStop(0.55, cDark);
      gr.addColorStop(1, cLit);
      limb(g, ax, ay, bx, by, wa, wb);
      g.fillStyle = gr;
      g.fill();
    }

    function drawKnife(g, x, y, a, s, glint) {
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.scale(s, s);
      /* cabo */
      const hg = g.createLinearGradient(0, -9, 0, 9);
      hg.addColorStop(0, "#5b3a22");
      hg.addColorStop(0.5, "#2a190e");
      hg.addColorStop(1, "#120a05");
      g.fillStyle = hg;
      g.beginPath();
      g.moveTo(-84, -7);
      g.lineTo(6, -9);
      g.lineTo(6, 9);
      g.lineTo(-84, 7);
      g.quadraticCurveTo(-90, 0, -84, -7);
      g.fill();
      g.fillStyle = "#d6c8a8";
      g.fillRect(2, -9.5, 7, 19);
      g.fillStyle = "#b9a67a";
      g.fillRect(6, -9.5, 4, 19);
      /* lâmina */
      const bg = g.createLinearGradient(0, -18, 0, 22);
      bg.addColorStop(0, "#7b858d");
      bg.addColorStop(0.4, "#c3ccd2");
      bg.addColorStop(0.78, "#eef3f6");
      bg.addColorStop(1, "#ffffff");
      g.fillStyle = bg;
      g.beginPath();
      g.moveTo(10, -18);
      g.lineTo(252, -13);
      g.quadraticCurveTo(286, -6, 300, 10);
      g.quadraticCurveTo(190, 24, 10, 21);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(255,255,255,.55)";
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(16, 11);
      g.quadraticCurveTo(160, 16, 286, 9);
      g.stroke();
      g.strokeStyle = "rgba(40,52,60,.35)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(14, -9);
      g.quadraticCurveTo(150, -6, 262, -5);
      g.stroke();
      if (glint > 0.01) {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = glint;
        g.drawImage(SP.star, 90, -70, 140, 140);
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      }
      g.restore();
    }
    function drawSpatula(g, x, y, a, s) {
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.scale(s, s);
      const hg = g.createLinearGradient(0, -7, 0, 7);
      hg.addColorStop(0, "#3a2a22");
      hg.addColorStop(1, "#0d0806");
      g.fillStyle = hg;
      g.beginPath();
      g.moveTo(-96, -6);
      g.lineTo(18, -6);
      g.lineTo(18, 6);
      g.lineTo(-96, 6);
      g.closePath();
      g.fill();
      g.fillStyle = "#8f979d";
      g.fillRect(14, -3, 34, 6);
      const bg = g.createLinearGradient(0, -26, 0, 26);
      bg.addColorStop(0, "#9aa3aa");
      bg.addColorStop(0.5, "#dfe6ea");
      bg.addColorStop(1, "#f4f8fa");
      g.fillStyle = bg;
      g.beginPath();
      g.moveTo(40, -20);
      g.lineTo(162, -26);
      g.lineTo(168, 26);
      g.lineTo(40, 22);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(255,255,255,.6)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(46, 16);
      g.lineTo(160, 20);
      g.stroke();
      g.restore();
    }
    function drawHand(g, W, E, fx, fy) {
      const ang = Math.atan2(W[1] - E[1], W[0] - E[0]);
      const cx = W[0] + Math.cos(ang) * 17,
        cy = W[1] + Math.sin(ang) * 17;
      g.save();
      g.translate(cx, cy);
      g.rotate(ang);
      const gr = g.createLinearGradient(0, -22, 0, 22);
      const lit = Math.sin(Math.atan2(fy - cy, fx - cx) - ang) > 0;
      gr.addColorStop(0, lit ? "#6d3d2a" : "#e8ac7e");
      gr.addColorStop(1, lit ? "#e8ac7e" : "#6d3d2a");
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(0, 0, 27, 21, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgba(70,32,20,.45)";
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.ellipse(14, -9 + i * 9, 8, 4.4, 0, 0, TAU);
        g.fill();
      }
      g.fillStyle = lit ? "#c98a5e" : "#d99c6e";
      g.beginPath();
      g.ellipse(-6, lit ? -18 : 18, 13, 7, lit ? 0.3 : -0.3, 0, TAU);
      g.fill();
      g.restore();
    }

    function drawSlice(g, x, y, rot, s, cook) {
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.scale(s, s);
      const r = [244, 118, 84],
        c = [250, 186, 128],
        k = (v) => Math.round(mix(r[v], c[v], cook));
      const gr = g.createLinearGradient(0, -14, 0, 16);
      gr.addColorStop(
        0,
        "rgb(" +
          Math.min(255, k(0) + 8) +
          "," +
          Math.min(255, k(1) + 38) +
          "," +
          Math.min(255, k(2) + 34) +
          ")",
      );
      gr.addColorStop(1, "rgb(" + k(0) + "," + k(1) + "," + k(2) + ")");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(-26, -9);
      g.quadraticCurveTo(-4, -17, 27, -11);
      g.quadraticCurveTo(34, 0, 26, 12);
      g.quadraticCurveTo(0, 18, -27, 11);
      g.quadraticCurveTo(-34, 0, -26, -9);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(255,238,224," + (0.62 - 0.25 * cook) + ")";
      g.lineWidth = 1.8;
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(-20, i * 6 - 1);
        g.quadraticCurveTo(-2, i * 6 - 6, 20, i * 6 - 1);
        g.stroke();
      }
      if (cook > 0.2) {
        g.strokeStyle = "rgba(110,50,24," + 0.5 * cook + ")";
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(-18, 4);
        g.lineTo(18, 7);
        g.moveTo(-16, -3);
        g.lineTo(20, 0);
        g.stroke();
      }
      g.strokeStyle = "rgba(255,255,255,.35)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-22, -9);
      g.quadraticCurveTo(-2, -15, 24, -10);
      g.stroke();
      g.restore();
    }
    function drawShrimp(g, x, y, rot, s) {
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.scale(s, s);
      const N = 7;
      for (let i = N; i >= 0; i--) {
        const u = i / N,
          px = mix(-30, 26, u),
          py = -22 * Math.sin(u * PI) + 10 * u;
        const rx = 13 * (1 - 0.5 * u) + 2,
          ry = 10 * (1 - 0.45 * u) + 1.5;
        const ang = Math.atan2(-22 * PI * Math.cos(u * PI) + 10, 56);
        g.fillStyle = i % 2 ? "#e3561f" : "#f2823a";
        g.beginPath();
        g.ellipse(px, py, rx, ry, ang, 0, TAU);
        g.fill();
        g.strokeStyle = "rgba(255,230,200,.5)";
        g.lineWidth = 1.3;
        g.beginPath();
        g.ellipse(px, py, rx * 0.8, ry * 0.8, ang, PI * 1.1, PI * 1.9);
        g.stroke();
      }
      g.fillStyle = "#d6471b";
      [-0.5, 0, 0.5].forEach((a) => {
        g.save();
        g.translate(30, 11);
        g.rotate(a + 0.5);
        g.beginPath();
        g.ellipse(9, 0, 10, 4.4, 0, 0, TAU);
        g.fill();
        g.restore();
      });
      g.fillStyle = "#b8340f";
      g.beginPath();
      g.ellipse(-34, -2, 9, 8, 0, 0, TAU);
      g.fill();
      g.strokeStyle = "#e66a32";
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(-40, -6);
      g.quadraticCurveTo(-60, -22, -78, -14);
      g.moveTo(-40, -2);
      g.quadraticCurveTo(-62, -8, -80, 0);
      g.stroke();
      g.restore();
    }

    function drawChef(g, P, fx, fy, t) {
      g.save();
      g.translate(P.x0, P.sy);
      /* pescoço */
      g.fillStyle = "#5c3426";
      g.fillRect(-23, -196, 46, 48);
      /* jaqueta */
      const jg = g.createLinearGradient(0, -170, 0, 92);
      jg.addColorStop(0, "#8f857e");
      jg.addColorStop(0.5, "#d4c8ba");
      jg.addColorStop(1, "#f1d9bb");
      g.fillStyle = jg;
      g.beginPath();
      g.moveTo(-46, -172);
      g.quadraticCurveTo(-100, -158, -134, -114);
      g.quadraticCurveTo(-146, -70, -138, -8);
      g.lineTo(-122, 96);
      g.lineTo(122, 96);
      g.lineTo(138, -8);
      g.quadraticCurveTo(146, -70, 134, -114);
      g.quadraticCurveTo(100, -158, 46, -172);
      g.quadraticCurveTo(0, -150, -46, -172);
      g.closePath();
      g.fill();
      const sg = g.createLinearGradient(-140, 0, 140, 0);
      sg.addColorStop(0, "rgba(10,6,6,.55)");
      sg.addColorStop(0.28, "rgba(10,6,6,0)");
      sg.addColorStop(0.72, "rgba(10,6,6,0)");
      sg.addColorStop(1, "rgba(10,6,6,.55)");
      g.fillStyle = sg;
      g.fill();
      /* gola em V (esquerda sobre direita) */
      g.fillStyle = "#b9ac9e";
      g.strokeStyle = "rgba(70,56,48,.8)";
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(46, -172);
      g.lineTo(20, -172);
      g.lineTo(-14, 30);
      g.lineTo(8, 30);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = "#d8cdc0";
      g.beginPath();
      g.moveTo(-46, -172);
      g.lineTo(-20, -172);
      g.lineTo(14, 30);
      g.lineTo(-8, 30);
      g.closePath();
      g.fill();
      g.stroke();
      /* sombra do queixo na jaqueta */
      const cg = g.createLinearGradient(0, -176, 0, -120);
      cg.addColorStop(0, "rgba(8,4,4,.6)");
      cg.addColorStop(1, "rgba(8,4,4,0)");
      g.fillStyle = cg;
      g.fillRect(-60, -176, 120, 56);
      /* cabeça */
      const hx = 0,
        hy = -246;
      const fg = g.createRadialGradient(0, hy + 38, 6, 0, hy + 6, 82);
      fg.addColorStop(0, "#d79a6c");
      fg.addColorStop(0.55, "#a86a47");
      fg.addColorStop(1, "#4d281c");
      g.fillStyle = "#7a4630";
      g.beginPath();
      g.ellipse(-50, hy + 4, 8, 15, 0, 0, TAU);
      g.ellipse(50, hy + 4, 8, 15, 0, 0, TAU);
      g.fill();
      g.fillStyle = fg;
      g.beginPath();
      g.ellipse(hx, hy, 50, 63, 0, 0, TAU);
      g.fill();
      /* cabelo */
      g.fillStyle = "#0d0807";
      g.beginPath();
      g.ellipse(hx, hy - 22, 52, 44, 0, PI, TAU);
      g.lineTo(52, hy - 22);
      g.closePath();
      g.fill();
      /* hachimaki com sol vermelho */
      const bgd = g.createLinearGradient(0, hy - 46, 0, hy - 18);
      bgd.addColorStop(0, "#f6f0e6");
      bgd.addColorStop(1, "#cfc4b4");
      g.fillStyle = bgd;
      g.beginPath();
      g.moveTo(-52, hy - 24);
      g.quadraticCurveTo(0, hy - 56, 52, hy - 24);
      g.lineTo(53, hy - 4);
      g.quadraticCurveTo(0, hy - 36, -53, hy - 4);
      g.closePath();
      g.fill();
      g.fillStyle = "#c3141e";
      g.beginPath();
      g.arc(0, hy - 27, 10, 0, TAU);
      g.fill();
      const wob = Math.sin(t * 5) * 3;
      g.fillStyle = "#e8dfd0";
      g.beginPath();
      g.ellipse(55, hy - 14, 7, 6, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.moveTo(56, hy - 12);
      g.lineTo(82 + wob, hy + 12);
      g.lineTo(72 + wob, hy + 16);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(54, hy - 10);
      g.lineTo(70 + wob, hy + 30);
      g.lineTo(60 + wob, hy + 30);
      g.closePath();
      g.fill();
      /* rosto: olhos, sobrancelhas, nariz, boca */
      g.strokeStyle = "rgba(14,6,4,.9)";
      g.lineCap = "round";
      g.lineWidth = 5.5;
      g.beginPath();
      g.moveTo(-31, hy - 5);
      g.lineTo(-11, hy - 8);
      g.moveTo(11, hy - 8);
      g.lineTo(31, hy - 5);
      g.stroke();
      g.lineWidth = 3.2;
      g.beginPath();
      g.moveTo(-27, hy + 5);
      g.quadraticCurveTo(-19, hy + 1, -11, hy + 5);
      g.moveTo(11, hy + 5);
      g.quadraticCurveTo(19, hy + 1, 27, hy + 5);
      g.stroke();
      g.lineWidth = 2.4;
      g.strokeStyle = "rgba(70,30,18,.6)";
      g.beginPath();
      g.moveTo(2, hy + 6);
      g.lineTo(6, hy + 24);
      g.lineTo(-2, hy + 26);
      g.stroke();
      g.strokeStyle = "rgba(52,18,12,.85)";
      g.lineWidth = 2.6;
      g.beginPath();
      g.moveTo(-14, hy + 40);
      g.quadraticCurveTo(0, hy + 46, 14, hy + 40);
      g.stroke();
      g.restore();
    }

    function drawWall(g, t, I) {
      const wg = g.createLinearGradient(0, -900, 0, 70);
      wg.addColorStop(0, "#0e0707");
      wg.addColorStop(1, "#2a1510");
      g.fillStyle = wg;
      g.fillRect(-1500, -1100, 3000, 1180);
      /* painéis shoji ao fundo */
      [
        [-760, -470, 400, 420],
        [330, -470, 420, 420],
      ].forEach((p) => {
        g.fillStyle = "rgba(255,226,186,.10)";
        g.fillRect(p[0], p[1], p[2], p[3]);
        g.strokeStyle = "rgba(14,6,4,.85)";
        g.lineWidth = 6;
        for (let i = 0; i <= 5; i++) {
          const x = p[0] + (i * p[2]) / 5;
          g.beginPath();
          g.moveTo(x, p[1]);
          g.lineTo(x, p[1] + p[3]);
          g.stroke();
        }
        for (let j = 0; j <= 3; j++) {
          const y = p[1] + (j * p[3]) / 3;
          g.beginPath();
          g.moveTo(p[0], y);
          g.lineTo(p[0] + p[2], y);
          g.stroke();
        }
      });
      /* lanternas */
      [
        [-215, -392, 44],
        [262, -372, 38],
        [-560, -300, 40],
        [610, -320, 42],
      ].forEach((l, i) => {
        const sway = Math.sin(t * 0.9 + i) * 2;
        g.strokeStyle = "rgba(10,5,4,.9)";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(l[0] + sway * 0.2, -1100);
        g.lineTo(l[0] + sway, l[1] - l[2] * 1.2);
        g.stroke();
        const lg = g.createRadialGradient(
          l[0] + sway,
          l[1],
          4,
          l[0] + sway,
          l[1],
          l[2] * 1.2,
        );
        lg.addColorStop(0, "#ff8a4a");
        lg.addColorStop(0.55, "#c3262a");
        lg.addColorStop(1, "#6a0f14");
        g.fillStyle = lg;
        g.beginPath();
        g.ellipse(l[0] + sway, l[1], l[2], l[2] * 1.22, 0, 0, TAU);
        g.fill();
        g.strokeStyle = "rgba(60,8,10,.55)";
        g.lineWidth = 2;
        for (let k = -2; k <= 2; k++) {
          g.beginPath();
          g.ellipse(
            l[0] + sway,
            l[1],
            l[2],
            (l[2] * 1.22 * Math.abs(k)) / 2.6 + 1,
            0,
            0,
            TAU,
          );
          g.stroke();
        }
        g.fillStyle = "#120807";
        g.fillRect(l[0] + sway - l[2] * 0.5, l[1] - l[2] * 1.32, l[2], 7);
        g.fillRect(l[0] + sway - l[2] * 0.5, l[1] + l[2] * 1.2, l[2], 7);
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = 0.5 + 0.2 * Math.sin(t * 3 + i * 2);
        g.drawImage(
          SP.glow,
          l[0] + sway - l[2] * 2.6,
          l[1] - l[2] * 2.6,
          l[2] * 5.2,
          l[2] * 5.2,
        );
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      });
      /* bokeh */
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 14; i++) {
        const x = -820 + H(i, 21) * 1640,
          y = -520 + H(i, 22) * 460,
          r = 24 + H(i, 23) * 52;
        g.globalAlpha =
          (0.05 + 0.08 * H(i, 24)) * (0.7 + 0.3 * Math.sin(t * 1.3 + i * 3.1));
        g.drawImage(i % 3 ? SP.org : SP.yel, x - r, y - r, r * 2, r * 2);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }

    function poly(g, pts) {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath();
    }
    function drawCounter(g, t, I) {
      /* balcão de madeira */
      const cg = g.createLinearGradient(0, 56, 0, 340);
      cg.addColorStop(0, "#2a1710");
      cg.addColorStop(1, "#4b2d1c");
      g.fillStyle = cg;
      g.fillRect(-1500, 56, 3000, 284);
      g.strokeStyle = "rgba(0,0,0,.22)";
      g.lineWidth = 1.4;
      for (let i = 0; i < 14; i++) {
        const y = 70 + i * 19 + H(i, 31) * 6;
        g.beginPath();
        g.moveTo(-1500, y);
        g.lineTo(1500, y + H(i, 32) * 6 - 3);
        g.stroke();
      }
      g.fillStyle = "#1a0d08";
      g.fillRect(-1500, 340, 3000, 700);
      g.fillStyle = "rgba(255,200,140,.18)";
      g.fillRect(-1500, 338, 3000, 2.5);
      /* chapa de aço */
      const sg = g.createLinearGradient(0, 84, 0, 308);
      sg.addColorStop(0, "#1a1617");
      sg.addColorStop(0.5, "#2b2728");
      sg.addColorStop(1, "#3d3839");
      poly(g, [
        [-92, 84],
        [232, 84],
        [276, 306],
        [-132, 306],
      ]);
      g.fillStyle = sg;
      g.fill();
      g.save();
      poly(g, [
        [-92, 84],
        [232, 84],
        [276, 306],
        [-132, 306],
      ]);
      g.clip();
      g.strokeStyle = "rgba(255,255,255,.045)";
      g.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        const y = 88 + i * 5.6;
        g.beginPath();
        g.moveTo(-140, y + H(i, 41) * 3);
        g.lineTo(290, y + H(i, 42) * 3);
        g.stroke();
      }
      const rg = g.createRadialGradient(
        FIRE.x,
        FIRE.y + 10,
        10,
        FIRE.x,
        FIRE.y + 10,
        190,
      );
      rg.addColorStop(
        0,
        "rgba(255,170,90," + clamp(0.18 + 0.4 * I, 0, 0.7) + ")",
      );
      rg.addColorStop(1, "rgba(255,120,40,0)");
      g.fillStyle = rg;
      g.fillRect(-140, 84, 430, 230);
      g.restore();
      const lg = g.createLinearGradient(0, 306, 0, 326);
      lg.addColorStop(0, "#59514f");
      lg.addColorStop(1, "#171314");
      poly(g, [
        [-132, 306],
        [276, 306],
        [280, 326],
        [-136, 326],
      ]);
      g.fillStyle = lg;
      g.fill();
      g.fillStyle = "rgba(255,255,255,.25)";
      g.fillRect(-132, 306, 408, 1.6);
    }
    function drawBoard(g, t, I) {
      const bg = g.createLinearGradient(0, 98, 0, 176);
      bg.addColorStop(0, "#a56c3d");
      bg.addColorStop(1, "#6d4224");
      g.fillStyle = bg;
      g.beginPath();
      const x0 = -304,
        y0 = 98,
        w = 218,
        h = 76,
        r = 12;
      g.moveTo(x0 + r, y0);
      g.lineTo(x0 + w - r, y0);
      g.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
      g.lineTo(x0 + w, y0 + h - r);
      g.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
      g.lineTo(x0 + r, y0 + h);
      g.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
      g.lineTo(x0, y0 + r);
      g.quadraticCurveTo(x0, y0, x0 + r, y0);
      g.fill();
      g.strokeStyle = "rgba(40,20,10,.35)";
      g.lineWidth = 1.4;
      for (let i = 0; i < 6; i++) {
        const y = y0 + 8 + i * 12;
        g.beginPath();
        g.moveTo(x0 + 6, y);
        g.lineTo(x0 + w - 6, y + H(i, 51) * 4 - 2);
        g.stroke();
      }
      g.fillStyle = "rgba(255,214,170,.28)";
      g.fillRect(x0 + 8, y0 + 1.5, w - 16, 2.2);
      g.fillStyle = "rgba(0,0,0,.35)";
      g.fillRect(x0, y0 + h, w, 5);
    }
    function drawBlock(g, t) {
      let cuts = 0;
      for (let i = 0; i < 4; i++) if (t >= TL.chop[i]) cuts++;
      const xl = -284,
        xr = -110 - 28 * cuts,
        y = 112,
        h = 40;
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, "#fb9c78");
      gr.addColorStop(0.55, "#f2704a");
      gr.addColorStop(1, "#d9532f");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(xl + 8, y);
      g.lineTo(xr, y);
      g.lineTo(xr, y + h);
      g.lineTo(xl + 8, y + h);
      g.quadraticCurveTo(xl - 4, y + h / 2, xl + 8, y);
      g.fill();
      g.strokeStyle = "rgba(255,240,228,.6)";
      g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(xl + 14, y + 10 + i * 10);
        g.quadraticCurveTo(
          (xl + xr) / 2,
          y + 4 + i * 10,
          xr - 2,
          y + 12 + i * 10,
        );
        g.stroke();
      }
      g.fillStyle = "rgba(255,255,255,.35)";
      g.fillRect(xl + 12, y + 1.5, xr - xl - 14, 2.4);
    }

    function drawSliceSet(g, t) {
      /* fatias cortadas: deslizam para o repouso, depois voam para a chapa */
      for (let i = 0; i < 4; i++) {
        if (t < TL.chop[i]) continue;
        const c = sliceCut(i),
          r = sliceRest(i),
          u = eo3((t - TL.chop[i]) / 0.24);
        let x = mix(c[0], r[0], u),
          y = mix(c[1], r[1], u),
          rot = (i - 1.5) * 0.1 * u,
          cook = 0,
          on = true;
        if (i < 3) {
          const tf = TL.toss[i],
            s = (t - tf) / TL.tfly;
          if (s >= 1) {
            const L = sliceLand(i);
            x = L[0];
            y = L[1];
            rot = (i - 1) * 0.35;
            cook = sm(0, 1.3, t - tf - TL.tfly);
          } else if (s > 0) {
            const L = sliceLand(i);
            x = mix(r[0], L[0], s);
            y = mix(r[1], L[1], s) - 4 * 78 * s * (1 - s);
            rot = (i - 1.5) * 0.1 + TAU * 1.0 * s;
          }
        }
        if (on) drawSlice(g, x, y, rot, 1.0, cook);
      }
    }

    function drawFlames(g, t, Qp) {
      g.globalCompositeOperation = "lighter";
      for (let bi = 0; bi < BURSTS.length; bi++) {
        const b = BURSTS[bi];
        if (t < b.t0 || t > b.t0 + b.dur + 1.3) continue;
        const n = Math.round(b.n * Qp);
        for (let k = 0; k < n; k++) {
          const sp = b.t0 + b.dur * Math.pow(k / n, 0.85),
            life = 0.5 + 0.55 * H(k, bi + 2),
            age = t - sp;
          if (age < 0 || age > life) continue;
          const u = age / life;
          const x =
            b.x +
            (H(k, bi + 3) - 0.5) * b.spread * (1 - u * 0.45) +
            Math.sin(age * 9 + k) * 7 * u;
          const y = b.y - b.h * eo3(u) * (0.5 + 0.55 * H(k, bi + 4));
          const sz =
            (20 + 46 * H(k, bi + 5)) * (0.55 + u * 0.95) * (0.7 + 0.5 * b.pk);
          const spr =
            u < 0.1 ? SP.hot : u < 0.36 ? SP.yel : u < 0.7 ? SP.org : SP.red;
          g.globalAlpha = Math.pow(1 - u, 1.15) * 0.78;
          g.drawImage(spr, x - sz, y - sz, sz * 2, sz * 2);
        }
      }
      g.globalAlpha = 1;
    }
    function drawSparks(g, t, Qp) {
      g.globalCompositeOperation = "lighter";
      g.lineCap = "round";
      for (let si = 0; si < SPARKS.length; si++) {
        const s = SPARKS[si];
        if (t < s.t0 || t > s.t0 + s.life + 0.2) continue;
        const n = Math.round(s.n * Qp);
        for (let i = 0; i < n; i++) {
          const ang = -PI / 2 + (H(i, si + 61) - 0.5) * PI * s.up,
            v = s.v * (0.35 + 0.65 * H(i, si + 62)),
            age = t - s.t0 - H(i, si + 63) * 0.12;
          if (age < 0 || age > s.life) continue;
          const px = s.x + Math.cos(ang) * v * age,
            py = s.y + Math.sin(ang) * v * age + 0.5 * 900 * age * age;
          const a2 = Math.max(0, age - 0.035),
            qx = s.x + Math.cos(ang) * v * a2,
            qy = s.y + Math.sin(ang) * v * a2 + 0.5 * 900 * a2 * a2;
          const fa = 1 - age / s.life;
          g.strokeStyle =
            "rgba(255," +
            ((190 + 50 * fa) | 0) +
            ",120," +
            (0.9 * fa).toFixed(3) +
            ")";
          g.lineWidth = 2.2;
          g.beginPath();
          g.moveTo(qx, qy);
          g.lineTo(px, py);
          g.stroke();
        }
      }
    }
    function drawSteam(g, t, I, Qp) {
      g.globalCompositeOperation = "lighter";
      const N = Math.round(18 * Qp),
        gain = 0.4 + 0.6 * sm(3.3, 3.9, t);
      for (let i = 0; i < N; i++) {
        const ph = (t * 0.42 + i / N + H(i, 9)) % 1;
        const x = FIRE.x + (H(i, 10) - 0.5) * 220 + Math.sin(ph * 6 + i) * 22,
          y = 206 - ph * 240,
          sz = 34 + ph * 84;
        g.globalAlpha =
          Math.sin(ph * PI) * (0.05 + 0.07 * Math.min(1, I)) * gain * 1.4;
        g.drawImage(SP.smoke, x - sz, y - sz, sz * 2, sz * 2);
      }
      g.globalAlpha = 1;
    }
    function drawRipples(g, t) {
      g.strokeStyle = "rgba(255,236,208,1)";
      RIPPLES.forEach((r0) => {
        const a = t - r0;
        if (a < 0 || a > 0.7) return;
        const p = a / 0.7,
          L = sliceLand(RIPPLES.indexOf(r0));
        g.globalAlpha = (1 - p) * 0.55;
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(L[0], L[1] + 6, 20 + 46 * p, 7 + 15 * p, 0, 0, TAU);
        g.stroke();
      });
      g.globalAlpha = 1;
    }
    function drawOil(g, t) {
      if (t < 0.1 || t > TL.ign + 0.05) return;
      const top = -240,
        y1 = 208,
        head = t < 0.32 ? mix(top, y1, sm(0.1, 0.32, t)) : y1;
      const w = 3.2 + 1.4 * sm(0.3, 0.7, t);
      g.save();
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = "rgba(255,214,120,.85)";
      g.lineWidth = w;
      g.lineCap = "round";
      g.beginPath();
      for (let y = top; y <= head; y += 14) {
        const x = FIRE.x + Math.sin(y * 0.03 + t * 9) * 2.2;
        if (y === top) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      g.strokeStyle = "rgba(255,250,224,.9)";
      g.lineWidth = w * 0.35;
      g.stroke();
      if (t > 0.3) {
        for (let i = 0; i < 14; i++) {
          const ph = (t * 3 + i / 14) % 1,
            a = -PI / 2 + (H(i, 71) - 0.5) * 2.6;
          g.globalAlpha = (1 - ph) * 0.8;
          g.fillStyle = "#ffd88a";
          g.beginPath();
          g.arc(
            FIRE.x + Math.cos(a) * 46 * ph * (0.6 + H(i, 72)),
            y1 + Math.sin(a) * 60 * ph + 70 * ph * ph,
            2.2,
            0,
            TAU,
          );
          g.fill();
        }
      }
      g.restore();
    }

    /* ---------- quadro completo ---------- */
    function create(canvas, o) {
      o = o || {};
      initSprites();
      const g = canvas.getContext("2d", { alpha: false });
      let cw = 1,
        ch = 1,
        dpr = 1,
        Qp = o.low ? 0.55 : 1;
      const loop = !!o.loop;
      function resize(w, h, d) {
        cw = Math.max(1, w);
        ch = Math.max(1, h);
        dpr = d || 1;
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
      }
      function setLow(v) {
        Qp = v ? 0.55 : 1;
      }

      function draw(tIn) {
        let t = tIn;
        if (loop) t = 0.5 + (tIn % 4.6);
        const I = lightAt(t),
          cam = camAt(t);
        /* tremor de câmera: ruído suave + impulsos nos cortes e nas chamas */
        let sx = Math.sin(t * 9.1) * 0.9 + Math.sin(t * 15.7) * 0.5,
          sy = Math.cos(t * 7.3) * 0.8 + Math.sin(t * 13.1) * 0.4;
        const imp = (t0, amp) => {
          const a = t - t0;
          return a < 0 || a > 0.4
            ? 0
            : amp * Math.exp(-a * 10) * Math.sin(a * 70);
        };
        SHOTS.forEach((s) => {
          sx += imp(s.a, 7);
          sy += imp(s.a, 5);
        });
        BURSTS.forEach((b) => {
          if (b.pk > 0.9) {
            sy += imp(b.t0, 9);
            sx += imp(b.t0 + 0.02, 6);
          }
        });
        const u0 = Math.min(cw / 600, ch / 700) * (cw / ch < 0.8 ? 1.2 : 1),
          s = u0 * cam.z;
        const camX = cam.x + (sx / s) * 1.0,
          camY = cam.y + (sy / s) * 1.0;
        /* poses */
        const R = rig(t),
          P = R.P,
          SR = R.SR,
          SL = R.SL,
          aR = R.aR,
          aL = R.aL;
        const kn = knifeAt(t, R);
        const shr = shrimpAt(t);

        /* ---- fundo e mundo ---- */
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 1;
        g.fillStyle = "#080404";
        g.fillRect(0, 0, cw, ch);
        g.setTransform(
          dpr * s,
          0,
          0,
          dpr * s,
          dpr * (cw / 2 - camX * s),
          dpr * (ch / 2 - camY * s),
        );
        drawWall(g, t, I);
        drawChef(g, P, FIRE.x, FIRE.y, t);
        drawCounter(g, t, I);
        drawBoard(g, t, I);
        drawBlock(g, t);
        /* faca em repouso (antes de ser pega e depois de devolvida) */
        if (!kn.held && !kn.fly) drawKnife(g, kn.x, kn.y, kn.a, KS, 0);
        drawSliceSet(g, t);
        /* camarão na chapa (parado) */
        if (!shr.fly) drawShrimp(g, shr.x, shr.y, shr.a, 0.8);
        /* braços */
        [
          [aR, SR, -1],
          [aL, SL, 1],
        ].forEach((a) => {
          const A = a[0],
            S = a[1];
          const sl = [
            A.E[0] + (A.W[0] - A.E[0]) * 0.34,
            A.E[1] + (A.W[1] - A.E[1]) * 0.34,
          ];
          limbFill(
            g,
            A.E[0],
            A.E[1],
            A.W[0],
            A.W[1],
            46,
            31,
            "#6a3a28",
            "#e6a878",
            FIRE.x,
            FIRE.y,
          );
          limbFill(
            g,
            S[0],
            S[1],
            A.E[0],
            A.E[1],
            58,
            46,
            "#8f857e",
            "#f1dfc6",
            FIRE.x,
            FIRE.y,
          );
          limbFill(
            g,
            A.E[0],
            A.E[1],
            sl[0],
            sl[1],
            46,
            41,
            "#8f857e",
            "#f1dfc6",
            FIRE.x,
            FIRE.y,
          );
          const cg2 = g.createRadialGradient(
            S[0] - 6,
            S[1] - 8,
            4,
            S[0],
            S[1],
            34,
          );
          cg2.addColorStop(0, "#d9ccbd");
          cg2.addColorStop(1, "#8f857e");
          g.fillStyle = cg2;
          g.beginPath();
          g.arc(S[0], S[1], 29, 0, TAU);
          g.fill();
          g.strokeStyle = "rgba(40,30,26,.5)";
          g.lineWidth = 2;
          limb(g, A.E[0], A.E[1], sl[0], sl[1], 46, 41);
          g.stroke();
        });
        /* ferramentas e mãos */
        if (kn.held) drawKnife(g, kn.x, kn.y, kn.a, KS, 0);
        if (t >= TL.put + 0.08) {
          const a =
            0.09 * pulse(t, TL.catchS + 0.04, 0.08) - 0.05 * sm(4.0, 4.4, t);
          drawSpatula(g, R.cR[0], R.cR[1], a, SS);
        }
        drawSpatula(g, R.cL[0], R.cL[1], spatulaAngle(t), SS);
        drawHand(g, aR.W, aR.E, FIRE.x, FIRE.y);
        drawHand(g, aL.W, aL.E, FIRE.x, FIRE.y);
        /* objetos no ar */
        if (kn.fly) {
          for (let k = 3; k >= 0; k--) {
            const tt = t - k * 0.014;
            if (tt < TL.rel) continue;
            const kk = knifeAt(tt, rig(tt));
            g.globalAlpha = k === 0 ? 1 : 0.22 / k;
            const gl =
              k === 0
                ? Math.pow(Math.max(0, Math.cos((kk.a + 0.5) * 1.0)), 18) * 0.9
                : 0;
            drawKnife(g, kk.x, kk.y, kk.a, KS, gl);
          }
          g.globalAlpha = 1;
        }
        if (shr.fly) {
          for (let k = 2; k >= 0; k--) {
            const tt = t - k * 0.016;
            if (tt < TL.flick) continue;
            const kk = shrimpAt(tt);
            g.globalAlpha = k === 0 ? 1 : 0.2 / k;
            drawShrimp(g, kk.x, kk.y, kk.a, 0.8);
          }
          g.globalAlpha = 1;
        }
        drawRipples(g, t);

        /* ---- luz: o que está longe do fogo fica no escuro ---- */
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        const fxs = cw / 2 + (FIRE.x - camX) * s,
          fys = ch / 2 + (FIRE.y - camY) * s;
        const LR = (230 + 380 * clamp(I - 0.2, 0, 1.4)) * s;
        const dk = g.createRadialGradient(
          fxs,
          fys,
          LR * 0.12,
          fxs,
          fys,
          LR * 1.5,
        );
        dk.addColorStop(0, "rgba(6,3,3,0)");
        dk.addColorStop(0.4, "rgba(6,3,3,.28)");
        dk.addColorStop(0.8, "rgba(5,2,2,.7)");
        dk.addColorStop(1, "rgba(4,2,2,.86)");
        g.fillStyle = dk;
        g.fillRect(0, 0, cw, ch);

        /* ---- fogo, faíscas, vapor ---- */
        g.setTransform(
          dpr * s,
          0,
          0,
          dpr * s,
          dpr * (cw / 2 - camX * s),
          dpr * (ch / 2 - camY * s),
        );
        drawOil(g, t);
        drawSteam(g, t, I, Qp);
        drawFlames(g, t, Qp);
        g.globalCompositeOperation = "lighter";
        const gl0 = clamp(I - 0.3, 0, 1.4);
        if (gl0 > 0.02) {
          g.globalAlpha = Math.min(0.5, gl0 * 0.36);
          const rr = 340 + 200 * gl0;
          g.drawImage(SP.glow, FIRE.x - rr, FIRE.y - 40 - rr, rr * 2, rr * 2);
          g.globalAlpha = 1;
        }
        drawSparks(g, t, Qp);
        g.globalCompositeOperation = "source-over";

        /* ---- pós: vinheta, flashes, grão, fade ---- */
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        const vg = g.createRadialGradient(
          cw / 2,
          ch / 2,
          Math.min(cw, ch) * 0.28,
          cw / 2,
          ch / 2,
          Math.max(cw, ch) * 0.78,
        );
        vg.addColorStop(0, "rgba(0,0,0,0)");
        vg.addColorStop(1, "rgba(0,0,0,.66)");
        g.fillStyle = vg;
        g.fillRect(0, 0, cw, ch);
        let fl = 0;
        const a0 = t - TL.ign;
        if (a0 >= 0 && a0 < 0.2) fl = Math.max(fl, 0.2 * (1 - a0 / 0.2));
        const a1 = t - TL.catchS;
        if (a1 >= 0 && a1 < 0.22) fl = Math.max(fl, 0.24 * (1 - a1 / 0.22));
        SHOTS.forEach((sh, i) => {
          const a = t - sh.a;
          if (i > 1 && a >= 0 && a < 0.1)
            fl = Math.max(fl, 0.22 * (1 - a / 0.1));
        });
        if (fl > 0.003) {
          g.fillStyle = "rgba(255,226,180," + fl.toFixed(3) + ")";
          g.fillRect(0, 0, cw, ch);
        }
        if (!o.noGrain) {
          const gx = (H(Math.floor(tIn * 24), 5) * 128) | 0,
            gy = (H(Math.floor(tIn * 24), 6) * 128) | 0;
          g.save();
          g.translate(-gx, -gy);
          g.fillStyle = g.createPattern(SP.grain, "repeat");
          g.fillRect(0, 0, cw + 128, ch + 128);
          g.restore();
        }
        const fade = loop
          ? 1 - sm(0, 0.3, tIn % 4.6) + sm(4.3, 4.6, tIn % 4.6)
          : 1 - sm(0, 0.42, tIn) + sm(4.62, 4.98, tIn);
        if (fade > 0.002) {
          g.fillStyle = "rgba(8,4,4," + clamp(fade, 0, 1).toFixed(3) + ")";
          g.fillRect(0, 0, cw, ch);
        }
      }
      return { resize: resize, draw: draw, setLow: setLow, DUR: DUR };
    }

    function spatulaAngle(t) {
      /* espátula da mão esquerda: aponta para a esquerda; gira uma volta no "show" inicial; inclina nos lançamentos */
      let a = PI;
      a += TAU * eio((t - 0.95) / 0.55);
      for (let j = 0; j < 3; j++) a -= 0.55 * pulse(t, TL.toss[j] + 0.07, 0.1);
      a -= 0.75 * pulse(t, TL.flick + 0.1, 0.14);
      a += 0.18 * pulse(t, TL.catchS + 0.02, 0.07);
      return a;
    }

    return { create: create, DUR: DUR, TL: TL };
  })();

  /* ===== D · efeitos de página e laço de quadros ===== */
  function startLoop() {
    if (S.rafOn) return;
    S.rafOn = true;
    S.last = performance.now();
    requestAnimationFrame(frame);
  }
  function stopLoop() {
    S.rafOn = false;
  }

  function frame(now) {
    if (!S.rafOn) return;
    requestAnimationFrame(frame);
    const raw = (now - S.last) / 1000;
    S.last = now;
    const dt = clamp(raw, 0.001, 0.05);
    S.time += dt;
    const y = W.pageYOffset || 0;
    S.vel = lerp(S.vel, (y - S.y) / dt, 1 - Math.exp(-dt * 9));
    S.y = y;
    S.sT = storyTarget();
    S.sS += (S.sT - S.sS) * (1 - Math.exp(-dt * 7));
    if (Math.abs(S.sT - S.sS) < 0.0004) S.sS = S.sT;
    updPointer(dt);
    const inGL =
      GLS.ok && S.y > M.chTop - M.vh && S.y < M.chTop + M.chLen + M.vh;
    if (inGL) {
      updateScene(dt);
      drawGL();
    }
    domFX(dt);
    S.frameN++;
    autoLite(raw, inGL);
  }

  /* ponteiro suavizado; sem mouse (celular), o foco passeia sozinho */
  function updPointer(dt) {
    const idle = S.time - S.ptAt;
    S.gw += ((!FINE || idle > 2.6 ? 1 : 0) - S.gw) * (1 - Math.exp(-dt * 1.6));
    const gx = 0.55 * Math.sin(S.time * 0.45),
      gy = 0.34 * Math.sin(S.time * 0.63 + 1.2);
    const tx = lerp(S.pt.x, gx, S.gw),
      ty = lerp(S.pt.y, gy, S.gw);
    const k1 = 1 - Math.exp(-dt * 6),
      k2 = 1 - Math.exp(-dt * 16);
    S.pm.x += (tx - S.pm.x) * k1;
    S.pm.y += (ty - S.pm.y) * k1;
    S.pf.x += (tx - S.pf.x) * k2;
    S.pf.y += (ty - S.pf.y) * k2;
  }

  function domFX(dt) {
    const y = S.y,
      vh = M.vh;
    const pg = M.docH > vh ? clamp(y / (M.docH - vh), 0, 1) : 0;
    if (Math.abs(pg - S.pg) > 0.0005) {
      S.pg = pg;
      el.progI.style.transform = "scaleX(" + pg.toFixed(4) + ")";
    }
    if (y < vh * 1.2 || S.hp > 0) updHero(dt, y, vh);
    updChap();
    updBand(dt);
    if (y > M.dgTop - vh && y < M.dgTop + M.dgLen + vh) updDiag();
    if (y > M.exTop - vh && y < M.exTop + M.exLen + vh) updExpd();
    updPlans();
    updCta(dt);
  }

  /* hero: profundidade pela rolagem e, com mouse de verdade, pelo ponteiro (só escreve quando algo muda) */
  function updHero(dt, y, vh) {
    const k = 1 - Math.exp(-dt * 6),
      tx = FINE ? S.pt.x : 0,
      ty = FINE ? S.pt.y : 0;
    S.hx += (tx - S.hx) * k;
    S.hy += (ty - S.hy) * k;
    const hp = y < vh * 1.2 ? clamp(y / (vh * 0.8), 0, 1) : 1;
    if (
      Math.abs(S.hx - S.hpx) < 0.002 &&
      Math.abs(S.hy - S.hpy) < 0.002 &&
      Math.abs(hp - S.hp) < 0.002
    )
      return;
    S.hpx = S.hx;
    S.hpy = S.hy;
    S.hp = hp;
    [el.enso, el.arch, el.kanji].forEach((n) => {
      n.style.setProperty("--px", S.hx.toFixed(3));
      n.style.setProperty("--py", S.hy.toFixed(3));
      n.style.setProperty("--hp", hp.toFixed(3));
    });
  }

  /* capítulo: cada passo aparece quando a forma correspondente está pronta e some antes da próxima transformação */
  function updChap() {
    const s = S.sS;
    if (S.y < M.chTop - M.vh || S.y > M.chTop + M.chLen + M.vh) return;
    el.steps.forEach((st, j) => {
      const fi = j === 0 ? 1 : sstep(j - 0.42, j - 0.18, s);
      const fo = j === 5 ? 1 : 1 - sstep(j + 0.12, j + 0.36, s);
      const o = Math.min(fi, fo),
        ty = (1 - fi) * 30 - (1 - fo) * 30;
      st.style.opacity = o.toFixed(3);
      st.style.transform = "translate3d(0," + ty.toFixed(1) + "px,0)";
      st.style.visibility = o > 0.02 ? "visible" : "hidden";
    });
    const act = clamp(Math.round(s), 0, 5);
    if (act !== S.chAct) {
      S.chAct = act;
      el.rail.forEach((d, i) => d.classList.toggle("on", i === act));
    }
  }

  /* faixa vermelha: acelera e inclina com a velocidade da rolagem */
  function updBand(dt) {
    S.bandOff += (40 + Math.abs(S.vel) * 0.14) * dt;
    if (S.bandOff >= M.bandW) S.bandOff -= M.bandW;
    if (S.y > M.bandTop - M.vh && S.y < M.bandTop + M.vh) {
      el.band.style.transform =
        "translate3d(" + (-S.bandOff).toFixed(1) + "px,0,0)";
      el.band.parentNode.style.transform =
        "skewX(" + clamp(S.vel * -0.003, -6, 6).toFixed(2) + "deg)";
    }
  }

  /* pratos em rolagem diagonal, inclinados pela velocidade */
  function updDiag() {
    const p = clamp((S.y - M.dgTop) / M.dgLen, 0, 1);
    const sk = clamp(S.vel * 0.003, -8, 8);
    el.track.style.transform =
      "rotate(5deg) translate3d(" + (-p * M.trackDist).toFixed(1) + "px,0,0)";
    el.track.style.setProperty("--sk", sk.toFixed(2) + "deg");
  }

  /* quadro da chapa: cresce até a tela cheia */
  function updExpd() {
    const p = clamp((S.y - M.exTop) / M.exLen, 0, 1);
    const e = easeIO(clamp(p / 0.72, 0, 1)),
      q = 1 - e,
      nar = M.vw < 700;
    const st = el.vframe.style;
    st.setProperty("--cx", ((nar ? 9 : 22) * q).toFixed(2) + "%");
    st.setProperty("--cy", ((nar ? 28 : 29) * q).toFixed(2) + "%");
    st.setProperty("--cr", (34 * q).toFixed(1) + "px");
    st.setProperty("--vo", (sstep(0.55, 1, p) * 0.35).toFixed(3));
    el.chefCv.style.transform = "scale(" + lerp(1.14, 1, e).toFixed(3) + ")";
    el.expCopy.style.opacity = (1 - sstep(0.04, 0.26, p)).toFixed(3);
  }

  /* combos: em telas de toque, a inclinação acompanha a posição na tela */
  function updPlans() {
    if (FINE || S.y < M.cbTop - M.vh || S.y > M.cbBot + M.vh) return;
    el.plans.forEach((p, i) => {
      const rel = (M.planTops[i] + M.planH / 2 - S.y - M.vh / 2) / M.vh;
      p.style.setProperty("--rx", clamp(-rel * 9, -8, 8).toFixed(2) + "deg");
      p.style.setProperty("--ry", clamp(rel * 3, -4, 4).toFixed(2) + "deg");
    });
  }

  /* chamada final: texto líquido e botão magnético */
  function updCta(dt) {
    const y = S.y;
    if (y < M.ctaTop - M.vh * 1.2) return;
    if (!S.liqHint && y > M.ctaTop - M.vh * 0.5) {
      S.liqHint = true;
      S.liqT = 42;
    }
    S.liqT *= Math.exp(-dt * 2.0);
    S.liqA += (S.liqT - S.liqA) * (1 - Math.exp(-dt * 10));
    if (S.liqA > 0.7) {
      el.liq.classList.add("on");
      el.liqD.setAttribute("scale", S.liqA.toFixed(1));
      const f = S.time * 0.45;
      el.liqT.setAttribute(
        "baseFrequency",
        (0.01 + 0.004 * Math.sin(f)).toFixed(4) +
          " " +
          (0.028 + 0.008 * Math.cos(f * 1.3)).toFixed(4),
      );
    } else if (el.liq.classList.contains("on")) {
      el.liq.classList.remove("on");
      el.liqD.setAttribute("scale", "0");
    }
    if (FINE) {
      const dx = S.px - M.magX,
        dy = S.py - (M.magY - y),
        d = Math.hypot(dx, dy),
        k = d < 140 ? 1 - d / 140 : 0,
        kk = 1 - Math.exp(-dt * 10);
      S.mg.x += (dx * k * 0.4 - S.mg.x) * kk;
      S.mg.y += (dy * k * 0.5 - S.mg.y) * kk;
      el.mag.style.transform =
        "translate3d(" +
        S.mg.x.toFixed(1) +
        "px," +
        S.mg.y.toFixed(1) +
        "px,0)";
    }
  }

  /* se o aparelho não aguenta (menos de ~22 quadros por segundo no capítulo 3D), cai sozinho para o modo leve */
  function autoLite(raw, inGL) {
    if (
      !S.auto ||
      (TEST && !qs.has("autolite")) ||
      !S.introDone ||
      D.hidden ||
      raw > 0.6 ||
      !inGL
    )
      return;
    S.dts.push(raw);
    if (S.dts.length >= 90) {
      S.auto = false;
      let sum = 0;
      const a = S.dts.slice(10);
      a.forEach((v) => {
        sum += v;
      });
      if (sum / a.length > 0.045)
        setMode("lite", "Seu aparelho ficou pesado: ativei o modo leve.");
    }
  }

  /* ---------- cena da chapa no quadro que cresce (também no modo leve, só enquanto aparece) ---------- */
  /* lv 0 = normal · 1 = menor resolução e menos partículas · 2 = ainda menor e no máximo ~20 quadros/s · 3 = quadro parado */
  const CHEF = {
    scene: null,
    raf: 0,
    t: 0,
    last: 0,
    vis: false,
    lv: 0,
    still: false,
    f: fpsNew(24, 1000),
  };
  const chefLow = () => S.mode !== "full" || NARROW() || CHEF.lv > 0;
  function chefInit() {
    if (!el.chefCv || typeof ChefScene === "undefined") return;
    try {
      CHEF.scene = ChefScene.create(el.chefCv, { loop: true, low: chefLow() });
    } catch (err) {
      console.warn("[temaki] cena da chapa indisponível", err);
      return;
    }
    chefResize();
    if ("IntersectionObserver" in W) {
      new IntersectionObserver(
        (es) => {
          CHEF.vis = es[0].isIntersecting;
          if (CHEF.vis) chefKick();
          else if (CHEF.raf) {
            cancelAnimationFrame(CHEF.raf);
            CHEF.raf = 0;
          }
        },
        { rootMargin: "80px" },
      ).observe(el.vframe);
    } else {
      CHEF.vis = true;
      chefKick();
    }
  }
  function chefResize() {
    if (!CHEF.scene) return;
    const dpr = Math.min(
      W.devicePixelRatio || 1,
      CHEF.lv >= 2 ? 0.5 : CHEF.lv === 1 ? 0.7 : 1,
    );
    CHEF.scene.resize(
      Math.max(2, el.chefCv.clientWidth),
      Math.max(2, el.chefCv.clientHeight),
      dpr,
    );
    CHEF.scene.draw(reduceMQ.matches || CHEF.still ? 2.2 : CHEF.t);
    CHEF.f.t0 = 0;
    CHEF.f.skip = 1;
  }
  function chefModeChanged() {
    if (!CHEF.scene) return;
    CHEF.scene.setLow(chefLow());
    chefResize();
    if (CHEF.vis) chefKick();
  }
  function chefKick() {
    if (CHEF.raf || !CHEF.scene || CHEF.still || reduceMQ.matches) return;
    CHEF.last = performance.now();
    CHEF.f.t0 = 0;
    CHEF.raf = requestAnimationFrame(chefTick);
  }
  function chefTick(now) {
    CHEF.raf = 0;
    if (!CHEF.vis || D.hidden || !CHEF.scene || CHEF.still) return;
    const raw = (now - CHEF.last) / 1000;
    if (CHEF.lv === 2 && raw < 0.04) {
      CHEF.raf = requestAnimationFrame(chefTick);
      return;
    }
    CHEF.last = now;
    CHEF.t += clamp(raw, 0.001, 0.1);
    CHEF.scene.draw(CHEF.t);
    if (fpsStep(CHEF.f, now) && !(TEST && !qs.has("autolite"))) chefDegrade();
    if (!CHEF.still) CHEF.raf = requestAnimationFrame(chefTick);
  }
  /* a máquina não dá conta: desce um nível (a medição é por tempo, então pega também as travadas em rajada) */
  function chefDegrade() {
    if (CHEF.lv >= 3) return;
    CHEF.lv++;
    CHEF.f.min = CHEF.lv >= 2 ? 10 : 24;
    if (CHEF.lv >= 3) {
      CHEF.still = true;
      if (CHEF.raf) {
        cancelAnimationFrame(CHEF.raf);
        CHEF.raf = 0;
      }
    }
    CHEF.scene.setLow(chefLow());
    chefResize();
  }
  /* só para testes: congela a cena num instante */
  function chefAt(t) {
    CHEF.still = true;
    if (CHEF.raf) {
      cancelAnimationFrame(CHEF.raf);
      CHEF.raf = 0;
    }
    if (CHEF.scene) CHEF.scene.draw(t);
  }

  /* ===== G · abertura: chapa → logo → corte → portas que abrem o site ===== */
  /* cada quadro é função pura do tempo T (em segundos), então dá para pular, voltar e testar com ?t= */
  const IT = {
    sceneEnd: 5.0,
    logo0: 5.0,
    logo1: 5.7,
    st0: 5.2,
    st1: 5.58,
    wr0: 5.12,
    wr1: 5.8,
    sw0: 5.8,
    sw1: 6.5,
    k0: 6.4,
    k1: 6.74,
    imp: 6.63,
    op0: 6.9,
    op1: 7.9,
    end: 8.0,
  };
  /* a versão "corte" é montada com INTRO_CHEF = false: a abertura começa direto na logo, sem a cena da chapa */
  const INTRO_CHEF = false;
  const INTRO_LEAD = 0.3; /* instante escuro antes do fade da logo quando não há cena */
  const INTRO_FONT_WAIT = 2000; /* quanto esperar pelas fontes antes de mostrar a logo */
  const INTRO = {
    T: 0,
    fixed: null,
    done: false,
    skipping: false,
    raf: 0,
    last: 0,
    chef: null,
    scene: true,
    go: false,
    vw: 1280,
    vh: 800,
    kh: 700,
    fxg: null,
    sparks: [],
    f: fpsNew(20, 800),
    lowSet: 0,
    opened: false,
    started: false,
    fxDirty: false,
  };
  const easeOutBack = (t) => {
    const c1 = 1.70158,
      c3 = c1 + 1,
      u = clamp(t, 0, 1) - 1;
    return 1 + c3 * u * u * u + c1 * u * u;
  };

  function introGeom() {
    INTRO.vw = W.innerWidth;
    INTRO.vh = W.innerHeight;
    INTRO.kh = Math.round(clamp(INTRO.vh * 0.86, 340, 860));
    el.intro.style.setProperty("--kh", INTRO.kh + "px");
  }
  function introSizeCanvases() {
    const dpr = Math.min(
      W.devicePixelRatio || 1,
      INTRO.lowSet >= 2 ? 0.6 : INTRO.lowSet ? 0.8 : NARROW() ? 1.1 : 1.15,
    );
    if (INTRO.chef) INTRO.chef.resize(INTRO.vw, INTRO.vh, dpr);
    const f = el.introFx;
    if (f) {
      f.width = Math.round(INTRO.vw);
      f.height = Math.round(INTRO.vh);
      INTRO.fxg = f.getContext("2d");
    }
  }
  function buildSparks() {
    const r = mulberry(31),
      arr = [];
    for (let i = 0; i < 46; i++) {
      arr.push({
        dy: (r() - 0.5) * 0.34,
        vx: (r() < 0.5 ? -1 : 1) * (50 + r() * 320),
        vy: -150 + r() * 210,
        life: 0.45 + r() * 0.7,
        sz: 0.8 + r() * 2.0,
        d: r() * 0.1,
      });
    }
    return arr;
  }
  function drawSparks(T) {
    const g = INTRO.fxg;
    if (!g) return;
    const a0 = T - IT.imp,
      on = a0 >= 0 && a0 < 1.5;
    if (!on && !INTRO.fxDirty) return;
    const w = INTRO.vw,
      h = INTRO.vh;
    g.clearRect(0, 0, w, h);
    INTRO.fxDirty = on;
    if (!on) return;
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < INTRO.sparks.length; i++) {
      const s = INTRO.sparks[i],
        age = a0 - s.d;
      if (age < 0 || age > s.life) continue;
      const x = w / 2 + s.vx * age * (1 - 0.35 * age),
        y = h / 2 + s.dy * h + s.vy * age + 420 * age * age;
      g.globalAlpha = Math.pow(1 - age / s.life, 1.5);
      g.fillStyle = age < 0.14 ? "#ffffff" : "#ffd88a";
      g.beginPath();
      g.arc(x, y, s.sz * (1 - (0.5 * age) / s.life), 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  function introState(T) {
    const vh = INTRO.vh,
      kh = INTRO.kh,
      o = {};
    o.la = sstep(IT.logo0, IT.logo1, T);
    o.hs = easeOutBack((T - IT.st0) / (IT.st1 - IT.st0));
    o.wr = sstep(IT.wr0, IT.wr1, T);
    o.sw = clamp((T - IT.sw0) / (IT.sw1 - IT.sw0), 0, 1);
    const kp = clamp((T - IT.k0) / (IT.k1 - IT.k0), 0, 1);
    o.ky = lerp(-kh - 14, vh + 40, Math.pow(kp, 2.2));
    o.tip = clamp(o.ky + kh, 0, vh);
    o.sl =
      sstep(IT.k0, IT.k0 + 0.05, T) *
      (1 - sstep(IT.op0 + 0.05, IT.op0 + 0.38, T));
    const a = T - IT.imp;
    o.fl =
      a < -0.12 ? 0 : 0.92 * Math.exp(-Math.pow(a / (a < 0 ? 0.05 : 0.12), 2));
    o.gap = 5 * sstep(IT.imp, IT.imp + 0.08, T);
    o.edge =
      sstep(IT.imp, IT.imp + 0.1, T) *
      (1 - sstep(IT.op1 - 0.12, IT.op1 + 0.05, T));
    o.o = easeIO(clamp((T - IT.op0) / (IT.op1 - IT.op0), 0, 1));
    return o;
  }

  function renderIntro(T) {
    const st = introState(T),
      s = el.intro.style;
    const f = (n, v, u) =>
      s.setProperty(n, u ? v.toFixed(2) + u : v.toFixed(4));
    f("--la", st.la);
    f("--hs", st.hs);
    f("--wr", st.wr);
    f("--sw", st.sw);
    f("--fl", st.fl);
    f("--sl", st.sl);
    f("--edge", st.edge);
    f("--o", st.o);
    f("--gap", st.gap, "px");
    f("--tip", st.tip, "px");
    f("--ky", st.ky, "px");
    const cvOff = !INTRO.scene || T >= IT.sceneEnd + 0.01;
    el.intro.classList.toggle("nocv", cvOff);
    if (!cvOff && INTRO.chef) INTRO.chef.draw(Math.min(T, IT.sceneEnd));
    drawSparks(T);
    const so = 1 - sstep(IT.op0 - 0.1, IT.op0 + 0.1, T);
    el.introSkip.style.opacity = so.toFixed(3);
    el.introSkip.style.pointerEvents = so < 0.2 ? "none" : "";
    if (el.heroIn)
      el.heroIn.style.transform =
        "scale(" + (1.07 - 0.07 * st.o).toFixed(4) + ")";
    if (st.o > 0.26 && !INTRO.opened) openSite();
  }

  /* o site começa a entrar quando as portas já se afastaram um pouco */
  function openSite() {
    INTRO.opened = true;
    root.classList.add("go");
    $$(".hero-rv").forEach((n) => n.classList.add("in"));
    if (el.enso) el.enso.classList.add("drawn");
  }

  function introTick(now) {
    INTRO.raf = 0;
    if (INTRO.done) return;
    const raw = (now - INTRO.last) / 1000;
    INTRO.last = now;
    const dt = clamp(raw, 0.001, 0.1);
    if (
      INTRO.chef &&
      INTRO.T < IT.sceneEnd - 0.2 &&
      INTRO.T > 0.3 &&
      !(TEST && !qs.has("autolite")) &&
      fpsStep(INTRO.f, now)
    )
      introDegrade();
    let T = INTRO.T + dt * (INTRO.skipping ? 1.7 : 1);
    if (!INTRO.go && T >= IT.logo0 - 0.02) T = IT.logo0 - 0.02;
    INTRO.T = T;
    renderIntro(T);
    if (T >= IT.end) {
      finishIntro();
      return;
    }
    INTRO.raf = requestAnimationFrame(introTick);
  }

  /* a máquina não dá conta da cena: menos pixels, depois menos ainda e, por fim, vai direto para a logo */
  function introDegrade() {
    INTRO.lowSet++;
    if (INTRO.lowSet >= 3) {
      INTRO.scene = false;
      INTRO.chef = null;
      if (INTRO.T < IT.logo0 - 0.1) INTRO.T = IT.logo0 - 0.1;
      renderIntro(INTRO.T);
      return;
    }
    INTRO.chef.setLow(true);
    introSizeCanvases();
    INTRO.f.t0 = 0;
    INTRO.f.skip = 1;
  }

  function introSkip() {
    if (INTRO.done || INTRO.skipping) return;
    INTRO.skipping = true;
    INTRO.go = true;
    if (INTRO.T < IT.op0 - 0.04) INTRO.T = IT.op0 - 0.04;
  }

  function finishIntro() {
    if (INTRO.done) return;
    INTRO.done = true;
    if (INTRO.raf) cancelAnimationFrame(INTRO.raf);
    const hadFocus = el.intro && el.intro.contains(D.activeElement);
    root.classList.remove("is-intro");
    root.classList.add("go");
    if (el.heroIn) el.heroIn.style.transform = "";
    [el.main, el.hdr, el.foot].forEach((n) => {
      if (n) n.removeAttribute("inert");
    });
    $$(".hero-rv").forEach((n) => n.classList.add("in"));
    if (el.enso) el.enso.classList.add("drawn");
    S.phase = "live";
    S.introDone = true;
    W.removeEventListener("keydown", introKey);
    W.scrollTo(0, 0);
    measure();
    if (S.mode === "full") {
      S.y = 0;
      startLoop();
    }
    if (hadFocus && el.main) {
      el.main.setAttribute("tabindex", "-1");
      try {
        el.main.focus({ preventScroll: true });
      } catch (e) {
        /* sem problema */
      }
    }
    if (INTRO.chef) INTRO.chef = null;
    if (el.introCv) {
      el.introCv.width = 1;
      el.introCv.height = 1;
    }
    if (INTRO.fxg) {
      INTRO.fxg = null;
      el.introFx.width = 1;
      el.introFx.height = 1;
    }
    if (!TEST && S.liteMsg) toast(S.liteMsg);
  }
  function introKey(e) {
    if (e.key === "Escape") introSkip();
  }

  function startIntro() {
    const bypass =
      reduceMQ.matches || /nointro/.test(W.location.search + W.location.hash);
    if (!el.intro || !root.classList.contains("is-intro") || bypass) {
      finishIntro();
      return;
    }
    [el.main, el.hdr, el.foot].forEach((n) => {
      if (n) n.setAttribute("inert", "");
    });
    const lowEnd =
      !TEST &&
      ((navigator.deviceMemory && navigator.deviceMemory <= 2) ||
        (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2));
    INTRO.scene =
      INTRO_CHEF &&
      !(lowEnd || /lite/.test(W.location.hash)) &&
      typeof ChefScene !== "undefined" &&
      !!el.introCv;
    introGeom();
    if (INTRO.scene) {
      try {
        INTRO.chef = ChefScene.create(el.introCv, { low: NARROW() });
      } catch (err) {
        console.warn("[temaki] cena da abertura indisponível", err);
        INTRO.scene = false;
      }
    }
    INTRO.sparks = buildSparks();
    introSizeCanvases();
    INTRO.T = INTRO.scene ? 0 : IT.logo0 - INTRO_LEAD;
    el.introSkip.addEventListener("click", introSkip);
    W.addEventListener("keydown", introKey);
    try {
      el.introSkip.focus({ preventScroll: true });
    } catch (e) {
      /* sem problema */
    }
    const rel = () => {
      INTRO.go = true;
    };
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(rel, rel);
    setTimeout(rel, INTRO_FONT_WAIT);
    const fx = qs.get("t");
    if (!(TEST && fx !== null)) {
      setTimeout(() => {
        if (!INTRO.done && INTRO.T < IT.op0 - 0.1) introSkip();
      }, 11000);
      setTimeout(() => {
        if (!INTRO.done) {
          console.warn("[temaki] abertura demorou demais, abrindo o site");
          finishIntro();
        }
      }, 16000);
    }
    INTRO.started = true;
    if (TEST && fx !== null) {
      INTRO.fixed = +fx;
      INTRO.go = true;
      INTRO.T = INTRO.fixed;
      renderIntro(INTRO.fixed);
      W.__introSeek = (t) => {
        INTRO.T = t;
        renderIntro(t);
      };
      return;
    }
    renderIntro(INTRO.T);
    INTRO.last = performance.now();
    INTRO.raf = requestAnimationFrame(introTick);
  }

  /* ===== E · interface e início ===== */
  function initReveal() {
    const els = $$("[data-reveal]").filter(
      (n) => !n.classList.contains("hero-rv"),
    );
    if (!("IntersectionObserver" in W)) {
      els.forEach((n) => n.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((n) => io.observe(n));
  }

  function initCounters() {
    const cs = $$(".cnt");
    if (reduceMQ.matches || !("IntersectionObserver" in W)) return;
    cs.forEach((c) => {
      c.querySelector("b").textContent = "0";
    });
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((en) => {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          const b = en.target.querySelector("b"),
            end = +b.dataset.n,
            t0 = performance.now();
          (function f(t) {
            const p = Math.min(1, (t - t0) / 1200);
            b.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(f);
          })(t0);
        });
      },
      { threshold: 0.6 },
    );
    cs.forEach((c) => io.observe(c));
  }

  function initLightbox() {
    const lb = $("#lb"),
      lp = $("#lbph"),
      lc = $("#lbc"),
      sh = $$(".shot");
    let cur = 0;
    if (!lb || !lb.showModal) return;
    const show = (i) => {
      cur = (i + sh.length) % sh.length;
      const s = sh[cur];
      lp.className = "ph " + s.dataset.p;
      lp.setAttribute("role", "img");
      lp.setAttribute("aria-label", s.dataset.alt);
      lc.textContent = s.dataset.alt;
    };
    sh.forEach((s, i) =>
      s.addEventListener("click", () => {
        show(i);
        lb.showModal();
      }),
    );
    $("#lbx").addEventListener("click", () => lb.close());
    $("#lbp").addEventListener("click", () => show(cur - 1));
    $("#lbn").addEventListener("click", () => show(cur + 1));
    lb.addEventListener("click", (e) => {
      if (e.target === lb) lb.close();
    });
    lb.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") show(cur - 1);
      if (e.key === "ArrowRight") show(cur + 1);
    });
  }

  function initRail() {
    const rail = $("#rail-r");
    if (!rail) return;
    const go = (d) => {
      const c = rail.querySelector(".dep"),
        w = (c ? c.offsetWidth : 300) + 16,
        max = rail.scrollWidth - rail.clientWidth;
      let to = rail.scrollLeft + d * w;
      if (to > max + 4) to = 0;
      else if (to < -4) to = max;
      rail.scrollTo({
        left: to,
        behavior: reduceMQ.matches ? "auto" : "smooth",
      });
    };
    $("#pv").addEventListener("click", () => go(-1));
    $("#nx").addEventListener("click", () => go(1));
    /* sem rolagem horizontal (telas largas, onde cabem todas as avaliações), as setas somem */
    const arrows = $("#pv").parentNode;
    const fit = () => {
      arrows.hidden = rail.scrollWidth <= rail.clientWidth + 4;
    };
    fit();
    W.addEventListener("resize", fit);
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(fit, fit);
  }

  function initTheme() {
    const eff = () =>
      root.getAttribute("data-theme") ||
      (W.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const paint = () => {
      const d = eff() === "dark";
      el.themeIco.textContent = d ? "☀" : "☾";
      el.themeBtn.setAttribute("aria-pressed", String(d));
    };
    try {
      const sv = W.localStorage.getItem("temaki-tema");
      if (sv === "dark" || sv === "light") root.setAttribute("data-theme", sv);
    } catch (e) {
      /* sem armazenamento */
    }
    el.themeBtn.addEventListener("click", () => {
      const n = eff() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", n);
      try {
        W.localStorage.setItem("temaki-tema", n);
      } catch (e) {
        /* sem armazenamento */
      }
      paint();
    });
    paint();
  }

  function initOpenStatus() {
    try {
      const n = new Date(),
        d = n.getDay(),
        h = n.getHours(),
        open = d !== 0 && h >= 18 && h < 23;
      let t;
      if (d === 0) t = "Fechado hoje. Abrimos segunda às 18h.";
      else if (open) t = "Aberto agora, até as 23h.";
      else if (h < 18) t = "Abrimos hoje às 18h.";
      else
        t =
          d === 6
            ? "Fechado agora. Abrimos segunda às 18h."
            : "Fechado agora. Abrimos amanhã às 18h.";
      const e = $("#open");
      e.textContent = t;
      e.setAttribute("data-s", open ? "on" : "off");
      $$("#hrs li").forEach((li) => {
        if (li.getAttribute("data-d").split(",").indexOf(String(d)) > -1)
          li.classList.add("today");
      });
    } catch (err) {
      /* sem problema */
    }
  }

  /* pincelada do ensō: contorno com largura variável + máscara que a desenha ao longo do arco */
  function initEnso() {
    const brush = $("#ensoBrush"),
      arc = $("#ensoArc");
    if (!brush || !arc) return;
    const cx = 200,
      cy = 200,
      R0 = 140,
      a0 = -2.1,
      span = TAU * 0.93,
      n = 150;
    const hsh = (i) => {
      const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    const wAt = (u) =>
      36 * (0.3 + 0.7 * sstep(0, 0.26, u)) * (1 - 0.9 * sstep(0.66, 1, u));
    const rAt = (u) => R0 + 16 * u + 3 * Math.sin(u * 5.2 + 1);
    const outer = [],
      inner = [],
      mid = [];
    let len = 0,
      px = 0,
      py = 0;
    for (let i = 0; i <= n; i++) {
      const u = i / n,
        a = a0 + u * span,
        r = rAt(u),
        w = wAt(u),
        ca = Math.cos(a),
        sa = Math.sin(a);
      const jo = (hsh(i) - 0.5) * 2.2 * (0.4 + u),
        ji = (hsh(i + 400) - 0.5) * 3.2 * (0.4 + u);
      outer.push([cx + (r + w / 2 + jo) * ca, cy + (r + w / 2 + jo) * sa]);
      inner.push([cx + (r - w / 2 + ji) * ca, cy + (r - w / 2 + ji) * sa]);
      const mx = cx + r * ca,
        my = cy + r * sa;
      mid.push([mx, my]);
      if (i) len += Math.hypot(mx - px, my - py);
      px = mx;
      py = my;
    }
    const f = (p) => p[0].toFixed(1) + " " + p[1].toFixed(1);
    brush.setAttribute(
      "d",
      "M" +
        outer.map(f).join("L") +
        "L" +
        inner.reverse().map(f).join("L") +
        "Z",
    );
    arc.setAttribute("d", "M" + mid.map(f).join("L"));
    el.enso.style.setProperty("--L", Math.ceil(len) + 2);
  }

  function goTo(id) {
    let y;
    if (id === "topo") y = 0;
    else {
      const t = D.getElementById(id);
      if (!t) return false;
      y = topOf(t);
    }
    W.scrollTo({ top: y, behavior: reduceMQ.matches ? "auto" : "smooth" });
    return true;
  }

  let lastW = 0,
    lastH = 0;
  function bindUI() {
    el.modeBtn.addEventListener("click", () =>
      setMode(S.mode === "full" ? "lite" : "full"),
    );

    W.addEventListener(
      "pointermove",
      (e) => {
        S.px = e.clientX;
        S.py = e.clientY;
        if (e.pointerType === "touch") return;
        S.pt.x = (e.clientX / M.vw) * 2 - 1;
        S.pt.y = -((e.clientY / M.vh) * 2 - 1);
        S.ptAt = S.time;
      },
      { passive: true },
    );

    /* combos em vidro: inclinação e brilho seguem o ponteiro */
    el.plans.forEach((p) => {
      p.addEventListener("pointermove", (e) => {
        if (e.pointerType === "touch") return;
        const b = p.getBoundingClientRect(),
          x = (e.clientX - b.left) / b.width,
          y = (e.clientY - b.top) / b.height;
        if (S.mode === "full") {
          p.style.setProperty("--ry", ((x - 0.5) * 10).toFixed(2) + "deg");
          p.style.setProperty("--rx", (-(y - 0.5) * 8).toFixed(2) + "deg");
        }
        p.style.setProperty("--mx", (x * b.width).toFixed(0) + "px");
        p.style.setProperty("--my", (y * b.height).toFixed(0) + "px");
        p.style.setProperty("--hl", "1");
      });
      p.addEventListener("pointerleave", () => {
        if (FINE || S.mode === "lite") {
          p.style.setProperty("--rx", "0deg");
          p.style.setProperty("--ry", "0deg");
        }
        p.style.setProperty("--hl", "0");
      });
    });

    /* texto líquido */
    ["pointermove", "pointerenter"].forEach((ev) =>
      el.liq.addEventListener(ev, (e) => {
        if (S.mode !== "full") return;
        S.liqT = Math.min(
          46,
          S.liqT +
            Math.hypot(e.movementX || 0, e.movementY || 0) * 0.9 +
            (ev === "pointerenter" ? 18 : 0),
        );
      }),
    );

    /* âncoras internas: rolagem suave sem mexer na URL */
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href").slice(1);
        if (!id || id === "conteudo") return;
        if (goTo(id)) e.preventDefault();
      });
    });

    let rz = 0;
    W.addEventListener("resize", () => {
      clearTimeout(rz);
      rz = setTimeout(() => {
        const big =
          Math.abs(W.innerWidth - lastW) >= 2 ||
          Math.abs(W.innerHeight - lastH) >= 120;
        lastW = W.innerWidth;
        lastH = W.innerHeight;
        if (GLS.ok && S.mode === "full") resizeGL();
        if (big) {
          measure();
          chefResize();
        }
        if (!INTRO.done && INTRO.started) {
          introGeom();
          introSizeCanvases();
          if (INTRO.fixed !== null) renderIntro(INTRO.T);
        }
      }, 150);
    });
    W.addEventListener("load", () => {
      measure();
      chefResize();
    });
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(() => measure());
  }

  function boot() {
    grab();
    try {
      if ("scrollRestoration" in W.history)
        W.history.scrollRestoration = "manual";
    } catch (e) {
      /* sem problema */
    }
    W.scrollTo(0, 0);
    initReveal();
    initCounters();
    initLightbox();
    initRail();
    initTheme();
    initOpenStatus();
    initEnso();
    bindUI();
    const lowEnd =
      !TEST &&
      ((navigator.deviceMemory && navigator.deviceMemory <= 2) ||
        (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2));
    const forceLite = /lite/.test(W.location.hash);
    const shortVP = W.innerHeight < 480;
    const wantLite = reduceMQ.matches || forceLite || lowEnd || shortVP;
    const ok = !wantLite && initGL();
    lastW = W.innerWidth;
    lastH = W.innerHeight;
    S.liteMsg = "";
    if (ok) {
      applyMode("full");
      resizeGL();
    } else {
      applyMode("lite");
      if (!wantLite)
        S.liteMsg =
          "Gráficos 3D indisponíveis neste navegador. Mostrando o modo leve.";
      else if (reduceMQ.matches)
        S.liteMsg = "Movimento reduzido ativo: mostrando o modo leve.";
      else if (shortVP)
        S.liteMsg = "Tela baixa (celular deitado): mostrando o modo leve.";
      else if (lowEnd) S.liteMsg = "Aparelho simples: mostrando o modo leve.";
    }
    measure();
    S.y = 0;
    chefInit();
    startIntro();
    if (TEST)
      W.__tk = {
        S: S,
        M: M,
        GLS: GLS,
        LAY: LAY,
        INTRO: INTRO,
        CHEF: CHEF,
        setMode: setMode,
        measure: measure,
        storyTarget: storyTarget,
        chefAt: chefAt,
      };
  }

  try {
    boot();
  } catch (err) {
    console.error("[temaki] falha ao iniciar", err);
    root.classList.remove("is-intro", "pinned", "full");
    root.classList.add("lite", "no-gl", "go");
    $$("[inert]").forEach((n) => n.removeAttribute("inert"));
  }
})();
