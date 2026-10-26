# SENTINEL 2.0 - Viva Examination Q&A & Presentation Guide

## 1. Core Technical Viva Questions

### Q1: Why did you choose GPIO 34 and GPIO 35 for your analog sensors on the ESP32?
**Answer:** The ESP32 features two internal analog-to-digital converters: ADC1 and ADC2. A critical hardware architectural constraint of the ESP32 is that ADC2 channels are tightly coupled to the Wi-Fi baseband driver; whenever the Wi-Fi radio is active or transmitting, ADC2 reads are blocked or return corrupted data. GPIO 34 and GPIO 35 belong to ADC1 (Channels 6 and 7), which operate entirely independently of the Wi-Fi subsystem. Furthermore, GPIO 34 and 35 are dedicated input-only pins without internal pull-up/pull-down resistors, ensuring an uncorrupted high-impedance analog input path.

### Q2: How does your pulse detection algorithm prevent counting the dicrotic notch or motion artifacts as heartbeats?
**Answer:** Optical photoplethysmogram (PPG) waves often display a secondary peak known as the dicrotic notch, caused by aortic valve closure. If simple threshold crossings were used, the heart rate would falsely double. Our DSP pipeline implements two defenses:
1. **Dynamic Adaptive Threshold:** The threshold is continuously calibrated to 45% of the rolling peak-to-peak amplitude.
2. **Physiological Refractory Period (320ms Gate):** Following every confirmed systolic peak, the algorithm enters an absolute refractory lockout window of 320ms (equivalent to ~187 BPM). Any secondary waves or dicrotic notches occurring within this window are discarded. Furthermore, we require 4 consecutive rhythmically coherent beats before publishing a trusted BPM.

### Q3: Why does SENTINEL measure "baseline-relative GSR change" instead of raw microsiemens (µS)?
**Answer:** Converting raw ADC voltage into absolute conductance (microsiemens) requires precision laboratory characterization of the operational amplifier gain, exact skin-electrode contact area, and reference resistor tolerance. In a low-cost educational setup, absolute resistance varies drastically based on finger pressure, skin thickness, and room humidity. Therefore, biomedical literature recommends measuring relative autonomic phasic response against a calibrated personal baseline ($R_{baseline}$). Reporting relative percentage shift ($\Delta \text{GSR}_{\%}$) is honest, scientifically defensible, and robust against baseline drift.

### Q4: How is data privacy ensured with the Groq AI integration?
**Answer:** We enforce strict data minimization:
1. Continuous 100Hz raw waveform data never leaves the client or local network.
2. Only mathematically summarized parameters (duration, average BPM, stability, GSR trend, and data validity percentage) are forwarded when the user requests interpretation.
3. The Groq API key is stored strictly on the server in `.env` and is never exposed to the client or firmware.

---

## 2. 3-Minute Project Presentation Script

> "Good morning, respected examiners. Today we present **SENTINEL 2.0**: a real-time IoT and AI physiological response monitoring system designed with a strict ₹0 extra hardware target.
> 
> Modern student biomedical projects often suffer from two major flaws: they either display noisy, fabricated biometric values with simple threshold counting, or they make unscientific claims of diagnosing medical conditions or reading emotions from raw sensors.
>
> SENTINEL 2.0 solves this by bridging robust embedded DSP, defensive software architecture, and cautious AI interpretation:
> 1. At the embedded level, an ESP32 samples optical pulse and galvanic skin response signals at a stable 100Hz non-blocking interval. Our algorithm implements DC baseline removal, noise suppression, adaptive peak thresholding, and a 320ms physiological refractory gate to reject motion artifacts and dicrotic notches. Heart rate is only published once 4 consecutive coherent beats are validated.
> 2. For GSR, the system provides a guided 15-second baseline calibration and tracks relative phasic response rather than making unsupported claims of absolute conductance.
> 3. An onboard SSD1306 OLED displays honest states—explicitly indicating 'SEARCHING', 'CALIBRATING', or 'DISCONNECTED' rather than showing fake zeroes.
> 4. Telemetry is streamed over Wi-Fi via a versioned Schema v1 JSON protocol to a modern scientific web dashboard equipped with real-time oscilloscopes, session tracking, and CSV export.
> 5. Finally, through a secure Node.js backend proxy, the system integrates Groq AI to generate cautious, non-diagnostic wellness observations, complete with automatic failover to local rule-based heuristics if the network is unavailable.
>
> In conclusion, SENTINEL 2.0 demonstrates that high-quality, professional, and ethical IoT health monitoring can be built reliably using existing starter-kit hardware without added cost. Thank you."
