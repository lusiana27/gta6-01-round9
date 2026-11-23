// Procedural sound: everything is synthesized with WebAudio, no audio files.
// Three radio stations (synthwave / funky bass / lo-fi), engine hum, sirens,
// gunshots and UI blips. Silent until the player first interacts (browser rule).

import { RADIO_STATIONS } from './city.js';

const NOTE = {
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, E5: 659.25, G5: 783.99, A5: 880.0,
};

const STATION_PATTERNS = [
  // VELMAR FM — synthwave arpeggio
  { bpm: 112, bass: ['C2', 'C2', 'G2', 'A2', 'F2', 'F2', 'G2', 'G2'], lead: ['C4', 'E4', 'G4', 'C5', 'A4', 'G4', 'E4', 'G4'], wave: 'sawtooth' },
  // BAY 94 — funky bass
  { bpm: 98, bass: ['C2', 'E2', 'G2', 'A2', 'G2', 'E2', 'D2', 'G2'], lead: ['E4', 'G4', 'A4', 'G4', 'E4', 'C4', 'D4', 'E4'], wave: 'square' },
  // STATIC 88 — lo-fi night
  { bpm: 76, bass: ['A2', 'F2', 'C3', 'G2', 'A2', 'F2', 'E2', 'G2'], lead: ['C4', 'E4', 'A4', 'G4', 'F4', 'E4', 'C4', 'A3'], wave: 'triangle' },
];

export function createAudio() {
  let context = null;
  let master = null;
  let radioGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let station = 0;
  let stepTimer = null;
  let stepIndex = 0;
  let enabled = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      radioGain = context.createGain();
      radioGain.gain.value = 0.14;
      radioGain.connect(master);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      return false;
    }
    return true;
  }

  function noteAt(time, frequency, duration, type, gainValue) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(gain);
    gain.connect(radioGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  function playStep() {
    if (!context || !enabled) return;
    const pattern = STATION_PATTERNS[station];
    const beat = 60 / pattern.bpm / 2;
    const now = context.currentTime + 0.05;
    const bassNote = NOTE[pattern.bass[stepIndex % pattern.bass.length]];
    const leadNote = NOTE[pattern.lead[stepIndex % pattern.lead.length]];
    noteAt(now, bassNote, beat * 0.9, pattern.wave, 0.5);
    if (stepIndex % 2 === 0) noteAt(now, leadNote, beat * 1.4, 'sine', 0.22);
    stepIndex += 1;
    stepTimer = window.setTimeout(playStep, beat * 1000);
  }

  return {
    get station() { return station; },
    get stationName() { return RADIO_STATIONS[station].name; },
    unlock() {
      if (!ensure()) return;
      if (context.state === 'suspended') context.resume();
      enabled = true;
      if (stepTimer === null) playStep();
    },
    nextStation() {
      station = (station + 1) % RADIO_STATIONS.length;
      stepIndex = 0;
      return RADIO_STATIONS[station].name;
    },
    setEngine(speedFraction, on) {
      if (!context) return;
      engineGain.gain.value = on ? 0.03 + speedFraction * 0.05 : 0;
      engineOsc.frequency.value = 45 + speedFraction * 130;
    },
    setSiren(on, wanted) {
      if (!context) return;
      sirenGain.gain.value = on ? 0.03 : 0;
      if (on) sirenOsc.frequency.value = 650 + wanted * 60 + Math.sin(context.currentTime * 4) * 120;
    },
    blip(frequency = 880) {
      if (!context || !enabled) return;
      noteAt(context.currentTime, frequency, 0.08, 'sine', 0.3);
    },
    gunshot() {
      if (!context || !enabled) return;
      const duration = 0.12;
      const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const gain = context.createGain();
      gain.gain.value = 0.4;
      source.connect(gain);
      gain.connect(master);
      source.start();
    },
    crash() {
      if (!context || !enabled) return;
      noteAt(context.currentTime, 60, 0.3, 'sawtooth', 0.5);
    },
  };
}
