export const tags = [
  ['nervousness', 'Nervous'], ['disappointment', 'Disappointed'], ['sadness', 'Sad'],
  ['anger', 'Angry'], ['neutral', 'Neutral'], ['unsure', 'Not sure']
] as const;
export type Tag = typeof tags[number][0];
export type Step = { title: string; minutes: number; reason: string; smaller?: { title: string; minutes: number } };
export type Draft = { note: string; tag: Tag | ''; time: number; energy: string };
export const emptyDraft: Draft = { note: '', tag: '', time: 10, energy: 'Steady' };
export const rest: Step = { title: 'Give yourself a moment to rest.', minutes: 1, reason: 'You chose to leave a little room to pause.' };
const reflection = { title: 'Write a short reflection.', minutes: 4, smaller: { title: 'Name one thing you handled well.', minutes: 1 } };
const prepare = { title: 'Write down one thing you can prepare.', minutes: 3, smaller: { title: 'Name one thing you can prepare.', minutes: 1 } };
const reset = { title: 'Step away and take a short pause.', minutes: 3, smaller: { title: 'Look away from your screen for a moment.', minutes: 1 } };
const sort = { title: 'Write down one thing that can wait.', minutes: 3, smaller: { title: 'Pick one thing that can wait.', minutes: 1 } };
export function shrink(step: Step, reason = 'This version takes less time and asks you to do less.'): Step {
  return step.smaller ? { ...step.smaller, reason } : { ...step, reason: 'This is already the shortest version. Rest is an option.' };
}
export function recommend(draft: Draft, swap = false): Step {
  const preferred = draft.tag === 'disappointment' ? reflection : draft.tag === 'nervousness' ? prepare :
    draft.tag === 'sadness' || draft.tag === 'anger' ? reset : sort;
  const choice = swap ? (preferred === reset ? sort : reset) : preferred;
  const label = tags.find(([id]) => id === draft.tag)?.[1];
  const step = { ...choice, reason: swap ? 'Here’s a different action for the time you have.' :
    label && draft.tag !== 'unsure' ? `You chose “${label.toLowerCase()}.” This gives you one specific thing to try in ${choice.minutes} minutes.` :
    'This gives you one thing to focus on for a few minutes.' };
  return draft.time < step.minutes || draft.energy === 'Low'
    ? shrink(step, draft.energy === 'Low' ? 'You said your energy is low, so this version asks less of you.' : 'This shorter version fits the time you have.')
    : step;
}
