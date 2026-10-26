/**
 * SENTINEL 2.0 - Live Communication Protocol Validator
 * Strict runtime schema validation for ESP32 incoming telemetry packets.
 */

import { SentinelDataPacket, SignalQuality } from '../types/sentinel';

export interface ValidationResult {
  isValid: boolean;
  packet: SentinelDataPacket | null;
  errors: string[];
}

const VALID_QUALITIES: SignalQuality[] = [
  'DISCONNECTED',
  'INITIALIZING',
  'CALIBRATING',
  'VALID',
  'LOW_QUALITY',
  'STALE',
  'ERROR',
];

export class ProtocolValidator {
  private lastSequence: number = -1;
  private lastDeviceTimestamp: number = 0;

  public reset(): void {
    this.lastSequence = -1;
    this.lastDeviceTimestamp = 0;
  }

  /**
   * Validate raw incoming JSON string or object from ESP32.
   */
  public validate(input: unknown): ValidationResult {
    const errors: string[] = [];

    if (!input || typeof input !== 'object') {
      return { isValid: false, packet: null, errors: ['Payload must be a non-null object'] };
    }

    const data = input as Record<string, unknown>;

    // 1. Schema version
    if (data.schemaVersion !== 1) {
      errors.push(`Unsupported or missing schemaVersion: expected 1, got ${data.schemaVersion}`);
    }

    // 2. Device identification
    if (typeof data.deviceId !== 'string' || !data.deviceId.trim()) {
      errors.push('Missing or empty deviceId string');
    }

    // 3. Timestamps
    if (typeof data.deviceTimestampMs !== 'number' || data.deviceTimestampMs < 0) {
      errors.push('Missing or invalid deviceTimestampMs number');
    }

    // 4. Sequence
    if (typeof data.sequence !== 'number' || data.sequence < 0) {
      errors.push('Missing or invalid sequence number');
    }

    // 5. Pulse structure
    const pulse = data.pulse as Record<string, unknown> | undefined;
    if (!pulse || typeof pulse !== 'object') {
      errors.push('Missing pulse telemetry object');
    } else {
      if (pulse.rawAdc !== null && typeof pulse.rawAdc !== 'number') {
        errors.push('pulse.rawAdc must be a number or null');
      }
      if (pulse.bpm !== null && typeof pulse.bpm !== 'number') {
        errors.push('pulse.bpm must be a number or null');
      }
      if (typeof pulse.valid !== 'boolean') {
        errors.push('pulse.valid must be a boolean');
      }
      if (!VALID_QUALITIES.includes(pulse.quality as SignalQuality)) {
        errors.push(`pulse.quality must be one of: ${VALID_QUALITIES.join(', ')}`);
      }
    }

    // 6. GSR structure
    const gsr = data.gsr as Record<string, unknown> | undefined;
    if (!gsr || typeof gsr !== 'object') {
      errors.push('Missing gsr telemetry object');
    } else {
      if (gsr.rawAdc !== null && typeof gsr.rawAdc !== 'number') {
        errors.push('gsr.rawAdc must be a number or null');
      }
      if (typeof gsr.valid !== 'boolean') {
        errors.push('gsr.valid must be a boolean');
      }
      if (!VALID_QUALITIES.includes(gsr.quality as SignalQuality)) {
        errors.push(`gsr.quality must be one of: ${VALID_QUALITIES.join(', ')}`);
      }
    }

    // 7. System status
    const system = data.system as Record<string, unknown> | undefined;
    if (!system || typeof system !== 'object') {
      errors.push('Missing system telemetry object');
    } else {
      if (typeof system.wifiConnected !== 'boolean') {
        errors.push('system.wifiConnected must be a boolean');
      }
      if (typeof system.calibrating !== 'boolean') {
        errors.push('system.calibrating must be a boolean');
      }
    }

    if (errors.length > 0) {
      return { isValid: false, packet: null, errors };
    }

    // Check sequence ordering (prevent stale out-of-order packets)
    const sequence = data.sequence as number;
    const deviceTimestampMs = data.deviceTimestampMs as number;

    // Allowed sequence wrap-around or reboot
    if (this.lastSequence >= 0 && sequence < this.lastSequence && Math.abs(sequence - this.lastSequence) < 1000) {
      errors.push(`Out-of-order packet: sequence ${sequence} is older than last seen ${this.lastSequence}`);
      return { isValid: false, packet: null, errors };
    }

    this.lastSequence = sequence;
    this.lastDeviceTimestamp = deviceTimestampMs;

    const validatedPacket: SentinelDataPacket = {
      schemaVersion: 1,
      deviceId: data.deviceId as string,
      deviceTimestampMs,
      receiveTimestampMs: Date.now(),
      sequence,
      pulse: {
        rawAdc: pulse?.rawAdc as number | null,
        bpm: pulse?.bpm as number | null,
        ibiMs: (pulse?.ibiMs as number) ?? null,
        valid: Boolean(pulse?.valid),
        quality: (pulse?.quality as SignalQuality) || 'INITIALIZING',
        confidence: typeof pulse?.confidence === 'number' ? pulse.confidence : 0,
        beatDetected: Boolean(pulse?.beatDetected),
        consecutiveValidBeats: typeof pulse?.consecutiveValidBeats === 'number' ? pulse.consecutiveValidBeats : 0,
      },
      gsr: {
        rawAdc: gsr?.rawAdc as number | null,
        smoothedAdc: (gsr?.smoothedAdc as number) ?? null,
        baselineAdc: (gsr?.baselineAdc as number) ?? null,
        relativeChange: (gsr?.relativeChange as number) ?? null,
        valid: Boolean(gsr?.valid),
        quality: (gsr?.quality as SignalQuality) || 'INITIALIZING',
        trend: (gsr?.trend as 'STABLE' | 'RISING' | 'FALLING' | 'INDETERMINATE') || 'INDETERMINATE',
      },
      system: {
        wifiConnected: Boolean(system?.wifiConnected),
        ipAddress: system?.ipAddress as string | undefined,
        calibrating: Boolean(system?.calibrating),
        calibrationProgress: system?.calibrationProgress as number | undefined,
        errorCode: (system?.errorCode as string) ?? null,
        sampleRateHz: typeof system?.sampleRateHz === 'number' ? system.sampleRateHz : 100,
      },
    };

    return { isValid: true, packet: validatedPacket, errors: [] };
  }
}
