-- ==============================================================================
-- Project Overlord — Founder Early Access Leads & Feedback Storage
-- File: scripts/setup_founder_leads_table.sql
--
-- Instructions: Run this SQL script in the Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Create the dedicated founder_leads table
CREATE TABLE IF NOT EXISTS public.founder_leads (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    email           text NOT NULL,
    user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    plan            text NOT NULL DEFAULT 'sub',
    license_key     text,
    feedback        text,
    auth_provider   text NOT NULL DEFAULT 'email', -- 'google', 'apple', 'email'
    ref             text,                           -- Rewardful referral / affiliate tracking
    user_agent      text
);

-- 2. Indexes for fast analytics & user lookup
CREATE INDEX IF NOT EXISTS idx_founder_leads_email ON public.founder_leads (email);
CREATE INDEX IF NOT EXISTS idx_founder_leads_created_at ON public.founder_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_founder_leads_plan ON public.founder_leads (plan);

-- 3. Enable Row-Level Security (RLS)
ALTER TABLE public.founder_leads ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Allow public (anon + authenticated) visitors to insert their claim & feedback
DROP POLICY IF EXISTS "Allow public insert to founder_leads" ON public.founder_leads;
CREATE POLICY "Allow public insert to founder_leads"
    ON public.founder_leads
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- 5. Policy: Allow authenticated users to view only their own records
DROP POLICY IF EXISTS "Allow users to read their own founder_leads" ON public.founder_leads;
CREATE POLICY "Allow users to read their own founder_leads"
    ON public.founder_leads
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR email = (auth.jwt() ->> 'email'));

-- 6. Also ensure waitlist table has feedback & plan columns as a fallback
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS feedback text;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS plan text;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS license_key text;

-- ==============================================================================
-- Verification Query (Run anytime to view all submitted founder feedback & emails):
-- SELECT created_at, email, plan, auth_provider, feedback, license_key, ref 
-- FROM public.founder_leads 
-- ORDER BY created_at DESC;
-- ==============================================================================
