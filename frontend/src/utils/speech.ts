'use client';

let lastSpokenText = '';
const activeUtterances = new Set<SpeechSynthesisUtterance>();
let isMutedGlobal = false;
let isAudioUnlocked = false;

// Listeners for live speech state (used to show animated waveform / subtitle in UI)
type SpeechListener = (text: string | null) => void;
const speechListeners = new Set<SpeechListener>();

export const subscribeSpeechState = (listener: SpeechListener) => {
  speechListeners.add(listener);
  return () => {
    speechListeners.delete(listener);
  };
};

const notifySpeechListeners = (text: string | null) => {
  speechListeners.forEach((l) => {
    try {
      l(text);
    } catch {}
  });
};

/**
 * Generates an instant high-clarity navigation chime using the Web Audio API.
 * Guarantees immediate audible feedback even on platforms where TTS voices
 * are delayed or initializing.
 */
export const playNavigationTone = (type: 'beep' | 'success' | 'alert' = 'beep') => {
  if (typeof window === 'undefined' || isMutedGlobal) return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'beep') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.08); // G5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'alert') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    console.warn('AudioContext chime error:', e);
  }
};

/**
 * Initializes and unlocks both Web Audio API & Web Speech API on user interaction.
 * Required by modern browsers (Chrome, Edge, Brave, Safari) to allow audio playback.
 */
export const enableVoiceAudio = (speakGreeting: boolean = false): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    // 1. Play immediate audible chime
    playNavigationTone('success');

    // 2. Unlock SpeechSynthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
      const silent = new SpeechSynthesisUtterance('');
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
    }

    isAudioUnlocked = true;
    isMutedGlobal = false;

    if (speakGreeting) {
      setTimeout(() => {
        speakText('Voice navigation enabled. Sound is working properly.', {
          isMuted: false,
          urgent: true,
          playChime: false,
        });
      }, 100);
    }

    return true;
  } catch (err) {
    console.warn('Could not unlock audio:', err);
    return false;
  }
};

export const setSpeechMuted = (muted: boolean) => {
  isMutedGlobal = muted;
  if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    activeUtterances.clear();
    lastSpokenText = '';
    notifySpeechListeners(null);
  }
};

export const isSpeechMuted = () => isMutedGlobal;

/**
 * Core text-to-speech speaker using native browser window.speechSynthesis.
 * Manages audio queue to prevent overlapping voices.
 * Prevents V8 Garbage Collection bug in Chromium by persisting active utterance.
 */
export const speakText = (
  text: string,
  options: {
    isMuted?: boolean;
    urgent?: boolean;
    rate?: number;
    pitch?: number;
    volume?: number;
    playChime?: boolean;
  } = {}
) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  const {
    isMuted = false,
    urgent = true,
    rate = 0.95,
    pitch = 1.0,
    volume = 1.0,
    playChime = false,
  } = options;

  if (isMutedGlobal || isMuted) {
    window.speechSynthesis.cancel();
    activeUtterances.clear();
    lastSpokenText = '';
    notifySpeechListeners(null);
    return;
  }

  const cleanText = text.trim();
  if (!cleanText) return;

  // Prevent repeating identical announcement consecutively if speaking
  if (cleanText === lastSpokenText && window.speechSynthesis.speaking) {
    return;
  }

  try {
    // Resume speech engine if suspended by browser policy or tab idle
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // Queue Management: cancel any currently speaking text if urgent command arrives
    if (urgent && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      activeUtterances.clear();
    }

    if (playChime) {
      playNavigationTone('beep');
    }

    lastSpokenText = cleanText;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume; // Full 100% volume
    utterance.lang = 'en-US';

    // Store in global Set to prevent Chromium garbage collector from killing it mid-speech
    activeUtterances.add(utterance);
    notifySpeechListeners(cleanText);

    const executeSpeak = () => {
      if (isMutedGlobal) return;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const naturalVoice =
          voices.find(
            (v) =>
              v.lang.startsWith('en') &&
              (v.name.includes('Natural') ||
                v.name.includes('Google') ||
                v.name.includes('Samantha') ||
                v.name.includes('Jenny') ||
                v.name.includes('Guy') ||
                v.name.includes('Zira') ||
                v.name.includes('David'))
          ) || voices.find((v) => v.lang.startsWith('en'));

        if (naturalVoice) {
          utterance.voice = naturalVoice;
        }
      }

      utterance.onend = () => {
        activeUtterances.delete(utterance);
        if (activeUtterances.size === 0) {
          notifySpeechListeners(null);
        }
      };

      utterance.onerror = (e) => {
        activeUtterances.delete(utterance);
        if (activeUtterances.size === 0) {
          notifySpeechListeners(null);
        }
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.warn('Speech error:', e.error);
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    // If voices are already ready, speak immediately; otherwise handle voiceschanged or speak right away
    if (window.speechSynthesis.getVoices().length > 0) {
      executeSpeak();
    } else {
      let hasExecuted = false;
      const onVoices = () => {
        if (!hasExecuted) {
          hasExecuted = true;
          executeSpeak();
        }
      };
      window.speechSynthesis.onvoiceschanged = onVoices;
      // Safety timeout: speak anyway after 60ms with default voice if onvoiceschanged doesn't trigger
      setTimeout(onVoices, 60);
    }
  } catch (err) {
    console.warn('Voice navigation error:', err);
    notifySpeechListeners(null);
  }
};

