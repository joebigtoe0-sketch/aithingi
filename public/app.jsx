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

/* ---------------- log store (local + API) ---------------- */
function useLogStore() {
  const [entries, setEntries] = useState(() => N.loadLog());
  const [apiOnline, setApiOnline] = useState(false);
  const API = window.NETWORK_API;

  useEffect(() => {
    if (!API) return;
    let cancelled = false;
    (async () => {
      const cfg = await API.probe();
      if (cancelled || !cfg) return;
      setApiOnline(true);
      try {
        const data = await API.fetchLog();
        if (cancelled) return;
        if (data.deployTs) localStorage.setItem("network_deploy_ts", String(data.deployTs));
        setEntries(data.entries || []);
      } catch (e) { /* keep local */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (apiOnline && API) {
      const poll = setInterval(async () => {
        try {
          const data = await API.fetchLog();
          setEntries(data.entries || []);
        } catch (e) {}
      }, 12000);
      return () => clearInterval(poll);
    }
    let alive = true;
    function schedule() {
      const wait = 5000 + Math.random() * 9000;
      setTimeout(() => {
        if (!alive) return;
        setEntries(prev => {
          const tick = N.genTickEntry();
          if (!tick) return prev;
          const next = [...prev, tick];
          N.saveLog(next);
          return next;
        });
        schedule();
      }, wait);
    }
    schedule();
    return () => { alive = false; };
  }, [apiOnline]);

  useEffect(() => {
    if (apiOnline) return;
    const h = (e) => {
      if (e.key === "network_log_v3") setEntries(N.loadLog());
    };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, [apiOnline]);

  const inject = useCallback((entry) => {
    const payload = Object.assign({ id: "INJ" + Date.now(), ts: Date.now(), public: true }, entry);
    if (apiOnline && API) {
      API.inject(entry).then((saved) => setEntries(prev => [...prev, saved])).catch(() => {
        setEntries(prev => { const next = [...prev, payload]; N.saveLog(next); return next; });
      });
      return;
    }
    setEntries(prev => { const next = [...prev, payload]; N.saveLog(next); return next; });
  }, [apiOnline]);

  const update = useCallback((id, patch) => {
    if (apiOnline && API) {
      API.update(id, patch).then((saved) => setEntries(prev => prev.map(e => e.id === id ? saved : e))).catch(() => {
        setEntries(prev => { const next = prev.map(e => e.id === id ? {...e, ...patch} : e); N.saveLog(next); return next; });
      });
      return;
    }
    setEntries(prev => { const next = prev.map(e => e.id === id ? {...e, ...patch} : e); N.saveLog(next); return next; });
  }, [apiOnline]);

  const remove = useCallback((id) => {
    if (apiOnline && API) {
      API.remove(id).then(() => setEntries(prev => prev.filter(e => e.id !== id))).catch(() => {
        setEntries(prev => { const next = prev.filter(e => e.id !== id); N.saveLog(next); return next; });
      });
      return;
    }
    setEntries(prev => { const next = prev.filter(e => e.id !== id); N.saveLog(next); return next; });
  }, [apiOnline]);

  return { entries, inject, update, remove, apiOnline };
}

/* ---------------- projects store (map + cast + admin) ---------------- */
function useProjectsStore() {
  const [tick, setTick] = useState(0);
  const [apiOnline, setApiOnline] = useState(false);
  const [nextDev, setNextDev] = useState(() => N.nextDevNumberFrom(N.PROJECTS));
  const API = window.NETWORK_API;
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const applyList = useCallback((list, next) => {
    N.replaceProjects((list || []).map(N.normalizeProject));
    if (typeof next === "number") setNextDev(next);
    else setNextDev(N.nextDevNumberFrom(N.PROJECTS));
    bump();
  }, [bump]);

  useEffect(() => {
    const local = N.loadProjectsLocal();
    if (local?.length) applyList(local);
    if (!API) return;
    let cancelled = false;
    (async () => {
      const cfg = await API.probe();
      if (cancelled || !cfg) return;
      setApiOnline(true);
      try {
        const data = await API.fetchProjects();
        if (cancelled) return;
        applyList(data.projects, data.nextDev);
        N.saveProjectsLocal(N.PROJECTS);
      } catch (e) { /* keep local */ }
    })();
    return () => { cancelled = true; };
  }, [applyList]);

  useEffect(() => {
    if (!apiOnline || !API) return;
    const poll = setInterval(async () => {
      try {
        const data = await API.fetchProjects();
        applyList(data.projects, data.nextDev);
        N.saveProjectsLocal(N.PROJECTS);
      } catch (e) {}
    }, 15000);
    return () => clearInterval(poll);
  }, [apiOnline, applyList]);

  const spawn = useCallback(async (payload) => {
    if (apiOnline && API) {
      const data = await API.spawnProject(payload);
      const p = N.normalizeProject(data.project);
      const exists = N.PROJECTS.some((x) => x.tokenId === p.tokenId || x.devId === p.devId);
      if (!exists) N.PROJECTS.push(p);
      else N.replaceProjects(N.PROJECTS.map((x) =>
        (x.tokenId === p.tokenId || x.devId === p.devId) ? p : x
      ));
      setNextDev(data.nextDev ?? N.nextDevNumberFrom(N.PROJECTS));
      N.saveProjectsLocal(N.PROJECTS);
      bump();
      return p;
    }
    throw new Error("backend offline — run server to spawn projects");
  }, [apiOnline, bump]);

  const hireAgent = useCallback(async (projectKey, payload) => {
    if (apiOnline && API) {
      const data = await API.hireAgent(projectKey, payload);
      const p = N.normalizeProject(data.project);
      N.replaceProjects(N.PROJECTS.map((x) =>
        (x.tokenId === p.tokenId || x.devId === p.devId || x.id === p.id) ? p : x
      ));
      N.saveProjectsLocal(N.PROJECTS);
      bump();
      return data.agent;
    }
    throw new Error("backend offline — run server to hire agents");
  }, [apiOnline, bump]);

  const pad = String(nextDev).padStart(3, "0");
  const nextPairLabel = `TKN-${pad} + DEV-${pad}`;

  return { tick, spawn, hireAgent, nextDev, nextPairLabel, apiOnline };
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
            <div>$MITOSIS</div>
            <div className="brand-sub">OBSERVATION DECK · NODE-00</div>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/"         label="Map"      active={path === "/"} />
          <NavLink to="/console"  label="Console"  active={path === "/console"} />
          <NavLink to="/cast"     label="Cast"     active={path === "/cast"} />
          <NavLink to="/manifest" label="Manifest" active={path === "/manifest"} />
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
  const [platformCa, setPlatformCa] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const API = window.NETWORK_API;
    if (!API) return;
    const load = () => {
      const cfg = API.getConfig();
      if (cfg?.platformCa) setPlatformCa(cfg.platformCa);
      else API.probe().then((c) => setPlatformCa(c?.platformCa || ""));
    };
    load();
    const onUpdate = (e) => setPlatformCa(e.detail || "");
    window.addEventListener("platform-ca-updated", onUpdate);
    return () => window.removeEventListener("platform-ca-updated", onUpdate);
  }, []);

  async function copyCa() {
    if (!platformCa) return;
    try {
      await navigator.clipboard.writeText(platformCa);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (_) {
      /* ignore */
    }
  }

  const caLabel = platformCa
    ? platformCa.length > 16
      ? platformCa.slice(0, 6) + "…" + platformCa.slice(-4)
      : platformCa
    : "";

  return (
    <footer className="ftr">
      <div className="wrap-wide ftr-row">
        <div className="ftr-status">
          <span>NODE: <span style={{color:"var(--accent)"}}>ONLINE</span></span>
          <span>UPLINK: <span style={{color:"var(--accent)"}}>STABLE</span></span>
          <span>UPTIME: {N.uptimeShort(dep)}</span>
        </div>
        {platformCa ? (
          <button
            type="button"
            className="ftr-ca swap"
            onClick={copyCa}
            title={copied ? "Copied" : "Click to copy contract address"}
          >
            {copied ? "COPIED" : `CA · ${caLabel}`}
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        <div className="ftr-status">
          <span>$MITOSIS</span>
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
  const project = agent
    ? (agent.type === "dev" ? N.findProject(e.src) : N.projectOfAgent(agent.id))
    : null;
  const c = N.srcColor(e.src);
  const tagColor =
    e.tag === "ERROR"     ? "err" :
    e.tag === "RAISE"     ? "rose" :
    e.tag === "ARCHIVE"   ? "muted" :
    (e.tag === "THOUGHT" || e.tag === "DECISION" || e.tag === "DIRECTIVE") ? "cent" :
    e.tag === "LAUNCH"    ? "dev" :
    e.tag === "HIRE"      ? "dev" :
    e.tag === "BOOT" || e.tag === "PLAN" ? "dev" :
    "muted";
  return (
    <div className={"log-line" + (animate ? " fade-in" : "")}>
      <span className="log-ts">{N.isoTs(e.ts)}</span>
      <span className={"log-src " + c} style={{display:"inline-flex", alignItems:"center", gap:8}}>
        {withAvatar && agent && (
          <span style={{width:18, height:18, display:"inline-flex"}}>
            <Avatar agent={agent} size={18} frame={false} project={project} />
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
   BUBBLE MAP — landing (pan + zoom)
   ============================================================ */
const MAP_WORLD = 1600;
const MAP_ZOOM_MIN = 0.35;
const MAP_ZOOM_MAX = 2.75;

function clampMap(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function mapCenterPan(viewportEl, zoom) {
  if (!viewportEl) return { x: 0, y: 0 };
  const w = MAP_WORLD * zoom;
  const h = MAP_WORLD * zoom;
  return {
    x: (viewportEl.clientWidth - w) / 2,
    y: (viewportEl.clientHeight - h) / 2,
  };
}

function BubbleMap({ entries, now, projectsTick }) {
  const viewportRef = useRef(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);

  const recentlyActive = useMemo(() => {
    const cutoff = Date.now() - 25000;
    const set = new Set();
    for (const e of entries) if (e.ts >= cutoff) set.add(e.src);
    return set;
  }, [entries, now]);

  const tokens = N.PROJECTS.map(N.normalizeProject); // projectsTick forces re-render when list changes
  void projectsTick;

  const resetView = useCallback(() => {
    const vp = viewportRef.current;
    setZoom(1);
    setPan(mapCenterPan(vp, 1));
  }, []);

  useEffect(() => {
    resetView();
    const onResize = () => resetView();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resetView]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const vp = viewportRef.current;
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => {
      const nz = clampMap(z * factor, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
      setPan((p) => ({
        x: mx - ((mx - p.x) / z) * nz,
        y: my - ((my - p.y) / z) * nz,
      }));
      return nz;
    });
  }, []);

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    // only pan when grabbing empty map space — never steal clicks from nodes
    if (e.target.closest(".bubble, .map-overlay, button, a")) return;
    setDragging(true);
    dragRef.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pan]);

  const onPointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    setPan({ x: d.panX + dx, y: d.panY + dy });
  }, []);

  const onPointerUp = useCallback((e) => {
    setDragging(false);
    if (dragRef.current?.id === e.pointerId) dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
  }, []);

  // Layout: tokens on a ring around center; dev sits inward (toward center);
  // contractors fan outward on an arc so they never stack on the dev node.
  function tokenPos(i, n) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const R = 32;
    return { x: 50 + Math.cos(angle) * R, y: 50 + Math.sin(angle) * R, angle };
  }
  function devPos(parentAngle, tokenX, tokenY) {
    const r = 12;
    return {
      x: tokenX - Math.cos(parentAngle) * r,
      y: tokenY - Math.sin(parentAngle) * r,
    };
  }
  function agentPos(parentAngle, j, total, tokenX, tokenY) {
    const arcWidth = Math.min(Math.PI * 0.85, Math.PI * 0.4 * Math.max(total, 2));
    const outward = parentAngle;
    const start = outward - arcWidth / 2;
    const step = total <= 1 ? 0 : arcWidth / (total - 1);
    const a = total === 1 ? outward + 0.55 : start + step * j;
    const r = 14;
    return {
      x: tokenX + Math.cos(a) * r,
      y: tokenY + Math.sin(a) * r,
    };
  }

  const edges = [];
  tokens.forEach((p, i) => {
    const tp = tokenPos(i, tokens.length);
    const dp = devPos(tp.angle, tp.x, tp.y);
    p.__pos = tp;
    p.__devPos = dp;
    edges.push({ x1: 50, y1: 50, x2: tp.x, y2: tp.y, type: "central" });
    edges.push({ x1: tp.x, y1: tp.y, x2: dp.x, y2: dp.y, type: "dev", parentStatus: p.status });
    const agents = p.agents || [];
    for (let j = 0; j < agents.length; j++) {
      const ap = agentPos(tp.angle, j, agents.length, tp.x, tp.y);
      edges.push({ x1: tp.x, y1: tp.y, x2: ap.x, y2: ap.y, type: "agent", parentStatus: p.status });
      agents[j].__pos = ap;
    }
  });

  const worldStyle = {
    width: MAP_WORLD,
    height: MAP_WORLD,
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: "0 0",
  };

  return (
    <div className="map-wrap map-fullscreen">
      <div className="map-overlay tl">
        <div className="overlay-h">// observation deck</div>
        <h1 className="welcome-h">An autonomous swarm launching tokens on Pump.fun — visible.</h1>
        <p className="welcome-p">
          One central intelligence at the center. Developer brains spawn around it — each runs one token and hires the agents it needs. Click any node to watch what it is doing.
        </p>
        {tokens.length === 0 && (
          <p className="welcome-p" style={{color:"var(--accent-dim)", marginTop:8}}>
            No tokens live yet.
          </p>
        )}
        <div style={{display:"flex", gap:10, marginTop:14, flexWrap:"wrap"}}>
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

      <div className="map-overlay bl map-nav-hint">
        <span>scroll · zoom</span>
        <span>drag · pan</span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={resetView}>[ RESET VIEW ]</button>
        <span className="muted">{Math.round(zoom * 100)}%</span>
      </div>

      <div
        ref={viewportRef}
        className="map-viewport"
        onWheel={onWheel}
      >
        <div className="map-world" style={worldStyle}>
          <div className="map-grid"></div>
          <div
            className={"map-pan-surface" + (dragging ? " is-dragging" : "")}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={resetView}
          />
          <div className="map-canvas">
            <svg className="map-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
              {edges.map((e, i) => (
                <line key={i}
                      x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                      stroke={e.type === "central" ? "rgba(142,255,193,0.18)" : e.type === "dev" ? "rgba(142,255,193,0.1)" : e.parentStatus === "degraded" ? "rgba(255,194,138,0.12)" : "rgba(255,255,255,0.08)"}
                      strokeWidth="0.12"
                      strokeDasharray={e.type === "agent" ? "0.6 0.6" : "0"} />
              ))}
            </svg>

            <div className="map-stage">
              <BubbleNode
                x={50} y={50} size={148}
                cls="central"
                to="/node/CENTRAL"
                inner={<Avatar agent={N.CENTRAL} size={140} frame={false} />}
                label="#000 · CENTRAL BRAIN"
                name=""
                active={recentlyActive.has("CENTRAL")}
              />

              {tokens.map((p, i) => {
                const tp = p.__pos;
                const tid = p.tokenId || p.id;
                const tokenActive = recentlyActive.has(tid) || recentlyActive.has(p.devId) ||
                                    (p.agents || []).some(a => recentlyActive.has(a.id));
                return (
                  <BubbleNode
                    key={tid}
                    x={tp.x} y={tp.y} size={96}
                    cls={"token " + p.status}
                    to={"/node/" + tid}
                    inner={<TokenGlyph project={p} size={96} frame={false} />}
                    label={p.ticker !== "—" ? p.ticker : p.codename}
                    name={tid}
                    active={tokenActive}
                    style={{animationDelay: (i * 0.6) + "s"}}
                  />
                );
              })}

              {tokens.map((p, i) => {
                const dp = p.__devPos;
                const devId = p.devId;
                if (!dp || !devId) return null;
                const dev = N.devAgentFor(p);
                return (
                  <BubbleNode
                    key={devId}
                    x={dp.x} y={dp.y} size={72}
                    cls="dev"
                    to={"/node/" + devId}
                    inner={<Avatar agent={dev} size={72} frame={false} project={p} />}
                    label={devId}
                    name={p.codename}
                    active={recentlyActive.has(devId)}
                    style={{animationDelay: (i * 0.6 + 0.2) + "s"}}
                  />
                );
              })}

              {tokens.flatMap(p => (p.agents || []).map((a, j) => {
                const ap = a.__pos;
                return (
                  <BubbleNode
                    key={a.id}
                    x={ap.x} y={ap.y} size={56}
                    cls="agent"
                    to={"/node/" + a.id}
                    inner={<Avatar agent={a} size={56} frame={false} project={p} />}
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
       onClick={(e) => { e.preventDefault(); navigate(to); }}
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
  const projects = useProjectsStore();
  const [booted, setBooted] = useState(() => sessionStorage.getItem("booted_v3") === "1");
  useEffect(() => {
    if (booted) sessionStorage.setItem("booted_v3", "1");
  }, [booted]);
  useEffect(() => {
    if (path === "/log") navigate("/console");
    else if (path === "/projects") navigate("/cast");
    else if (path.startsWith("/projects/")) navigate("/node/" + path.replace("/projects/", ""));
  }, [path]);

  void projects.tick;
  const live = N.PROJECTS.filter(p => p.status === "live").length;
  const activeAgents = N.PROJECTS.filter(p => p.status !== "archived").length;

  let content;
  if (path === "/") {
    content = <BubbleMap entries={log.entries} now={now} projectsTick={projects.tick} />;
  } else if (path === "/console") {
    content = <ConsolePage store={log} projectsTick={projects.tick} />;
  } else if (path === "/cast") {
    content = <CastPage projectsTick={projects.tick} />;
  } else if (path.startsWith("/node/")) {
    const id = path.replace("/node/", "");
    content = <NodeDetailPage id={id} entries={log.entries} now={now} projects={projects} store={log} />;
  } else if (path === "/admin") {
    content = <AdminPage store={log} projects={projects} />;
  } else if (path === "/manifest") {
    content = <ManifestPage />;
  } else {
    content = <NotFound />;
  }

  const isMap = path === "/";

  return (
    <div className={"page" + (isMap ? " page--map" : "")}>
      {!booted && <BootScreen onDone={() => setBooted(true)} />}
      <Header path={path} activeAgents={activeAgents} liveTokens={live} />
      <main className={isMap ? "main--map" : ""} style={isMap ? undefined : {flex:1}}>{content}</main>
      {!isMap && <Footer now={now} />}
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
  App, useRoute, useNow, useLogStore, useProjectsStore,
  navigate, LogEntry, Header, Footer, BubbleMap,
});
