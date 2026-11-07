import * as O from './odds.js';

// ---------- storage ----------
const KEY_BETS = 'betbook.bets.v1';
const KEY_SETTINGS = 'betbook.settings.v1';
const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

let bets = load(KEY_BETS, []);
let settings = { bankroll: 1000, unit: 10, currency: '$', lossLimit: '', maxStake: '', ...load(KEY_SETTINGS, {}) };
let editingId = null;

const persist = () => { save(KEY_BETS, bets); render(); };

// ---------- helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n, sign = false) => {
  const s = `${n < 0 ? '−' : sign && n > 0 ? '+' : ''}${settings.currency}${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return s;
};
const pct = (x, sign = true) => `${sign && x > 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
const cls = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');
const fmtAmerican = (d) => { const a = O.decimalToAmerican(d); return `${a > 0 ? '+' : ''}${Math.round(a)}`; };
const lines = (txt) => String(txt).split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const num = (v) => (v === '' || v == null ? null : Number(v));
const STATUS_LABEL = { pending: 'Pending', won: 'Won', lost: 'Lost', push: 'Push', 'half-won': 'Half won', 'half-lost': 'Half lost', void: 'Void' };

// ---------- tabs ----------
document.querySelectorAll('[role=tab]').forEach((btn) => btn.addEventListener('click', () => {
  document.querySelectorAll('[role=tab]').forEach((b) => b.setAttribute('aria-selected', b === btn));
  document.querySelectorAll('.tab').forEach((t) => { t.hidden = t.id !== `tab-${btn.dataset.tab}`; });
}));

// ---------- bet form ----------
const form = $('#bet-form');
form.date.value = today();

function previewForm() {
  const out = $('#form-preview');
  try {
    if (!form.odds.value.trim()) { out.textContent = ''; return; }
    const d = O.parseOdds(form.odds.value);
    const stake = Number(form.stake.value) || 0;
    let msg = `${fmtAmerican(d)} · ${d.toFixed(3)} · implied ${(100 / d).toFixed(1)}%`;
    if (stake) msg += ` · to win ${money(stake * (d - 1))}`;
    if (stake && settings.unit) msg += ` · ${(stake / settings.unit).toFixed(2)}u`;
    if (stake && settings.maxStake && stake > Number(settings.maxStake)) msg += ` · ⚠ above your max stake of ${money(Number(settings.maxStake))}`;
    out.textContent = msg;
  } catch (e) { out.textContent = e.message; }
}
form.addEventListener('input', previewForm);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  let decimal, closingDecimal = null;
  try { decimal = O.parseOdds(form.odds.value); } catch (err) { alert(`Odds: ${err.message}`); return; }
  if (form.closing.value.trim()) {
    try { closingDecimal = O.parseOdds(form.closing.value); } catch (err) { alert(`Closing odds: ${err.message}`); return; }
  }
  const bet = {
    id: editingId ?? uid(),
    date: form.date.value,
    sport: form.sport.value.trim(),
    event: form.event.value.trim(),
    pick: form.pick.value.trim(),
    market: form.market.value,
    oddsInput: form.odds.value.trim(),
    decimal,
    stake: Number(form.stake.value),
    book: form.book.value.trim(),
    closingInput: form.closing.value.trim(),
    closingDecimal,
    status: form.status.value,
  };
  if (editingId) bets = bets.map((b) => (b.id === editingId ? bet : b));
  else bets.push(bet);
  resetForm();
  persist();
});

function resetForm() {
  editingId = null;
  const keep = { date: form.date.value, sport: form.sport.value, book: form.book.value };
  form.reset();
  form.date.value = keep.date || today();
  form.sport.value = keep.sport;
  form.book.value = keep.book;
  $('#save-btn').textContent = 'Add bet';
  $('#cancel-edit').hidden = true;
  previewForm();
}
$('#cancel-edit').addEventListener('click', resetForm);

function startEdit(id) {
  const b = bets.find((x) => x.id === id);
  if (!b) return;
  editingId = id;
  for (const [k, v] of Object.entries({ date: b.date, sport: b.sport, event: b.event, pick: b.pick, market: b.market,
    odds: b.oddsInput, stake: b.stake, book: b.book, closing: b.closingInput ?? '', status: b.status })) form[k].value = v ?? '';
  $('#save-btn').textContent = 'Save changes';
  $('#cancel-edit').hidden = false;
  previewForm();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- table ----------
const tbody = $('#bets-table tbody');
tbody.addEventListener('change', (e) => {
  if (!e.target.matches('select[data-id]')) return;
  const b = bets.find((x) => x.id === e.target.dataset.id);
  if (b) { b.status = e.target.value; persist(); }
});
tbody.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.act === 'edit') startEdit(id);
  if (btn.dataset.act === 'del' && confirm('Delete this bet?')) { bets = bets.filter((b) => b.id !== id); persist(); }
});
['#filter-status', '#filter-sport', '#filter-text'].forEach((s) => $(s).addEventListener('input', renderTable));

