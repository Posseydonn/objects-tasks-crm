-- Internal event-trigger function must not be exposed as client RPC.
-- Supabase may install this event trigger; a clean PostgreSQL database need not.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
