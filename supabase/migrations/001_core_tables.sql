-- Migration 001: Core tables (users, conversations, messages)
-- Created: 2026-01-30
-- Purpose: Foundation tables for user management and messaging

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create enums
DO $$ BEGIN
  CREATE TYPE msg_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE msg_type AS ENUM (
    'text', 'image', 'audio', 'sticker', 'video', 'document', 'location',
    'interactive', 'button', 'reaction', 'order', 'contacts', 'system', 'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE conv_status AS ENUM ('active', 'archived', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table: users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE CHECK (phone_number ~ '^[+][1-9][0-9]{7,14}$'),
  whatsapp_name TEXT,
  display_name TEXT,
  language TEXT DEFAULT 'es',
  timezone TEXT DEFAULT 'America/Bogota',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'
);

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table: conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  whatsapp_conversation_id TEXT,
  status conv_status DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  context_summary TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table: messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction msg_direction NOT NULL,
  type msg_type NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  whatsapp_message_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Comments
COMMENT ON TABLE users IS 'User profiles and preferences';
COMMENT ON TABLE conversations IS 'Conversation grouping and metadata';
COMMENT ON TABLE messages IS 'Message history with full content';
