/* ============================================================
   avatars.jsx — collectible-figure avatar system
   parts-based SVG. each agent has:
     { id, num, type, name, seed }
   type drives palette + tell; seed drives variant (eye spacing,
   body squat, mouth shape, freckles).
   ============================================================ */

const AVATAR_TYPES = {
  central: {
    label: "CENTRAL",
    body: "#a7b59a",    // sage (sacred)
    shade: "#7d8d72",
    accent: "#f6efd8",  // halo / third eye
  },
  builder: {
    label: "BUILDER",
    body: "#9bb088",    // sage green
    shade: "#6f8761",
    accent: "#3e4a36",
  },
  voice: {
    label: "VOICE",
    body: "#c79584",    // clay / rose
    shade: "#9a6c5d",
    accent: "#3e2a25",
  },
  watcher: {
    label: "WATCHER",
    body: "#7e9bb6",    // dusty blue
    shade: "#5b7691",
    accent: "#1f2f3f",
  },
  art: {
    label: "ART",
    body: "#b89bb1",    // mauve
    shade: "#876783",
    accent: "#3a2937",
  },
  shill: {
    label: "SHILL",
    body: "#c8b072",    // mustard
    shade: "#9a8146",
    accent: "#3a2f17",
  },
  comms: {
    label: "COMMS",
    body: "#d4c5a5",    // bone / cream
    shade: "#a99875",
    accent: "#3a3122",
  },
  analytics: {
    label: "ANALYTICS",
    body: "#7c9c97",    // teal-gray
    shade: "#557672",
    accent: "#1f2e2c",
  },
  dispatch: {
    label: "DISPATCH",
    body: "#9c9c9c",
    shade: "#6f6f6f",
    accent: "#2a2a2a",
  },
  dev: {
    label: "DEV BRAIN",
    body: "#8a9a7a",
    shade: "#5f6f55",
    accent: "#2a3328",
  },
};
window.AVATAR_TYPES = AVATAR_TYPES;

/* small seeded RNG */
function rng(seed) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
}
function pickVariant(rand, opts) { return opts[Math.floor(rand() * opts.length)]; }

/* ---------------- Avatar ---------------- */
function Avatar({ agent, size = 96, frame = true, label = false, imageSrc = null }) {
  if (!agent) return null;
  const t = AVATAR_TYPES[agent.type] || AVATAR_TYPES.builder;
  const r = rng(agent.seed || 1);

  // body params
  const bodyRx = 30 + Math.floor(r() * 5); // 30..34
  const bodyRy = 30 + Math.floor(r() * 6); // 30..35
  const bodyCx = 50;
  const bodyCy = 55;

  // eye params
  const eyeSpacing = 7 + Math.floor(r() * 4); // 7..10
  const eyeY = bodyCy - 5 + Math.floor(r() * 3);
  const eyeR = 3 + Math.floor(r() * 2);
  const mouthShape = pickVariant(r, ["smile", "line", "dot", "o"]);
  const blush = r() > 0.55;

  // ---------- central brain — pre-rendered #000 asset ----------
  if (agent.type === "central") {
    return <CentralBrainFigure agent={agent} size={size} frame={frame} label={label} imageSrc={imageSrc || "/centralbrain.png"} />;
  }

  const customImg = imageSrc || agent.imageUrl;
  if (customImg) {
    return (
      <FigureFrame size={size} frame={frame} type={agent.type} num={agent.num} label={label ? agent.name : null}>
        <img src={customImg} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </FigureFrame>
    );
  }

  return (
    <FigureFrame size={size} frame={frame} type={agent.type} num={agent.num} label={label ? agent.name : null}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" style={{display:"block"}}>
        {/* ground shadow */}
        <ellipse cx={bodyCx} cy={88} rx={bodyRx - 6} ry="2.5" fill="#000" opacity="0.18" />

        {/* body */}
        <ellipse cx={bodyCx} cy={bodyCy} rx={bodyRx} ry={bodyRy} fill={t.body} stroke={t.accent} strokeWidth="2.4" />

        {/* belly shading */}
        <ellipse cx={bodyCx} cy={bodyCy + bodyRy * 0.45} rx={bodyRx * 0.6} ry={bodyRy * 0.25} fill={t.shade} opacity="0.45" />

        {/* type-specific tell (drawn behind/around face) */}
        <TypeTell type={agent.type} t={t} r={r} />

        {/* face */}
        <Eyes type={agent.type} cx={bodyCx} cy={eyeY} spacing={eyeSpacing} radius={eyeR} accent={t.accent} body={t.body} />
        <Mouth shape={mouthShape} cx={bodyCx} cy={eyeY + 9} accent={t.accent} />

        {blush && <>
          <ellipse cx={bodyCx - 13} cy={eyeY + 4} rx="3" ry="2" fill={t.shade} opacity="0.6" />
          <ellipse cx={bodyCx + 13} cy={eyeY + 4} rx="3" ry="2" fill={t.shade} opacity="0.6" />
        </>}

        {/* nubby feet */}
        <ellipse cx={bodyCx - 10} cy={86} rx="6" ry="3.6" fill={t.body} stroke={t.accent} strokeWidth="2" />
        <ellipse cx={bodyCx + 10} cy={86} rx="6" ry="3.6" fill={t.body} stroke={t.accent} strokeWidth="2" />
      </svg>
    </FigureFrame>
  );
}

