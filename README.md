# BetterHealth — Occupational Health HMS

A full-stack Health Management System built for a single-branch Occupational Health (OccHealth) Hospital. Manages the complete patient journey from reception check-in through triage, laboratory, consultation, pharmacy, and discharge — with real-time queue management, role-based access control, analytics, and daily audit checklists.

---

## Tech Stack

| Layer      | Technology                                                        |
|------------|-------------------------------------------------------------------|
| Framework  | Next.js 16.2.7 (App Router)                                       |
| UI         | React 19.2.4 (Server Components default)                          |
| Styling    | Tailwind CSS v4 (`@import "tailwindcss"` + `@theme inline`)       |
| Database   | Supabase (PostgreSQL + Row Level Security)                        |
| Auth       | Supabase Auth (email/password + MFA)                              |
| Realtime   | Supabase Realtime (live queue updates)                            |
| Charts     | Recharts 3                                                        |
| Language   | TypeScript 5                                                      |

---

## Features

### Patient Journey (end-to-end)

- **Reception check-in** — register walk-ins or convert appointments to visits; auto-generate visit numbers (`VIS-YYYY-NNNN`); triage priority (normal / urgent / emergency)
- **Live Queue** — real-time board via Supabase Realtime; pipeline summary across 6 stages; one-click advance; mobile card view
- **Triage** — nurse records vitals (BP, pulse, temp, SpO₂, weight, BMI, pain scale, blood glucose)
- **Laboratory** — lab orders tracked per visit; results with reference range flags
- **Consultation** — SOAP notes (subjective / objective / assessment / plan), ICD diagnosis, work fitness status, follow-up date
- **Pharmacy** — prescription with line items; pharmacist marks dispensed; pending prescription counter on dashboard
- **Discharge** — visit marked complete; wait time auto-computed across all stages

### Role-Based Access Control

Seven roles with distinct navigation and page-level guards:

| Role             | Pages accessible                                                       |
|------------------|------------------------------------------------------------------------|
| `receptionist`   | Dashboard, Patients, Appointments, Queue, Reminders                    |
| `nurse`          | Dashboard, Patients, Queue, Reminders, Facility, Checklists            |
| `doctor`         | Dashboard, Patients, Appointments, Queue, Reminders, Checklists        |
| `lab_technician` | Dashboard, Queue, Checklists                                           |
| `pharmacist`     | Dashboard, Queue, Reminders, Inventory, Checklists                     |
| `manager`        | All pages including Analytics                                          |
| `admin`          | Full access                                                            |

- Sidebar navigation filters per role at render time
- Every page has a server-side role guard; direct URL access by wrong role redirects to `/dashboard`
- Dashboard KPIs and quick-action CTAs are role-specific

### Appointments

- Book with live patient search dropdown, doctor select, appointment type, date/time
- Status lifecycle: Scheduled → Confirmed → Arrived → Completed (or Cancelled / No Show)
- Per-row action buttons in the table update status instantly via server actions

### Inventory

- Add new items: category, unit, reorder level, supplier, expiry date, location, unit cost
- Inline click-to-edit stock quantity per row — no page reload
- Low stock alert banner; critical (zero) rows highlighted in red
- Access: pharmacist, manager, admin

### Analytics & Reports

Manager/admin only:

- **KPI cards** — patients today, completion rate, avg visit duration, week total, emergency count, low stock count
- **7-day visit volume** — bar chart, total vs completed
- **Current pipeline** — donut chart by stage
- **Visit type breakdown** — donut chart, last 7 days
- **Avg wait per stage** — horizontal bar chart, today's completed visits

### Audit Checklists

All clinical staff. Five daily shift templates:

1. Morning Safety Rounds
2. Medication Stock Check
3. Equipment & Devices Check
4. Lab Quality Control
5. End of Day Check

Per-item notes, partial save, submit — incomplete required items flag the checklist as "completed with issues".

### Smart Reminders

Derived from live data — no separate reminders table:

- Visits waiting >45 min → overdue
- Visits at pharmacy stage → pending dispense
- Appointments starting within 90 min → upcoming
- Inventory at or below reorder level → low stock

### Facility

