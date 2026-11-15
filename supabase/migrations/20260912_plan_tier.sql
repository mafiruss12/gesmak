
alter table public.establishments
  add column if not exists plan_tier text default 'starter';

comment on column public.establishments.plan_tier is 'starter | pro | business';
