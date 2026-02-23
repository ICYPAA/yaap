-- Create committee_mappings table
create table public.committee_mappings (
  id serial primary key,
  input_name text not null,
  mapped_to text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users(id) on delete set null,

  -- Ensure input names are unique (case insensitive)
  constraint unique_input_name unique (input_name)
);

-- Add RLS policies
alter table public.committee_mappings enable row level security;

-- Allow authenticated users to view all mappings
create policy "Anyone can view committee mappings"
  on public.committee_mappings for select
  to anon
  using (true);

-- Allow any authenticated user to insert mappings
create policy "Authenticated users can insert committee mappings"
  on public.committee_mappings for insert
  to authenticated
  with check (true);

-- Allow any authenticated user to update mappings
create policy "Authenticated users can update committee mappings"
  on public.committee_mappings for update
  to authenticated
  using (true)
  with check (true);

-- Allow any authenticated user to delete mappings
create policy "Authenticated users can delete committee mappings"
  on public.committee_mappings for delete
  to authenticated
  using (true);

-- TEMPORARY: Allow anonymous users to insert/update/delete for development
create policy "Anonymous users can insert committee mappings (DEV)"
  on public.committee_mappings for insert
  to anon
  with check (true);

create policy "Anonymous users can update committee mappings (DEV)"
  on public.committee_mappings for update
  to anon
  using (true)
  with check (true);

create policy "Anonymous users can delete committee mappings (DEV)"
  on public.committee_mappings for delete
  to anon
  using (true);

-- Create updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger handle_updated_at
  before update on public.committee_mappings
  for each row
  execute function public.handle_updated_at();

-- Grant permissions
grant all on public.committee_mappings to authenticated;
grant all on public.committee_mappings to service_role;

-- Insert all existing committee mappings
insert into public.committee_mappings (input_name, mapped_to) values
-- Wisconsin
('wibidforicypaa', 'Wisconsin'),
('wibidforicypaa2025', 'Wisconsin'),
('wibidforicypaa2026', 'Wisconsin'),
('wisconsinbidforicypaa', 'Wisconsin'),
('wisconsinbidforicypaa2025', 'Wisconsin'),
('wisconsinbidforicypaa2026', 'Wisconsin'),
('wibidforicy', 'Wisconsin'),
('wiscbidforicypaa', 'Wisconsin'),
('wiscoicypaabid', 'Wisconsin'),
('wiicypaabid', 'Wisconsin'),
('wibid', 'Wisconsin'),
('wisconsin', 'Wisconsin'),

-- Michigan
('mib', 'Michigan'),
('michiganbid', 'Michigan'),
('michiganbidforicypaa', 'Michigan'),
('michigan', 'Michigan'),

-- Florida
('fbi', 'Florida'),
('fbiforcypaa', 'Florida'),
('floridabidforicypaa', 'Florida'),
('floridabid', 'Florida'),
('flbidforicypaa', 'Florida'),
('flicypaabid', 'Florida'),
('florida', 'Florida'),

-- SoCal Unified
('cabidforicypaa', 'SoCal Unified'),
('californiaicypaabid', 'SoCal Unified'),
('caicypaabid', 'SoCal Unified'),
('socalunified', 'SoCal Unified'),
('socal', 'SoCal Unified'),
('socalbid', 'SoCal Unified'),
('southerncalifornia', 'SoCal Unified'),
('southerncaliforniabid', 'SoCal Unified'),

-- Dallas
('txbidforicypaa', 'Dallas'),
('texasbidforicypaa', 'Dallas'),
('texasicypaabid', 'Dallas'),
('dallas', 'Dallas'),
('dallasbid', 'Dallas'),
('dallasbidforicypaa', 'Dallas'),

-- New York
('nybidforicypaa', 'New York Bid for ICYPAA'),
('newyorkbidforicypaa', 'New York Bid for ICYPAA'),
('nyicypaabid', 'New York Bid for ICYPAA'),

-- Chicago
('chicagobid', 'Chicago'),
('chicagobidforicypaa', 'Chicago'),
('chicago', 'Chicago'),

-- Memphis
('memphis', 'Memphis'),
('memphisbid', 'Memphis'),
('memphisbidforicypaa', 'Memphis'),
('tnbid', 'Memphis'),
('tennesseebid', 'Memphis'),

-- Arizona
('arizona', 'Arizona'),
('arizonabid', 'Arizona'),
('arizonabidforicypaa', 'Arizona'),
('azbid', 'Arizona'),
('azbidforicypaa', 'Arizona'),
('phoenixbid', 'Arizona'),

-- CIA (Seattle)
('cia', 'CIA (Seattle)'),
('ciaseattle', 'CIA (Seattle)'),
('seattle', 'CIA (Seattle)'),
('seattlebid', 'CIA (Seattle)'),
('seattlebidforicypaa', 'CIA (Seattle)'),
('washingtonbid', 'CIA (Seattle)'),
('wabid', 'CIA (Seattle)'),

-- Denver
('denver', 'Denver'),
('denverbid', 'Denver'),
('denverbidforicypaa', 'Denver'),
('coloradobid', 'Denver'),
('cobid', 'Denver'),

-- ICYPAA Host Committees
('64thicypaa', '64th ICYPAA'),
('64thicypaahostcommittee', '64th ICYPAA'),
('64thicypaaphoenix', '64th ICYPAA'),
('64thicypaahost', '64th ICYPAA'),

('65thicypaa', '65th ICYPAA'),
('65thicypaahostcommittee', '65th ICYPAA'),
('65thicypaamadison', '65th ICYPAA'),
('65thicypaahost', '65th ICYPAA'),
('65thicypaawisconsin', '65th ICYPAA'),

('66thicypaa', '66th ICYPAA'),
('66thicypaahostcommittee', '66th ICYPAA'),
('66thicypaahost', '66th ICYPAA'),

-- Advisory and Council
('advisory', 'Advisory/Council'),
('advisorycommittee', 'Advisory/Council'),
('council', 'Advisory/Council'),
('councilcommittee', 'Advisory/Council'),
('icypaaadvisory', 'Advisory/Council'),
('icypaacouncil', 'Advisory/Council'),
('aaadvisory', 'Advisory/Council'),
('aacouncil', 'Advisory/Council'),

-- General YPAA Groups
('ypaa', 'YPAA'),
('youngpeopleaa', 'YPAA'),
('youngpeople', 'YPAA'),
('yp', 'YPAA'),

-- Regional YPAA
('wiscypaa', 'Wisconsin YPAA'),
('wisconsinypaa', 'Wisconsin YPAA'),
('wiypaa', 'Wisconsin YPAA'),

('flypaa', 'Florida YPAA'),
('floridaypaa', 'Florida YPAA'),

('caypaa', 'California YPAA'),
('californiaypaa', 'California YPAA'),

('txypaa', 'Texas YPAA'),
('texasypaa', 'Texas YPAA'),

('nyyyypaa', 'New York YPAA'),
('newyorkypaa', 'New York YPAA'),

-- Other common variations
('none', 'None/Unaffiliated'),
('nocommittee', 'None/Unaffiliated'),
('unaffiliated', 'None/Unaffiliated'),
('individual', 'None/Unaffiliated'),
('n/a', 'None/Unaffiliated'),
('na', 'None/Unaffiliated'),

('other', 'Other'),
('misc', 'Other'),
('miscellaneous', 'Other');