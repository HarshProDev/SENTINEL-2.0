#ifndef SENTINEL_DATA_PROTOCOL_H
#define SENTINEL_DATA_PROTOCOL_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include "config.h"
#include "pulse_processor.h"
#include "gsr_processor.h"

class DataProtocol {
public:
    DataProtocol();
    void setSequence(unsigned long seq);
    unsigned long nextSequence();
    
    // Serializes telemetry packet into caller-supplied buffer
    size_t serializeTelemetry(
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
    );

private:
    unsigned long sequenceNumber;
};

#endif // SENTINEL_DATA_PROTOCOL_H
