import React from 'react';
import { Sliders, Activity, ShieldAlert, Heart, Zap, Sparkles } from 'lucide-react';

interface SimulatorControlsProps {
  simTargetBpm: number;
  setSimTargetBpm: (bpm: number) => void;
  simGsrDeflection: number;
  setSimGsrDeflection: (val: number) => void;
  simNoiseLevel: 'none' | 'light' | 'heavy';
  setSimNoiseLevel: (level: 'none' | 'light' | 'heavy') => void;
  simDisconnected: boolean;
  setSimDisconnected: (dis: boolean) => void;
  onApplyPreset: (name: string) => void;
}

export const SimulatorControls: React.FC<SimulatorControlsProps> = ({
  simTargetBpm,
  setSimTargetBpm,
  simGsrDeflection,
  setSimGsrDeflection,
  simNoiseLevel,
  setSimNoiseLevel,
  simDisconnected,
  setSimDisconnected,
  onApplyPreset,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-200">
            Hardware Diagnostic & Biometric Signal Injector
          </h3>
        </div>
        <span className="text-xs text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800 font-mono">
          Interactive DSP Testbench
        </span>
      </div>

      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        Test the real-time DSP filters, 320ms refractory gate, and honest state machine before or during hardware breadboard assembly.
      </p>

      {/* Preset Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <button
          onClick={() => onApplyPreset('resting')}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-1.5 px-2.5 rounded-lg border border-slate-700 flex items-center justify-center gap-1.5"
        >
          <Heart className="w-3.5 h-3.5 text-emerald-400" />
          <span>Resting (72 BPM)</span>
        </button>

        <button
          onClick={() => onApplyPreset('elevated')}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-1.5 px-2.5 rounded-lg border border-slate-700 flex items-center justify-center gap-1.5"
        >
          <Activity className="w-3.5 h-3.5 text-amber-400" />
          <span>Elevated (105 BPM)</span>
        </button>

        <button
          onClick={() => onApplyPreset('gsr_spike')}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-1.5 px-2.5 rounded-lg border border-slate-700 flex items-center justify-center gap-1.5"
        >
          <Zap className="w-3.5 h-3.5 text-blue-400" />
          <span>GSR Surge (+18%)</span>
        </button>

        <button
          onClick={() => onApplyPreset('disconnect')}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-1.5 px-2.5 rounded-lg border border-slate-700 flex items-center justify-center gap-1.5"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          <span>Disconnect Sensor</span>
        </button>
      </div>

      {/* Manual Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-800 text-xs">
        {/* Heart Rate Slider */}
        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span>Target Pulse Rate</span>
            <span className="font-mono text-cyan-400 font-bold">{simTargetBpm} BPM</span>
          </div>
          <input
            type="range"
            min={45}
            max={180}
            step={1}
            value={simTargetBpm}
            onChange={(e) => setSimTargetBpm(parseInt(e.target.value, 10))}
            disabled={simDisconnected}
            aria-label="Target Pulse Rate"
            className="w-full accent-cyan-500 cursor-pointer disabled:opacity-30"
          />
        </div>

        {/* GSR Deflection Slider */}
        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span>GSR Shift from Baseline</span>
            <span className="font-mono text-blue-400 font-bold">
              {simGsrDeflection > 0 ? `+${simGsrDeflection}%` : `${simGsrDeflection}%`}
            </span>
          </div>
          <input
            type="range"
            min={-30}
            max={50}
            step={1}
            value={simGsrDeflection}
            onChange={(e) => setSimGsrDeflection(parseInt(e.target.value, 10))}
            disabled={simDisconnected}
            aria-label="GSR Shift from Baseline"
            className="w-full accent-blue-500 cursor-pointer disabled:opacity-30"
          />
        </div>

        {/* Noise Injection */}
        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span>Motion Noise Artifacts</span>
            <span className="font-mono text-slate-400 uppercase">{simNoiseLevel}</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(['none', 'light', 'heavy'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setSimNoiseLevel(level)}
                className={`py-1 rounded font-medium text-[11px] capitalize border ${
                  simNoiseLevel === level
                    ? 'bg-cyan-600 text-white border-cyan-500'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
