import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAgentResponse } from '../perplexity-agent.js';

// Shape from Perplexity's Sonar → Agent API migration guide.
const sample = {
  id: 'resp_1',
  object: 'response',
  status: 'completed',
  output: [
    {
      type: 'search_results',
      results: [
        { id: 1, title: 'State of AI Agents 2026', url: 'https://example.org/a', snippet: 'x', date: '2026-09-01' },
        { id: 2, title: 'No URL', snippet: 'dropped' },
      ],
    },
    {
      type: 'message',
      content: [{ type: 'output_text', text: 'Agents are improving [1].', annotations: [] }],
    },
  ],
};

test('parseAgentResponse reads the message text and the search results', () => {
  const r = parseAgentResponse(sample);
  assert.equal(r.text, 'Agents are improving [1].');
  assert.deepEqual(r.sources, [{ title: 'State of AI Agents 2026', url: 'https://example.org/a', snippet: 'x', date: '2026-09-01' }]);
  assert.equal(r.inputTokens, 0);
});

test('parseAgentResponse prefers output_text and reads usage when present', () => {
  const r = parseAgentResponse({ ...sample, output_text: 'Top-level text', usage: { input_tokens: 12, output_tokens: 34 } });
  assert.equal(r.text, 'Top-level text');
  assert.equal(r.inputTokens, 12);
  assert.equal(r.outputTokens, 34);
});

test('parseAgentResponse copes with an empty body', () => {
  const r = parseAgentResponse({});
  assert.equal(r.text, '');
  assert.deepEqual(r.sources, []);
});
