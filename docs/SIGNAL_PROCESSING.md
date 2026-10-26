# SENTINEL 2.0 - Signal Acquisition & Digital Signal Processing (DSP)

## 1. Optical PPG Pulse Detection Pipeline

```
Raw ADC (12-bit, 0-4095 @ 100Hz)
       |
       v
[Boundary & Disconnection Guard]  ---> If ADC < 15 or > 4080: Flag DISCONNECTED
       |
       v
[DC Baseline Removal]             ---> Low-pass filter (α = 0.02) tracks slow drift
       |                               acSignal = rawAdc - dcBaseline
       v
[AC Smoothing Filter]             ---> Low-pass filter (α = 0.35) removes 50Hz/60Hz noise
       |
       v
[Adaptive Peak Thresholding]       ---> Dynamic threshold = max(8, 45% of rolling peak amp)
       |
       v
[Refractory Period Gate]          ---> Ignore crossings if Δt < 320ms (max 187 BPM)
       |
       v
[Peak Confirmation & IBI Check]   ---> Verify IBI ∈ [300ms, 2000ms] & ΔIBI jitter < 35%
       |
       v
[Consecutive Valid Beats Gate]    ---> Require >= 4 valid beats before outputting trusted BPM
       |
       v
[Recovery / Timeout Reset]         ---> Re-anchor after a rejected interval or >2.5s signal loss
```

### Key Mathematical Formulations:

1. **DC Baseline Tracking:**
   $$\text{Baseline}_t = \text{Baseline}_{t-1} \cdot (1 - \alpha_{dc}) + \text{ADC}_t \cdot \alpha_{dc} \quad (\alpha_{dc} = 0.02)$$

2. **AC Bandpass Smoothing:**
   $$\text{Signal}_t = \text{Signal}_{t-1} \cdot (1 - \alpha_{ac}) + (\text{ADC}_t - \text{Baseline}_t) \cdot \alpha_{ac} \quad (\alpha_{ac} = 0.35)$$

3. **Inter-Beat Interval (IBI) to Heart Rate:**
   $$\text{BPM} = \text{round}\left( \frac{60000}{\text{mean}(\text{IBI}_{last\,5})} \right)$$

4. **Physiological Refractory Period:**
   Human ventricular depolarization and repolarization impose an absolute physical limit on heart rate. Under resting or light cognitive conditions, intervals shorter than 320ms (< 187 BPM) are considered electrical noise, motion spikes, or premature contractions and are rejected.

   The DC baseline is initialized from the first in-range ADC sample rather than assuming the sensor sits at ADC midpoint 2048. This accommodates pulse modules with different output bias. The low threshold supports small PPG excursions; beat timing, IBI bounds, and the consecutive-beat gate still reject unstable estimates. A weak or noisy waveform may remain unvalidated rather than produce a reliable BPM.
   When an interval is rejected or the signal disappears for 2.5 seconds, the processor clears
   the old beat-time reference and waits for a fresh sequence. This allows it to reacquire a pulse
   after contact is restored or heart rate changes, instead of comparing every new beat against
   an obsolete timestamp.

---

## 2. Galvanic Skin Response (GSR) Pipeline

Skin conductance response (SCR) reflects sympathetic autonomic activity through eccrine sweat glands. In the hardware domain, the module consists of an operational amplifier measuring the voltage divider formed by skin resistance $R_{skin}$ and a reference resistor $R_{ref}$:

$$V_{out} = V_{cc} \cdot \frac{R_{ref}}{R_{skin} + R_{ref}}$$

When skin conductance increases (e.g., arousal or perspiration), $R_{skin}$ decreases, causing $V_{out}$ to rise toward $V_{cc}$.

### Exponential Moving Average (EMA) Smoothing:
$$\text{Smoothed}_t = \text{Smoothed}_{t-1} \cdot (1 - \alpha) + \text{Raw}_t \cdot \alpha \quad (\alpha = 0.10)$$

This suppresses high-frequency muscle tremor and cable sway while preserving the characteristic tonic drift and phasic responses.
