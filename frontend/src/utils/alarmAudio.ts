// Synthesizes an urgent dual-tone security alarm pulse using the Web Audio API
// so high-risk Tier 3 alerts work reliably without external audio files.

let audioCtx: AudioContext | null = null;
let alarmTimer: number | null = null;
let isPlaying = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  return audioCtx;
}

export async function unlockAudio(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      // Ignore autoplay restrictions before user gesture
    }
  }
}

function playSinglePulse(ctx: AudioContext) {
  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = "sawtooth";
  osc2.type = "square";

  // Urgent alternating security siren frequencies
  osc1.frequency.setValueAtTime(880, now);
  osc1.frequency.setValueAtTime(660, now + 0.16);
  osc1.frequency.setValueAtTime(880, now + 0.32);

  osc2.frequency.setValueAtTime(440, now);
  osc2.frequency.setValueAtTime(330, now + 0.16);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.03);
  gain.gain.setValueAtTime(0.16, now + 0.42);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.54);
  osc2.stop(now + 0.54);
}

export async function startFraudAlarm(): Promise<void> {
  if (isPlaying) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  await unlockAudio();
  isPlaying = true;

  playSinglePulse(ctx);
  alarmTimer = window.setInterval(() => {
    if (audioCtx && isPlaying) {
      playSinglePulse(audioCtx);
    }
  }, 680);
}

export function stopFraudAlarm(): void {
  isPlaying = false;
  if (alarmTimer !== null) {
    window.clearInterval(alarmTimer);
    alarmTimer = null;
  }
}