function filteredBets() {
  const st = $('#filter-status').value, sp = $('#filter-sport').value, q = $('#filter-text').value.toLowerCase();
  return bets.filter((b) =>
    (!st || (st === 'pending' ? b.status === 'pending' : b.status !== 'pending')) &&
    (!sp || b.sport === sp) &&
    (!q || `${b.event} ${b.pick} ${b.book} ${b.sport} ${b.market}`.toLowerCase().includes(q)));
}

function renderTable() {
  const rows = filteredBets().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  $('#empty').hidden = bets.length > 0;
  tbody.innerHTML = rows.map((b) => {
    const pl = O.betProfit(b);
    const clv = b.closingDecimal > 1 ? O.closingLineValue(b.decimal, b.closingDecimal) : null;
    const opts = Object.entries(STATUS_LABEL).map(([v, l]) => `<option value="${v}"${v === b.status ? ' selected' : ''}>${l}</option>`).join('');
    return `<tr>
      <td>${esc(b.date)}<div class="sub">${esc(b.sport)}</div></td>
      <td>${esc(b.event)}<div class="sub">${esc(b.pick)} <span class="chip">${esc(b.market)}</span>${b.book ? ` · ${esc(b.book)}` : ''}</div></td>
      <td>${fmtAmerican(b.decimal)}<div class="sub">${b.decimal.toFixed(2)}</div></td>
      <td>${money(b.stake)}${settings.unit ? `<div class="sub">${(b.stake / settings.unit).toFixed(2)}u</div>` : ''}</td>
      <td><select data-id="${esc(b.id)}" aria-label="Result">${opts}</select></td>
      <td class="num ${cls(pl)}">${b.status === 'pending' ? `<span class="sub">to win ${money(b.stake * (b.decimal - 1))}</span>` : money(pl, true)}</td>
      <td class="num ${cls(clv)}">${clv == null ? '—' : pct(clv)}</td>
      <td><button class="link" data-act="edit" data-id="${esc(b.id)}" aria-label="Edit">Edit</button><button class="link" data-act="del" data-id="${esc(b.id)}" aria-label="Delete">✕</button></td>
    </tr>`;
  }).join('');
}

// ---------- stats, chart, breakdown ----------
function renderStats() {
  const s = O.summarize(bets);
  const current = Number(settings.bankroll || 0) + s.net;
  const tiles = [
    ['Bankroll', money(current), `started ${money(Number(settings.bankroll || 0))}`, cls(s.net)],
    ['Net profit', money(s.net, true), settings.unit ? `${(s.net / settings.unit).toFixed(2)} units` : '', cls(s.net)],
    ['ROI', pct(s.roi), `on ${money(s.staked)} staked`, cls(s.roi)],
    ['Record', `${s.wins}–${s.losses}${s.pushes ? `–${s.pushes}` : ''}`, s.wins + s.losses ? `${(s.winRate * 100).toFixed(1)}% win rate` : 'no settled bets', ''],
    ['Open bets', String(s.pendingCount), `${money(s.pendingStake)} at risk`, ''],
    ['Avg CLV', s.avgClv == null ? '—' : pct(s.avgClv), s.clvCount ? `${s.clvCount} bets with closing odds` : 'add closing odds to track', cls(s.avgClv ?? 0)],
  ];
  $('#stats').innerHTML = tiles.map(([k, v, sub, c]) =>
    `<div class="stat"><div class="k">${k}</div><div class="v ${c}">${v}</div><div class="s">${esc(sub)}</div></div>`).join('');
}

