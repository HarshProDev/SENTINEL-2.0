import test from 'node:test';
import assert from 'node:assert/strict';
import { PulseProcessor } from './pulse_processor';

function feedPulseWave(
  processor: PulseProcessor,
  startTimeMs: number,
  durationMs: number,
  bpm: number,
): ReturnType<PulseProcessor['processSample']> {
  let result = processor.processSample(2048, startTimeMs);
  const sampleIntervalMs = 10;

  for (let elapsedMs = sampleIntervalMs; elapsedMs <= durationMs; elapsedMs += sampleIntervalMs) {
    const phase = ((elapsedMs / 1000) * (bpm / 60) * 2 * Math.PI) % (2 * Math.PI);
    const amplitude = phase < 0.8
      ? Math.sin((phase / 0.8) * Math.PI) * 400
      : phase >= 1.2 && phase <= 1.8
        ? Math.sin(((phase - 1.2) / 0.6) * Math.PI) * 120
        : 0;
    result = processor.processSample(Math.round(2048 + amplitude), startTimeMs + elapsedMs);
  }

  return result;
}

test('PulseProcessor: detects disconnected sensor on floating/saturated pin', () => {
  const processor = new PulseProcessor();
  const disconnectedLow = processor.processSample(0, 100);
  assert.equal(disconnectedLow.quality, 'DISCONNECTED');
  assert.equal(disconnectedLow.valid, false);
  assert.equal(disconnectedLow.bpm, null);

  const disconnectedHigh = processor.processSample(4095, 200);
  assert.equal(disconnectedHigh.quality, 'DISCONNECTED');
  assert.equal(disconnectedHigh.valid, false);
});

test('PulseProcessor: requires multiple valid beats before outputting BPM', () => {
  const processor = new PulseProcessor({
    requiredConsecutiveBeats: 4,
    minIbiMs: 300,
    maxIbiMs: 2000,
  });

  // Simulate pulse signal around 75 BPM (~800ms between beats)
  // 100Hz sampling (10ms steps)
  let timestamp = 1000;
  let lastResult = processor.processSample(2048, timestamp);

  for (let beat = 0; beat < 6; beat++) {
    // Systolic upstroke
    for (let i = 0; i < 20; i++) {
      timestamp += 10;
      const amplitude = Math.sin((i / 20) * Math.PI) * 400;
      lastResult = processor.processSample(2048 + amplitude, timestamp);
    }
    // Diastolic baseline
    for (let i = 0; i < 60; i++) {
      timestamp += 10;
      lastResult = processor.processSample(2048, timestamp);
    }
  }

  // After 6 regular simulated beats, consecutive valid beats should be >= 4 and BPM should be around 75 (±5)
  assert.equal(lastResult.valid, true);
  assert.equal(lastResult.quality, 'VALID');
  assert.ok(lastResult.bpm !== null && lastResult.bpm >= 65 && lastResult.bpm <= 85);
});

test('PulseProcessor: detects inverted pulse waveforms', () => {
  const processor = new PulseProcessor({
    requiredConsecutiveBeats: 4,
    minIbiMs: 300,
    maxIbiMs: 2000,
  });

  let timestamp = 1000;
  let lastResult = processor.processSample(2048, timestamp);

  for (let beat = 0; beat < 6; beat++) {
    for (let i = 0; i < 20; i++) {
      timestamp += 10;
      const amplitude = Math.sin((i / 20) * Math.PI) * 400;
      lastResult = processor.processSample(2048 - amplitude, timestamp);
    }
    for (let i = 0; i < 60; i++) {
      timestamp += 10;
      lastResult = processor.processSample(2048, timestamp);
    }
  }

  assert.equal(lastResult.valid, true);
  assert.ok(lastResult.bpm !== null && lastResult.bpm >= 65 && lastResult.bpm <= 85);
});

test('PulseProcessor: detects a low-amplitude PPG signal with a non-midpoint ADC baseline', () => {
  const processor = new PulseProcessor();
  let timestamp = 1000;
  let lastResult = processor.processSample(1400, timestamp);

  for (let sample = 0; sample < 3000; sample++) {
    timestamp += 10;
    const phase = ((timestamp / 1000) * 1.25 * 2 * Math.PI) % (2 * Math.PI);
    const pulseWave = phase < 0.8
      ? Math.sin((phase / 0.8) * Math.PI) * 12
      : phase >= 1.2 && phase <= 1.8
        ? Math.sin(((phase - 1.2) / 0.6) * Math.PI) * 3
        : 0;
    const noise = (sample * 37) % 11 - 5;
    lastResult = processor.processSample(Math.round(1400 + pulseWave + noise), timestamp);
  }

  assert.equal(lastResult.quality, 'VALID');
  assert.equal(lastResult.valid, true);
  assert.ok(lastResult.bpm !== null && lastResult.bpm >= 70 && lastResult.bpm <= 80);
});

test('PulseProcessor: rejects rapid noise within refractory window', () => {
  const processor = new PulseProcessor({
    refractoryPeriodMs: 320,
  });

  let timestamp = 1000;
  // First beat
  processor.processSample(2048, timestamp);
  processor.processSample(2600, timestamp + 50);
  processor.processSample(2048, timestamp + 100);

  // Noise spike inside refractory period (at 180ms)
  const noiseResult = processor.processSample(2800, timestamp + 180);
  assert.equal(noiseResult.beatDetected, false);
});

test('PulseProcessor: reacquires pulse after a signal-loss timeout', () => {
  const processor = new PulseProcessor();
  const initialResult = feedPulseWave(processor, 1000, 7000, 75);
  assert.equal(initialResult.valid, true);

  let result = initialResult;
  for (let elapsedMs = 10; elapsedMs <= 3000; elapsedMs += 10) {
    result = processor.processSample(2048, 8000 + elapsedMs);
  }
  assert.equal(result.quality, 'LOW_QUALITY');

  const recoveredResult = feedPulseWave(processor, 11010, 8000, 75);
  assert.equal(recoveredResult.valid, true);
  assert.ok(recoveredResult.bpm !== null && recoveredResult.bpm >= 70 && recoveredResult.bpm <= 80);
});

test('PulseProcessor: re-anchors after a rejected interval caused by a rate change', () => {
  const processor = new PulseProcessor();
  const initialResult = feedPulseWave(processor, 1000, 6000, 75);
  assert.equal(initialResult.valid, true);

  const changedRateResult = feedPulseWave(processor, 7000, 8000, 120);
  assert.equal(changedRateResult.valid, true);
  assert.ok(changedRateResult.bpm !== null && changedRateResult.bpm >= 115 && changedRateResult.bpm <= 125);
});
