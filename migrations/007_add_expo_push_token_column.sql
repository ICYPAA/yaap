-- Migration: 007_add_expo_push_token_column.sql
-- Description: Adds expo_push_token column to the users table

-- Add the new column
ALTER TABLE users
ADD COLUMN expo_push_token TEXT;

-- Comment on the column to describe its purpose
COMMENT ON COLUMN users.expo_push_token IS 'Expo push notification token for sending notifications to this user';
