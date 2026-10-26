import React, { useState } from 'react';
import { Code2, Copy, Check, FileCode } from 'lucide-react';
import dataProtocolCpp from '../../firmware/sentinel/data_protocol.cpp?raw';
import dataProtocolH from '../../firmware/sentinel/data_protocol.h?raw';
import gsrProcessorCpp from '../../firmware/sentinel/gsr_processor.cpp?raw';
import gsrProcessorH from '../../firmware/sentinel/gsr_processor.h?raw';
import oledUiCpp from '../../firmware/sentinel/oled_ui.cpp?raw';
import oledUiH from '../../firmware/sentinel/oled_ui.h?raw';
import pulseProcessorCpp from '../../firmware/sentinel/pulse_processor.cpp?raw';
import pulseProcessorH from '../../firmware/sentinel/pulse_processor.h?raw';
import secretsExampleH from '../../firmware/sentinel/secrets.example.h?raw';
import sentinelSketch from '../../firmware/sentinel/sentinel.ino?raw';
import firmwareConfigH from '../../firmware/sentinel/config.h?raw';
import platformioConfig from '../../platformio.ini?raw';

interface FirmwareFile {
  name: string;
  path: string;
  description: string;
  code: string;
}

const FIRMWARE_FILES: FirmwareFile[] = [
  {
    name: 'sentinel.ino',
    path: 'firmware/sentinel/sentinel.ino',
    description: 'ESP32 application: sensor sampling, Wi-Fi fallback, HTTP endpoints, OLED, and serial diagnostics.',
    code: sentinelSketch,
  },
  {
    name: 'config.h',
    path: 'firmware/sentinel/config.h',
    description: 'Hardware pins, sampling and signal thresholds, Wi-Fi mode, and telemetry settings.',
    code: firmwareConfigH,
  },
  {
    name: 'pulse_processor.h',
    path: 'firmware/sentinel/pulse_processor.h',
    description: 'Pulse processor types and public interface.',
    code: pulseProcessorH,
  },
  {
    name: 'pulse_processor.cpp',
    path: 'firmware/sentinel/pulse_processor.cpp',
    description: 'PPG signal filtering, beat detection, BPM calculation, and signal recovery.',
    code: pulseProcessorCpp,
  },
  {
    name: 'gsr_processor.h',
    path: 'firmware/sentinel/gsr_processor.h',
    description: 'GSR measurement, calibration, quality, and trend types.',
    code: gsrProcessorH,
  },
  {
    name: 'gsr_processor.cpp',
    path: 'firmware/sentinel/gsr_processor.cpp',
    description: 'GSR smoothing, baseline calibration, sensor validation, and trend analysis.',
    code: gsrProcessorCpp,
  },
  {
    name: 'data_protocol.h',
    path: 'firmware/sentinel/data_protocol.h',
    description: 'Telemetry serialization interface.',
    code: dataProtocolH,
  },
  {
    name: 'data_protocol.cpp',
    path: 'firmware/sentinel/data_protocol.cpp',
    description: 'Schema-versioned JSON telemetry serialization for the dashboard API.',
    code: dataProtocolCpp,
  },
  {
    name: 'oled_ui.h',
    path: 'firmware/sentinel/oled_ui.h',
    description: 'SSD1306 display interface.',
    code: oledUiH,
  },
  {
    name: 'oled_ui.cpp',
    path: 'firmware/sentinel/oled_ui.cpp',
    description: 'OLED initialization, boot and error screens, and live sensor display.',
    code: oledUiCpp,
  },
  {
    name: 'secrets.example.h',
    path: 'firmware/sentinel/secrets.example.h',
    description: 'Safe Wi-Fi credential template. Copy to secrets.h locally and enter your network credentials.',
    code: secretsExampleH,
  },
  {
    name: 'platformio.ini',
    path: 'platformio.ini',
    description: 'Actual PlatformIO board environments, build flags, upload settings, and firmware dependencies.',
    code: platformioConfig,
  },
];

export const FirmwareExporter: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<string>('sentinel.ino');
  const [copied, setCopied] = useState<boolean>(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const current = FIRMWARE_FILES.find((file) => file.name === selectedFile) ?? FIRMWARE_FILES[0];

  const handleCopy = async () => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(current.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error(`Could not copy ${current.path} to the clipboard.`, error);
      setCopyError('Clipboard access failed. Select and copy the source manually.');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <FileCode className="w-5 h-5 text-cyan-400" />
            Embedded Firmware Source
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Exact project sources from firmware/sentinel and the root PlatformIO configuration.
            Local-only secrets.h is intentionally excluded; use the safe example template.
          </p>
        </div>

        <button
          onClick={handleCopy}
          className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Copied to Clipboard!' : `Copy ${current.name}`}</span>
        </button>
      </div>

      <div className="flex overflow-x-auto gap-2 border-b border-slate-800 pb-2">
        {FIRMWARE_FILES.map((file) => (
          <button
            key={file.path}
            onClick={() => setSelectedFile(file.name)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 whitespace-nowrap ${selectedFile === file.name
              ? 'bg-slate-800 text-cyan-400 font-bold border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{file.name}</span>
          </button>
        ))}
      </div>

      <div className="text-xs text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <span>{current.description}</span>
        <span className="font-mono text-slate-500">{current.path}</span>
      </div>
      {copyError && <p className="text-xs text-rose-300" role="alert">{copyError}</p>}

      <div className="relative bg-[#090e1a] rounded-xl border border-slate-800 overflow-hidden">
        <pre className="p-4 text-xs font-mono text-cyan-200 overflow-x-auto max-h-125 leading-relaxed">
          <code>{current.code}</code>
        </pre>
      </div>
    </div>
  );
};
