import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { MeasurementCards } from './components/MeasurementCards';
import { RealTimeOscilloscope } from './components/RealTimeOscilloscope';
import { AiAssistantPanel } from './components/AiAssistantPanel';
import { SimulatorControls } from './components/SimulatorControls';
import { SessionManager } from './components/SessionManager';
import { HardwareHub } from './components/HardwareHub';
import { FirmwareExporter } from './components/FirmwareExporter';
import { DocumentationViewer } from './components/DocumentationViewer';
import { WelcomeHero } from './components/WelcomeHero';
import { WelcomeOpening } from './components/WelcomeOpening';
import { PulseProcessor } from './utils/pulse_processor';
import { GsrProcessor } from './utils/gsr_processor';
import { ProtocolValidator } from './utils/protocol_validator';
import {
  PulseMeasurement,
  GsrMeasurement,
  SignalQuality,
  SessionRecord,
  SentinelDataPacket,
} from './types/sentinel';

import { Heart } from 'lucide-react';

function formatDeviceError(error: unknown, deviceIp: string): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return `ESP32 at ${deviceIp} did not respond. If its OLED shows 192.168.4.1, join SENTINEL-2-AP (no internet is expected) and keep this dashboard open. Otherwise use the current OLED IP on the same router Wi-Fi.`;
  }
  if (error instanceof TypeError) {
    return `Cannot reach ESP32 at ${deviceIp}. If its OLED shows 192.168.4.1, join SENTINEL-2-AP (no internet is expected); otherwise use the current OLED IP on the same router Wi-Fi.`;
  }
  return error instanceof Error ? error.message : String(error);
}

