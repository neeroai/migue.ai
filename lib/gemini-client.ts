/**
 * Gemini Client - PRIMARY CHAT PROVIDER (FREE TIER)
 *
 * Cost: $0 within 1,500 requests/day free tier
 * Context: 1M tokens (8x larger than GPT-4o-mini)
 * Features: Context caching, Google Search, multi-modal
 * Fallback: GPT-4o-mini when limit reached
 */

import { GoogleGenerativeAI, GenerativeModel, Content, FunctionDeclaration, GenerateContentResult } from '@google/generative-ai';
import { Redis } from '@upstash/redis';
import { logger } from './logger';
import { getSupabaseServerClient } from './supabase';
import type { ChatMessage } from '../types/schemas';

// Model configuration
export type GeminiModelName = 'gemini-2.5-flash' | 'gemini-2.5-flash-lite' | 'gemini-2.5-pro';

// Cached client instances
let cachedClient: GoogleGenerativeAI | null = null;
let cachedModels: Map<string, GenerativeModel> = new Map(); // Cache key is composite: ${modelName}-${useToolCalling}

/**
 * Classify error as transient (retryable) or permanent
 * Best Practice 2025: Retry only on network/server errors, not client errors
 */
function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  // Network errors (retryable)
  if (message.includes('fetch failed') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('econnrefused')) {
    return true;
  }

  // Server errors (retryable)
  if (message.includes('503') ||
      message.includes('service unavailable') ||
      message.includes('502') ||
      message.includes('bad gateway')) {
    return true;
  }

  // Client errors (NOT retryable)
  if (message.includes('quota') ||
      message.includes('api key') ||
      message.includes('invalid') ||
      message.includes('400') ||
      message.includes('401') ||
      message.includes('403')) {
    return false;
  }

  // Default: don't retry unknown errors
  return false;
}

/**
 * Retry wrapper with exponential backoff
 * Best Practice 2025: 500ms → 1s → 2s (max 3 attempts)
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 500
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if error is permanent
      if (!isTransientError(error)) {
        logger.debug('[gemini-client] Permanent error - not retrying', {
          metadata: { error: lastError.message, attempt: attempt + 1 }
        });
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        logger.warn('[gemini-client] Max retries reached', {
          metadata: { error: lastError.message, attempts: maxRetries }
        });
        throw lastError;
      }

      // Calculate backoff with exponential increase
      const delay = baseDelay * Math.pow(2, attempt);
      logger.info('[gemini-client] Transient error - retrying', {
        metadata: {
          error: lastError.message,
          attempt: attempt + 1,
          maxRetries,
          delayMs: delay
        }
      });

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Get or create Gemini client (lazy initialization for cold start optimization)
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (!cachedClient) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY not set');
    }
    cachedClient = new GoogleGenerativeAI(apiKey);
    logger.info('[gemini-client] Client initialized');
  }
  return cachedClient;
}

/**
 * Get or create Gemini model (cached per model type)
 * Best Practice 2025: Temperature = 0 for function calling (Google AI recommendation)
 */
export function getGeminiModel(
  modelName: GeminiModelName = 'gemini-2.5-flash-lite',
  systemInstruction?: string,
  options?: {
    useToolCalling?: boolean;
  }
): GenerativeModel {
  const cacheKey = `${modelName}-${options?.useToolCalling ? 'tools' : 'chat'}`;

  if (!cachedModels.has(cacheKey)) {
    const client = getGeminiClient();
    const modelConfig: any = {
      model: modelName,
      generationConfig: {
        // Best Practice 2025: Use temperature = 0 for deterministic function calling
        // Source: Google AI Docs - "Use a low temperature (e.g., 0) for more deterministic and reliable function calls"
        temperature: options?.useToolCalling ? 0 : 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    };

    if (systemInstruction) {
      modelConfig.systemInstruction = systemInstruction;
    }

    const model = client.getGenerativeModel(modelConfig);

    cachedModels.set(cacheKey, model);
    logger.info('[gemini-client] Model cached', {
      metadata: {
        model: modelName,
        temperature: modelConfig.generationConfig.temperature,
        useToolCalling: options?.useToolCalling || false
      }
    });
  }

  return cachedModels.get(cacheKey)!;
}

/**
 * Convert OpenAI/Claude messages to Gemini format
 */
export function convertToGeminiMessages(messages: ChatMessage[]): Content[] {
  return messages
    .filter(msg => msg.content) // Skip empty messages
    .map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content || '' }]
    }));
}

