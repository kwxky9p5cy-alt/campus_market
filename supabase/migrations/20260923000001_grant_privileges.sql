grant usage on schema public to anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.product_images to anon, authenticated;

grant update on public.profiles to authenticated;

grant insert, update, delete on public.products to authenticated;
grant insert, update, delete on public.product_images to authenticated;

grant select, insert, delete on public.favorites to authenticated;
grant select, insert on public.trade_requests to authenticated;
grant select on public.conversations to authenticated;

grant select, insert on public.messages to authenticated;
grant update(read_at) on public.messages to authenticated;

grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;