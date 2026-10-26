# SENTINEL 2.0 - Telemetry & Communication Protocol

**Protocol Version:** Schema 1.0  
**Transport:** HTTP REST polling (`GET /api/live`; controls via `POST /api/calibrate` and `POST /api/calibrate/reset`)  
**Data Format:** JSON (Strict UTF-8)

---

## 1. Schema Definition (Version 1)

Every telemetry packet emitted by the ESP32 firmware adheres to the following JSON structure:

```json
{
  "schemaVersion": 1,
  "deviceId": "sentinel-esp32-01",
  "deviceTimestampMs": 142050,
  "sequence": 1420,
  "pulse": {
    "rawAdc": 2185,
    "bpm": 74,
    "ibiMs": 810,
    "valid": true,
    "quality": "VALID",
    "confidence": 85,
    "beatDetected": false,
    "consecutiveValidBeats": 6
  },
  "gsr": {
    "rawAdc": 1420,
    "smoothedAdc": 1418.5,
    "baselineAdc": 1395.0,
    "relativeChange": 1.7,
    "valid": true,
    "quality": "VALID",
    "trend": "STABLE"
  },
  "system": {
    "wifiConnected": true,
    "ipAddress": "192.168.1.105",
    "calibrating": false,
    "calibrationProgress": 0,
    "errorCode": null,
    "sampleRateHz": 100
  }
}
```

---

## 2. Field Dictionary & Value Ranges

### Root Level
| Field | Type | Description |
| :--- | :--- | :--- |
| `schemaVersion` | `integer` | Must equal `1`. Packets with unsupported versions are discarded. |
| `deviceId` | `string` | Unique hardware identifier for the acquisition node. |
| `deviceTimestampMs`| `integer` | Monotonic hardware uptime in milliseconds from ESP32 `millis()`. |
| `sequence` | `integer` | Monotonically incrementing sequence counter. Used to detect packet loss and discard out-of-order stale packets. |

### Pulse Object (`pulse`)
| Field | Type | Unit / Values | Description |
| :--- | :--- | :--- | :--- |
| `rawAdc` | `integer` | `0` to `4095` | Raw 12-bit ADC reading from GPIO 34. |
| `bpm` | `integer \| null` | `30` to `200` | Current Heart Rate in beats per minute. `null` when signal quality is unvalidated. |
| `ibiMs` | `integer \| null` | `300` to `2000` ms | Inter-Beat Interval in milliseconds between last two valid systolic peaks. |
| `valid` | `boolean` | `true \| false` | `true` only when consecutive valid beats criteria is satisfied. |
| `quality` | `string` | `DISCONNECTED`, `INITIALIZING`, `CALIBRATING`, `VALID`, `LOW_QUALITY`, `STALE`, `ERROR` | Categorical signal quality indicator. |
| `confidence` | `integer` | `0` to `100` % | Confidence score based on signal-to-noise ratio and interval stability. |
| `beatDetected` | `boolean` | `true \| false` | Pulsed high for exactly one sample cycle upon systolic peak confirmation. |
| `consecutiveValidBeats` | `integer` | `>= 0` | Current count of consecutively accepted physiological beats. |

### GSR Object (`gsr`)
| Field | Type | Unit / Values | Description |
| :--- | :--- | :--- | :--- |
| `rawAdc` | `integer` | `0` to `4095` | Raw 12-bit ADC reading from GPIO 35. |
| `smoothedAdc` | `float \| null` | `0.0` to `4095.0` | Exponential moving average filtered conductance reading; `null` when the input is invalid. |
| `baselineAdc` | `float \| null` | `0.0` to `4095.0` | Calibrated resting baseline reference; `null` until calibration completes. |
| `relativeChange` | `float \| null` | `%` | Percentage shift from a valid calibrated baseline; `null` until both the reading and baseline are valid. |
| `valid` | `boolean` | `true \| false` | `false` if sensor leads are disconnected or saturated. |
| `quality` | `string` | Categorical quality string matching pulse quality enum. |
| `trend` | `string` | `STABLE`, `RISING`, `FALLING`, `INDETERMINATE` | Directional skin conductance response trend; remains `INDETERMINATE` before calibration. |

Calibration errors are reported in `system.errorCode` as `GSR_CALIBRATION_SENSOR_DISCONNECTED` or `GSR_CALIBRATION_MOTION_DETECTED`.

---

## 3. Disconnected & Low-Quality State Example

When sensors are disconnected or finger contact is lost, the device outputs honest unvalidated states rather than fabricated numbers. BPM and unavailable GSR values are `null`; GSR percentage change and baseline-relative trend values remain unavailable until a successful calibration:

```json
{
  "schemaVersion": 1,
  "deviceId": "sentinel-esp32-01",
  "deviceTimestampMs": 20450,
  "sequence": 204,
  "pulse": {
    "rawAdc": 2,
    "bpm": null,
    "ibiMs": null,
    "valid": false,
    "quality": "DISCONNECTED",
    "confidence": 0,
    "beatDetected": false,
    "consecutiveValidBeats": 0
  },
  "gsr": {
    "rawAdc": 5,
    "smoothedAdc": null,
    "baselineAdc": null,
    "relativeChange": null,
    "valid": false,
    "quality": "DISCONNECTED",
    "trend": "INDETERMINATE"
  },
  "system": {
    "wifiConnected": true,
    "calibrating": false,
    "errorCode": "PULSE_OPEN_CIRCUIT",
    "sampleRateHz": 100
  }
}
```
