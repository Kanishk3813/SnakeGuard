-- Fix Row Level Security (RLS) for snake_detections table
-- This allows the Raspberry Pi to insert detections using the anon key

-- Option 1: Allow service role to bypass RLS (recommended for IoT devices)
-- The service role key bypasses RLS, so if you use SUPABASE_SERVICE_ROLE_KEY on Pi, this isn't needed

-- Option 2: Create RLS policy to allow inserts from anon key
-- This is safer but requires a policy

-- Check if RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'snake_detections';

-- If you want to allow anon key inserts, create this policy:
CREATE POLICY IF NOT EXISTS "Allow anon inserts to snake_detections"
  ON snake_detections
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Also allow service role (bypasses RLS anyway, but good to be explicit)
CREATE POLICY IF NOT EXISTS "Allow service role full access to snake_detections"
  ON snake_detections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow reads for authenticated users
CREATE POLICY IF NOT EXISTS "Allow authenticated users to read snake_detections"
  ON snake_detections
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Allow updates for authenticated users (for status changes, etc.)
CREATE POLICY IF NOT EXISTS "Allow authenticated users to update snake_detections"
  ON snake_detections
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);


