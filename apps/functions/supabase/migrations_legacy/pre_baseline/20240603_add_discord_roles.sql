-- Add discord_roles column to profile-names table if it doesn't exist
ALTER TABLE "profile-names"
ADD COLUMN IF NOT EXISTS discord_roles JSONB DEFAULT '[]'::JSONB;

-- Add comment for the column
COMMENT ON COLUMN "profile-names".discord_roles IS 'Array of Discord role IDs for the user in the ICYPAA server';

-- Update existing records to have an empty array if null
UPDATE "profile-names"
SET discord_roles = '[]'::JSONB
WHERE discord_roles IS NULL;