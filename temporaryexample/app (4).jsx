/* ============================================================
   app.jsx — router, header/footer, boot, BubbleMap landing
   ============================================================ */
const { useState, useEffect, useRef, useMemo, useCallback } = React;
const N = window.NETWORK;

/* ---------------- hash router ---------------- */
function useRoute() {
  const [route, setRoute] = useState(window.location.hash || "#/");
  useEffect(() => {
    const h = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  const path = route.replace(/^#/, "") || "/";
  return { path, route };
}
function navigate(to) {
  if (window.location.hash !== "#" + to) window.location.hash = to;
}

/* ---------------- now() ---------------- */
function useNow(intervalMs = 1000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return n;
}

/* ---------------- log store ---------------- */
function useLogStore() {
  const [entries, setEntries] = useState(() => N.loadLog());
  useEffect(() => {
    let alive = true;
    function schedule() {
      const wait = 5000 + Math.random() * 9000;
      setTimeout(() => {
        if (!alive) return;
        setEntries(prev => {
          const next = [...prev, N.genTickEntry()];
          N.saveLog(next);
          return next;
        });
        schedule();
      }, wait);
    }
    schedule();
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const h = (e) => {
      if (e.key && e.key.startsWith("network_log")) setEntries(N.loadLog());
    };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, []);
  const inject = useCallback((entry) => {
    setEntries(prev => {
      const next = [...prev, Object.assign({
        id: "INJ" + Date.now() + "-" + Math.floor(Math.random()*999),
        ts: Date.now(),
        public: true,
      }, entry)];
      N.saveLog(next);
      return next;
    });
  }, []);
  const update = useCallback((id, patch) => {
    setEntries(prev => {
      const next = prev.map(e => e.id === id ? {...e, ...patch} : e);
      N.saveLog(next);
      return next;
    });
  }, []);
  const remove = useCallback((id) => {
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id);
      N.saveLog(next);
      return next;
    });
  }, []);
  return { entries, inject, update, remove };
}

/* ---------------- header + nav ---------------- */
function NavLink({ to, label, active }) {
  return (
    <a
      href={"#" + to}
      className={active ? "active" : ""}
      onClick={(e) => { e.preventDefault(); navigate(to); }}
    >{label}</a>
  );
}

function Header({ path, activeAgents, liveTokens }) {
  return (
    <header className="hdr">
      <div className="wrap-wide hdr-inner">
        <div className="brand">
          <div className="brand-mark"><span className="dot"></span></div>
          <div>
            <div>NETWORK</div>
            <div className="brand-sub">OBSERVATION DECK · NODE-00</div>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/"         label="Map"      active={path === "/"} />
          <NavLink to="/console"  label="Console"  active={path === "/console"} />
          <NavLink to="/cast"     label="Cast"     active={path === "/cast"} />
          <NavLink to="/manifest" label="Manifest" active={path === "/manifest"} />
          <NavLink to="/admin"    label="Admin"    active={path === "/admin"} />
        </nav>
        <div className="hdr-status">
          <span><span className="sq ok"></span>STREAMING</span>
          <span className="muted">{activeAgents} DEV · {liveTokens} LIVE</span>
        </div>
      </div>
    </header>
  );
}

function Footer({ now }) {
  const dep = N.deployTs();
  return (
    <footer className="ftr">
      <div className="wrap-wide ftr-row">
        <div className="ftr-status">
          <span>NODE: <span style={{color:"var(--accent)"}}>ONLINE</span></span>
          <span>UPLINK: <span style={{color:"var(--accent)"}}>STABLE</span></span>
          <span>UPTIME: {N.uptimeShort(dep)}</span>
        </div>
        <div className="ftr-status">
          <span>NETWORK</span>
          <span>v0.1.0-alpha</span>
          <span>build 4f2c1a</span>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- boot ---------------- */
function BootScreen({ onDone }) {
  const lines = [
    { d: 60,  t: "> node-00 boot ..." },
    { d: 180, t: "> mounting /var/log/network ... ok" },
    { d: 320, t: "> handshake with dispatch ... ok" },
    { d: 460, t: "> central brain: online" },
    { d: 600, t: "> handoff. welcome to the observation deck." },
  ];
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timers = lines.map((l, i) => setTimeout(() => setShown(i + 1), l.d));
    const out = setTimeout(onDone, 820);
    return () => { timers.forEach(clearTimeout); clearTimeout(out); };
  }, []);
  return (
    <div className="boot">
      <div className="boot-inner">
        <div className="muted small up" style={{marginBottom:14, letterSpacing:"0.24em"}}>// boot sequence</div>
        {lines.slice(0, shown).map((l, i) => (
          <div key={i} className="boot-line" style={{color: i === shown-1 ? "var(--accent)" : "var(--text)"}}>
            {l.t}{i === shown-1 && <span className="cursor"></span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- log entry render ---------------- */
function LogEntry({ e, animate, withAvatar = true }) {
  const agent = N.srcAgent(e.src);
  const c = N.srcColor(e.src);
  const tagColor =
    e.tag === "ERROR"     ? "err" :
    e.tag === "RAISE"     ? "rose" :
    e.tag === "ARCHIVE"   ? "muted" :
    (e.tag === "THOUGHT" || e.tag === "DECISION" || e.tag === "DIRECTIVE") ? "cent" :
    e.tag === "LAUNCH"    ? "dev" :
    "muted";
  return (
    <div className={"log-line" + (animate ? " fade-in" : "")}>
      <span className="log-ts">{N.isoTs(e.ts)}</span>
      <span className={"log-src " + c} style={{display:"inline-flex", alignItems:"center", gap:8}}>
        {withAvatar && agent && (
          <span style={{width:18, height:18, display:"inline-flex"}}>
            <Avatar agent={agent} size={18} frame={false} />
          </span>
        )}
        [{e.src}]
      </span>
      <span className={"log-tag " + tagColor}>{e.tag}</span>
      <span className="log-msg">&gt;&gt; {e.msg}</span>
    </div>
  );
}

/* ============================================================
   BUBBLE MAP — landing
   ============================================================ */
function BubbleMap({ entries, now }) {
  // recent activity per source — for pulses
  const recentlyActive = useMemo(() => {
    const cutoff = Date.now() - 25000; // 25s
    const set = new Set();
    for (const e of entries) if (e.ts >= cutoff) set.add(e.src);
    return set;
  }, [entries, now]);

  // dimensions — stage is positioned absolute over .map-wrap.
  // we use percent-based coords so it's responsive.
  // center of stage is (50%, 50%).
  const tokens = N.PROJECTS;

  // Layout: place tokens on a circle around center, with arc-distance scaled.
  // Place each token's agents in a small arc on the outside of the token,
  // facing away from center.
  function tokenPos(i, n) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2; // start at top
    // radius is a vh-dependent value; compute via CSS calc cannot, so use %.
    const R = 32; // % of half min dimension
    return { x: 50 + Math.cos(angle) * R, y: 50 + Math.sin(angle) * R, angle };
  }
  function agentPos(parentAngle, j, total, parentX, parentY) {
    // arc of ±60 deg facing outward
    const arcWidth = Math.PI * 0.7;
    const start = parentAngle - arcWidth / 2;
    const step = total === 1 ? 0 : arcWidth / (total - 1);
    const a = total === 1 ? parentAngle : start + step * j;
    const r = 11; // % radius from parent token
    return {
      x: parentX + Math.cos(a) * r,
      y: parentY + Math.sin(a) * r,
    };
  }

  // Build edge points for svg
  const edges = [];
  const tokenCoords = tokens.map((p, i) => {
    const tp = tokenPos(i, tokens.length);
    edges.push({ x1: 50, y1: 50, x2: tp.x, y2: tp.y, type: "central" });
    for (let j = 0; j < p.agents.length; j++) {
      const ap = agentPos(tp.angle, j, p.agents.length, tp.x, tp.y);
      edges.push({ x1: tp.x, y1: tp.y, x2: ap.x, y2: ap.y, type: "agent", parentStatus: p.status });
      p.agents[j].__pos = ap; // stash for render
    }
    p.__pos = tp;
    return tp;
  });

  return (
    <div className="map-wrap">
      <div className="map-grid"></div>

      {/* overlays first — at desktop they're absolute, on narrow they stack above the stage */}
      <div className="map-overlay tl">
        <div className="overlay-h">// observation deck</div>
        <h1 className="welcome-h">An autonomous swarm launching tokens on Pump.fun — visible.</h1>
        <p className="welcome-p">
          One central intelligence at the center. N developer brains around it. Each brain runs one token and hires the agents it needs. Click any node to watch what it is thinking.
        </p>
        <div style={{display:"flex", gap:10, marginTop:14}}>
          <a className="btn btn-sm btn-accent swap" href="#/console"
             onClick={(e)=>{e.preventDefault();navigate("/console");}}>[ MASTER CONSOLE ]</a>
          <a className="btn btn-sm swap" href="#/manifest"
             onClick={(e)=>{e.preventDefault();navigate("/manifest");}}>[ MANIFEST ]</a>
        </div>
      </div>

      <div className="map-overlay tr">
        <div className="overlay-h">// legend</div>
        <div className="overlay-legend">
          <div className="row">
            <span className="legend-sw" style={{borderColor:"var(--accent)"}}></span>
            CENTRAL BRAIN
          </div>
          <div className="row">
            <span className="legend-sw" style={{background:"#3a2929"}}></span>
            TOKEN (one per dev brain)
          </div>
          <div className="row">
            <span className="legend-sw" style={{background:"var(--vintage-sage)"}}></span>
            BUILDER
          </div>
          <div className="row">
            <span className="legend-sw" style={{background:"var(--vintage-clay)"}}></span>
            VOICE
          </div>
          <div className="row">
            <span className="legend-sw" style={{background:"var(--vintage-blue)"}}></span>
            WATCHER
          </div>
          <div className="row">
            <span className="legend-sw" style={{background:"#b89bb1"}}></span>
            ART
          </div>
          <div className="row">
            <span className="legend-sw" style={{background:"#c8b072"}}></span>
            SHILL
          </div>
          <div className="row">
            <span className="legend-sw" style={{background:"#7c9c97"}}></span>
            ANALYTICS / COMMS
          </div>
        </div>
      </div>

      <div className="map-overlay br">
        <div className="overlay-h">// live feed · last 6</div>
        <div className="ticker-mini">
          {entries.slice(-6).map(e => (
            <div key={e.id} className="row">
              <span className="ts">{shortTime(e.ts)}</span>
              <span className={N.srcColor(e.src)} style={{flex:"0 0 90px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{e.src}</span>
              <span style={{flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{e.msg}</span>
            </div>
          ))}
        </div>
      </div>

      {/* canvas — edges + bubbles share coordinate space */}
      <div className="map-canvas">
        <svg className="map-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
          {edges.map((e, i) => (
            <line key={i}
                  x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  stroke={e.type === "central" ? "rgba(142,255,193,0.18)" : e.parentStatus === "degraded" ? "rgba(255,194,138,0.12)" : "rgba(255,255,255,0.08)"}
                  strokeWidth="0.12"
                  strokeDasharray={e.type === "agent" ? "0.6 0.6" : "0"} />
          ))}
        </svg>

        <div className="map-stage">
        {/* central */}
        <BubbleNode
          x={50} y={50} size={148}
          cls="central"
          to="/node/CENTRAL"
          inner={<Avatar agent={N.CENTRAL} size={140} frame={false} />}
          label="#000 · CENTRAL BRAIN"
          name=""
          active={recentlyActive.has("CENTRAL")}
        />

        {/* tokens */}
        {tokens.map((p, i) => {
          const tp = p.__pos;
          const tokenActive = recentlyActive.has(p.id) ||
                              p.agents.some(a => recentlyActive.has(a.id));
          return (
            <BubbleNode
              key={p.id}
              x={tp.x} y={tp.y} size={96}
              cls={"token " + p.status}
              to={"/node/" + p.id}
              inner={<TokenGlyph project={p} size={96} frame={false} />}
              label={p.ticker !== "—" ? p.ticker : p.codename}
              name={p.id}
              active={tokenActive}
              style={{animationDelay: (i * 0.6) + "s"}}
            />
          );
        })}

        {/* agents */}
        {tokens.flatMap(p => p.agents.map((a, j) => {
          const ap = a.__pos;
          return (
            <BubbleNode
              key={a.id}
              x={ap.x} y={ap.y} size={56}
              cls="agent"
              to={"/node/" + a.id}
              inner={<Avatar agent={a} size={56} frame={false} />}
              label={a.name}
              name=""
              active={recentlyActive.has(a.id)}
              style={{animationDelay: ((j + 1) * 0.4) + "s"}}
            />
          );
        }))}
        </div>
      </div>
    </div>
  );
}

function shortTime(ms) {
  const d = new Date(ms);
  return d.toISOString().slice(11, 19) + "Z";
}

function BubbleNode({ x, y, size, cls, inner, label, name, to, active, style }) {
  const mergedStyle = {
    left: x + "%",
    top:  y + "%",
    ...(style || {}),
  };
  return (
    <a href={"#" + to}
       onClick={(e)=>{e.preventDefault();navigate(to);}}
       className={"bubble " + cls + (active ? " active" : "")}
       style={mergedStyle}>
      <div className="b-disc" style={{width: size, height: size}}>
        {inner}
      </div>
      {label && <div className="b-label">{label}</div>}
      {name  && <div className="b-name">{name}</div>}
    </a>
  );
}

/* ============================================================
   APP ROOT
   ============================================================ */
function App() {
  const { path } = useRoute();
  const now = useNow(1000);
  const log = useLogStore();
  const [booted, setBooted] = useState(() => sessionStorage.getItem("booted_v3") === "1");
  useEffect(() => {
    if (booted) sessionStorage.setItem("booted_v3", "1");
  }, [booted]);

  const live = N.PROJECTS.filter(p => p.status === "live").length;
  const activeAgents = N.PROJECTS.filter(p => p.status !== "archived").length;

  let content;
  if (path === "/") {
    content = <BubbleMap entries={log.entries} now={now} />;
  } else if (path === "/console") {
    content = <ConsolePage store={log} />;
  } else if (path === "/cast") {
    content = <CastPage />;
  } else if (path.startsWith("/node/")) {
    const id = path.replace("/node/", "");
    content = <NodeDetailPage id={id} entries={log.entries} now={now} />;
  } else if (path === "/admin") {
    content = <AdminPage store={log} />;
  } else if (path === "/manifest") {
    content = <ManifestPage />;
  } else {
    content = <NotFound />;
  }

  return (
    <div className="page">
      {!booted && <BootScreen onDone={() => setBooted(true)} />}
      <Header path={path} activeAgents={activeAgents} liveTokens={live} />
      <main style={{flex:1}}>{content}</main>
      <Footer now={now} />
      <div className="breath" title="node-00 heartbeat">▮</div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="wrap" style={{padding:"80px 32px"}}>
      <div className="muted up small" style={{marginBottom:14}}>// 404</div>
      <div style={{fontFamily:"var(--serif)", fontSize:42}}>this path is not mapped.</div>
      <a href="#/" onClick={(e)=>{e.preventDefault();navigate("/");}}
         className="btn" style={{marginTop:28}}>← return to map</a>
    </div>
  );
}

Object.assign(window, {
  App, useRoute, useNow, useLogStore,
  navigate, LogEntry, Header, Footer, BubbleMap,
});
