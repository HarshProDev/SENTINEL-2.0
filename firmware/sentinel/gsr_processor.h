#ifndef SENTINEL_GSR_PROCESSOR_H
#define SENTINEL_GSR_PROCESSOR_H

#include <Arduino.h>
#include "config.h"

enum class GsrTrend
{
    STABLE,
    TREND_RISING,
    TREND_FALLING,
    INDETERMINATE
};

enum class GsrQuality
{
    DISCONNECTED,
    INITIALIZING,
    CALIBRATING,
    VALID,
    LOW_QUALITY,
    STALE,
    ERROR
};

struct GsrResult
{
    int rawAdc;
    float smoothedAdc;
    float baselineAdc;
    float relativeChangePercent;
    bool valid;
    GsrQuality quality;
    GsrTrend trend;
};

class GsrProcessor
{
public:
    GsrProcessor();
    void reset();
    void startCalibration();
    void cancelCalibration();
    bool isCalibrating() const;
    int getCalibrationProgress() const;
    const char *getCalibrationErrorCode() const;
    void setBaseline(float baseline);
    float getBaseline() const;

    GsrResult processSample(int rawAdc);

private:
    float smoothedAdc;
    float baselineAdc;
    bool calibrating;
    int calibrationSamplesCollected;
    uint16_t calibrationSamples[GSR_CALIBRATION_SAMPLES];
    double calibrationMean;
    double calibrationM2;
    const char *calibrationErrorCode;

    float recentHistory[10];
    int historyIndex;
    int historyCount;
};

const char *gsrQualityToString(GsrQuality q);
const char *gsrTrendToString(GsrTrend t);

#endif // SENTINEL_GSR_PROCESSOR_H
