export const sleepBands = ['Under 6 h', '6 to under 7 h', '7 to under 8 h', '8 h or more'] as const;
export type SleepBand = typeof sleepBands[number];
export type HealthGroup = 'water' | 'sleep' | 'activity' | 'meals';
export type HealthLog = {
  id: string;
  day: string;
  text: string;
  enteredAt?: string;
  zone?: string;
  ml?: number;
  minutes?: number;
  band?: SleepBand;
  quality?: string;
  label?: string;
  grams?: number;
};
export type WaterUnits = 'metric' | 'us';
export const defaultCupMl = 250;
const mlPerOunce = 29.5735295625;
const numbers = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export function volumeNumber(ml: number, units: WaterUnits) {
  return units === 'us' ? ml / mlPerOunce : ml;
}

export function volumeText(ml: number, units: WaterUnits = 'metric') {
  return numbers.format(volumeNumber(ml, units)) + (units === 'us' ? ' fl oz' : ' mL');
}

export function parseVolume(value: FormDataEntryValue | string | null, units: WaterUnits) {
  return Math.round(Number(value) * (units === 'us' ? mlPerOunce : 1));
}

export function durationText(minutes: number) { return `${Math.floor(minutes / 60)} h ${minutes % 60} min`; }

export function sleepBand(row: HealthLog): SleepBand | undefined {
  if (row.band) return row.band;
  if (/^8\s*h\+(?:\s|$)/i.test(row.text)) return '8 h or more';
  return sleepBands.find(band => row.text === band || row.text.startsWith(band + ' · '));
}

export function sleepMinutes(row: HealthLog) {
  if (sleepBand(row)) return undefined;
  if (row.minutes !== undefined) return row.minutes;
  const match = /^(\d+) h (\d+) min(?: · |$)/.exec(row.text);
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
}

export function movementMinutes(row: HealthLog) {
  if (row.minutes !== undefined) return row.minutes;
  const match = / · (\d+) min$/.exec(row.text);
  return match ? Number(match[1]) : undefined;
}
