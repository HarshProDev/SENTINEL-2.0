# SENTINEL 2.0 - Biometric Calibration Specification

## 1. Why Personal Calibration is Essential

Galvanic Skin Response (GSR) and photoplethysmogram (PPG) amplitude vary significantly between individuals due to skin hydration, epidermal thickness, ambient temperature, capillary depth, and electrode surface area.
**There is no universal constant for skin resistance or optical reflectance.**
Therefore, SENTINEL 2.0 enforces a dedicated **Resting Baseline Calibration** phase before any comparative session or trend analysis.

---

## 2. Standard 15-Second Calibration Protocol

1. **Environmental Setup:**
   * Room temperature ideally between 20°C - 25°C.
   * Participant seated comfortably with arms resting flat on a table.
   * Hands clean and dry (no lotion or hand sanitizer applied within 10 minutes).
2. **Sensor Attachment:**
   * Attach the pulse sensor to the fleshy pad of the non-dominant index finger.
   * Fasten GSR Velcro rings to the proximal phalanges of the middle and ring fingers.
   * Wait 60 seconds after attachment for thermal equilibrium between skin and electrodes.
3. **Triggering Calibration:**
   * In the Web Dashboard, click **Start 15s Baseline Calibration** (or send serial command `'c'`).
   * The ESP32 enters `CALIBRATING` state, signaled on both the OLED screen and web dashboard.
4. **Acceptance Criteria:**
   * 1,500 consecutive valid raw samples collected at 100Hz, taking 15 seconds.
   * The standard deviation must not exceed 150 ADC counts.
   * If the sensor becomes disconnected or the standard deviation exceeds this limit, calibration aborts with `GSR_CALIBRATION_SENSOR_DISCONNECTED` or `GSR_CALIBRATION_MOTION_DETECTED`.
5. **Baseline Calculation:**
   * The system computes the **median value** of the 1,500 calibration samples. The median is chosen over the arithmetic mean because it is inherently resistant to isolated sample glitches.
   * The resulting baseline ADC count (e.g., `1420.0`) is stored in volatile memory as the personal reference $R_{baseline}$.

If calibration is rejected, correct the sensor connection or remain still and start a new calibration. A baseline is not assumed before calibration, and percentage changes are withheld until a baseline has been established.

---

## 3. Interpreting Baseline-Relative Deflections

Once $R_{baseline}$ is locked:
$$\Delta \text{GSR}_{\%} = \left( \frac{\text{Smoothed ADC} - R_{baseline}}{R_{baseline}} \right) \times 100$$

* **$\Delta \text{GSR} \in [-5\%, +5\%]$:** Stable autonomic tone (Resting state).
* **$\Delta \text{GSR} > +10\%$:** Significant increase in skin conductance (elevated sweat gland micro-activity, cognitive engagement, arousal, or temperature increase).
* **$\Delta \text{GSR} < -10\%$:** Significant decrease in conductance (relaxation or drying).

> **Important Limitation:** An increase in skin conductance does **not** uniquely indicate psychological stress. Laughter, a deep breath, room heating, or physical movement also produce transient conductance surges.
