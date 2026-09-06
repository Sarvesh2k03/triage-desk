import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { TriageEngine, TriageEngineInput } from './triageEngine';
import { TRIAGE_SYSTEM_PROMPT, buildTriagePrompt } from './triageSchema';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../types/ticket';

interface GeminiHttpResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<GeminiGenerateContentResponse>;
  text(): Promise<string>;
}

type GeminiFetch = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<GeminiHttpResponse>;

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  modelVersion?: string;
}

const GEMINI_TRIAGE_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: [...TICKET_CATEGORIES] },
    priority: { type: 'string', enum: [...TICKET_PRIORITIES] },
    summary: { type: 'string' },
  },
  required: ['category', 'priority', 'summary'],
  // No `additionalProperties` here: Gemini's responseSchema is OpenAPI-flavoured,
  // not full JSON Schema, and rejects the field with a 400. Unknown keys are
  // handled where it actually matters anyway -- TriageService re-parses the
  // response with Zod, which strips anything it did not ask for.
  propertyOrdering: ['category', 'priority', 'summary'],
};

export class GeminiTriageEngine implements TriageEngine {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetcher: GeminiFetch;

  constructor(options: { apiKey: string; model?: string; timeoutMs?: number; fetcher?: GeminiFetch }) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? env.GEMINI_MODEL;
    this.timeoutMs = options.timeoutMs ?? env.AI_REQUEST_TIMEOUT_MS;
    this.fetcher = options.fetcher ?? (async (url, init) => (await fetch(url, init)) as GeminiHttpResponse);
  }

  async classify(input: TriageEngineInput): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    timer.unref?.();

    try {
      const response = await this.fetcher(this.url(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(this.requestBody(input)),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Gemini API returned ${response.status} ${response.statusText}: ${body.slice(0, 240)}`);
      }

      const payload = await response.json();
      const text = this.responseText(payload);

      logger.info('gemini triage call completed', {
        model: payload.modelVersion ?? this.model,
        finishReason: payload.candidates?.[0]?.finishReason,
        inputTokens: payload.usageMetadata?.promptTokenCount,
        outputTokens: payload.usageMetadata?.candidatesTokenCount,
        totalTokens: payload.usageMetadata?.totalTokenCount,
      });

      return JSON.parse(text);
    } finally {
      clearTimeout(timer);
    }
  }

  private url(): string {
    // v1, not v1beta: the current Gemini models are only routed on v1, and
    // calling v1beta for one returns a bodyless 404 that is easy to misread
    // as a bad API key.
    return `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(this.model)}:generateContent`;
  }

  private requestBody(input: TriageEngineInput): object {
    return {
      systemInstruction: { parts: [{ text: TRIAGE_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: buildTriagePrompt(input.title, input.description) }] }],
      generationConfig: {
        temperature: 0.2,
        // Thinking tokens count against this budget. 256 was enough for the
        // answer but not for the reasoning in front of it, so the response
        // was being truncated before it emitted any JSON.
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        // `responseSchema` on v1; the `responseJsonSchema` spelling belongs to
        // v1beta and is silently ignored here, which lets the model reply with
        // prose instead of the object we asked for.
        responseSchema: GEMINI_TRIAGE_SCHEMA,
        // This is a six-way classification. Reasoning buys nothing and is the
        // difference between a ~1s call and a timeout.
        thinkingConfig: { thinkingBudget: 0 },
      },
    };
  }

  private responseText(payload: GeminiGenerateContentResponse): string {
    if (payload.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked the prompt: ${payload.promptFeedback.blockReason}`);
    }

    const candidate = payload.candidates?.[0];
    if (!candidate) throw new Error('Gemini returned no candidates');
    // MAX_TOKENS is a failure, not a success: the response was cut off
    // mid-object, so parsing it would either throw or, worse, yield a
    // half-populated result. Treat it as unavailable and let the caller fall
    // back to a complete answer.
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      throw new Error(`Gemini finished with ${candidate.finishReason}`);
    }

    const text = candidate.content?.parts?.map((part) => part.text ?? '').join('').trim();
    if (!text) throw new Error('Gemini returned an empty response');
    return text;
  }
}

export function createTriageEngine(): TriageEngine | null {
  if (!env.GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY is not set - triage will use the local classifier');
    return null;
  }
  return new GeminiTriageEngine({ apiKey: env.GEMINI_API_KEY });
}
