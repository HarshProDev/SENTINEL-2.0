import React, { memo, useState } from 'react';
import { Sparkles, AlertTriangle, ShieldCheck, CheckCircle2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { AiInterpretationRequest, AiInterpretationResponse, SignalQuality } from '../types/sentinel';

interface AiAssistantPanelProps {
  sessionDuration: number;
  meanBpm: number | null;
  minBpm: number | null;
  maxBpm: number | null;
  validBeatRatio: number;
  gsrRelativeChange: number | null;
  gsrTrend: 'STABLE' | 'RISING' | 'FALLING' | 'INDETERMINATE';
  overallQuality: SignalQuality;
  onResponse: (response: AiInterpretationResponse) => void;
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = memo(({
  sessionDuration,
  meanBpm,
  minBpm,
  maxBpm,
  validBeatRatio,
  gsrRelativeChange,
  gsrTrend,
  overallQuality,
  onResponse,
}) => {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AiInterpretationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPayload, setShowPayload] = useState(false);

  // Determine BPM stability
  let bpmStability: 'STABLE' | 'MODERATE_VARIABILITY' | 'HIGH_VARIABILITY' | 'UNKNOWN' = 'UNKNOWN';
  if (minBpm !== null && maxBpm !== null && meanBpm !== null) {
    const spread = maxBpm - minBpm;
    if (spread < 12) bpmStability = 'STABLE';
    else if (spread < 25) bpmStability = 'MODERATE_VARIABILITY';
    else bpmStability = 'HIGH_VARIABILITY';
  }

  const payload: AiInterpretationRequest = {
    sessionDurationSeconds: Math.round(sessionDuration),
    meanBpm,
    minBpm,
    maxBpm,
    bpmStability,
    gsrRelativeChangePercent: gsrRelativeChange,
    gsrTrend,
    dataQuality: meanBpm !== null && validBeatRatio >= 0.35 ? 'VALID' : overallQuality,
    validBeatRatio: Math.round(validBeatRatio * 100) / 100,
  };

  const isEligible =
    sessionDuration >= 10 &&
    meanBpm !== null &&
    validBeatRatio >= 0.35;

  const handleRequestAi = async () => {
    if (!isEligible) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/ai/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data: AiInterpretationResponse = await res.json();
      setResponse(data);
      onResponse(data);
    } catch (err) {
      setErrorMessage((err as Error).message || 'Failed to request AI analysis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-panel bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Groq AI Physiological Response Assistant
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cautious contextual wellness observations derived strictly from validated session summaries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPayload(!showPayload)}
            className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950 flex items-center gap-1.5"
          >
            {showPayload ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showPayload ? 'Hide Payload' : 'Inspect Sent Data'}</span>
          </button>

          <button
            onClick={handleRequestAi}
            disabled={!isEligible || loading}
            className={`min-w-52 justify-center text-xs px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ${isEligible
              ? 'bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-950'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }`}
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" />
            ) : (
              <Sparkles className="w-4 h-4 text-cyan-300" />
            )}
            <span>{loading ? 'Synthesizing...' : 'Request AI Interpretation'}</span>
          </button>
        </div>
      </div>

      {/* Eligibility Warning if gated */}
      {!isEligible && (
        <div className="mb-4 bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs text-slate-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            {sessionDuration < 10
              ? `Record and stop a session of at least 10 seconds to enable analysis. Current completed session: ${Math.round(sessionDuration)}s.`
              : meanBpm === null || validBeatRatio < 0.35
                ? 'AI analysis is withheld because the completed session did not contain enough valid pulse data. Ensure calm, steady sensor contact and record again.'
                : 'AI analysis is unavailable for this session.'}
          </span>
        </div>
      )}

      {/* Transparent Payload Inspection Drawer */}
      {showPayload && (
        <div className="mb-4 p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-cyan-300">
          <div className="flex items-center justify-between text-slate-400 mb-2 font-sans font-semibold">
            <span>Aggregated Summary Sent to Server (Zero Raw Waveforms Transmitted):</span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">Privacy Preserved</span>
          </div>
          <pre className="overflow-x-auto text-xs">{JSON.stringify(payload, null, 2)}</pre>
        </div>
      )}

      <div className="ai-result-region" aria-live="polite" aria-busy={loading}>
        {/* Response Card */}
        {response ? (
          <div className="ai-response bg-slate-950 border border-slate-800/90 rounded-xl p-4 mt-2">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800/80 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">Status:</span>
              <span className="px-2 py-0.5 rounded font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                {response.status.toUpperCase()}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Provider:</span>
              <span className="text-cyan-400 font-mono font-medium">
                {response.provider === 'groq'
                  ? 'Groq Cloud (Llama 3.3)'
                  : response.provider === 'gemini'
                    ? 'Google GenAI (Gemini)'
                    : 'Deterministic Rule Engine'}
              </span>
            </div>

            <span className="text-slate-500 font-mono text-[11px]">
              {new Date(response.generatedAt).toLocaleTimeString()}
            </span>
          </div>

          {/* Non-Medical Disclaimer Badge */}
          <div className="bg-blue-950/40 border border-blue-900/50 rounded-lg p-2.5 mb-3 flex items-start gap-2 text-xs text-blue-300">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-blue-200">Non-Medical Educational Notice:</span> This prototype cannot diagnose medical conditions or definitively assess emotions. Physiological signals are influenced by temperature, speech, and physical motion.
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            {[
              { label: 'Mean heart rate', value: meanBpm === null ? '--' : `${meanBpm} BPM` },
              { label: 'Recorded range', value: minBpm === null || maxBpm === null ? '--' : `${minBpm}-${maxBpm} BPM` },
              { label: 'GSR change', value: gsrRelativeChange === null ? 'No baseline' : `${gsrRelativeChange > 0 ? '+' : ''}${gsrRelativeChange}%` },
              { label: 'Session length', value: `${Math.round(sessionDuration)} s` },
              { label: 'Valid pulse data', value: `${Math.round(validBeatRatio * 100)}%` },
            ].map((metric) => (
              <div key={metric.label} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <span className="block text-[10px] uppercase tracking-wide text-slate-500">{metric.label}</span>
                <span className="mt-1 block font-mono text-sm font-semibold text-slate-100">{metric.value}</span>
              </div>
            ))}
          </div>

          {/* Structured summary and practical recommendations */}
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Session Overview
              </span>
              <p className="text-slate-200 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/60">
                {response.summary}
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Heart Rate Analysis
              </span>
              <p className="text-slate-200 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/60">
                {response.pulseAnalysis}
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                GSR Analysis
              </span>
              <p className="text-slate-200 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/60">
                {response.gsrAnalysis}
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Practical Recommendations
              </span>
              <ol className="ai-accent list-decimal list-inside text-cyan-200 leading-relaxed bg-cyan-950/30 p-3 rounded-lg border border-cyan-900/40 space-y-2">
                {response.recommendations.map((recommendation, idx) => (
                  <li className='text-emerald-800' key={idx}>{recommendation}</li>
                ))}
              </ol>
            </div>

            {response.cautions && response.cautions.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Limitations & Cautions
                </span>
                <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                  {response.cautions.map((caution, idx) => (
                    <li key={idx}>{caution}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="ai-result-placeholder rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 mt-2">
          {loading ? (
            <div className="flex items-center gap-3 text-sm text-slate-300" role="status">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
              <span>Generating your session interpretation. Your readings remain available above.</span>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Your AI interpretation will appear here after you request it. Your session summary stays on screen while the response is generated.
            </p>
          )}
        </div>
      )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="mt-3 bg-rose-950/80 border border-rose-800 text-rose-300 p-3 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={handleRequestAi}
            className="text-xs bg-rose-900 hover:bg-rose-800 px-2 py-1 rounded text-white"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
});
