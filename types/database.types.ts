/**
 * Supabase Database Types
 * Generated from supabase/schema.sql
 * @see docs/SUPABASE.md
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string
          user_phone: string
          created_at: string
        }
        Insert: {
          id?: string
          user_phone: string
          created_at?: string
        }
        Update: {
          id?: string
          user_phone?: string
          created_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          session_id: string
          direction: Database['public']['Enums']['msg_direction']
          content: Json
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          direction: Database['public']['Enums']['msg_direction']
          content: Json
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          direction?: Database['public']['Enums']['msg_direction']
          content?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_session_id_fkey'
            columns: ['session_id']
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          }
        ]
      }
      users: {
        Row: {
          id: string
          phone_number: string
          name: string | null
          preferences: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          phone_number: string
          name?: string | null
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone_number?: string
          name?: string | null
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          wa_conversation_id: string | null
          status: Database['public']['Enums']['conv_status']
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          wa_conversation_id?: string | null
          status?: Database['public']['Enums']['conv_status']
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          wa_conversation_id?: string | null
          status?: Database['public']['Enums']['conv_status']
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'conversations_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      messages_v2: {
        Row: {
          id: string
          conversation_id: string
          direction: Database['public']['Enums']['msg_direction']
          type: Database['public']['Enums']['msg_type']
          content: string | null
          media_url: string | null
          wa_message_id: string | null
          timestamp: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          direction: Database['public']['Enums']['msg_direction']
          type: Database['public']['Enums']['msg_type']
          content?: string | null
          media_url?: string | null
          wa_message_id?: string | null
          timestamp: string
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          direction?: Database['public']['Enums']['msg_direction']
          type?: Database['public']['Enums']['msg_type']
          content?: string | null
          media_url?: string | null
          wa_message_id?: string | null
          timestamp?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_v2_conversation_id_fkey'
            columns: ['conversation_id']
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          }
        ]
      }
      reminders: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          scheduled_time: string
          status: Database['public']['Enums']['reminder_status']
          created_at: string
          send_token: string | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          scheduled_time: string
          status?: Database['public']['Enums']['reminder_status']
          created_at?: string
          send_token?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          scheduled_time?: string
          status?: Database['public']['Enums']['reminder_status']
          created_at?: string
          send_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'reminders_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      calendar_credentials: {
        Row: {
          id: string
          user_id: string
          provider: string
          refresh_token: string
          access_token: string | null
          access_token_expires_at: string | null
          scope: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider?: string
          refresh_token: string
          access_token?: string | null
          access_token_expires_at?: string | null
          scope?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: string
          refresh_token?: string
          access_token?: string | null
          access_token_expires_at?: string | null
          scope?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'calendar_credentials_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      calendar_events: {
        Row: {
          id: string
          user_id: string
          provider: string
          external_id: string
          summary: string
          description: string | null
          start_time: string
          end_time: string
          meeting_url: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider?: string
          external_id: string
          summary: string
          description?: string | null
          start_time: string
          end_time: string
          meeting_url?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: string
          external_id?: string
          summary?: string
          description?: string | null
          start_time?: string
          end_time?: string
          meeting_url?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'calendar_events_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      conversation_actions: {
        Row: {
          id: string
          conversation_id: string
          user_id: string
          action_type: string
          payload: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          user_id: string
          action_type: string
          payload?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          user_id?: string
          action_type?: string
          payload?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'conversation_actions_conversation_id_fkey'
            columns: ['conversation_id']
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversation_actions_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      follow_up_jobs: {
        Row: {
          id: string
          user_id: string
          conversation_id: string
          category: string
          status: Database['public']['Enums']['follow_up_status']
          scheduled_for: string
          payload: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          conversation_id: string
          category: string
          status?: Database['public']['Enums']['follow_up_status']
          scheduled_for: string
          payload?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          conversation_id?: string
          category?: string
          status?: Database['public']['Enums']['follow_up_status']
          scheduled_for?: string
          payload?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'follow_up_jobs_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'follow_up_jobs_conversation_id_fkey'
            columns: ['conversation_id']
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          }
        ]
      }
      documents: {
        Row: {
          id: string
          user_id: string
          bucket: string
          path: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bucket: string
          path: string
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bucket?: string
          path?: string
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'documents_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      embeddings: {
        Row: {
          id: string
          document_id: string
          chunk_index: number
          vector: Json
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          chunk_index: number
          vector: Json
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          chunk_index?: number
          vector?: Json
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'embeddings_document_id_fkey'
            columns: ['document_id']
            referencedRelation: 'documents'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      msg_direction: 'inbound' | 'outbound'
      conv_status: 'active' | 'archived' | 'closed'
      msg_type:
        | 'text'
        | 'image'
        | 'audio'
        | 'video'
        | 'document'
        | 'location'
        | 'interactive'
        | 'button'
        | 'contacts'
        | 'system'
        | 'unknown'
      reminder_status: 'pending' | 'sent' | 'cancelled' | 'failed'
      follow_up_status: 'pending' | 'sent' | 'failed' | 'cancelled'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
