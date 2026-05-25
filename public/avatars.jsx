/* ============================================================
   avatars.jsx — sprite sheet + token upload renderer
   ============================================================ */

const GRID_COLS = 5;
const GRID_CELLS = 25;
const CELL_W = 200;
const CELL_H = 190;
const SHEET_SIZE = 1000;
const CENTRAL_BRAIN_IMG = "/centralbrain.png";

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

const CONTRACTOR_CELL = {
  builder: 13,
  voice: 14,
  watcher: 15,
  art: 16,
  shill: 17,
  comms: 18,
  analytics: 19,
};

function wrapCell(n) {
  return ((n % GRID_CELLS) + GRID_CELLS) % GRID_CELLS;
}

function pairNumFromDevId(devId) {
  const m = String(devId || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

function agentNumber(agent) {
  if (agent.num != null && agent.num !== "") {
    const n = parseInt(String(agent.num).replace(/\D/g, ""), 10);
    if (n) return n;
  }
  const fromId = String(agent.id || "").match(/(\d+)/);
  return fromId ? parseInt(fromId[1], 10) : 1;
}

function gridCellIndex(agent, project) {
  if (!agent) return 0;
  if (agent.type === "dispatch") return 23;
  if (agent.type === "dev") {
    const n = project?.devId ? pairNumFromDevId(project.devId) : agentNumber(agent);
    return wrapCell(n - 1);
  }
  if (CONTRACTOR_CELL[agent.type] != null) return CONTRACTOR_CELL[agent.type];
  return wrapCell(agentNumber(agent) + 10);
}

function cellPosition(cellIndex) {
  const col = cellIndex % GRID_COLS;
  const row = Math.floor(cellIndex / GRID_COLS);
  return { col, row };
}

function CentralFigure({ size, fill }) {
  const style = fill
    ? { width: "100%", height: "100%" }
    : { width: size, height: size };
  return (
    <img
      src={CENTRAL_BRAIN_IMG}
      alt=""
      className="central-brain-img"
      style={style}
    />
  );
}

function MonsterSprite({ cellIndex, size, fill }) {
  const { col, row } = cellPosition(cellIndex);
  const displaySize = size || 96;
  const scale = displaySize / CELL_W;
  const style = {
    width: fill ? "100%" : displaySize,
    height: fill ? "100%" : displaySize,
    backgroundImage: "url(/gridimage.png)",
    backgroundRepeat: "no-repeat",
    backgroundSize: `${SHEET_SIZE * scale}px ${SHEET_SIZE * scale}px`,
    backgroundPosition: `${-col * CELL_W * scale}px ${-row * CELL_H * scale}px`,
  };

  return (
    <div
      className="monster-sprite"
      style={style}
      role="img"
      aria-label={"figure cell " + (cellIndex + 1)}
    />
  );
}

function Avatar({ agent, size = 96, frame = true, label = false, project = null }) {
  if (!agent) return null;
  const inner = agent.type === "central"
    ? (frame ? <CentralFigure fill size={size} /> : <CentralFigure size={size} />)
    : frame
      ? <MonsterSprite cellIndex={gridCellIndex(agent, project)} fill size={size} />
      : <MonsterSprite cellIndex={gridCellIndex(agent, project)} size={size} />;
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
      <div className="monster-sprite-wrap" style={{ width: size, height: size }}>
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
window.gridCellIndex = gridCellIndex;
