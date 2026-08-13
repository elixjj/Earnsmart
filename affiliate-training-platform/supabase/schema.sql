create table if not exists public.system_users (
  id bigserial primary key,
  name text not null,
  phone text not null unique,
  assigned_ref_code text unique,
  referred_by_code text not null default 'DIRECT',
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.commissions (
  id bigserial primary key,
  agent_code text not null,
  trainee_phone text not null,
  amount_earned numeric(12,2) not null default 80.00,
  payout_status text not null default 'unpaid'
    check (payout_status in ('unpaid', 'paid')),
  processed_at timestamptz not null default now()
);

create index if not exists idx_system_users_referrer
  on public.system_users (referred_by_code);

create index if not exists idx_system_users_assigned_ref
  on public.system_users (assigned_ref_code);

create index if not exists idx_system_users_payment_status
  on public.system_users (payment_status);

create index if not exists idx_commissions_agent
  on public.commissions (agent_code);

create unique index if not exists idx_commissions_agent_trainee
  on public.commissions (agent_code, trainee_phone);

alter table public.system_users enable row level security;
alter table public.commissions enable row level security;

-- No public policies are created. The Netlify functions use the Supabase
-- service-role key server-side.