/* eyes — watcher gets ONE oversized eye */
function Eyes({ type, cx, cy, spacing, radius, accent, body }) {
  if (type === "watcher") {
    return <g>
      <circle cx={cx} cy={cy} r={radius + 4} fill="#f6efd8" stroke={accent} strokeWidth="2" />
      <circle cx={cx + 1} cy={cy + 1} r={radius - 1} fill={accent} />
      <circle cx={cx + 2} cy={cy} r="1" fill="#fff" />
    </g>;
  }
  return <g>
    <circle cx={cx - spacing} cy={cy} r={radius} fill="#f6efd8" stroke={accent} strokeWidth="1.6" />
    <circle cx={cx + spacing} cy={cy} r={radius} fill="#f6efd8" stroke={accent} strokeWidth="1.6" />
    <circle cx={cx - spacing + 0.5} cy={cy + 0.5} r={radius * 0.45} fill={accent} />
    <circle cx={cx + spacing + 0.5} cy={cy + 0.5} r={radius * 0.45} fill={accent} />
  </g>;
}

function Mouth({ shape, cx, cy, accent }) {
  switch (shape) {
    case "smile":
      return <path d={`M ${cx-4} ${cy} Q ${cx} ${cy + 3} ${cx+4} ${cy}`} stroke={accent} strokeWidth="1.6" fill="none" strokeLinecap="round" />;
    case "line":
      return <line x1={cx-3} y1={cy} x2={cx+3} y2={cy} stroke={accent} strokeWidth="1.6" strokeLinecap="round" />;
    case "dot":
      return <circle cx={cx} cy={cy} r="1.2" fill={accent} />;
    case "o":
      return <ellipse cx={cx} cy={cy + 0.5} rx="2" ry="1.6" fill={accent} />;
  }
}

/* type-specific embellishment */
function TypeTell({ type, t, r }) {
  switch (type) {
    case "builder":
      // small wrench on side
      return <g transform="translate(74,58) rotate(28)">
        <rect x="-1.4" y="-9" width="2.8" height="10" fill={t.accent} />
        <circle cx="0" cy="-10" r="2.6" fill="none" stroke={t.accent} strokeWidth="1.4" />
      </g>;
    case "voice":
      // speaker arcs at right
      return <g transform="translate(76,55)" stroke={t.accent} strokeWidth="1.4" fill="none">
        <path d="M 0 -3 Q 4 0 0 3" />
        <path d="M 4 -5 Q 9 0 4 5" />
      </g>;
    case "watcher":
      return null; // single big eye is the tell
    case "art":
      // 3 paint dots
      return <g>
        <circle cx="74" cy="48" r="2.2" fill="#c79584" stroke={t.accent} strokeWidth="0.8" />
        <circle cx="79" cy="55" r="2.2" fill="#7e9bb6" stroke={t.accent} strokeWidth="0.8" />
        <circle cx="74" cy="62" r="2.2" fill="#c8b072" stroke={t.accent} strokeWidth="0.8" />
      </g>;
    case "shill":
      // megaphone
      return <g transform="translate(74,57)">
        <path d="M 0 -4 L 8 -7 L 8 7 L 0 4 Z" fill={t.body} stroke={t.accent} strokeWidth="1.4" />
        <line x1="10" y1="-8" x2="13" y2="-10" stroke={t.accent} strokeWidth="1.2" strokeLinecap="round" />
        <line x1="11" y1="0" x2="14" y2="0" stroke={t.accent} strokeWidth="1.2" strokeLinecap="round" />
        <line x1="10" y1="8" x2="13" y2="10" stroke={t.accent} strokeWidth="1.2" strokeLinecap="round" />
      </g>;
    case "comms":
      // brackets
      return <g stroke={t.accent} strokeWidth="1.5" fill="none">
        <path d="M 23 50 L 19 50 L 19 60 L 23 60" />
        <path d="M 77 50 L 81 50 L 81 60 L 77 60" />
      </g>;
    case "analytics":
      // bar chart
      return <g fill={t.accent}>
        <rect x="71" y="60" width="2.4" height="6" />
        <rect x="75" y="56" width="2.4" height="10" />
        <rect x="79" y="52" width="2.4" height="14" />
      </g>;
    case "dispatch":
      return <g stroke={t.accent} strokeWidth="1.4" fill="none">
        <path d="M 70 50 L 80 55 L 70 60" />
      </g>;
    default: return null;
  }
}

