const ctx = (): AudioContext => {
  const w = window as unknown as { __audioCtx?: AudioContext };
  if (!w.__audioCtx) w.__audioCtx = new AudioContext();
  return w.__audioCtx;
};

function tone(
  ac: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  gainPeak: number,
  type: OscillatorType = 'sine',
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

function slide(
  ac: AudioContext,
  freqStart: number,
  freqEnd: number,
  startTime: number,
  duration: number,
  gainPeak: number,
  type: OscillatorType = 'sine',
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, startTime);
  osc.frequency.linearRampToValueAtTime(freqEnd, startTime + duration);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

export function playScoreSound(grade: string): void {
  try {
    const ac = ctx();
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime;

    if (grade === 'A') {
      // Bright triumphant arpeggio: C5-E5-G5-C6
      tone(ac, 523, t + 0.00, 0.25, 0.4, 'triangle');
      tone(ac, 659, t + 0.10, 0.25, 0.4, 'triangle');
      tone(ac, 784, t + 0.20, 0.25, 0.4, 'triangle');
      tone(ac, 1047, t + 0.30, 0.50, 0.5, 'triangle');
    } else if (grade === 'B') {
      // Warm two-note chime: C5 → G5
      tone(ac, 523, t + 0.00, 0.30, 0.35, 'sine');
      tone(ac, 784, t + 0.15, 0.45, 0.35, 'sine');
    } else if (grade === 'C') {
      // Neutral single chime
      tone(ac, 440, t + 0.00, 0.40, 0.3, 'sine');
    } else if (grade === 'D') {
      // Flat, slightly descending pair
      slide(ac, 380, 320, t + 0.00, 0.30, 0.3, 'sine');
      slide(ac, 320, 270, t + 0.25, 0.35, 0.25, 'sine');
    } else {
      // F — descending "wah wah"
      slide(ac, 300, 200, t + 0.00, 0.35, 0.35, 'sawtooth');
      slide(ac, 220, 140, t + 0.30, 0.45, 0.3, 'sawtooth');
    }
  } catch {
    // Audio not available — silent fallback
  }
}
