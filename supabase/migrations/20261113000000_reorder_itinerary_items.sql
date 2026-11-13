-- NOT YET APPLIED. Review, then run once in the Supabase SQL editor.
--
-- Saves a new timeline order in one statement, so it either fully succeeds or
-- fully fails. Runs with the caller's own permissions (security invoker), so
-- the existing row access rules on itinerary_items still decide who may do it.
-- Ids are passed as text and compared as text so this works whether the id
-- columns are uuid or text.
--
-- Until this exists the app falls back to separate updates (with error checks).

create or replace function public.reorder_itinerary_items(p_trip_id text, p_ids text[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  expected int := coalesce(array_length(p_ids, 1), 0);
  updated int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  update itinerary_items i
     set order_index = o.position - 1
    from unnest(p_ids) with ordinality as o(id, position)
   where i.id::text = o.id
     and i.trip_id::text = p_trip_id;

  get diagnostics updated = row_count;
  if updated <> expected then
    raise exception 'reorder incomplete: % of % items updated', updated, expected;
  end if;
end $$;

revoke all on function public.reorder_itinerary_items(text, text[]) from public, anon;
grant execute on function public.reorder_itinerary_items(text, text[]) to authenticated;
