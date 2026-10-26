#include "pulse_processor.h"

PulseProcessor::PulseProcessor() {
    reset();
}

void PulseProcessor::reset() {
    dcBaseline = 2048.0f;
    baselineInitialized = false;
    filteredAc = 0.0f;
    adaptiveThreshold = 60.0f;
    peakCandidate = 0;
    peakTimeMs = 0;
    inBeatWave = false;
    candidatePolarity = 1;
    lastBeatTimeMs = 0;
    lastValidIbiMs = 0;
    consecutiveValidBeats = 0;
    currentBpm = 0;
    ibiCount = 0;
    ibiIndex = 0;
    ampIndex = 0;
    ampCount = 0;
    for (int i = 0; i < 5; i++) recentIbis[i] = 0;
    for (int i = 0; i < 100; i++) ampBuffer[i] = 0;
}

const char* pulseQualityToString(PulseQuality q) {
    switch (q) {
        case PulseQuality::DISCONNECTED: return "DISCONNECTED";
        case PulseQuality::INITIALIZING: return "INITIALIZING";
        case PulseQuality::CALIBRATING:  return "CALIBRATING";
        case PulseQuality::VALID:        return "VALID";
        case PulseQuality::LOW_QUALITY:  return "LOW_QUALITY";
        case PulseQuality::STALE:        return "STALE";
        case PulseQuality::ERROR:        return "ERROR";
        default:                         return "LOW_QUALITY";
    }
}

