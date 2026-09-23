-- Campus Market initial schema. Run in a fresh Supabase project.
create extension if not exists pgcrypto;

create type public.product_category as enum ('digital', 'books', 'life', 'sports', 'other');
create type public.product_condition as enum ('new', 'like_new', 'good', 'fair');
create type public.product_status as enum ('draft', 'active', 'reserved', 'sold', 'inactive');
create type public.trade_status as enum ('pending', 'accepted', 'rejected', 'cancelled', 'completed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(trim(username)) between 2 and 24),
  avatar_url text,
  bio text check (bio is null or char_length(bio) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null constraint products_seller_id_fkey references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 80),
  description text not null check (char_length(trim(description)) between 10 and 2000),
  category public.product_category not null,
  price numeric(12,2) not null check (price > 0 and price <= 1000000),
  original_price numeric(12,2) check (original_price is null or (original_price >= price and original_price <= 1000000)),
  condition public.product_condition not null,
  location text not null check (char_length(trim(location)) between 2 and 80),
  status public.product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null constraint product_images_product_id_fkey references public.products(id) on delete cascade,
  storage_path text not null unique,
  sort_order smallint not null default 0 check (sort_order between 0 and 4),
  created_at timestamptz not null default now(),
  unique (product_id, sort_order)
);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null constraint favorites_user_id_fkey references public.profiles(id) on delete cascade,
  product_id uuid not null constraint favorites_product_id_fkey references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table public.trade_requests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null constraint trade_requests_product_id_fkey references public.products(id) on delete cascade,
  buyer_id uuid not null constraint trade_requests_buyer_id_fkey references public.profiles(id) on delete cascade,
  seller_id uuid not null constraint trade_requests_seller_id_fkey references public.profiles(id) on delete cascade,
  status public.trade_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

create unique index trade_requests_one_open_per_buyer
  on public.trade_requests(product_id, buyer_id)
  where status in ('pending', 'accepted');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null constraint conversations_product_id_fkey references public.products(id) on delete cascade,
  buyer_id uuid not null constraint conversations_buyer_id_fkey references public.profiles(id) on delete cascade,
  seller_id uuid not null constraint conversations_seller_id_fkey references public.profiles(id) on delete cascade,
  trade_request_id uuid constraint conversations_trade_request_id_fkey references public.trade_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id),
  unique (product_id, buyer_id, seller_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null constraint messages_conversation_id_fkey references public.conversations(id) on delete cascade,
  sender_id uuid not null constraint messages_sender_id_fkey references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index products_browse_idx on public.products(status, created_at desc);
create index products_category_price_idx on public.products(category, price);
create index products_seller_idx on public.products(seller_id, status, created_at desc);
create index product_images_product_idx on public.product_images(product_id, sort_order);
create index favorites_user_idx on public.favorites(user_id, created_at desc);
create index trade_requests_participants_idx on public.trade_requests(buyer_id, seller_id, updated_at desc);
create index conversations_buyer_idx on public.conversations(buyer_id, updated_at desc);
create index conversations_seller_idx on public.conversations(seller_id, updated_at desc);
create index messages_conversation_idx on public.messages(conversation_id, created_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger trade_requests_set_updated_at before update on public.trade_requests for each row execute function public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations for each row execute function public.set_updated_at();

create or replace function public.touch_conversation_on_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set updated_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation after insert on public.messages
for each row execute function public.touch_conversation_on_message();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), '新同学'));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.favorites enable row level security;
alter table public.trade_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Profiles are public identity cards; only their owners can edit them.
create policy "profiles_public_read" on public.profiles for select using (true);
create policy "profiles_owner_update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Public users see marketplace inventory. Sellers additionally see all of their own statuses.
create policy "products_marketplace_read" on public.products for select using (status in ('active', 'reserved') or seller_id = auth.uid());
create policy "products_owner_insert" on public.products for insert to authenticated with check (seller_id = auth.uid());
create policy "products_owner_update" on public.products for update to authenticated using (seller_id = auth.uid()) with check (seller_id = auth.uid());
create policy "products_owner_delete" on public.products for delete to authenticated using (seller_id = auth.uid());

create policy "product_images_visible_with_product" on public.product_images for select using (
  exists (select 1 from public.products p where p.id = product_id and (p.status in ('active', 'reserved') or p.seller_id = auth.uid()))
);
create policy "product_images_owner_insert" on public.product_images for insert to authenticated with check (
  exists (select 1 from public.products p where p.id = product_id and p.seller_id = auth.uid())
  and (storage.foldername(storage_path))[1] = auth.uid()::text
);
create policy "product_images_owner_update" on public.product_images for update to authenticated using (
  exists (select 1 from public.products p where p.id = product_id and p.seller_id = auth.uid())
) with check (
  exists (select 1 from public.products p where p.id = product_id and p.seller_id = auth.uid())
);
create policy "product_images_owner_delete" on public.product_images for delete to authenticated using (
  exists (select 1 from public.products p where p.id = product_id and p.seller_id = auth.uid())
);

