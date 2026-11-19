import { parseChart, serializeChart, type Chart } from './chart';

export interface ScoreRecord {
  score: number;
  /** 0..100 */
  accuracy: number;
  rank: string;
  maxCombo: number;
  fullCombo: boolean;
  date: number;
}

const SCORES_KEY = 'berrybeats.scores.v1';
const CHARTS_KEY = 'berrybeats.charts.v1';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ((JSON.parse(raw) as T | null) ?? fallback) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getBest(chartId: string): ScoreRecord | null {
  return read<Record<string, ScoreRecord>>(SCORES_KEY, {})[chartId] ?? null;
}

/** Store the score if it beats the saved one. Returns true for a new best. */
export function submitScore(chartId: string, record: ScoreRecord): boolean {
  const all = read<Record<string, ScoreRecord>>(SCORES_KEY, {});
  const best = all[chartId];
  if (best && best.score >= record.score) return false;
  all[chartId] = record;
  write(SCORES_KEY, all);
  return true;
}

/** Beat maps made in the composer or imported, newest first. Corrupt entries are skipped. */
export function listCustomCharts(): Chart[] {
  const raw = read<unknown[]>(CHARTS_KEY, []);
  const charts: Chart[] = [];
  if (!Array.isArray(raw)) return charts;
  for (const entry of raw) {
    try {
      charts.push(parseChart(entry));
    } catch {
      // skip
    }
  }
  return charts;
}

export function getCustomChart(id: string): Chart | null {
  return listCustomCharts().find((c) => c.id === id) ?? null;
}

/** Insert or replace a beat map. Returns false if the browser refused to store it. */
export function saveCustomChart(chart: Chart): boolean {
  const charts = listCustomCharts().filter((c) => c.id !== chart.id);
  charts.unshift(chart);
  return write(CHARTS_KEY, `[${charts.map(serializeChart).join(',')}]`);
}

export function deleteCustomChart(id: string): void {
  const charts = listCustomCharts().filter((c) => c.id !== id);
  write(CHARTS_KEY, `[${charts.map(serializeChart).join(',')}]`);
}
