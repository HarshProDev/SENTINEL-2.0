import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Header } from "./components/Header";
import { MeasurementCards } from "./components/MeasurementCards";
import { WelcomeHero } from "./components/WelcomeHero";
import { WelcomeOpening } from "./components/WelcomeOpening";
import { PulseProcessor } from "./utils/pulse_processor";
import { GsrProcessor } from "./utils/gsr_processor";
import { ProtocolValidator } from "./utils/protocol_validator";
import {
  PulseMeasurement,
  GsrMeasurement,
  SignalQuality,
  SessionRecord,
  SentinelDataPacket,
  AiInterpretationResponse,
} from "./types/sentinel";

import { Heart } from "lucide-react";
import { FaGithub, FaLinkedinIn, FaWhatsapp } from "react-icons/fa";

const ContactMe = [
  { id: "GitHub", href: "https://github.com/HarshProDev", icon: FaGithub },
  {
    id: "WhatsApp",
    href: "https://wa.me/918053050291?text=%20Hii%20Harsh%20i%20would%20love%20to%20work%20with%20you",
    icon: FaWhatsapp,
  },
  {
    id: "LinkedIn",
    href: "https://linkedin.com/in/harshbhukal-dev",
    icon: FaLinkedinIn,
  },
];

const ContactBh = [
  { id: "GitHub", href: "https://github.com/Bhupeshpuri", icon: FaGithub },
  {
    id: "WhatsApp",
    href: "https://wa.me/918950678752?text=%20Hii%20Bhupesh%20i%20would%20love%20to%20work%20with%20you",
    icon: FaWhatsapp,
  },
  {
    id: "LinkedIn",
    href: "https://linkedin.com/in/bhupesh",
    icon: FaLinkedinIn,
  },
];

const RealTimeOscilloscope = lazy(() =>
  import("./components/RealTimeOscilloscope").then(
    ({ RealTimeOscilloscope }) => ({ default: RealTimeOscilloscope }),
  ),
);
const AiAssistantPanel = lazy(() =>
  import("./components/AiAssistantPanel").then(({ AiAssistantPanel }) => ({
    default: AiAssistantPanel,
  })),
);
const SimulatorControls = lazy(() =>
  import("./components/SimulatorControls").then(({ SimulatorControls }) => ({
    default: React.memo(SimulatorControls),
  })),
);
const SessionManager = lazy(() =>
  import("./components/SessionManager").then(({ SessionManager }) => ({
    default: SessionManager,
  })),
);
const HardwareHub = lazy(() =>
  import("./components/HardwareHub").then(({ HardwareHub }) => ({
    default: HardwareHub,
  })),
);
const FirmwareExporter = lazy(() =>
  import("./components/FirmwareExporter").then(({ FirmwareExporter }) => ({
    default: FirmwareExporter,
  })),
);
const DocumentationViewer = lazy(() =>
  import("./components/DocumentationViewer").then(
    ({ DocumentationViewer }) => ({ default: DocumentationViewer }),
  ),
);

const DeferredContent: React.FC<{
  className: string;
  children: React.ReactNode;
}> = ({ className, children }) => {
  const [isNearViewport, setIsNearViewport] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!("IntersectionObserver" in window)) {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "150px 0px" },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={className} aria-busy={!isNearViewport}>
      {isNearViewport && children}
    </div>
  );
};

function formatDeviceError(error: unknown, deviceIp: string): string {
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return `The deployed HTTPS dashboard cannot connect directly to ESP32 at ${deviceIp} over HTTP. Use a secure HTTPS cloud relay for remote access, or open the dashboard over HTTP on the same local Wi-Fi network.`;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return `ESP32 at ${deviceIp} did not respond. If its OLED shows 192.168.4.1, join SENTINEL-2-AP (no internet is expected) and keep this dashboard open. Otherwise use the current OLED IP on the same router Wi-Fi.`;
  }
  if (error instanceof TypeError) {
    return `Cannot reach ESP32 at ${deviceIp}. If its OLED shows 192.168.4.1, join SENTINEL-2-AP (no internet is expected); otherwise use the current OLED IP on the same router Wi-Fi.`;
  }
  return error instanceof Error ? error.message : String(error);
}

function getInitialDeviceIp(): string {
  if (typeof window === "undefined") return "192.168.4.1";
  return window.localStorage.getItem("sentinel-device-ip") || "192.168.4.1";
}

