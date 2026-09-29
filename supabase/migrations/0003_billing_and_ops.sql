-- 0003_billing_and_ops.sql

create table public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null unique references public.schools (id) on delete cascade,
  plan                text not null,
  billing_cycle       text not null check (billing_cycle in ('monthly', 'annual')),
  price_amount        numeric not null,
  currency            text not null default 'NAD',
  status              text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'cancelled')),
  current_period_end  date,
  created_at          timestamptz not null default now()
);

create table public.invoices (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools (id) on delete cascade,
  subscription_id  uuid references public.subscriptions (id),
  amount           numeric not null,
  currency         text not null default 'NAD',
  status           text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue')),
  issued_date      date,
  due_date         date,
  paid_at          timestamptz
);

-- Every provisioning action, release, and support action taken by TPI
-- staff against any school, in one place. This is TPI's own audit trail,
-- separate from the audit_log inside each school's own project.
create table public.operations_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id),
  action      text not null,
  school_id   uuid references public.schools (id),
  details     jsonb,
  created_at  timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.operations_log enable row level security;

-- Billing is more sensitive than the technical registry: only owner and
-- support may even read it, and only owner may change it.
create policy subscriptions_read on public.subscriptions for select to authenticated
  using ( public.has_tpi_role(array['owner', 'support']) );
create policy subscriptions_write on public.subscriptions for all to authenticated
  using ( public.has_tpi_role(array['owner']) )
  with check ( public.has_tpi_role(array['owner']) );

create policy invoices_read on public.invoices for select to authenticated
  using ( public.has_tpi_role(array['owner', 'support']) );
create policy invoices_write on public.invoices for all to authenticated
  using ( public.has_tpi_role(array['owner']) )
  with check ( public.has_tpi_role(array['owner']) );

create policy operations_log_read on public.operations_log for select to authenticated
  using ( public.has_tpi_role(array['owner', 'engineer', 'support']) );
-- No write policy for authenticated users: this table is written only by
-- the release pipeline and provisioning scripts, using the service role,
-- exactly like audit_log inside each school project.
