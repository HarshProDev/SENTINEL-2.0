 HEAD
# SENTINEL 2.0 - Real-Time Physiological Response Monitoring

SENTINEL 2.0 is an open, reproducible, end-to-end IoT and AI physiological monitoring system designed for student researchers, biomedical engineering labs, and embedded developers targeting **₹0 extra hardware cost**.

The system acquires raw analog photoplethysmogram (PPG) and galvanic skin response (GSR) signals using an ESP32, executes digital signal processing with physiological refractory gating, displays metrics on an SSD1306 OLED, streams versioned Schema v1 JSON telemetry over Wi-Fi, and visualizes real-time physiological response in a scientific web dashboard paired with cautious Groq AI wellness interpretation.

---

## Key Features

* **Deterministic Embedded DSP:** 100Hz non-blocking acquisition, DC baseline tracking, adaptive peak thresholding, 320ms refractory period (up to 187 BPM), and a 4-beat validation gate to prevent artifact miscounting.
* **Baseline-Relative GSR Processing:** Guided 15-second personal baseline calibration with median noise rejection and relative percentage shift ($\Delta \text{GSR}_{\%}$) tracking.
* **Honest States & Fault Detection:** Explicitly signals `INITIALIZING`, `CALIBRATING`, `VALID`, `LOW_QUALITY`, `DISCONNECTED`, and `STALE`—never fabricates zero or default values.
* **Onboard OLED HUD:** SSD1306 128x64 display showing real-time BPM, signal confidence, GSR relative shift, Wi-Fi status, and IP address.
* **Scientific Web Dashboard:** Live PPG rolling oscilloscope, GSR trend chart, session recording, and instant CSV export.
* **Secure Groq AI Integration:** Cautious, non-diagnostic wellness suggestions via local Node.js proxy with automatic failover to Google GenAI or offline deterministic rule engine.
* **Zero Extra Hardware Cost:** Runs entirely on standard ESP32 starter kits; operates offline in standalone SoftAP mode without requiring a Wi-Fi router or cloud subscriptions.

---

## Hardware Pinout (Classic ESP32 DevKit)

| Sensor / Display | Module Pin | ESP32 Pin | Channel / Function |
| :--- | :--- | :--- | :--- |
| **Analog Pulse Sensor** | Signal (S) | **GPIO 34** | ADC1_CH6 (Wi-Fi Safe) |
| **Analog GSR Sensor** | Signal (SIG) | **GPIO 35** | ADC1_CH7 (Wi-Fi Safe) |
| **SSD1306 OLED** | SDA | **GPIO 21** | Hardware I2C SDA |
| **SSD1306 OLED** | SCL | **GPIO 22** | Hardware I2C SCL |
| **Power Rails** | VCC / VDD | **3V3 (3.3V)** | Never use 5V on ADC pins! |
| **Ground** | GND | **GND** | Common system ground |

> **Warning:** Never connect analog sensors to ADC2 pins (`GPIO 0, 2, 4, 12-15, 25-27`) on classic ESP32, as ADC2 is disabled during Wi-Fi transmission.

---

## Quick Start Guide

### 1. Run Web Dashboard & Backend
```bash
# Install dependencies
npm install

# Run unit tests (logic & DSP verification)
npm test

# Start the full-stack server & dashboard
npm run dev
```
Open your browser at `http://localhost:3000`.

For Lighthouse or other performance testing, measure the optimized production build rather than the Vite development server:
```bash
npm run build
npm run start:production
```
Then run Lighthouse against `http://localhost:3000`. The development server intentionally includes development tooling and unminified modules, so its JavaScript size and performance scores do not represent the deployed app.

### 2. Connect the ESP32 and view live readings
* In the dashboard header, select **ESP32 Wi-Fi**.
* Connect your computer to the same **2.4 GHz Wi-Fi** network as the ESP32 and enter the current IP shown on its OLED. If the ESP32 is using its fallback network, join **SENTINEL-2-AP** and select **Use AP IP** (`192.168.4.1`). The fallback network does not provide internet access; keep the dashboard open at `localhost`.
* Rest a finger gently on the pulse sensor. Allow a few seconds for the firmware to validate consecutive beats. The dashboard shows the current BPM when the pulse signal is valid; a **STALE** badge means the last value is retained while the browser reconnects.
* To connect to a router, make a local copy of `firmware/sentinel/secrets.example.h` named `secrets.h` in the same folder and enter your 2.4 GHz Wi-Fi credentials there. `secrets.h` is excluded from Git; without it, the ESP32 starts its fallback access point. Never commit real Wi-Fi credentials.

### 3. Get the AI response
* In the **Telemetry** tab, select **Start Session**, collect at least 10 seconds of readings, then select **Stop**.
* The **Groq AI Physiological Response Assistant** below the live charts becomes available when the completed session contains enough valid pulse data. GSR calibration is not required for the pulse-based summary. Select **Request AI Interpretation**; the observation, suggestion, and cautions appear in that same panel. The backend uses Groq when configured, then Gemini or the local rule engine as fallback.
* The AI receives only the completed session summary, not raw sensor waveforms. This is an educational prototype, not a medical device.

### 4. Flash ESP32 Firmware
* **Using PlatformIO:**
  ```bash
  pio run -t upload
  pio device monitor -b 115200
  ```
* **Using Arduino IDE:**
  Open `firmware/sentinel/sentinel.ino`, select `DOIT ESP32 DEVKIT V1`, and click Upload.

---

## Documentation Index

* [`docs/ASSEMBLE.md`](docs/ASSEMBLE.md): 18-step beginner assembly manual.
* [`docs/WIRING.md`](docs/WIRING.md): Pin mapping, voltage safety, and board variant details.
* [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): System architecture, failure boundaries, and data flow.
* [`docs/PROTOCOL.md`](docs/PROTOCOL.md): Schema Version 1 JSON telemetry specification.
* [`docs/CALIBRATION.md`](docs/CALIBRATION.md): 15-second baseline calibration procedures.
* [`docs/SIGNAL_PROCESSING.md`](docs/SIGNAL_PROCESSING.md): DSP algorithms, mathematical formulations, and filter parameters.
* [`docs/AI_INTEGRATION.md`](docs/AI_INTEGRATION.md): Groq API configuration, system prompts, and privacy safeguards.
* [`docs/SAFETY.md`](docs/SAFETY.md): Electrical isolation, body-contact precautions, and non-medical disclaimers.
* [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md): Diagnostic matrix for 19 common failure modes.
* [`docs/TESTING.md`](docs/TESTING.md): Formal test plans and acceptance criteria.
* [`docs/BOM.md`](docs/BOM.md): Complete Bill of Materials for ₹0 added spend.
* [`docs/FAQ.md`](docs/FAQ.md): Viva examination questions, answers, and 3-minute presentation script.

# SENTINEL-2.0

 ab0d38edba02d301d7490ee2ce1691ecb348e7d2
