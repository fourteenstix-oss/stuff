# Betbook

A sports betting tracker and odds toolkit that runs entirely in your browser. No account, no server: your bets live in your browser's local storage.

## Run it

```sh
npm start          # serves the folder at http://localhost:8000
```

Any static file server works (the app uses ES modules, so opening `index.html` straight from disk won't load).

## What it does

**Tracker**
- Log bets with odds in any format (`-110`, `+150`, `2.5`, `5/2`), stake, sport, market, book and result.
- Live stats: current bankroll, net profit (also in units), ROI, record and win rate, money at risk on open bets.
- **Closing line value (CLV)**: add the closing odds and see whether you're beating the market, the best long-run signal of a winning bettor.
- Bankroll chart over time and a per-sport breakdown.
- Change results inline, edit, delete, filter and search.

**Calculators**
- Odds converter (American / decimal / fractional / implied %).
- No-vig fair odds: strips the bookmaker margin from a full market.
- Expected value and Kelly stake (full, half, quarter, tenth Kelly).
- Parlay odds and payout.
- Arbitrage / hedge stake splitter.

**Bankroll & limits**
- Starting bankroll, unit size, currency.
- Monthly loss limit (banner warns at 75% and 100%) and a max-stake warning when logging bets.
- Export to JSON or CSV, import JSON backups.

## Develop

```sh
npm test           # unit tests for the betting math in odds.js
```

`odds.js` holds all the math with no DOM access; `app.js` is the UI.

## Play responsibly

Every price has a margin built in, so most bettors lose over time. Bet only what you can afford to lose. US help line: 1-800-GAMBLER.
