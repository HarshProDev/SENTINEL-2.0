/**
 * SENTINEL 2.0 - Biometric Pulse Signal Processor
 * Pure deterministic algorithms for PPG pulse detection, IBI validation,
 * refractory window enforcement, and signal quality evaluation.
 */

import { PulseMeasurement, SignalQuality } from '../types/sentinel';

export interface PulseProcessorConfig {
  sampleRateHz: number;
  minIbiMs: number; // default 300ms (max 200 BPM)
  maxIbiMs: number; // default 2000ms (min 30 BPM)
  refractoryPeriodMs: number; // default 300ms
  requiredConsecutiveBeats: number; // default 4
  maxIbiJitterRatio: number; // default 0.35 (35% change limit between consecutive intervals)
  signalLossTimeoutMs: number; // default 2500ms
  minimumPeakAmplitude: number;
}

export const DEFAULT_PULSE_CONFIG: PulseProcessorConfig = {
  sampleRateHz: 100,
  minIbiMs: 300,
  maxIbiMs: 2000,
  refractoryPeriodMs: 320,
  requiredConsecutiveBeats: 4,
  maxIbiJitterRatio: 0.35,
  signalLossTimeoutMs: 2500,
  minimumPeakAmplitude: 8,
};

export class PulseProcessor {
  private config: PulseProcessorConfig;
  private lastSampleTimeMs: number = 0;
  private lastBeatTimeMs: number = 0;
  private rawBuffer: number[] = [];
  private readonly bufferSize: number = 100;

  // Signal processing state
  private dcBaseline: number = 2048; // ESP32 12-bit ADC midpoint
  private baselineInitialized: boolean = false;
  private filteredSignal: number = 0;
  private adaptiveThreshold: number = 50; // Dynamic amplitude threshold
  private peakCandidate: number = 0;
  private peakTimeMs: number = 0;
  private inBeatWave: boolean = false;
  private candidatePolarity: 1 | -1 = 1;

  // Beat validation history
  private recentIbis: number[] = [];
  private consecutiveValidBeats: number = 0;
  private currentBpm: number | null = null;
  private lastValidIbiMs: number | null = null;

  constructor(config: Partial<PulseProcessorConfig> = {}) {
    this.config = { ...DEFAULT_PULSE_CONFIG, ...config };
  }

  public reset(): void {
    this.lastSampleTimeMs = 0;
    this.lastBeatTimeMs = 0;
    this.rawBuffer = [];
    this.dcBaseline = 2048;
    this.baselineInitialized = false;
    this.filteredSignal = 0;
    this.adaptiveThreshold = 50;
    this.peakCandidate = 0;
    this.peakTimeMs = 0;
    this.inBeatWave = false;
    this.candidatePolarity = 1;
    this.recentIbis = [];
    this.consecutiveValidBeats = 0;
    this.currentBpm = null;
    this.lastValidIbiMs = null;
  }

