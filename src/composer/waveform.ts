/** Loudness outline of a song, reduced to one peak value per time bucket. */
export interface Peaks {
  /** Peak absolute amplitude (0..1) per bucket. */
  values: Float32Array;
  bucketsPerSecond: number;
}

/** Works on raw channel data so it can run without an AudioBuffer (tests). */
export function computePeaks(channels: readonly Float32Array[], sampleRate: number, bucketsPerSecond = 250): Peaks {
  const length = channels[0]?.length ?? 0;
  const size = sampleRate / bucketsPerSecond;
  const count = Math.ceil(length / size);
  const values = new Float32Array(count);
  for (const data of channels) {
    for (let i = 0; i < count; i++) {
      const from = Math.floor(i * size);
      const to = Math.min(length, Math.floor((i + 1) * size));
      let peak = values[i];
      for (let s = from; s < to; s++) {
        const v = data[s] < 0 ? -data[s] : data[s];
        if (v > peak) peak = v;
      }
      values[i] = peak;
    }
  }
  return { values, bucketsPerSecond };
}

export function peaksFromBuffer(buffer: AudioBuffer, bucketsPerSecond = 250): Peaks {
  const channels: Float32Array[] = [];
  for (let c = 0; c < Math.min(2, buffer.numberOfChannels); c++) channels.push(buffer.getChannelData(c));
  return computePeaks(channels, buffer.sampleRate, bucketsPerSecond);
}

/** Highest peak between two times in seconds. */
export function peakBetween(peaks: Peaks, fromSec: number, toSec: number): number {
  const first = Math.max(0, Math.floor(fromSec * peaks.bucketsPerSecond));
  const last = Math.min(peaks.values.length - 1, Math.ceil(toSec * peaks.bucketsPerSecond) - 1);
  let peak = 0;
  for (let i = first; i <= last; i++) if (peaks.values[i] > peak) peak = peaks.values[i];
  return peak;
}
