#include "oled_ui.h"

OledUI::OledUI()
    : display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1), isReady(false), lastRenderTimeMs(0) {}

bool OledUI::begin()
{
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR))
    {
        return false;
    }
    isReady = true;
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    return true;
}

void OledUI::showBootScreen(const char *version)
{
    if (!isReady)
        return;
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(18, 10);
    display.print(F("SENTINEL 2.0"));
    display.setCursor(14, 25);
    display.print(F("IoT + AI Biometrics"));
    display.drawFastHLine(0, 38, 128, SSD1306_WHITE);
    display.setCursor(20, 48);
    display.print(F("Firmware v"));
    display.print(version);
    display.display();
}

void OledUI::showError(const char *errorMsg)
{
    if (!isReady)
        return;
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 5);
    display.print(F("HARDWARE WARNING:"));
    display.drawFastHLine(0, 16, 128, SSD1306_WHITE);
    display.setCursor(0, 24);
    display.print(errorMsg);
    display.display();
}

void OledUI::update(const PulseResult &pulse, const GsrResult &gsr, bool wifiConnected, const char *ipStr, bool calibrating, int calibProgress)
{
    if (!isReady)
        return;

    // Throttle OLED rendering to 10 FPS to ensure non-blocking sampling loop
    unsigned long now = millis();
    if (now - lastRenderTimeMs < 100)
        return;
    lastRenderTimeMs = now;

    display.clearDisplay();

    // 1. Header Bar
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.print(F("SENTINEL"));
    display.setCursor(80, 0);
    if (wifiConnected)
    {
        display.print(F("WIFI OK"));
    }
    else
    {
        display.print(F("NO NET"));
    }
    display.drawFastHLine(0, 10, 128, SSD1306_WHITE);

    // 2. Pulse / Heart Rate Box (Left half)
    display.setCursor(0, 14);
    display.print(F("PULSE:"));

    if (pulse.valid && pulse.bpm > 0)
    {
        display.setTextSize(2);
        display.setCursor(0, 26);
        display.print(pulse.bpm);
        display.setTextSize(1);
        display.print(F(" BPM"));
    }
    else
    {
        display.setTextSize(1);
        display.setCursor(0, 28);
        if (pulse.quality == PulseQuality::DISCONNECTED)
        {
            display.print(F("NO SENSOR"));
        }
        else if (pulse.quality == PulseQuality::INITIALIZING)
        {
            display.print(F("SYNCING..."));
        }
        else if (pulse.quality == PulseQuality::LOW_QUALITY)
        {
            display.print(F("WEAK PPG"));
        }
        else
        {
            display.print(F("SEARCHING"));
        }
    }

    // 3. GSR Box (Right half)
    display.setTextSize(1);
    display.setCursor(68, 14);
    display.print(F("GSR RESP:"));
    display.setCursor(68, 26);

    if (calibrating)
    {
        display.print(F("CAL: "));
        display.print(calibProgress);
        display.print(F("%"));
    }
    else if (gsr.quality == GsrQuality::DISCONNECTED)
    {
        display.print(F("DISCONN"));
    }
    else if (gsr.valid)
    {
        if (gsr.relativeChangePercent >= 0.0f)
            display.print(F("+"));
        display.print(gsr.relativeChangePercent, 1);
        display.print(F("%"));

        // Direction indicator
        if (gsr.trend == GsrTrend::TREND_RISING)
            display.print(F(" ^"));
        else if (gsr.trend == GsrTrend::TREND_FALLING)
            display.print(F(" v"));
        else
            display.print(F(" ="));
    }
    else
    {
        display.print(F("STANDBY"));
    }

    // 4. Bottom status footer
    display.drawFastHLine(0, 52, 128, SSD1306_WHITE);
    display.setCursor(0, 55);
    if (ipStr && strlen(ipStr) > 0)
    {
        display.print(ipStr);
    }
    else
    {
        display.print(F("IP: 192.168.4.1 (AP)"));
    }

    display.display();
}
