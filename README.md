# Rotation Board

A single-page web app for building basketball rotations: 6 periods, 5 on the floor, equal playing time, and your best five closing out the 6th period.

Open `index.html` in any browser (no install, no server). Your roster is saved in that browser's local storage.

## How it works

- **Roster**: each player has a position (PG, SG, F) and a grade (A, B, C). Toggle who's at the game. List order breaks ties within a grade, so order it like a depth chart.
- **Equal time**: 30 player-periods are split as evenly as possible across everyone present. If it doesn't divide evenly (e.g. 8 players → six play 4, two play 3), extra periods go to the best players or at random (your choice).
- **Period 6**: the strongest five by grade, fit to a PG / SG / SG / F / F lineup.
- **Periods 1–5**: an optimizer balances total strength across periods (A=3, B=2, C=1), keeps lineups close to PG / 2 SG / 2 F, avoids putting 3+ C players out together, and avoids long bench stretches.
- **Manual tweaks**: tap a player on the floor, then a bench player in the same period, to swap them. **Rebuild 1–5** keeps your (possibly edited) 6th period and rebuilds the rest.
- **Copy lineups** copies a text version of all six periods.
- **Export PDF** makes a printable game sheet in the league format: title, team name, date, a Player name / # column, periods 1–3, a HALFTIME column, periods 4–6, and the playing-time guide. Each period is marked with the player's position (P = point, W = wing, F = forward), position numbers 1–5, or an X. Add jersey numbers in the small # box next to each name.
