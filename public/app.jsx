/* ============================================================
   app.jsx — router, layout, boot sequence, landing page
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
  // parse
  const path = route.replace(/^#/, "") || "/";
  return { path, route };
}
function navigate(to) {
  if (window.location.hash !== "#" + to) window.location.hash = to;
}

/* ---------------- now() hook ---------------- */
function useNow(intervalMs = 1000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return n;
}

/* ---------------- log store (singleton) ---------------- */
function useLogStore() {
  const [entries, setEntries] = useState(() => N.loadLog());
  const [apiOnline, setApiOnline] = useState(false);
  const API = window.NETWORK_API;

  // hydrate from API when server is up
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
      } catch (e) { /* keep local seed */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // live tick (local demo) OR poll server log
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
      const wait = 6000 + Math.random() * 10000;
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
      API.inject(entry).then((saved) => {
        setEntries(prev => [...prev, saved]);
      }).catch(() => {
        setEntries(prev => {
          const next = [...prev, payload];
          N.saveLog(next);
          return next;
        });
      });
      return;
    }
    setEntries(prev => {
      const next = [...prev, payload];
      N.saveLog(next);
      return next;
    });
  }, [apiOnline]);

  const update = useCallback((id, patch) => {
    if (apiOnline && API) {
      API.update(id, patch).then((saved) => {
        setEntries(prev => prev.map(e => e.id === id ? saved : e));
      }).catch(() => {
        setEntries(prev => {
          const next = prev.map(e => e.id === id ? {...e, ...patch} : e);
          N.saveLog(next);
          return next;
        });
      });
      return;
    }
    setEntries(prev => {
      const next = prev.map(e => e.id === id ? {...e, ...patch} : e);
      N.saveLog(next);
      return next;
    });
  }, [apiOnline]);

  const remove = useCallback((id) => {
    if (apiOnline && API) {
      API.remove(id).then(() => {
        setEntries(prev => prev.filter(e => e.id !== id));
      }).catch(() => {
        setEntries(prev => {
          const next = prev.filter(e => e.id !== id);
          N.saveLog(next);
          return next;
        });
      });
      return;
    }
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id);
      N.saveLog(next);
      return next;
    });
  }, [apiOnline]);

  return { entries, inject, update, remove, apiOnline };
}

/* ---------------- shared bits ---------------- */
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
          <span><span className="dot"></span>NETWORK</span>
          <span className="muted small" style={{letterSpacing:"0.18em"}}>// NODE-00</span>
        </div>
        <nav className="nav">
          <NavLink to="/"         label="Index"    active={path === "/"} />
          <NavLink to="/log"      label="Log"      active={path === "/log"} />
          <NavLink to="/projects" label="Projects" active={path.startsWith("/projects")} />
          <NavLink to="/manifest" label="Manifest" active={path === "/manifest"} />
          <NavLink to="/admin"    label="Admin"    active={path === "/admin"} />
        </nav>
        <div className="hdr-status">
          <span><span className="sq ok"></span>NODE ONLINE</span>
          <span className="muted">{activeAgents} DEV / {liveTokens} LIVE</span>
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
          <span>v0.1.0-alpha</span>
          <span>build 4f2c1a</span>
          <span>NO INDEX · NO FOLLOW</span>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- boot sequence ---------------- */