function renderChart() {
  const start = Number(settings.bankroll || 0);
  const settled = bets.filter((b) => b.status !== 'pending').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const el = $('#chart');
  if (settled.length < 2) { el.innerHTML = '<p class="hint">Settle a couple of bets to see your bankroll curve.</p>'; return; }
  const pts = [start];
  settled.forEach((b) => pts.push(pts[pts.length - 1] + O.betProfit(b)));
  const W = Math.max(280, el.clientWidth || 800), H = 180, P = { l: 66, r: 8, t: 10, b: 20 };
  const min = Math.min(...pts, start), max = Math.max(...pts, start), span = max - min || 1;
  const x = (i) => P.l + (i / (pts.length - 1)) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - (v - min) / span) * (H - P.t - P.b);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bankroll after each settled bet">
    <line class="axis" x1="${P.l}" x2="${W - P.r}" y1="${H - P.b}" y2="${H - P.b}"/>
    <line class="zero" x1="${P.l}" x2="${W - P.r}" y1="${y(start)}" y2="${y(start)}"/>
    <text x="${P.l - 6}" y="${y(max) + 4}" text-anchor="end">${money(max)}</text>
    <text x="${P.l - 6}" y="${y(min) + 4}" text-anchor="end">${money(min)}</text>
    <text x="${P.l}" y="${H - 4}">${esc(settled[0].date)}</text>
    <text x="${W - P.r}" y="${H - 4}" text-anchor="end">${esc(settled[settled.length - 1].date)}</text>
    <path class="line" d="${d}" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

function renderBreakdown() {
  const groups = {};
  bets.forEach((b) => { (groups[b.sport || '—'] ??= []).push(b); });
  const rows = Object.entries(groups).map(([k, list]) => [k, O.summarize(list)]).sort((a, b) => b[1].net - a[1].net);
  $('#breakdown').innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>Sport</th><th>Record</th><th class="num">Staked</th><th class="num">Net</th><th class="num">ROI</th></tr></thead><tbody>${
    rows.map(([k, s]) => `<tr><td>${esc(k)}</td><td>${s.wins}–${s.losses}${s.pushes ? `–${s.pushes}` : ''}</td><td class="num">${money(s.staked)}</td><td class="num ${cls(s.net)}">${money(s.net, true)}</td><td class="num ${cls(s.roi)}">${pct(s.roi)}</td></tr>`).join('')
  }</tbody></table></div>` : '<p class="hint">Nothing yet.</p>';
}

function renderLists() {
  const uniq = (k) => [...new Set(bets.map((b) => b[k]).filter(Boolean))].sort();
  $('#sports').innerHTML = uniq('sport').map((s) => `<option value="${esc(s)}">`).join('');
  $('#books').innerHTML = uniq('book').map((s) => `<option value="${esc(s)}">`).join('');
  const sel = $('#filter-sport'), cur = sel.value;
  sel.innerHTML = '<option value="">All sports</option>' + uniq('sport').map((s) => `<option${s === cur ? ' selected' : ''}>${esc(s)}</option>`).join('');
}

function renderLimits() {
  const banner = $('#limit-banner');
  const limit = Number(settings.lossLimit);
  if (!limit) { banner.hidden = true; return; }
  const month = today().slice(0, 7);
  const net = bets.filter((b) => (b.date || '').startsWith(month)).reduce((s, b) => s + O.betProfit(b), 0);
  const lost = -net;
  if (lost >= limit) {
    banner.textContent = `You've lost ${money(lost)} this month, which is past your ${money(limit)} limit. Consider taking a break until next month.`;
    banner.hidden = false;
  } else if (lost >= limit * 0.75) {
    banner.textContent = `Heads up: you're down ${money(lost)} this month, ${Math.round((lost / limit) * 100)}% of your ${money(limit)} limit.`;
    banner.hidden = false;
  } else banner.hidden = true;
}

function render() { renderStats(); renderChart(); renderLists(); renderTable(); renderBreakdown(); renderLimits(); }

