/**
 * SENTINEL 2.0 - Real-Time Physiological Response Monitoring
 * Master ESP32 Firmware
 * 
 * Target: ESP32 Development Board (ESP-WROOM-32 / ESP32-S3 / ESP32-C3)
 * Framework: Arduino C/C++
 * 
 * Features:
 * - 100Hz Hardware-timed non-blocking analog sampling
 * - Photoplethysmogram (PPG) beat detection with physiological refractory window
 * - Galvanic Skin Response (GSR) smoothing and baseline calibration
 * - SSD1306 128x64 OLED live HUD
 * - Embedded WebServer serving Schema v1 JSON telemetry & control APIs
 * - Fallback SoftAP mode for 100% offline ₹0 hardware operation
 * - Diagnostic Serial Monitor & Serial Plotter telemetry stream
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include "config.h"
#include "pulse_processor.h"
#include "gsr_processor.h"
#include "oled_ui.h"
#include "data_protocol.h"

// System instances
PulseProcessor pulseProcessor;
GsrProcessor gsrProcessor;
OledUI oled;
DataProtocol protocol;
WebServer server(80);

// Global state
unsigned long lastSampleMicros = 0;
unsigned long lastTelemetryMillis = 0;
unsigned long lastOledMillis = 0;
unsigned long lastHeartbeatMillis = 0;
unsigned long wifiDisconnectedAt = 0;
unsigned long lastWifiReconnectAttempt = 0;
unsigned long wifiReconnectDelayMs = 5000;

PulseResult latestPulse;
GsrResult latestGsr;
char jsonTelemetryBuffer[1024];
bool serialPlotterMode = false;
bool softApActive = false;
String currentIpAddress = "";

// Forward declarations
void handleRoot();
void handleGetLive();
void handleCalibrate();
void handleResetCalibration();
void handleStatus();
void handleNotFound();
void checkSerialCommands();
bool isNetworkAvailable();

void setup() {
    Serial.begin(115200);
    delay(200);
    Serial.println();
    Serial.println(F("=================================================="));
    Serial.println(F("   SENTINEL 2.0 - Biometric Acquisition System   "));
    Serial.println(F("   Hardware Target: ESP32 (ADC1 Ch6/7, I2C 21/22)  "));
    Serial.println(F("=================================================="));

    // Configure status LED
    pinMode(PIN_STATUS_LED, OUTPUT);
    digitalWrite(PIN_STATUS_LED, LOW);

    // Configure ADC on ESP32
    // 12-bit resolution: values 0 to 4095
    analogReadResolution(12);
    // ADC_11db attenuation allows full 0 - ~3.1V voltage measurement range
    analogSetAttenuation(ADC_11db);

    // Initialize OLED Display
    if (oled.begin()) {
        oled.showBootScreen("2.0.0");
        Serial.println(F("[OLED] SSD1306 initialized successfully."));
    } else {
        Serial.println(F("[OLED] WARNING: SSD1306 not detected at 0x3C! Check wiring."));
    }

    // Initialize Network (Station mode with SoftAP fallback)
    bool wifiOk = false;
    if (USE_STATION_MODE && strlen(WIFI_SSID) > 0 && strcmp(WIFI_SSID, "Your_WiFi_SSID") != 0) {
        Serial.printf("[WIFI] Connecting to SSID: %s ...\n", WIFI_SSID);
        WiFi.mode(WIFI_STA);
        WiFi.setSleep(false);
        WiFi.setAutoReconnect(true);
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

        int attempts = 0;
        while (WiFi.status() != WL_CONNECTED && attempts < 20) {
            delay(250);
            Serial.print(F("."));
            digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
            attempts++;
        }
        Serial.println();

        if (WiFi.status() == WL_CONNECTED) {
            wifiOk = true;
            currentIpAddress = WiFi.localIP().toString();
            Serial.printf("[WIFI] Connected! Assigned IP: %s\n", currentIpAddress.c_str());
            digitalWrite(PIN_STATUS_LED, HIGH);
        }
    }

    // If Station mode failed or unconfigured, launch standalone SoftAP
    if (!wifiOk) {
        Serial.printf("[WIFI] Starting SoftAP: %s (Pass: %s)...\n", AP_SSID, AP_PASSWORD);
        WiFi.mode(WIFI_AP_STA);
        WiFi.setSleep(false);
        WiFi.softAP(AP_SSID, AP_PASSWORD);
        softApActive = true;
        currentIpAddress = WiFi.softAPIP().toString();
        Serial.printf("[WIFI] SoftAP active! Dashboard IP: http://%s\n", currentIpAddress.c_str());
        if (USE_STATION_MODE && strlen(WIFI_SSID) > 0) {
            WiFi.setAutoReconnect(true);
            WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
            lastWifiReconnectAttempt = millis();
            wifiReconnectDelayMs = 5000;
        }
    }

    // Register WebServer Endpoints
    server.on("/", HTTP_GET, handleRoot);
    server.on("/api/live", HTTP_GET, handleGetLive);
    server.on("/api/calibrate", HTTP_POST, handleCalibrate);
    server.on("/api/calibrate/reset", HTTP_POST, handleResetCalibration);
    server.on("/api/status", HTTP_GET, handleStatus);
    server.onNotFound(handleNotFound);

    // Enable Cross-Origin Resource Sharing (CORS) for external dashboards
    server.enableCORS(true);
    server.begin();
    Serial.println(F("[HTTP] Embedded telemetry server started on port 80."));
    Serial.println(F("[INIT] Acquisition loop starting at 100Hz (10ms interval)..."));
    Serial.println(F("[HELP] Type '?' in Serial Monitor for diagnostic commands."));

    lastSampleMicros = micros();
}

void loop() {
    // 1. Maintain HTTP server clients
    server.handleClient();

    if (USE_STATION_MODE) {
        unsigned long wifiCheckMillis = millis();
        if (WiFi.status() == WL_CONNECTED) {
            currentIpAddress = WiFi.localIP().toString();
            wifiDisconnectedAt = 0;
            wifiReconnectDelayMs = 5000;
        } else {
            if (wifiDisconnectedAt == 0) wifiDisconnectedAt = wifiCheckMillis;

            if (!softApActive && wifiCheckMillis - wifiDisconnectedAt >= 10000) {
                WiFi.mode(WIFI_AP_STA);
                WiFi.setSleep(false);
                WiFi.softAP(AP_SSID, AP_PASSWORD);
                softApActive = true;
                currentIpAddress = WiFi.softAPIP().toString();
                Serial.printf("[WIFI] Station lost; SoftAP fallback active at http://%s\n", currentIpAddress.c_str());
                WiFi.setAutoReconnect(true);
                lastWifiReconnectAttempt = wifiCheckMillis;
            } else if (softApActive && wifiCheckMillis - lastWifiReconnectAttempt >= wifiReconnectDelayMs) {
                WiFi.reconnect();
                lastWifiReconnectAttempt = wifiCheckMillis;
                wifiReconnectDelayMs = min(wifiReconnectDelayMs * 2, 60000UL);
            }
        }
    }

    // 2. High-precision Non-Blocking Sensor Acquisition (100Hz)
    unsigned long currentMicros = micros();
    if (currentMicros - lastSampleMicros >= SAMPLE_INTERVAL_MICROS) {
        lastSampleMicros += SAMPLE_INTERVAL_MICROS;
        unsigned long currentMillis = millis();

        // Read physical ADC channels
        // GPIO 34 = Pulse Sensor, GPIO 35 = GSR Sensor
        int rawPulse = analogRead(PIN_PULSE_ADC);
        int rawGsr = analogRead(PIN_GSR_ADC);

        // Process biometric signals through deterministic algorithms
        latestPulse = pulseProcessor.processSample(rawPulse, currentMillis);
        latestGsr = gsrProcessor.processSample(rawGsr);

        // Visual heartbeat blink when a valid beat is confirmed
        if (latestPulse.beatDetected) {
            digitalWrite(PIN_STATUS_LED, HIGH);
        } else if (currentMillis - lastHeartbeatMillis > 50) {
            digitalWrite(PIN_STATUS_LED, LOW);
            lastHeartbeatMillis = currentMillis;
        }

        // Serial plotter diagnostic mode output
        if (serialPlotterMode) {
            Serial.printf("PulseRaw:%d,BPM:%d,GsrRaw:%d,GsrBaseline:%.1f\n",
                latestPulse.rawAdc,
                latestPulse.bpm,
                latestGsr.rawAdc,
                latestGsr.baselineAdc
            );
        }
    }

    // 3. Update OLED Display at 10 FPS (100ms) to conserve CPU cycles
    unsigned long currentMillis = millis();
    if (currentMillis - lastOledMillis >= 100) {
        lastOledMillis = currentMillis;
        oled.update(
            latestPulse,
            latestGsr,
            isNetworkAvailable(),
            currentIpAddress.c_str(),
            gsrProcessor.isCalibrating(),
            gsrProcessor.getCalibrationProgress()
        );
    }

    // 4. Handle incoming Serial diagnostic commands
    checkSerialCommands();
}

// ==========================================
// WebServer HTTP Handlers
// ==========================================

void handleRoot() {
    String html = F("<!DOCTYPE html><html><head><meta charset='UTF-8'><title>SENTINEL 2.0 Device</title>"
                    "<style>body{background:#0b1120;color:#e2e8f0;font-family:sans-serif;padding:24px;text-align:center;}"
                    ".card{background:#1e293b;border-radius:12px;padding:20px;max-width:440px;margin:20px auto;border:1px solid #334155;}"
                    "h1{color:#38bdf8;margin:0 0 8px;}button{background:#0284c7;color:#fff;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;font-weight:600;}"
                    "pre{background:#020617;padding:12px;border-radius:6px;text-align:left;overflow-x:auto;color:#38bdf8;}"
                    "</style></head><body>"
                    "<div class='card'>"
                    "<h1>SENTINEL 2.0</h1>"
                    "<p>Biometric Acquisition Node is Online</p>"
                    "<p>Live JSON API: <a style='color:#38bdf8' href='/api/live'>/api/live</a></p>"
                    "<button onclick=\"fetch('/api/calibrate',{method:'POST'}).then(r=>alert('Calibration started!'))\">Start GSR Calibration</button>"
                    "</div></body></html>");
    server.send(200, "text/html", html);
}

void handleGetLive() {
    protocol.serializeTelemetry(
        jsonTelemetryBuffer,
        sizeof(jsonTelemetryBuffer),
        millis(),
        latestPulse,
        latestGsr,
        isNetworkAvailable(),
        currentIpAddress.c_str(),
        gsrProcessor.isCalibrating(),
        gsrProcessor.getCalibrationProgress(),
        gsrProcessor.getCalibrationErrorCode()
    );
    server.send(200, "application/json", jsonTelemetryBuffer);
}

void handleCalibrate() {
    gsrProcessor.startCalibration();
    server.send(200, "application/json", "{\"status\":\"calibration_started\",\"duration_seconds\":15}");
}

void handleResetCalibration() {
    gsrProcessor.reset();
    server.send(200, "application/json", "{\"status\":\"baseline_cleared\"}");
}

void handleStatus() {
    String resp = "{\"deviceId\":\"" + String(DEVICE_ID) + "\""
                  ",\"uptime_seconds\":" + String(millis() / 1000) +
                  ",\"wifi_connected\":" + String(isNetworkAvailable() ? "true" : "false") +
                  ",\"ip\":\"" + currentIpAddress + "\""
                  ",\"sample_rate_hz\":" + String(SAMPLE_RATE_HZ) + "}";
    server.send(200, "application/json", resp);
}

bool isNetworkAvailable() {
    return WiFi.status() == WL_CONNECTED || softApActive;
}

void handleNotFound() {
    server.send(404, "application/json", "{\"error\":\"Endpoint not found\"}");
}

void checkSerialCommands() {
    if (Serial.available() > 0) {
        char cmd = (char)Serial.read();
        switch (cmd) {
            case '?':
                Serial.println(F("\n--- SENTINEL 2.0 Serial Commands ---"));
                Serial.println(F("  c : Start GSR baseline calibration (15 seconds)"));
                Serial.println(F("  d : Toggle Serial Plotter telemetry mode"));
                Serial.println(F("  r : Reset signal processors"));
                Serial.println(F("  s : Print current status summary"));
                Serial.println(F("------------------------------------\n"));
                break;
            case 'c':
                Serial.println(F("[CMD] Starting GSR baseline calibration..."));
                gsrProcessor.startCalibration();
                break;
            case 'd':
                serialPlotterMode = !serialPlotterMode;
                Serial.printf("[CMD] Serial plotter mode: %s\n", serialPlotterMode ? "ON" : "OFF");
                break;
            case 'r':
                Serial.println(F("[CMD] Resetting processors..."));
                pulseProcessor.reset();
                gsrProcessor.reset();
                break;
            case 's':
                Serial.printf("[STATUS] Pulse BPM: %d | Quality: %s | GSR Raw: %d | Baseline: %.1f | Wi-Fi: %s\n",
                    latestPulse.bpm,
                    pulseQualityToString(latestPulse.quality),
                    latestGsr.rawAdc,
                    latestGsr.baselineAdc,
                    currentIpAddress.c_str()
                );
                break;
            default:
                break;
        }
    }
}
