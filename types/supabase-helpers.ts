/**
 * Supabase Type Helpers
 * Simplifies access to database types from database.types.ts
 * @see https://supabase.com/docs/guides/api/rest/generating-types
 */

import type { Database } from '../src/shared/infra/db/database.types'

/**
 * Helper type to access table row types
 * @example
 * type User = Tables<'users'> // Gets users.Row type
 * type UserInsert = TablesInsert<'users'> // Gets users.Insert type
 */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

/**
 * Helper type to access enum types
 * @example
 * type MsgDirection = Enums<'msg_direction'> // 'inbound' | 'outbound'
 */
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]

/**
 * Branded types for common entities (compile-time safety)
 */
export type UserId = string & { readonly __brand: 'UserId' }
export type ConversationId = string & { readonly __brand: 'ConversationId' }
export type MessageId = string & { readonly __brand: 'MessageId' }
export type ReminderId = string & { readonly __brand: 'ReminderId' }
export type DocumentId = string & { readonly __brand: 'DocumentId' }

/**
 * Helper to create branded IDs (runtime is still string)
 */
export const brandUserId = (id: string): UserId => id as UserId
export const brandConversationId = (id: string): ConversationId => id as ConversationId
export const brandMessageId = (id: string): MessageId => id as MessageId
export const brandReminderId = (id: string): ReminderId => id as ReminderId
export const brandDocumentId = (id: string): DocumentId => id as DocumentId

/**
 * Common query result types with joins
 */
export type ReminderWithUser = Tables<'reminders'> & {
  users: Tables<'users'> | null
}

export type MessageWithConversation = Tables<'messages_v2'> & {
  conversations: Tables<'conversations'> | null
}

export type ConversationWithUser = Tables<'conversations'> & {
  users: Tables<'users'> | null
}

export type EmbeddingWithDocument = Tables<'embeddings'> & {
  documents: Tables<'documents'> | null
}

/**
 * Metadata types for JSON columns
 */
export type UserPreferences = {
  timezone?: string
  language?: string
  notification_enabled?: boolean
  [key: string]: unknown
}

export type DocumentMetadata = {
  user_id?: string
  filename?: string
  mime_type?: string
  size_bytes?: number
  [key: string]: unknown
}

export type EmbeddingMetadata = {
  user_id?: string
  content_type?: string
  source?: string
  [key: string]: unknown
}

export type CalendarEventMetadata = {
  attendees?: string[]
  location?: string
  status?: string
  [key: string]: unknown
}