/**
 * Convenience alias matching existing code
 */
export const speakInstruction = (text: string, isMuted: boolean = false) => {
  speakText(text, { isMuted, urgent: true, playChime: true });
};

/**
 * Announces customer & electricity meter information on marker click or selection
 */
export const announceCustomerInfo = (
  customer: {
    name: string;
    meter_number?: string;
    pending_amount?: number;
    address?: string;
  },
  isMuted: boolean = false
) => {
  const parts: string[] = [`Consumer: ${customer.name}`];

  if (customer.meter_number) {
    parts.push(`Meter number: ${customer.meter_number}`);
  }

  if (customer.pending_amount !== undefined && customer.pending_amount > 0) {
    parts.push(`Outstanding amount: ${Math.round(customer.pending_amount)} Rupees`);
  }

  const announcement = parts.join('. ');
  speakText(announcement, { isMuted, urgent: true, playChime: true });
};

/**
 * Parses OSRM turn maneuvers into standardized natural spoken navigation instructions
 */
export const parseManeuverSpeech = (
  type: string = '',
  modifier: string = '',
  roadName: string = '',
  distanceMeters?: number
): string => {
  const modLower = (modifier || '').toLowerCase();
  const typeLower = (type || '').toLowerCase();
  const road = roadName && roadName !== 'road' && roadName !== '' ? ` onto ${roadName}` : '';

  let action = '';

  if (typeLower === 'arrive' || typeLower === 'destination') {
    return 'You have reached the destination electricity meter.';
  }

  if (typeLower === 'depart') {
    action = road ? `Head out${road}` : 'Start heading out';
  } else if (modLower.includes('left')) {
    action = `Turn left${road}`;
  } else if (modLower.includes('right')) {
    action = `Turn right${road}`;
  } else if (modLower.includes('straight') || typeLower.includes('continue')) {
    action = `Continue straight${road}`;
  } else if (modLower.includes('u-turn')) {
    action = 'Make a U-turn';
  } else {
    action = road ? `Continue${road}` : 'Continue straight';
  }

  // Add distance warning if distance is provided
  if (distanceMeters !== undefined && distanceMeters > 0) {
    if (distanceMeters >= 1000) {
      const km = (distanceMeters / 1000).toFixed(1);
      return `In ${km} kilometers, ${action.toLowerCase()}`;
    } else if (distanceMeters >= 50) {
      const roundedMeters = Math.round(distanceMeters / 10) * 10;
      return `In ${roundedMeters} meters, ${action.toLowerCase()}`;
    }
  }

  return action;
};

export const stopSpeech = () => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    activeUtterances.clear();
    lastSpokenText = '';
    notifySpeechListeners(null);
  }
};
