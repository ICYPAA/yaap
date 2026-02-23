-- Add temporary DEV policies for anonymous users to access committee mappings
-- This allows development to work without requiring authentication

-- TEMPORARY: Allow anonymous users to insert committee mappings for development
create policy "Anonymous users can insert committee mappings (DEV)"
  on public.committee_mappings for insert
  to anon
  with check (true);

-- TEMPORARY: Allow anonymous users to update committee mappings for development
create policy "Anonymous users can update committee mappings (DEV)"
  on public.committee_mappings for update
  to anon
  using (true)
  with check (true);

-- TEMPORARY: Allow anonymous users to delete committee mappings for development
create policy "Anonymous users can delete committee mappings (DEV)"
  on public.committee_mappings for delete
  to anon
  using (true);