/**
 * Type-safe function call result
 */
export interface GeminiFunctionResult {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Parse Gemini response to extract text and function calls
 */
export function parseGeminiResponse(result: GenerateContentResult): {
  text: string;
  functionCalls: GeminiFunctionResult[] | null;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
} {
  const calls = result.response.functionCalls();
  const usage = result.response.usageMetadata;

  return {
    text: result.response.text(),
    functionCalls: calls ? calls.map(call => ({
      name: call.name,
      args: call.args as Record<string, unknown>
    })) : null,
    usage: usage ? {
      promptTokens: usage.promptTokenCount ?? 0,
      completionTokens: usage.candidatesTokenCount ?? 0,
      totalTokens: usage.totalTokenCount ?? 0
    } : null
  };
}

/**
 * Check if within free tier limits (Supabase persistence)
 * Best Practice 2025: Async query with proper error handling
 */
export async function canUseFreeTier(): Promise<boolean> {
  try {
    const supabase = getSupabaseServerClient();
    const today = new Date().toISOString().split('T')[0]!; // YYYY-MM-DD

    const { data, error } = await supabase
      .from('gemini_usage' as any) // Type will be available after running migration
      .select('requests')
      .eq('date', today)
      .single();

    // PGRST116 = no rows (first request of the day)
    if (error && error.code !== 'PGRST116') {
      logger.error('[gemini-client] Failed to check free tier', new Error(error.message));
      return false; // Fail closed for safety
    }

    const currentRequests = (data as any)?.requests || 0;
    const withinLimit = currentRequests < 1400; // Soft limit (100 buffer)

    logger.info('[gemini-client] Free tier check', {
      metadata: {
        dailyRequests: currentRequests,
        limit: 1500,
        softLimit: 1400,
        canUse: withinLimit,
        remaining: 1400 - currentRequests
      }
    });

    return withinLimit;

  } catch (error) {
    logger.error('[gemini-client] Unexpected error in canUseFreeTier', error instanceof Error ? error : new Error(String(error)));
    return false; // Fail closed
  }
}

/**
 * Track Gemini usage (Supabase RPC function)
 * Best Practice 2025: Atomic increment with alerting
 */
export async function trackGeminiUsage(tokens: number): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    const today = new Date().toISOString().split('T')[0]!;

    const { data, error } = await supabase.rpc('increment_gemini_usage' as any, { // Type will be available after running migration
      usage_date: today,
      token_count: tokens
    } as any);

    if (error) {
      logger.error('[gemini-client] Failed to track usage', new Error(error.message));
      // Don't throw - tracking shouldn't block user messages
      return;
    }

    // Alert at thresholds
    const currentRequests = data?.[0]?.current_requests || 0;
    const currentTokens = data?.[0]?.current_tokens || 0;

    logger.info('[gemini-client] Usage tracked', {
      metadata: {
        dailyRequests: currentRequests,
        dailyTokens: currentTokens,
        cost: '$0.00 (free tier)'
      }
    });

    if (currentRequests === 1200) { // 80%
      logger.warn('[gemini-client] ⚠️ 80% of daily limit reached', {
        metadata: { requests: currentRequests, limit: 1500 }
      });
    }

