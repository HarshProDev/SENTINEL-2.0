#include "data_protocol.h"

DataProtocol::DataProtocol() : sequenceNumber(0) {}

void DataProtocol::setSequence(unsigned long seq) {
    sequenceNumber = seq;
}

unsigned long DataProtocol::nextSequence() {
    return ++sequenceNumber;
}

size_t DataProtocol::serializeTelemetry(
    char* outputBuffer, 
    size_t maxLen,
    unsigned long timestampMs,
    const PulseResult& pulse,
    const GsrResult& gsr,
    bool wifiConnected,
    const char* ipAddress,
    bool calibrating,
    int calibProgress,
    const char* errorCode
) {
    JsonDocument doc;

    doc["schemaVersion"] = SCHEMA_VERSION;
    doc["deviceId"] = DEVICE_ID;
    doc["deviceTimestampMs"] = timestampMs;
    doc["sequence"] = nextSequence();

    // Pulse block
    JsonObject pulseObj = doc["pulse"].to<JsonObject>();
    pulseObj["rawAdc"] = pulse.rawAdc;
    if (pulse.valid) {
        pulseObj["bpm"] = pulse.bpm;
    } else {
        pulseObj["bpm"] = nullptr;
    }
    if (pulse.ibiMs > 0) {
        pulseObj["ibiMs"] = pulse.ibiMs;
    } else {
        pulseObj["ibiMs"] = nullptr;
    }
    pulseObj["valid"] = pulse.valid;
    pulseObj["quality"] = pulseQualityToString(pulse.quality);
    pulseObj["confidence"] = pulse.confidence;
    pulseObj["beatDetected"] = pulse.beatDetected;
    pulseObj["consecutiveValidBeats"] = pulse.consecutiveValidBeats;

    // GSR block
    JsonObject gsrObj = doc["gsr"].to<JsonObject>();
    gsrObj["rawAdc"] = gsr.rawAdc;
    if (gsr.valid) {
        gsrObj["smoothedAdc"] = round(gsr.smoothedAdc * 10.0f) / 10.0f;
    } else {
        gsrObj["smoothedAdc"] = nullptr;
    }
    if (gsr.baselineAdc > 0.0f) {
        gsrObj["baselineAdc"] = round(gsr.baselineAdc * 10.0f) / 10.0f;
    } else {
        gsrObj["baselineAdc"] = nullptr;
    }
    if (gsr.valid && gsr.baselineAdc > 0.0f) {
        gsrObj["relativeChange"] = round(gsr.relativeChangePercent * 10.0f) / 10.0f;
    } else {
        gsrObj["relativeChange"] = nullptr;
    }
    gsrObj["valid"] = gsr.valid;
    gsrObj["quality"] = gsrQualityToString(gsr.quality);
    gsrObj["trend"] = gsrTrendToString(gsr.trend);

    // System block
    JsonObject sysObj = doc["system"].to<JsonObject>();
    sysObj["wifiConnected"] = wifiConnected;
    if (ipAddress) sysObj["ipAddress"] = ipAddress;
    sysObj["calibrating"] = calibrating;
    sysObj["calibrationProgress"] = calibProgress;
    if (errorCode) {
        sysObj["errorCode"] = errorCode;
    } else {
        sysObj["errorCode"] = nullptr;
    }
    sysObj["sampleRateHz"] = SAMPLE_RATE_HZ;

    return serializeJson(doc, outputBuffer, maxLen);
}
