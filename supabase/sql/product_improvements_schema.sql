create table public.product_improvements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  tier        integer check (tier between 1 and 4),
  category    text,
  status      text not null default 'not_started'
              check (status in ('not_started', 'in_progress', 'done', 'parked')),
  rationale   text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_pi_updated_at
  before update on public.product_improvements
  for each row execute function set_updated_at();

alter table public.product_improvements enable row level security;

revoke all on public.product_improvements from anon;
revoke all on public.product_improvements from public;
revoke truncate, trigger, references on public.product_improvements from authenticated;

create policy product_improvements_admin_only
  on public.product_improvements
  for all
  using (is_admin())
  with check (is_admin());