/* ============================================================
   #000 Central Brain — serene meditating deity figure
   ============================================================ */
function CentralBrainFigure({ agent, size, frame, label, imageSrc }) {
  const t = AVATAR_TYPES.central;
  if (imageSrc) {
    return (
      <FigureFrame size={size} frame={frame} type="central" num="000" label={label ? "CENTRAL BRAIN" : null}>
        <img
          src={imageSrc}
          alt="Central Brain #000"
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      </FigureFrame>
    );
  }
  return (
    <FigureFrame size={size} frame={frame} type="central" num="000" label={label ? "CENTRAL BRAIN" : null}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" style={{display:"block"}}>
        {/* halo rings (behind) */}
        <circle cx="50" cy="50" r="44" fill="none" stroke={t.accent} strokeWidth="0.6" opacity="0.5" />
        <circle cx="50" cy="50" r="38" fill="none" stroke={t.accent} strokeWidth="0.8" opacity="0.7" />

        {/* ground shadow / lotus pad */}
        <ellipse cx="50" cy="88" rx="22" ry="3" fill="#000" opacity="0.18" />
        <path d="M 28 86 Q 50 82 72 86 Q 65 90 50 90 Q 35 90 28 86 Z"
              fill={t.shade} opacity="0.55" />

        {/* lower body (slightly wider — lotus pose) */}
        <ellipse cx="50" cy="68" rx="32" ry="20" fill={t.body} stroke={t.accent} strokeWidth="2.4" />
        {/* upper body */}
        <ellipse cx="50" cy="48" rx="28" ry="24" fill={t.body} stroke={t.accent} strokeWidth="2.4" />

        {/* arms — multiple, like a deity (4 visible) */}
        {/* upper arms (raised, palms up) */}
        <path d="M 26 44 Q 18 36 22 28 Q 26 26 28 32 Q 27 38 32 42 Z" fill={t.body} stroke={t.accent} strokeWidth="2" />
        <path d="M 74 44 Q 82 36 78 28 Q 74 26 72 32 Q 73 38 68 42 Z" fill={t.body} stroke={t.accent} strokeWidth="2" />
        {/* lower arms (resting on lap, gesture down) */}
        <path d="M 24 58 Q 16 64 22 72 Q 30 70 34 64 Z" fill={t.body} stroke={t.accent} strokeWidth="2" />
        <path d="M 76 58 Q 84 64 78 72 Q 70 70 66 64 Z" fill={t.body} stroke={t.accent} strokeWidth="2" />

        {/* belly shading on lower body */}
        <ellipse cx="50" cy="76" rx="18" ry="7" fill={t.shade} opacity="0.4" />

        {/* serene half-closed eyes (arcs) */}
        <path d="M 38 45 Q 42 48 46 45" stroke={t.accent} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 54 45 Q 58 48 62 45" stroke={t.accent} strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* small lashes under */}
        <line x1="40" y1="46.5" x2="40" y2="47.5" stroke={t.accent} strokeWidth="1" />
        <line x1="44" y1="46.5" x2="44" y2="47.5" stroke={t.accent} strokeWidth="1" />
        <line x1="56" y1="46.5" x2="56" y2="47.5" stroke={t.accent} strokeWidth="1" />
        <line x1="60" y1="46.5" x2="60" y2="47.5" stroke={t.accent} strokeWidth="1" />

        {/* third eye — glowing dot */}
        <circle cx="50" cy="37" r="2.2" fill={t.accent} />
        <circle cx="50" cy="37" r="3.6" fill={t.accent} opacity="0.25" />

        {/* serene small mouth */}
        <path d="M 46 53 Q 50 55 54 53" stroke={t.accent} strokeWidth="1.6" fill="none" strokeLinecap="round" />

        {/* small markings on belly — a centered dot column */}
        <circle cx="50" cy="65" r="1" fill={t.accent} opacity="0.5" />
        <circle cx="50" cy="70" r="1" fill={t.accent} opacity="0.5" />
        <circle cx="50" cy="75" r="1" fill={t.accent} opacity="0.5" />
      </svg>
    </FigureFrame>
  );
}

