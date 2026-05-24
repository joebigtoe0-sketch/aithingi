/* ============================================================
   avatars.jsx — MITOSIS figure renderer
   ============================================================ */

const AVATAR_TYPES = {
  central:   { label: "CENTRAL",   body: "#8a9b6e", shade: "#6f8761", accent: "#3a3228" },
  builder:   { label: "BUILDER",   body: "#8a9b6e", shade: "#6f8761", accent: "#3a3228" },
  voice:     { label: "VOICE",     body: "#bd8f95", shade: "#9a6c5d", accent: "#3a3228" },
  watcher:   { label: "WATCHER",   body: "#88a6b8", shade: "#5b7691", accent: "#3a3228" },
  art:       { label: "ART",       body: "#9b8fb0", shade: "#876783", accent: "#3a3228" },
  shill:     { label: "SHILL",     body: "#a3b07e", shade: "#6f8761", accent: "#3a3228" },
  comms:     { label: "COMMS",     body: "#c99aa6", shade: "#9a6c5d", accent: "#3a3228" },
  analytics: { label: "ANALYTICS", body: "#c79a52", shade: "#9a8146", accent: "#3a3228" },
  dispatch:  { label: "DISPATCH",  body: "#c99aa6", shade: "#6f6f6f", accent: "#3a3228" },
  dev:       { label: "DEV BRAIN", body: "#5fa898", shade: "#5f6f55", accent: "#3a3228" },
};
window.AVATAR_TYPES = AVATAR_TYPES;

const MITOSIS_ROLE = {
  builder: "builder",
  voice: "voice",
  watcher: "watcher",
  art: "artist",
  shill: "scout",
  comms: "messenger",
  analytics: "analyst",
  dev: "developer",
  dispatch: "messenger",
  central: null,
};

function agentNumber(agent) {
  if (agent.num != null && agent.num !== "") {
    const n = parseInt(String(agent.num).replace(/\D/g, ""), 10);
    if (n) return n;
  }
  const fromId = String(agent.id || "").match(/(\d+)/);
  return fromId ? parseInt(fromId[1], 10) : 1;
}

function figureSeed(agent, project) {
  if (agent.type === "dev" && project?.wallet) return project.wallet;
  if (agent.type === "dev" && project?.devId) return project.devId;
  return agent.id || String(agent.seed || agent.type || "agent");
}

function buildSvgForAgent(agent, project) {
  const M = window.MITOSIS;
  if (!M) return "";
  if (agent.type === "central") return M.buildCentralFigure();
  const num = agentNumber(agent);
  const seed = figureSeed(agent, project);
  const role = MITOSIS_ROLE[agent.type];
  if (role) return M.buildRoleFigure(role, num, seed);
  return M.buildFigureFromSeed(seed, { number: num, label: (agent.name || agent.type || "").split(" ")[0].toUpperCase() });
}

function MitosisSvg({ svg, width, height, fill }) {
  if (!svg) return null;
  const style = fill
    ? { width: "100%", height: "100%" }
    : { width, height: height ?? Math.round(width * (190 / 152)) };
  return (
    <div
      className="mitosis-figure"
      style={style}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function Avatar({ agent, size = 96, frame = true, label = false, project = null }) {
  if (!agent) return null;
  const svg = buildSvgForAgent(agent, project);
  const inner = frame
    ? <MitosisSvg svg={svg} fill />
    : <MitosisSvg svg={svg} width={size} height={size} />;
  const t = AVATAR_TYPES[agent.type] || AVATAR_TYPES.builder;
  const num = agent.type === "central" ? "000" : String(agentNumber(agent)).padStart(3, "0");
  return (
    <FigureFrame size={size} frame={frame} type={agent.type} num={num} label={label ? (agent.name || t.label) : null} tint={t.body}>
      {inner}
    </FigureFrame>
  );
}

function FigureFrame({ children, size, frame, type, num, label, tint }) {
  const t = AVATAR_TYPES[type] || AVATAR_TYPES.builder;
  const bg = tint || t.body;
  if (!frame) {
    return (
      <div style={{ width: size, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    );
  }
  return (
    <div className="figure-frame" style={{ width: size, "--fg-shade": t.shade }}>
      <div className="figure-inner" style={{ background: hexLight(bg) }}>
        {children}
        <div className="figure-num">#{num}</div>
      </div>
      {label && (
        <div className="figure-label">
          <span className="figure-type" style={{ color: t.shade }}>{t.label}</span>
          <span className="figure-name">{label}</span>
        </div>
      )}
    </div>
  );
}

function hexLight(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (c, w) => Math.round(c * 0.18 + w * 0.82);
  return `rgb(${mix(r, 245)}, ${mix(g, 239)}, ${mix(b, 224)})`;
}

function TokenGlyph({ project, size = 84, frame = true }) {
  const img = project?.tokenImage || project?.token_image;
  const innerSize = frame ? size - 8 : size;
  const inner = img
    ? <img src={img} alt="" className="token-glyph-img" />
    : <div className="token-glyph-placeholder muted tiny">no image</div>;
  if (!frame) {
    return (
      <div className="token-glyph-bare" style={{ width: innerSize, height: innerSize }}>
        {inner}
      </div>
    );
  }
  return (
    <div className="token-glyph" style={{ width: size }}>
      <div className="token-glyph-inner">
        {inner}
      </div>
    </div>
  );
}

window.Avatar = Avatar;
window.TokenGlyph = TokenGlyph;
window.buildSvgForAgent = buildSvgForAgent;
