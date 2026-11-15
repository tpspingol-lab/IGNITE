import { readFileSync } from 'node:fs';
import { emotionScores } from './src/emotion.ts';
const model = JSON.parse(readFileSync('public/emotion-model.json', 'utf8'));
const fixtures = JSON.parse(readFileSync('data/parity.json', 'utf8'));
let maxError = 0;
for (const [note, expected, logits] of fixtures) {
  const actual = emotionScores(note, model);
  const tag = model.labels[actual.indexOf(Math.max(...actual))];
  if (tag !== expected) throw new Error('Python/TypeScript label mismatch');
  maxError = Math.max(maxError, ...actual.map((value, i) => Math.abs(value - logits[i])));
}
if (maxError > 1e-9) throw new Error('Python/TypeScript score mismatch');
console.log(`${fixtures.length} matching predictions, maximum score error ${maxError}`);
