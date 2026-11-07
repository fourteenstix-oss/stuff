import test from 'node:test';
import assert from 'node:assert/strict';
import * as o from '../odds.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !≈ ${b}`);

test('odds conversions', () => {
  close(o.americanToDecimal(-110), 1.9090909);
  close(o.americanToDecimal(150), 2.5);
  assert.equal(o.decimalToAmerican(2.5), 150);
  assert.equal(o.decimalToAmerican(1.5), -200);
  close(o.fractionalToDecimal('5/2'), 3.5);
  assert.equal(o.decimalToFractional(3.5), '5/2');
  assert.equal(o.decimalToFractional(1.5), '1/2');
  assert.throws(() => o.americanToDecimal(50));
});

test('parseOdds accepts every format', () => {
  close(o.parseOdds('-110'), 1.9090909);
  close(o.parseOdds('+150'), 2.5);
  close(o.parseOdds('150'), 2.5);
  close(o.parseOdds('2.5'), 2.5);
  close(o.parseOdds('5/2'), 3.5);
  assert.throws(() => o.parseOdds('abc'));
  assert.throws(() => o.parseOdds('0.8'));
});

test('no-vig on a -110/-110 market', () => {
  const d = o.americanToDecimal(-110);
  const r = o.noVig([d, d]);
  close(r.overround, 0.0476190);
  close(r.fairProbabilities[0], 0.5);
  close(r.fairDecimals[0], 2);
});

test('EV and Kelly', () => {
  close(o.expectedValue(2.0, 0.55), 0.10);
  close(o.kellyFraction(2.0, 0.55), 0.10);
  assert.equal(o.kellyFraction(2.0, 0.4), 0);
});

test('parlay and arbitrage', () => {
  close(o.parlayDecimal([2, 2, 2]), 8);
  const arb = o.arbitrage([2.1, 2.1], 100);
  assert.ok(arb.isArb);
  close(arb.stakes[0], 50);
  close(arb.payout, 105);
  close(arb.profit, 5);
  assert.equal(o.arbitrage([1.9, 1.9], 100).isArb, false);
});

test('bet settlement and summary', () => {
  const bets = [
    { stake: 100, decimal: 2.0, status: 'won', closingDecimal: 1.9 },
    { stake: 100, decimal: 2.0, status: 'lost' },
    { stake: 50, decimal: 1.9, status: 'push' },
    { stake: 20, decimal: 3.0, status: 'pending' },
  ];
  const s = o.summarize(bets);
  assert.equal(s.net, 0);
  assert.equal(s.staked, 200);
  assert.equal(s.wins, 1);
  assert.equal(s.losses, 1);
  assert.equal(s.pushes, 1);
  assert.equal(s.pendingStake, 20);
  close(s.winRate, 0.5);
  close(s.avgClv, 2 / 1.9 - 1);
  close(o.betProfit({ stake: 100, decimal: 3, status: 'half-won' }), 100);
});
