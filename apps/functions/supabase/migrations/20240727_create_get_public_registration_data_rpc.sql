create or replace function get_public_registration_data()
returns table (
  country text,
  committee text,
  city_state text,
  order_date text,
  report_created_at timestamptz
)
security definer
as $$
begin
  return query
  select
    (d->>'Country')::text as country,
    (d->>'Committee')::text as committee,
    (d->>'City, State')::text as city_state,
    (d->>'Order date')::text as order_date,
    r.created_at as report_created_at
  from
    registrations r,
    jsonb_array_elements(r.data) as d
  where
    r.id = (select id from registrations order by created_at desc limit 1);
end;
$$ language plpgsql;

-- Grant execute permission to anonymous users
grant execute on function get_public_registration_data() to anon;

