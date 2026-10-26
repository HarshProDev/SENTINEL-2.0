/**
 * SENTINEL 2.0 - Galvanic Skin Response (GSR) Processor
 * Pure deterministic algorithms for skin conductance smoothing,
 * dynamic/manual baseline calibration, trend detection, and anomaly flagging.
 */

import { GsrMeasurement, SignalQuality } from '../types/sentinel';

export interface GsrProcessorConfig {
  smoothingAlpha: number; // 0.05 - 0.20 for exponential moving average
  calibrationSamplesRequired: number; // At 50Hz in the dashboard simulator, 750 samples = 15 seconds
  driftThresholdPercent: number; // e.g. 2.5% shift required to trigger rising/falling trend
  minValidAdc: number; // 20 (below which sensor is disconnected / open circuit)
  maxValidAdc: number; // 4075 (above which sensor is shorted / saturated)
}

export const DEFAULT_GSR_CONFIG: GsrProcessorConfig = {
  smoothingAlpha: 0.1,
  calibrationSamplesRequired: 750,
  driftThresholdPercent: 2.0,
  minValidAdc: 25,
  maxValidAdc: 4070,
};

export class GsrProcessor {
  private config: GsrProcessorConfig;
  private smoothedAdc: number | null = null;
  private baselineAdc: number | null = null;

  // Calibration buffer
  private isCalibrating: boolean = false;
  private calibrationBuffer: number[] = [];

  // Trend detection buffer
  private recentTrends: number[] = [];

  constructor(config: Partial<GsrProcessorConfig> = {}) {
    this.config = { ...DEFAULT_GSR_CONFIG, ...config };
  }

  public reset(): void {
    this.smoothedAdc = null;
    this.baselineAdc = null;
    this.isCalibrating = false;
    this.calibrationBuffer = [];
    this.recentTrends = [];
  }

  /**
   * Start a dedicated calibration period to record personal baseline.
   */
  public startCalibration(): void {
    this.isCalibrating = true;
    this.calibrationBuffer = [];
  }

  /**
   * Cancel ongoing calibration.
   */
  public cancelCalibration(): void {
    this.isCalibrating = false;
    this.calibrationBuffer = [];
  }

  /**
   * Set baseline directly (e.g. from saved user session or manual override).
   */
  public setBaseline(baseline: number): void {
    if (baseline >= this.config.minValidAdc && baseline <= this.config.maxValidAdc) {
      this.baselineAdc = baseline;
    }
  }

  public getBaseline(): number | null {
    return this.baselineAdc;
  }

  public isCalibrationActive(): boolean {
    return this.isCalibrating;
  }

  public getCalibrationProgress(): number {
    if (!this.isCalibrating) return 0;
    return Math.min(
      100,
      Math.round((this.calibrationBuffer.length / this.config.calibrationSamplesRequired) * 100)
    );
  }

  /**
   * Process a single raw GSR ADC sample.
   * @param rawAdc - Raw 12-bit ADC reading (0-4095 on ESP32)
   */
  public processSample(rawAdc: number): GsrMeasurement {
    // 1. Hardware connection boundary checks
    if (rawAdc < this.config.minValidAdc || rawAdc > this.config.maxValidAdc) {
      return {
        rawAdc,
        smoothedAdc: null,
        baselineAdc: this.baselineAdc,
        relativeChange: null,
        valid: false,
        quality: 'DISCONNECTED',
        trend: 'INDETERMINATE',
      };
    }

    // 2. Exponential smoothing filter
    if (this.smoothedAdc === null) {
      this.smoothedAdc = rawAdc;
    } else {
      this.smoothedAdc =
        this.smoothedAdc * (1 - this.config.smoothingAlpha) +
        rawAdc * this.config.smoothingAlpha;
    }

    // 3. Calibration handling
    if (this.isCalibrating) {
      this.calibrationBuffer.push(rawAdc);
      if (this.calibrationBuffer.length >= this.config.calibrationSamplesRequired) {
        // Complete calibration: compute median to discard movement spikes
        const sorted = [...this.calibrationBuffer].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        this.baselineAdc =
          sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        this.isCalibrating = false;
        this.calibrationBuffer = [];
      } else {
        return {
          rawAdc,
          smoothedAdc: Math.round(this.smoothedAdc * 10) / 10,
          baselineAdc: null,
          relativeChange: null,
          valid: false,
          quality: 'CALIBRATING',
          trend: 'INDETERMINATE',
        };
      }
    }

    // Default auto-baseline if no manual calibration was run yet
    if (this.baselineAdc === null) {
      this.baselineAdc = Math.round(this.smoothedAdc);
    }

    // 4. Baseline-relative change calculation
    // In typical GSR voltage-divider circuits (sensor + fixed resistor),
    // higher conductance (sweat/arousal) lowers skin resistance, changing the ADC voltage.
    // We compute percentage deviation from resting baseline.
    let relativeChange: number | null = null;
    if (this.baselineAdc > 0) {
      relativeChange =
        Math.round(((this.smoothedAdc - this.baselineAdc) / this.baselineAdc) * 1000) / 10;
    }

    // 5. Trend detection (buffer last 10 smoothed samples)
    this.recentTrends.push(this.smoothedAdc);
    if (this.recentTrends.length > 10) {
      this.recentTrends.shift();
    }

    let trend: 'STABLE' | 'RISING' | 'FALLING' | 'INDETERMINATE' = 'STABLE';
    if (this.recentTrends.length >= 5 && relativeChange !== null) {
      const delta = this.recentTrends[this.recentTrends.length - 1] - this.recentTrends[0];
      const deltaPercent = (delta / this.baselineAdc) * 100;

      if (deltaPercent > this.config.driftThresholdPercent) {
        trend = 'RISING';
      } else if (deltaPercent < -this.config.driftThresholdPercent) {
        trend = 'FALLING';
      } else {
        trend = 'STABLE';
      }
    }

    return {
      rawAdc,
      smoothedAdc: Math.round(this.smoothedAdc * 10) / 10,
      baselineAdc: Math.round(this.baselineAdc * 10) / 10,
      relativeChange,
      valid: true,
      quality: 'VALID',
      trend,
    };
  }
}
