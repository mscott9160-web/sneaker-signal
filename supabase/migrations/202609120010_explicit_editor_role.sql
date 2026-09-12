create type public.app_role as enum ('user', 'editor');

alter table public.profiles
  add column role public.app_role not null default 'user';

update public.profiles
set role = 'editor'
where is_editor = true;

alter table public.profiles
  drop column is_editor;

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.current_user_role() = required_role;
$$;

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.has_role('editor');
$$;

revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.has_role(public.app_role) from public, anon;
revoke execute on function public.is_editor() from public, anon;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.is_editor() to authenticated;

drop policy "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = public.current_user_role());