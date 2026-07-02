-- Migration: Add series_id to tasks to link recurring occurrences together

ALTER TABLE tasks
ADD COLUMN series_id UUID;
