// Pure betting math. No DOM access, so it can be unit-tested in Node.

/** American odds (e.g. -110, +150) -> decimal odds (e.g. 1.909, 2.5). */
export function americanToDecimal(american) {
  const a = Number(american);
  if (!Number.isFinite(a) || (a > -100 && a < 100)) throw new RangeError('American odds must be <= -100 or >= +100');
  return a > 0 ? 1 + a / 100 : 1 + 100 / -a;
}

/** Decimal odds -> American odds (rounded to 2 dp). */
export function decimalToAmerican(decimal) {
  const d = Number(decimal);
  if (!Number.isFinite(d) || d <= 1) throw new RangeError('Decimal odds must be > 1');
  const a = d >= 2 ? (d - 1) * 100 : -100 / (d - 1);
  return Math.round(a * 100) / 100;
}

/** Fractional odds "5/2" -> decimal. */
export function fractionalToDecimal(frac) {
  const m = String(frac).trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (!m || Number(m[2]) === 0) throw new RangeError('Fractional odds look like 5/2');
  return 1 + Number(m[1]) / Number(m[2]);
}

/** Decimal -> closest simple fraction string, e.g. 2.5 -> "3/2". */
export function decimalToFractional(decimal) {
  const x = Number(decimal) - 1;
  if (!(x > 0)) throw new RangeError('Decimal odds must be > 1');
  let best = [Math.round(x), 1], bestErr = Math.abs(x - Math.round(x));
  for (let den = 2; den <= 100 && bestErr > 1e-9; den++) {
    const num = Math.round(x * den);
    const err = Math.abs(x - num / den);
    if (err < bestErr - 1e-12) { best = [num, den]; bestErr = err; }
  }
  return `${best[0]}/${best[1]}`;
}

/** Parse odds written in any common format: "-110", "+150", "2.5", "5/2". */
export function parseOdds(input) {
  const s = String(input).trim();
  if (s.includes('/')) return fractionalToDecimal(s);
  const n = Number(s);
  if (!Number.isFinite(n)) throw new RangeError(`Can't read odds "${s}"`);
  // Signed or |n| >= 100 -> American; otherwise decimal.
  if (/^[+-]/.test(s) || Math.abs(n) >= 100) return americanToDecimal(n);
  if (n <= 1) throw new RangeError('Decimal odds must be > 1');
  return n;
}

export const impliedProbability = (decimal) => 1 / decimal;

/**
 * Remove the bookmaker margin from a full market (all outcomes).
 * Uses the multiplicative (proportional) method.
 */
export function noVig(decimals) {
  const raw = decimals.map((d) => 1 / d);
  const total = raw.reduce((s, p) => s + p, 0);
  const fair = raw.map((p) => p / total);
  return {
    overround: total - 1, // e.g. 0.0476 = 4.76% vig
    fairProbabilities: fair,
    fairDecimals: fair.map((p) => 1 / p),
  };
}

/** Expected value per 1 unit staked, given your win probability (0..1). */
export const expectedValue = (decimal, winProb) => winProb * decimal - 1;

/** Full-Kelly fraction of bankroll (never negative). */
export function kellyFraction(decimal, winProb) {
  const b = decimal - 1;
  const f = (b * winProb - (1 - winProb)) / b;
  return Math.max(0, f);
}

/** Combined decimal odds of a parlay (independent legs). */
export const parlayDecimal = (decimals) => decimals.reduce((acc, d) => acc * d, 1);

/**
 * Arbitrage across outcomes of one market priced at different books.
 * Returns stake split that pays the same whatever happens.
 */
export function arbitrage(decimals, totalStake) {
  const inv = decimals.map((d) => 1 / d);
  const sum = inv.reduce((s, x) => s + x, 0);
  const stakes = inv.map((x) => (totalStake * x) / sum);
  const payout = totalStake / sum;
  return { isArb: sum < 1, margin: 1 - sum, stakes, payout, profit: payout - totalStake };
}

/** Profit/loss of a settled bet. */
export function betProfit({ stake, decimal, status }) {
  switch (status) {
    case 'won': return stake * (decimal - 1);
    case 'lost': return -stake;
    case 'half-won': return (stake / 2) * (decimal - 1);
    case 'half-lost': return -stake / 2;
    default: return 0; // pending, push, void
  }
}

/** Closing line value as a fraction: positive means you beat the close. */
export const closingLineValue = (takenDecimal, closingDecimal) => takenDecimal / closingDecimal - 1;

/** Aggregate stats for a list of bets ({stake, decimal, status, closingDecimal?}). */
export function summarize(bets) {
  const settled = bets.filter((b) => b.status !== 'pending');
  const graded = settled.filter((b) => b.status !== 'void' && b.status !== 'push');
  const staked = graded.reduce((s, b) => s + b.stake, 0);
  const net = settled.reduce((s, b) => s + betProfit(b), 0);
  const wins = graded.filter((b) => b.status === 'won' || b.status === 'half-won').length;
  const losses = graded.filter((b) => b.status === 'lost' || b.status === 'half-lost').length;
  const pushes = settled.filter((b) => b.status === 'push' || b.status === 'void').length;
  const clvs = bets.filter((b) => b.closingDecimal > 1).map((b) => closingLineValue(b.decimal, b.closingDecimal));
  const pending = bets.filter((b) => b.status === 'pending');
  return {
    count: bets.length,
    wins, losses, pushes,
    pendingCount: pending.length,
    pendingStake: pending.reduce((s, b) => s + b.stake, 0),
    staked,
    net,
    roi: staked > 0 ? net / staked : 0,
    winRate: wins + losses > 0 ? wins / (wins + losses) : 0,
    avgClv: clvs.length ? clvs.reduce((s, x) => s + x, 0) / clvs.length : null,
    clvCount: clvs.length,
  };
}