  /**
   * Process a single raw ADC sample.
   * @param rawAdc - Raw 12-bit ADC value (0-4095 on ESP32)
   * @param timestampMs - Current timestamp in milliseconds
   */
  public processSample(rawAdc: number, timestampMs: number): PulseMeasurement {
    this.lastSampleTimeMs = timestampMs;

    // 1. Physical sensor disconnection check (e.g., disconnected ADC pin floating or pegged at limits)
    if (rawAdc <= 10 || rawAdc >= 4085) {
      this.consecutiveValidBeats = 0;
      this.currentBpm = null;
      this.lastBeatTimeMs = 0;
      this.lastValidIbiMs = null;
      this.recentIbis = [];
      this.rawBuffer = [];
      this.baselineInitialized = false;
      this.filteredSignal = 0;
      this.inBeatWave = false;
      this.peakCandidate = 0;
      this.peakTimeMs = 0;
      return {
        rawAdc,
        bpm: null,
        ibiMs: null,
        valid: false,
        quality: 'DISCONNECTED',
        confidence: 0,
        beatDetected: false,
        consecutiveValidBeats: 0,
      };
    }

    if (!this.baselineInitialized) {
      this.dcBaseline = rawAdc;
      this.baselineInitialized = true;
    }

    // 2. Running DC baseline estimation (slow low-pass filter, alpha ~ 0.02)
    const alphaDc = 0.02;
    this.dcBaseline = this.dcBaseline * (1 - alphaDc) + rawAdc * alphaDc;

    // AC signal with DC removed
    const acSignal = rawAdc - this.dcBaseline;

    // 3. Fast smoothing filter for AC signal (low-pass filter to kill 50/60Hz noise)
    const alphaAc = 0.35;
    this.filteredSignal = this.filteredSignal * (1 - alphaAc) + acSignal * alphaAc;

    // 4. Update rolling buffer for amplitude analysis
    this.rawBuffer.push(this.filteredSignal);
    if (this.rawBuffer.length > this.bufferSize) {
      this.rawBuffer.shift();
    }

    let maxRecent = this.config.minimumPeakAmplitude;
    let signalPolarity: 1 | -1 = 1;
    for (const sample of this.rawBuffer) {
      const magnitude = Math.abs(sample);
      if (magnitude > maxRecent) {
        maxRecent = magnitude;
        signalPolarity = sample < 0 ? -1 : 1;
      }
    }
    this.adaptiveThreshold = Math.max(this.config.minimumPeakAmplitude, maxRecent * 0.45);

    let beatDetected = false;
    const timeSinceLastBeat = timestampMs - this.lastBeatTimeMs;
    const orientedSignal = this.filteredSignal * (this.inBeatWave ? this.candidatePolarity : signalPolarity);

    // 5. Peak detection with refractory period
    if (!this.inBeatWave) {
      if (orientedSignal > this.adaptiveThreshold && timeSinceLastBeat >= this.config.refractoryPeriodMs) {
        this.inBeatWave = true;
        this.candidatePolarity = signalPolarity;
        this.peakCandidate = orientedSignal;
        this.peakTimeMs = timestampMs;
      }
    } else {
      // Currently inside a candidate peak
      if (orientedSignal > this.peakCandidate) {
        this.peakCandidate = orientedSignal;
        this.peakTimeMs = timestampMs;
      } else if (orientedSignal < this.adaptiveThreshold * 0.4) {
        // Wave has fallen back below 40% of threshold -> confirm peak
        this.inBeatWave = false;

        if (this.lastBeatTimeMs > 0) {
          const candidateIbi = this.peakTimeMs - this.lastBeatTimeMs;
          const isPhysiologicallyValid =
            candidateIbi >= this.config.minIbiMs && candidateIbi <= this.config.maxIbiMs;

          // Check jitter relative to recent accepted IBI
          let isJitterAcceptable = true;
          if (this.lastValidIbiMs !== null) {
            const jitter = Math.abs(candidateIbi - this.lastValidIbiMs) / this.lastValidIbiMs;
            if (jitter > this.config.maxIbiJitterRatio) {
              isJitterAcceptable = false;
            }
          }

          if (isPhysiologicallyValid && isJitterAcceptable) {
            beatDetected = true;
            this.lastBeatTimeMs = this.peakTimeMs;
            this.lastValidIbiMs = candidateIbi;
            this.recentIbis.push(candidateIbi);
            if (this.recentIbis.length > 5) {
              this.recentIbis.shift();
            }
            this.consecutiveValidBeats++;

            // Calculate running average BPM from last 5 intervals
            const avgIbi = this.recentIbis.reduce((a, b) => a + b, 0) / this.recentIbis.length;
            this.currentBpm = Math.round(60000 / avgIbi);
          } else {
            // Re-anchor on this peak so one rejected interval cannot lock out recovery.
            this.lastBeatTimeMs = this.peakTimeMs;
            this.lastValidIbiMs = null;
            this.recentIbis = [];
            this.consecutiveValidBeats = 1;
            this.currentBpm = null;
          }
        } else {
          // First beat ever recorded
          this.lastBeatTimeMs = this.peakTimeMs;
          this.consecutiveValidBeats = 1;
        }
      }
    }

    // 6. Signal loss / timeout check
    if (this.lastBeatTimeMs > 0 && timestampMs - this.lastBeatTimeMs > this.config.signalLossTimeoutMs) {
      this.consecutiveValidBeats = 0;
      this.currentBpm = null;
      this.lastBeatTimeMs = 0;
      this.lastValidIbiMs = null;
      this.recentIbis = [];
      this.inBeatWave = false;
      this.peakCandidate = 0;
      this.peakTimeMs = 0;
    }

    // 7. Determine Signal Quality & Confidence
    let quality: SignalQuality = 'INITIALIZING';
    let confidence = 0;

    if (this.lastBeatTimeMs === 0 || timestampMs - this.lastBeatTimeMs > this.config.signalLossTimeoutMs) {
      quality = 'LOW_QUALITY';
      confidence = 10;
    } else if (this.consecutiveValidBeats < this.config.requiredConsecutiveBeats) {
      quality = 'INITIALIZING';
      confidence = Math.round((this.consecutiveValidBeats / this.config.requiredConsecutiveBeats) * 60);
    } else {
      quality = 'VALID';
      confidence = Math.min(98, 70 + this.consecutiveValidBeats * 5);
    }

    const isValid = quality === 'VALID' && this.currentBpm !== null;

    return {
      rawAdc,
      bpm: isValid ? this.currentBpm : null,
      ibiMs: this.lastValidIbiMs,
      valid: isValid,
      quality,
      confidence,
      beatDetected,
      consecutiveValidBeats: this.consecutiveValidBeats,
    };
  }
}
