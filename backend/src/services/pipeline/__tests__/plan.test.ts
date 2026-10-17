import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePaperPlan, splitQuestions, applyPlanToSections, saneSampleSize, formatPlan } from '../plan.service.js';
import { CHAPTER_STRUCTURE } from '../../ai/prompts.js';

const good = {
  problem: 'Market women in Kumasi have phones but few use mobile money to save.',
  aim: 'To examine mobile money use for saving among market women in Kumasi.',
  objectives: ['To examine use', 'To assess barriers', 'To determine effects'],
  researchQuestions: ['How is it used?', 'What barriers exist?', 'What are the effects?'],
  literatureThemes: ['Financial inclusion', 'Mobile money adoption', 'Savings behaviour', 'Gender and finance'],
  framework: { name: 'Technology Acceptance Model', rationale: 'Explains adoption.' },
  design: { approach: 'quantitative', design: 'Cross-sectional survey', studyArea: 'Kejetia Market, Kumasi', population: 'Market women', sampleSize: 217.4, sampling: 'Simple random', instrument: 'Questionnaire', analysis: 'SPSS 26' },
  findingThemes: ['Patterns of use', 'Barriers', 'Effects on saving'],
  ghanaContext: [{ point: 'Mobile money is widespread in Ghana', source: '(Mensah, 2021)' }],
  argument: 'Chapter 1 sets the problem; Chapter 2 builds the frame.',
};

test('parses a plan wrapped in prose or code fences', () => {
  const plan = parsePaperPlan('Here it is:\n```json\n' + JSON.stringify(good) + '\n```');
  assert.ok(plan);
  assert.equal(plan.design.sampleSize, 217);
  assert.equal(plan.literatureThemes.length, 4);
  assert.equal(plan.findingThemes.length, 3);
});

test('rejects broken JSON and plans missing themes', () => {
  assert.equal(parsePaperPlan('not json'), null);
  assert.equal(parsePaperPlan('{ "objectives": [' ), null);
  assert.equal(parsePaperPlan(JSON.stringify({ ...good, literatureThemes: ['Only one'] })), null);
});

test("the student's own research questions win", () => {
  const plan = parsePaperPlan(JSON.stringify(good), ['How do traders save with mobile money?', 'What stops them saving more?']);
  assert.deepEqual(plan?.researchQuestions, ['How do traders save with mobile money?', 'What stops them saving more?']);
});

test('splits numbered or bulleted research questions', () => {
  assert.deepEqual(
    splitQuestions('1. How do traders use mobile money?\n2) What barriers do they face?\n- What effects follow?\nshort'),
    ['How do traders use mobile money?', 'What barriers do they face?', 'What effects follow?'],
  );
});

test('sample sizes stay whole and believable for the design', () => {
  assert.equal(saneSampleSize(5000, 'quantitative'), 600);
  assert.equal(saneSampleSize(3, 'quantitative'), 50);
  assert.equal(saneSampleSize(200, 'qualitative'), 40);
  assert.equal(saneSampleSize('abc', 'qualitative'), 15);
});

test('theme placeholders are replaced with the planned titles', () => {
  const plan = parsePaperPlan(JSON.stringify(good))!;
  const ch2 = applyPlanToSections(CHAPTER_STRUCTURE.chapter2.sections, plan);
  assert.ok(ch2.includes('2.2 Financial inclusion'));
  assert.ok(ch2.includes('2.5 Gender and finance'));
  const ch4 = applyPlanToSections(CHAPTER_STRUCTURE.chapter4.sections, plan);
  assert.ok(ch4.includes('4.3 Patterns of use'));
  assert.ok(!ch4.some((s) => s.includes('[')));
  assert.deepEqual(applyPlanToSections(['2.2 [Theme 1]'], null), ['2.2 [Theme 1]']);
});

test('the formatted plan states the exact sample size', () => {
  assert.match(formatPlan(parsePaperPlan(JSON.stringify(good))!), /Sample size: 217 \(use exactly this number everywhere\)/);
});