- Room status board: Ready / Occupied / Cleaning / Maintenance / Reserved
- Per-room status update dropdown; "Mark Ready" auto-stamps `last_cleaned_at`
- Grouped by department
- Access: nurse, manager, admin

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/              # Email/password login
│   │   └── mfa/                # MFA challenge
│   ├── (main)/
│   │   ├── layout.tsx          # AppShell (sidebar + mobile header)
│   │   ├── dashboard/          # Role-specific KPIs + quick actions
│   │   ├── queue/              # Live queue board + check-in modal
│   │   │   ├── page.tsx
│   │   │   ├── QueueBoard.tsx  # Realtime client component
│   │   │   └── CheckInModal.tsx
│   │   ├── visits/[id]/        # Visit detail page
│   │   │   ├── page.tsx
│   │   │   ├── VitalsForm.tsx
│   │   │   ├── ConsultationForm.tsx
│   │   │   └── PrescriptionSection.tsx
│   │   ├── patients/
│   │   │   ├── page.tsx        # Server-side filtered list
│   │   │   └── PatientsSearch.tsx
│   │   ├── appointments/
│   │   │   ├── page.tsx
│   │   │   ├── NewAppointmentModal.tsx
│   │   │   └── AppointmentActions.tsx
│   │   ├── inventory/
│   │   │   ├── page.tsx
│   │   │   ├── AddInventoryModal.tsx
│   │   │   └── StockUpdateForm.tsx
│   │   ├── facility/
│   │   │   ├── page.tsx
│   │   │   └── RoomStatusButton.tsx
│   │   ├── checklists/
│   │   │   ├── page.tsx
│   │   │   └── ChecklistBoard.tsx
│   │   ├── analytics/
│   │   │   ├── page.tsx        # Data fetching + KPI cards
│   │   │   └── AnalyticsCharts.tsx
│   │   └── reminders/
│   │       └── page.tsx        # Derived reminders
│   └── actions/                # Next.js Server Actions
│       ├── visits.ts
│       ├── appointments.ts
│       ├── inventory.ts
│       ├── checklists.ts
│       └── rooms.ts
├── components/
│   ├── AppShell.tsx            # Client wrapper for sidebar state
│   ├── Sidebar.tsx             # Role-filtered nav + sign out
│   ├── MobileHeader.tsx        # Hamburger + page title
│   └── WaitTimer.tsx           # Live elapsed-time display
└── lib/
    └── supabase/
        ├── server.ts           # createClient() for server context
        ├── client.ts           # createClient() for browser context
        └── types.ts            # Database interface + domain types
```

---

## Database Schema (13 tables)

| Table                 | Purpose                                           |
|-----------------------|---------------------------------------------------|
| `profiles`            | Staff accounts (role, department, employee number)|
| `patients`            | Demographics, allergies, medical aid, employer    |
| `visits`              | Core visit with 6 stage timestamps                |
| `vitals`              | Vital signs per visit                             |
| `lab_orders`          | Lab tests, results, reference range flags         |
| `consultation_notes`  | SOAP notes, diagnosis, work fitness status        |
| `prescriptions`       | Prescription headers                              |
| `prescription_items`  | Medication line items (dosage, frequency, qty)    |
| `rooms`               | Facility rooms with status                        |
| `inventory`           | Medication and consumable stock                   |
| `appointments`        | Scheduled appointments                            |
| `shift_handovers`     | Shift handover records *(reserved for Phase 4)*   |
| `audit_checklists`    | Daily checklist completions                       |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone https://github.com/Pateh-mj/betterhealth.git
cd betterhealth
npm install
```

### 2. Environment variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Supabase database setup

Run the full schema SQL in your Supabase **SQL Editor**. Then run the `audit_checklists` migration if not already included:

```sql
create table public.audit_checklists (
  id              uuid primary key default gen_random_uuid(),
  checklist_date  date not null,
  checklist_type  text not null,
  shift_type      text not null,
  status          text not null default 'pending'
                    check (status in ('pending','in_progress','completed','completed_with_issues')),
  items           jsonb not null default '[]',
  notes           text,
  completed_by    uuid references public.profiles(id),
  completed_at    timestamptz,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

alter table public.audit_checklists enable row level security;

create policy "Authenticated users can manage checklists"
  on public.audit_checklists for all
  to authenticated using (true) with check (true);
```

### 4. Create staff accounts

Create a user in **Supabase Auth → Users**, then insert their profile:

```sql
insert into public.profiles (id, full_name, role)
values (
  '<uuid-from-auth>',
  'Jane Smith',
  'nurse'
  -- roles: receptionist | nurse | doctor | lab_technician | pharmacist | manager | admin
);
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Key Architectural Decisions

### Next.js 16 — Async params

Both `params` and `searchParams` in page components are Promises in Next.js 16:

```ts
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const { q }  = await searchParams;
}
```

### Supabase TypeScript pattern

Do **not** pass the `<Database>` generic to `createServerClient` / `createBrowserClient` — it causes a `GenericStringError`. Cast through `unknown` instead:

```ts
const rows = (rawData as unknown as MyRow[]) ?? [];
```

### AppShell (mobile sidebar)

Sidebar open/close state lives in `AppShell.tsx` (a client component). It wraps server-rendered `children`, passing handlers to `Sidebar` and `MobileHeader`. The page content itself stays a Server Component.

### Realtime queue

`QueueBoard.tsx` subscribes to the `visits` table. On any database change it calls `router.refresh()` — this triggers a server-side re-fetch of the queue data without a full navigation.

### Server Actions

All mutations are Server Actions (`"use server"` at file top). Client components call them via `useTransition` to get a pending state without converting to a client component unnecessarily.

---

## Roadmap

Scoped but not yet started:

- [ ] **Shift Handover module** — structured handover notes using the existing `shift_handovers` table
- [ ] **OHN-specific forms** — pre-employment medical certificate generation, IOD reporting and documentation
- [ ] **In-app notifications** — real-time role-transition alerts (e.g. "patient ready for triage")

---

## License

Private — internal use only.
