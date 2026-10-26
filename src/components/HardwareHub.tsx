import React, { useState } from 'react';
import { Cpu, AlertTriangle, ShieldCheck, CheckSquare, Square, Zap, Info } from 'lucide-react';

export const HardwareHub: React.FC = () => {
  const [selectedBoard, setSelectedBoard] = useState<'classic' | 's3' | 'c3'>('classic');
  const [checklist, setChecklist] = useState<{ [key: string]: boolean }>({
    no5v: false,
    commonGnd: false,
    adc1Only: false,
    isolatedPower: false,
    cleanFingers: false,
  });

  const toggleCheck = (key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allChecked = Object.values(checklist).every(Boolean);

  return (
    <div className="space-y-6">
      {/* ADC1 vs ADC2 Safety Banner */}
      <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 flex items-start gap-3 text-amber-200">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-bold text-amber-950 text-sm block">
            Critical ESP32 Hardware Rule: ADC1 vs ADC2 Wi-Fi Conflict
          </span>
          <p className="leading-relaxed text-amber-300">
            On classic ESP32 boards (ESP-WROOM-32), <strong>ADC2 pins CANNOT be sampled when Wi-Fi is actively running</strong> (ADC2 channels are used by the RF Wi-Fi circuitry). Always connect analog sensors to <strong>ADC1 channels (GPIO 32, 33, 34, 35, 36, 39)</strong>. In SENTINEL 2.0, GPIO 34 and GPIO 35 are configured because they are dedicated input-only pins with no internal pull-ups!
          </p>
        </div>
      </div>

      {/* Board Selector & Pinout Mapping Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-semibold text-white">Model-Dependent Pin Assignment Matrix</h3>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setSelectedBoard('classic')}
              className={`px-3 py-1.5 rounded-md transition-colors ${selectedBoard === 'classic' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Classic ESP-WROOM-32
            </button>
            <button
              onClick={() => setSelectedBoard('s3')}
              className={`px-3 py-1.5 rounded-md transition-colors ${selectedBoard === 's3' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              ESP32-S3
            </button>
            <button
              onClick={() => setSelectedBoard('c3')}
              className={`px-3 py-1.5 rounded-md transition-colors ${selectedBoard === 'c3' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              ESP32-C3
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="pb-2.5">Component</th>
                <th className="pb-2.5">Module Pin</th>
                <th className="pb-2.5 font-bold text-cyan-300">ESP32 Pin</th>
                <th className="pb-2.5">Signal Type</th>
                <th className="pb-2.5">Voltage Safe Limit</th>
                <th className="pb-2.5">Verification Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
              {selectedBoard === 'classic' && (
                <>
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2.5 font-sans font-medium text-white">Pulse Sensor</td>
                    <td className="py-2.5">Signal (S)</td>
                    <td className="py-2.5 font-bold text-cyan-400">GPIO 34</td>
                    <td className="py-2.5">Analog (ADC1_CH6)</td>
                    <td className="py-2.5 text-amber-400">0.0V - 3.3V max</td>
                    <td className="py-2.5"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">Verified</span></td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2.5 font-sans font-medium text-white">GSR Sensor Module</td>
                    <td className="py-2.5">Signal (SIG)</td>
                    <td className="py-2.5 font-bold text-cyan-400">GPIO 35</td>
                    <td className="py-2.5">Analog (ADC1_CH7)</td>
                    <td className="py-2.5 text-amber-400">0.0V - 3.3V max</td>
                    <td className="py-2.5"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">Verified</span></td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2.5 font-sans font-medium text-white">SSD1306 OLED</td>
                    <td className="py-2.5">SDA (Data)</td>
                    <td className="py-2.5 font-bold text-cyan-400">GPIO 21</td>
                    <td className="py-2.5">I2C Data</td>
                    <td className="py-2.5 text-slate-400">3.3V Logic</td>
                    <td className="py-2.5"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">Verified</span></td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2.5 font-sans font-medium text-white">SSD1306 OLED</td>
                    <td className="py-2.5">SCL (Clock)</td>
                    <td className="py-2.5 font-bold text-cyan-400">GPIO 22</td>
                    <td className="py-2.5">I2C Clock</td>
                    <td className="py-2.5 text-slate-400">3.3V Logic</td>
                    <td className="py-2.5"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">Verified</span></td>
                  </tr>
                </>
              )}

              {selectedBoard === 's3' && (
                <>
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2.5 font-sans font-medium text-white">Pulse Sensor</td>
                    <td className="py-2.5">Signal (S)</td>
                    <td className="py-2.5 font-bold text-cyan-400">GPIO 4</td>
                    <td className="py-2.5">Analog (ADC1_CH3)</td>
                    <td className="py-2.5 text-amber-400">0.0V - 3.3V max</td>
                    <td className="py-2.5"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">Verified</span></td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2.5 font-sans font-medium text-white">GSR Sensor Module</td>
                    <td className="py-2.5">Signal (SIG)</td>
                    <td className="py-2.5 font-bold text-cyan-400">GPIO 5</td>
                    <td className="py-2.5">Analog (ADC1_CH4)</td>
                    <td className="py-2.5 text-amber-400">0.0V - 3.3V max</td>
                    <td className="py-2.5"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">Verified</span></td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2.5 font-sans font-medium text-white">SSD1306 OLED</td>
                    <td className="py-2.5">SDA (Data)</td>
                    <td className="py-2.5 font-bold text-cyan-400">GPIO 8</td>
                    <td className="py-2.5">I2C Data</td>
                    <td className="py-2.5 text-slate-400">3.3V Logic</td>
                    <td className="py-2.5"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">Verified</span></td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2.5 font-sans font-medium text-white">SSD1306 OLED</td>
                    <td className="py-2.5">SCL (Clock)</td>
                    <td className="py-2.5 font-bold text-cyan-400">GPIO 9</td>
                    <td className="py-2.5">I2C Clock</td>
                    <td className="py-2.5 text-slate-400">3.3V Logic</td>
                    <td className="py-2.5"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">Verified</span></td>
                  </tr>
                </>
              )}

              {selectedBoard === 'c3' && (
                <>
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2.5 font-sans font-medium text-white">Pulse Sensor</td>
                    <td className="py-2.5">Signal (S)</td>
                    <td className="py-2.5 font-bold text-cyan-400">GPIO 0</td>
                    <td className="py-2.5">Analog (ADC1_CH0)</td>
                    <td className="py-2.5 text-amber-400">0.0V - 3.3V max</td>
                    <td className="py-2.5"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">Verified</span></td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2.5 font-sans font-medium text-white">GSR Sensor Module</td>
                    <td className="py-2.5">Signal (SIG)</td>
                    <td className="py-2.5 font-bold text-cyan-400">GPIO 1</td>
                    <td className="py-2.5">Analog (ADC1_CH1)</td>
                    <td className="py-2.5 text-amber-400">0.0V - 3.3V max</td>
                    <td className="py-2.5"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">Verified</span></td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2.5 font-sans font-medium text-white">SSD1306 OLED</td>
                    <td className="py-2.5">SDA (Data)</td>
                    <td className="py-2.5 font-bold text-cyan-400">GPIO 4</td>
                    <td className="py-2.5">I2C Data</td>
                    <td className="py-2.5 text-slate-400">3.3V Logic</td>
                    <td className="py-2.5"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">Verified</span></td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2.5 font-sans font-medium text-white">SSD1306 OLED</td>
                    <td className="py-2.5">SCL (Clock)</td>
                    <td className="py-2.5 font-bold text-cyan-400">GPIO 5</td>
                    <td className="py-2.5">I2C Clock</td>
                    <td className="py-2.5 text-slate-400">3.3V Logic</td>
                    <td className="py-2.5"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">Verified</span></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pre-Power Safety Checklist */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-semibold text-white">Pre-Power Safety Verification Checklist</h3>
          </div>
          {allChecked ? (
            <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1">
              All Pre-Power Checks Passed
            </span>
          ) : (
            <span className="text-xs bg-amber-950 text-amber-400 border border-amber-800 px-2.5 py-1 rounded-md font-semibold">
              Pending Electrical Verification
            </span>
          )}
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Complete these 5 physical checks before connecting the USB cable to ensure no damage occurs to the ESP32 ADC or human participant.
        </p>

        <div className="space-y-2.5 text-xs text-slate-300">
          <div
            onClick={() => toggleCheck('no5v')}
            className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer"
          >
            {checklist.no5v ? <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />}
            <div>
              <span className="font-semibold text-emerald-500 block">1. 3.3V Power Rail Verification</span>
              <span>Confirmed sensor VCC lines are plugged into the ESP32 3V3 rail, NEVER 5V or VIN pin. (Exceeding 3.6V will destroy the ESP32 ADC).</span>
            </div>
          </div>

          <div
            onClick={() => toggleCheck('commonGnd')}
            className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer"
          >
            {checklist.commonGnd ? <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />}
            <div>
              <span className="font-semibold text-emerald-500 block">2. Common Ground Continuity</span>
              <span>ESP32 GND, Pulse Sensor GND, GSR Module GND, and OLED GND all share a single contiguous breadboard ground plane.</span>
            </div>
          </div>

          <div
            onClick={() => toggleCheck('adc1Only')}
            className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer"
          >
            {checklist.adc1Only ? <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />}
            <div>
              <span className="font-semibold text-emerald-500 block">3. ADC1 Channel Assignment</span>
              <span>Analog sensor outputs are connected to ADC1 pins (GPIO 34 and 35) to prevent Wi-Fi freeze issues.</span>
            </div>
          </div>

          <div
            onClick={() => toggleCheck('isolatedPower')}
            className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer"
          >
            {checklist.isolatedPower ? <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />}
            <div>
              <span className="font-semibold text-emerald-500 block">4. Mains Isolation & Human Safety</span>
              <span>Laptop is running on battery power (unplugged from AC wall charger) or powered via an isolated USB battery pack during body-contact testing.</span>
            </div>
          </div>

          <div
            onClick={() => toggleCheck('cleanFingers')}
            className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer"
          >
            {checklist.cleanFingers ? <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />}
            <div>
              <span className="font-semibold text-emerald-500 block">5. Sensor Attachment Preparation</span>
              <span>Participant fingers clean and dry; optical sensor placed gently on fingertip without excessive strap pressure occluding blood flow.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
