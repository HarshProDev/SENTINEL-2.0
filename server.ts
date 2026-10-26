/**
 * SENTINEL 2.0 - Full-Stack Express Server with Vite Middleware
 * Handles Groq AI integration, telemetry validation, health checks,
 * and static assets.
 */

import express, { Request, Response } from 'express';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { AiInterpretationRequest, AiInterpretationResponse } from './src/types/sentinel.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(compression());
app.use(express.json({ limit: '256kb' }));

function getText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function getTextList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return items.length > 0 ? items.map((item) => item.trim()) : fallback;
}

// Simple in-memory rate limiter for AI requests (e.g. max 10 requests per minute per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }
  if (entry.count >= 12) {
    return false;
  }
  entry.count++;
  return true;
}

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim());
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);

  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    services: {
      groqConfigured: hasGroq,
      groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      geminiFallbackConfigured: hasGemini,
      ruleEngineActive: true,
    },
  });
});

// List documentation files for interactive docs viewer in the dashboard
app.get('/api/docs/:docName', (req: Request, res: Response) => {
  const docName = req.params.docName.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const docPath = path.join(__dirname, 'docs', `${docName}.md`);

  if (fs.existsSync(docPath)) {
    const content = fs.readFileSync(docPath, 'utf-8');
    res.json({ title: `${docName}.md`, content });
  } else {
    res.status(404).json({ error: 'Documentation file not found' });
  }
});

