create table if not exists public.extraction_conflicts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  fiscal_year integer not null,
  field text not null,
  confirmed_value numeric,
  new_value numeric,
  source_document_id uuid references public.documents(id) on delete set null,
  status text not null default 'open' check (status in ('open','dismissed','resolved')),
  created_at timestamptz not null default now()
);

create index if not exists extraction_conflicts_deal_status_idx
  on public.extraction_conflicts (deal_id, status);

alter table public.extraction_conflicts enable row level security;

drop policy if exists extraction_conflicts_admin_all on public.extraction_conflicts;
create policy extraction_conflicts_admin_all on public.extraction_conflicts
  for all using (is_admin()) with check (is_admin());

drop policy if exists extraction_conflicts_org_all on public.extraction_conflicts;
create policy extraction_conflicts_org_all on public.extraction_conflicts
  for all
  using (deal_id in (select deals.id from deals where deals.org_id = current_org_id()))
  with check (deal_id in (select deals.id from deals where deals.org_id = current_org_id()));
