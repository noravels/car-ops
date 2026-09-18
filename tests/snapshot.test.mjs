import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldWrite, appendSnapshot } from '../snapshot.mjs';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function withTmp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'carops-'));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('shouldWrite: aynı gün, fiyat değişmediyse yazmaz', () => {
  const existing = [
    JSON.stringify({ ts: '2026-09-18T08:00:00Z', price_try: 800000, km: 120000, status: 'aktif' }),
  ];
  assert.equal(shouldWrite(existing, 800000, 120000, 'aktif', '2026-09-18'), false);
});

test('shouldWrite: fiyat değiştiyse yazar', () => {
  const existing = [
    JSON.stringify({ ts: '2026-09-18T08:00:00Z', price_try: 800000, km: 120000, status: 'aktif' }),
  ];
  assert.equal(shouldWrite(existing, 790000, 120000, 'aktif', '2026-09-18'), true);
});

test('shouldWrite: ilan kapandıysa bilgi yazar, tekrar yazmaz', () => {
  const existing = [
    JSON.stringify({ ts: '2026-09-18T08:00:00Z', price_try: 800000, km: 120000, status: 'aktif' }),
  ];
  assert.equal(shouldWrite(existing, 800000, 120000, 'kapandi', '2026-09-18'), true);
  const after = [...existing,
    JSON.stringify({ ts: '2026-09-19T08:00:00Z', price_try: 800000, km: 120000, status: 'kapandi' })];
  assert.equal(shouldWrite(after, 800000, 120000, 'kapandi', '2026-09-19'), false);
});

test('appendSnapshot: jsonl append eder, USD eşdeğerini ekler', () => {
  withTmp(dir => {
    const file = join(dir, 'snap.jsonl');
    appendSnapshot(file, '2026-09-18T10:00:00Z', 800000, 19047.6, 120000, 'aktif');
    const lines = readFileSync(file, 'utf8').trim().split('\n');
    assert.equal(lines.length, 1);
    const row = JSON.parse(lines[0]);
    assert.equal(row.price_try, 800000);
    assert.ok(Math.abs(row.price_usd_equiv - 19047.6) < 0.01);
    assert.equal(row.km, 120000);
  });
});

test('appendSnapshot: bozuk girişte dosya bozulmaz (atomik)', () => {
  withTmp(dir => {
    const file = join(dir, 'snap2.jsonl');
    appendSnapshot(file, '2026-09-18T10:00:00Z', null, null, 120000, 'aktif');
    assert.ok(existsSync(file));
    const row = JSON.parse(readFileSync(file, 'utf8').trim());
    assert.equal(row.price_try, null);
  });
});
