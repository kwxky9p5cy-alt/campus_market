-- Keep auth registration usable even when metadata is missing or malformed,
-- and repair accounts created before the profile trigger was available.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text := trim(new.raw_user_meta_data ->> 'username');
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    case
      when char_length(requested_username) between 2 and 24 then requested_username
      else '新同学'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

insert into public.profiles (id, username, created_at, updated_at)
select
  users.id,
  case
    when char_length(trim(users.raw_user_meta_data ->> 'username')) between 2 and 24
      then trim(users.raw_user_meta_data ->> 'username')
    else '新同学'
  end,
  users.created_at,
  coalesce(users.updated_at, users.created_at)
from auth.users as users
where not exists (
  select 1 from public.profiles where profiles.id = users.id
);
