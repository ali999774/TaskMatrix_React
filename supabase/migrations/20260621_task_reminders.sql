-- Add reminder column to tasks for local notification scheduling
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder text;
