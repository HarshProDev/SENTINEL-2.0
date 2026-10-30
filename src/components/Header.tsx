import React, { memo } from 'react';
import { Activity, Wifi, WifiOff, Cpu, RefreshCw, Radio, Play, Square, BarChart3, Cable, Code2, BookOpen, HeartPulse } from 'lucide-react';
import { SignalQuality } from '../types/sentinel';

interface HeaderProps {
  activeTab: 'telemetry' | 'session' | 'hardware' | 'firmware' | 'docs';
  setActiveTab: (tab: 'telemetry' | 'session' | 'hardware' | 'firmware' | 'docs') => void;
  connectionMode: 'simulator' | 'device_ip';
  setConnectionMode: (mode: 'simulator' | 'device_ip') => void;
  deviceIp: string;
  setDeviceIp: (ip: string) => void;
  onUseAccessPointIp: () => void;
  isConnected: boolean;
  onConnectToggle: () => void;
  deviceError: string | null;
  overallQuality: SignalQuality;
  isRecording: boolean;
  sessionDuration: number;
  onStartSession: () => void;
  onStopSession: () => void;
  lastDataAgeMs: number;
}

export const Header: React.FC<HeaderProps> = memo(({
  activeTab,
  setActiveTab,
  connectionMode,
  setConnectionMode,
  deviceIp,
  setDeviceIp,
  onUseAccessPointIp,
  isConnected,
  onConnectToggle,
  deviceError,
  overallQuality,
  isRecording,
  sessionDuration,
  onStartSession,
  onStopSession,
  lastDataAgeMs,
}) => {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getQualityBadge = () => {
    switch (overallQuality) {
      case 'VALID':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>SIGNAL VALID</span>;
      case 'CALIBRATING':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-800"><RefreshCw className="w-3 h-3 animate-spin" />CALIBRATING</span>;
      case 'INITIALIZING':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-800">SYNCING</span>;
      case 'LOW_QUALITY':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-800">NOISY SIGNAL</span>;
      case 'DISCONNECTED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-800">SENSOR DISCONNECTED</span>;
      case 'STALE':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-800">DEVICE STALE</span>;
      case 'ERROR':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-800">DEVICE ERROR</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">STANDBY</span>;
    }
  };

  return (
    <header className="sentinel-header sticky top-0 z-40">
      {/* Top Banner */}
      <div className="max-w-370 mx-auto px-4 sm:px-7 lg:px-10 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="brand-mark w-10 h-10 rounded-2xl bg-linear-to-tr from-teal-700 to-emerald-700 flex items-center justify-center shadow-lg text-white font-bold">
            <HeartPulse className="w-6 h-6 animate-pulse" />
            {/* <Stethoscope size={20} color="#ffffff" strokeWidth={1.5} /> */}
            {/* <HeartPulse size={20} color="#ffffff" strokeWidth={1.5} /> */}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                SENTINEL<span className="version-pill text-xs px-2 py-0.5 rounded-md font-mono">2.0</span>
              </h1>
              {getQualityBadge()}
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Physiological research dashboard
            </p>
          </div>
        </div>

        {/* Connection & Telemetry Mode Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Switcher */}
          <div className="mode-switch flex items-center bg-slate-950 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setConnectionMode('simulator')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${connectionMode === 'simulator'
                ? 'bg-linear-to-r from-teal-700 to-emerald-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Simulator</span>
            </button>
            <button
              onClick={() => setConnectionMode('device_ip')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${connectionMode === 'device_ip'
                ? 'bg-linear-to-r from-teal-700 to-emerald-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>ESP32 Wi-Fi</span>
            </button>
          </div>

          {/* Device IP input when in device_ip mode */}
          {connectionMode === 'device_ip' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={deviceIp}
                onChange={(e) => setDeviceIp(e.target.value)}
                placeholder="ESP32 IP from OLED"
                aria-label="ESP32 IP Address"
                className="bg-white border border-slate-200 text-slate-800 text-xs font-mono rounded-lg px-2.5 py-1.5 w-32 focus:outline-none focus:border-teal-500"
              />
              <button
                onClick={onConnectToggle}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${isConnected
                  ? 'bg-rose-900/60 text-rose-300 border border-rose-700 hover:bg-rose-800/80'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
              >
                {isConnected ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                {isConnected ? 'Disconnect' : 'Connect'}
              </button>
              <button
                onClick={onUseAccessPointIp}
                className="text-xs px-2.5 py-1.5 rounded-lg font-medium text-teal-800 border border-teal-200 hover:bg-teal-50"
                title="Use the ESP32 SoftAP address 192.168.4.1"
              >
                Use AP IP
              </button>
              {deviceError && (
                <span className="basis-full text-[11px] text-rose-300" role="status">
                  {deviceError}
                </span>
              )}
              {!deviceError && (
                <span className="basis-full text-[11px] text-slate-400">
                  {window.location.protocol === 'https:'
                    ? 'Remote access requires a secure cloud relay; this HTTPS page cannot directly read a private ESP32 IP.'
                    : 'Enter the ESP32 IP shown on its OLED. SoftAP mode can work without internet access.'}
                </span>
              )}
            </div>
          )}

          {/* Session Recording Controls */}
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            {isRecording ? (
              <button
                onClick={onStopSession}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-3.5 py-2 rounded-xl font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop ({formatTime(sessionDuration)})</span>
              </button>
            ) : (
              <button
                onClick={onStartSession}
                className="record-button bg-linear-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 text-white text-xs px-3.5 py-2 rounded-xl font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Record Session</span>
              </button>
            )}
          </div>

          {/* Freshness Indicator */}
          <div className="hidden lg:flex items-center text-slate-400 text-xs font-mono">
            <span
              className={`inline-block w-2 h-2 rounded-full mr-1.5 ${lastDataAgeMs < 400 ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
            ></span>
            <span>{lastDataAgeMs < 1500 ? `${lastDataAgeMs}ms` : 'No feed'}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-370 mx-auto px-4 sm:px-7 lg:px-10 flex overflow-x-auto border-t border-slate-200 scrollbar-none">
        <nav className="flex space-x-1 py-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`header-tab px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 ${activeTab === 'telemetry'
              ? 'header-tab-active bg-slate-800 text-cyan-400 font-semibold'
              : 'header-tab-idle text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
          >
            <Activity className="w-3.5 h-3.5" /> <span>Live Monitor</span>
          </button>
          <button
            onClick={() => setActiveTab('session')}
            className={`header-tab px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 ${activeTab === 'session'
              ? 'header-tab-active bg-slate-800 text-cyan-400 font-semibold'
              : 'header-tab-idle text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> <span>Sessions</span>
          </button>
          <button
            onClick={() => setActiveTab('hardware')}
            className={`header-tab px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 ${activeTab === 'hardware'
              ? 'header-tab-active bg-slate-800 text-cyan-400 font-semibold'
              : 'header-tab-idle text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
          >
            <Cable className="w-3.5 h-3.5" /> <span>Hardware</span>
          </button>
          <button
            onClick={() => setActiveTab('firmware')}
            className={`header-tab px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 ${activeTab === 'firmware'
              ? 'header-tab-active bg-slate-800 text-cyan-400 font-semibold'
              : 'header-tab-idle text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
          >
            <Code2 className="w-3.5 h-3.5" /> <span>Firmware</span>
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`header-tab px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 ${activeTab === 'docs'
              ? 'header-tab-active bg-slate-800 text-cyan-400 font-semibold'
              : 'header-tab-idle text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> <span>Guides</span>
          </button>
        </nav>
      </div>
    </header>
  );
});
