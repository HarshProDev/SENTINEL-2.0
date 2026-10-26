# SENTINEL 2.0 - Formal Acceptance Testing & Verification

This test suite covers automated software tests, firmware tests, protocol verification, network failover, and safety criteria.

## Test Matrix

| Test ID | Test Name | Preconditions | Steps | Expected Result | Pass / Fail Criteria | Requires Hardware? |
|---|---|---|---|---|---|---|
| **TC-01** | Firmware Compilation | Arduino IDE or PlatformIO installed | Run `pio run` or compile sketch in Arduino IDE | Compiles with 0 errors and <65% RAM utilization | Pass: Exit code 0 | No |
| **TC-02** | Unit Tests: Pulse DSP | Node.js and TSX installed | Run `npx tsx --test src/utils/*.test.ts` | All deterministic DSP and protocol tests pass, including low-amplitude PPG | Pass: all tests green | No |
| **TC-03** | OLED Initialization | ESP32 wired to SSD1306 (SDA=21, SCL=22) | Power on ESP32 | Boot screen displays "SENTINEL 2.0" and v2.0.0 | Pass: Screen crisp, no flickering | Yes |
| **TC-04** | Pulse Refractory Rejection | Pulse sensor connected to GPIO 34 | Inject mechanical vibration or fast pulses (<300ms) | Artifacts under 320ms are discarded | Pass: BPM does not double | Yes / Sim |
| **TC-05** | Consecutive Beat Gate | Disconnected sensor reconnected | Place finger on pulse sensor | BPM remains unvalidated until 4 regular beats occur, then reports a BPM estimate | Pass: No instant fake BPM; regular low-amplitude input is detected | Yes / Sim |
| **TC-06** | Sensor Disconnect Detection | Pulse or GSR sensor wire pulled | Disconnect signal jumper | Quality immediately transitions to `DISCONNECTED`; BPM withheld | Pass: No stale or 0 BPM | Yes |
| **TC-07** | GSR Baseline Calibration | GSR electrodes attached and stable | Click "Start Baseline Calibration" | 1,500 samples collected over 15s; median baseline stored; noisy/disconnected runs rejected | Pass: Baseline ADC displayed only after accepted calibration | Yes / Sim |
| **TC-08** | Schema v1 Compliance | ESP32 running or simulator active | Query `GET /api/live` | JSON payload validates with `ProtocolValidator` | Pass: 0 schema errors | No |
| **TC-09** | Live Chart Rolling Update | Web dashboard connected to stream | Observe PPG oscilloscope and GSR trend | Dashboard polls the device without overlapping requests and plots accepted telemetry | Pass: Live values update without repeated request failures | No |
| **TC-10** | CSV Export Verification | Recorded session active | Click "Export CSV" | Browser downloads valid RFC-4180 CSV file | Pass: Correct headers and rows | No |
| **TC-11** | Groq AI Summarization | Valid 15s session recorded | Click "Request AI Interpretation" | Returns structured JSON with cautious non-diagnostic summary | Pass: Status 'ok', no hallucinated BPM | No |
| **TC-12** | AI Request Gatekeeper | Signal quality is `LOW_QUALITY` or `DISCONNECTED` | Click AI request | UI blocks request or backend returns `rejected_invalid_data` | Pass: No unvalidated data sent | No |
| **TC-13** | Offline Fallback | Disable internet connection | Request interpretation | Local rule engine generates fallback guidance | Pass: Clean advice, zero crash | No |
| **TC-14** | Wi-Fi Failover to SoftAP | Router credentials invalid in `config.h` | Boot ESP32 | ESP32 launches `SENTINEL-2-AP` at `192.168.4.1` | Pass: AP visible, OLED shows IP | Yes |
| **TC-15** | Zero Secret Leakage | Inspect browser DevTools & Git repo | Search client bundle for `GROQ_API_KEY` | Zero occurrence in client bundle or firmware | Pass: Key exists only in `.env` | No |
