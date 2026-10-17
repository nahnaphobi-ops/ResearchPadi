import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSourceDetails, parseSuggestions } from '../metadata.service.js';

const NOW = new Date(Date.UTC(2026, 9, 17));

test('detected details are kept when sensible', () => {
  const d = parseSourceDetails('```json\n{"title":"Mobile money and savings in Kumasi","authors":["Mensah, Kwame","Ama Owusu"],"year":2021}\n```', NOW);
  assert.equal(d.title, 'Mobile money and savings in Kumasi');
  assert.equal(d.authors, 'Mensah, Kwame; Owusu, Ama');
  assert.equal(d.year, 2021);
});

test('doubtful details are dropped, never guessed', () => {
  assert.deepEqual(parseSourceDetails('{"title":"","authors":[],"year":0}', NOW), {});
  assert.deepEqual(parseSourceDetails('{"title":"ok","year":2099}', NOW), {});
  assert.deepEqual(parseSourceDetails('not json', NOW), {});
  assert.equal(parseSourceDetails('{"year":"2020"}', NOW).year, 2020);
});

test('suggestions are short questions, at most three', () => {
  assert.deepEqual(parseSuggestions('["What do the sources say about cost?", "x", "How was data collected in Kumasi?", "Which findings conflict?", "Extra one here?"]'),
    ['What do the sources say about cost?', 'How was data collected in Kumasi?', 'Which findings conflict?']);
  assert.deepEqual(parseSuggestions('nothing'), []);
});
