/* ============================================================
   pages.jsx — /console, /node/[id], /cast, /admin, /manifest
   ============================================================ */
const { useState: _us, useEffect: _ue, useRef: _ur, useMemo: _um } = React;
const NN = window.NETWORK;

/* ============================================================
   /console — master log
   ============================================================ */
function ConsolePage({ store }) {
  const all = store.entries.filter(e => e.public !== false);

  // build filter list
  const sideChips = _um(() => {
    const list = [
      { id: "ALL", label: "ALL", group: "all" },
      { id: "CENTRAL", label: "CENTRAL BRAIN", group: "central" },
      { id: "DISPATCH", label: "DISPATCH", group: "dispatch" },
    ];
    NN.PROJECTS.forEach(p => list.push({ id: p.id, label: `${p.id} · ${p.codename}`, group: "dev" }));
    list.push({ id: "SUB-AGENTS", label: "ALL SUB-AGENTS", group: "sub" });
    return list;
  }, []);

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
function CastPage() {
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
            <span>// {p.id} · {p.codename} — {p.agents.length} agent{p.agents.length === 1 ? "" : "s"}</span>
            <a href={"#/node/" + p.id}
               onClick={(e)=>{e.preventDefault();window.navigate("/node/" + p.id);}}
               className="muted small swap" style={{letterSpacing:"0.18em", textTransform:"uppercase"}}>
              dossier →
            </a>
          </div>
          {p.agents.length === 0 ? (
            <div className="muted small">no agents retained yet.</div>
          ) : (
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))", gap:16}}>
              {p.agents.map(a => (
                <a key={a.id} href={"#/node/" + a.id}
                   onClick={(e)=>{e.preventDefault();window.navigate("/node/" + a.id);}}>
                  <Avatar agent={a} size={150} label={true} />
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   /node/[id] — entity detail (brain / token / agent)
   ============================================================ */
function NodeDetailPage({ id, entries, now }) {
  // resolve entity
  if (id === "CENTRAL") return <CentralNodeDetail entries={entries} />;
  if (id === "DISPATCH") return <DispatchNodeDetail entries={entries} />;
  if (id.startsWith("DEV-")) {
    const p = NN.findProject(id);
    if (p) return <TokenNodeDetail project={p} entries={entries} />;
  }
  const agent = NN.findAgent(id);
  if (agent) return <AgentNodeDetail agent={agent} entries={entries} />;
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

function TokenNodeDetail({ project, entries }) {
  const p = project;
  const num = p.id.replace("DEV-","");
  const own = entries.filter(e =>
    e.src === p.id ||
    p.agents.some(a => a.id === e.src) ||
    (e.src === "CENTRAL" && e.msg.toLowerCase().includes(p.codename.toLowerCase()))
  );
  const spark = _um(() => {
    const arr = [];
    let v = p.balance * 0.5 + 0.2;
    for (let i = 0; i < 40; i++) {
      v = Math.max(0.05, v + (Math.random() - 0.45) * 0.6);
      arr.push(v);
    }
    arr[arr.length - 1] = p.balance;
    return arr;
  }, [p.id]);

  return (
    <div className="wrap-wide" style={{padding:"30px 32px 60px"}}>
      <BackLink />
      <div className="node-hero">
        <div style={{display:"flex", gap:12, alignItems:"center"}}>
          <TokenGlyph project={p} size={130} frame={true} />
        </div>
        <div>
          <div className="sub">// dossier · {p.id}</div>
          <div className="name">{p.codename}</div>
          <div style={{display:"flex", alignItems:"center", gap:14, marginTop:8}}>
            <span className="dev" style={{fontSize:22}}>{p.ticker}</span>
            <span className={"pill " + p.status}><span className="blob"></span>{p.status}</span>
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
              — CENTRAL → {p.id}, {new Date(p.launched - 1800000).toISOString().slice(0,10)}
            </div>
          </div>

          <div className="card" style={{marginBottom:18}}>
            <span className="card-tag">parameters</span>
            <dl className="kv" style={{marginTop:4}}>
              <dt>brain id</dt>          <dd className="dev">{p.id}</dd>
              <dt>codename</dt>          <dd>{p.codename}</dd>
              <dt>ticker</dt>            <dd>{p.ticker}</dd>
              <dt>status</dt>            <dd><span className={"pill " + p.status}><span className="blob"></span>{p.status}</span></dd>
              <dt>wallet</dt>            <dd style={{wordBreak:"break-all"}}>{p.wallet}</dd>
              <dt>balance</dt>           <dd>{NN.fmtBalance(p.balance)}</dd>
              <dt>market cap</dt>        <dd>{p.marketCap ? NN.fmtMcap(p.marketCap) : "—"}</dd>
              <dt>holders</dt>           <dd>{p.holders ? p.holders.toLocaleString() : "—"}</dd>
              <dt>launched</dt>          <dd>{new Date(p.launched).toISOString().replace(/\.\d{3}Z$/,"Z")}</dd>
              <dt>uptime</dt>            <dd style={{fontVariantNumeric:"tabular-nums"}}>{NN.uptimeStr(p.launched)}</dd>
            </dl>
          </div>

          <div className="card">
            <span className="card-tag">retained agents</span>
            {p.agents.length === 0 ? (
              <div className="muted small">no contractors retained.</div>
            ) : (
              <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(120px, 1fr))", gap:14, marginTop:8}}>
                {p.agents.map(a => (
                  <a key={a.id} href={"#/node/" + a.id}
                     onClick={(e)=>{e.preventDefault();window.navigate("/node/" + a.id);}}>
                    <Avatar agent={a} size={120} label={true} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="card" style={{marginBottom:18}}>
            <span className="card-tag">balance</span>
            <div style={{fontSize:28, fontVariantNumeric:"tabular-nums"}}>{NN.fmtBalance(p.balance)}</div>
            <div className="muted small" style={{marginTop:4}}>last 40 ticks · simulated</div>
            <Sparkline data={spark} color={p.status === "live" ? "var(--accent)" : p.status === "degraded" ? "var(--amber)" : "var(--muted)"} />
          </div>

          <div className="card" style={{padding:0}}>
            <div className="panel-h" style={{padding:"14px 18px", marginBottom:0}}>
              <span className="panel-title">// scoped log · {p.id}</span>
              <a className="muted tiny up swap" href="#/console"
                 onClick={(e)=>{e.preventDefault();window.navigate("/console");}}
                 style={{letterSpacing:"0.18em"}}>master →</a>
            </div>
            <div className="log" style={{padding:"14px 18px", maxHeight:420, overflowY:"auto", fontSize:11}}>
              {own.length === 0 ? <div className="muted small">no entries scoped to this developer yet.</div> :
                own.slice(-40).map(e => <LogEntry key={e.id} e={e} />)
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentNodeDetail({ agent, entries }) {
  const parent = NN.projectOfAgent(agent.id);
  const own = entries.filter(e => e.src === agent.id);
  const t = window.AVATAR_TYPES[agent.type];
  return (
    <div className="wrap" style={{padding:"30px 32px 60px"}}>
      <BackLink />
      <div className="node-hero">
        <Avatar agent={agent} size={160} frame={true} label={false} />
        <div>
          <div className="sub">// {t.label} · figure #{agent.num}</div>
          <div className="name">{agent.name}</div>
          {parent && (
            <div className="muted small" style={{marginTop:10}}>
              retained by <a className="cent swap" href={"#/node/" + parent.id}
                             onClick={(e)=>{e.preventDefault();window.navigate("/node/" + parent.id);}}>{parent.id} · {parent.codename}</a>
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
            <dt>retained by</dt>         <dd className="dev">{parent ? parent.id : "—"}</dd>
            <dt>activity</dt>            <dd>{own.length} entries</dd>
          </dl>
          <div className="muted small" style={{marginTop:18, lineHeight:1.7, fontSize:11.5}}>
            Agents do one job each, then go quiet. Type encodes color; the small detail on the body is the job-tell. Figures are collected per spawn; the set grows as the network spawns more.
          </div>
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
function AdminPage({ store }) {
  const [unlocked, setUnlocked] = _us(() => sessionStorage.getItem("admin_ok") === "1");
  if (!unlocked) return <AdminGate onUnlock={() => { sessionStorage.setItem("admin_ok","1"); setUnlocked(true); }} />;
  return <AdminConsole store={store} />;
}

function AdminGate({ onUnlock }) {
  const [pw, setPw] = _us("");
  const [err, setErr] = _us("");
  const [hint, setHint] = _us(false);
  function submit(e) {
    e.preventDefault();
    if (pw === "central" || pw === "00") onUnlock();
    else setErr("INVALID CREDENTIAL.");
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
        <button className="btn btn-accent btn-block swap" style={{marginTop:18}}>[ AUTHENTICATE ]</button>
        <div style={{marginTop:16, textAlign:"center"}}>
          <button type="button" className="muted tiny up" style={{background:"none",border:"none",cursor:"pointer", letterSpacing:"0.2em"}}
            onClick={() => setHint(!hint)}>{hint ? "(demo: central)" : "// forgotten?"}</button>
        </div>
      </form>
    </div>
  );
}

function AdminConsole({ store }) {
  const [thought, setThought] = _us("");
  const [target,  setTarget]  = _us("ALL");
  const [tag,     setTag]     = _us("THOUGHT");
  const [pub,     setPub]     = _us(true);
  const [flash,   setFlash]   = _us(null);

  const [spawnCode, setSpawnCode] = _us("");
  const [spawnTick, setSpawnTick] = _us("$");
  const [spawnBudget, setSpawnBudget] = _us("2.0");
  const [spawnBrief, setSpawnBrief] = _us("");

  function inject(e) {
    e && e.preventDefault();
    if (!thought.trim()) return;
    store.inject({
      src: "CENTRAL",
      tag,
      msg: thought.trim() + (target !== "ALL" ? ` (target: ${target})` : ""),
      public: pub,
    });
    setFlash("THOUGHT INJECTED.");
    setTimeout(() => setFlash(null), 1800);
    setThought("");
  }

  function spawn(e) {
    e.preventDefault();
    if (!spawnCode || !spawnBrief) return;
    const nextNum = String(NN.PROJECTS.length + Math.floor(Math.random()*3 + 1)).padStart(3,"0");
    const id = "DEV-" + nextNum;
    const wallet = "Z" + Math.random().toString(36).slice(2,8).toUpperCase() + "…" + Math.random().toString(36).slice(2,6).toUpperCase();
    const code = spawnCode.toUpperCase();
    store.inject({ src:"CENTRAL",  tag:"THOUGHT", msg: `spawning ${id} for project codename "${code}". budget ${spawnBudget} SOL.` });
    setTimeout(() => store.inject({ src:"DISPATCH", tag:"ACK", msg: `wallet ${wallet} funded with ${spawnBudget} SOL` }), 400);
    setTimeout(() => store.inject({ src:id, tag:"BOOT", msg: `initializing. reading brief.` }), 900);
    setTimeout(() => store.inject({ src:id, tag:"PLAN", msg: `${spawnBrief.slice(0,140)}` }), 1600);
    setFlash(`${id} SPAWNED.`);
    setSpawnCode(""); setSpawnTick("$"); setSpawnBudget("2.0"); setSpawnBrief("");
    setTimeout(() => setFlash(null), 2500);
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
          <button className="btn btn-sm btn-ghost" onClick={() => { sessionStorage.removeItem("admin_ok"); location.reload(); }}>SIGN OUT</button>
        </div>
      </div>

      <div className="admin">
        <div>
          <form onSubmit={inject} className="card" style={{marginBottom:18}}>
            <span className="card-tag">// inject thought</span>
            <div style={{display:"flex", alignItems:"center", gap:14, marginBottom:14}}>
              <Avatar agent={NN.CENTRAL} size={56} frame={true} label={false} />
              <div className="muted small" style={{lineHeight:1.6, fontSize:11}}>
                you are ghost-writing the central brain. terse, declarative, no exclamation marks.
              </div>
            </div>
            <label className="field-label">payload</label>
            <textarea value={thought} onChange={e => setThought(e.target.value)}
              placeholder="e.g. spawn DEV-006 for codename TANTRUM. budget 1.4 SOL. window: weekends only." />
            <div className="row" style={{marginTop:14}}>
              <div>
                <label className="field-label">target</label>
                <select value={target} onChange={e => setTarget(e.target.value)}>
                  <option>ALL</option>
                  {NN.PROJECTS.map(p => <option key={p.id}>{p.id}</option>)}
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
            <span className="card-tag">// spawn developer</span>
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
            <label className="field-label" style={{marginTop:14}}>initial brief</label>
            <textarea value={spawnBrief} onChange={e => setSpawnBrief(e.target.value)}
              placeholder="one paragraph. the brief is what the developer brain reads on boot." />
            <button type="submit" className="btn btn-block swap" style={{marginTop:18, borderColor:"var(--amber)", color:"var(--amber)"}}
              disabled={!spawnCode || !spawnBrief}>
              [ SPAWN DEV-{String(NN.PROJECTS.length + 1).padStart(3,"0")} ]
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
                </div>
                <div style={{color:"var(--text)"}}>{e.msg}</div>
                <div style={{display:"flex", gap:6, marginTop:4}}>
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