PulseResult PulseProcessor::processSample(int rawAdc, unsigned long timestampMs) {
    PulseResult result;
    result.rawAdc = rawAdc;
    result.bpm = 0;
    result.ibiMs = 0;
    result.valid = false;
    result.beatDetected = false;
    result.consecutiveValidBeats = consecutiveValidBeats;

    // 1. Connection check
    if (rawAdc <= PULSE_DISCONNECTED_LOW || rawAdc >= PULSE_DISCONNECTED_HIGH) {
        consecutiveValidBeats = 0;
        currentBpm = 0;
        lastBeatTimeMs = 0;
        lastValidIbiMs = 0;
        ibiCount = 0;
        ibiIndex = 0;
        filteredAc = 0.0f;
        peakCandidate = 0.0f;
        peakTimeMs = 0;
        inBeatWave = false;
        ampIndex = 0;
        ampCount = 0;
        for (int i = 0; i < 100; i++) ampBuffer[i] = 0;
        baselineInitialized = false;
        result.quality = PulseQuality::DISCONNECTED;
        result.confidence = 0;
        result.consecutiveValidBeats = 0;
        return result;
    }

    if (!baselineInitialized) {
        dcBaseline = (float)rawAdc;
        baselineInitialized = true;
    }

    // 2. DC Baseline tracking filter (slow low-pass)
    const float alphaDc = 0.02f;
    dcBaseline = (dcBaseline * (1.0f - alphaDc)) + (rawAdc * alphaDc);

    // AC signal with DC removed
    float ac = (float)rawAdc - dcBaseline;

    // 3. Low-pass filter for 50Hz/60Hz noise suppression
    const float alphaAc = 0.35f;
    filteredAc = (filteredAc * (1.0f - alphaAc)) + (ac * alphaAc);

    // 4. Amplitude tracking for dynamic threshold
    ampBuffer[ampIndex] = (int)filteredAc;
    ampIndex = (ampIndex + 1) % 100;
    if (ampCount < 100) ampCount++;

    int maxRecentAmp = PULSE_MIN_PEAK_AMPLITUDE;
    int signalPolarity = 1;
    for (int i = 0; i < ampCount; i++) {
        int sampleMagnitude = abs(ampBuffer[i]);
        if (sampleMagnitude > maxRecentAmp) {
            maxRecentAmp = sampleMagnitude;
            signalPolarity = ampBuffer[i] < 0 ? -1 : 1;
        }
    }
    adaptiveThreshold = max((float)PULSE_MIN_PEAK_AMPLITUDE, (float)maxRecentAmp * 0.45f);

    unsigned long timeSinceLastBeat = timestampMs - lastBeatTimeMs;
    float orientedSignal = filteredAc * (inBeatWave ? candidatePolarity : signalPolarity);

    // 5. Peak detection with refractory period
    if (!inBeatWave) {
        if (orientedSignal > adaptiveThreshold && timeSinceLastBeat >= PULSE_REFRACTORY_MS) {
            inBeatWave = true;
            candidatePolarity = signalPolarity;
            peakCandidate = orientedSignal;
            peakTimeMs = timestampMs;
        }
    } else {
        if (orientedSignal > peakCandidate) {
            peakCandidate = orientedSignal;
            peakTimeMs = timestampMs;
        } else if (orientedSignal < (adaptiveThreshold * 0.40f)) {
            // Downstroke confirmed
            inBeatWave = false;

            if (lastBeatTimeMs > 0) {
                int candidateIbi = (int)(peakTimeMs - lastBeatTimeMs);
                bool validRange = (candidateIbi >= PULSE_MIN_IBI_MS && candidateIbi <= PULSE_MAX_IBI_MS);

                bool jitterOk = true;
                if (lastValidIbiMs > 0) {
                    float jitter = abs(candidateIbi - lastValidIbiMs) / (float)lastValidIbiMs;
                    if (jitter > 0.35f) jitterOk = false;
                }

                if (validRange && jitterOk) {
                    result.beatDetected = true;
                    lastBeatTimeMs = peakTimeMs;
                    lastValidIbiMs = candidateIbi;

                    recentIbis[ibiIndex] = candidateIbi;
                    ibiIndex = (ibiIndex + 1) % 5;
                    if (ibiCount < 5) ibiCount++;

                    consecutiveValidBeats++;

                    // Average BPM calculation
                    long sumIbi = 0;
                    for (int i = 0; i < ibiCount; i++) sumIbi += recentIbis[i];
                    float avgIbi = (float)sumIbi / (float)ibiCount;
                    currentBpm = (int)round(60000.0f / avgIbi);
                } else {
                    // Re-anchor on this peak so one rejected interval cannot lock out recovery.
                    lastBeatTimeMs = peakTimeMs;
                    lastValidIbiMs = 0;
                    ibiCount = 0;
                    ibiIndex = 0;
                    consecutiveValidBeats = 1;
                    currentBpm = 0;
                }
            } else {
                lastBeatTimeMs = peakTimeMs;
                consecutiveValidBeats = 1;
            }
        }
    }

    // 6. Signal loss timeout (2500ms)
    if (lastBeatTimeMs > 0 && (timestampMs - lastBeatTimeMs > 2500)) {
        consecutiveValidBeats = 0;
        currentBpm = 0;
        lastBeatTimeMs = 0;
        lastValidIbiMs = 0;
        ibiCount = 0;
        ibiIndex = 0;
        inBeatWave = false;
        peakCandidate = 0.0f;
        peakTimeMs = 0;
    }

    // 7. Status evaluation
    if (lastBeatTimeMs == 0 || (timestampMs - lastBeatTimeMs > 2500)) {
        result.quality = PulseQuality::LOW_QUALITY;
        result.confidence = 10;
        result.valid = false;
    } else if (consecutiveValidBeats < PULSE_REQUIRED_CONSECUTIVE) {
        result.quality = PulseQuality::INITIALIZING;
        result.confidence = (consecutiveValidBeats * 60) / PULSE_REQUIRED_CONSECUTIVE;
        result.valid = false;
    } else {
        result.quality = PulseQuality::VALID;
        result.confidence = min(98, 70 + (consecutiveValidBeats * 5));
        result.valid = (currentBpm > 0);
    }

    result.bpm = result.valid ? currentBpm : 0;
    result.ibiMs = lastValidIbiMs;
    result.consecutiveValidBeats = consecutiveValidBeats;
    return result;
}
