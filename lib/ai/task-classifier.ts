/**
 * @file task-classifier.ts
 * @description Task classification for intelligent model routing based on message characteristics
 * @module lib/ai
 * @exports classifyTask, TaskCategory, TaskClassification
 * @date 2026-01-30 14:00
 * @updated 2026-01-30 14:00
 */

export type TaskCategory =
  | 'simple-query'      // Gemini 3 Flash - Quick responses, no tools
  | 'single-tool'       // Cohere Command R7B - One tool execution
  | 'multi-tool'        // Cohere Command R7B - Multiple tool orchestration
  | 'voice-message'     // Gemini 2.5 Flash - WhatsApp audio
  | 'image-document'    // Gemini 2.5 Flash - Photos, receipts, PDFs
  | 'spanish-conversation' // GPT-4o OR Mistral Magistral - Personality + warmth
  | 'complex-reasoning' // DeepSeek R1 Turbo - Thinking mode, analysis
  | 'fallback';         // GPT-4o-mini - Safe default

export interface TaskClassification {
  category: TaskCategory;
  confidence: number; // 0-1
  estimatedTokens: number;
  complexity: number; // 0-10
  toolCount: number;
  reasoning: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface Tool {
  name: string;
  description: string;
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Detect tool intent from message using keyword patterns
 */
function detectToolIntent(message: string, availableTools: Tool[]): string[] {
  const detectedTools: string[] = [];
  const lowerMessage = message.toLowerCase();

  // Tool detection patterns (Spanish + English)
  const toolPatterns: Record<string, string[]> = {
    'reminder': ['recordatorio', 'recuérdame', 'recordar', 'remind me', 'reminder'],
    'calendar': ['calendario', 'agenda', 'evento', 'reunión', 'calendar', 'event', 'meeting'],
    'expense': ['gasto', 'gasté', 'gastó', 'pagué', 'compré', 'expense', 'spent', 'paid'],
    'search': ['busca', 'encuentra', 'dónde', 'search', 'find', 'where'],
    'weather': ['clima', 'tiempo', 'temperatura', 'weather', 'temperature'],
    'timer': ['temporizador', 'cronómetro', 'timer', 'countdown']
  };

  for (const [tool, keywords] of Object.entries(toolPatterns)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      detectedTools.push(tool);
    }
  }

  return detectedTools;
}

/**
 * Detect reasoning keywords indicating complex thought required
 */
function hasReasoningKeywords(message: string): boolean {
  const reasoningPatterns = [
    /por qué/i,
    /analiza/i,
    /sugiere/i,
    /optimiza/i,
    /compara/i,
    /recomienda/i,
    /estrategia/i,
    /explain why/i,
    /analyze/i,
    /suggest/i,
    /optimize/i,
    /compare/i,
    /recommend/i,
    /strategy/i
  ];

  return reasoningPatterns.some(pattern => pattern.test(message));
}

/**
 * Detect if message is primarily Spanish
 */
function isSpanish(message: string): boolean {
  const spanishIndicators = /[¿¡áéíóúñü]/i.test(message);
  const spanishWords = ['qué', 'cómo', 'cuándo', 'dónde', 'quién', 'tengo', 'hacer', 'hoy', 'mañana'];
  const wordCount = spanishWords.filter(word => message.toLowerCase().includes(word)).length;

  return spanishIndicators || wordCount >= 2;
}

/**
 * Classify task based on message characteristics
 *
 * @param message - User message text
 * @param messageType - Message type (text, voice, image, document)
 * @param conversationHistory - Previous messages for context
 * @param availableTools - Tools that can be called
 * @returns TaskClassification with category, confidence, and metadata
 */
export function classifyTask(
  message: string,
  messageType: 'text' | 'voice' | 'image' | 'document',
  conversationHistory: Message[],
  availableTools: Tool[] = []
): TaskClassification {
  // Priority 1: Multimodal routing
  if (messageType === 'voice') {
    return {
      category: 'voice-message',
      confidence: 1.0,
      estimatedTokens: estimateTokens(message),
      complexity: 4,
      toolCount: 0,
      reasoning: 'Voice message detected - using Gemini 2.5 Flash for native audio processing'
    };
  }

  if (messageType === 'image' || messageType === 'document') {
    return {
      category: 'image-document',
      confidence: 1.0,
      estimatedTokens: estimateTokens(message),
      complexity: 5,
      toolCount: 0,
      reasoning: 'Image/document detected - using Gemini 2.5 Flash for native vision processing'
    };
  }

  // Priority 2: Text routing based on characteristics
  const tokenEstimate = estimateTokens(message);
  const hasReasoning = hasReasoningKeywords(message);
  const detectedTools = detectToolIntent(message, availableTools);
  const isSpanishMsg = isSpanish(message);
  const isLongConversation = conversationHistory.length > 5;

  // Complex reasoning: Check BEFORE tool detection (reasoning takes priority)
  if (hasReasoning && detectedTools.length === 0) {
    return {
      category: 'complex-reasoning',
      confidence: 0.85,
      estimatedTokens: tokenEstimate,
      complexity: 8,
      toolCount: 0,
      reasoning: 'Reasoning keywords detected - using DeepSeek R1 Turbo for thinking mode'
    };
  }

  // Multi-tool: Multiple tools detected
  if (detectedTools.length > 1) {
    return {
      category: 'multi-tool',
      confidence: 0.85,
      estimatedTokens: tokenEstimate,
      complexity: 7,
      toolCount: detectedTools.length,
      reasoning: `${detectedTools.length} tools detected - using Cohere R7B for orchestration`
    };
  }

  // Single tool: One tool detected
  if (detectedTools.length === 1) {
    return {
      category: 'single-tool',
      confidence: 0.9,
      estimatedTokens: tokenEstimate,
      complexity: 3,
      toolCount: 1,
      reasoning: `Single tool (${detectedTools[0]}) detected - using Cohere R7B for tool calling`
    };
  }

  // Spanish conversation: Personality-heavy, ongoing dialogue (check AFTER tools)
  // Require >5 messages history AND Spanish message (any length)
  if (isSpanishMsg && isLongConversation) {
    return {
      category: 'spanish-conversation',
      confidence: 0.8,
      estimatedTokens: tokenEstimate,
      complexity: 5,
      toolCount: 0,
      reasoning: 'Spanish conversation with context - using GPT-4o for personality + warmth'
    };
  }

  // Simple query: Short message, no tools, no reasoning
  if (tokenEstimate < 75 && detectedTools.length === 0 && !hasReasoning) {
    return {
      category: 'simple-query',
      confidence: 0.9,
      estimatedTokens: tokenEstimate,
      complexity: 1,
      toolCount: 0,
      reasoning: 'Short query (<75 tokens), no tools detected - using Gemini 3 Flash for speed'
    };
  }

  // Fallback: Conservative default (medium-length message without clear signals)
  if (tokenEstimate >= 75 || !isSpanishMsg) {
    return {
      category: 'fallback',
      confidence: 0.6,
      estimatedTokens: tokenEstimate,
      complexity: 4,
      toolCount: 0,
      reasoning: 'No strong classification signal - using GPT-4o-mini as safe default'
    };
  }

  // Final fallback: Default to simple-query
  return {
    category: 'simple-query',
    confidence: 0.5,
    estimatedTokens: tokenEstimate,
    complexity: 2,
    toolCount: 0,
    reasoning: 'Default classification - using Gemini 3 Flash'
  };
}
