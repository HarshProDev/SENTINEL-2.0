/**
 * SENTINEL 2.0 - Core Types and Live Protocol Specification
 * Schema Version: 1
 */

export type SignalQuality =
  | 'DISCONNECTED'
  | 'INITIALIZING'
  | 'CALIBRATING'
  | 'VALID'
  | 'LOW_QUALITY'
  | 'STALE'
  | 'ERROR';

export interface PulseMeasurement {
  rawAdc: number | null;
  bpm: number | null;
  ibiMs: number | null;
  valid: boolean;
  quality: SignalQuality;
  confidence: number; // 0 to 100
  beatDetected: boolean;
  consecutiveValidBeats: number;
}

export interface GsrMeasurement {
  rawAdc: number | null;
  smoothedAdc: number | null;
  baselineAdc: number | null;
  relativeChange: number | null; // percentage shift from baseline e.g. +12.5%
  valid: boolean;
  quality: SignalQuality;
  trend: 'STABLE' | 'RISING' | 'FALLING' | 'INDETERMINATE';
}

export interface SystemStatus {
  wifiConnected: boolean;
  ipAddress?: string;
  calibrating: boolean;
  calibrationProgress?: number; // 0 - 100%
  errorCode: string | null;
  batteryMv?: number;
  sampleRateHz: number;
}

export interface SentinelDataPacket {
  schemaVersion: 1;
  deviceId: string;
  deviceTimestampMs: number;
  receiveTimestampMs?: number;
  sequence: number;
  pulse: PulseMeasurement;
  gsr: GsrMeasurement;
  system: SystemStatus;
}

export interface SessionRecord {
  id: string;
  startTime: number;
  endTime?: number;
  durationSeconds: number;
  samples: Array<{
    timestampMs: number;
    pulseRaw: number | null;
    bpm: number | null;
    pulseValid: boolean;
    pulseQuality: SignalQuality;
    gsrRaw: number | null;
    gsrBaseline: number | null;
    gsrRelativeChange: number | null;
    gsrValid: boolean;
  }>;
  summary: {
    totalSamples: number;
    validBpmSamples: number;
    meanBpm: number | null;
    minBpm: number | null;
    maxBpm: number | null;
    meanGsrAdc: number | null;
    maxGsrRelativeChange: number | null;
    overallDataQuality: SignalQuality;
  };
}

export interface AiInterpretationRequest {
  sessionDurationSeconds: number;
  meanBpm: number | null;
  minBpm: number | null;
  maxBpm: number | null;
  bpmStability: 'STABLE' | 'MODERATE_VARIABILITY' | 'HIGH_VARIABILITY' | 'UNKNOWN';
  gsrRelativeChangePercent: number | null;
  gsrTrend: 'STABLE' | 'RISING' | 'FALLING' | 'INDETERMINATE';
  dataQuality: SignalQuality;
  validBeatRatio: number; // 0.0 to 1.0
  notes?: string;
}

export interface AiInterpretationResponse {
  status: 'ok' | 'error' | 'rejected_invalid_data';
  summary: string;
  pulseAnalysis: string;
  gsrAnalysis: string;
  recommendations: string[];
  cautions: string[];
  dataQuality: SignalQuality;
  generatedAt: string;
  provider: 'groq' | 'gemini' | 'system_rules';
  errorDetails?: string;
}
