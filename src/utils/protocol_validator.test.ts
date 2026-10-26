import test from 'node:test';
import assert from 'node:assert/strict';
import { ProtocolValidator } from './protocol_validator';

test('ProtocolValidator: validates valid Schema Version 1 payload', () => {
  const validator = new ProtocolValidator();
  const samplePayload = {
    schemaVersion: 1,
    deviceId: 'sentinel-esp32-node1',
    deviceTimestampMs: 12450,
    sequence: 42,
    pulse: {
      rawAdc: 2150,
      bpm: 72,
      ibiMs: 833,
      valid: true,
      quality: 'VALID',
      confidence: 85,
      beatDetected: true,
      consecutiveValidBeats: 6,
    },
    gsr: {
      rawAdc: 1420,
      smoothedAdc: 1418.5,
      baselineAdc: 1400.0,
      relativeChange: 1.3,
      valid: true,
      quality: 'VALID',
      trend: 'STABLE',
    },
    system: {
      wifiConnected: true,
      calibrating: false,
      errorCode: null,
      sampleRateHz: 100,
    },
  };

  const result = validator.validate(samplePayload);
  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.packet?.deviceId, 'sentinel-esp32-node1');
  assert.equal(result.packet?.pulse.bpm, 72);
});

test('ProtocolValidator: rejects outdated schema version and malformed types', () => {
  const validator = new ProtocolValidator();

  const invalidSchema = {
    schemaVersion: 99,
    deviceId: 'test',
  };
  const res = validator.validate(invalidSchema);
  assert.equal(res.isValid, false);
  assert.ok(res.errors.some((e) => e.includes('schemaVersion')));
});

test('ProtocolValidator: accepts uncalibrated telemetry with unavailable values as null', () => {
  const validator = new ProtocolValidator();
  const result = validator.validate({
    schemaVersion: 1,
    deviceId: 'sentinel-esp32-node1',
    deviceTimestampMs: 12450,
    sequence: 43,
    pulse: {
      rawAdc: 2150,
      bpm: null,
      ibiMs: null,
      valid: false,
      quality: 'INITIALIZING',
      confidence: 0,
      beatDetected: false,
      consecutiveValidBeats: 0,
    },
    gsr: {
      rawAdc: 1420,
      smoothedAdc: 1418.5,
      baselineAdc: null,
      relativeChange: null,
      valid: true,
      quality: 'VALID',
      trend: 'INDETERMINATE',
    },
    system: {
      wifiConnected: true,
      calibrating: false,
      calibrationProgress: 0,
      errorCode: null,
      sampleRateHz: 100,
    },
  });

  assert.equal(result.isValid, true);
  assert.equal(result.packet?.pulse.bpm, null);
  assert.equal(result.packet?.gsr.baselineAdc, null);
  assert.equal(result.packet?.gsr.relativeChange, null);
});
