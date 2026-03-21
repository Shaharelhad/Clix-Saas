-- Google Sheets Knowledge Base Integration
-- Allows multiple documents per user (file + google_sheet) with source metadata

-- 1. Drop the unique constraint on user_id to allow multiple documents per user
ALTER TABLE user_documents DROP CONSTRAINT IF EXISTS user_documents_user_id_key;
DROP INDEX IF EXISTS user_documents_user_id_key;

-- 2. Add new columns for Google Sheets support
ALTER TABLE user_documents
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'file',
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_config JSONB DEFAULT '{}';

-- 3. Make storage_path nullable (Google Sheets don't have a storage file)
ALTER TABLE user_documents ALTER COLUMN storage_path DROP NOT NULL;

-- 4. Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_documents_user_source
  ON user_documents (user_id, source_type);
