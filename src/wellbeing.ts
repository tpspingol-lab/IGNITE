export const pillars = [
  ['Physical Vitality', 'How much physical energy did you have today?'],
  ['Emotional Balance', 'How manageable did your emotions feel today?'],
  ['Social Connection', 'How connected did you feel to the people who matter to you today?'],
  ['Purpose & Fulfillment', 'How worthwhile did the things you did today feel?'],
] as const;
export const scales = ['Very little', 'A little', 'Somewhat', 'Quite a bit', 'A lot'];
export const stages = ['Feeling stretched', 'Finding balance', 'Feeling steady', 'Doing well'];
export const version = 'ignite-pillars-v1';
export type Ratings = [number | null, number | null, number | null, number | null];
export type Check = { date: string; zone: string; version: string; updated: string; ratings: Ratings; note?: string; tag?: string };
export const blank = (): Ratings => [null, null, null, null];
export type Settings = { setup: boolean; zone: string; goals: boolean[]; habits: string; morning: boolean; evening: boolean; reduce: boolean; logAccess: 'ask' | 'never'; theme: 'system' | 'light' | 'dark'; barriers: string[]; stepSize: 2 | 5 | 10; textSize:'standard'|'large'; mascotVisible:boolean; units:'metric'|'us'; clockStyle:'system'|'12'|'24' };
export const defaults: Settings = { setup: false, zone: Intl.DateTimeFormat().resolvedOptions().timeZone, goals: [false,false,false,false], habits: '', morning: true, evening: true, reduce: false, logAccess: 'ask', theme: 'system', barriers: [], stepSize: 5, textSize:'standard', mascotVisible:true, units:'metric', clockStyle:'system' };

export function localDate(zone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)?.value).join('-');
}
export function clockAt(zone: string, date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}
export const plusDays = (day: string, count: number) => new Date(Date.parse(day + 'T00:00:00Z') + count * 86400000).toISOString().slice(0, 10);
export const monday = (day: string) => plusDays(day, -(new Date(day + 'T00:00:00Z').getUTCDay() + 6) % 7);
export const dateLabel = (day: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) =>
  new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(new Date(day + 'T00:00:00Z'));
export const weekDays = (start: string) => Array.from({ length: 7 }, (_, index) => plusDays(start, index));
export type StepOutcome = { id:string; date:string; day?:string; zone?:string; step:{title:string}; outcome:string; barrier:string };
export function timeLabel(value:string, style:Settings['clockStyle']) {
  return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit',timeZone:'UTC',hour12:style==='system'?undefined:style==='12'})
    .format(new Date('2000-01-01T'+value+':00Z'));
}
export function calendarDate(value:string|null):value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instant = new Date(value+'T00:00:00Z');
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0,10)===value;
}
export function outcomeDay(entry: StepOutcome, zone: string) {
  if (entry.day) return entry.day;
  if (/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return entry.date;
  const parsed = new Date(entry.date);
  return Number.isFinite(parsed.getTime()) ? localDate(zone, parsed) : '';
}
export const validRating = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
export const hasRatings = (record: Check) => record.ratings.some(validRating);
export function currentRatings(checks: Check[]) {
  return new Map(checks.filter(row => row.version === version)
    .sort((a,b) => (a.updated ?? '').localeCompare(b.updated ?? ''))
    .map(row => [row.date, row]));
}
export function weekly(checks: Check[], dates: string[]) {
  const byDay = currentRatings(checks);
  const eligible = dates.flatMap(date => byDay.get(date) ?? []);
  const values = pillars.map((_, i) => eligible.flatMap(row => {
    const value = row.ratings[i];
    return validRating(value) ? [value] : [];
  }));
  const coverage = values.map(items => items.length);
  const means = values.map(items => items.length ? items.reduce((sum, n) => sum + n, 0) / items.length : null);
  const completed = eligible.filter(row=>row.ratings.every(validRating)).length;
  const ratedDays = eligible.filter(hasRatings).length;
  const average = Math.round(means.reduce<number>((sum,n)=>sum+(n ?? 0),0)*2.5+1e-10)/10;
  const score = completed ? average : null;
  return {
    score, coverage, means, completed, ratedDays, participation:eligible.length,
    comparisonScore:coverage.every(n=>n>=3)?average:null,
    stage:score===null?'Gathering data':stages[Math.min(3,Math.floor(score)-1)]
  };
}
