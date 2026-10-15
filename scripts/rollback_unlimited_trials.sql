-- ==============================================================================
-- Project Overlord — Rollback Script: Restore Standard 30-Minute Trial Limits
-- File: scripts/rollback_unlimited_trials.sql
--
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR WHEN READY TO RE-ENABLE PAID SUBSCRIPTIONS:
-- This restores the standard 30-minute (+3 min grace = 1,980 seconds) trial limit
-- for all new accounts and resets the plans definition.
-- ==============================================================================

-- 1. Restore the default limit for new machines to 1,980 seconds (33 minutes)
ALTER TABLE public.trial_runtime 
  ALTER COLUMN limit_seconds SET DEFAULT 1980;

-- 2. Restore the free plan specification in public.plans
UPDATE public.plans 
  SET trial_runtime_seconds = 1980 
  WHERE id = 'free';

-- 3. (Optional) For users created during the free promotion whom you want to reset to standard:
-- UPDATE public.trial_runtime 
--   SET limit_seconds = 1980,
--       seconds_used = LEAST(seconds_used, 1980)
--   WHERE limit_seconds > 1980;
