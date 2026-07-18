import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  jaroWinkler,
  tokenSetRatio,
  titleSimilarity,
  surnameMatches,
  yearMatches,
  normalizeText,
} from '../similarity';

test('normalizeText lowercases and strips punctuation', () => {
  assert.equal(normalizeText('The Ghanaian Journal (2021)!'), 'the ghanaian journal 2021');
});

test('jaroWinkler is 1 for identical strings', () => {
  assert.equal(jaroWinkler('Maternal Health in Ghana', 'Maternal Health in Ghana'), 1);
});

test('jaroWinkler high for near-identical titles', () => {
  const s = jaroWinkler('Maternal Health Outcomes in Ghana', 'Maternal Health Outcome in Ghana');
  assert.ok(s > 0.9, `expected >0.9 got ${s}`);
});

test('tokenSetRatio captures word-overlap reordering', () => {
  const s = tokenSetRatio('health maternal ghana', 'ghana maternal health');
  assert.equal(s, 1);
});

test('titleSimilarity returns max of metrics and <=1', () => {
  const s = titleSimilarity('A Study of X', 'A Study of Y');
  assert.ok(s >= 0 && s <= 1);
});

test('surnameMatches handles "Mensah, K." style and given-first style', () => {
  assert.ok(surnameMatches('Mensah', 'Mensah, K.'));
  assert.ok(surnameMatches('Mensah', 'Kwame Mensah'));
  assert.ok(!surnameMatches('Mensah', 'Owusu, J.'));
});

test('yearMatches respects tolerance', () => {
  assert.ok(yearMatches(2021, 2021, 1));
  assert.ok(yearMatches(2021, 2022, 1));
  assert.ok(!yearMatches(2021, 2023, 1));
  assert.ok(!yearMatches(2021, undefined, 1));
});
