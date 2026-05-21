/** Empty seed — operators spawn all developers and log entries from admin. */
export const PROJECTS = [];

const SEED_LINES = [];

export function buildSeedLog() {
  const now = Date.now();
  return SEED_LINES.map((l, i) => ({
    id: "L" + (1000 + i),
    ts: now + l.dt,
    src: l.src,
    tag: l.tag,
    msg: l.msg,
    public: true,
    redacted: false,
  })).sort((a, b) => a.ts - b.ts);
}
