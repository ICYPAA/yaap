-- This script updates the hospitality_hours table to the new schema
-- Run this in your Supabase SQL editor if the migration hasn't been applied

-- First, check if the table exists and what columns it has
DO $$ 
BEGIN
    -- Check if date_time column exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'hospitality_hours' 
        AND column_name = 'date_time'
    ) THEN
        RAISE NOTICE 'Table already has new schema, no changes needed';
    ELSE
        -- Table exists but needs updating
        IF EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_name = 'hospitality_hours'
        ) THEN
            RAISE NOTICE 'Dropping old table to recreate with new schema';
            DROP TABLE IF EXISTS hospitality_hours CASCADE;
        END IF;
        
        -- Now run the create table from the migration
        -- (The actual CREATE TABLE statement will be run after this block)
    END IF;
END $$;

-- Only create the table if it doesn't exist
-- Copy this from the migration file:
-- /supabase/migrations/20250117_create_hospitality_hours_table.sql