export default function App() {
  const [activeTab, setActiveTab] = useState<
    "telemetry" | "session" | "hardware" | "firmware" | "docs"
  >("telemetry");
  const [connectionMode, setConnectionMode] = useState<
    "simulator" | "device_ip"
  >("simulator");
  const [deviceIp, setDeviceIp] = useState<string>(getInitialDeviceIp);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [lastDataAgeMs, setLastDataAgeMs] = useState<number>(0);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [calibrationError, setCalibrationError] = useState<string | null>(null);

  // Simulator state parameters
  const [simTargetBpm, setSimTargetBpm] = useState<number>(72);
  const [simGsrDeflection, setSimGsrDeflection] = useState<number>(0);
  const [simNoiseLevel, setSimNoiseLevel] = useState<
    "none" | "light" | "heavy"
  >("none");
  const [simDisconnected, setSimDisconnected] = useState<boolean>(false);

  // Biometric state
  const [latestPulse, setLatestPulse] = useState<PulseMeasurement>({
    rawAdc: null,
    bpm: null,
    ibiMs: null,
    valid: false,
    quality: "INITIALIZING",
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
    quality: "INITIALIZING",
    trend: "INDETERMINATE",
  });

  const [overallQuality, setOverallQuality] =
    useState<SignalQuality>("INITIALIZING");
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibrationProgress, setCalibrationProgress] = useState<number>(0);

  // Waveform buffers for real-time oscilloscope
  const [pulseHistory, setPulseHistory] = useState<
    Array<{
      timestampMs: number;
      rawAdc: number;
      filteredAc: number;
      threshold: number;
      isPeak: boolean;
    }>
  >([]);

  const [gsrHistory, setGsrHistory] = useState<
    Array<{
      timestampMs: number;
      relativeChange: number;
      smoothedAdc: number;
      baseline: number;
    }>
  >([]);

  // Session recording
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  const [sessionRecord, setSessionRecord] = useState<SessionRecord | null>(
    null,
  );
  const [aiInterpretation, setAiInterpretation] =
    useState<AiInterpretationResponse | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientSex, setPatientSex] = useState<"M" | "F" | "">("");
  const [patientAge, setPatientAge] = useState("");
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureError, setSignatureError] = useState<string | null>(null);

  // Processors & Validators (persist across renders)
  const pulseProcRef = useRef(new PulseProcessor());
  const gsrProcRef = useRef(new GsrProcessor());
  const validatorRef = useRef(new ProtocolValidator());

  // Waveform generator state
  const simPhaseRef = useRef<number>(0);
  const lastPacketTimeRef = useRef<number>(Date.now());
  const sessionSamplesRef = useRef<SessionRecord["samples"]>([]);
  const lastSimulatorUiUpdateRef = useRef<number>(0);
  const simulatorPulseHistoryRef = useRef<
    Array<{
      timestampMs: number;
      rawAdc: number;
      filteredAc: number;
      threshold: number;
      isPeak: boolean;
    }>
  >([]);
  const simulatorGsrHistoryRef = useRef<
    Array<{
      timestampMs: number;
      relativeChange: number;
      smoothedAdc: number;
      baseline: number;
    }>
  >([]);

  // Simulator telemetry loop
  useEffect(() => {
    if (connectionMode !== "simulator") return;

    const timer = setInterval(() => {
      const now = Date.now();
      // Run internal DSP pipeline on simulated physiological waveform
      lastPacketTimeRef.current = now;

      if (simDisconnected) {
        const pulse = pulseProcRef.current.processSample(0, now);
        const gsr = gsrProcRef.current.processSample(5);
        if (now - lastSimulatorUiUpdateRef.current >= 100) {
          lastSimulatorUiUpdateRef.current = now;
          setLatestPulse(pulse);
          setLatestGsr(gsr);
          setOverallQuality("DISCONNECTED");
        }
        return;
      }

      // Generate synthetic PPG wave with systolic peak and dicrotic notch
      const freqHz = simTargetBpm / 60;
      simPhaseRef.current += 2 * Math.PI * freqHz * 0.02; // 20ms step
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
      if (simNoiseLevel === "light") {
        wave += (Math.random() - 0.5) * 60;
      } else if (simNoiseLevel === "heavy") {
        wave += (Math.random() - 0.5) * 350;
      }

      const rawPulse = Math.max(20, Math.min(4070, Math.round(2048 + wave)));

      // Simulated GSR raw ADC with baseline shift
      const baseline = gsrProcRef.current.getBaseline() || 1400;
      const gsrShift = (simGsrDeflection / 100) * baseline;
      let rawGsr = baseline + gsrShift + (Math.random() - 0.5) * 15;
      if (simNoiseLevel === "heavy") rawGsr += (Math.random() - 0.5) * 120;
      rawGsr = Math.max(30, Math.min(4060, Math.round(rawGsr)));

      // Process through verified DSP algorithms
      const pulseRes = pulseProcRef.current.processSample(rawPulse, now);
      const gsrRes = gsrProcRef.current.processSample(rawGsr);

      // Overall quality determination
      let currentQuality: SignalQuality;
      if (
        pulseRes.quality === "DISCONNECTED" ||
        gsrRes.quality === "DISCONNECTED"
      ) {
        currentQuality = "DISCONNECTED";
      } else if (
        pulseRes.quality === "LOW_QUALITY" ||
        gsrRes.quality === "LOW_QUALITY"
      ) {
        currentQuality = "LOW_QUALITY";
      } else if (gsrProcRef.current.isCalibrationActive()) {
        currentQuality = "CALIBRATING";
      } else if (pulseRes.quality === "VALID" && gsrRes.quality === "VALID") {
        currentQuality = "VALID";
      } else {
        currentQuality = pulseRes.quality;
      }

      simulatorPulseHistoryRef.current.push({
        timestampMs: now,
        rawAdc: rawPulse,
        filteredAc: wave,
        threshold: 2048,
        isPeak: pulseRes.beatDetected,
      });
      if (simulatorPulseHistoryRef.current.length > 150) {
        simulatorPulseHistoryRef.current =
          simulatorPulseHistoryRef.current.slice(-150);
      }

      simulatorGsrHistoryRef.current.push({
        timestampMs: now,
        relativeChange: gsrRes.relativeChange ?? 0,
        smoothedAdc: gsrRes.smoothedAdc ?? 1400,
        baseline: gsrRes.baselineAdc ?? 1400,
      });
      if (simulatorGsrHistoryRef.current.length > 100) {
        simulatorGsrHistoryRef.current =
          simulatorGsrHistoryRef.current.slice(-100);
      }

      // Keep 50Hz signal processing while limiting DOM and canvas work to 10Hz.
      if (now - lastSimulatorUiUpdateRef.current >= 100) {
        lastSimulatorUiUpdateRef.current = now;
        setLatestPulse(pulseRes);
        setLatestGsr(gsrRes);
        setIsCalibrating(gsrProcRef.current.isCalibrationActive());
        setCalibrationProgress(gsrProcRef.current.getCalibrationProgress());
        setOverallQuality(currentQuality);
        setPulseHistory([...simulatorPulseHistoryRef.current]);
        setGsrHistory([...simulatorGsrHistoryRef.current]);
      }

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
  }, [
    connectionMode,
    simTargetBpm,
    simGsrDeflection,
    simNoiseLevel,
    simDisconnected,
    isRecording,
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLastDataAgeMs(Math.max(0, Date.now() - lastPacketTimeRef.current));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll the physical device sequentially so slow ESP32 responses never stack up.
  useEffect(() => {
    if (connectionMode !== "device_ip" || !isConnected) return;
    if (window.location.protocol === "https:") {
      setDeviceError(formatDeviceError(null, deviceIp));
      setOverallQuality("STALE");
      setLatestPulse((previous) => ({
        ...previous,
        valid: false,
        quality: "STALE",
        beatDetected: false,
      }));
      setLatestGsr((previous) => ({
        ...previous,
        valid: false,
        quality: "STALE",
      }));
      return;
    }

    let active = true;
    let pollTimer: ReturnType<typeof setTimeout>;
    let requestController: AbortController | null = null;
    let retryDelay = 1000;
    validatorRef.current.reset();
    setDeviceError(null);
    setCalibrationError(null);
    setOverallQuality("INITIALIZING");

    const pollDevice = async () => {
      const controller = new AbortController();
      requestController = controller;
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`http://${deviceIp}/api/live`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`ESP32 returned HTTP ${response.status}`);
        }

        const rawJson: unknown = await response.json();
        const validation = validatorRef.current.validate(rawJson);
        if (!validation.isValid || !validation.packet) {
          throw new Error(
            `Invalid ESP32 telemetry: ${validation.errors.join("; ")}`,
          );
        }

        const packet: SentinelDataPacket = validation.packet;
        if (!active) return;

        retryDelay = 1000;
        lastPacketTimeRef.current = Date.now();
        setDeviceError(null);
        setLatestPulse(packet.pulse);
        setLatestGsr(packet.gsr);
        setCalibrationError(
          packet.system.errorCode?.startsWith("GSR_CALIBRATION_")
            ? packet.system.errorCode
            : null,
        );
        setIsCalibrating(packet.system.calibrating);
        setCalibrationProgress(packet.system.calibrationProgress ?? 0);

        if (
          packet.pulse.quality === "DISCONNECTED" ||
          packet.gsr.quality === "DISCONNECTED"
        ) {
          setOverallQuality("DISCONNECTED");
        } else if (packet.system.calibrating) {
          setOverallQuality("CALIBRATING");
        } else if (
          packet.pulse.quality === "LOW_QUALITY" ||
          packet.gsr.quality === "LOW_QUALITY"
        ) {
          setOverallQuality("LOW_QUALITY");
        } else if (
          packet.pulse.quality === "VALID" &&
          packet.gsr.quality === "VALID"
        ) {
          setOverallQuality("VALID");
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
            return updated.length > 150
              ? updated.slice(updated.length - 150)
              : updated;
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
            return updated.length > 100
              ? updated.slice(updated.length - 100)
              : updated;
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
          quality: "STALE",
          beatDetected: false,
        }));
        setLatestGsr((previous) => ({
          ...previous,
          valid: false,
          quality: "STALE",
        }));
        setOverallQuality("STALE");
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
  const handleStartSession = useCallback(() => {
    setSessionRecord(null);
    setAiInterpretation(null);
    setPatientName("");
    setPatientSex("");
    setPatientAge("");
    setIsRecording(true);
    setSessionStartTime(Date.now());
    setSessionDuration(0);
    sessionSamplesRef.current = [];
  }, []);

  const handleStopSession = useCallback(() => {
    setIsRecording(false);
    const samples = sessionSamplesRef.current;
    if (samples.length === 0) return;

    const validBpms = samples
      .filter((s) => s.bpm !== null && s.pulseValid)
      .map((s) => s.bpm!);
    const meanBpm =
      validBpms.length > 0
        ? Math.round(validBpms.reduce((a, b) => a + b, 0) / validBpms.length)
        : null;
    const minBpm = validBpms.length > 0 ? Math.min(...validBpms) : null;
    const maxBpm = validBpms.length > 0 ? Math.max(...validBpms) : null;

    const validGsrAdc = samples
      .filter((s) => s.gsrValid && s.gsrRaw !== null)
      .map((s) => s.gsrRaw!);
    const meanGsrAdc =
      validGsrAdc.length > 0
        ? Math.round(
          validGsrAdc.reduce((sum, value) => sum + value, 0) /
          validGsrAdc.length,
        )
        : null;
    const gsrChanges = samples
      .filter((s) => s.gsrRelativeChange !== null)
      .map((s) => s.gsrRelativeChange!);
    const maxGsrRelativeChange =
      gsrChanges.length > 0
        ? Math.round(Math.max(...gsrChanges) * 10) / 10
        : null;

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
  }, [sessionStartTime, sessionDuration, overallQuality]);

  const sessionGsrChanges =
    sessionRecord?.samples
      .filter((sample) => sample.gsrRelativeChange !== null)
      .map((sample) => sample.gsrRelativeChange!) ?? [];
  const sessionMeanGsrChange =
    sessionGsrChanges.length > 0
      ? Math.round(
        (sessionGsrChanges.reduce((sum, value) => sum + value, 0) /
          sessionGsrChanges.length) *
        10,
      ) / 10
      : null;
  const sessionGsrTrend =
    sessionGsrChanges.length < 2
      ? "INDETERMINATE"
      : sessionGsrChanges.at(-1)! > sessionGsrChanges[0] + 1
        ? "RISING"
        : sessionGsrChanges.at(-1)! < sessionGsrChanges[0] - 1
          ? "FALLING"
          : "STABLE";

  const handleStartCalibration = useCallback(async () => {
    setCalibrationError(null);
    if (connectionMode === "device_ip") {
      if (window.location.protocol === "https:") {
        setDeviceError(formatDeviceError(null, deviceIp));
        return;
      }
      if (!isConnected) {
        setDeviceError("Connect to the ESP32 before starting calibration.");
        return;
      }
      try {
        const response = await fetch(`http://${deviceIp}/api/calibrate`, {
          method: "POST",
          signal: AbortSignal.timeout(2000),
        });
        if (!response.ok)
          throw new Error(`ESP32 returned HTTP ${response.status}`);
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
  }, [connectionMode, deviceIp, isConnected]);

  const handleResetCalibration = useCallback(async () => {
    if (connectionMode === "device_ip") {
      if (window.location.protocol === "https:") {
        setDeviceError(formatDeviceError(null, deviceIp));
        return;
      }
      if (!isConnected) {
        setDeviceError("Connect to the ESP32 before clearing its baseline.");
        return;
      }
      try {
        const response = await fetch(`http://${deviceIp}/api/calibrate/reset`, {
          method: "POST",
          signal: AbortSignal.timeout(2000),
        });
        if (!response.ok)
          throw new Error(`ESP32 returned HTTP ${response.status}`);
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
  }, [connectionMode, deviceIp, isConnected]);

  const handleConnectionModeChange = useCallback(
    (mode: "simulator" | "device_ip") => {
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
        quality: "INITIALIZING",
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
        quality: "INITIALIZING",
        trend: "INDETERMINATE",
      });
      setOverallQuality("INITIALIZING");
      setPulseHistory([]);
      setGsrHistory([]);
      simulatorPulseHistoryRef.current = [];
      simulatorGsrHistoryRef.current = [];
      lastSimulatorUiUpdateRef.current = 0;
    },
    [],
  );

  const handleDeviceIpChange = useCallback((ip: string) => {
    setDeviceIp(ip);
    window.localStorage.setItem("sentinel-device-ip", ip);
  }, []);

  const handleUseAccessPointIp = useCallback(
    () => handleDeviceIpChange("192.168.4.1"),
    [handleDeviceIpChange],
  );

  const handleApplyPreset = useCallback((name: string) => {
    setSimDisconnected(false);
    if (name === "resting") {
      setSimTargetBpm(72);
      setSimGsrDeflection(0);
      setSimNoiseLevel("none");
    } else if (name === "elevated") {
      setSimTargetBpm(105);
      setSimGsrDeflection(8);
      setSimNoiseLevel("none");
    } else if (name === "gsr_spike") {
      setSimTargetBpm(84);
      setSimGsrDeflection(18);
      setSimNoiseLevel("light");
    } else if (name === "disconnect") {
      setSimDisconnected(true);
    }
  }, []);

  const handleConnectToggle = useCallback(() => {
    setIsConnected((connected) => !connected);
    setDeviceError(null);
  }, []);

  const handleSignatureUpload = useCallback((file: File | null) => {
    setSignatureError(null);
    if (!file) {
      setSignatureImage(null);
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setSignatureError("Choose a PNG, JPEG, or WebP signature image.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setSignatureError("Signature image must be 1 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setSignatureError("The selected signature image could not be read.");
        return;
      }
      setSignatureImage(reader.result);
    };
    reader.onerror = () =>
      setSignatureError("The selected signature image could not be read.");
    reader.readAsDataURL(file);
  }, []);

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
        onConnectToggle={handleConnectToggle}
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
        {activeTab === "telemetry" && (
          <div className="space-y-6">
            <WelcomeHero />
            <section className="dashboard-intro">
              <div>
                <span className="dashboard-eyebrow">
                  LIVE PHYSIOLOGICAL MONITORING
                </span>
                <h2>Signals, in focus.</h2>
                <p>
                  Track pulse and skin response from your connected SENTINEL
                  device.
                </p>
              </div>
              <div className="intro-meta">
                <span
                  className={`intro-dot ${latestPulse.valid ? "is-live" : ""}`}
                ></span>
                <div>
                  <strong>
                    {latestPulse.valid
                      ? "Live signal acquired"
                      : "Waiting for a reliable signal"}
                  </strong>
                  <span>
                    {connectionMode === "simulator"
                      ? "Simulator mode"
                      : `ESP32 · ${deviceIp}`}
                  </span>
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
            <DeferredContent className="deferred-waveforms">
              <Suspense
                fallback={<div className="min-h-130" aria-busy="true" />}
              >
                <RealTimeOscilloscope
                  pulseHistory={pulseHistory}
                  gsrHistory={gsrHistory}
                  isPulseValid={latestPulse.valid}
                  isGsrValid={latestGsr.valid}
                />
              </Suspense>
            </DeferredContent>

            {/* Groq AI Wellness Assistant */}
            <DeferredContent className="deferred-ai">
              <Suspense
                fallback={<div className="min-h-56" aria-busy="true" />}
              >
                <AiAssistantPanel
                  key={sessionRecord?.id ?? "no-completed-session"}
                  sessionDuration={sessionRecord?.durationSeconds ?? 0}
                  meanBpm={sessionRecord?.summary.meanBpm ?? null}
                  minBpm={sessionRecord?.summary.minBpm ?? null}
                  maxBpm={sessionRecord?.summary.maxBpm ?? null}
                  validBeatRatio={
                    sessionRecord && sessionRecord.summary.totalSamples > 0
                      ? sessionRecord.summary.validBpmSamples /
                      sessionRecord.summary.totalSamples
                      : 0
                  }
                  gsrRelativeChange={sessionMeanGsrChange}
                  gsrTrend={sessionGsrTrend}
                  overallQuality={
                    sessionRecord?.summary.overallDataQuality ?? "INITIALIZING"
                  }
                  onResponse={setAiInterpretation}
                />
              </Suspense>
            </DeferredContent>

            {/* Interactive Hardware Diagnostic & Signal Generator (When in simulator mode) */}
            {connectionMode === "simulator" && (
              <DeferredContent className="deferred-simulator">
                <Suspense
                  fallback={<div className="min-h-80" aria-busy="true" />}
                >
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
                </Suspense>
              </DeferredContent>
            )}
          </div>
        )}

        {/* Tab 2: Session Analytics & CSV */}
        {activeTab === "session" && (
          <Suspense fallback={<div className="min-h-64" aria-busy="true" />}>
            <SessionManager
              session={sessionRecord}
              onClearSession={() => setSessionRecord(null)}
              isRecording={isRecording}
              aiInterpretation={aiInterpretation}
              patientName={patientName}
              onPatientNameChange={setPatientName}
              patientSex={patientSex}
              onPatientSexChange={setPatientSex}
              patientAge={patientAge}
              onPatientAgeChange={setPatientAge}
              signatureImage={signatureImage}
              onSignatureUpload={handleSignatureUpload}
              signatureError={signatureError}
              meanGsrChange={sessionMeanGsrChange}
              gsrTrend={sessionGsrTrend}
            />
          </Suspense>
        )}

        {/* Tab 3: Hardware & Wiring Center */}
        {activeTab === "hardware" && (
          <Suspense fallback={<div className="min-h-64" aria-busy="true" />}>
            <HardwareHub />
          </Suspense>
        )}

        {/* Tab 4: Firmware Source Exporter */}
        {activeTab === "firmware" && (
          <Suspense fallback={<div className="min-h-64" aria-busy="true" />}>
            <FirmwareExporter />
          </Suspense>
        )}

        {/* Tab 5: Engineering Docs */}
        {activeTab === "docs" && (
          <Suspense fallback={<div className="min-h-64" aria-busy="true" />}>
            <DocumentationViewer />
          </Suspense>
        )}
      </main>

      {/* Footer */}
      <footer className="sentinel-footer">
        <div className="footer-shell">
          <div className="footer-main">
            <div className="footer-brand">
              <span className="footer-brand-mark" aria-hidden="true">
                <Heart className="footer-brand-heart" size={22} strokeWidth={2} />
              </span>
              <div>
                <p className="footer-eyebrow">Open-source physiological monitoring</p>
                <h2>SENTINEL <span>v2.0</span></h2>
                <p className="footer-description">ESP32 · PPG + GSR · AI-assisted session insights</p>
              </div>
            </div>

            <div className="footer-contacts" aria-label="Project creators">
              {[
                { name: "Harsh", links: ContactMe },
                { name: "Bhupesh", links: ContactBh },
              ].map((person) => (
                <section className="footer-contact-card" key={person.name} aria-label={`${person.name} contact links`}>
                  <h3>{person.name}</h3>
                  <div className="footer-social-links">
                    {person.links.map((contact) => {
                      const Icon = contact.icon;
                      return (
                        <a
                          key={contact.id}
                          href={contact.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${person.name} on ${contact.id}`}
                          title={`${person.name} on ${contact.id}`}
                        >
                          <Icon aria-hidden="true" />
                          <span>{contact.id}</span>
                        </a>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Harsh &amp; Bhupesh</span>
            <span className="footer-project-note">Academic engineering prototype · Not for clinical diagnosis</span>
            <span className="footer-made-with">
              Built with <Heart size={12} aria-hidden="true" /> by the project team
            </span>
          </div>
        </div>
      </footer>
      <WelcomeOpening />
    </div>
  );
}
