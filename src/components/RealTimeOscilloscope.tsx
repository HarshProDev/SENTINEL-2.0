import React, { memo, useRef, useEffect, useState } from 'react';
import { Pause, Play, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface WaveformPoint {
  timestampMs: number;
  rawAdc: number;
  filteredAc: number;
  threshold: number;
  isPeak: boolean;
}

interface GsrPoint {
  timestampMs: number;
  relativeChange: number;
  smoothedAdc: number;
  baseline: number;
}

interface RealTimeOscilloscopeProps {
  pulseHistory: WaveformPoint[];
  gsrHistory: GsrPoint[];
  isPulseValid: boolean;
  isGsrValid: boolean;
}

export const RealTimeOscilloscope: React.FC<RealTimeOscilloscopeProps> = memo(({
  pulseHistory,
  gsrHistory,
  isPulseValid,
  isGsrValid,
}) => {
  const pulseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gsrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [timeWindowSecs, setTimeWindowSecs] = useState<number>(10);

  // Render Pulse Waveform
  useEffect(() => {
    if (isPaused) return;
    const canvas = pulseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Background
    ctx.fillStyle = '#f8fbfa';
    ctx.fillRect(0, 0, width, height);

    // Draw Grid Lines
    ctx.strokeStyle = '#e0ebe7';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    if (pulseHistory.length < 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting pulse sensor stream...', width / 2, height / 2);
      return;
    }

    // Determine scale from recent history
    const values = pulseHistory.map((p) => p.rawAdc);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);
    const amplitudeMargin = Math.max(4, (maxVal - minVal) * 0.2);
    minVal -= amplitudeMargin;
    maxVal += amplitudeMargin;

    const range = maxVal - minVal || 1;
    const padding = 20;

    // Draw Waveform with Gradient Glow
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#16877f';
    ctx.shadowColor = '#59b3a0';
    ctx.shadowBlur = 5;

    for (let i = 0; i < pulseHistory.length; i++) {
      const pt = pulseHistory[i];
      const x = (i / (pulseHistory.length - 1)) * width;
      const normalizedY = 1 - (pt.rawAdc - minVal) / range;
      const y = padding + normalizedY * (height - padding * 2);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0; // reset shadow

    // Draw Systolic Peak Markers
    for (let i = 0; i < pulseHistory.length; i++) {
      const pt = pulseHistory[i];
      if (pt.isPeak) {
        const x = (i / (pulseHistory.length - 1)) * width;
        const normalizedY = 1 - (pt.rawAdc - minVal) / range;
        const y = padding + normalizedY * (height - padding * 2);

        ctx.fillStyle = '#e8799c';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Axis labels
    ctx.fillStyle = '#81869a';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Max ADC: ${Math.round(maxVal)}`, 8, 14);
    ctx.fillText(`Min ADC: ${Math.round(minVal)}`, 8, height - 6);
  }, [pulseHistory, isPaused]);

  // Render GSR Relative Response
  useEffect(() => {
    if (isPaused) return;
    const canvas = gsrCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Background
    ctx.fillStyle = '#f8fbfa';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#e0ebe7';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Zero-baseline horizontal line
    const zeroY = height / 2;
    ctx.strokeStyle = '#bacbc4';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(width, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (gsrHistory.length < 2) {
      ctx.fillStyle = '#81869a';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting GSR skin conductance stream...', width / 2, height / 2);
      return;
    }

    // Fixed or dynamic vertical range centered on 0%
    const changes = gsrHistory.map((g) => g.relativeChange);
    const maxAbs = Math.max(10, ...changes.map((c) => Math.abs(c)));
    const padding = 15;

    // Draw GSR curve with fill area
    ctx.beginPath();
    ctx.moveTo(0, zeroY);

    for (let i = 0; i < gsrHistory.length; i++) {
      const pt = gsrHistory[i];
      const x = (i / (gsrHistory.length - 1)) * width;
      const normalized = -pt.relativeChange / maxAbs; // inverted: up is positive
      const y = zeroY + normalized * (height / 2 - padding);
      ctx.lineTo(x, y);
    }

    ctx.lineTo(width, zeroY);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(79, 164, 133, 0.2)');
    gradient.addColorStop(0.5, 'rgba(79, 164, 133, 0.04)');
    gradient.addColorStop(1, 'rgba(22, 125, 122, 0.14)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    for (let i = 0; i < gsrHistory.length; i++) {
      const pt = gsrHistory[i];
      const x = (i / (gsrHistory.length - 1)) * width;
      const normalized = -pt.relativeChange / maxAbs;
      const y = zeroY + normalized * (height / 2 - padding);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#4d946d';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#81869a';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`+${Math.round(maxAbs)}% (Elevated Conductance)`, 8, 14);
    ctx.fillText('0% Calibrated Baseline', 8, zeroY - 4);
    ctx.fillText(`-${Math.round(maxAbs)}% (Reduced Conductance)`, 8, height - 6);
  }, [gsrHistory, isPaused]);

  return (
    <div className="waveform-grid">
      {/* Pulse Oscilloscope */}
      <div className="signal-panel bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
            <h3 className="text-sm font-semibold text-slate-200">
              Photoplethysmogram (PPG) Oscilloscope
            </h3>
            <span className="text-xs text-slate-500 font-mono">100 Hz Live</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium flex items-center gap-1 border border-slate-700"
            >
              {isPaused ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
              <span>{isPaused ? 'Resume' : 'Freeze'}</span>
            </button>
            <div className="text-xs text-slate-400 font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800">
              Window: {timeWindowSecs}s
            </div>
          </div>
        </div>

        <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-[#090e1a]">
          <canvas
            ref={pulseCanvasRef}
            width={640}
            height={220}
            className="w-full h-52 block"
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 mt-2 px-1">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-1 bg-cyan-400 inline-block"></span> PPG Waveform
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> Confirmed Systolic Peak
            </span>
          </div>
          <span>Refractory Lockout: 320ms</span>
        </div>
      </div>

      {/* GSR Relative Response Graph */}
      <div className="signal-panel bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
            <h3 className="text-sm font-semibold text-slate-200">
              Galvanic Skin Response (Relative Shift)
            </h3>
            <span className="text-xs text-slate-500 font-mono">ΔGSR %</span>
          </div>

          <span className="text-xs px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 font-mono">
            Tonic + Phasic
          </span>
        </div>

        <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-[#090e1a]">
          <canvas
            ref={gsrCanvasRef}
            width={640}
            height={220}
            className="w-full h-52 block"
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 mt-2 px-1">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-1 bg-blue-400 inline-block"></span> Phasic Conductance
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 border-t border-dashed border-slate-400 inline-block"></span> Resting Baseline (0%)
            </span>
          </div>
          <span>Non-diagnostic autonomic deflection</span>
        </div>
      </div>
    </div>
  );
});
