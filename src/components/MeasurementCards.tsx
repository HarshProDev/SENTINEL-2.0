import React, { memo } from 'react';
import { Heart, Zap, RefreshCw, ShieldCheck, AlertCircle, Compass, RotateCcw } from 'lucide-react';
import { PulseMeasurement, GsrMeasurement } from '../types/sentinel';

interface MeasurementCardsProps {
  pulse: PulseMeasurement;
  gsr: GsrMeasurement;
  onStartCalibration: () => void;
  onResetCalibration: () => void;
  isCalibrating: boolean;
  calibrationProgress: number;
  calibrationError: string | null;
}

export const MeasurementCards: React.FC<MeasurementCardsProps> = memo(({
  pulse,
  gsr,
  onStartCalibration,
  onResetCalibration,
  isCalibrating,
  calibrationProgress,
  calibrationError,
}) => {
  const getBpmDisplay = () => {
    if (pulse.quality === 'DISCONNECTED') {
      return <span className="text-rose-400 text-3xl font-bold tracking-tight">DISCONNECTED</span>;
    }
    if (pulse.valid && pulse.bpm !== null && pulse.bpm > 0) {
      return (
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-black text-white font-mono tracking-tight">{pulse.bpm}</span>
          <span className="text-sm font-semibold text-slate-400">BPM</span>
        </div>
      );
    }
    if (pulse.quality === 'STALE' && pulse.bpm !== null && pulse.bpm > 0) {
      return (
        <div className="flex flex-col">
          <span className="text-amber-300 text-3xl font-bold">LAST: {pulse.bpm} BPM</span>
          <span className="text-xs text-slate-400">Waiting for ESP32 telemetry to resume</span>
        </div>
      );
    }
    if (pulse.quality === 'STALE') {
      return <span className="text-amber-300 text-2xl font-bold">RECONNECTING...</span>;
    }
    if (pulse.quality === 'INITIALIZING') {
      return (
        <div className="flex flex-col">
          <span className="text-amber-400 text-2xl font-bold">SYNCING...</span>
          <span className="text-xs text-slate-400">Pulse detected; checking beat timing ({pulse.consecutiveValidBeats}/4)</span>
        </div>
      );
    }
    if (pulse.quality === 'LOW_QUALITY') {
      return (
        <div className="flex flex-col">
          <span className="text-amber-300 text-2xl font-bold">WEAK PPG SIGNAL</span>
          <span className="text-xs text-slate-400">Check GPIO 34 wiring; shield the sensor and rest a still finger lightly until 4 beats lock</span>
        </div>
      );
    }
    return <span className="text-slate-400 text-2xl font-bold">SEARCHING...</span>;
  };

  const getGsrRelativeDisplay = () => {
    if (gsr.quality === 'DISCONNECTED') {
      return <span className="text-rose-400 text-3xl font-bold tracking-tight">OPEN CIRCUIT</span>;
    }
    if (isCalibrating) {
      return (
        <div className="flex flex-col">
          <span className="text-cyan-400 text-2xl font-bold">RECORDING...</span>
          <span className="text-xs text-slate-400">Acquiring resting baseline</span>
        </div>
      );
    }
    if (gsr.valid && gsr.relativeChange !== null) {
      const isPositive = gsr.relativeChange > 0;
      const color = Math.abs(gsr.relativeChange) < 5
        ? 'text-emerald-400'
        : isPositive
        ? 'text-cyan-400'
        : 'text-blue-400';

      return (
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-black font-mono tracking-tight ${color}`}>
            {isPositive ? `+${gsr.relativeChange}%` : `${gsr.relativeChange}%`}
          </span>
          <span className="text-xs font-semibold text-slate-400">vs BASELINE</span>
        </div>
      );
    }
    return <span className="text-slate-400 text-2xl font-bold">STANDBY</span>;
  };

  return (
    <div className="measurements-grid">
      {/* 1. Heart Rate Card */}
      <div className="measurement-card pulse-feature bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between relative overflow-hidden shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Heart className={`w-4 h-4 ${pulse.beatDetected ? 'text-rose-400 fill-rose-500 scale-125' : 'text-slate-500'} transition-transform duration-75`} />
            Heart Rate (PPG)
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded font-mono ${
              pulse.valid ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {pulse.quality}
          </span>
        </div>

        <div className="my-4">{getBpmDisplay()}</div>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <div>
            <span className="text-slate-500 block">IBI Interval</span>
            <span className="font-mono text-slate-200">{pulse.ibiMs ? `${pulse.ibiMs} ms` : '--'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Confidence</span>
            <span className="font-mono text-slate-200">{pulse.confidence}%</span>
          </div>
        </div>
      </div>

      {/* 2. Pulse Signal Quality Card */}
      <div className="measurement-card quality-card bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            Pulse Signal Quality
          </span>
          <span className="text-xs font-mono text-slate-400">GPIO 34 (ADC1)</span>
        </div>

        <div className="my-3">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs text-slate-400">Raw 12-Bit ADC</span>
            <span className="text-lg font-mono font-bold text-slate-200">{pulse.rawAdc ?? '--'}</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className="bg-cyan-500 h-2 rounded-full transition-all duration-100"
              style={{ width: `${Math.min(100, ((pulse.rawAdc ?? 0) / 4095) * 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <div>
            <span className="text-slate-500 block">Valid Beats</span>
            <span className="font-mono text-slate-200">{pulse.consecutiveValidBeats} / 4 req</span>
          </div>
          <div>
            <span className="text-slate-500 block">Refractory Gate</span>
            <span className="font-mono text-emerald-400">320 ms active</span>
          </div>
        </div>
      </div>

      {/* 3. GSR Skin Conductance Card */}
      <div className="measurement-card gsr-card bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-blue-400" />
            Skin Response (GSR)
          </span>
          <span className="text-xs px-2 py-0.5 rounded font-mono bg-blue-950/80 text-blue-300 border border-blue-800">
            {gsr.trend}
          </span>
        </div>

        <div className="my-4">{getGsrRelativeDisplay()}</div>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <div>
            <span className="text-slate-500 block">Current Smoothed</span>
            <span className="font-mono text-slate-200">{gsr.smoothedAdc ?? '--'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Resting Baseline</span>
            <span className="font-mono text-slate-200">{gsr.baselineAdc ?? 'Not set'}</span>
          </div>
        </div>
      </div>

      {/* 4. Baseline Calibration Card */}
      <div className="measurement-card calibration-card bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-emerald-400" />
            Calibration Studio
          </span>
          <span className="text-xs font-mono text-slate-400">15-sec Window</span>
        </div>

        <div className="my-3">
          {isCalibrating ? (
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-cyan-400 font-semibold flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Recording Baseline...
                </span>
                <span className="font-mono text-slate-300">{calibrationProgress}%</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className="bg-cyan-400 h-2 rounded-full transition-all duration-150"
                  style={{ width: `${calibrationProgress}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {gsr.baselineAdc === null
                  ? 'Calibrate a stable resting baseline before viewing relative skin conductance changes.'
                  : 'Resting baseline established. Recalibrate after changing electrode placement.'}
              </p>
            </div>
          )}
          {calibrationError && (
            <p className="mt-2 text-xs text-rose-300" role="alert">
              Calibration failed: {calibrationError.replaceAll('_', ' ').toLowerCase()}.
              Check sensor contact and keep your hand still, then retry.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
          <button
            onClick={onStartCalibration}
            disabled={isCalibrating || gsr.quality === 'DISCONNECTED'}
            className="flex-1 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCalibrating ? 'animate-spin' : ''}`} />
            <span>{isCalibrating ? 'Calibrating...' : 'Start Calibration'}</span>
          </button>
          <button
            onClick={onResetCalibration}
            aria-label="Clear calibrated GSR baseline"
            title="Clear the calibrated baseline"
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded-lg border border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});
