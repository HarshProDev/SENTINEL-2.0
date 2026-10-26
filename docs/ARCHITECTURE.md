# SENTINEL 2.0 - System Architecture Specification

## 1. High-Level System Architecture

```
+----------------------------------------------------------------------------------+
| PHYSICAL SENSOR TIER (3.3V DC Isolated)                                         |
|                                                                                  |
|   +-----------------------+              +------------------------+              |
|   | Optical Pulse Sensor  |              | Analog GSR Electrodes  |              |
|   | (Photodiode + LED)    |              | (Skin Conductance)     |              |
|   +-----------+-----------+              +-----------+------------+              |
|               | (Analog V)                           | (Analog V)                |
+---------------|--------------------------------------|---------------------------+
                v                                      v
+----------------------------------------------------------------------------------+
| EMBEDDED COMPUTING & DSP TIER (ESP32)                                            |
|                                                                                  |
|   GPIO 34 (ADC1_CH6)                                 GPIO 35 (ADC1_CH7)          |
|         |                                                  |                     |
|         v                                                  v                     |
|   [PulseProcessor]                                   [GsrProcessor]              |
|   - DC baseline subtraction                          - Exponential moving avg    |
|   - AC bandpass / lowpass smoothing                  - 15s resting calibration   |
|   - Adaptive threshold crossing                      - Relative % shift calc     |
|   - Refractory period (320ms gate)                   - Drift / trend detector    |
|   - 4-beat validation gate                           - Sensor disconnect guard   |
|         |                                                  |                     |
|         +-------------------------+------------------------+                     |
|                                   |                                              |
|                                   v                                              |
|                           [DataProtocol Engine]                                  |
|                           (Schema Version 1 JSON)                                |
|                                   |                                              |
|                   +---------------+---------------+                              |
|                   |                               |                              |
|                   v                               v                              |
|          [SSD1306 OLED HUD]               [Embedded WebServer]                   |
|          (Local 10 FPS I2C)               (Wi-Fi SoftAP / Station)               |
+-------------------|-------------------------------|------------------------------+
                    |                               | (HTTP JSON polling at a controlled rate)
                    v                               v
+----------------------------------------------------------------------------------+
| PRESENTATION & APPLICATION TIER (Browser Client)                                 |
|                                                                                  |
|   - Real-Time PPG Rolling Oscilloscope & Systolic Peak Markers                   |
|   - GSR Baseline & Relative Response Graph                                       |
|   - Session Manager & CSV Data Exporter (Local Storage / IndexedDB)              |
|   - Hardware Diagnostic Suite & Sensor Simulator                                 |
|   - Transparent AI Summary Visualizer                                            |
|                                   |                                              |
|                                   v (Validated Summary POST)                     |
+-----------------------------------|----------------------------------------------+
                                    |
                                    v
+----------------------------------------------------------------------------------+
| SECURE BACKEND & AI INFERENCE TIER (Node.js Express on Laptop)                   |
|                                                                                  |
|   - Endpoint: POST /api/ai/interpret                                             |
|   - Input Gatekeeper: Validates summary, rejects invalid/noisy sessions          |
|   - Rate Limiting & Timeout protection (12s abort controller)                    |
|   - Privacy Guard: Zero raw waveform exposure, secret stored in .env only        |
|   - Groq API Integration (llama-3.3-70b-versatile)                               |
|   - Failover: Google GenAI (Gemini Flash) or Deterministic Local Heuristics      |
+----------------------------------------------------------------------------------+
```

## 2. Decoupled Communication & Failure Boundaries

1. **Independent Sensor Acquisition:** The ESP32 100Hz hardware-timed acquisition loop is completely independent of network connectivity, OLED rendering, and AI services. If Wi-Fi drops, the ESP32 continues acquisition and local OLED display uninterrupted.
2. **Offline-First Dashboard:** The web dashboard polls the ESP32 `/api/live` endpoint sequentially on the local LAN or SoftAP, so slow device responses do not create overlapping requests. It does not require internet access to display, chart, record, or export CSV data.
3. **Isolated AI Inference:** AI interpretation is strictly an on-demand, post-measurement analytical tool. Downtime or rate limiting of the Groq API does not impede sensor monitoring or dashboard charting.
4. **No Secret Leakage:** The ESP32 firmware and browser client never possess or transmit the Groq API key. All AI requests flow through the laptop's Node.js backend proxy.
