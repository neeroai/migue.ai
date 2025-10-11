export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_usage_tracking: {
        Row: {
          conversation_id: string | null
          cost_usd: number
          created_at: string | null
          id: string
          metadata: Json | null
          model: string | null
          provider: string
          task_type: string
          tokens_input: number | null
          tokens_output: number | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          cost_usd: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          provider: string
          task_type: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          cost_usd?: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          provider?: string
          task_type?: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_tracking_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_tracking_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_tracking_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activity_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_tracking_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          call_id: string
          conversation_id: string | null
          created_at: string
          direction: string
          duration_seconds: number | null
          end_reason: string | null
          id: string
          status: string
          timestamp: string
          user_id: string
        }
        Insert: {
          call_id: string
          conversation_id?: string | null
          created_at?: string
          direction: string
          duration_seconds?: number | null
          end_reason?: string | null
          id?: string
          status: string
          timestamp?: string
          user_id: string
        }
        Update: {
          call_id?: string
          conversation_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          end_reason?: string | null
          id?: string
          status?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activity_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          status: Database["public"]["Enums"]["conv_status"] | null
          updated_at: string
          user_id: string
          wa_conversation_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["conv_status"] | null
          updated_at?: string
          user_id: string
          wa_conversation_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["conv_status"] | null
          updated_at?: string
          user_id?: string
          wa_conversation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activity_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          bucket: string
          created_at: string
          id: string
          metadata: Json | null
          path: string
          user_id: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: string
          metadata?: Json | null
          path: string
          user_id: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activity_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      embeddings: {
        Row: {
          chunk_index: number
          created_at: string
          document_id: string
          id: string
          metadata: Json | null
          vector: Json
        }
        Insert: {
          chunk_index: number
          created_at?: string
          document_id: string
          id?: string
          metadata?: Json | null
          vector: Json
        }
        Update: {
          chunk_index?: number
          created_at?: string
          document_id?: string
          id?: string
          metadata?: Json | null
          vector?: Json
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_sessions: {
        Row: {
          completed_at: string | null
          conversation_id: string | null
          created_at: string
          expires_at: string
          flow_id: string
          flow_token: string
          flow_type: string
          id: string
          response_data: Json | null
          session_data: Json | null
          status: Database["public"]["Enums"]["flow_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          expires_at?: string
          flow_id: string
          flow_token: string
          flow_type: string
          id?: string
          response_data?: Json | null
          session_data?: Json | null
          status?: Database["public"]["Enums"]["flow_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          expires_at?: string
          flow_id?: string
          flow_token?: string
          flow_type?: string
          id?: string
          response_data?: Json | null
          session_data?: Json | null
          status?: Database["public"]["Enums"]["flow_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activity_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gemini_usage: {
        Row: {
          cost: number | null
          created_at: string | null
          date: string
          requests: number | null
          tokens: number | null
          updated_at: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          date: string
          requests?: number | null
          tokens?: number | null
          updated_at?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          date?: string
          requests?: number | null
          tokens?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: Json
          created_at: string
          direction: Database["public"]["Enums"]["msg_direction"]
          id: string
          session_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          direction: Database["public"]["Enums"]["msg_direction"]
          id?: string
          session_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          direction?: Database["public"]["Enums"]["msg_direction"]
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      messages_v2: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["msg_direction"]
          id: string
          media_url: string | null
          timestamp: string
          type: Database["public"]["Enums"]["msg_type"]
          wa_message_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["msg_direction"]
          id?: string
          media_url?: string | null
          timestamp: string
          type: Database["public"]["Enums"]["msg_type"]
          wa_message_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["msg_direction"]
          id?: string
          media_url?: string | null
          timestamp?: string
          type?: Database["public"]["Enums"]["msg_type"]
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_v2_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_v2_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_windows: {
        Row: {
          created_at: string
          free_entry_point_expires_at: string | null
          id: string
          last_proactive_sent_at: string | null
          last_user_message_id: string | null
          phone_number: string
          proactive_messages_sent_today: number
          updated_at: string
          user_id: string
          window_expires_at: string
          window_opened_at: string
        }
        Insert: {
          created_at?: string
          free_entry_point_expires_at?: string | null
          id?: string
          last_proactive_sent_at?: string | null
          last_user_message_id?: string | null
          phone_number: string
          proactive_messages_sent_today?: number
          updated_at?: string
          user_id: string
          window_expires_at: string
          window_opened_at: string
        }
        Update: {
          created_at?: string
          free_entry_point_expires_at?: string | null
          id?: string
          last_proactive_sent_at?: string | null
          last_user_message_id?: string | null
          phone_number?: string
          proactive_messages_sent_today?: number
          updated_at?: string
          user_id?: string
          window_expires_at?: string
          window_opened_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messaging_windows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_activity_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_windows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string
          description: string | null
          id: string
          scheduled_time: string
          send_token: string | null
          status: Database["public"]["Enums"]["reminder_status"]
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          scheduled_time: string
          send_token?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          scheduled_time?: string
          send_token?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activity_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          message: string
          metadata: Json | null
          phone_number: string
          scheduled_at: string
          sent_at: string | null
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message: string
          metadata?: Json | null
          phone_number: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          phone_number?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activity_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          id: string
          user_phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_phone: string
        }
        Update: {
          created_at?: string
          id?: string
          user_phone?: string
        }
        Relationships: []
      }
      user_interactions: {
        Row: {
          button_title: string | null
          button_url: string | null
          conversation_id: string | null
          created_at: string
          id: string
          interaction_type: string
          metadata: Json | null
          timestamp: string
          user_id: string
        }
        Insert: {
          button_title?: string | null
          button_url?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          interaction_type: string
          metadata?: Json | null
          timestamp?: string
          user_id: string
        }
        Update: {
          button_title?: string | null
          button_url?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          interaction_type?: string
          metadata?: Json | null
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_interactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_interactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activity_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_locations: {
        Row: {
          address: string | null
          conversation_id: string | null
          created_at: string
          id: string
          latitude: number
          longitude: number
          name: string | null
          timestamp: string
          user_id: string
        }
        Insert: {
          address?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          name?: string | null
          timestamp?: string
          user_id: string
        }
        Update: {
          address?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string | null
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_locations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_locations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activity_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memory: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          relevance: number | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          relevance?: number | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          relevance?: number | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_memory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activity_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_memory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          id: string
          name: string | null
          phone_number: string
          preferences: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          phone_number: string
          preferences?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          phone_number?: string
          preferences?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      webhook_failures: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string
          id: string
          phone_number: string
          raw_payload: Json
          request_id: string
          retry_count: number | null
          status: string | null
          updated_at: string | null
          wa_message_id: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message: string
          id?: string
          phone_number: string
          raw_payload: Json
          request_id: string
          retry_count?: number | null
          status?: string | null
          updated_at?: string | null
          wa_message_id?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string
          id?: string
          phone_number?: string
          raw_payload?: Json
          request_id?: string
          retry_count?: number | null
          status?: string | null
          updated_at?: string | null
          wa_message_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      conversation_stats: {
        Row: {
          first_message_at: string | null
          id: string | null
          last_message_at: string | null
          message_count: number | null
          status: Database["public"]["Enums"]["conv_status"] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activity_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_windows_stats: {
        Row: {
          active_windows: number | null
          avg_proactive_per_active_user: number | null
          free_entry_active: number | null
          total_proactive_today: number | null
          total_windows: number | null
          windows_near_expiration: number | null
        }
        Relationships: []
      }
      user_activity_stats: {
        Row: {
          conversation_count: number | null
          id: string | null
          last_activity: string | null
          phone_number: string | null
          total_messages: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      find_windows_near_expiration: {
        Args: { hours_threshold?: number }
        Returns: {
          hours_remaining: number
          last_proactive_sent_at: string
          phone_number: string
          proactive_messages_sent_today: number
          user_id: string
          window_expires_at: string
        }[]
      }
      get_ai_cost_trends: {
        Args: { days?: number }
        Returns: {
          claude_cost: number
          date: string
          groq_cost: number
          openai_cost: number
          total_cost: number
          total_requests: number
        }[]
      }
      get_daily_ai_costs: {
        Args: { target_date?: string }
        Returns: {
          provider: string
          task_type: string
          total_cost: number
          total_requests: number
        }[]
      }
      get_pending_scheduled_messages: {
        Args: { before_time?: string }
        Returns: {
          conversation_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          message: string
          metadata: Json | null
          phone_number: string
          scheduled_at: string
          sent_at: string | null
          status: string
          updated_at: string | null
          user_id: string | null
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      increment_gemini_usage: {
        Args: { token_count: number; usage_date: string }
        Returns: {
          current_requests: number
          current_tokens: number
        }[]
      }
      is_free_entry_active: {
        Args: { p_phone_number: string }
        Returns: boolean
      }
      is_window_open: {
        Args: { p_phone_number: string }
        Returns: boolean
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      mark_message_failed: {
        Args: { error: string; message_id: string }
        Returns: undefined
      }
      mark_message_sent: {
        Args: { message_id: string }
        Returns: undefined
      }
      search_user_memory: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
          target_user_id: string
        }
        Returns: {
          category: string
          content: string
          created_at: string
          id: string
          similarity: number
          type: string
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      conv_status: "active" | "archived" | "closed"
      flow_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "expired"
        | "failed"
      msg_direction: "inbound" | "outbound"
      msg_type:
        | "text"
        | "image"
        | "audio"
        | "video"
        | "document"
        | "sticker"
        | "location"
        | "interactive"
        | "button"
        | "reaction"
        | "order"
        | "contacts"
        | "system"
        | "unknown"
      reminder_status: "pending" | "sent" | "cancelled" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      conv_status: ["active", "archived", "closed"],
      flow_status: ["pending", "in_progress", "completed", "expired", "failed"],
      msg_direction: ["inbound", "outbound"],
      msg_type: [
        "text",
        "image",
        "audio",
        "video",
        "document",
        "sticker",
        "location",
        "interactive",
        "button",
        "reaction",
        "order",
        "contacts",
        "system",
        "unknown",
      ],
      reminder_status: ["pending", "sent", "cancelled", "failed"],
    },
  },
} as const
