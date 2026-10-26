import React from 'react';
import { Download, Trash2, Clock, CheckCircle2, AlertCircle, BarChart3 } from 'lucide-react';
import { SessionRecord, SignalQuality } from '../types/sentinel';

interface SessionManagerProps {
  session: SessionRecord | null;
  onClearSession: () => void;
  isRecording: boolean;
}

export const SessionManager: React.FC<SessionManagerProps> = ({
  session,
  onClearSession,
  isRecording,
}) => {
  const handleExportCsv = () => {
    if (!session || session.samples.length === 0) return;

    const headers = [
      'timestamp_ms',
      'iso_time',
      'pulse_raw_adc',
      'bpm',
      'pulse_valid',
      'pulse_quality',
      'gsr_raw_adc',
      'gsr_baseline_adc',
      'gsr_relative_change_pct',
      'gsr_valid',
    ];

    const rows = session.samples.map((s) => [
      s.timestampMs,
      new Date(s.timestampMs).toISOString(),
      s.pulseRaw ?? '',
      s.bpm ?? '',
      s.pulseValid,
      s.pulseQuality,
      s.gsrRaw ?? '',
      s.gsrBaseline ?? '',
      s.gsrRelativeChange ?? '',
      s.gsrValid,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sentinel_session_${session.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!session || session.samples.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center shadow-sm">
        <BarChart3 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-300">No Session Recorded Yet</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4 leading-relaxed">
          Click &ldquo;Record Session&rdquo; in the top navigation bar to begin capturing continuous
          100Hz physiological telemetry, statistical distributions, and CSV export records.
        </p>
      </div>
    );
  }

  const { summary } = session;
  const validRatio =
    summary.totalSamples > 0
      ? Math.round((summary.validBpmSamples / summary.totalSamples) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">Session Telemetry Analysis</h3>
              <span className="text-xs font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                ID: {session.id}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Recorded at {new Date(session.startTime).toLocaleString()} • Duration:{' '}
              {Math.round(session.durationSeconds)} seconds
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClearSession}
              disabled={isRecording}
              className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 text-xs px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Statistical Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-500 block">Total Samples</span>
            <span className="text-xl font-bold font-mono text-slate-200">
              {summary.totalSamples}
            </span>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-500 block">Mean Heart Rate</span>
            <span className="text-xl font-bold font-mono text-cyan-400">
              {summary.meanBpm ? `${summary.meanBpm} BPM` : '--'}
            </span>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-500 block">BPM Range (Min - Max)</span>
            <span className="text-xl font-bold font-mono text-slate-200">
              {summary.minBpm && summary.maxBpm ? `${summary.minBpm} - ${summary.maxBpm}` : '--'}
            </span>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-500 block">Valid Signal Ratio</span>
            <span className="text-xl font-bold font-mono text-emerald-400">{validRatio}%</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-500 block">Mean GSR Conductance</span>
            <span className="text-xl font-bold font-mono text-blue-400">
              {summary.meanGsrAdc ? `${summary.meanGsrAdc}` : '--'}
            </span>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-500 block">Peak GSR Deflection</span>
            <span className="text-xl font-bold font-mono text-purple-400">
              {summary.maxGsrRelativeChange !== null
                ? `${summary.maxGsrRelativeChange > 0 ? '+' : ''}${summary.maxGsrRelativeChange}%`
                : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Sample Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Telemetry Sample Ledger (Last 20 Samples)
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="pb-2">Time (s)</th>
                <th className="pb-2">Pulse Raw</th>
                <th className="pb-2">BPM</th>
                <th className="pb-2">Pulse Quality</th>
                <th className="pb-2">GSR Raw</th>
                <th className="pb-2">GSR Baseline</th>
                <th className="pb-2">ΔGSR %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {session.samples.slice(-20).map((s, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40">
                  <td className="py-1.5 text-slate-500">
                    {((s.timestampMs - session.startTime) / 1000).toFixed(2)}s
                  </td>
                  <td className="py-1.5">{s.pulseRaw ?? '--'}</td>
                  <td className="py-1.5 font-bold text-cyan-400">{s.bpm ?? '--'}</td>
                  <td className="py-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        s.pulseQuality === 'VALID'
                          ? 'bg-emerald-950 text-emerald-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {s.pulseQuality}
                    </span>
                  </td>
                  <td className="py-1.5">{s.gsrRaw ?? '--'}</td>
                  <td className="py-1.5">{s.gsrBaseline ?? '--'}</td>
                  <td className="py-1.5">
                    {s.gsrRelativeChange !== null ? (
                      <span className={s.gsrRelativeChange > 0 ? 'text-cyan-400' : 'text-blue-400'}>
                        {s.gsrRelativeChange > 0
                          ? `+${s.gsrRelativeChange}%`
                          : `${s.gsrRelativeChange}%`}
                      </span>
                    ) : (
                      '--'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