create policy "favorites_owner_read" on public.favorites for select to authenticated using (user_id = auth.uid());
create policy "favorites_owner_insert" on public.favorites for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.products p where p.id = product_id and p.seller_id <> auth.uid())
);
create policy "favorites_owner_delete" on public.favorites for delete to authenticated using (user_id = auth.uid());

create policy "trade_participant_read" on public.trade_requests for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy "trade_buyer_insert" on public.trade_requests for insert to authenticated with check (
  buyer_id = auth.uid()
  and buyer_id <> seller_id
  and exists (select 1 from public.products p where p.id = product_id and p.seller_id = seller_id and p.status = 'active')
);

create policy "conversation_participant_read" on public.conversations for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid());

create policy "message_participant_read" on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id))
);
create policy "message_participant_insert" on public.messages for insert to authenticated with check (
  sender_id = auth.uid()
  and exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id))
);
create policy "message_participant_mark_read" on public.messages for update to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id))
) with check (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id))
);

-- State changes happen here so a buyer cannot accept their own request or reserve a stale product.
create or replace function public.transition_trade_request(request_id uuid, next_status public.trade_status)
returns setof public.trade_requests
language plpgsql security definer set search_path = '' as $$
declare
  request public.trade_requests;
  actor uuid := auth.uid();
begin
  if actor is null then raise exception 'authentication required'; end if;
  select * into request from public.trade_requests where id = request_id for update;
  if not found then raise exception 'trade request not found'; end if;

  if request.status = 'pending' and next_status in ('accepted', 'rejected') then
    if actor <> request.seller_id then raise exception 'only seller can respond'; end if;
  elsif request.status = 'pending' and next_status = 'cancelled' then
    if actor <> request.buyer_id then raise exception 'only buyer can cancel'; end if;
  elsif request.status = 'accepted' and next_status = 'cancelled' then
    if actor <> request.buyer_id then raise exception 'only buyer can cancel'; end if;
  elsif request.status = 'accepted' and next_status = 'completed' then
    if actor not in (request.buyer_id, request.seller_id) then raise exception 'participant required'; end if;
  else
    raise exception 'invalid trade transition';
  end if;

  if next_status = 'accepted' then
    update public.products set status = 'reserved' where id = request.product_id and seller_id = request.seller_id and status = 'active';
    if not found then raise exception 'product is no longer available'; end if;
    update public.trade_requests set status = 'rejected'
      where product_id = request.product_id and id <> request.id and status = 'pending';
  elsif next_status = 'completed' then
    update public.products set status = 'sold' where id = request.product_id and status = 'reserved';
  elsif next_status = 'cancelled' and request.status = 'accepted' then
    update public.products set status = 'active' where id = request.product_id and status = 'reserved';
  end if;

  update public.trade_requests set status = next_status where id = request.id returning * into request;
  return next request;
end;
$$;

-- A buyer gets at most one conversation per product/seller pair.
create or replace function public.get_or_create_conversation(target_product_id uuid, target_trade_request_id uuid default null)
returns public.conversations
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  seller uuid;
  result public.conversations;
begin
  if actor is null then raise exception 'authentication required'; end if;
  select seller_id into seller from public.products where id = target_product_id and status in ('active', 'reserved');
  if seller is null then raise exception 'product unavailable'; end if;
  if seller = actor then raise exception 'seller cannot contact self'; end if;
  if target_trade_request_id is not null and not exists (
    select 1 from public.trade_requests t where t.id = target_trade_request_id and t.product_id = target_product_id and t.buyer_id = actor and t.seller_id = seller
  ) then raise exception 'trade request mismatch'; end if;

  insert into public.conversations (product_id, buyer_id, seller_id, trade_request_id)
  values (target_product_id, actor, seller, target_trade_request_id)
  on conflict (product_id, buyer_id, seller_id) do update
    set trade_request_id = coalesce(public.conversations.trade_request_id, excluded.trade_request_id), updated_at = now()
  returning * into result;
  return result;
end;
$$;

revoke all on function public.transition_trade_request(uuid, public.trade_status) from public;
grant execute on function public.transition_trade_request(uuid, public.trade_status) to authenticated;
revoke all on function public.get_or_create_conversation(uuid, uuid) from public;
grant execute on function public.get_or_create_conversation(uuid, uuid) to authenticated;

-- Limit message updates to the read receipt column; content remains immutable.
revoke update on public.messages from authenticated;
grant update(read_at) on public.messages to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "product_image_public_read" on storage.objects for select using (bucket_id = 'product-images');
create policy "product_image_owner_upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.products p
    where p.id::text = (storage.foldername(name))[2] and p.seller_id = auth.uid()
  )
);
create policy "product_image_owner_update" on storage.objects for update to authenticated using (
  bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "product_image_owner_delete" on storage.objects for delete to authenticated using (
  bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text
);

alter publication supabase_realtime add table public.messages;
