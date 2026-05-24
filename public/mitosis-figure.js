/**
 * MITOSIS — agent figure generator (browser global: window.MITOSIS)
 */
(function (global) {
  const COLORS = {
    sage: "#8a9b6e", rose: "#bd8f95", blue: "#88a6b8", violet: "#9b8fb0",
    teal: "#5fa898", amber: "#c79a52", coral: "#cf7a5a", palegreen: "#a3b07e",
    gold: "#b8a86a", pink: "#c99aa6", clay: "#b08a4f", mauve: "#a98aa0",
  };
  const INK = "#3a3228";
  const EYEW = "#f4ecd8";
  const PUP = "#2b2620";
  const ACC = "#d8b25a";
  const LABEL = "#5a4d35";

  const BODIES = {
    teardrop: "M76 28 Q104 60 100 110 Q98 140 76 140 Q54 140 52 110 Q48 60 76 28 Z",
    wide: "M34 120 Q30 78 76 74 Q122 78 118 120 Q120 146 76 148 Q32 146 34 120 Z",
    block: "M48 50 Q48 40 60 40 L92 40 Q104 40 104 50 L104 132 Q104 144 92 144 L60 144 Q48 144 48 132 Z",
    amoeba: "M40 100 Q34 64 70 60 Q96 54 110 78 Q128 96 112 124 Q104 146 74 146 Q42 144 38 122 Q34 110 40 100 Z",
    pear: "M76 44 Q92 44 92 70 Q92 84 100 100 Q112 124 100 138 Q90 148 76 148 Q62 148 52 138 Q40 124 52 100 Q60 84 60 70 Q60 44 76 44 Z",
    spike: "M76 50 L86 70 L108 66 L96 86 L114 102 L92 106 L94 130 L76 118 L58 130 L60 106 L38 102 L56 86 L44 66 L66 70 Z",
    egg: "M76 32 Q112 40 112 96 Q112 142 76 144 Q40 142 40 96 Q40 40 76 32 Z",
    dome: "M40 130 Q40 60 76 56 Q112 60 112 130 Q112 146 76 146 Q40 146 40 130 Z",
  };
  const FACE_Y = { teardrop: 92, wide: 46, block: 75, amoeba: 96, pear: 84, spike: 95, egg: 88, dome: 96 };

  const round = (x, p, r) =>
    `<path d="M${x - r} ${p} Q${x} ${p + r + 3} ${x + r} ${p}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;

  function eyes(kind, cx, cy) {
    const o = (x, y, r = 7, pr = 3.2) =>
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${EYEW}" stroke="${INK}" stroke-width="2.5"/><circle cx="${x}" cy="${y + 2}" r="${pr}" fill="${PUP}"/>`;
    switch (kind) {
      case "one":
        return `<circle cx="${cx}" cy="${cy}" r="19" fill="${EYEW}" stroke="${INK}" stroke-width="3"/><circle cx="${cx}" cy="${cy + 1}" r="8" fill="${PUP}"/><circle cx="${cx + 4}" cy="${cy - 3}" r="2.6" fill="${EYEW}"/>`;
      case "two": return o(cx - 11, cy) + o(cx + 11, cy);
      case "wide": return o(cx - 15, cy) + o(cx + 15, cy);
      case "three": return o(cx - 13, cy - 3, 6) + o(cx + 10, cy - 5, 6) + o(cx + 12, cy + 13, 5, 2.6);
      case "square":
        return `<rect x="${cx - 16}" y="${cy - 5}" width="11" height="11" fill="${EYEW}" stroke="${INK}" stroke-width="2.5"/><rect x="${cx + 5}" y="${cy - 5}" width="11" height="11" fill="${EYEW}" stroke="${INK}" stroke-width="2.5"/>`;
      case "sleepy":
        return `<path d="M${cx - 15} ${cy} Q${cx - 9} ${cy - 6} ${cx - 3} ${cy}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/><path d="M${cx + 3} ${cy} Q${cx + 9} ${cy - 6} ${cx + 15} ${cy}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/><circle cx="${cx - 9}" cy="${cy + 4}" r="2.6" fill="${PUP}"/><circle cx="${cx + 9}" cy="${cy + 4}" r="2.6" fill="${PUP}"/>`;
      default: return o(cx - 11, cy) + o(cx + 11, cy);
    }
  }

  function mouth(kind, cx, my) {
    switch (kind) {
      case "smile": return round(cx, my, 13);
      case "flat": return `<path d="M${cx - 12} ${my} L${cx + 12} ${my}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
      case "o": return `<ellipse cx="${cx}" cy="${my + 2}" rx="8" ry="5.5" fill="${PUP}"/>`;
      case "tiny": return round(cx, my, 7);
      case "none": return "";
      default: return round(cx, my, 10);
    }
  }

  function limbs(kind, color) {
    switch (kind) {
      case "stubLegs":
        return `<line x1="64" y1="140" x2="62" y2="152" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><line x1="88" y1="140" x2="90" y2="152" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
      case "armsOut":
        return `<line x1="48" y1="92" x2="32" y2="102" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><line x1="104" y1="92" x2="120" y2="102" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
      case "ears":
        return `<path d="M60 56 Q50 44 58 40 Q66 42 66 56 Z" fill="${color}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M92 56 Q102 44 94 40 Q86 42 86 56 Z" fill="${color}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
      default: return "";
    }
  }

  const TELLS = {
    wrench: `<rect x="92" y="26" width="26" height="9" rx="2.5" transform="rotate(38 105 30)" fill="${COLORS.clay}" stroke="${INK}" stroke-width="2.5"/>`,
    speaker: `<path d="M104 30 Q120 24 120 40" fill="none" stroke="${ACC}" stroke-width="3" stroke-linecap="round"/><path d="M118 46 Q126 40 118 34" fill="none" stroke="${ACC}" stroke-width="2.5" stroke-linecap="round"/>`,
    brush: `<rect x="96" y="28" width="7" height="26" rx="2" transform="rotate(28 99 40)" fill="#7a5c30" stroke="${INK}" stroke-width="2"/><circle cx="108" cy="30" r="5" fill="#d4537e" stroke="${INK}" stroke-width="2"/>`,
    antenna: `<line x1="76" y1="14" x2="76" y2="2" stroke="${INK}" stroke-width="3"/><circle cx="76" cy="2" r="4" fill="${ACC}" stroke="${INK}" stroke-width="2"/>`,
    bars: `<g stroke="${INK}" stroke-width="2.5"><line x1="96" y1="42" x2="96" y2="34"/><line x1="103" y1="42" x2="103" y2="28"/><line x1="110" y1="42" x2="110" y2="22"/></g>`,
    shield: `<path d="M99 26 L111 30 Q111 44 99 50 Q87 44 87 30 Z" fill="${EYEW}" stroke="${INK}" stroke-width="2.5"/>`,
    magnifier: `<circle cx="102" cy="32" r="8" fill="none" stroke="${INK}" stroke-width="3"/><line x1="108" y1="38" x2="114" y2="44" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
    coin: `<circle cx="104" cy="34" r="9" fill="${ACC}" stroke="${INK}" stroke-width="2.5"/><text x="104" y="38" text-anchor="middle" fill="${LABEL}" font-family="monospace" font-size="10">$</text>`,
    plane: `<path d="M96 28 L116 34 L100 42 L100 50 L94 42 Z" fill="${EYEW}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
    none: "",
  };

  function buildFigure(t = {}) {
    const {
      body = "egg", color = "sage", eyes: eyeKind = "two", mouth: mouthKind = "smile",
      limbs: limbKind = "none", tell = "none",
    } = t;
    const fill = COLORS[color] || COLORS.sage;
    const fy = FACE_Y[body] ?? 88;
    const path = BODIES[body] || BODIES.egg;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 152 152" preserveAspectRatio="xMidYMid meet" role="img"><title>agent figure</title>` +
      `<ellipse cx="76" cy="150" rx="40" ry="7" fill="#000" opacity="0.22"/>` +
      limbs(limbKind, fill) +
      `<path d="${path}" fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>` +
      TELLS[tell] +
      eyes(eyeKind, 76, fy) +
      mouth(mouthKind, 76, fy + 26) +
      `</svg>`;
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  const pick = (arr, n) => arr[n % arr.length];

  const ROLE_PRESETS = {
    builder: { body: "block", color: "sage", eyes: "square", mouth: "flat", limbs: "armsOut", tell: "wrench" },
    voice: { body: "wide", color: "rose", eyes: "two", mouth: "o", limbs: "none", tell: "speaker" },
    watcher: { body: "teardrop", color: "blue", eyes: "one", mouth: "flat", limbs: "stubLegs", tell: "none" },
    artist: { body: "amoeba", color: "violet", eyes: "three", mouth: "smile", limbs: "none", tell: "brush" },
    developer: { body: "egg", color: "teal", eyes: "two", mouth: "smile", limbs: "none", tell: "antenna" },
    analyst: { body: "dome", color: "amber", eyes: "sleepy", mouth: "flat", limbs: "none", tell: "bars" },
    guard: { body: "pear", color: "coral", eyes: "two", mouth: "flat", limbs: "ears", tell: "shield" },
    scout: { body: "egg", color: "palegreen", eyes: "two", mouth: "smile", limbs: "none", tell: "magnifier" },
    banker: { body: "wide", color: "gold", eyes: "two", mouth: "smile", limbs: "none", tell: "coin" },
    messenger: { body: "pear", color: "pink", eyes: "two", mouth: "smile", limbs: "stubLegs", tell: "plane" },
  };

  function buildFigureFromSeed(seed, opts = {}) {
    const h = hash(String(seed));
    const traits = {
      body: pick(Object.keys(BODIES), h),
      color: pick(Object.keys(COLORS), h >> 3),
      eyes: pick(["one", "two", "wide", "three", "square", "sleepy"], h >> 6),
      mouth: pick(["smile", "flat", "o", "tiny"], h >> 9),
      limbs: pick(["none", "none", "stubLegs", "armsOut", "ears"], h >> 12),
      tell: pick(Object.keys(TELLS), h >> 15),
      ...opts,
    };
    return buildFigure(traits);
  }

  function buildRoleFigure(role, number, seed) {
    const base = ROLE_PRESETS[role] || ROLE_PRESETS.developer;
    const h = hash(String(seed ?? `${role}-${number}`));
    const eyeKind = pick([base.eyes, base.eyes, "two", "sleepy"], h);
    return buildFigure({ ...base, eyes: eyeKind });
  }

  /** Fixed #000 central brain — authored once, not seed-randomized. */
  function buildCentralFigure() {
    return buildFigure({
      body: "dome",
      color: "sage",
      eyes: "sleepy",
      mouth: "smile",
      limbs: "none",
      tell: "none",
    });
  }

  const TRAITS = {
    bodies: Object.keys(BODIES),
    colors: Object.keys(COLORS),
    tells: Object.keys(TELLS),
    eyes: ["one", "two", "wide", "three", "square", "sleepy"],
    mouths: ["smile", "flat", "o", "tiny", "none"],
    limbs: ["none", "stubLegs", "armsOut", "ears"],
  };

  global.MITOSIS = {
    buildFigure,
    buildFigureFromSeed,
    buildRoleFigure,
    buildCentralFigure,
    ROLE_PRESETS,
    TRAITS,
  };
})(typeof window !== "undefined" ? window : globalThis);