    if (currentRequests === 1400) { // 93% (soft limit)
      logger.warn('[gemini-client] 🚨 Soft limit reached - switching to GPT-4o-mini', {
        metadata: { requests: currentRequests, limit: 1500 }
      });
    }

  } catch (error) {
    logger.error('[gemini-client] Unexpected error in trackGeminiUsage', error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Generate content with automatic fallback
 */
export async function generateContent(
  prompt: string,
  options?: {
    systemInstruction?: string;
    tools?: FunctionDeclaration[];
    history?: Content[];
    modelName?: GeminiModelName;
  }
): Promise<{
  text: string;
  functionCalls: GeminiFunctionResult[] | null;
  model: string;
  cost: number;
}> {
  try {
    // Check free tier availability
    if (!(await canUseFreeTier())) {
      throw new Error('Daily free tier limit reached, use fallback');
    }

    const model = getGeminiModel(
      options?.modelName || 'gemini-2.5-flash-lite',
      options?.systemInstruction
    );

    // Start chat with history if provided
    const chatOptions: any = {};
    if (options?.history) {
      chatOptions.history = options.history;
    }
    if (options?.tools) {
      chatOptions.tools = [{ functionDeclarations: options.tools }];
    }
    const chat = model.startChat(chatOptions);

    // Send message with retry logic (handles transient network/server errors)
    const result = await retryWithBackoff(() => chat.sendMessage(prompt));
    const parsed = parseGeminiResponse(result);

    // Track usage
    if (parsed.usage) {
      await trackGeminiUsage(parsed.usage.totalTokens);
    }

    return {
      text: parsed.text,
      functionCalls: parsed.functionCalls,
      model: options?.modelName || 'gemini-2.5-flash-lite',
      cost: 0 // Free tier
    };

  } catch (error) {
    logger.error('[gemini-client] Generation failed', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Stream content generation (for long responses)
 */
export async function* streamContent(
  prompt: string,
  options?: {
    systemInstruction?: string;
    history?: Content[];
    modelName?: GeminiModelName;
  }
): AsyncGenerator<string> {
  try {
    const model = getGeminiModel(
      options?.modelName || 'gemini-2.5-flash-lite',
      options?.systemInstruction
    );

    const chatOptions: any = {};
    if (options?.history) {
      chatOptions.history = options.history;
    }
    const chat = model.startChat(chatOptions);

    const result = await chat.sendMessageStream(prompt);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }

    // Track usage after streaming completes
    const response = await result.response;
    const usage = response.usageMetadata;
    if (usage?.totalTokenCount) {
      await trackGeminiUsage(usage.totalTokenCount);
    }

  } catch (error) {
    logger.error('[gemini-client] Streaming failed', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Context caching for 75% cost savings with Upstash Redis
 * Best Practice 2025: Persistent cache for Edge Runtime
 * Cache frequently used prompts and conversation history
 */
interface CachedContext {
  content: Content[];
  timestamp: number;
  hits: number;
}

// Lazy initialization for Edge Runtime optimization
let cachedRedis: Redis | null = null;

function getRedisClient(): Redis {
  if (!cachedRedis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set');
    }

    cachedRedis = new Redis({
      url,
      token
    });

    logger.info('[gemini-client] Upstash Redis client initialized');
  }
  return cachedRedis;
}

const CACHE_TTL = 3600; // 1 hour in seconds

/**
 * Get cached context from Upstash Redis
 * Best Practice 2025: Async with error handling + fallback
 */
export async function getCachedContext(key: string): Promise<Content[] | null> {
  try {
    const redis = getRedisClient();
    const cached = await redis.get<CachedContext>(key);

    if (!cached) {
      logger.debug('[gemini-client] Cache miss', { metadata: { key } });
      return null;
    }

    // TTL check (double safety with Redis EX)
    if (Date.now() - cached.timestamp > CACHE_TTL * 1000) {
      logger.debug('[gemini-client] Cache expired', { metadata: { key } });
      await redis.del(key); // Cleanup
      return null;
    }

    // Increment hit counter (async, don't await - fire and forget)
    redis.set(key, { ...cached, hits: cached.hits + 1 }, { ex: CACHE_TTL })
      .catch(err => logger.error('[gemini-client] Failed to update hits', err instanceof Error ? err : new Error(String(err))));

    logger.info('[gemini-client] ✅ Cache hit', {
      metadata: {
        key,
        hits: cached.hits + 1,
        age: Math.round((Date.now() - cached.timestamp) / 1000) + 's'
      }
    });

    return cached.content;

  } catch (error) {
    logger.error('[gemini-client] Redis get failed', error instanceof Error ? error : new Error(String(error)));
    return null; // Degrade gracefully - caching is optimization
  }
}

/**
 * Set cached context in Upstash Redis
 * Best Practice 2025: EX for automatic expiration
 */
export async function setCachedContext(key: string, content: Content[]): Promise<void> {
  try {
    const redis = getRedisClient();

    const cachedData: CachedContext = {
      content,
      timestamp: Date.now(),
      hits: 0
    };

    // Use EX for automatic expiration (Redis handles cleanup)
    await redis.set(key, cachedData, { ex: CACHE_TTL });

    logger.info('[gemini-client] Context cached', {
      metadata: { key, ttl: CACHE_TTL, size: content.length }
    });

  } catch (error) {
    logger.error('[gemini-client] Redis set failed', error instanceof Error ? error : new Error(String(error)));
    // Don't throw - caching is optimization, not critical
  }
}

/**
 * Analyze image with Gemini Vision API (multimodal)
 *
 * Cost: $0 within free tier (1,500 req/day)
 * Features: Table extraction, OCR, screenshot analysis, object detection
 * Better than Tesseract for structured data (tables, charts, UI elements)
 */
export async function analyzeImageWithGemini(
  imageBuffer: Uint8Array,
  prompt: string,
  options?: {
    mimeType?: string;
    modelName?: GeminiModelName;
  }
): Promise<{
  text: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number; };
}> {
  try {
    // Check free tier availability
    if (!(await canUseFreeTier())) {
      throw new Error('Daily free tier limit reached, use fallback');
    }

    const client = getGeminiClient();
    const modelName = options?.modelName || 'gemini-2.5-flash-lite';
    const model = client.getGenerativeModel({ model: modelName });

    // Convert buffer to base64
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    // Build multimodal request (image + text)
    const parts = [
      {
        inlineData: {
          data: base64Image,
          mimeType: options?.mimeType || 'image/jpeg'
        }
      },
      { text: prompt }
    ];

    logger.debug('[gemini-client] Analyzing image with Vision API', {
      metadata: {
        bufferSize: imageBuffer.length,
        mimeType: options?.mimeType || 'image/jpeg',
        promptLength: prompt.length,
        model: modelName
      }
    });

    // Send to Gemini
    const result = await model.generateContent(parts);
    const response = result.response;
    const text = response.text();
    const usage = response.usageMetadata;

    // Track usage
    const totalTokens = usage?.totalTokenCount || 0;
    await trackGeminiUsage(totalTokens);

    logger.info('[gemini-client] Image analyzed successfully', {
      metadata: {
        responseLength: text.length,
        tokensUsed: totalTokens,
        cost: '$0.00 (free tier)'
      }
    });

    return {
      text,
      usage: {
        promptTokens: usage?.promptTokenCount || 0,
        completionTokens: usage?.candidatesTokenCount || 0,
        totalTokens
      }
    };

  } catch (error) {
    logger.error('[gemini-client] Image analysis failed', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Detect image quality issues for better error messages
 */
export function detectImageIssue(imageBuffer: Uint8Array): string {
  const size = imageBuffer.length;

  // Very small image (< 10KB)
  if (size < 10000) {
    return 'La imagen es muy pequeña o de baja calidad. ¿Podrías enviarla con mejor resolución?';
  }

  // Very large image (> 20MB - WhatsApp limit)
  if (size > 20000000) {
    return 'La imagen es muy pesada. Intenta comprimirla o enviarla en mejor calidad pero menor tamaño.';
  }

  // Generic error
  return 'No pude procesar la imagen. ¿Podrías intentar con mejor iluminación o describirla con tus palabras?';
}

/**
 * Clear all cached models and contexts (for testing)
 * Note: Usage tracking is now in Supabase, not cleared here
 * Note: Context cache is now in Upstash Redis, not cleared locally
 */
export function clearCache() {
  cachedClient = null;
  cachedModels.clear();
  cachedRedis = null; // Reset Redis client (will re-initialize on next use)

  logger.info('[gemini-client] Local cache cleared (Supabase usage + Redis context persisted)');
}