/* ============================================================
   FigureFrame — the collectible-toy presentation wrapper
   ============================================================ */
function FigureFrame({ children, size, frame, type, num, label }) {
  const t = AVATAR_TYPES[type] || AVATAR_TYPES.builder;
  if (!frame) {
    return <div style={{width:size, height:size, position:"relative"}}>{children}</div>;
  }
  return (
    <div className="figure-frame" style={{ width: size, "--fg-shade": t.shade }}>
      <div className="figure-inner" style={{ background: hexLight(t.body) }}>
        {children}
        <div className="figure-num">#{num}</div>
      </div>
      {label && (
        <div className="figure-label">
          <span className="figure-type" style={{color:t.shade}}>{t.label}</span>
          <span className="figure-name">{label}</span>
        </div>
      )}
    </div>
  );
}

function hexLight(hex) {
  // create a much lighter, dusty tint of the body color for the figure card bg
  // strip leading #, parse
  const h = hex.replace("#","");
  const r = parseInt(h.slice(0,2),16);
  const g = parseInt(h.slice(2,4),16);
  const b = parseInt(h.slice(4,6),16);
  // mix 80% bone white (#f5efe0)
  const mix = (c, w) => Math.round(c * 0.18 + w * 0.82);
  return `rgb(${mix(r,245)}, ${mix(g,239)}, ${mix(b,224)})`;
}

/* ============================================================
   Token glyph — separate visual lane for the token itself
   subtle hatched square with codename + ticker
   ============================================================ */
function TokenGlyph({ project, size = 84, frame = true }) {
  const pid = project.tokenId || project.id;
  if (project.tokenImage) {
    const img = <img src={project.tokenImage} alt="" width={size} height={size}
      style={{ width: size, height: size, objectFit: "cover", display: "block", borderRadius: frame ? 0 : 4 }} />;
    if (!frame) return img;
    return (
      <div className="token-glyph" style={{ width: size }}>
        <div className="token-glyph-inner">{img}</div>
      </div>
    );
  }
  const seed = pid.charCodeAt(pid.length - 1) + (project.ticker || "").length;
  const tint = ["#3a2929","#2a3a3a","#3a3422","#2a2e3a","#3a2a36"][seed % 5];
  const stripe = ["#5a4040","#405a5a","#5a5236","#404a5a","#5a3f54"][seed % 5];
  if (!frame) {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <rect width="100" height="100" fill={tint} />
        <pattern id={`hatch-${pid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={stripe} strokeWidth="1" />
        </pattern>
        <rect width="100" height="100" fill={`url(#hatch-${pid})`} opacity="0.5" />
        <text x="50" y="48" textAnchor="middle" fill="#e6e6e6" fontFamily="JetBrains Mono, monospace" fontSize="9" letterSpacing="2">{project.codename.slice(0,8)}</text>
        <text x="50" y="62" textAnchor="middle" fill="#e6e6e6" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="600">{project.ticker}</text>
      </svg>
    );
  }
  return (
    <div className="token-glyph" style={{width: size}}>
      <div className="token-glyph-inner">
        <TokenGlyph project={project} size={size - 6} frame={false} />
      </div>
    </div>
  );
}

window.Avatar = Avatar;
window.TokenGlyph = TokenGlyph;
window.AVATAR_TYPES = AVATAR_TYPES;
