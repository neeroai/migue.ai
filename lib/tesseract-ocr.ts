/**
 * Tesseract OCR Client
 * 100% FREE optical character recognition
 * Alternative to GPT-4 Vision ($0.002/image) or Claude Vision ($0.0002/image)
 *
 * Best for: Text extraction from images, documents, screenshots
 * Languages: 100+ including Spanish, English, Portuguese
 */

import { createWorker, OEM, PSM } from 'tesseract.js'
import { logger } from './logger'

export type OCRLanguage = 'spa' | 'eng' | 'por' | 'spa+eng'

export type OCROptions = {
  language?: OCRLanguage
  pageSegMode?: PSM
  oem?: OEM
}

/**
 * Extract text from image using Tesseract OCR
 * Cost: $0 (100% free!)
 */
export async function extractTextFromImage(
  image: Uint8Array | string,
  options?: OCROptions
): Promise<string> {
  const worker = await createWorker(options?.language || 'spa', 1, {
    // Specify CDN paths for Vercel Edge Runtime WASM compatibility
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6/tesseract-core-simd.wasm',
  })

  try {
    // Configure Tesseract
    if (options?.pageSegMode) {
      await worker.setParameters({
        tessedit_pageseg_mode: options.pageSegMode,
      })
    }

    // Convert Uint8Array to Blob for Edge Runtime compatibility
    const imageInput = image instanceof Uint8Array
      ? new Blob([image as BlobPart], { type: 'image/jpeg' })
      : image

    // Perform OCR
    const { data } = await worker.recognize(imageInput)

    if (!data.text.trim()) {
      throw new Error('Tesseract returned empty text')
    }

    logger.info('Tesseract OCR successful', {
      metadata: {
        language: options?.language || 'spa',
        textLength: data.text.length,
        confidence: data.confidence,
      },
    })

    return data.text.trim()
  } catch (error: any) {
    logger.error('Tesseract OCR failed', error, {
      metadata: { language: options?.language },
    })
    throw error
  } finally {
    await worker.terminate()
  }
}

/**
 * Extract text with layout analysis
 * Better for documents with complex formatting
 */
export async function extractTextWithLayout(
  image: Uint8Array | string,
  language?: OCRLanguage
): Promise<string> {
  return extractTextFromImage(image, {
    language: language || 'spa',
    pageSegMode: PSM.AUTO, // Automatic page segmentation
  })
}

/**
 * Extract single line of text
 * Faster for simple text extraction (e.g., prices, labels)
 */
export async function extractSingleLine(
  image: Uint8Array | string,
  language?: OCRLanguage
): Promise<string> {
  return extractTextFromImage(image, {
    language: language || 'spa',
    pageSegMode: PSM.SINGLE_LINE,
  })
}

/**
 * Hybrid OCR + AI approach
 * Use Tesseract for text extraction, then Claude for comprehension
 */
export async function ocrWithAIComprehension(
  image: Uint8Array,
  comprehensionPrompt: string,
  aiProvider: 'claude' | 'openai' = 'claude'
): Promise<{ text: string; analysis: string }> {
  // Step 1: Free OCR with Tesseract
  const extractedText = await extractTextFromImage(image)

  // Step 2: AI comprehension (use cheaper Claude or existing OpenAI)
  // This will be implemented when we create claude-client.ts

  return {
    text: extractedText,
    analysis: 'AI analysis pending - implement in next step',
  }
}

/**
 * Cost comparison helper
 */
export function comparOCRCosts(numImages: number) {
  return {
    tesseract: 0, // Always free!
    claude: numImages * 0.0002, // $0.0002 per image
    openai: numImages * 0.002, // $0.002 per image (10x more expensive)
    savings: {
      vsClaude: `$${(numImages * 0.0002).toFixed(4)}`,
      vsOpenAI: `$${(numImages * 0.002).toFixed(4)}`,
    },
  }
}
