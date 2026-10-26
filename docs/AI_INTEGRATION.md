# SENTINEL 2.0 - Groq AI Integration & Privacy Specification

## 1. Zero-Data-Leak Privacy Architecture

SENTINEL 2.0 strictly adheres to the principle of data minimization:
1. **No Raw Telemetry to Cloud:** Continuous 100Hz raw waveform data (millions of raw ADC samples) is **NEVER** sent to Groq or any external API. Raw waveforms reside solely in the browser's local memory or IndexedDB.
2. **Aggregated Summaries Only:** Only a pre-computed mathematical summary (session duration, mean/minimum/maximum BPM, BPM stability category, GSR relative percentage deflection, directional trend, signal quality, and valid-pulse ratio) is transmitted when the user explicitly clicks "Request AI Interpretation". The API key is used only in the server-to-provider authorization header; it is not part of the prompt or browser payload.
3. **Protected API Keys:** The `GROQ_API_KEY` is loaded strictly server-side from environment variables (`.env`). It is never bundled into client JavaScript, firmware flash, or public Git commits.

---

## 2. Model Selection & Configuration

* **Default Verified Model:** `llama-3.3-70b-versatile` (or `llama-3.1-8b-instant` on Groq Cloud).
* **Target Latency:** ~250ms - 600ms on Groq LPUs.
* **Fallback Strategy:**
  1. Groq API via `https://api.groq.com/openai/v1/chat/completions` (JSON object mode).
  2. If Groq key is absent or quota is exceeded, automatic fallback to server-side Google GenAI (`gemini-2.5-flash`).
  3. If no internet or API keys are present, the built-in deterministic heuristic rule engine generates instant offline guidance at ₹0 cost!

---

## 3. Strict Medical & Safety Guardrails

The system prompt enforces these non-negotiable boundaries:
1. **Prototype Status:** Must explicitly state that SENTINEL 2.0 is an educational student prototype, not a medical or diagnostic device.
2. **No Pathological Diagnosis:** The model is prohibited from diagnosing cardiovascular conditions, psychiatric disorders, or somatic ailments.
3. **No Emotional Mind-Reading:** The model must NOT claim that physiological metrics "prove" stress, fear, anxiety, or deceit. It must clearly present non-psychological confounding factors (room temperature, speech, posture, arm movement, sensor seating).
4. **Actionable, Low-Risk Advice:** Recommendations are limited to universal, safe relaxation practices: paced diaphragmatic breathing, drinking water, taking a physical stretch, or adjusting posture.
5. **Rejection of Invalid Sessions:** If the data quality flag is `DISCONNECTED` or `ERROR`, the session is too short, the mean BPM is unavailable, or the valid beat ratio is below 35%, the backend rejects the request deterministically before calling any API.

## 4. Prompt and response

The server combines a system instruction with session aggregates. The system instruction requires cautious, non-diagnostic language and prohibits disease diagnosis or emotion inference. The user prompt includes session duration, mean/range BPM, BPM stability, GSR percentage shift and trend, valid-pulse ratio, and signal-quality flag. No raw ADC samples or waveform are included.

The model is asked for a JSON response containing a 2-3 sentence overview, separate heart-rate and GSR analyses, exactly three specific low-risk recommendations, and 2-3 limitations/cautions. The dashboard shows measured aggregate values separately from the generated interpretation. If an AI provider is unavailable, the deterministic local rule engine supplies the same multi-section format.

## 5. Requesting an interpretation

In the dashboard's **Telemetry** tab, start a session, collect at least 10 seconds of readings, and stop it. The **Groq AI Physiological Response Assistant** appears below the live charts. Select **Request AI Interpretation** to show the measured summary, separate pulse/GSR analysis, recommendations, provider, and safety cautions in that panel. The button remains disabled when the completed session does not meet the signal-quality and valid-beat requirements. No AI request is made automatically.
