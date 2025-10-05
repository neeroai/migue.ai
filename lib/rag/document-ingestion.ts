/**
 * Document ingestion module for RAG system
 * Processes documents and stores them with embeddings for semantic search
 */

// Type-only import (no runtime impact - Edge compatible)
import type { ProcessedDocument } from '../document-processor'
import { ingestDocument } from './index'
import { logger } from '../logger'

export type DocumentIngestionResult = {
  documentId: string
  chunksCreated: number
  summary: string
  document: ProcessedDocument
}

/**
 * Ingest document from WhatsApp into RAG system
 *
 * Flow:
 * 1. Download and process document (PDF/image)
 * 2. Extract text content
 * 3. Chunk text for optimal embedding
 * 4. Generate embeddings and store in database
 * 5. Generate summary for user
 */
export async function ingestWhatsAppDocument(
  mediaId: string,
  userId: string,
  caption?: string | null
): Promise<DocumentIngestionResult> {
  const startTime = Date.now()

  // Lazy load document processor (Edge Runtime incompatible - uses pdf-parse)
  // Only loads when actually called (fallback path in ai-processing-v2.ts)
  const { processDocument, generateDocumentSummary } = await import('../document-processor')

  // Process document
  logger.info('Processing document', { userId, metadata: { mediaId } })
  const document = await processDocument(mediaId, userId, caption)

  if (!document.text || document.text.trim().length === 0) {
    throw new Error('No text content extracted from document')
  }

  logger.info('Document processed', {
    userId,
    metadata: {
      mediaId,
      type: document.type,
      textLength: document.text.length,
      processingTime: document.metadata.processingTime,
    },
  })

  // Ingest into RAG system
  const chunksCreated = await ingestDocument(userId, mediaId, document.text)

  logger.info('Document ingested to RAG', {
    userId,
    metadata: {
      mediaId,
      chunksCreated,
      totalTime: Date.now() - startTime,
    },
  })

  // Generate summary
  const summary = await generateDocumentSummary(document)

  return {
    documentId: mediaId,
    chunksCreated,
    summary,
    document,
  }
}

/**
 * Get formatted ingestion response for user
 */
export function formatIngestionResponse(result: DocumentIngestionResult): string {
  const { document, chunksCreated, summary } = result

  const typeLabel = document.type === 'pdf' ? 'PDF' : 'imagen'
  const header = `✅ He procesado tu ${typeLabel} correctamente.`

  let details = ''
  if (document.type === 'pdf' && document.metadata.pageCount) {
    details = `\n📄 ${document.metadata.pageCount} página${document.metadata.pageCount > 1 ? 's' : ''}`
  }

  details += `\n💾 ${chunksCreated} fragmento${chunksCreated > 1 ? 's' : ''} almacenado${chunksCreated > 1 ? 's' : ''}`
  details += `\n⏱️ ${Math.round(document.metadata.processingTime / 1000)}s de procesamiento`

  return `${header}${details}\n\n${summary}\n\n💡 Puedo responder preguntas sobre este documento. Solo pregunta!`
}
