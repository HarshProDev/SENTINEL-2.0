# SENTINEL 2.0 - Bill of Materials (BOM) & Zero-Cost Strategy

## 1. Targeted Zero-Cost Hardware Strategy (₹0 Extra Spend)

SENTINEL 2.0 is specifically engineered to utilize the components students typically already own in their robotics/microcontroller starter kits:

| Item | Description | Typical Lab / Kit Source | Cost to Student |
| :--- | :--- | :--- | :--- |
| **ESP32 DevKit V1** | 30-pin or 38-pin ESP-WROOM-32 board with Wi-Fi & Bluetooth | Existing kit / College lab stock | ₹0 (Assumed available) |
| **Optical Pulse Sensor** | Photodiode + Green LED module (World Famous Pulse Sensor or KY-039) | Biometric sensor kit or lab inventory | ₹0 (Assumed available) |
| **GSR Sensor Module** | Two-finger skin conductance electrodes with signal conditioning board | Biomedical lab or student starter kit | ₹0 (Assumed available) |
| **0.96" SSD1306 OLED** | 128x64 I2C monochrome display (Blue/White/Yellow-Blue) | Display kit / robotics kit | ₹0 (Assumed available) |
| **Breadboard & Wires** | Solderless breadboard + 8-10 jumper wires | Standard hobby kit | ₹0 (Assumed available) |
| **USB Data Cable** | Micro-USB or Type-C (matches ESP32 port) | Laptop accessory | ₹0 (Assumed available) |
| **Laptop / PC** | Runs browser dashboard & Node.js backend | Personal laptop | ₹0 (Assumed available) |
| **Groq API Access** | Free-tier cloud API for Llama 3 models | Free signup on `console.groq.com` | ₹0 (Free tier) |
| **Total Added Cost** | | | **₹0.00** |

---

## 2. Optional Component Extensions (Future Scope)

The following components may be in your starter box but are **strictly excluded from the critical signal path** to preserve signal purity and timing:
* **Servo Motors / Ultrasonic Sensors:** Can be attached in an extended phase for ambient alerts or posture feedback, but do NOT wire them to the ADC1 lines or share power rails with analog sensors.
* **Arduino Uno Boards:** Can serve as standalone serial monitors or auxiliary displays if needed, but the ESP32 handles all DSP and networking autonomously.
