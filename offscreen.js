let audioContext = null;
let soundQueue = Promise.resolve();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== 'offscreen' || message.type !== 'PLAY_SOUND') return false;

  soundQueue = soundQueue
    .then(() => playSound(message))
    .then(() => sendResponse({ success: true }))
    .catch(error => {
      console.error('Falha ao reproduzir áudio:', error);
      sendResponse({ success: false, error: error.message });
    });

  return true;
});

async function playSound({ soundPreset, volume, customSoundData }) {
  const safeVolume = clamp(Number(volume), 0, 1);

  if (soundPreset === 'custom' && customSoundData) {
    await playCustomAudio(customSoundData, safeVolume);
    return;
  }

  if (soundPreset === 'pop') {
    await playCustomAudio(chrome.runtime.getURL('sounds/pop.mp3'), safeVolume);
    return;
  }

  await playGeneratedSound(soundPreset, safeVolume);
}

async function playCustomAudio(source, volume) {
  const audio = new Audio(source);
  audio.volume = volume;
  audio.preload = 'auto';

  await new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
    const onEnded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('O arquivo de áudio personalizado não pôde ser reproduzido.'));
    };

    audio.addEventListener('ended', onEnded, { once: true });
    audio.addEventListener('error', onError, { once: true });
    audio.play().catch(reject);
  });
}

async function playGeneratedSound(preset, volume) {
  audioContext ||= new AudioContext();
  if (audioContext.state === 'suspended') await audioContext.resume();

  const patterns = {
    classic: [
      { frequency: 740, start: 0, duration: 0.15, gain: 0.6 },
      { frequency: 990, start: 0.18, duration: 0.22, gain: 0.75 }
    ],
    double: [
      { frequency: 880, start: 0, duration: 0.12, gain: 0.65 },
      { frequency: 880, start: 0.18, duration: 0.12, gain: 0.65 },
      { frequency: 1175, start: 0.36, duration: 0.18, gain: 0.75 }
    ],
    soft: [
      { frequency: 523, start: 0, duration: 0.22, gain: 0.38 },
      { frequency: 659, start: 0.2, duration: 0.28, gain: 0.42 }
    ]
  };

  const pattern = patterns[preset] || patterns.classic;
  const startAt = audioContext.currentTime + 0.02;
  const endings = [];

  for (const note of pattern) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const noteStart = startAt + note.start;
    const noteEnd = noteStart + note.duration;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(note.frequency, noteStart);

    gainNode.gain.setValueAtTime(0.0001, noteStart);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * note.gain), noteStart + 0.025);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.02);
    endings.push(noteEnd);
  }

  const totalDuration = Math.max(...endings) - audioContext.currentTime + 0.08;
  await delay(Math.max(80, totalDuration * 1000));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
