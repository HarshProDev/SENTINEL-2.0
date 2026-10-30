import React, { useEffect, useState } from 'react';
import { Download, Trash2, BarChart3, Printer } from 'lucide-react';
import { AiInterpretationResponse, SessionRecord } from '../types/sentinel';

interface SessionManagerProps {
  session: SessionRecord | null;
  onClearSession: () => void;
  isRecording: boolean;
  aiInterpretation: AiInterpretationResponse | null;
  patientName: string;
  onPatientNameChange: (value: string) => void;
  patientSex: 'M' | 'F' | '';
  onPatientSexChange: (value: 'M' | 'F' | '') => void;
  patientAge: string;
  onPatientAgeChange: (value: string) => void;
  signatureImage: string | null;
  onSignatureUpload: (file: File | null) => void;
  signatureError: string | null;
  meanGsrChange: number | null;
  gsrTrend: 'STABLE' | 'RISING' | 'FALLING' | 'INDETERMINATE';
}

type SessionSample = SessionRecord['samples'][number];

const telemetryColumns: Array<{
  header: string;
  value: (sample: SessionSample) => string | number | boolean;
}> = [
    { header: 'timestamp_ms', value: (sample) => sample.timestampMs },
    { header: 'iso_time', value: (sample) => new Date(sample.timestampMs).toISOString() },
    { header: 'pulse_raw_adc', value: (sample) => sample.pulseRaw ?? '' },
    { header: 'bpm', value: (sample) => sample.bpm ?? '' },
    { header: 'pulse_valid', value: (sample) => sample.pulseValid },
    { header: 'pulse_quality', value: (sample) => sample.pulseQuality },
    { header: 'gsr_raw_adc', value: (sample) => sample.gsrRaw ?? '' },
    { header: 'gsr_baseline_adc', value: (sample) => sample.gsrBaseline ?? '' },
    { header: 'gsr_relative_change_pct', value: (sample) => sample.gsrRelativeChange ?? '' },
    { header: 'gsr_valid', value: (sample) => sample.gsrValid },
  ];

function getTelemetryRow(sample: SessionSample): Array<string | number | boolean> {
  return telemetryColumns.map(({ value }) => value(sample));
}

function getReportFileBase(patientName: string, sessionId: string): string {
  const safePatientName = patientName
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return safePatientName
    ? `SENTINEL v2.0 ${safePatientName}'s report`
    : `SENTINEL v2.0 - Session ${sessionId}`;
}

