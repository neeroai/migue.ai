/**
 * Document processing module
 * Handles PDF extraction and image analysis from WhatsApp messages
 */

import { pdf } from 'pdf-parse'
import { downloadWhatsAppMedia } from './whatsapp-media'
import { saveDocumentToStorage } from './storage'
import { getOpenAIClient } from './openai'
import { logger } from './logger'

export type ProcessedDocument = {
  id: string
  text: string
  type: 'pdf' | 'image' | 'unsupported'
  mimeType: string
  metadata: {
    pageCount?: number
    hasImages?: boolean
    fileName?: string
    processingTime: number
  }
  storageUri: string
}

export type ImageAnalysis = {
  description: string
  extractedText: string | null
  hasText: boolean
}

/**
 * Extract text from PDF bytes using pdf-parse
 */
async function extractPDFText(bytes: Uint8Array): Promise<{ text: string; pageCount: number }> {
  try {
    const data = await pdf(Buffer.from(bytes)) as any
    return {
      text: data.text?.trim() ?? '',
      pageCount: data.numpages ?? 1,
    }
  } catch (error: any) {
    logger.error('PDF extraction error', error)
    throw new Error(`Failed to extract PDF text: ${error?.message ?? 'Unknown error'}`)
  }
}

/**
 * Analyze image using GPT-4o Vision
 */
async function analyzeImage(bytes: Uint8Array, mimeType: string): Promise<ImageAnalysis> {
  const client = getOpenAIClient()

  // Convert bytes to base64 for OpenAI API
  const base64 = Buffer.from(bytes).toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64}`

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analiza esta imagen y extrae:
1. Una descripción detallada del contenido
2. Todo el texto visible (si hay)
3. Información relevante y estructurada

Responde en formato JSON:
{
  "description": "descripción detallada",
  "extractedText": "texto visible o null",
  "hasText": true/false
}`,
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.2,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('OpenAI returned empty response')
    }

    // Parse JSON response
    const parsed = JSON.parse(content) as ImageAnalysis
    return parsed
  } catch (error: any) {
    logger.error('Image analysis error', error)
    throw new Error(`Failed to analyze image: ${error?.message ?? 'Unknown error'}`)
  }
}

/**
 * Process document based on MIME type
 */
export async function processDocument(
  mediaId: string,
  userId: string,
  caption?: string | null
): Promise<ProcessedDocument> {
  const startTime = Date.now()

  // Download media from WhatsApp
  const media = await downloadWhatsAppMedia(mediaId)
  const bytes = media.bytes instanceof Uint8Array ? media.bytes : new Uint8Array(media.bytes)

  // Determine document type
  const isPDF = media.mimeType === 'application/pdf'
  const isImage = media.mimeType.startsWith('image/')

  let text = ''
  let docType: 'pdf' | 'image' | 'unsupported' = 'unsupported'
  let metadata: ProcessedDocument['metadata'] = {
    processingTime: 0,
  }

  if (isPDF) {
    // Process PDF
    const result = await extractPDFText(bytes)
    text = result.text
    docType = 'pdf'
    metadata.pageCount = result.pageCount
    metadata.hasImages = false // We'll enhance this later with image detection
  } else if (isImage) {
    // Process image with Vision
    const analysis = await analyzeImage(bytes, media.mimeType)

    // Combine description and extracted text
    text = analysis.description
    if (analysis.extractedText) {
      text += `\n\nTexto extraído:\n${analysis.extractedText}`
    }

    docType = 'image'
    metadata.hasImages = true
  } else {
    throw new Error(`Unsupported document type: ${media.mimeType}`)
  }

  // Add caption if provided
  if (caption) {
    text = `Nota del usuario: ${caption}\n\n${text}`
  }

  // Save to storage
  const extension = isPDF ? 'pdf' : media.mimeType.split('/')[1] ?? 'bin'
  const saved = await saveDocumentToStorage(userId, mediaId, bytes, media.mimeType, extension)

  metadata.processingTime = Date.now() - startTime
  metadata.fileName = `${mediaId}.${extension}`

  return {
    id: mediaId,
    text,
    type: docType,
    mimeType: media.mimeType,
    metadata,
    storageUri: saved.storageUri,
  }
}

/**
 * Generate summary of processed document
 */
export async function generateDocumentSummary(doc: ProcessedDocument): Promise<string> {
  const client = getOpenAIClient()

  const prompt = doc.type === 'pdf'
    ? `Resume este documento PDF en 2-3 párrafos concisos. Destaca los puntos clave y la información más relevante:\n\n${doc.text.slice(0, 8000)}`
    : `Describe esta imagen de forma concisa y útil para el usuario:\n\n${doc.text.slice(0, 2000)}`

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que resume documentos de forma clara y concisa en español.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    })

    const summary = response.choices[0]?.message?.content
    if (!summary) {
      throw new Error('OpenAI returned empty summary')
    }

    return summary
  } catch (error: any) {
    logger.error('Summary generation error', error)
    return `He procesado tu ${doc.type === 'pdf' ? 'documento PDF' : 'imagen'}. Contiene ${doc.text.length} caracteres de información.`
  }
}
