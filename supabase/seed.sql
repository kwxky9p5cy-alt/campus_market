-- Optional seed for a configured Supabase project.
-- 1) Register at least one user in the app so a profile exists.
-- 2) Run this file. It attaches sample listings to the oldest profile.
-- Product images should be uploaded through the app so Storage ownership remains accurate.
do $$
declare seller uuid;
begin
  select id into seller from public.profiles order by created_at asc limit 1;
  if seller is null then
    raise notice 'No profile found. Register a user first, then run seed.sql again.';
    return;
  end if;

  if not exists (select 1 from public.products where seller_id = seller and title = '罗技 K380 蓝牙键盘') then
    insert into public.products (seller_id, title, description, category, price, original_price, condition, location)
    values
      (seller, '罗技 K380 蓝牙键盘', '按键和蓝牙连接正常，外壳有正常使用痕迹。', 'digital', 95, 189, 'good', '食堂门口'),
      (seller, '高等数学第七版上下册', '上册有少量重点标注，下册较新，两本一起出。', 'books', 32, 89, 'good', '教学楼附近'),
      (seller, '可调光护眼台灯', '三档色温，可调亮度，触摸操作，灯臂转轴正常。', 'life', 48, 129, 'like_new', '宿舍区');
  end if;
end $$;
