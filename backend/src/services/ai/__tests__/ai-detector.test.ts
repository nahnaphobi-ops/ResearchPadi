import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectAIContent, MIN_WORDS_TO_JUDGE } from '../ai-detector.service.js';

// Field notes in a student's own voice: uneven sentences, no stock phrases.
const HUMAN = 'Kejetia is loud before seven in the morning. '
  + 'Traders arrive with head pans of tomatoes, plantain and second-hand shoes, and by nine most of them have taken their first MoMo payment of the day. '
  + 'I spent three weeks there in March, talking to forty sellers about how they keep track of money. '
  + 'Few keep written records. '
  + 'One woman selling cloth near the lorry station showed me a notebook with every transfer since 2021, each line signed by the buyer, which surprised the traders around her. '
  + 'Fees came up in almost every conversation. '
  + "So did the e-levy, which several sellers still call 'the tax on our phones' even after the rate was cut. "
  + 'Younger traders were less worried; they treat the wallet as a savings box and move money to the bank only when school fees fall due.';

// Typical machine prose: stock phrases, hedging, filler and evenly sized sentences.
const AI_PARAGRAPH = 'Furthermore, mobile money plays a crucial role in the economic landscape of Ghana. '
  + 'Moreover, it is important to note that digital payments underscore the pivotal shift in trading. '
  + 'Additionally, traders delve into new financial tools with nuanced expectations about their value. '
  + 'In this context, it is worth noting that adoption remains multifaceted across market segments. '
  + 'Consequently, it is possible that policy makers will use these insights to support inclusion. '
  + 'Furthermore, the evidence sheds light on the paramount importance of trust in digital systems. '
  + 'Moreover, it appears that fees remain a pivotal barrier for many small and medium traders. '
  + 'Additionally, this pattern underscores the need for strong consumer protection in the sector. '
  + 'In terms of policy, it is important to note that regulation must keep pace with innovation. '
  + 'In conclusion, mobile money plays a vital role in shaping the future of commerce in Ghana.';
const AI_TEXT = `${AI_PARAGRAPH} ${AI_PARAGRAPH}`;

const repeat = (text: string, times: number) => Array.from({ length: times }, () => text).join(' ');

test('human writing scores low', () => {
  const result = detectAIContent(repeat(HUMAN, 2));
  assert.ok(result.aiScore < 20, `aiScore ${result.aiScore}`);
  assert.equal(result.isLikelyAI, false);
});

test('a long document is not flagged for its length', () => {
  // About 1,700 words. A whole-text ratio of distinct words would sink and flag this.
  const short = detectAIContent(repeat(HUMAN, 2));
  const long = detectAIContent(repeat(HUMAN, 12));
  assert.ok(long.aiScore < 20, `aiScore ${long.aiScore}`);
  assert.ok(Math.abs(long.aiScore - short.aiScore) <= 5);
  assert.equal(long.isLikelyAI, false);
  assert.ok(!long.indicators.some(i => i.type === 'Repetitive vocabulary'));
});

test('text full of AI patterns scores as likely AI', () => {
  const result = detectAIContent(AI_TEXT);
  assert.ok(result.aiScore > 50, `aiScore ${result.aiScore}`);
  assert.equal(result.isLikelyAI, true);
  assert.equal(result.indicators[0].type, 'Stock AI phrases');
  assert.equal(result.indicators[0].severity, 'high');
  assert.ok(result.indicators.some(i => i.type === 'Even sentence lengths'));
});

test('one pattern on its own cannot make a text likely AI', () => {
  const everySentenceFurthermore = repeat(HUMAN, 3).replace(/(^|\. )([A-Z])/g, '$1Furthermore, $2');
  const result = detectAIContent(everySentenceFurthermore);
  const stock = result.indicators.find(i => i.type === 'Stock AI phrases');
  assert.equal(stock?.severity, 'high');
  assert.ok(result.aiScore < 35, `aiScore ${result.aiScore}`);
  assert.equal(result.isLikelyAI, false);
});

test('short text is not judged, but its patterns are still listed', () => {
  const text = 'Mobile money has changed how traders in Kumasi handle payments. Furthermore, it is important to note that many market women at Kejetia now accept MTN MoMo for daily sales. Studies show that 80% of traders use mobile money at least once a week.';
  const result = detectAIContent(text);
  assert.equal(result.isLikelyAI, false);
  assert.match(result.recommendation, new RegExp(`Too little text.*${MIN_WORDS_TO_JUDGE} words`));
  const stock = result.indicators.find(i => i.type === 'Stock AI phrases');
  assert.ok(stock);
  assert.match(stock.description, /"furthermore", "it is important to note"/);
});

test('scores stay between 0 and 100 and the result says it is not proof', () => {
  for (const text of ['', 'Hello.', HUMAN, AI_TEXT, repeat(HUMAN, 12)]) {
    const result = detectAIContent(text);
    assert.ok(result.aiScore >= 0 && result.aiScore <= 100, `aiScore ${result.aiScore}`);
    assert.equal(result.humanScore, 100 - result.aiScore);
    assert.ok(result.confidence >= 40 && result.confidence <= 90);
    assert.match(result.recommendation, /not proof/);
  }
});
