-- BetterHealth Hospital Operations System
-- Run this entire file in Supabase → SQL Editor → New Query

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Profiles (extends auth.users) ───────────────────────────────────────────
create table public.profiles (
  id             uuid references auth.users(id) on delete cascade primary key,
  full_name      text not null,
  role           text not null check (role in ('receptionist','nurse','doctor','lab_technician','pharmacist','manager','admin')),
  department     text,
  employee_number text,
  is_active      boolean default true,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ─── Patients ─────────────────────────────────────────────────────────────────
create table public.patients (
  id                       uuid default gen_random_uuid() primary key,
  patient_number           text unique not null,
  full_name                text not null,
  date_of_birth            date not null,
  gender                   text check (gender in ('male','female','other')),
  blood_type               text check (blood_type in ('A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown')),
  id_number                text,
  employer                 text,
  occupation               text,
  contact_phone            text,
  contact_email            text,
  emergency_contact_name   text,
  emergency_contact_phone  text,
  medical_aid_provider     text,
  medical_aid_number       text,
  allergies                text[],
  chronic_conditions       text[],
  notes                    text,
  created_at               timestamptz default now(),
  created_by               uuid references public.profiles(id),
  updated_at               timestamptz default now()
);

-- ─── Visits (the patient journey record) ─────────────────────────────────────
create table public.visits (
  id                        uuid default gen_random_uuid() primary key,
  visit_number              text unique not null,
  patient_id                uuid references public.patients(id) not null,
  visit_type                text not null check (visit_type in ('walk_in','appointment','pre_employment','iod','periodic','fitness_for_duty')),
  chief_complaint           text,
  status                    text not null default 'registered' check (status in ('registered','triage','lab','consultation','pharmacy','completed','cancelled')),
  priority                  text default 'normal' check (priority in ('normal','urgent','emergency')),
  registered_at             timestamptz default now(),
  registered_by             uuid references public.profiles(id),
  triage_started_at         timestamptz,
  triage_completed_at       timestamptz,
  lab_ordered_at            timestamptz,
  lab_completed_at          timestamptz,
  consultation_started_at   timestamptz,
  consultation_completed_at timestamptz,
  pharmacy_sent_at          timestamptz,
  pharmacy_completed_at     timestamptz,
  completed_at              timestamptz,
  assigned_doctor           uuid references public.profiles(id),
  assigned_nurse            uuid references public.profiles(id),
  assigned_room             text,
  created_at                timestamptz default now()
);

-- ─── Vitals ───────────────────────────────────────────────────────────────────
create table public.vitals (
  id                       uuid default gen_random_uuid() primary key,
  visit_id                 uuid references public.visits(id) on delete cascade not null,
  blood_pressure_systolic  integer,
  blood_pressure_diastolic integer,
  pulse_rate               integer,
  temperature              numeric(4,1),
  weight_kg                numeric(5,1),
  height_cm                numeric(5,1),
  bmi                      numeric(4,1),
  oxygen_saturation        integer,
  respiratory_rate         integer,
  blood_glucose            numeric(5,1),
  pain_scale               integer check (pain_scale between 0 and 10),
  notes                    text,
  recorded_at              timestamptz default now(),
  recorded_by              uuid references public.profiles(id)
);

-- ─── Lab Orders ───────────────────────────────────────────────────────────────
create table public.lab_orders (
  id                      uuid default gen_random_uuid() primary key,
  visit_id                uuid references public.visits(id) on delete cascade not null,
  test_name               text not null,
  test_code               text,
  status                  text default 'pending' check (status in ('pending','in_progress','completed','cancelled')),
  urgency                 text default 'routine' check (urgency in ('routine','urgent','stat')),
  ordered_by              uuid references public.profiles(id),
  ordered_at              timestamptz default now(),
  result_value            text,
  result_unit             text,
  result_reference_range  text,
  result_flag             text check (result_flag in ('normal','low','high','critical')),
  result_notes            text,
  completed_at            timestamptz,
  completed_by            uuid references public.profiles(id)
);

-- ─── Consultation Notes (SOAP) ────────────────────────────────────────────────
create table public.consultation_notes (
  id                    uuid default gen_random_uuid() primary key,
  visit_id              uuid references public.visits(id) on delete cascade unique not null,
  subjective            text,
  objective             text,
  assessment            text,
  plan                  text,
  diagnosis_code        text,
  diagnosis_description text,
  follow_up_required    boolean default false,
  follow_up_date        date,
  follow_up_instructions text,
  work_status           text check (work_status in ('fit','fit_with_restrictions','temporarily_unfit','unfit')),
  created_by            uuid references public.profiles(id),
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ─── Prescriptions ────────────────────────────────────────────────────────────
create table public.prescriptions (
  id            uuid default gen_random_uuid() primary key,
  visit_id      uuid references public.visits(id) on delete cascade not null,
  prescribed_by uuid references public.profiles(id),
  prescribed_at timestamptz default now(),
  status        text default 'pending' check (status in ('pending','dispensed','partially_dispensed','cancelled')),
  dispensed_at  timestamptz,
  dispensed_by  uuid references public.profiles(id),
  notes         text
);

create table public.prescription_items (
  id              uuid default gen_random_uuid() primary key,
  prescription_id uuid references public.prescriptions(id) on delete cascade not null,
  medication_name text not null,
  dosage          text not null,
  frequency       text not null,
  duration        text,
  quantity        integer,
  instructions    text,
  is_dispensed    boolean default false
);

-- ─── Rooms ────────────────────────────────────────────────────────────────────
create table public.rooms (
  id               uuid default gen_random_uuid() primary key,
  room_number      text not null unique,
  room_name        text not null,
  department       text not null,
  status           text default 'ready' check (status in ('ready','occupied','cleaning','maintenance','reserved')),
  current_visit_id uuid references public.visits(id),
  last_cleaned_at  timestamptz,
  updated_at       timestamptz default now(),
  updated_by       uuid references public.profiles(id)
);

-- ─── Inventory ────────────────────────────────────────────────────────────────
create table public.inventory (
  id            uuid default gen_random_uuid() primary key,
  item_code     text unique,
  item_name     text not null,
  category      text not null check (category in ('medication','consumable','equipment','lab_reagent','vaccine')),
  unit          text not null,
  current_stock integer not null default 0,
  reorder_level integer not null default 10,
  unit_cost     numeric(10,2),
  location      text,
  expiry_date   date,
  supplier      text,
  updated_at    timestamptz default now(),
  updated_by    uuid references public.profiles(id)
);

-- ─── Appointments ─────────────────────────────────────────────────────────────
create table public.appointments (
  id                 uuid default gen_random_uuid() primary key,
  appointment_number text unique not null,
  patient_id         uuid references public.patients(id) not null,
  appointment_type   text not null,
  scheduled_date     date not null,
  scheduled_time     time not null,
  assigned_doctor    uuid references public.profiles(id),
  status             text default 'scheduled' check (status in ('scheduled','confirmed','arrived','completed','cancelled','no_show')),
  notes              text,
  created_at         timestamptz default now(),
  created_by         uuid references public.profiles(id)
);

-- ─── Shift Handovers ──────────────────────────────────────────────────────────
create table public.shift_handovers (
  id                 uuid default gen_random_uuid() primary key,
  shift_date         date not null,
  shift_type         text not null check (shift_type in ('morning','afternoon','night')),
  handover_time      timestamptz default now(),
  outgoing_staff_id  uuid references public.profiles(id),
  incoming_staff_id  uuid references public.profiles(id),
  patient_summary    text,
  outstanding_items  text,
  incidents_log      text,
  equipment_status   text,
  stock_alerts       text,
  general_notes      text,
  created_at         timestamptz default now()
);

-- ─── Audit Checklists ─────────────────────────────────────────────────────────
create table public.audit_checklists (
  id             uuid default gen_random_uuid() primary key,
  checklist_type text not null check (checklist_type in ('room_readiness','equipment','stock','shift_start','shift_end')),
  room_id        uuid references public.rooms(id),
  shift_date     date not null,
  shift_type     text not null check (shift_type in ('morning','afternoon','night')),
  items          jsonb not null default '[]',
  completed_by   uuid references public.profiles(id),
  completed_at   timestamptz,
  status         text default 'pending' check (status in ('pending','completed','failed')),
  notes          text,
  created_at     timestamptz default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.patients         enable row level security;
alter table public.visits           enable row level security;
alter table public.vitals           enable row level security;
alter table public.lab_orders       enable row level security;
alter table public.consultation_notes enable row level security;
alter table public.prescriptions    enable row level security;
alter table public.prescription_items enable row level security;
alter table public.rooms            enable row level security;
alter table public.inventory        enable row level security;
alter table public.appointments     enable row level security;
alter table public.shift_handovers  enable row level security;
alter table public.audit_checklists enable row level security;

-- All authenticated users can access all tables (role-based UI controls access)
create policy "auth_all_profiles"           on public.profiles           for all using (auth.role() = 'authenticated');
create policy "auth_all_patients"           on public.patients           for all using (auth.role() = 'authenticated');
create policy "auth_all_visits"             on public.visits             for all using (auth.role() = 'authenticated');
create policy "auth_all_vitals"             on public.vitals             for all using (auth.role() = 'authenticated');
create policy "auth_all_lab_orders"         on public.lab_orders         for all using (auth.role() = 'authenticated');
create policy "auth_all_consultation_notes" on public.consultation_notes for all using (auth.role() = 'authenticated');
create policy "auth_all_prescriptions"      on public.prescriptions      for all using (auth.role() = 'authenticated');
create policy "auth_all_prescription_items" on public.prescription_items for all using (auth.role() = 'authenticated');
create policy "auth_all_rooms"              on public.rooms              for all using (auth.role() = 'authenticated');
create policy "auth_all_inventory"          on public.inventory          for all using (auth.role() = 'authenticated');
create policy "auth_all_appointments"       on public.appointments       for all using (auth.role() = 'authenticated');
create policy "auth_all_shift_handovers"    on public.shift_handovers    for all using (auth.role() = 'authenticated');
create policy "auth_all_audit_checklists"   on public.audit_checklists   for all using (auth.role() = 'authenticated');

-- ─── Auto-create profile on signup ───────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'receptionist')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Seed: Rooms ──────────────────────────────────────────────────────────────
insert into public.rooms (room_number, room_name, department, status) values
  ('R-001', 'Reception',           'Reception',    'ready'),
  ('V-001', 'Vitals Room 1',       'Triage',       'ready'),
  ('V-002', 'Vitals Room 2',       'Triage',       'ready'),
  ('L-001', 'Laboratory',          'Laboratory',   'ready'),
  ('C-001', 'Consultation Room 1', 'Consultation', 'ready'),
  ('C-002', 'Consultation Room 2', 'Consultation', 'ready'),
  ('C-003', 'Consultation Room 3', 'Consultation', 'ready'),
  ('P-001', 'Pharmacy',            'Pharmacy',     'ready');

-- ─── Seed: Inventory ──────────────────────────────────────────────────────────
insert into public.inventory (item_code, item_name, category, unit, current_stock, reorder_level, location) values
  ('MED-001', 'Paracetamol 500mg',      'medication',  'tablets',  450,  100, 'Pharmacy'),
  ('MED-002', 'Ibuprofen 400mg',        'medication',  'tablets',  320,  100, 'Pharmacy'),
  ('MED-003', 'Amoxicillin 500mg',      'medication',  'capsules', 180,   50, 'Pharmacy'),
  ('MED-004', 'Metoprolol 50mg',        'medication',  'tablets',   90,   30, 'Pharmacy'),
  ('MED-005', 'Metformin 500mg',        'medication',  'tablets',    8,   30, 'Pharmacy'),
  ('CON-001', 'Examination Gloves (M)', 'consumable',  'pairs',    420,  100, 'Store Room'),
  ('CON-002', 'Surgical Masks',         'consumable',  'units',    350,  100, 'Store Room'),
  ('CON-003', 'Syringes 5ml',           'consumable',  'units',    200,   50, 'Store Room'),
  ('CON-004', 'Bandages',               'consumable',  'rolls',     12,   20, 'Store Room'),
  ('LAB-001', 'Blood Collection Tubes', 'lab_reagent', 'units',      5,   50, 'Laboratory');
