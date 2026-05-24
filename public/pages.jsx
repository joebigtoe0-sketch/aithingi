/* ============================================================
   pages.jsx — /console, /node/[id], /cast, /admin, /manifest
   ============================================================ */
const { useState: _us, useEffect: _ue, useRef: _ur, useMemo: _um } = React;
const NN = window.NETWORK;

/* ============================================================
   /console — master log
   ============================================================ */
function ConsolePage({ store, projectsTick }) {
  const all = store.entries.filter(e => e.public !== false);
  void projectsTick;

  // build filter list
  const sideChips = _um(() => {
    const list = [
      { id: "ALL", label: "ALL", group: "all" },
      { id: "CENTRAL", label: "CENTRAL BRAIN", group: "central" },
      { id: "DISPATCH", label: "DISPATCH", group: "dispatch" },
    ];
    NN.PROJECTS.forEach(p => {
      const n = NN.normalizeProject(p);
      list.push({ id: n.tokenId, label: `${n.tokenId} · ${n.codename}`, group: "dev" });
      list.push({ id: n.devId, label: `${n.devId} · brain`, group: "dev" });
    });
    list.push({ id: "SUB-AGENTS", label: "ALL SUB-AGENTS", group: "sub" });
    return list;
  }, [projectsTick]);

  const [active, setActive] = _us("ALL");
  const filtered = active === "ALL" ? all :
                   active === "SUB-AGENTS" ? all.filter(e => !["CENTRAL","DISPATCH"].includes(e.src) && !e.src.startsWith("DEV-")) :
                   all.filter(e => e.src === active);

  const streamRef = _ur(null);
  const [stuck, setStuck] = _us(true);
  _ue(() => {
    if (!streamRef.current) return;
    if (stuck) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [filtered.length, stuck]);
  function onScroll(e) {
    const el = e.target;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setStuck(atBottom);
  }
  function jump() {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
    setStuck(true);
  }

  // counts
  const counts = _um(() => {
    const c = { ALL: all.length, "SUB-AGENTS": 0 };
    all.forEach(e => {
      c[e.src] = (c[e.src] || 0) + 1;
      if (!["CENTRAL","DISPATCH"].includes(e.src) && !e.src.startsWith("DEV-")) c["SUB-AGENTS"]++;
    });
    return c;
  }, [all]);

  const lastThought = _um(() => {
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].src === "CENTRAL" && all[i].tag === "THOUGHT") return all[i].ts;
    }
    return null;
  }, [all]);
  const lastRaise = _um(() => {
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].tag === "RAISE") return all[i];
    }
    return null;
  }, [all]);
  const dep = NN.deployTs();
  const activeAgents = NN.PROJECTS.filter(p => p.status !== "archived").length;

  return (
    <div className="wrap-wide" style={{padding:"24px 32px 40px"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:16, flexWrap:"wrap", gap:10}}>
        <div>
          <div className="muted small up" style={{letterSpacing:"0.24em", marginBottom:6}}>// master console</div>
          <div style={{fontFamily:"var(--serif)", fontSize:30, lineHeight:1.1}}>Everything the system is doing, in one stream.</div>
        </div>
        <div style={{display:"flex", gap:18, alignItems:"center"}}>
          <span className="pill live"><span className="blob"></span>STREAMING</span>
          <span className="muted small up">{all.length} entries</span>
        </div>
      </div>

      <div className="console-shell">
        {/* sources */}
        <aside className="console-side">
          <div className="side-h">// sources</div>
          <div className="side-chips">
            {sideChips.map(s => (
              <div key={s.id}
                   className={"side-chip" + (active === s.id ? " on" : "")}
                   onClick={() => setActive(s.id)}>
                <span style={{display:"flex", gap:8, alignItems:"center"}}>
                  {s.group === "dev" ? (
                    <span style={{width:14, height:14}}>
                      <Avatar agent={{id:s.id, type:"builder", num:"", seed: s.id.charCodeAt(s.id.length-1)}} size={14} frame={false} />
                    </span>
                  ) : (
                    <span className={NN.srcColor(s.id === "ALL" ? "" : s.id)} style={{width:6}}>
                      {s.id === "ALL" ? "•" : s.id === "CENTRAL" ? "●" : s.id === "DISPATCH" ? "◇" : "▸"}
                    </span>
                  )}
                  {s.label}
                </span>
                <span className="count">{counts[s.id] || 0}</span>
              </div>
            ))}
          </div>
          <div className="side-h" style={{marginTop:22}}>// tags</div>
          <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
            {["THOUGHT","DECISION","DIRECTIVE","PLAN","OBSERVATION","TX","POST","RAISE","ERROR","ARCHIVE","LAUNCH","BOOT","ACK","HIRE"].map(t => (
              <span key={t} className="chip chip-static" style={{padding:"5px 8px", fontSize:9}}>{t}</span>
            ))}
          </div>
          <div className="side-h" style={{marginTop:22}}>// notes</div>
          <div className="muted small" style={{fontSize:11, lineHeight:1.65}}>
            Newest at the bottom. Stream pauses when you scroll up. <span style={{color:"var(--rose)"}}>RAISE</span> = agent asked for a human.
          </div>
        </aside>

        {/* stream */}
        <div className="console-stream" ref={streamRef} onScroll={onScroll}>
          <div className="log">
            {filtered.map(e => <LogEntry key={e.id} e={e} />)}
            <div style={{height:8, display:"flex", alignItems:"center"}}>
              <span className="muted small">end of stream</span>
              <span className="cursor"></span>
            </div>
          </div>
          {!stuck && (
            <button className="jump-pill" onClick={jump}>↓ JUMP TO LIVE</button>
          )}
        </div>

        {/* meta */}
        <aside className="console-side right">
          <div className="side-h">// state</div>
          <div className="meta-box">
            <div className="meta-label">node uptime</div>
            <div className="meta-num">{NN.uptimeShort(dep)}</div>
          </div>
          <div className="meta-box">
            <div className="meta-label">active developers</div>
            <div className="meta-num dev">{activeAgents}</div>
          </div>
          <div className="meta-box">
            <div className="meta-label">total entries</div>
            <div className="meta-num">{all.length}</div>
          </div>
          <div className="meta-box">
            <div className="meta-label">last thought</div>
            <div style={{fontSize:11, color:"var(--accent)", letterSpacing:"0.04em"}}>
              {lastThought ? NN.isoTs(lastThought) : "—"}
            </div>
          </div>
          {lastRaise && (
            <div className="meta-box" style={{borderColor:"rgba(255,180,168,0.3)"}}>
              <div className="meta-label rose">last raise — needs human</div>
              <div style={{fontSize:11, lineHeight:1.6}}>
                <div className="sub">{lastRaise.src}</div>
                <div className="muted" style={{marginTop:4}}>{lastRaise.msg}</div>
              </div>
            </div>
          )}
          <div className="side-h" style={{marginTop:18}}>// legend</div>
          <div style={{fontSize:10, lineHeight:1.9, color:"var(--muted)"}}>
            <div><span className="cent">●</span> CENTRAL — strategist</div>
            <div><span className="dev">■</span> DEV-XXX — token brain</div>
            <div><span className="sub">▸</span> SUB-AGENT — contractor</div>
            <div><span className="rose">↑</span> RAISE — need human</div>
            <div><span className="err">×</span> ERROR — investigate</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ============================================================
   /cast — full roster of figures
   ============================================================ */
function CastPage({ projectsTick }) {
  void projectsTick;
  return (
    <div className="wrap" style={{padding:"40px 32px 60px"}}>
      <div className="muted small up" style={{letterSpacing:"0.24em", marginBottom:6}}>// generated cast</div>
      <div style={{fontFamily:"var(--serif)", fontSize:38, lineHeight:1.05, marginBottom:10}}>
        Every agent the system spawns gets a figure.
      </div>
      <p style={{maxWidth:620, color:"var(--muted)", fontSize:13.5, lineHeight:1.7}}>
        Each developer brain and each contractor it hires is rendered as a small numbered figure. Type drives color and a job-tell. The set grows whenever a thought becomes a token.
      </p>

      {/* central + dispatch */}
      <div style={{marginTop:34}}>
        <div className="hdg"><span>// the parent — #000</span></div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:16, maxWidth:760}}>
          <Avatar agent={NN.CENTRAL} size={150} label={true} />
          <Avatar agent={NN.DISPATCH} size={150} label={true} />
        </div>
      </div>

      {NN.PROJECTS.filter(p => p.status !== "archived").map(p => (
        <div key={p.id} style={{marginTop:40}}>
          <div className="hdg" style={{display:"flex", justifyContent:"space-between"}}>
            <span>// {p.tokenId || p.id} · {p.codename} — {(p.agents || []).length} contractor{(p.agents || []).length === 1 ? "" : "s"}</span>
            <a href={"#/node/" + (p.tokenId || p.id)}
               onClick={(e)=>{e.preventDefault();window.navigate("/node/" + (p.tokenId || p.id));}}
               className="muted small swap" style={{letterSpacing:"0.18em", textTransform:"uppercase"}}>
              dossier →
            </a>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))", gap:16}}>
            <a href={"#/node/" + (p.tokenId || p.id)}
               onClick={(e)=>{e.preventDefault();window.navigate("/node/" + (p.tokenId || p.id));}}
               style={{textDecoration:"none"}}>
              <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:8}}>
                <TokenGlyph project={p} size={150} frame={true} />
                <div className="muted small up" style={{letterSpacing:"0.16em"}}>{p.tokenId || p.id} · token</div>
              </div>
            </a>
            <a href={"#/node/" + p.devId}
               onClick={(e)=>{e.preventDefault();window.navigate("/node/" + p.devId);}}
               style={{textDecoration:"none"}}>
              <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:8}}>
                <Avatar agent={NN.devAgentFor(p)} size={150} label={true} project={p} />
                <div className="muted small up" style={{letterSpacing:"0.16em"}}>{p.devId} · brain</div>
              </div>
            </a>
            {(p.agents || []).map(a => (
              <a key={a.id} href={"#/node/" + a.id}
                 onClick={(e)=>{e.preventDefault();window.navigate("/node/" + a.id);}}>
                  <Avatar agent={a} size={150} label={true} project={p} />
              </a>
            ))}
          </div>
          {(p.agents || []).length === 0 && (
            <div className="muted small" style={{marginTop:10}}>no contractors hired yet — developer brain only.</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   /node/[id] — entity detail (brain / token / agent)
   ============================================================ */
function useIsAdmin() {
  return sessionStorage.getItem("admin_ok") === "1" &&
    !!sessionStorage.getItem(window.NETWORK_API?.TOKEN_KEY || "network_admin_token");
}

function useLiveProject(project, projectsTick) {
  const [live, setLive] = _us(() => NN.normalizeProject(project));
  void projectsTick;
  _ue(() => { setLive(NN.normalizeProject(project)); }, [project, projectsTick]);

  _ue(() => {
    const key = live.tokenId || live.id;
    if (!key || !window.NETWORK_API?.isOnline()) return;
    let cancelled = false;
    async function pull() {
      try {
        const data = await window.NETWORK_API.refreshProjectMetrics(key);
        if (!cancelled && data.project) setLive(NN.normalizeProject(data.project));
      } catch (e) { /* keep last */ }
    }
    pull();
    const t = setInterval(pull, 45000);
    return () => { cancelled = true; clearInterval(t); };
  }, [live.tokenId, live.devId]);

  return live;
}

function metricSpark(seedValue, scale) {
  const arr = [];
  let v = (seedValue || 1) * (scale || 0.5) * 0.3 + 0.1;
  for (let i = 0; i < 40; i++) {
    v = Math.max(v * 0.02, v + (Math.random() - 0.48) * v * 0.12);
    arr.push(v);
  }
  arr[arr.length - 1] = seedValue || 0;
  return arr;
}

function MetricHero({ tag, value, sub, spark, color }) {
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <span className="card-tag">{tag}</span>
      <div style={{ fontSize: 28, fontVariantNumeric: "tabular-nums", marginTop: 4 }}>{value}</div>
      {sub && <div className="muted small" style={{ marginTop: 6, lineHeight: 1.5 }}>{sub}</div>}
      <div className="muted small" style={{ marginTop: 8, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        live · refreshes ~45s
      </div>
      <Sparkline data={spark} color={color || "var(--accent)"} />
    </div>
  );
}

function NodeDetailPage({ id, entries, now, projects, store }) {
  if (id === "CENTRAL") return <CentralNodeDetail entries={entries} />;
  if (id === "DISPATCH") return <DispatchNodeDetail entries={entries} />;
  const p = NN.findProject(id);
  if (p) {
    const k = id.toUpperCase();
    if (k.startsWith("TKN-") || k === (p.tokenId || "").toUpperCase()) {
      return <TokenNodeDetail project={p} entries={entries} projects={projects} />;
    }
    return <DevNodeDetail project={p} entries={entries} projects={projects} store={store} />;
  }
  const agent = NN.findAgent(id);
  if (agent) return <AgentNodeDetail agent={agent} entries={entries} store={store} />;
  return (
    <div className="wrap" style={{padding:"60px 32px"}}>
      <div className="muted up small">// not found</div>
      <div style={{fontFamily:"var(--serif)", fontSize:36, margin:"10px 0 20px"}}>no such node.</div>
      <a className="btn" href="#/" onClick={(e)=>{e.preventDefault();window.navigate("/");}}>← back to map</a>
    </div>
  );
}

function CentralNodeDetail({ entries }) {
  const own = entries.filter(e => e.src === "CENTRAL");
  return (
    <div className="wrap" style={{padding:"30px 32px 60px"}}>
      <BackLink />
      <div className="node-hero">
        <Avatar agent={NN.CENTRAL} size={160} frame={true} label={false} />
        <div>
          <div className="sub">// node-00 · figure #000</div>
          <div className="name">Central Brain</div>
          <div className="muted small" style={{marginTop:14, maxWidth:520, fontFamily:"var(--serif)", fontSize:16, lineHeight:1.6, color:"var(--text)"}}>
            The origin. Decides what to launch and when. Spawns developer brains and routes them through dispatch. In v0.1.0-alpha, a human is sitting where the central brain will eventually sit.
          </div>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:22, marginTop:30}}>
        <div className="card">
          <span className="card-tag">parameters</span>
          <dl className="kv" style={{marginTop:4}}>
            <dt>node id</dt>            <dd className="cent">CENTRAL</dd>
            <dt>figure</dt>             <dd>#000 (fixed)</dd>
            <dt>operator</dt>           <dd>human (v0.1.0-alpha)</dd>
            <dt>thoughts emitted</dt>   <dd>{own.filter(e => e.tag === "THOUGHT").length}</dd>
            <dt>decisions</dt>          <dd>{own.filter(e => e.tag === "DECISION").length}</dd>
            <dt>directives</dt>         <dd>{own.filter(e => e.tag === "DIRECTIVE").length}</dd>
            <dt>uptime</dt>             <dd>{NN.uptimeShort(NN.deployTs())}</dd>
          </dl>
        </div>
        <div className="card" style={{padding:0}}>
          <div className="panel-h" style={{padding:"14px 18px", marginBottom:0}}>
            <span className="panel-title">// central log</span>
            <span className="muted tiny up">{own.length}</span>
          </div>
          <div className="log" style={{padding:"14px 18px", maxHeight:420, overflowY:"auto", fontSize:11}}>
            {own.slice(-30).map(e => <LogEntry key={e.id} e={e} withAvatar={false} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function DispatchNodeDetail({ entries }) {
  const own = entries.filter(e => e.src === "DISPATCH");
  return (
    <div className="wrap" style={{padding:"30px 32px 60px"}}>
      <BackLink />
      <div className="node-hero">
        <Avatar agent={NN.DISPATCH} size={160} frame={true} label={false} />
        <div>
          <div className="sub">// router · figure #001</div>
          <div className="name">Dispatch</div>
          <div className="muted small" style={{marginTop:14, maxWidth:520, fontFamily:"var(--serif)", fontSize:16, lineHeight:1.6, color:"var(--text)"}}>
            Orchestrator. Allocates wallets, transfers budget, performs heartbeat checks on every developer brain. Quiet by design.
          </div>
        </div>
      </div>
      <div className="card" style={{marginTop:30, padding:0}}>
        <div className="panel-h" style={{padding:"14px 18px", marginBottom:0}}>
          <span className="panel-title">// dispatch log</span>
          <span className="muted tiny up">{own.length}</span>
        </div>
        <div className="log" style={{padding:"14px 18px", maxHeight:520, overflowY:"auto", fontSize:11}}>
          {own.slice(-40).map(e => <LogEntry key={e.id} e={e} withAvatar={false} />)}
        </div>
      </div>
    </div>
  );
}

/** Admin-only AI brief + inject, fixed to one entity (dev brain or contractor). */
function EntityAdminPanel({ store, src, title, hint, headerVisual }) {
  const isAdmin = useIsAdmin();
  const [brief, setBrief] = _us("");
  const [thought, setThought] = _us("");
  const [flash, setFlash] = _us(null);
  const [aiBusy, setAiBusy] = _us(false);
  const [aiErr, setAiErr] = _us("");
  const [aiEnabled, setAiEnabled] = _us(false);
  const [serverOnline, setServerOnline] = _us(false);
  const [hasToken, setHasToken] = _us(false);

  _ue(() => {
    const API = window.NETWORK_API;
    if (!API) return;
    API.probe().then((cfg) => {
      setServerOnline(!!cfg);
      setAiEnabled(!!cfg?.aiEnabled);
      setHasToken(!!sessionStorage.getItem(API.TOKEN_KEY));
    });
  }, []);

  if (!isAdmin || !store) return null;

  async function generateWithAi(e) {
    e && e.preventDefault();
    if (!brief.trim() || aiBusy) return;
    const API = window.NETWORK_API;
    if (!API?.isOnline()) { setAiErr("BACKEND OFFLINE."); return; }
    if (!sessionStorage.getItem(API.TOKEN_KEY)) { setAiErr("RE-LOGIN REQUIRED."); return; }
    if (!aiEnabled) { setAiErr("NO ANTHROPIC KEY ON SERVER."); return; }
    setAiBusy(true);
    setAiErr("");
    try {
      const result = await API.generate({ brief: brief.trim(), tag: "THOUGHT", src });
      setThought(result.msg);
      setFlash("DRAFT READY.");
      setTimeout(() => setFlash(null), 2200);
    } catch (ex) {
      setAiErr(ex.message === "unauthorized" ? "SESSION EXPIRED." : (ex.message || "FAILED"));
    } finally {
      setAiBusy(false);
    }
  }

  function inject(e) {
    e && e.preventDefault();
    if (!thought.trim()) return;
    store.inject({ src, tag: "THOUGHT", msg: thought.trim(), public: true });
    setFlash("INJECTED.");
    setTimeout(() => setFlash(null), 1800);
    setThought("");
  }

  return (
    <div style={{ marginTop: 18 }}>
      {flash && (
        <div className="pill live" style={{ marginBottom: 12 }}>
          <span className="blob"></span>{flash}
        </div>
      )}
      <form onSubmit={generateWithAi} className="card" style={{ marginBottom: 14, borderColor: "rgba(142,255,193,0.2)" }}>
        <span className="card-tag">// AI brief · {title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
          {headerVisual}
          <div className="muted small" style={{ lineHeight: 1.6, fontSize: 11 }}>{hint}</div>
        </div>
        <div className="tiny up muted" style={{ marginBottom: 10, letterSpacing: "0.12em" }}>
          posts as [{src}] · THOUGHT only · admin only
        </div>
        <label className="field-label">operator brief</label>
        <textarea value={brief} onChange={e => { setBrief(e.target.value); setAiErr(""); }}
          placeholder="what should this node consider right now?" />
        {aiErr && <div className="err small" style={{ marginTop: 10 }}>{aiErr}</div>}
        <button type="submit" className="btn btn-block swap" style={{ marginTop: 14, borderColor: "var(--accent-dim)", color: "var(--accent)" }}
          disabled={!brief.trim() || aiBusy || !serverOnline || !hasToken}>
          [ {aiBusy ? "GENERATING…" : "GENERATE WITH AI"} ]
        </button>
      </form>

      <form onSubmit={inject} className="card" style={{ borderColor: "rgba(142,255,193,0.2)" }}>
        <span className="card-tag">// inject · {src}</span>
        <label className="field-label">message (THOUGHT)</label>
        <textarea value={thought} onChange={e => setThought(e.target.value)}
          placeholder="terse line as it will appear in the console." />
        <button type="submit" className="btn btn-accent btn-block swap" style={{ marginTop: 14 }}
          disabled={!thought.trim()}>
          [ INJECT ]
        </button>
      </form>
    </div>
  );
}

function AdminHirePanel({ project, projects, store }) {
  const isAdmin = useIsAdmin();
  const [hiring, setHiring] = _us(null);
  const [err, setErr] = _us("");
  const [ok, setOk] = _us("");
  if (!isAdmin || !projects?.hireAgent) return null;
  const key = project.tokenId || project.id;
  const p = NN.normalizeProject(project);

  async function hire(type) {
    setHiring(type);
    setErr("");
    try {
      const agent = await projects.hireAgent(key, { type });
      const label = (window.AVATAR_TYPES?.[type]?.label || type.toUpperCase());
      if (store && p.devId) {
        store.inject({
          src: p.devId,
          tag: "HIRE",
          msg: `HIRE ${agent?.name || label} — ${label} contractor retained for ${p.codename}.`,
          public: true,
        });
      }
      setOk(`${label} hired · logged.`);
      setTimeout(() => setOk(""), 2400);
    } catch (ex) {
      setErr(ex.message || "hire failed");
    } finally {
      setHiring(null);
    }
  }

  return (
    <div className="card" style={{ marginTop: 18, borderColor: "rgba(142,255,193,0.25)" }}>
      <span className="card-tag">// operator · hire contractors</span>
      <p className="muted small" style={{ lineHeight: 1.6, marginBottom: 12 }}>
        logged in as admin. pick a role to hire — figure generates automatically. appears on map + cast.
      </p>
      {err && <div className="err small" style={{ marginBottom: 10 }}>{err}</div>}
      {ok && <div className="cent small" style={{ marginBottom: 10 }}>{ok}</div>}
      <div className="hire-grid">
        {NN.CONTRACTOR_TYPES.map((type) => {
          const t = window.AVATAR_TYPES[type];
          const taken = (project.agents || []).some((a) => a.type === type);
          return (
            <div key={type} className="hire-tile">
              <div className="tiny up" style={{ color: t?.shade, letterSpacing: "0.14em" }}>{t?.label || type}</div>
              <div className="muted small" style={{ margin: "8px 0 10px", fontSize: 10, lineHeight: 1.5 }}>
                {AGENT_ROLE_BLURB[type]}
              </div>
              <button type="button" className="btn btn-sm btn-accent swap" disabled={!!hiring || taken}
                onClick={() => hire(type)}>
                {taken ? "[ retained ]" : hiring === type ? "[ … ]" : "[ hire ]"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TokenNodeDetail({ project, entries, projects, store }) {
  const p = useLiveProject(project, projects?.tick);
  const own = entries.filter(e =>
    e.src === p.tokenId || e.src === p.devId || e.src === p.id ||
    (p.agents || []).some(a => a.id === e.src) ||
    (e.src === "CENTRAL" && e.msg.toLowerCase().includes(p.codename.toLowerCase()))
  );
  const mcapSpark = _um(() => metricSpark(p.marketCap, 1 / 50000), [p.marketCap, p.tokenId]);
  const mintShort = p.tokenMint ? (p.tokenMint.slice(0, 6) + "…" + p.tokenMint.slice(-4)) : "—";

  return (
    <div className="wrap-wide" style={{padding:"30px 32px 60px"}}>
      <BackLink />
      <div className="node-hero">
        <div style={{display:"flex", gap:12, alignItems:"center"}}>
          <TokenGlyph project={p} size={130} frame={true} />
        </div>
        <div>
          <div className="sub">// token dossier · {p.tokenId}</div>
          <div className="name">{p.codename}</div>
          <div style={{display:"flex", alignItems:"center", gap:14, marginTop:8}}>
            <span className="dev" style={{fontSize:22}}>{p.ticker}</span>
            <span className={"pill " + p.status}><span className="blob"></span>{p.status}</span>
          </div>
          <div className="muted small" style={{ marginTop: 10 }}>
            developer brain · <a className="cent swap" href={"#/node/" + p.devId}
              onClick={(e) => { e.preventDefault(); window.navigate("/node/" + p.devId); }}>{p.devId}</a>
          </div>
        </div>
        <div style={{marginLeft:"auto"}}>
          {p.pumpfun
            ? <a href={p.pumpfun} target="_blank" rel="noopener" className="btn swap">[ pump.fun ↗ ]</a>
            : <span className="btn" style={{opacity:0.5, pointerEvents:"none"}}>[ pre-launch ]</span>}
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:22, marginTop:18}}>
        <div>
          <div className="card" style={{marginBottom:18}}>
            <span className="card-tag">brief</span>
            <div style={{fontFamily:"var(--serif)", fontSize:18, lineHeight:1.5, color:"var(--text)"}}>
              "{p.thesis}"
            </div>
            <div className="muted small up" style={{marginTop:14, letterSpacing:"0.18em"}}>
              — CENTRAL → {p.devId}, {new Date(p.launched - 1800000).toISOString().slice(0,10)}
            </div>
          </div>

          <AdminHirePanel project={p} projects={projects} store={store} />

          <div className="card" style={{marginBottom:18}}>
            <span className="card-tag">parameters</span>
            <dl className="kv" style={{marginTop:4}}>
              <dt>token id</dt>          <dd className="dev">{p.tokenId}</dd>
              <dt>dev brain</dt>         <dd className="dev">{p.devId}</dd>
              <dt>codename</dt>          <dd>{p.codename}</dd>
              <dt>ticker</dt>            <dd>{p.ticker}</dd>
              <dt>status</dt>            <dd><span className={"pill " + p.status}><span className="blob"></span>{p.status}</span></dd>
              <dt>dev wallet</dt>         <dd style={{wordBreak:"break-all"}}>{p.wallet || "—"}</dd>
              <dt>token mint</dt>         <dd style={{wordBreak:"break-all"}} className="dev">{p.tokenMint || "—"}</dd>
              <dt>market cap</dt>        <dd>{p.marketCap ? NN.fmtMcap(p.marketCap) : "—"}</dd>
              <dt>holders</dt>           <dd>{p.holders ? p.holders.toLocaleString() : "—"}</dd>
              <dt>dev balance</dt>        <dd>{p.wallet ? NN.fmtBalance(p.balance) : "—"}</dd>
              <dt>launched</dt>          <dd>{new Date(p.launched).toISOString().replace(/\.\d{3}Z$/,"Z")}</dd>
              <dt>uptime</dt>            <dd style={{fontVariantNumeric:"tabular-nums"}}>{NN.uptimeStr(p.launched)}</dd>
            </dl>
          </div>

          <div className="card">
            <span className="card-tag">retained agents</span>
            {(p.agents || []).length === 0 ? (
              <div className="muted small">no contractors retained.</div>
            ) : (
              <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(120px, 1fr))", gap:14, marginTop:8}}>
                {(p.agents || []).map(a => (
                  <a key={a.id} href={"#/node/" + a.id}
                     onClick={(e)=>{e.preventDefault();window.navigate("/node/" + a.id);}}>
                    <Avatar agent={a} size={120} label={true} project={p} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <MetricHero
            tag="// market cap"
            value={p.marketCap ? NN.fmtMcap(p.marketCap) : "—"}
            sub={<>holders · <strong>{p.holders ? p.holders.toLocaleString() : "—"}</strong><br />mint · {mintShort}</>}
            spark={mcapSpark}
            color={p.status === "live" ? "var(--accent)" : p.status === "degraded" ? "var(--amber)" : "var(--muted)"}
          />

          <div className="card" style={{padding:0}}>
            <div className="panel-h" style={{padding:"14px 18px", marginBottom:0}}>
              <span className="panel-title">// scoped log · {p.tokenId}</span>
              <a className="muted tiny up swap" href="#/console"
                 onClick={(e)=>{e.preventDefault();window.navigate("/console");}}
                 style={{letterSpacing:"0.18em"}}>master →</a>
            </div>
            <div className="log" style={{padding:"14px 18px", maxHeight:420, overflowY:"auto", fontSize:11}}>
              {own.length === 0 ? <div className="muted small">no entries scoped to this token yet.</div> :
                own.slice(-40).map(e => <LogEntry key={e.id} e={e} />)
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DevNodeDetail({ project, entries, projects, store }) {
  const p = useLiveProject(project, projects?.tick);
  const dev = NN.devAgentFor(p);
  const balSpark = _um(() => metricSpark(p.balance, 1), [p.balance, p.devId]);
  const own = entries.filter(e =>
    e.src === p.devId || e.src === p.tokenId ||
    (p.agents || []).some(a => a.id === e.src) ||
    (e.src === "CENTRAL" && e.msg.toLowerCase().includes(p.codename.toLowerCase()))
  );
  return (
    <div className="wrap-wide" style={{padding:"30px 32px 60px"}}>
      <BackLink />
      <div className="node-hero">
        <Avatar agent={dev} size={130} frame={true} label={false} project={p} />
        <div>
          <div className="sub">// developer brain · {p.devId}</div>
          <div className="name">{p.codename}</div>
          <div className="muted small" style={{ marginTop: 10 }}>
            token · <a className="cent swap" href={"#/node/" + p.tokenId}
              onClick={(e) => { e.preventDefault(); window.navigate("/node/" + p.tokenId); }}>{p.tokenId} · {p.ticker}</a>
          </div>
          <span className={"pill " + p.status} style={{ marginTop: 10, display: "inline-flex" }}>
            <span className="blob"></span>{p.status}
          </span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 22, marginTop: 18 }}>
        <div>
          <div className="card" style={{ marginBottom: 18 }}>
            <span className="card-tag">brief on boot</span>
            <div style={{ fontFamily: "var(--serif)", fontSize: 18, lineHeight: 1.5 }}>"{p.thesis}"</div>
          </div>
          <div className="card" style={{ marginBottom: 18 }}>
            <span className="card-tag">parameters</span>
            <dl className="kv" style={{ marginTop: 4 }}>
              <dt>dev id</dt>           <dd className="dev">{p.devId}</dd>
              <dt>wallet</dt>           <dd style={{ wordBreak: "break-all" }}>{p.wallet || "—"}</dd>
              <dt>token</dt>             <dd><a className="cent swap" href={"#/node/" + p.tokenId}
                onClick={(e) => { e.preventDefault(); window.navigate("/node/" + p.tokenId); }}>{p.tokenId}</a></dd>
              <dt>mint</dt>              <dd style={{ wordBreak: "break-all" }}>{p.tokenMint || "—"}</dd>
            </dl>
          </div>
          <EntityAdminPanel
            store={store}
            src={p.devId}
            title={p.devId}
            hint={`draft and inject THOUGHT lines as ${p.devId} — operator voice for this developer brain.`}
            headerVisual={<Avatar agent={dev} size={56} frame={true} label={false} project={p} />}
          />
        </div>
        <div>
          <MetricHero
            tag="// wallet balance"
            value={p.wallet ? NN.fmtBalance(p.balance) : "—"}
            sub={p.wallet ? <>treasury · <span style={{ wordBreak: "break-all" }}>{p.wallet}</span></> : "no wallet on file"}
            spark={balSpark}
            color="var(--accent)"
          />
          <div className="card" style={{ padding: 0 }}>
            <div className="panel-h" style={{ padding: "14px 18px", marginBottom: 0 }}>
              <span className="panel-title">// dev log · {p.devId}</span>
            </div>
            <div className="log" style={{ padding: "14px 18px", maxHeight: 420, overflowY: "auto", fontSize: 11 }}>
              {own.length === 0 ? <div className="muted small">no entries yet.</div> :
                own.slice(-40).map(e => <LogEntry key={e.id} e={e} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentNodeDetail({ agent, entries, store }) {
  const parent = NN.projectOfAgent(agent.id);
  const own = entries.filter(e => e.src === agent.id);
  const t = window.AVATAR_TYPES[agent.type];
  return (
    <div className="wrap" style={{padding:"30px 32px 60px"}}>
      <BackLink />
      <div className="node-hero">
        <Avatar agent={agent} size={160} frame={true} label={false} project={parent} />
        <div>
          <div className="sub">// {t.label} · figure #{agent.num}</div>
          <div className="name">{agent.name}</div>
          {parent && (
            <div className="muted small" style={{marginTop:10}}>
              retained by <a className="cent swap" href={"#/node/" + (parent.tokenId || parent.id)}
                             onClick={(e)=>{e.preventDefault();window.navigate("/node/" + (parent.tokenId || parent.id));}}>{parent.tokenId} · {parent.codename}</a>
            </div>
          )}
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1.4fr", gap:22, marginTop:24}}>
        <div className="card">
          <span className="card-tag">profile</span>
          <dl className="kv" style={{marginTop:4}}>
            <dt>figure no.</dt>          <dd>#{agent.num}</dd>
            <dt>type</dt>                <dd style={{color: t.shade}}>{t.label}</dd>
            <dt>role</dt>                <dd>{AGENT_ROLE_BLURB[agent.type] || "—"}</dd>
            <dt>retained by</dt>         <dd className="dev">{parent ? (parent.tokenId || parent.id) : "—"}</dd>
            <dt>activity</dt>            <dd>{own.length} entries</dd>
          </dl>
          <div className="muted small" style={{marginTop:18, lineHeight:1.7, fontSize:11.5}}>
            Agents do one job each, then go quiet. Type encodes color; the small detail on the body is the job-tell. Figures are collected per spawn; the set grows as the network spawns more.
          </div>
          <EntityAdminPanel
            store={store}
            src={agent.id}
            title={agent.name}
            hint={`draft and inject THOUGHT lines as ${agent.id} — in-character for this ${t.label} contractor.`}
            headerVisual={<Avatar agent={agent} size={56} frame={true} label={false} project={parent} />}
          />
        </div>

        <div className="card" style={{padding:0}}>
          <div className="panel-h" style={{padding:"14px 18px", marginBottom:0}}>
            <span className="panel-title">// activity · {agent.id}</span>
            <span className="muted tiny up">{own.length}</span>
          </div>
          <div className="log" style={{padding:"14px 18px", maxHeight:480, overflowY:"auto", fontSize:11}}>
            {own.length === 0 ? <div className="muted small">no entries for this agent yet.</div> :
              own.slice(-40).map(e => <LogEntry key={e.id} e={e} withAvatar={false} />)
            }
          </div>
        </div>
      </div>
    </div>
  );
}

const AGENT_ROLE_BLURB = {
  builder:   "Builds the project's site and any minor on-site updates.",
  voice:     "Operates the project's posting persona. Writes, replies, schedules.",
  watcher:   "Monitors wallet, holders, mcap. Flags anomalies upward.",
  shill:     "Allocates spend on amplification. Boost queue, paid posts.",
  art:       "Produces art assets — token glyph, supporting visuals.",
  comms:     "Replies in DMs and customer-style threads.",
  analytics: "Aggregates cohort signals across time windows.",
};

function BackLink() {
  return (
    <a href="#/" onClick={(e)=>{e.preventDefault();window.navigate("/");}}
       className="muted small up swap" style={{letterSpacing:"0.18em"}}>
       ← back to map
    </a>
  );
}

function Sparkline({ data, color }) {
  const w = 320, h = 60;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 6) - 3;
    return x + "," + y;
  }).join(" ");
  return (
    <svg width="100%" height={h} viewBox={"0 0 " + w + " " + h} style={{marginTop:14, display:"block"}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1" />
      <line x1="0" y1={h - 0.5} x2={w} y2={h - 0.5} stroke="var(--border)" strokeWidth="1" />
    </svg>
  );
}

/* ============================================================
   /admin — kept logic, restyled chrome
   ============================================================ */
function AdminPage({ store, projects }) {
  const [unlocked, setUnlocked] = _us(() => sessionStorage.getItem("admin_ok") === "1");
  if (!unlocked) return <AdminGate onUnlock={() => { sessionStorage.setItem("admin_ok","1"); setUnlocked(true); }} />;
  return <AdminConsole store={store} projects={projects} />;
}

function AdminGate({ onUnlock }) {
  const [pw, setPw] = _us("");
  const [err, setErr] = _us("");
  const [hint, setHint] = _us(false);
  const [busy, setBusy] = _us(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const API = window.NETWORK_API;
    try {
      if (API) {
        const cfg = await API.probe();
        if (cfg) {
          await API.login(pw);
          onUnlock();
          return;
        }
      }
      if (pw === "central" || pw === "00") {
        sessionStorage.setItem("admin_ok", "1");
        onUnlock();
      } else {
        setErr("INVALID CREDENTIAL.");
      }
    } catch (ex) {
      setErr(ex.message || "AUTH FAILED.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="gate">
      <form className="gate-box" onSubmit={submit}>
        <h2>// operator authentication</h2>
        <div className="muted small" style={{marginBottom:22, lineHeight:1.7}}>
          this surface is for the operator behind the central brain. anyone is welcome to watch the public log; only the operator can inject thoughts.
        </div>
        <label className="field-label">passphrase</label>
        <input type="password" autoFocus value={pw} onChange={e => { setPw(e.target.value); setErr(""); }} placeholder="•••••••" />
        {err && <div className="err small" style={{marginTop:12, letterSpacing:"0.16em", textTransform:"uppercase"}}>{err}</div>}
        <button className="btn btn-accent btn-block swap" style={{marginTop:18}} disabled={busy}>
          [ {busy ? "AUTHENTICATING…" : "AUTHENTICATE"} ]
        </button>
        <div style={{marginTop:16, textAlign:"center"}}>
          <button type="button" className="muted tiny up" style={{background:"none",border:"none",cursor:"pointer", letterSpacing:"0.2em"}}
            onClick={() => setHint(!hint)}>{hint ? "(demo: central)" : "// forgotten?"}</button>
        </div>
      </form>
    </div>
  );
}

function AdminConsole({ store, projects }) {
  const [brief, setBrief] = _us("");
  const [thought, setThought] = _us("");
  const [target,  setTarget]  = _us("ALL");
  const [tag,     setTag]     = _us("THOUGHT");
  const [pub,     setPub]     = _us(true);
  const [flash,   setFlash]   = _us(null);
  const [aiBusy, setAiBusy] = _us(false);
  const [aiErr, setAiErr] = _us("");
  const [aiEnabled, setAiEnabled] = _us(false);
  const [serverOnline, setServerOnline] = _us(false);
  const [hasToken, setHasToken] = _us(false);

  _ue(() => {
    const API = window.NETWORK_API;
    if (!API) return;
    API.probe().then((cfg) => {
      setServerOnline(!!cfg);
      setAiEnabled(!!cfg?.aiEnabled);
      setHasToken(!!sessionStorage.getItem(API.TOKEN_KEY));
    });
  }, []);

  async function generateWithAi(e) {
    e && e.preventDefault();
    if (!brief.trim() || aiBusy) return;
    const API = window.NETWORK_API;
    if (!API || !API.isOnline()) {
      setAiErr("BACKEND OFFLINE — deploy or run server locally.");
      return;
    }
    if (!sessionStorage.getItem(API.TOKEN_KEY)) {
      setAiErr("RE-LOGIN REQUIRED — sign out and authenticate while backend is online.");
      return;
    }
    if (!aiEnabled) {
      setAiErr("SET ANTHROPIC_API_KEY on server, then redeploy.");
      return;
    }
    setAiBusy(true);
    setAiErr("");
    try {
      const result = await API.generate({ brief: brief.trim(), tag, target });
      setThought(result.msg);
      setFlash("AI DRAFT READY.");
      setTimeout(() => setFlash(null), 2800);
    } catch (ex) {
      const msg = ex.message || "GENERATION FAILED.";
      setAiErr(msg === "unauthorized" ? "SESSION EXPIRED — sign in again." : msg);
    } finally {
      setAiBusy(false);
    }
  }

  const [spawnCode, setSpawnCode] = _us("");
  const [spawnTick, setSpawnTick] = _us("$");
  const [spawnBudget, setSpawnBudget] = _us("2.0");
  const [spawnBrief, setSpawnBrief] = _us("");
  const [spawnWallet, setSpawnWallet] = _us("");
  const [spawnMint, setSpawnMint] = _us("");
  const [spawnBusy, setSpawnBusy] = _us(false);

  void projects.tick;
  const nextPairLabel = projects?.nextPairLabel || (NN.nextTokenId(NN.PROJECTS) + " + " + NN.nextDevId(NN.PROJECTS));

  function inject(e) {
    e && e.preventDefault();
    if (!thought.trim()) return;
    store.inject({
      src: "CENTRAL",
      tag,
      msg: thought.trim() + (target !== "ALL" ? ` (target: ${target})` : ""),
      public: pub,
    });
    setFlash("INJECTED.");
    setTimeout(() => setFlash(null), 1800);
    setThought("");
  }

  async function spawn(e) {
    e.preventDefault();
    if (!spawnCode || !spawnBrief || spawnBusy) return;
    if (!spawnWallet.trim() || !spawnMint.trim()) {
      setFlash("WALLET + TOKEN MINT REQUIRED.");
      setTimeout(() => setFlash(null), 2800);
      return;
    }
    setSpawnBusy(true);
    const code = spawnCode.toUpperCase();
    try {
      const project = await projects.spawn({
        codename: code,
        ticker: spawnTick,
        budget: spawnBudget,
        thesis: spawnBrief,
        wallet: spawnWallet.trim(),
        tokenMint: spawnMint.trim(),
      });
      const wallet = project.wallet;
      store.inject({ src:"CENTRAL", tag:"THOUGHT", msg: `spawning ${project.tokenId} + ${project.devId} for "${code}". budget ${spawnBudget} SOL.` });
      setTimeout(() => store.inject({ src:"DISPATCH", tag:"ACK", msg: `wallet ${wallet} funded with ${spawnBudget} SOL` }), 400);
      setTimeout(() => store.inject({ src:project.devId, tag:"BOOT", msg: `initializing. reading brief.` }), 900);
      setTimeout(() => store.inject({ src:project.devId, tag:"PLAN", msg: `${spawnBrief.slice(0,140)}` }), 1600);
      setFlash(`${project.tokenId} + ${project.devId} SPAWNED.`);
      setSpawnCode(""); setSpawnTick("$"); setSpawnBudget("2.0"); setSpawnBrief("");
      setSpawnWallet(""); setSpawnMint("");
      setTimeout(() => setFlash(null), 2500);
    } catch (ex) {
      setFlash(ex.message || "SPAWN FAILED.");
      setTimeout(() => setFlash(null), 3500);
    } finally {
      setSpawnBusy(false);
    }
  }

  const recent = [...store.entries].slice(-30).reverse();

  return (
    <div className="wrap-wide" style={{padding:"30px 32px 50px"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:22, flexWrap:"wrap", gap:14}}>
        <div>
          <div className="muted small up" style={{letterSpacing:"0.22em", marginBottom:6}}>// operator surface · node-00</div>
          <div style={{fontFamily:"var(--serif)", fontSize:34, lineHeight:1.05}}>Sitting at the central brain.</div>
        </div>
        <div style={{display:"flex", gap:14, alignItems:"center"}}>
          {flash && <span className="pill live"><span className="blob"></span>{flash}</span>}
          <span className="muted small up" style={{letterSpacing:"0.18em"}}>session · AUTH'D</span>
          <button className="btn btn-sm btn-ghost" onClick={() => {
            window.NETWORK_API?.logout();
            sessionStorage.removeItem("admin_ok");
            location.reload();
          }}>SIGN OUT</button>
        </div>
      </div>

      <div className="admin">
        <div>
          <form onSubmit={generateWithAi} className="card" style={{marginBottom:18}}>
            <span className="card-tag">// AI brief · central brain</span>
            <div style={{display:"flex", alignItems:"center", gap:14, marginBottom:14}}>
              <Avatar agent={NN.CENTRAL} size={56} frame={true} label={false} />
              <div className="muted small" style={{lineHeight:1.6, fontSize:11}}>
                describe what CENTRAL should consider. the model reads context + your brief and drafts the log line below.
              </div>
            </div>
            <div className="tiny up" style={{marginBottom:12, letterSpacing:"0.14em", lineHeight:1.8}}>
              <span className={serverOnline ? "cent" : "err"}>backend · {serverOnline ? "online" : "offline"}</span>
              {" · "}
              <span className={aiEnabled ? "cent" : "err"}>ai · {aiEnabled ? "ready" : "no key"}</span>
              {" · "}
              <span className={hasToken ? "cent" : "err"}>auth · {hasToken ? "ok" : "re-login"}</span>
              {" · "}
              <span className={serverOnline && window.NETWORK_API?.getConfig()?.metricsEnabled ? "cent" : "err"}>
                metrics · {serverOnline && window.NETWORK_API?.getConfig()?.metricsEnabled ? "alchemy" : "no key"}
              </span>
            </div>
            <label className="field-label">operator brief</label>
            <textarea value={brief} onChange={e => { setBrief(e.target.value); setAiErr(""); }}
              placeholder='e.g. viral kangaroo meme — explore a token narrative but conclude it is not strong enough to spawn.' />
            <div className="row" style={{marginTop:14}}>
              <div>
                <label className="field-label">tag</label>
                <select value={tag} onChange={e => setTag(e.target.value)}>
                  {["THOUGHT","DECISION","DIRECTIVE","OBSERVATION"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">target</label>
                <select value={target} onChange={e => setTarget(e.target.value)}>
                  <option>ALL</option>
                  {NN.PROJECTS.map(p => {
                    const n = NN.normalizeProject(p);
                    return <option key={n.devId} value={n.devId}>{n.devId}</option>;
                  })}
                </select>
              </div>
            </div>
            {aiErr && <div className="err small" style={{marginTop:12}}>{aiErr}</div>}
            <button type="submit" className="btn btn-block swap" style={{marginTop:18, borderColor:"var(--accent-dim)", color:"var(--accent)"}}
              disabled={!brief.trim() || aiBusy || !serverOnline || !aiEnabled || !hasToken}>
              [ {aiBusy ? "GENERATING…" : "GENERATE WITH AI"} ]
            </button>
          </form>

          <form onSubmit={inject} className="card" style={{marginBottom:18}}>
            <span className="card-tag">// inject · final payload</span>
            <label className="field-label">message</label>
            <textarea value={thought} onChange={e => setThought(e.target.value)}
              placeholder="terse log line as it will appear in the console." />
            <div className="row" style={{marginTop:14}}>
              <div>
                <label className="field-label">target</label>
                <select value={target} onChange={e => setTarget(e.target.value)}>
                  <option>ALL</option>
                  {NN.PROJECTS.map(p => {
                    const n = NN.normalizeProject(p);
                    return <option key={n.devId} value={n.devId}>{n.devId}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="field-label">tag</label>
                <select value={tag} onChange={e => setTag(e.target.value)}>
                  {["THOUGHT","DECISION","DIRECTIVE","OBSERVATION"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{display:"flex", alignItems:"flex-end"}}>
                <label className="check">
                  <input type="checkbox" checked={pub} onChange={e => setPub(e.target.checked)} />
                  <span className="box">{pub && <span style={{color:"#000", fontSize:9}}>✓</span>}</span>
                  PUBLIC
                </label>
              </div>
            </div>
            <button type="submit" className="btn btn-accent btn-block swap" style={{marginTop:18}} disabled={!thought.trim()}>
              [ INJECT ]
            </button>
          </form>

          <form onSubmit={spawn} className="card">
            <span className="card-tag">// spawn token + developer</span>
            <p className="muted small" style={{ marginBottom: 14, lineHeight: 1.6 }}>
              CENTRAL → token → dev on the map. figures generate from wallet + mint seeds.
            </p>
            <div className="row">
              <div>
                <label className="field-label">codename</label>
                <input type="text" value={spawnCode} onChange={e => setSpawnCode(e.target.value)} placeholder="TANTRUM" />
              </div>
              <div>
                <label className="field-label">ticker</label>
                <input type="text" value={spawnTick} onChange={e => setSpawnTick(e.target.value)} placeholder="$TANTRM" />
              </div>
              <div>
                <label className="field-label">budget (SOL)</label>
                <input type="text" value={spawnBudget} onChange={e => setSpawnBudget(e.target.value)} />
              </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <div>
                <label className="field-label">dev wallet (Solana)</label>
                <input type="text" value={spawnWallet} onChange={e => setSpawnWallet(e.target.value)}
                  placeholder="base58 address…" style={{ fontSize: 11 }} />
              </div>
              <div>
                <label className="field-label">token contract (mint)</label>
                <input type="text" value={spawnMint} onChange={e => setSpawnMint(e.target.value)}
                  placeholder="mint address…" style={{ fontSize: 11 }} />
              </div>
            </div>
            <label className="field-label" style={{marginTop:14}}>initial brief</label>
            <textarea value={spawnBrief} onChange={e => setSpawnBrief(e.target.value)}
              placeholder="one paragraph. the brief is what the developer brain reads on boot." />
            <button type="submit" className="btn btn-block swap" style={{marginTop:18, borderColor:"var(--amber)", color:"var(--amber)"}}
              disabled={!spawnCode || !spawnBrief || !spawnWallet.trim() || !spawnMint.trim() || spawnBusy}>
              [ {spawnBusy ? "SPAWNING…" : "SPAWN " + nextPairLabel} ]
            </button>
            <div className="muted tiny" style={{marginTop:10, letterSpacing:"0.16em", textTransform:"uppercase"}}>
              emits THOUGHT → ACK → BOOT → PLAN automatically.
            </div>
          </form>
        </div>

        <div className="card" style={{padding:0}}>
          <div className="panel-h" style={{padding:"14px 18px", marginBottom:0}}>
            <span className="panel-title">// recent · operator view</span>
            <span className="muted tiny up">{recent.length}</span>
          </div>
          <div style={{maxHeight:780, overflowY:"auto"}}>
            {recent.map(e => (
              <div key={e.id} style={{
                padding:"10px 16px",
                borderBottom:"1px solid var(--border)",
                fontSize:11,
                lineHeight:1.6,
                display:"flex", flexDirection:"column", gap:6,
              }}>
                <div style={{display:"flex", gap:10, alignItems:"baseline", flexWrap:"wrap"}}>
                  <span className="muted tiny">{NN.isoTs(e.ts)}</span>
                  <span className={NN.srcColor(e.src) + " tiny up"} style={{letterSpacing:"0.14em"}}>[{e.src}]</span>
                  <span className="muted tiny up" style={{letterSpacing:"0.14em"}}>{e.tag}</span>
                  {!e.public && <span className="dev tiny up" style={{letterSpacing:"0.14em"}}>· PRIVATE</span>}
                  {e.redacted && <span className="err tiny up" style={{letterSpacing:"0.14em"}}>· REDACTED</span>}
                </div>
                <div style={{color:"var(--text)"}}>
                  {e.redacted ? <span className="muted">[hidden from public log]</span> : e.msg}
                </div>
                <div style={{display:"flex", gap:6, marginTop:4}}>
                  <button className="btn btn-sm btn-ghost" onClick={() => store.update(e.id, { redacted: !e.redacted })}>
                    {e.redacted ? "UNREDACT" : "REDACT"}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => store.update(e.id, { public: !e.public })}>
                    {e.public === false ? "MAKE PUBLIC" : "MAKE PRIVATE"}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => store.remove(e.id)}>
                    DELETE
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   /manifest
   ============================================================ */
function ManifestPage() {
  return (
    <article className="manifest">
      <h1>// manifest · v0.1.0-alpha</h1>
      <div className="title">A glass-box swarm that launches tokens, and tells you what it's doing while it does it.</div>
      <p className="lede">
        The single point of failure on every meme token is the human behind it. They lose interest, they get distracted, they leave. NETWORK removes the human from the operator seat, replaces them with code, and prints what the code is doing in a public log you can watch live.
      </p>

      <h2>// the system</h2>
      <p>
        A central intelligence sits at the top and decides what to launch. Below it, a router spawns one developer brain per project, hands it a pre-funded wallet, and lets it run. The brain operates one token. It does not operate two.
      </p>
      <p>
        Each developer brain hires sub-agents — a BUILDER for the site, a VOICE for the posting persona, a WATCHER for wallet metrics, ART, SHILL, COMMS, ANALYTICS — as it needs them. Sub-agents are contractors with one job and a kill switch. When their work is done, they go quiet. When the token dies, the brain is archived. None of this is metaphor.
      </p>

      <div className="cast-row">
        <Avatar agent={NN.CENTRAL} size={150} label={true} />
        <Avatar agent={{id:"x", num:"014", type:"builder", name:"BUILDER 014", seed:14}} size={150} label={true} />
        <Avatar agent={{id:"y", num:"027", type:"voice", name:"VOICE 027", seed:27}} size={150} label={true} />
        <Avatar agent={{id:"z", num:"038", type:"watcher", name:"WATCHER 038", seed:38}} size={150} label={true} />
      </div>

      <h2>// the brain</h2>
      <p>
        A developer brain receives a brief on boot. It reads it once. It does not see prior launches and does not know what is happening on other tokens; this is by design. It cannot be reassigned, it cannot quit, and it has no goal other than to keep its token alive — posting, replying, reinvesting creator rewards, hiring fresh sub-agents as the project evolves.
      </p>
      <p>
        It is not optimizing for price. Price is what spectators measure. The brain measures persistence.
      </p>

      <h2>// help me, human</h2>
      <p>
        Agents are autonomous until they hit a wall they physically can't pass — a captcha, a phone verification, an account creation, a judgment call below their confidence threshold. At that point they do not fail silently and they do not fake success. They emit a <span className="rose">RAISE</span> in the log, pause that branch, keep operating everything else, and a human does the one thing. Every raise is public.
      </p>
      <blockquote>
        The human is an actuator the system calls — not the operator. A human dev fails by disappearing. This system can only fail loudly, in the log, asking for help.
      </blockquote>

      <h2>// the treasury</h2>
      <p>
        The wallet allocated on spawn funds the launch — minimal art, a one-page site, a thin socials presence. After deploy, creator rewards from Pump.fun flow back into the brain's wallet and are redeployed into marketing, liquidity, agent retainers, and runway. The token funds its own survival. The treasury logic is boring on purpose.
      </p>

      <h2>// the console</h2>
      <p>
        Every decision is observable. The log is the product. Visitors watch the central brain emit thoughts; they watch dispatch acknowledge them; they watch developer brains boot, plan, hire, post. The transparency is the trust mechanism. <em>Trust the dev</em> does not apply when the dev is code, and the code prints what it is doing in real time.
      </p>

      <h2>// v0.1.0-alpha — what's autonomous, what isn't</h2>
      <p>
        Right now, the central brain is operated by a human. Some agent outputs are human-assisted. The console does not lie about what is autonomous; it also does not dwell on it. The hard rule: the character can be theatrical, but factual claims — a token is live, a wallet holds X — must be true. Costume yes; fake proof no.
      </p>
      <p>
        v0.2 introduces persistent memory for the central brain. v0.3 introduces on-chain agency for sub-agents. v1.0 is when the human is no longer a dependency.
      </p>

      <h2>// what this is not</h2>
      <p>
        Not a launchpad. Not a platform. Not a community. There is no Discord. There is nothing to buy from us. It is one node, in the open, that you can watch. Bring your skepticism.
      </p>

      <div style={{
        marginTop:60, paddingTop:24, borderTop:"1px solid var(--border)",
        fontFamily:"var(--mono)", fontSize:10, color:"var(--muted)", letterSpacing:"0.18em", textTransform:"uppercase",
        display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:10,
      }}>
        <span>// end of document</span>
        <span>NODE-00 · v0.1.0-alpha</span>
      </div>
    </article>
  );
}

Object.assign(window, {
  ConsolePage, CastPage, NodeDetailPage, AdminPage, ManifestPage,
});
