import test from 'node:test';
import assert from 'node:assert/strict';
import { GsrProcessor } from './gsr_processor';

test('GsrProcessor: flags disconnected sensor outside electrical bounds', () => {
  const processor = new GsrProcessor({ minValidAdc: 20, maxValidAdc: 4075 });
  const openCircuit = processor.processSample(5);
  assert.equal(openCircuit.quality, 'DISCONNECTED');
  assert.equal(openCircuit.valid, false);

  const shortCircuit = processor.processSample(4090);
  assert.equal(shortCircuit.quality, 'DISCONNECTED');
  assert.equal(shortCircuit.valid, false);
});

test('GsrProcessor: establishes baseline and computes relative change', () => {
  const processor = new GsrProcessor({
    smoothingAlpha: 0.2,
    calibrationSamplesRequired: 10,
  });

  processor.startCalibration();
  assert.equal(processor.isCalibrationActive(), true);

  // Feed 10 calibration samples around 1500
  for (let i = 0; i < 10; i++) {
    processor.processSample(1500);
  }

  assert.equal(processor.isCalibrationActive(), false);
  assert.equal(processor.getBaseline(), 1500);

  // Feed sample with higher conductance (+150 ADC counts)
  let result = processor.processSample(1650);
  for (let i = 0; i < 5; i++) {
    result = processor.processSample(1650);
  }

  assert.equal(result.valid, true);
  assert.ok(result.relativeChange !== null && result.relativeChange > 0);
});

test('GsrProcessor: detects stable vs rising trends', () => {
  const processor = new GsrProcessor({ driftThresholdPercent: 2.0 });
  processor.setBaseline(1000);

  // Feed stable readings
  let res = processor.processSample(1000);
  for (let i = 0; i < 10; i++) {
    res = processor.processSample(1000);
  }
  assert.equal(res.trend, 'STABLE');

  // Sudden conductance surge
  for (let i = 0; i < 10; i++) {
    res = processor.processSample(1150);
  }
  assert.equal(res.trend, 'RISING');
});
