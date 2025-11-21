create table if not exists public.incident_playbooks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  risk_level text not null,
  species text,
  description text,
  first_aid text,
  steps jsonb not null default '[]'::jsonb,
  contacts jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incident_assignments (
  id uuid primary key default gen_random_uuid(),
  detection_id uuid not null,
  playbook_id uuid not null references public.incident_playbooks(id) on delete cascade,
  steps_state jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(detection_id)
);

create index if not exists incident_playbooks_risk_idx
  on public.incident_playbooks (risk_level, coalesce(species, ''));

create index if not exists incident_assignments_detection_idx
  on public.incident_assignments (detection_id);

create or replace function public.sync_incident_playbooks_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_incident_playbooks_updated_at on public.incident_playbooks;
create trigger trg_incident_playbooks_updated_at
before update on public.incident_playbooks
for each row execute procedure public.sync_incident_playbooks_updated_at();

drop trigger if exists trg_incident_assignments_updated_at on public.incident_assignments;
create trigger trg_incident_assignments_updated_at
before update on public.incident_assignments
for each row execute procedure public.sync_incident_playbooks_updated_at();

