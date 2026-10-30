# SENTINEL 2.0 - Hardware Wiring & Pin Mapping Specification

## 1. Critical Hardware Verification Rule & Safety Notice

> **CRITICAL ESP32 ADC CONFLICT WARNING (ADC1 vs ADC2):**
> On classic ESP32 boards (ESP-WROOM-32 / ESP32-DevKitC), **ADC2 pins CANNOT be sampled when the Wi-Fi or Bluetooth radio is active.**
> ADC2 pins include: `GPIO 0, 2, 4, 12, 13, 14, 15, 25, 26, 27`.
> If you connect an analog sensor to an ADC2 pin, the reading will freeze, peg to 4095, or crash the Wi-Fi stack.
> **Therefore, analog biometric sensors MUST BE CONNECTED TO ADC1 PINS ONLY.**
>
> **Recommended ADC1 Pins:**
> - `GPIO 34` (ADC1_CH6) — Input only, no pull-up resistor. **Assigned to Pulse Sensor.**
> - `GPIO 35` (ADC1_CH7) — Input only, no pull-up resistor. **Assigned to GSR Sensor.**
> - Alternative ADC1 pins: `GPIO 32, 33, 36 (VP), 39 (VN)`.

---

## 2. Voltage Levels and Power Constraints

* **ESP32 Logic Level:** 3.3V. The ESP32 GPIOs and ADC are **NOT 5V tolerant**. Exceeding 3.6V on any GPIO pin can permanently damage the ESP32 silicon.
* **Sensor Operating Voltages:**
  * **Pulse Sensor (World Famous / KY-039 / Optical Reflex):** Operates reliably on **3.3V (VCC)**. Powering it from 3.3V ensures the analog signal output naturally stays between 0.0V and 3.3V, safely matching the ESP32 ADC range without needing a resistor voltage divider.
  * **GSR Module (Seeed Studio / Keyestudio / DIY Divider):** Most student GSR modules support 3.3V to 5.0V input. **Always power from 3.3V pin**, not 5V / VIN!
  * **OLED Display (0.96" I2C SSD1306):** Connect VCC to **3.3V** pin. Most modules have an onboard 3.3V LDO regulator and work smoothly at 3.3V I2C logic.

---

## 3. Master Provisional Wiring Table

| Component | Module Pin | ESP32 Pin | Signal Type | Electrical / Safety Notes | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pulse Sensor** | VCC | 3V3 (Pin 1) | Power (3.3V) | Must use 3.3V rail to protect ADC | Safe / Provisional |
| **Pulse Sensor** | GND | GND | Ground | Common system ground required | Safe / Verified |
| **Pulse Sensor** | Signal (S / OUT) | **GPIO 34** | Analog Input | ADC1 Channel 6 (Wi-Fi safe, input-only) | Safe / Verified |
| **GSR Module** | VCC | 3V3 (Pin 1) | Power (3.3V) | Do NOT connect to 5V / VIN rail | Safe / Provisional |
| **GSR Module** | GND | GND | Ground | Common system ground | Safe / Verified |
| **GSR Module** | Signal (SIG) | **GPIO 35** | Analog Input | ADC1 Channel 7 (Wi-Fi safe, input-only) | Safe / Verified |
| **SSD1306 OLED** | VDD / VCC | 3V3 | Power (3.3V) | Current draw < 25mA | Safe / Verified |
| **SSD1306 OLED** | GND | GND | Ground | Common ground | Safe / Verified |
| **SSD1306 OLED** | SCL | **GPIO 22** | I2C Clock | ESP32 default hardware I2C SCL | Safe / Verified |
| **SSD1306 OLED** | SDA | **GPIO 21** | I2C Data | ESP32 default hardware I2C SDA | Safe / Verified |
| **Status LED** | Anode (+) | GPIO 2 | Digital Output | Built-in LED on ESP32 DevKit; external requires 220Ω resistor | Safe / Optional |

---

## 4. Alternative Board Variants Pin Mapping

### Variant A: ESP32-S3 (e.g. ESP32-S3-DevKitC-1)
* Pulse Sensor Signal: `GPIO 4` (ADC1_CH3)
* GSR Sensor Signal: `GPIO 5` (ADC1_CH4)
* I2C SDA: `GPIO 8`
* I2C SCL: `GPIO 9`

### Variant B: ESP32-C3 (e.g. ESP32-C3-DevKitM-1)
* Pulse Sensor Signal: `GPIO 0` (ADC1_CH0)
* GSR Sensor Signal: `GPIO 1` (ADC1_CH1)
* I2C SDA: `GPIO 4`
* I2C SCL: `GPIO 5`

---

## 5. Circuit Architecture Diagram

'@public/SENTINEL v2.0.jpeg'


---

## 6. Pre-Power Safety Checklist (STOP & VERIFY)

Before plugging the USB cable into your laptop, verify each of these items with your eyes and a multimeter if available:
1. [ ] **No 5V to ADC Pins:** Confirm that neither sensor signal line is plugged into 5V or VIN.
2. [ ] **Common Ground:** All GND pins (ESP32, Pulse Sensor, GSR Module, OLED) share a continuous ground plane on the breadboard.
3. [ ] **No Short Circuits:** Check with continuity tester between 3V3 rail and GND rail. It must show open circuit (resistance > 10kΩ).
4. [ ] **Physical Isolation:** When testing on human skin, the ESP32 must be powered **only via a certified laptop running on battery power or an isolated USB power bank**. Never connect electrodes while plugged into ungrounded desktop equipment or mains-coupled chargers.
