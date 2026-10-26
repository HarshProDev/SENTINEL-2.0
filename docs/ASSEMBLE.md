# SENTINEL 2.0 - Complete Step-by-Step Assembly Manual

This guide walks a beginner-to-intermediate student through assembling, testing, flashing, and running the complete SENTINEL 2.0 system from scratch without purchasing unnecessary hardware.

---

## Stage 1: Component Identification & Inventory

1. **ESP32 Development Board:** Look at the metal shield on your board. Check whether it reads `ESP-WROOM-32`, `ESP32-S3`, or `ESP32-C3`. Count the pins (typically 30 or 38 pins).
2. **Pulse Sensor:** Look for the small green circular PCB with a heart logo on the front and a photodiode/LED in the center. Identify the 3 leads: `S` (Signal), `+` (VCC / 3.3V), and `-` (GND).
3. **GSR Skin Conductance Sensor:** An amplifier PCB with a 2-finger Velcro strap harness and a 3-pin output cable labeled `SIG`, `VCC`, `GND`.
4. **SSD1306 OLED Display:** 0.96 inch 128×64 matrix with 4 I2C header pins: `GND`, `VCC`, `SCL`, `SDA`.
5. **Breadboard & Jumper Wires:** Standard half-size or full-size solderless breadboard and male-to-male or male-to-female jumper wires.
6. **Micro-USB or USB-C Cable:** Must support data transfer, not charge-only.

---

## Stage 2: Individual Module Testing & Verification

Never wire all components simultaneously at first! Follow these progressive verification milestones:

### Step 1: ESP32 Board Detection & Blinking
1. Plug the ESP32 into your laptop USB port.
2. In Arduino IDE or PlatformIO, open Tools -> Port and confirm the device is assigned a COM port (Windows) or `/dev/ttyUSB0` / `/dev/cu.usbserial` (Linux/macOS).
3. Upload a standard Blink sketch targeting GPIO 2. Verify the blue LED blinks.

### Step 2: Standalone OLED Display Check
1. Connect only the OLED:
   * OLED `VCC` -> ESP32 `3V3`
   * OLED `GND` -> ESP32 `GND`
   * OLED `SDA` -> ESP32 `GPIO 21`
   * OLED `SCL` -> ESP32 `GPIO 22`
2. Run an I2C Scanner sketch. Verify that address `0x3C` appears in the Serial Monitor. If no address responds, check for swapped SDA/SCL lines.

### Step 3: Standalone Pulse Sensor Check
1. Keep the OLED connected and connect the Pulse Sensor:
   * Pulse `+` -> ESP32 `3V3`
   * Pulse `-` -> ESP32 `GND`
   * Pulse `S` -> ESP32 `GPIO 34`
2. Upload a minimal analog read sketch: `Serial.println(analogRead(34)); delay(20);`.
3. Open Arduino Serial Plotter (Tools -> Serial Plotter) at 115200 baud.
4. Place your fingertip gently over the sensor without pressing too hard. You should see rhythmic systolic peaks oscillating around mid-scale (~1800 - 2400 counts).

### Step 4: Standalone GSR Sensor Check
1. Connect the GSR module:
   * GSR `VCC` -> ESP32 `3V3`
   * GSR `GND` -> ESP32 `GND`
   * GSR `SIG` -> ESP32 `GPIO 35`
2. Attach the two Velcro straps to your middle and index fingers.
3. Observe raw ADC counts on GPIO 35. With dry skin, values typically float around 1000 - 2000. Squeezing or moistening the fingers should cause a discernible change.

---

## Stage 3: Firmware Compilation & Flashing

### Using Arduino IDE:
1. Install the ESP32 board package:
   * In File -> Preferences, add `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json` to Additional Board Manager URLs.
   * Go to Tools -> Board -> Board Manager, search for `esp32` by Espressif Systems, and install version `2.0.14` or `3.0.x`.
2. Install required libraries via Tools -> Manage Libraries:
   * `Adafruit SSD1306` (by Adafruit)
   * `Adafruit GFX Library` (by Adafruit)
   * `ArduinoJson` (by Benoit Blanchon, version 7.x)
3. Open `firmware/sentinel/sentinel.ino`.
4. In `firmware/sentinel/config.h`, set your local Wi-Fi credentials (`WIFI_SSID` and `WIFI_PASSWORD`), or leave them blank to use automatic SoftAP mode.
5. Select Board: `DOIT ESP32 DEVKIT V1` (or your exact variant) and your COM port.
6. Click **Upload**.

### Using PlatformIO:
```bash
# In the project directory:
pio run -t upload
pio device monitor -b 115200
```

---

## Stage 4: Starting the Web Dashboard & Local Backend

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Start the local server & dashboard:**
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:3000`.

3. **Configure Groq AI (Optional for AI insights):**
   * Get a free API key from [Groq Cloud Console](https://console.groq.com/).
   * Create or update `.env` in the project root:
     ```env
     GROQ_API_KEY="gsk_your_actual_groq_api_key_here"
     GROQ_MODEL="llama-3.3-70b-versatile"
     PORT=3000
     ```
   * *Note:* If no Groq API key is supplied, SENTINEL 2.0 automatically uses the built-in deterministic heuristic rule engine, ensuring 100% functionality without spending a rupee!

---

## Stage 5: Conducting a Real-Time Monitoring Session

1. **Verify Connection:**
   * Look at the ESP32 OLED screen. It displays the assigned IP address (e.g. `192.168.1.105` or `192.168.4.1` in SoftAP mode).
   * In the web dashboard header, enter the ESP32 IP address or select "Connect Device".
2. **Mount Sensors:**
   * Fasten the Pulse Sensor to the index finger of your non-dominant hand using gentle elastic or tape. Do not apply excessive pressure (which occludes capillary blood flow).
   * Fasten the GSR Velcro rings to the palmar side of the adjacent fingers.
3. **Resting Baseline Calibration:**
   * Click **Start 15s Baseline Calibration** in the dashboard.
   * Sit comfortably with your hand resting flat on the desk. Breathe normally without talking.
   * Once calibration finishes, your resting GSR baseline is saved.
4. **Recording Session:**
   * Click **Start Session**.
   * Observe the live PPG waveform oscilloscope, real-time BPM, and GSR relative shift graph.
   * Click **Request AI Interpretation** to receive cautious wellness observations.
   * Click **Export CSV** to save raw data for reports or lab analysis.