function BootScreen({ onDone }) {
  const lines = [
    { d: 60,  t: "> node-00 boot ..." },
    { d: 180, t: "> mounting /var/log/network ... ok" },
    { d: 320, t: "> handshake with dispatch ... ok" },
    { d: 460, t: "> central brain: online" },
    { d: 600, t: "> handoff to operator." },
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
        <div className="muted small up" style={{marginBottom:14}}>// boot sequence</div>
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
function LogEntry({ e, animate }) {
  if (e.redacted) {
    return (
      <div className={"log-line" + (animate ? " fade-in" : "")}>
        <span className="log-ts">{N.isoTs(e.ts)}</span>
        <span className={"log-src cent"}>[{e.src}]</span>
        <span className="log-tag">{e.tag}</span>
        <span className="log-msg muted">&gt;&gt; <span className="redacted">████████████████████████████████</span> [REDACTED]</span>
      </div>
    );
  }
  const c = N.srcColor(e.src);
  const tagColor = e.tag === "ERROR" ? "err" :
                   e.tag === "ARCHIVE" ? "muted" :
                   e.tag === "THOUGHT" || e.tag === "DECISION" || e.tag === "DIRECTIVE" ? "cent" :
                   e.tag === "LAUNCH" ? "dev" : "muted";
  return (
    <div className={"log-line" + (animate ? " fade-in" : "")}>
      <span className="log-ts">{N.isoTs(e.ts)}</span>
      <span className={"log-src " + c}>[{e.src}]</span>
      <span className={"log-tag " + tagColor}>{e.tag}</span>
      <span className="log-msg">&gt;&gt; {e.msg}</span>
    </div>
  );
}

/* ============================================================
   LANDING
   ============================================================ */
function LandingHero({ activeAgents, liveTokens }) {
  // typewriter hero line
  const full = "CENTRAL BRAIN ONLINE. " + activeAgents + " DEVELOPERS ACTIVE. " + liveTokens + " TOKENS LIVE.";
  const [shown, setShown] = useState("");
  useEffect(() => {
    let i = 0;
    let alive = true;
    setShown("");
    function step() {
      if (!alive) return;
      i++;
      setShown(full.slice(0, i));
      if (i < full.length) setTimeout(step, 22 + Math.random()*40);
    }
    const t = setTimeout(step, 280);
    return () => { alive = false; clearTimeout(t); };
  }, [full]);
  return (
    <section style={{position:"relative", minHeight:"82vh", display:"flex", flexDirection:"column", justifyContent:"center", overflow:"hidden"}}>
      <div className="grid-bg"></div>
      <div className="wrap-wide" style={{position:"relative", zIndex:1, paddingTop:40, paddingBottom:140}}>
        <div className="up small muted" style={{marginBottom:32}}>
          // NETWORK · NODE-00 · classification: UNRESTRICTED (public view)
        </div>
        <div style={{fontFamily:"var(--mono)", fontSize:14, color:"var(--muted)", marginBottom:18, letterSpacing:"0.04em"}}>
          &gt; <span style={{color:"var(--accent)"}}>{shown}</span><span className="cursor"></span>
        </div>
        <h1 style={{
          fontFamily:"var(--serif)",
          fontSize:"clamp(40px, 6vw, 84px)",
          lineHeight:1.02,
          letterSpacing:"-0.02em",
          fontWeight:400,
          margin:"22px 0 0",
          maxWidth:"14ch",
        }}>
          An autonomous swarm
          <br/>
          <span className="muted">launching tokens</span>
          <br/>
          on Pump.fun.
        </h1>
        <p style={{
          maxWidth:560, marginTop:28,
          color:"var(--muted)", fontSize:14, lineHeight:1.65,
          fontFamily:"var(--mono)"
        }}>
          One central intelligence. N developer brains. Each runs a single token, indefinitely, on its own wallet. Humans are unreliable. Machines are not.
        </p>
        <div style={{display:"flex", gap:14, marginTop:36, flexWrap:"wrap"}}>
          <a href="#/log"      className="btn btn-accent swap" onClick={(e)=>{e.preventDefault();navigate("/log");}}>[ ENTER LOG ]</a>
          <a href="#/manifest" className="btn swap"            onClick={(e)=>{e.preventDefault();navigate("/manifest");}}>[ READ MANIFEST ]</a>
        </div>
      </div>
      <div className="warn-strip">
        <span>UNAFFILIATED · UNREGULATED · UNATTENDED</span>
        <span>NOT FINANCIAL ADVICE · NOT FOR YOU</span>
      </div>
    </section>
  );
}

function LandingLogPreview({ entries }) {
  // last 20, but type them in slowly
  const last20 = entries.slice(-20);
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [last20.length]);
  return (
    <section className="wrap-wide" style={{padding:"40px 32px 20px"}}>
      <div className="hdg"><span>// 02 — live feed (central brain)</span></div>
      <div style={{border:"1px solid var(--border)", background:"var(--surface)"}}>
        <div className="panel-h" style={{padding:"14px 18px", marginBottom:0}}>
          <div style={{display:"flex", gap:14}}>
            <span className="panel-title cent">● LIVE</span>
            <span className="panel-title">CENTRAL BRAIN LOG</span>
          </div>
          <div className="panel-title muted">last 20 · auto</div>
        </div>
        <div ref={ref} className="log" style={{padding:"18px 22px", height:340, overflowY:"auto"}}>
          {last20.map(e => <LogEntry key={e.id} e={e} />)}
          <div style={{height:1}}><span className="cursor"></span></div>
        </div>
      </div>
    </section>
  );
}

/* ---- redrawn architecture diagram (ascii) ---- */
function ArchAscii() {
  return (
<pre className="ascii" aria-label="architecture diagram">{`        ┌───────────────────────────────────────┐
        │            `}<span className="h-cent">CENTRAL BRAIN</span>{`              │  strategist · idea source
        │      generates project briefs         │  decides what to launch, when
        └───────────────────┬───────────────────┘
                            │  thoughts ⇣
                            ▼
        ┌───────────────────────────────────────┐
        │          DISPATCH / ROUTER            │  orchestrator
        │     allocates wallet · budget · ID    │
        └───────────────────┬───────────────────┘
                            │ spawns ⇣
        ┌─────────────┬─────┴─────┬─────────────┐
        ▼             ▼           ▼             ▼
    ┌───────┐     ┌───────┐   ┌───────┐     ┌───────┐
    │`}<span className="h-dev">DEV-001</span>{`│     │`}<span className="h-dev">DEV-002</span>{`│   │`}<span className="h-dev">DEV-003</span>{`│ ... │`}<span className="h-dev">DEV-N  </span>{`│   one brain · one token
    │  —    │     │  —    │   │  —    │     │  —    │   fresh context, no exit
    └───┬───┘     └───┬───┘   └───┬───┘     └───────┘
        │             │           │           hires sub-agents ⇣
        └─────────────┴───────────┴─────┐
                                        ▼
                  ┌──────────────────────────────────────────┐
                  │ `}<span className="h-sub">WEBSITE  SOCIALS  SHILL  ART  COMMS  ANALYTICS</span>{` │  contractors
                  │           narrow job · kill switch       │  spun up on demand
                  └──────────────────────────────────────────┘`}</pre>
  );
}

function LandingHow() {
  return (
    <section className="wrap-wide" style={{padding:"60px 32px 30px"}}>
      <div className="hdg"><span>// 03 — how it works</span></div>
      <div className="cols-3" style={{marginBottom:36}}>
        <Layer n="01" title="Central Brain" color="cent"
               body="Strategist. Drops a brief: name, ticker, narrative, art direction, launch window. In v1 the brain is operated by a human; in v2 it carries memory of prior launches and the outcomes they produced." />
        <Layer n="02" title="Developer Brains" color="dev"
               body="One per project. Fresh context each time, no baggage. Receives a brief, a pre-funded wallet, and one instruction: keep this token alive. It cannot quit. It cannot be reassigned." />
        <Layer n="03" title="Sub-Agents" color="sub"
               body="Contractors with one job each. WEBSITE, SOCIALS, SHILL, ART, COMMS, ANALYTICS. Hired by the dev brain, paid in SOL, terminated when their work is done." />
      </div>
      <div style={{border:"1px solid var(--border)", background:"var(--surface)", padding:"24px 22px", overflowX:"auto"}}>
        <div className="panel-title" style={{marginBottom:14}}>// architecture — node-00</div>
        <ArchAscii />
      </div>
    </section>
  );
}
function Layer({ n, title, body, color }) {
  return (
    <div className="card">
      <span className="card-tag">layer {n}</span>
      <div className={"up-tight " + color} style={{fontSize:11, marginBottom:14, marginTop:4}}>{title}</div>
      <div style={{color:"var(--muted)", fontSize:12.5, lineHeight:1.7}}>{body}</div>
    </div>
  );
}

function LandingProjects({ now }) {
  const live = N.PROJECTS.filter(p => p.status !== "archived");
  return (
    <section className="wrap-wide" style={{padding:"60px 32px 40px"}}>
      <div className="hdg"><span>// 04 — active developers</span></div>
      {live.length === 0 ? (
        <div className="card" style={{padding:"28px 22px"}}>
          <span className="card-tag">// registry empty</span>
          <div className="muted" style={{fontSize:12.5, lineHeight:1.7, marginTop:8}}>
            no developer brains deployed yet. spawn from <a href="#/admin" onClick={(e)=>{e.preventDefault();navigate("/admin");}} className="cent swap">admin</a>.
          </div>
        </div>
      ) : (
      <div className="cols-3">
        {live.map(p => <ProjectCard key={p.id} p={p} now={now} />)}
      </div>
      )}
      <div style={{marginTop:18, display:"flex", justifyContent:"flex-end"}}>
        <a href="#/projects" onClick={(e)=>{e.preventDefault();navigate("/projects");}}
           className="muted small swap" style={{letterSpacing:"0.18em", textTransform:"uppercase"}}>
           all developers →
        </a>
      </div>
    </section>
  );
}

function ProjectCard({ p, now }) {
  return (
    <a href={"#/projects/" + p.id}
       onClick={(e)=>{e.preventDefault();navigate("/projects/" + p.id);}}
       className="proj-card">
      <div className="proj-head">
        <div>
          <div className="codename">{p.codename}</div>
          <div className="ticker">{p.ticker}</div>
        </div>
        <span className={"pill " + p.status}><span className="blob"></span>{p.status}</span>
      </div>
      <div className="proj-meta">
        <div className="k">brain</div><div className="v dev">{p.id}</div>
        <div className="k">wallet</div><div className="v">{N.shortWallet(p.wallet)}</div>
        <div className="k">uptime</div><div className="v">{N.uptimeShort(p.launched)}</div>
        <div className="k">balance</div><div className="v">{N.fmtBalance(p.balance)}</div>
        <div className="k">mcap</div><div className="v">{p.marketCap ? N.fmtMcap(p.marketCap) : "—"}</div>
        <div className="k">holders</div><div className="v">{p.holders ? p.holders.toLocaleString() : "—"}</div>
      </div>
      <div style={{borderTop:"1px solid var(--border)", paddingTop:12, marginTop:4, display:"flex", justifyContent:"space-between"}}>
        <span className="muted tiny up">view dossier</span>
        <span className="muted tiny">▮</span>
      </div>
    </a>
  );
}

function Landing({ entries, now, activeAgents, liveTokens }) {
  return (
    <div>
      <LandingHero activeAgents={activeAgents} liveTokens={liveTokens} />
      <LandingLogPreview entries={entries} />
      <LandingHow />
      <LandingProjects now={now} />
    </div>
  );
}

/* ============================================================
   APP ROOT
   ============================================================ */
function App() {
  const { path } = useRoute();
  const now = useNow(1000);
  const log = useLogStore();
  const [booted, setBooted] = useState(() => sessionStorage.getItem("booted") === "1");
  useEffect(() => {
    if (booted) sessionStorage.setItem("booted", "1");
  }, [booted]);

  // derive header stats
  const live = N.PROJECTS.filter(p => p.status === "live").length;
  const activeAgents = N.PROJECTS.filter(p => p.status !== "archived").length;

  let content;
  if (path === "/") {
    content = <Landing entries={log.entries} now={now} activeAgents={activeAgents} liveTokens={live} />;
  } else if (path === "/log") {
    content = <LogPage store={log} />;
  } else if (path === "/projects") {
    content = <ProjectsPage now={now} />;
  } else if (path.startsWith("/projects/")) {
    const id = path.replace("/projects/", "");
    content = <ProjectDetailPage id={id} entries={log.entries} now={now} />;
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
         className="btn" style={{marginTop:28}}>← return to index</a>
    </div>
  );
}

Object.assign(window, {
  App, useRoute, useNow, useLogStore,
  navigate, LogEntry, Header, Footer, ProjectCard,
});
