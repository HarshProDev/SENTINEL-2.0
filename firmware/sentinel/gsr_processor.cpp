#include "gsr_processor.h"
#include <algorithm>
#include <cmath>

GsrProcessor::GsrProcessor()
{
    reset();
}

void GsrProcessor::reset()
{
    smoothedAdc = 0.0f;
    baselineAdc = 0.0f;
    calibrating = false;
    calibrationSamplesCollected = 0;
    calibrationMean = 0.0;
    calibrationM2 = 0.0;
    calibrationErrorCode = nullptr;
    historyIndex = 0;
    historyCount = 0;
    for (int i = 0; i < 10; i++)
        recentHistory[i] = 0.0f;
}

void GsrProcessor::startCalibration()
{
    calibrating = true;
    calibrationSamplesCollected = 0;
    calibrationMean = 0.0;
    calibrationM2 = 0.0;
    calibrationErrorCode = nullptr;
}

void GsrProcessor::cancelCalibration()
{
    calibrating = false;
    calibrationSamplesCollected = 0;
    calibrationMean = 0.0;
    calibrationM2 = 0.0;
}

bool GsrProcessor::isCalibrating() const
{
    return calibrating;
}

int GsrProcessor::getCalibrationProgress() const
{
    if (!calibrating)
        return 0;
    return (calibrationSamplesCollected * 100) / GSR_CALIBRATION_SAMPLES;
}

const char *GsrProcessor::getCalibrationErrorCode() const
{
    return calibrationErrorCode;
}

void GsrProcessor::setBaseline(float baseline)
{
    if (baseline >= GSR_MIN_VALID_ADC && baseline <= GSR_MAX_VALID_ADC)
    {
        baselineAdc = baseline;
    }
}

float GsrProcessor::getBaseline() const
{
    return baselineAdc;
}

const char *gsrQualityToString(GsrQuality q)
{
    switch (q)
    {
    case GsrQuality::DISCONNECTED:
        return "DISCONNECTED";
    case GsrQuality::INITIALIZING:
        return "INITIALIZING";
    case GsrQuality::CALIBRATING:
        return "CALIBRATING";
    case GsrQuality::VALID:
        return "VALID";
    case GsrQuality::LOW_QUALITY:
        return "LOW_QUALITY";
    case GsrQuality::STALE:
        return "STALE";
    case GsrQuality::ERROR:
        return "ERROR";
    default:
        return "LOW_QUALITY";
    }
}

const char *gsrTrendToString(GsrTrend t)
{
    switch (t)
    {
    case GsrTrend::STABLE:
        return "STABLE";
    case GsrTrend::TREND_RISING:
        return "RISING";
    case GsrTrend::TREND_FALLING:
        return "FALLING";
    case GsrTrend::INDETERMINATE:
        return "INDETERMINATE";
    default:
        return "INDETERMINATE";
    }
}

GsrResult GsrProcessor::processSample(int rawAdc)
{
    GsrResult res;
    res.rawAdc = rawAdc;
    res.smoothedAdc = smoothedAdc;
    res.baselineAdc = baselineAdc;
    res.relativeChangePercent = 0.0f;
    res.valid = false;
    res.trend = GsrTrend::INDETERMINATE;

    // 1. Physical bounds
    if (rawAdc < GSR_MIN_VALID_ADC || rawAdc > GSR_MAX_VALID_ADC)
    {
        if (calibrating)
        {
            calibrating = false;
            calibrationErrorCode = "GSR_CALIBRATION_SENSOR_DISCONNECTED";
        }
        res.quality = GsrQuality::DISCONNECTED;
        return res;
    }

    // 2. Exponential Moving Average smoothing
    if (smoothedAdc == 0.0f)
    {
        smoothedAdc = (float)rawAdc;
    }
    else
    {
        smoothedAdc = (smoothedAdc * (1.0f - GSR_SMOOTHING_ALPHA)) + ((float)rawAdc * GSR_SMOOTHING_ALPHA);
    }
    res.smoothedAdc = smoothedAdc;

    // 3. Calibration handling
    if (calibrating)
    {
        calibrationSamples[calibrationSamplesCollected] = (uint16_t)rawAdc;
        calibrationSamplesCollected++;
        const double delta = rawAdc - calibrationMean;
        calibrationMean += delta / calibrationSamplesCollected;
        calibrationM2 += delta * (rawAdc - calibrationMean);

        if (calibrationSamplesCollected >= GSR_CALIBRATION_SAMPLES)
        {
            const double variance = calibrationM2 / calibrationSamplesCollected;
            if (sqrt(variance) > GSR_CALIBRATION_MAX_STDDEV)
            {
                calibrating = false;
                calibrationErrorCode = "GSR_CALIBRATION_MOTION_DETECTED";
                res.quality = GsrQuality::LOW_QUALITY;
                return res;
            }

            std::sort(calibrationSamples, calibrationSamples + calibrationSamplesCollected);
            const int middle = calibrationSamplesCollected / 2;
            baselineAdc = (calibrationSamplesCollected % 2 == 0)
                ? (calibrationSamples[middle - 1] + calibrationSamples[middle]) / 2.0f
                : calibrationSamples[middle];
            calibrating = false;
        }
        else
        {
            res.quality = GsrQuality::CALIBRATING;
            return res;
        }
    }

    res.baselineAdc = baselineAdc;

    // 4. Relative change
    if (baselineAdc > 0.0f)
    {
        res.relativeChangePercent = ((smoothedAdc - baselineAdc) / baselineAdc) * 100.0f;
    }

    // 5. Trend analysis
    recentHistory[historyIndex] = smoothedAdc;
    historyIndex = (historyIndex + 1) % 10;
    if (historyCount < 10)
        historyCount++;

    if (historyCount >= 5 && baselineAdc > 0.0f)
    {
        int oldestIndex = (historyIndex - historyCount + 10) % 10;
        float delta = smoothedAdc - recentHistory[oldestIndex];
        float deltaPercent = (delta / baselineAdc) * 100.0f;

        if (deltaPercent > 2.0f)
        {
            res.trend = GsrTrend::TREND_RISING;
        }
        else if (deltaPercent < -2.0f)
        {
            res.trend = GsrTrend::TREND_FALLING;
        }
        else
        {
            res.trend = GsrTrend::STABLE;
        }
    }

    res.valid = true;
    res.quality = GsrQuality::VALID;
    return res;
}
