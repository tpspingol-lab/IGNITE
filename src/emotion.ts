import type { Tag } from './steps';

type Model = { labels: Tag[]; vocab: Record<string, number>; idf: number[]; weights: number[][]; bias: number[] };
export function emotionScores(text: string, model: Model) {
  const words = text.replace(/[A-Z]/g, x => x.toLowerCase()).match(/[a-z0-9_]{2,}/g) ?? [];
  const features = [...words, ...words.slice(1).map((word, i) => words[i] + ' ' + word)];
  const counts = new Map<number, number>();
  for (const feature of features) {
    if (!Object.hasOwn(model.vocab, feature)) continue;
    const index = model.vocab[feature];
    counts.set(index, (counts.get(index) ?? 0) + 1);
  }
  const weighted = [...counts].map(([index, count]) => [index, count * model.idf[index]]);
  const norm = Math.sqrt(weighted.reduce((sum, [, weight]) => sum + weight * weight, 0)) || 1;
  return model.weights.map((row, i) => weighted.reduce((sum, [index, weight]) => sum + row[index] * weight / norm, model.bias[i]));
}

let modelRequest: Promise<Model> | undefined;
export async function suggestEmotion(note: string): Promise<Tag> {
  modelRequest ??= fetch(import.meta.env.BASE_URL + 'emotion-model.json').then(response => {
    if (!response.ok) throw new Error('Emotion model unavailable');
    return response.json() as Promise<Model>;
  }).catch(error => { modelRequest = undefined; throw error; });
  const model = await modelRequest;
  const scores = emotionScores(note, model);
  return model.labels[scores.indexOf(Math.max(...scores))];
}
