#ifndef SENTINEL_PULSE_PROCESSOR_H
#define SENTINEL_PULSE_PROCESSOR_H

#include <Arduino.h>
#include "config.h"

enum class PulseQuality {
    DISCONNECTED,
    INITIALIZING,
    CALIBRATING,
    VALID,
    LOW_QUALITY,
    STALE,
    ERROR
};

struct PulseResult {
    int rawAdc;
    int bpm;
    int ibiMs;
    bool valid;
    PulseQuality quality;
    int confidence; // 0-100
    bool beatDetected;
    int consecutiveValidBeats;
};

class PulseProcessor {
public:
    PulseProcessor();
    void reset();
    PulseResult processSample(int rawAdc, unsigned long timestampMs);

private:
    float dcBaseline;
    bool baselineInitialized;
    float filteredAc;
    float adaptiveThreshold;
    float peakCandidate;
    unsigned long peakTimeMs;
    bool inBeatWave;
    int candidatePolarity;

    unsigned long lastBeatTimeMs;
    int lastValidIbiMs;
    int consecutiveValidBeats;
    int currentBpm;

    // Rolling circular buffer of recent IBIs (up to 5)
    int recentIbis[5];
    int ibiCount;
    int ibiIndex;

    // Rolling amplitude buffer
    int ampBuffer[100];
    int ampIndex;
    int ampCount;
};

const char* pulseQualityToString(PulseQuality q);

#endif // SENTINEL_PULSE_PROCESSOR_H
