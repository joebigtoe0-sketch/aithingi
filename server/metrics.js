/** Live metrics: dev wallet SOL (Alchemy) + token mcap/holders (DexScreener / GeckoTerminal). */

const LAMPORTS_PER_SOL = 1_000_000_000;
const METRICS_TTL_MS = 45_000;

const lastRefresh = new Map();

function alchemyUrl() {
  const key = process.env.ALCHEMY_API_KEY?.trim();
  if (!key) return null;
  return `https://solana-mainnet.g.alchemy.com/v2/${key}`;
}

export function isAlchemyConfigured() {
  return Boolean(process.env.ALCHEMY_API_KEY?.trim());
}

export function isValidSolanaAddress(addr) {
  return typeof addr === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());
}

export async function fetchSolBalance(wallet) {
  const url = alchemyUrl();
  if (!url) throw new Error("ALCHEMY_API_KEY not configured");
  if (!isValidSolanaAddress(wallet)) throw new Error("invalid Solana wallet address");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [wallet.trim()],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.error) throw new Error(data.error.message || "alchemy balance failed");
  const lamports = Number(data.result?.value ?? 0);
  return lamports / LAMPORTS_PER_SOL;
}

export async function fetchDexTokenStats(mint) {
  if (!isValidSolanaAddress(mint)) return { marketCap: 0, holders: 0, priceUsd: null };

  let marketCap = 0;
  let priceUsd = null;
  let holders = 0;

  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint.trim()}`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      const pairs = data.pairs || [];
      let best = null;
      let bestLiq = -1;
      for (const pair of pairs) {
        const liq = Number(pair.liquidity?.usd || 0);
        if (liq > bestLiq) {
          bestLiq = liq;
          best = pair;
        }
      }
      if (best) {
        marketCap = Math.round(Number(best.marketCap || best.fdv || 0));
        priceUsd = Number(best.priceUsd || 0) || null;
      }
    }
  } catch (err) {
    console.warn("[metrics] dexscreener", err.message);
  }

  if (!holders) {
    try {
      const gRes = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint.trim()}`,
        { headers: { Accept: "application/json" } }
      );
      if (gRes.ok) {
        const gData = await gRes.json();
        const hc = gData?.data?.attributes?.holders_count;
        if (hc != null) holders = Math.round(Number(hc));
      }
    } catch (err) {
      console.warn("[metrics] geckoterminal holders", err.message);
    }
  }

  return { marketCap, holders, priceUsd };
}

export async function refreshProjectMetrics(project, { force = false } = {}) {
  const key = project.tokenId || project.id;
  const now = Date.now();
  if (!force && lastRefresh.get(key) && now - lastRefresh.get(key) < METRICS_TTL_MS) {
    return {};
  }

  const updates = { metricsUpdatedAt: now };
  const tasks = [];

  if (project.wallet && isAlchemyConfigured()) {
    tasks.push(
      fetchSolBalance(project.wallet)
        .then((bal) => { updates.balance = bal; })
        .catch((err) => console.warn(`[metrics] balance ${key}`, err.message))
    );
  }

  const mint = project.tokenMint || project.token_mint;
  if (mint && isValidSolanaAddress(mint)) {
    tasks.push(
      fetchDexTokenStats(mint)
        .then(({ marketCap, holders, priceUsd }) => {
          if (marketCap > 0) updates.marketCap = marketCap;
          if (holders > 0) updates.holders = holders;
          if (priceUsd != null) updates.priceUsd = priceUsd;
        })
        .catch((err) => console.warn(`[metrics] token ${key}`, err.message))
    );
  }

  await Promise.all(tasks);
  lastRefresh.set(key, now);
  return updates;
}