// ---------- calculators ----------
function calc(id, fn) {
  const f = $(id), out = $('output', f);
  const run = () => { try { out.innerHTML = fn(f); } catch (e) { out.innerHTML = `<span class="err">${esc(e.message)}</span>`; } };
  f.addEventListener('input', run); f.addEventListener('submit', (e) => e.preventDefault()); run();
}
const dl = (pairs) => `<dl>${pairs.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;

calc('#c-convert', (f) => {
  const d = O.parseOdds(f.odds.value);
  return dl([['American', fmtAmerican(d)], ['Decimal', d.toFixed(3)], ['Fractional', O.decimalToFractional(d)], ['Implied probability', `${(100 / d).toFixed(2)}%`]]);
});

calc('#c-novig', (f) => {
  const ds = lines(f.odds.value).map(O.parseOdds);
  if (ds.length < 2) throw new Error('Enter at least two outcomes.');
  const r = O.noVig(ds);
  return dl([['Book margin (vig)', `${(r.overround * 100).toFixed(2)}%`],
    ...r.fairProbabilities.map((p, i) => [`Outcome ${i + 1}`, `${(p * 100).toFixed(1)}% · fair ${fmtAmerican(r.fairDecimals[i])}`])]);
});

calc('#c-ev', (f) => {
  const d = O.parseOdds(f.odds.value);
  const p = Number(f.prob.value) / 100;
  if (!(p > 0 && p < 1)) throw new Error('Probability must be between 0 and 100.');
  const ev = O.expectedValue(d, p);
  const k = O.kellyFraction(d, p) * Number(f.mult.value);
  const stake = k * Number(f.bankroll.value || 0);
  const breakEven = 1 / d;
  return dl([['Break-even win %', `${(breakEven * 100).toFixed(2)}%`],
    ['Edge', `<span class="${cls(p - breakEven)}">${pct(p - breakEven)}</span>`],
    ['EV per 100 staked', `<span class="${cls(ev)}">${ev >= 0 ? '+' : ''}${(ev * 100).toFixed(2)}</span>`],
    ['Kelly stake', k > 0 ? `${money(stake)} (${(k * 100).toFixed(2)}% of bankroll)` : 'No bet (negative edge)']]);
});

calc('#c-parlay', (f) => {
  const ds = lines(f.odds.value).map(O.parseOdds);
  if (!ds.length) throw new Error('Add at least one leg.');
  const d = O.parlayDecimal(ds);
  const stake = Number(f.stake.value || 0);
  return dl([['Legs', ds.length], ['Parlay odds', `${fmtAmerican(d)} (${d.toFixed(2)})`],
    ['Implied probability', `${(100 / d).toFixed(2)}%`], ['Payout', money(stake * d)], ['Profit', money(stake * (d - 1))]]);
});

calc('#c-arb', (f) => {
  const ds = lines(f.odds.value).map(O.parseOdds);
  if (ds.length < 2) throw new Error('Enter at least two outcomes.');
  const r = O.arbitrage(ds, Number(f.stake.value || 0));
  return dl([[r.isArb ? 'Arbitrage!' : 'No arbitrage', `<span class="${cls(r.margin)}">${pct(r.margin)} margin</span>`],
    ...r.stakes.map((s, i) => [`Stake on ${fmtAmerican(ds[i])}`, money(s)]),
    ['Payout any result', money(r.payout)], ['Locked profit', `<span class="${cls(r.profit)}">${money(r.profit, true)}</span>`]]);
});

// ---------- settings & data ----------
const sf = $('#settings-form');
const fillSettings = () => { for (const k of ['bankroll', 'unit', 'currency', 'lossLimit', 'maxStake']) sf[k].value = settings[k] ?? ''; };
fillSettings();
sf.addEventListener('submit', (e) => {
  e.preventDefault();
  settings = { bankroll: num(sf.bankroll.value) ?? 0, unit: num(sf.unit.value) ?? 0, currency: sf.currency.value || '$',
    lossLimit: sf.lossLimit.value, maxStake: sf.maxStake.value };
  save(KEY_SETTINGS, settings);
  render();
  const btn = $('button[type=submit]', sf); btn.textContent = 'Saved ✓'; setTimeout(() => { btn.textContent = 'Save'; }, 1200);
});

const download = (name, text, type) => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('#export-json').addEventListener('click', () => download(`betbook-${today()}.json`, JSON.stringify({ settings, bets }, null, 2), 'application/json'));
$('#export-csv').addEventListener('click', () => {
  const cols = ['date', 'sport', 'event', 'pick', 'market', 'book', 'oddsInput', 'decimal', 'stake', 'status', 'closingInput', 'profit'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...bets.map((b) => cols.map((c) => q(c === 'profit' ? O.betProfit(b).toFixed(2) : b[c])).join(','))].join('\n');
  download(`betbook-${today()}.csv`, csv, 'text/csv');
});
$('#import-json').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data.bets;
    if (!Array.isArray(incoming)) throw new Error('No bets found in file.');
    const valid = incoming.filter((b) => b && b.decimal > 1 && b.stake > 0 && STATUS_LABEL[b.status]).map((b) => ({ ...b, id: b.id || uid() }));
    const ids = new Set(bets.map((b) => b.id));
    const added = valid.filter((b) => !ids.has(b.id));
    bets.push(...added);
    if (data.settings && confirm('Also import bankroll settings from this file?')) { settings = { ...settings, ...data.settings }; save(KEY_SETTINGS, settings); fillSettings(); }
    persist();
    alert(`Imported ${added.length} bet(s).`);
  } catch (err) { alert(`Import failed: ${err.message}`); }
  e.target.value = '';
});
$('#clear-all').addEventListener('click', () => {
  if (bets.length && confirm(`Delete all ${bets.length} bets? Export a backup first if you want to keep them.`)) { bets = []; persist(); }
});

render();
previewForm();
let resizeTimer;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderChart, 150); });
