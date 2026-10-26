/**
 * SENTINEL 2.0 - Hardware Configuration & Pin Mapping
 *
 * CRITICAL HARDWARE SAFETY NOTICE:
 * On classic ESP32 (ESP-WROOM-32), ADC2 pins (GPIO 0, 2, 4, 12-15, 25-27)
 * CANNOT be read when Wi-Fi is actively transmitting.
 * We MUST connect analog sensors to ADC1 channels (GPIO 32, 33, 34, 35, 36, 39).
 * Note: GPIO 34, 35, 36, 39 are input-only pins with no internal pull-ups,
 * making them ideal pure analog inputs.
 */

#ifndef SENTINEL_CONFIG_H
#define SENTINEL_CONFIG_H

#include <Arduino.h>

// Optional local Wi-Fi settings. Keep secrets.h out of version control.
#if __has_include("secrets.h")
#include "secrets.h"
#endif

#ifndef WIFI_SSID
#define WIFI_SSID ""
#endif

#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD ""
#endif

// ==========================================
// 1. PIN ASSIGNMENTS (ESP32 Classic DevKit)
// ==========================================
// Analog Pulse Sensor (e.g. KY-039 or World Famous Pulse Sensor)
// Signal -> ESP32 GPIO 34 (ADC1 Channel 6)
#define PIN_PULSE_ADC 34

// Analog Galvanic Skin Response (GSR) Module
// Signal -> ESP32 GPIO 35 (ADC1 Channel 7)
#define PIN_GSR_ADC 35

// I2C OLED Display (SSD1306 128x64)
#define PIN_I2C_SDA 21
#define PIN_I2C_SCL 22
#define OLED_I2C_ADDR 0x3C // Default is 0x3C; change to 0x3D if jumper modified
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

// Status Indicator LED (Optional, defaults to onboard LED GPIO 2)
#define PIN_STATUS_LED 2

// ==========================================
// 2. SAMPLING & SIGNAL CONSTANTS
// ==========================================
#define SAMPLE_RATE_HZ 100 // 100Hz acquisition = 10ms sampling interval
#define SAMPLE_INTERVAL_MICROS (1000000 / SAMPLE_RATE_HZ)

// Pulse signal limits
#define PULSE_REFRACTORY_MS 320      // Minimum 320ms between peaks (max ~187 BPM)
#define PULSE_MIN_IBI_MS 300         // Absolute floor (200 BPM)
#define PULSE_MAX_IBI_MS 2000        // Absolute ceiling (30 BPM)
#define PULSE_REQUIRED_CONSECUTIVE 4 // Must see 4 regular beats before trusting BPM
#define PULSE_MIN_PEAK_AMPLITUDE 8   // Filtered ADC threshold for low-amplitude PPG sensors
#define PULSE_DISCONNECTED_LOW 15    // Raw ADC < 15 means open circuit or floating low
#define PULSE_DISCONNECTED_HIGH 4080 // Raw ADC > 4080 means saturated or shorted

// GSR signal limits
#define GSR_SMOOTHING_ALPHA 0.10f   // Low-pass filter coefficient (0.0 to 1.0)
#define GSR_CALIBRATION_SAMPLES 1500 // 15 seconds at the 100Hz acquisition rate
#define GSR_CALIBRATION_MAX_STDDEV 150.0f
#define GSR_MIN_VALID_ADC 25
#define GSR_MAX_VALID_ADC 4070

// ==========================================
// 3. TELEMETRY & NETWORK CONFIGURATION
// ==========================================
#define SCHEMA_VERSION 1
#define DEVICE_ID "sentinel-esp32-01"

// Wi-Fi Mode: Set to false to create local Access Point "SENTINEL-AP" (₹0 router requirement!)
#define USE_STATION_MODE true

// SoftAP Mode Credentials (if hotspot is unavailable)
#define AP_SSID "SENTINEL-2-AP"
#define AP_PASSWORD "sentinel123"

// Telemetry Broadcast Interval (ms)
#define TELEMETRY_INTERVAL_MS 100 // Stream 10 telemetry packets per second over WebSockets / HTTP

#endif // SENTINEL_CONFIG_H
