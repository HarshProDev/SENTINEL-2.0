#ifndef SENTINEL_OLED_UI_H
#define SENTINEL_OLED_UI_H

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "config.h"
#include "pulse_processor.h"
#include "gsr_processor.h"

class OledUI {
public:
    OledUI();
    bool begin();
    void showBootScreen(const char* version);
    void update(const PulseResult& pulse, const GsrResult& gsr, bool wifiConnected, const char* ipStr, bool calibrating, int calibProgress);
    void showError(const char* errorMsg);

private:
    Adafruit_SSD1306 display;
    bool isReady;
    unsigned long lastRenderTimeMs;
};

#endif // SENTINEL_OLED_UI_H