function getInitialDeviceIp(): string {
  if (typeof window === 'undefined') return '192.168.4.1';
  return window.localStorage.getItem('sentinel-device-ip') || '192.168.4.1';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'telemetry' | 'session' | 'hardware' | 'firmware' | 'docs'>('telemetry');
  const [connectionMode, setConnectionMode] = useState<'simulator' | 'device_ip'>('simulator');
  const [deviceIp, setDeviceIp] = useState<string>(getInitialDeviceIp);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [lastDataAgeMs, setLastDataAgeMs] = useState<number>(0);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [calibrationError, setCalibrationError] = useState<string | null>(null);

  // Simulator state parameters
  const [simTargetBpm, setSimTargetBpm] = useState<number>(72);
  const [simGsrDeflection, setSimGsrDeflection] = useState<number>(0);
  const [simNoiseLevel, setSimNoiseLevel] = useState<'none' | 'light' | 'heavy'>('none');
  const [simDisconnected, setSimDisconnected] = useState<boolean>(false);

  // Biometric state
  const [latestPulse, setLatestPulse] = useState<PulseMeasurement>({
    rawAdc: null,
    bpm: null,
    ibiMs: null,
    valid: false,
    quality: 'INITIALIZING',
    confidence: 0,
    beatDetected: false,
    consecutiveValidBeats: 0,
  });

  const [latestGsr, setLatestGsr] = useState<GsrMeasurement>({
    rawAdc: null,
    smoothedAdc: null,
    baselineAdc: null,
    relativeChange: null,
    valid: false,
    quality: 'INITIALIZING',
    trend: 'INDETERMINATE',
  });

  const [overallQuality, setOverallQuality] = useState<SignalQuality>('INITIALIZING');
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibrationProgress, setCalibrationProgress] = useState<number>(0);

  // Waveform buffers for real-time oscilloscope
  const [pulseHistory, setPulseHistory] = useState<
    Array<{ timestampMs: number; rawAdc: number; filteredAc: number; threshold: number; isPeak: boolean }>
  >([]);

  const [gsrHistory, setGsrHistory] = useState<
    Array<{ timestampMs: number; relativeChange: number; smoothedAdc: number; baseline: number }>
  >([]);

  // Session recording
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  const [sessionRecord, setSessionRecord] = useState<SessionRecord | null>(null);

  // Processors & Validators (persist across renders)
  const pulseProcRef = useRef(new PulseProcessor());
  const gsrProcRef = useRef(new GsrProcessor());
  const validatorRef = useRef(new ProtocolValidator());

  // Waveform generator state
  const simPhaseRef = useRef<number>(0);
  const lastPacketTimeRef = useRef<number>(Date.now());
  const sessionSamplesRef = useRef<SessionRecord['samples']>([]);

  // Simulator telemetry loop
  useEffect(() => {
    if (connectionMode !== 'simulator') return;

    const timer = setInterval(() => {
      const now = Date.now();
      // Run internal DSP pipeline on simulated physiological waveform
      lastPacketTimeRef.current = now;

      if (simDisconnected) {
        const pulse = pulseProcRef.current.processSample(0, now);
        const gsr = gsrProcRef.current.processSample(5);
        setLatestPulse(pulse);
        setLatestGsr(gsr);
        setOverallQuality('DISCONNECTED');
        return;
      }

      // Generate synthetic PPG wave with systolic peak and dicrotic notch
      const freqHz = simTargetBpm / 60;
      simPhaseRef.current += (2 * Math.PI * freqHz) * 0.02; // 20ms step
      const normalizedPhase = simPhaseRef.current % (2 * Math.PI);

      // Physiological PPG model
      let wave = 0;
      if (normalizedPhase < 0.8) {
        // Sharp systolic rise
        wave = Math.sin((normalizedPhase / 0.8) * Math.PI) * 450;
      } else if (normalizedPhase >= 1.2 && normalizedPhase <= 1.8) {
        // Dicrotic notch reflection
        wave = Math.sin(((normalizedPhase - 1.2) / 0.6) * Math.PI) * 120;
      }

      // Noise injection
      if (simNoiseLevel === 'light') {
        wave += (Math.random() - 0.5) * 60;
      } else if (simNoiseLevel === 'heavy') {
        wave += (Math.random() - 0.5) * 350;
      }

      const rawPulse = Math.max(20, Math.min(4070, Math.round(2048 + wave)));

      // Simulated GSR raw ADC with baseline shift
      const baseline = gsrProcRef.current.getBaseline() || 1400;
      const gsrShift = (simGsrDeflection / 100) * baseline;
      let rawGsr = baseline + gsrShift + (Math.random() - 0.5) * 15;
      if (simNoiseLevel === 'heavy') rawGsr += (Math.random() - 0.5) * 120;
      rawGsr = Math.max(30, Math.min(4060, Math.round(rawGsr)));

      // Process through verified DSP algorithms
      const pulseRes = pulseProcRef.current.processSample(rawPulse, now);
      const gsrRes = gsrProcRef.current.processSample(rawGsr);

      setLatestPulse(pulseRes);
      setLatestGsr(gsrRes);
      setIsCalibrating(gsrProcRef.current.isCalibrationActive());
      setCalibrationProgress(gsrProcRef.current.getCalibrationProgress());

      // Overall quality determination
      if (pulseRes.quality === 'DISCONNECTED' || gsrRes.quality === 'DISCONNECTED') {
        setOverallQuality('DISCONNECTED');
      } else if (pulseRes.quality === 'LOW_QUALITY' || gsrRes.quality === 'LOW_QUALITY') {
        setOverallQuality('LOW_QUALITY');
      } else if (gsrProcRef.current.isCalibrationActive()) {
        setOverallQuality('CALIBRATING');
      } else if (pulseRes.quality === 'VALID' && gsrRes.quality === 'VALID') {
        setOverallQuality('VALID');
      } else {
        setOverallQuality(pulseRes.quality);
      }

      // Append to visual oscilloscope buffer (max 150 points for 60fps rendering)
      setPulseHistory((prev) => {
        const updated = [
          ...prev,
          {
            timestampMs: now,
            rawAdc: rawPulse,
            filteredAc: wave,
            threshold: 2048,
            isPeak: pulseRes.beatDetected,
          },
        ];
        return updated.length > 150 ? updated.slice(updated.length - 150) : updated;
      });

      // Append to GSR trend buffer (max 100 points)
      setGsrHistory((prev) => {
        const updated = [
          ...prev,
          {
            timestampMs: now,
            relativeChange: gsrRes.relativeChange ?? 0,
            smoothedAdc: gsrRes.smoothedAdc ?? 1400,
            baseline: gsrRes.baselineAdc ?? 1400,
          },
        ];
        return updated.length > 100 ? updated.slice(updated.length - 100) : updated;
      });

      // Record to session if active
      if (isRecording) {
        sessionSamplesRef.current.push({
          timestampMs: now,
          pulseRaw: rawPulse,
          bpm: pulseRes.bpm,
          pulseValid: pulseRes.valid,
          pulseQuality: pulseRes.quality,
          gsrRaw: rawGsr,
          gsrBaseline: gsrRes.baselineAdc,
          gsrRelativeChange: gsrRes.relativeChange,
          gsrValid: gsrRes.valid,
        });
      }
    }, 20);

    return () => clearInterval(timer);
  }, [connectionMode, simTargetBpm, simGsrDeflection, simNoiseLevel, simDisconnected, isRecording]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLastDataAgeMs(Math.max(0, Date.now() - lastPacketTimeRef.current));
    }, 250);
    return () => clearInterval(timer);
  }, []);

  // Poll the physical device sequentially so slow ESP32 responses never stack up.
  useEffect(() => {
    if (connectionMode !== 'device_ip' || !isConnected) return;

    let active = true;
    let pollTimer: ReturnType<typeof setTimeout>;
    let requestController: AbortController | null = null;
    let retryDelay = 1000;
    validatorRef.current.reset();
    setDeviceError(null);
    setCalibrationError(null);
    setOverallQuality('INITIALIZING');

    const pollDevice = async () => {
      const controller = new AbortController();
      requestController = controller;
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`http://${deviceIp}/api/live`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`ESP32 returned HTTP ${response.status}`);
        }

        const rawJson: unknown = await response.json();
        const validation = validatorRef.current.validate(rawJson);
        if (!validation.isValid || !validation.packet) {
          throw new Error(`Invalid ESP32 telemetry: ${validation.errors.join('; ')}`);
        }

        const packet: SentinelDataPacket = validation.packet;
        if (!active) return;

        retryDelay = 1000;
        lastPacketTimeRef.current = Date.now();
        setDeviceError(null);
        setLatestPulse(packet.pulse);
        setLatestGsr(packet.gsr);
        setCalibrationError(packet.system.errorCode?.startsWith('GSR_CALIBRATION_')
          ? packet.system.errorCode
          : null);
        setIsCalibrating(packet.system.calibrating);
        setCalibrationProgress(packet.system.calibrationProgress ?? 0);

        if (packet.pulse.quality === 'DISCONNECTED' || packet.gsr.quality === 'DISCONNECTED') {
          setOverallQuality('DISCONNECTED');
        } else if (packet.system.calibrating) {
          setOverallQuality('CALIBRATING');
        } else if (packet.pulse.quality === 'LOW_QUALITY' || packet.gsr.quality === 'LOW_QUALITY') {
          setOverallQuality('LOW_QUALITY');
        } else if (packet.pulse.quality === 'VALID' && packet.gsr.quality === 'VALID') {
          setOverallQuality('VALID');
        } else {
          setOverallQuality(packet.pulse.quality);
        }

        if (packet.pulse.rawAdc !== null) {
          setPulseHistory((prev) => {
            const updated = [
              ...prev,
              {
                timestampMs: packet.deviceTimestampMs,
                rawAdc: packet.pulse.rawAdc!,
                filteredAc: 0,
                threshold: 2048,
                isPeak: packet.pulse.beatDetected,
              },
            ];
            return updated.length > 150 ? updated.slice(updated.length - 150) : updated;
          });
        }

        if (
          packet.gsr.relativeChange !== null &&
          packet.gsr.smoothedAdc !== null &&
          packet.gsr.baselineAdc !== null
        ) {
          setGsrHistory((prev) => {
            const updated = [
              ...prev,
              {
                timestampMs: packet.deviceTimestampMs,
                relativeChange: packet.gsr.relativeChange!,
                smoothedAdc: packet.gsr.smoothedAdc!,
                baseline: packet.gsr.baselineAdc!,
              },
            ];
            return updated.length > 100 ? updated.slice(updated.length - 100) : updated;
          });
        }

        if (isRecording) {
          sessionSamplesRef.current.push({
            timestampMs: Date.now(),
            pulseRaw: packet.pulse.rawAdc,
            bpm: packet.pulse.bpm,
            pulseValid: packet.pulse.valid,
            pulseQuality: packet.pulse.quality,
            gsrRaw: packet.gsr.rawAdc,
            gsrBaseline: packet.gsr.baselineAdc,
            gsrRelativeChange: packet.gsr.relativeChange,
            gsrValid: packet.gsr.valid,
          });
        }
      } catch (error) {
        if (!active) return;
        setDeviceError(formatDeviceError(error, deviceIp));
        setLatestPulse((previous) => ({
          ...previous,
          valid: false,
          quality: 'STALE',
          beatDetected: false,
        }));
        setLatestGsr((previous) => ({
          ...previous,
          valid: false,
          quality: 'STALE',
        }));
        setOverallQuality('STALE');
        retryDelay = Math.min(retryDelay * 2, 10000);
      } finally {
        clearTimeout(timeout);
        if (active) pollTimer = setTimeout(pollDevice, retryDelay);
      }
    };

    void pollDevice();
    return () => {
      active = false;
      clearTimeout(pollTimer);
      requestController?.abort();
    };
  }, [connectionMode, isConnected, deviceIp, isRecording]);

  // Session duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording) {
      interval = setInterval(() => {
        setSessionDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Session start/stop handlers
  const handleStartSession = () => {
    setSessionRecord(null);
    setIsRecording(true);
    setSessionStartTime(Date.now());
    setSessionDuration(0);
    sessionSamplesRef.current = [];
  };

  const handleStopSession = () => {
    setIsRecording(false);
    const samples = sessionSamplesRef.current;
    if (samples.length === 0) return;

    const validBpms = samples.filter((s) => s.bpm !== null && s.pulseValid).map((s) => s.bpm!);
    const meanBpm = validBpms.length > 0 ? Math.round(validBpms.reduce((a, b) => a + b, 0) / validBpms.length) : null;
    const minBpm = validBpms.length > 0 ? Math.min(...validBpms) : null;
    const maxBpm = validBpms.length > 0 ? Math.max(...validBpms) : null;

    const validGsrAdc = samples.filter((s) => s.gsrValid && s.gsrRaw !== null).map((s) => s.gsrRaw!);
    const meanGsrAdc = validGsrAdc.length > 0
      ? Math.round(validGsrAdc.reduce((sum, value) => sum + value, 0) / validGsrAdc.length)
      : null;
    const gsrChanges = samples.filter((s) => s.gsrRelativeChange !== null).map((s) => s.gsrRelativeChange!);
    const maxGsrRelativeChange = gsrChanges.length > 0 ? Math.round(Math.max(...gsrChanges) * 10) / 10 : null;

    const record: SessionRecord = {
      id: Math.random().toString(36).substring(2, 8).toUpperCase(),
      startTime: sessionStartTime,
      endTime: Date.now(),
      durationSeconds: sessionDuration,
      samples,
      summary: {
        totalSamples: samples.length,
        validBpmSamples: validBpms.length,
        meanBpm,
        minBpm,
        maxBpm,
        meanGsrAdc,
        maxGsrRelativeChange,
        overallDataQuality: overallQuality,
      },
    };

    setSessionRecord(record);
  };

  const sessionGsrChanges = sessionRecord?.samples
    .filter((sample) => sample.gsrRelativeChange !== null)
    .map((sample) => sample.gsrRelativeChange!) ?? [];
  const sessionMeanGsrChange = sessionGsrChanges.length > 0
    ? Math.round((sessionGsrChanges.reduce((sum, value) => sum + value, 0) / sessionGsrChanges.length) * 10) / 10
    : null;
  const sessionGsrTrend = sessionGsrChanges.length < 2
    ? 'INDETERMINATE'
    : sessionGsrChanges.at(-1)! > sessionGsrChanges[0] + 1
      ? 'RISING'
      : sessionGsrChanges.at(-1)! < sessionGsrChanges[0] - 1
        ? 'FALLING'
        : 'STABLE';

  const handleStartCalibration = async () => {
    setCalibrationError(null);
    if (connectionMode === 'device_ip') {
      if (!isConnected) {
        setDeviceError('Connect to the ESP32 before starting calibration.');
        return;
      }
      try {
        const response = await fetch(`http://${deviceIp}/api/calibrate`, {
          method: 'POST',
          signal: AbortSignal.timeout(2000),
        });
        if (!response.ok) throw new Error(`ESP32 returned HTTP ${response.status}`);
        setDeviceError(null);
        setIsCalibrating(true);
        setCalibrationProgress(0);
      } catch (error) {
        setDeviceError(formatDeviceError(error, deviceIp));
      }
      return;
    }
    gsrProcRef.current.startCalibration();
    setIsCalibrating(true);
  };

  const handleResetCalibration = async () => {
    if (connectionMode === 'device_ip') {
      if (!isConnected) {
        setDeviceError('Connect to the ESP32 before clearing its baseline.');
        return;
      }
      try {
        const response = await fetch(`http://${deviceIp}/api/calibrate/reset`, {
          method: 'POST',
          signal: AbortSignal.timeout(2000),
        });
        if (!response.ok) throw new Error(`ESP32 returned HTTP ${response.status}`);
        setDeviceError(null);
        setIsCalibrating(false);
        setCalibrationProgress(0);
        setCalibrationError(null);
      } catch (error) {
        setDeviceError(formatDeviceError(error, deviceIp));
      }
      return;
    }
    gsrProcRef.current.reset();
    pulseProcRef.current.reset();
  };

  const handleConnectionModeChange = (mode: 'simulator' | 'device_ip') => {
    setConnectionMode(mode);
    setDeviceError(null);
    setCalibrationError(null);
    setIsCalibrating(false);
    setCalibrationProgress(0);
    setLatestPulse({
      rawAdc: null,
      bpm: null,
      ibiMs: null,
      valid: false,
      quality: 'INITIALIZING',
      confidence: 0,
      beatDetected: false,
      consecutiveValidBeats: 0,
    });
    setLatestGsr({
      rawAdc: null,
      smoothedAdc: null,
      baselineAdc: null,
      relativeChange: null,
      valid: false,
      quality: 'INITIALIZING',
      trend: 'INDETERMINATE',
    });
    setOverallQuality('INITIALIZING');
    setPulseHistory([]);
    setGsrHistory([]);
  };

  const handleDeviceIpChange = (ip: string) => {
    setDeviceIp(ip);
    window.localStorage.setItem('sentinel-device-ip', ip);
  };

  const handleUseAccessPointIp = () => handleDeviceIpChange('192.168.4.1');

  const handleApplyPreset = (name: string) => {
    setSimDisconnected(false);
    if (name === 'resting') {
      setSimTargetBpm(72);
      setSimGsrDeflection(0);
      setSimNoiseLevel('none');
    } else if (name === 'elevated') {
      setSimTargetBpm(105);
      setSimGsrDeflection(8);
      setSimNoiseLevel('none');
    } else if (name === 'gsr_spike') {
      setSimTargetBpm(84);
      setSimGsrDeflection(18);
      setSimNoiseLevel('light');
    } else if (name === 'disconnect') {
      setSimDisconnected(true);
    }
  };

  return (
    <div className="sentinel-app min-h-screen bg-[#f1f6f5] text-slate-900 flex flex-col font-sans selection:bg-teal-200 selection:text-teal-950">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connectionMode={connectionMode}
        setConnectionMode={handleConnectionModeChange}
        deviceIp={deviceIp}
        setDeviceIp={handleDeviceIpChange}
        onUseAccessPointIp={handleUseAccessPointIp}
        isConnected={isConnected}
        onConnectToggle={() => {
          setIsConnected(!isConnected);
          setDeviceError(null);
        }}
        deviceError={deviceError}
        overallQuality={overallQuality}
        isRecording={isRecording}
        sessionDuration={sessionDuration}
        onStartSession={handleStartSession}
        onStopSession={handleStopSession}
        lastDataAgeMs={lastDataAgeMs}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-370 w-full mx-auto px-4 sm:px-7 lg:px-10 py-7 space-y-6">
        {/* Tab 1: Live Telemetry & AI */}
        {activeTab === 'telemetry' && (
          <div className="space-y-6">
            <WelcomeHero />
            <section className="dashboard-intro">
              <div>
                <span className="dashboard-eyebrow">LIVE PHYSIOLOGICAL MONITORING</span>
                <h2>Signals, in focus.</h2>
                <p>Track pulse and skin response from your connected SENTINEL device.</p>
              </div>
              <div className="intro-meta">
                <span className={`intro-dot ${latestPulse.valid ? 'is-live' : ''}`}></span>
                <div>
                  <strong>{latestPulse.valid ? 'Live signal acquired' : 'Waiting for a reliable signal'}</strong>
                  <span>{connectionMode === 'simulator' ? 'Simulator mode' : `ESP32 · ${deviceIp}`}</span>
                </div>
              </div>
            </section>
            {/* Live Measurement Cards */}
            <MeasurementCards
              pulse={latestPulse}
              gsr={latestGsr}
              onStartCalibration={handleStartCalibration}
              onResetCalibration={handleResetCalibration}
              isCalibrating={isCalibrating}
              calibrationProgress={calibrationProgress}
              calibrationError={calibrationError}
            />

            {/* Real-Time Waveform Oscilloscopes */}
            <RealTimeOscilloscope
              pulseHistory={pulseHistory}
              gsrHistory={gsrHistory}
              isPulseValid={latestPulse.valid}
              isGsrValid={latestGsr.valid}
            />

            {/* Groq AI Wellness Assistant */}
            <AiAssistantPanel
              key={sessionRecord?.id ?? 'no-completed-session'}
              sessionDuration={sessionRecord?.durationSeconds ?? 0}
              meanBpm={sessionRecord?.summary.meanBpm ?? null}
              minBpm={sessionRecord?.summary.minBpm ?? null}
              maxBpm={sessionRecord?.summary.maxBpm ?? null}
              validBeatRatio={sessionRecord && sessionRecord.summary.totalSamples > 0
                ? sessionRecord.summary.validBpmSamples / sessionRecord.summary.totalSamples
                : 0}
              gsrRelativeChange={sessionMeanGsrChange}
              gsrTrend={sessionGsrTrend}
              overallQuality={sessionRecord?.summary.overallDataQuality ?? 'INITIALIZING'}
            />

            {/* Interactive Hardware Diagnostic & Signal Generator (When in simulator mode) */}
            {connectionMode === 'simulator' && (
              <SimulatorControls
                simTargetBpm={simTargetBpm}
                setSimTargetBpm={setSimTargetBpm}
                simGsrDeflection={simGsrDeflection}
                setSimGsrDeflection={setSimGsrDeflection}
                simNoiseLevel={simNoiseLevel}
                setSimNoiseLevel={setSimNoiseLevel}
                simDisconnected={simDisconnected}
                setSimDisconnected={setSimDisconnected}
                onApplyPreset={handleApplyPreset}
              />
            )}
          </div>
        )}

        {/* Tab 2: Session Analytics & CSV */}
        {activeTab === 'session' && (
          <SessionManager
            session={sessionRecord}
            onClearSession={() => setSessionRecord(null)}
            isRecording={isRecording}
          />
        )}

        {/* Tab 3: Hardware & Wiring Center */}
        {activeTab === 'hardware' && <HardwareHub />}

        {/* Tab 4: Firmware Source Exporter */}
        {activeTab === 'firmware' && <FirmwareExporter />}

        {/* Tab 5: Engineering Docs */}
        {activeTab === 'docs' && <DocumentationViewer />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>SENTINEL 2.0 • Academic IoT + Biomedical Signal Acquisition • ESP32 + Groq AI</span>
          <span className="text-slate-600 font-mono inline-flex items-center gap-1">Made with  <Heart size={12} color="#000000" strokeWidth={2} />  by Harsh and Bhupesh</span>
          <span className="text-slate-600 font-mono">Educational Prototype • Not for Clinical Diagnosis</span>
        </div>
      </footer>
      <WelcomeOpening />
    </div>
  );
}
