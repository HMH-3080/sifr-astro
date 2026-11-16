import { translations } from '../i18n/translations';

type AudioLabel = 'sound_on' | 'sound_off' | 'sound_tap' | 'sound_unavailable';

const button = document.querySelector<HTMLButtonElement>('#soundToggle');
const stateLabel = button?.querySelector<HTMLElement>('[data-sound-state]');

if (button && stateLabel) {
  const music = new Audio(`${import.meta.env.BASE_URL}/audio/sifr-ambient.mp3`);
  music.loop = true;
  music.preload = 'none';
  music.volume = 0;

  const AudioContextConstructor = window.AudioContext;
  let context: AudioContext | null = null;
  let wanted = true;
  let active = false;
  let unavailable = false;
  let fadeFrame = 0;
  let fadeVersion = 0;
  let gestureListeners = true;

  const currentDictionary = () =>
    translations[document.documentElement.lang === 'ar' ? 'ar' : 'en'];

  const updateButton = (label: AudioLabel) => {
    const text = currentDictionary()[label];
    stateLabel.textContent = text;
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('is-on', active);
    button.classList.toggle('needs-gesture', label === 'sound_tap');
    button.disabled = unavailable;
    button.title = text;
  };

  const storePreference = (enabled: boolean) => {
    try {
      localStorage.setItem('sifr-audio', enabled ? 'on' : 'off');
    } catch {
      // Audio remains usable when storage is unavailable.
    }
  };

  try {
    wanted = localStorage.getItem('sifr-audio') !== 'off';
  } catch {
    wanted = true;
  }

  const fadeMusic = (target: number, duration: number, pauseAtEnd = false) => {
    const version = ++fadeVersion;
    if (fadeFrame) cancelAnimationFrame(fadeFrame);
    const from = music.volume;
    const start = performance.now();

    const step = (now: number) => {
      if (version !== fadeVersion) return;
      const progress = Math.min(1, (now - start) / duration);
      const eased = progress * progress * (3 - 2 * progress);
      music.volume = from + (target - from) * eased;
      if (progress < 1) {
        fadeFrame = requestAnimationFrame(step);
      } else {
        fadeFrame = 0;
        if (pauseAtEnd && !wanted) music.pause();
      }
    };

    fadeFrame = requestAnimationFrame(step);
  };

  const start = async () => {
    if (!wanted || unavailable) return;
    try {
      await music.play();
      active = true;
      storePreference(true);
      fadeMusic(0.3, 1800);
      updateButton('sound_on');
      if (gestureListeners) {
        document.removeEventListener('pointerdown', onFirstGesture, true);
        document.removeEventListener('keydown', onFirstGesture, true);
        gestureListeners = false;
      }
    } catch {
      active = false;
      updateButton('sound_tap');
    }
  };

  const stop = () => {
    wanted = false;
    active = false;
    storePreference(false);
    fadeMusic(0, 350, true);
    updateButton('sound_off');
  };

  const onFirstGesture = (event: Event) => {
    if (event.target instanceof Element && event.target.closest('#soundToggle')) return;
    if (wanted && !active) void start();
  };

  const playTransition = () => {
    if (!active || !AudioContextConstructor) return;
    try {
      context ??= new AudioContextConstructor();
      void context.resume().then(() => {
        if (!context || context.state !== 'running') return;
        const now = context.currentTime;
        [659.25, 880].forEach((frequency, index) => {
          const oscillator = context!.createOscillator();
          const envelope = context!.createGain();
          const startAt = now + index * 0.06;
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency;
          envelope.gain.setValueAtTime(0.0001, startAt);
          envelope.gain.exponentialRampToValueAtTime(0.018, startAt + 0.025);
          envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.28);
          oscillator.connect(envelope);
          envelope.connect(context!.destination);
          oscillator.start(startAt);
          oscillator.stop(startAt + 0.3);
        });
      }).catch(() => undefined);
    } catch {
      // Keep navigation and playback working if the browser blocks transition audio.
    }
  };

  button.addEventListener('click', () => {
    if (active) stop();
    else {
      wanted = true;
      void start();
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('a[href^="#"], #menuBtn, [data-lang]')) playTransition();
  });

  document.addEventListener('pointerdown', onFirstGesture, true);
  document.addEventListener('keydown', onFirstGesture, true);

  music.addEventListener('play', () => {
    if (wanted) {
      active = true;
      updateButton('sound_on');
    }
  });

  music.addEventListener('error', () => {
    unavailable = true;
    active = false;
    updateButton('sound_unavailable');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && active) {
      fadeMusic(0, 250);
      window.setTimeout(() => {
        if (document.hidden && wanted) music.pause();
      }, 280);
      active = false;
      updateButton(wanted ? 'sound_tap' : 'sound_off');
    } else if (!document.hidden && wanted && music.paused) {
      void start();
    }
  });

  window.addEventListener('sifr:languagechange', () => {
    const label: AudioLabel = unavailable
      ? 'sound_unavailable'
      : active
        ? 'sound_on'
        : wanted
          ? 'sound_tap'
          : 'sound_off';
    updateButton(label);
  });

  updateButton(wanted ? 'sound_tap' : 'sound_off');
  if (wanted) void start();
}
