-- Migration: 006_add_status_owner_columns.sql
-- Description: Adds status and owner_id columns to all service-related tables

-- Add status and owner_id to accessibility_forms
ALTER TABLE accessibility_forms
ADD COLUMN status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add status and owner_id to ride_forms
ALTER TABLE ride_forms
ADD COLUMN status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add status and owner_id to hospitality_forms
ALTER TABLE hospitality_forms
ADD COLUMN status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add status and owner_id to support_chats if not already present
-- Support chats may already have a status field, so we check first
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'support_chats' AND column_name = 'status') THEN
    ALTER TABLE support_chats
    ADD COLUMN status TEXT NOT NULL DEFAULT 'unread';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'support_chats' AND column_name = 'owner_id') THEN
    ALTER TABLE support_chats
    ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for improved query performance
CREATE INDEX IF NOT EXISTS idx_accessibility_forms_status ON accessibility_forms(status);
CREATE INDEX IF NOT EXISTS idx_accessibility_forms_owner ON accessibility_forms(owner_id);

CREATE INDEX IF NOT EXISTS idx_ride_forms_status ON ride_forms(status);
CREATE INDEX IF NOT EXISTS idx_ride_forms_owner ON ride_forms(owner_id);

CREATE INDEX IF NOT EXISTS idx_hospitality_forms_status ON hospitality_forms(status);
CREATE INDEX IF NOT EXISTS idx_hospitality_forms_owner ON hospitality_forms(owner_id);

CREATE INDEX IF NOT EXISTS idx_support_chats_status ON support_chats(status);
CREATE INDEX IF NOT EXISTS idx_support_chats_owner ON support_chats(owner_id);