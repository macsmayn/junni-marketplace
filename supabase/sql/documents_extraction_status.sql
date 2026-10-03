alter table public.documents
  add column if not exists extraction_status text,
  add column if not exists extraction_error text;

alter table public.documents drop constraint if exists documents_extraction_status_check;
alter table public.documents
  add constraint documents_extraction_status_check
  check (extraction_status is null or extraction_status in ('extracted','skipped_unsupported','too_large','failed'));