function escapeCsvValue(value: string | number | boolean): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const SessionManager: React.FC<SessionManagerProps> = ({
  session,
  onClearSession,
  isRecording,
  aiInterpretation,
  patientName,
  onPatientNameChange,
  patientSex,
  onPatientSexChange,
  patientAge,
  onPatientAgeChange,
  signatureImage,
  onSignatureUpload,
  signatureError,
  meanGsrChange,
  gsrTrend,
}) => {
  const [patientDetailsError, setPatientDetailsError] = useState<string | null>(null);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [pendingPrint, setPendingPrint] = useState(false);

  useEffect(() => {
    if (!pendingPrint || !session) return;

    const frameId = window.requestAnimationFrame(() => {
      const previousTitle = document.title;
      const restoreTitle = () => {
        document.title = previousTitle;
        window.removeEventListener('afterprint', restoreTitle);
        setShowTelemetry(false);
        setPendingPrint(false);
      };

      document.title = getReportFileBase(patientName, session.id);
      window.addEventListener('afterprint', restoreTitle, { once: true });
      try {
        window.print();
      } finally {
        window.setTimeout(restoreTitle, 0);
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [patientName, pendingPrint, session]);

  const handlePrintReport = () => {
    if (!patientName.trim() || !patientSex || !patientAge) {
      setPatientDetailsError('Enter the patient name, select sex, and enter a valid age before printing the report.');
      return;
    }

    const age = Number(patientAge);
    if (!Number.isInteger(age) || age < 0 || age > 120) {
      setPatientDetailsError('Enter a whole-number age between 0 and 120 years.');
      return;
    }

    setPatientDetailsError(null);
    setShowTelemetry(true);
    setPendingPrint(true);
  };

  const handleExportCsv = () => {
    if (!session || session.samples.length === 0) return;

    const csvContent = [
      telemetryColumns.map(({ header }) => header).join(','),
      ...session.samples.map((sample) =>
        getTelemetryRow(sample).map(escapeCsvValue).join(','),
      ),
    ].join('\r\n');
    const csvUrl = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = csvUrl;
    link.download = `${getReportFileBase(patientName, session.id)} - telemetry.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(csvUrl), 0);
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
              onClick={handlePrintReport}
              className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report / Save PDF</span>
            </button>
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

      <article className="print-report bg-white text-slate-900 rounded-xl border border-slate-200 p-6 shadow-sm">
        <header className="border-b-2 border-emerald-800 pb-4 mb-5">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">SENTINEL v2.0</h2>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
            Physiological Monitoring Report
          </p>
          <p className="mt-2 text-sm text-slate-700">Report prepared by SENTINEL v2.0</p>
          <p className="mt-1 text-xs text-slate-500">
            Report date: {new Date(session.startTime).toLocaleDateString()} · Session ID: {session.id}
          </p>
        </header>

        <section className="mb-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Patient details</h3>
          <div className="report-controls grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-600">
              Patient name <span className="text-rose-700">*</span>
              <input
                name="patientName"
                required
                autoComplete="off"
                className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                value={patientName}
                onChange={(event) => onPatientNameChange(event.target.value)}
                placeholder="Full name"
                maxLength={100}
                aria-label="Patient name"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Sex <span className="text-rose-700">*</span>
              <select
                name="patientSex"
                required
                className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                value={patientSex}
                onChange={(event) => {
                  const value = event.target.value;
                  onPatientSexChange(value === 'M' || value === 'F' ? value : '');
                }}
                aria-label="Patient sex"
              >
                <option value="">Select</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Age (years) <span className="text-rose-700">*</span>
              <input
                name="patientAge"
                required
                type="number"
                min="0"
                max="120"
                step="1"
                inputMode="numeric"
                className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                value={patientAge}
                onChange={(event) => onPatientAgeChange(event.target.value)}
                placeholder="Age"
                aria-label="Patient age in years"
              />
            </label>
          </div>
          {patientDetailsError && (
            <p className="report-controls mt-2 text-xs text-rose-700" role="alert">{patientDetailsError}</p>
          )}
          <div className="report-print-field hidden grid-cols-3 gap-3 text-sm text-slate-800">
            <p><strong>Patient name:</strong> {patientName.trim()}</p>
            <p><strong>Sex:</strong> {patientSex}</p>
            <p><strong>Age:</strong> {patientAge} years</p>
          </div>
          <p className="report-controls mt-2 text-[11px] text-slate-500">
            Patient details are used only in this report and are not sent to the AI service.
          </p>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">Recorded measurements</h3>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ['Session ID', session.id],
              ['Recorded', new Date(session.startTime).toLocaleString()],
              ['Duration', `${Math.round(session.durationSeconds)} seconds`],
              ['Total samples', String(summary.totalSamples)],
              ['Valid pulse samples', `${summary.validBpmSamples} (${validRatio}%)`],
              ['Mean heart rate', summary.meanBpm === null ? 'Not available' : `${summary.meanBpm} BPM`],
              ['Minimum heart rate', summary.minBpm === null ? 'Not available' : `${summary.minBpm} BPM`],
              ['Maximum heart rate', summary.maxBpm === null ? 'Not available' : `${summary.maxBpm} BPM`],
              ['Mean GSR ADC', summary.meanGsrAdc === null ? 'Not available' : String(summary.meanGsrAdc)],
              ['Mean GSR baseline shift', meanGsrChange === null ? 'No calibrated baseline' : `${meanGsrChange > 0 ? '+' : ''}${meanGsrChange}%`],
              ['Peak GSR deflection', summary.maxGsrRelativeChange === null ? 'No calibrated baseline' : `${summary.maxGsrRelativeChange > 0 ? '+' : ''}${summary.maxGsrRelativeChange}%`],
              ['GSR trend', gsrTrend.toLowerCase()],
              ['Overall signal quality', summary.overallDataQuality],
            ].map(([label, value]) => (
              <div key={label} className="rounded border border-slate-200 p-2.5">
                <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="report-telemetry mb-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
            Recorded telemetry data (CSV)
          </h3>
          <div className="report-controls mb-2">
            <button
              type="button"
              onClick={() => setShowTelemetry((visible) => !visible)}
              className="text-xs font-medium text-emerald-800 underline underline-offset-2"
              aria-expanded={showTelemetry}
            >
              {showTelemetry ? 'Hide' : 'View'} all {session.samples.length} telemetry samples
            </button>
            <p className="mt-1 text-[10px] text-slate-500">
              All samples are included in the printed report and separate CSV export.
            </p>
          </div>
          {showTelemetry && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[9px] font-mono">
                <thead className="table-header-group">
                  <tr className="border-b border-slate-300 text-slate-600">
                    {telemetryColumns.map(({ header }) => (
                      <th key={header} className="px-1 py-1 font-semibold">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-slate-800">
                  {session.samples.map((sample, index) => (
                    <tr key={`${sample.timestampMs}-${index}`} className="border-b border-slate-100">
                      {getTelemetryRow(sample).map((value, columnIndex) => (
                        <td key={telemetryColumns[columnIndex].header} className="px-1 py-0.5 whitespace-nowrap">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="report-controls mt-1 text-[10px] text-slate-500">
            The table contains the same complete session sample data as the exported CSV file.
          </p>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">AI interpretation</h3>
          {aiInterpretation ? (
            <div className="space-y-3 text-sm text-slate-800">
              <p className="text-xs text-slate-500">
                Status: {aiInterpretation.status} · Provider: {aiInterpretation.provider} · Generated: {new Date(aiInterpretation.generatedAt).toLocaleString()}
              </p>
              <div><h4 className="font-semibold">Session overview</h4><p>{aiInterpretation.summary}</p></div>
              <div><h4 className="font-semibold">Heart rate analysis</h4><p>{aiInterpretation.pulseAnalysis}</p></div>
              <div><h4 className="font-semibold">GSR analysis</h4><p>{aiInterpretation.gsrAnalysis}</p></div>
              <div>
                <h4 className="font-semibold">Recommendations</h4>
                <ol className="list-decimal pl-5">
                  {aiInterpretation.recommendations.map((recommendation, index) => <li key={index}>{recommendation}</li>)}
                </ol>
              </div>
              {aiInterpretation.cautions.length > 0 && (
                <div>
                  <h4 className="font-semibold">Cautions and limitations</h4>
                  <ul className="list-disc pl-5">
                    {aiInterpretation.cautions.map((caution, index) => <li key={index}>{caution}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No AI interpretation is attached to this session. Generate one from the Telemetry tab to include the full response here.</p>
          )}
        </section>

        <section className="grid grid-cols-2 gap-8 pt-5 border-t border-slate-200">
          <div className="report-controls">
            <label className="block text-xs font-medium text-slate-600">
              Signature image (PNG, JPEG, or WebP; up to 1 MB)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="mt-2 block w-full text-xs text-slate-600"
                onChange={(event) => onSignatureUpload(event.currentTarget.files?.[0] ?? null)}
                aria-label="Upload signature image"
              />
            </label>
            {signatureImage && (
              <button
                type="button"
                onClick={() => onSignatureUpload(null)}
                className="mt-2 text-xs text-rose-700 underline"
              >
                Remove signature image
              </button>
            )}
            {signatureError && <p className="mt-1 text-xs text-rose-700" role="alert">{signatureError}</p>}
          </div>
          <div className="min-h-24 border-b border-slate-400 flex items-end justify-center pb-2">
            {signatureImage ? (
              <img src={signatureImage} alt="Uploaded report signature" className="max-h-20 max-w-full object-contain" />
            ) : (
              <span className="text-xs text-slate-400">Signature image / SVG to be configured</span>
            )}
          </div>
          <p className="col-start-2 text-xs text-slate-600">
            SENTINEL v2.0
          </p>
        </section>

        <p className="mt-6 border-t border-slate-200 pt-3 text-[10px] leading-relaxed text-slate-500">
          Educational prototype only. This report is not a medical record or diagnosis. Measurements can be affected by movement, sensor contact, and environmental conditions and must not be used for clinical decisions.
        </p>
      </article>
    </div>
  );
};