// AI Interpretation Endpoint
app.post('/api/ai/interpret', async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      status: 'error',
      summary: 'Rate limit reached. Please wait a minute before requesting another AI interpretation.',
      pulseAnalysis: 'No new pulse analysis was generated because the request limit was reached.',
      gsrAnalysis: 'No new GSR analysis was generated because the request limit was reached.',
      recommendations: ['Wait one minute before requesting another interpretation.'],
      cautions: ['Rate limit active to preserve quota.'],
      dataQuality: 'STALE',
      generatedAt: new Date().toISOString(),
      provider: 'system_rules',
    } satisfies AiInterpretationResponse);
  }

  const payload = req.body as AiInterpretationRequest;

  // 1. Strict validation of incoming summary
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Invalid payload structure' });
  }

  const {
    sessionDurationSeconds = 0,
    meanBpm,
    minBpm,
    maxBpm,
    bpmStability = 'UNKNOWN',
    gsrRelativeChangePercent,
    gsrTrend = 'INDETERMINATE',
    dataQuality = 'LOW_QUALITY',
    validBeatRatio = 0,
  } = payload;

  // Reject unsafe, noisy, or disconnected states
  if (
    dataQuality === 'DISCONNECTED' ||
    dataQuality === 'ERROR' ||
    sessionDurationSeconds < 5 ||
    validBeatRatio < 0.35 ||
    meanBpm === null
  ) {
    const rejectedResponse: AiInterpretationResponse = {
      status: 'rejected_invalid_data',
      summary:
        'Biometric signals were insufficient, noisy, or disconnected during this window. AI interpretation is withheld to prevent misleading feedback.',
      pulseAnalysis: 'A reliable pulse summary could not be produced from this session.',
      gsrAnalysis: 'GSR data is not interpreted because the session did not meet the minimum signal-quality requirements.',
      recommendations: [
        'Check that the pulse sensor is connected to GPIO 34 and rest a finger gently and steadily on the sensor.',
        'Reduce movement and bright ambient light near the optical sensor, then record a new session.',
        'If using GSR, check electrode contact and complete a steady baseline calibration before recording.',
      ],
      cautions: [
        'SENTINEL 2.0 does not fabricate insights from invalid or noisy biometric data.',
        'Always establish a calm 15-second baseline before recording sessions.',
      ],
      dataQuality,
      generatedAt: new Date().toISOString(),
      provider: 'system_rules',
    };
    return res.json(rejectedResponse);
  }

  const promptSystem = `You are the SENTINEL 2.0 Physiological Response AI Assistant.
CRITICAL SAFETY & MEDICAL CONSTRAINTS:
1. SENTINEL 2.0 is an educational student engineering prototype, NOT a medical or diagnostic device.
2. Heart rate and galvanic skin response (GSR) ALONE cannot diagnose any disease or reliably identify specific emotions.
3. NEVER diagnose any cardiac, psychiatric, or physical illness.
4. NEVER claim that a reading proves stress, panic, anxiety, or guilt.
5. Distinguish observed physical measurements from possible non-causal explanations (e.g. ambient temperature, finger pressure, deep breathing).
6. Give a useful, moderately detailed report, not a one-line suggestion. Explain measurements plainly and never imply certainty beyond the supplied session aggregates.
7. Offer exactly 3 distinct, practical, low-risk recommendations. For each, state what to do and a reasonable duration or simple method when applicable. Keep recommendations optional and avoid treatment or medication advice.
8. Do not call a heart rate normal, abnormal, high-risk, or low-risk based on a single educational session. Compare values descriptively with the supplied session range and stability only.
9. Return ONLY a valid JSON object matching the requested schema.`;

  const promptUser = `Summarize these validated physiological measurements:
- Session Duration: ${Math.round(sessionDurationSeconds)} seconds
- Mean Heart Rate: ${meanBpm} BPM (Range: ${minBpm ?? '--'} - ${maxBpm ?? '--'} BPM)
- Heart Rate Stability: ${bpmStability}
- GSR Relative Shift from Baseline: ${
    gsrRelativeChangePercent !== null
      ? `${gsrRelativeChangePercent > 0 ? '+' : ''}${gsrRelativeChangePercent}%`
      : 'No baseline'
  }
- GSR Directional Trend: ${gsrTrend}
- Signal Validity Ratio: ${Math.round(validBeatRatio * 100)}% valid beats
- Signal Quality Flag: ${dataQuality}

Return valid JSON with exactly these keys:
{
  "summary": "2-3 sentence overall session overview, grounded in the supplied numbers",
  "pulseAnalysis": "2-3 sentences describing mean BPM, supplied range and stability; do not diagnose",
  "gsrAnalysis": "2-3 sentences describing the supplied GSR percentage and trend, or clearly state when no baseline/value is available",
  "recommendations": ["Exactly 3 distinct, specific, low-risk suggestions; each should be a complete sentence with a practical step and duration/method where applicable"],
  "cautions": ["2-3 concise limitations including that this is educational, non-diagnostic data and readings can be affected by movement, contact, and environment"]
}`;

  // Priority 1: Try Groq API if configured
  const groqApiKey = process.env.GROQ_API_KEY?.trim();
  const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  if (groqApiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [
            { role: 'system', content: promptSystem },
            { role: 'user', content: promptUser },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 800,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const groqJson = await response.json();
        const content = groqJson.choices?.[0]?.message?.content;
        if (content) {
          const parsed: unknown = JSON.parse(content);
          const fields = typeof parsed === 'object' && parsed !== null
            ? parsed as Record<string, unknown>
            : {};
          const aiResponse: AiInterpretationResponse = {
            status: 'ok',
            summary: getText(fields.summary, 'The recorded session summary is available below. Interpret it as an educational observation, not a diagnosis.'),
            pulseAnalysis: getText(fields.pulseAnalysis, `Mean heart rate was ${meanBpm} BPM, with a recorded range of ${minBpm ?? '--'}-${maxBpm ?? '--'} BPM and ${bpmStability.toLowerCase().replaceAll('_', ' ')} stability.`),
            gsrAnalysis: getText(fields.gsrAnalysis, gsrRelativeChangePercent === null
              ? 'No calibrated GSR baseline was available, so a relative skin-response change cannot be described.'
              : `GSR shifted ${gsrRelativeChangePercent > 0 ? '+' : ''}${gsrRelativeChangePercent}% relative to baseline with a ${gsrTrend.toLowerCase()} trend.`),
            recommendations: getTextList(fields.recommendations, [
              'Sit comfortably with your feet supported and take a one-minute posture break.',
              'If you want to practice paced breathing, inhale gently for 4 seconds and exhale for 6 seconds for one minute; stop if uncomfortable.',
              'For a cleaner follow-up reading, keep your hand still and maintain light, steady sensor contact during the next session.',
            ]),
            cautions: getTextList(fields.cautions, [
              'Non-medical student prototype.',
              'GSR and heart rate vary with room temperature and physical movement.',
            ]),
            dataQuality,
            generatedAt: new Date().toISOString(),
            provider: 'groq',
          };
          return res.json(aiResponse);
        }
      }
    } catch (err) {
      console.warn('Groq API request failed or timed out, trying fallback:', (err as Error).message);
    }
  }

  // Priority 2: Gemini API Fallback (using server-side key)
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const model = 'gemini-2.5-flash';
      const prompt = `${promptSystem}\n\n${promptUser}\n\nRespond with strict JSON only.`;

      const geminiResult = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (geminiResult.text) {
        const parsed: unknown = JSON.parse(geminiResult.text);
        const fields = typeof parsed === 'object' && parsed !== null
          ? parsed as Record<string, unknown>
          : {};
        const aiResponse: AiInterpretationResponse = {
          status: 'ok',
          summary: getText(fields.summary, 'The recorded session summary is available below. Interpret it as an educational observation, not a diagnosis.'),
          pulseAnalysis: getText(fields.pulseAnalysis, `Mean heart rate was ${meanBpm} BPM, with a recorded range of ${minBpm ?? '--'}-${maxBpm ?? '--'} BPM and ${bpmStability.toLowerCase().replaceAll('_', ' ')} stability.`),
          gsrAnalysis: getText(fields.gsrAnalysis, gsrRelativeChangePercent === null
            ? 'No calibrated GSR baseline was available, so a relative skin-response change cannot be described.'
            : `GSR shifted ${gsrRelativeChangePercent > 0 ? '+' : ''}${gsrRelativeChangePercent}% relative to baseline with a ${gsrTrend.toLowerCase()} trend.`),
          recommendations: getTextList(fields.recommendations, [
            'Sit comfortably with your feet supported and take a one-minute posture break.',
            'If you want to practice paced breathing, inhale gently for 4 seconds and exhale for 6 seconds for one minute; stop if uncomfortable.',
            'For a cleaner follow-up reading, keep your hand still and maintain light, steady sensor contact during the next session.',
          ]),
          cautions: getTextList(fields.cautions, [
            'Student educational demonstration only.',
            'Not intended to diagnose emotional states or health conditions.',
          ]),
          dataQuality,
          generatedAt: new Date().toISOString(),
          provider: 'gemini',
        };
        return res.json(aiResponse);
      }
    } catch (err) {
      console.warn('Gemini fallback failed:', (err as Error).message);
    }
  }

  // Priority 3: Deterministic Rule Engine (₹0 cost, 100% offline resilient)
  let ruleSummary = `Mean heart rate tracked at ${meanBpm} BPM with ${bpmStability.toLowerCase().replace('_', ' ')}. `;
  if (gsrRelativeChangePercent !== null) {
    if (Math.abs(gsrRelativeChangePercent) < 5) {
      ruleSummary += `Skin conductance remained stable (within ±5% of calibrated baseline).`;
    } else if (gsrRelativeChangePercent > 0) {
      ruleSummary += `Skin conductance showed a ${gsrRelativeChangePercent}% positive deflection (${gsrTrend.toLowerCase()} trend).`;
    } else {
      ruleSummary += `Skin conductance decreased by ${Math.abs(gsrRelativeChangePercent)}% relative to baseline.`;
    }
  }

  const rulePulseAnalysis = `Mean heart rate was ${meanBpm} BPM, with recorded values from ${minBpm ?? '--'} to ${maxBpm ?? '--'} BPM. Beat-to-beat summary stability was ${bpmStability.toLowerCase().replaceAll('_', ' ')}; this describes only the captured session.`;
  const ruleGsrAnalysis = gsrRelativeChangePercent === null
    ? 'No calibrated GSR baseline was available, so relative skin-response change cannot be summarized.'
    : `GSR changed ${gsrRelativeChangePercent > 0 ? '+' : ''}${gsrRelativeChangePercent}% from baseline, with a ${gsrTrend.toLowerCase()} trend. Contact pressure, movement, skin moisture, and room conditions can affect this signal.`;
  const ruleRecommendations = [
    'For a steady follow-up measurement, sit comfortably, support your arm, and keep the sensor contact light and still for one minute.',
    'If you would like a brief relaxation exercise, inhale gently for 4 seconds and exhale for 6 seconds for 1-2 minutes; stop if you feel uncomfortable.',
    gsrRelativeChangePercent === null
      ? 'If GSR is being used, check electrode contact and collect a stable baseline before comparing future sessions.'
      : 'For context, note whether posture, movement, talking, room temperature, or sensor contact changed during the session; repeat under similar conditions if comparing readings.',
  ];

  const ruleResponse: AiInterpretationResponse = {
    status: 'ok',
    summary: `${ruleSummary} These values summarize this recording and are not a medical assessment.`,
    pulseAnalysis: rulePulseAnalysis,
    gsrAnalysis: ruleGsrAnalysis,
    recommendations: ruleRecommendations,
    cautions: [
      'Generated by local rule engine (no external AI API key configured or API unreachable).',
      'Student prototype; not certified for clinical assessment or medical decision-making.',
      'Physical factors like finger movement, strap tightness, and ambient moisture alter readings.',
    ],
    dataQuality,
    generatedAt: new Date().toISOString(),
    provider: 'system_rules',
  };

  return res.json(ruleResponse);
});

// Configure Vite or Static File Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath, {
      setHeaders(response, filePath) {
        if (path.basename(filePath) === 'index.html') {
          response.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          response.setHeader('Cache-Control', 'public, max-age=86400');
        }
      },
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SENTINEL 2.0 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SENTINEL 2.0 server:', err);
});
