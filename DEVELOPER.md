# Uzņēmuma vadība - izstrādātāja dokumentācija

## Tech stack

- Next.js 16.4 App Router, React 19, TypeScript
- Tailwind CSS 4, Lucide ikonas
- `@supabase/supabase-js` un `@supabase/ssr`; migrācijas caur `pg`
- Ports: **3140** (`npm run dev`, `next dev -p 3140`)
- `next.config.ts`: `cacheComponents: true`. Lapa, kas sauc `connection()` vai `await params`, ir savā `Suspense`. `runtime = "nodejs"` uz route handler neeksportē
- Datumi UI: `formatDate()` no `app/lib/invoices/model.ts` dod `DD.MM.YYYY`. Datubāzē un stāvoklī ISO `YYYY-MM-DD`. `toLocaleDateString()` lietotāja datumiem nelieto
- Nauda UI: `formatMoney(value)` dod `1 234,56 €` (atstarpe tūkstošiem, komats decimālim). `toLocaleString()` un kails `toFixed` komponentē nelieto
- Lietotāja atbilde: `FeedbackToasts` (`app/components/feedback-toast.tsx`), ne `window.alert`
- Pogas: `button` kursors nāk no `app/globals.css`. Atspējotai pogai `cursor: not-allowed`

## Kopīgie helperi

| Modulis | Funkcijas | Lietojums |
|---|---|---|
| `invoices/model.ts` | `formatMoney`, `formatDate`, `addDays`, `isOverdue`, `todayIso`, `vatGross` | Summas, datumi, termiņi, PVN bruto |
| `invoices/repository.ts` | `createDataClient`, `loadDeskData` | Pārlūka Supabase klients un sākuma ielāde |
| `payments/iban.ts` | IBAN mod-97 un bankas nosaukums | Klienta un uzņēmuma konts |
| `payments/fidavista.ts`, `payments/pain001.ts` | Maksājuma faila saturs | Neapmaksāto rēķinu eksports |
| `offers/model.ts` | `sanitizeOfferDocument`, cenu salīdzinājums | Piedāvājuma JSON |
| `work-sessions/model.ts` | `workedSeconds`, `overlapSeconds`, `formatDuration` | Maiņas laiks ar pauzi |
| `accounting/payroll.ts` | `payrollRows`, `payrollTotals`, `parseHourlyRate` | Algas un nodokļi |

UI, ko atkārto, nevis kopē:

- `RightDrawer` — sānu panelis. Otrais panelis pa kreisi saņem `beside={440}` un izslīd no apakšas, ne pa virsu
- `ConfirmModal` — dzēšana un aizvēršana ar nesaglabātām izmaiņām. `window.confirm()` nelieto
- `DateField` — kalendāra popover
- `Tooltip` — ikonas pogām bez teksta

## Sānjosla

`app/components/app-shell.tsx`. Datorā kreisā josla ir 240px. Zem `lg` to atver burger poga. Aktīvajai sadaļai (ienākošie rēķini, grāmatvedība, noliktava, darbinieki) datorā ir otrā josla ar apakšsaiti. Mobilajā tās pašas saites ir zem galvenās.

| Rinda | Ceļš |
|---|---|
| Sākums | `/dashboard` (arī `/` rāda to pašu skatu) |
| Uzdevumi | `/tasks`, `/tasks/[listId]`, `/tasks/[listId]/[taskId]` |
| Klienti | `/clients` |
| Izejošie rēķini | `/outgoing_invoices` |
| Ienākošie rēķini | `/incoming_invoices`, `unpaid`, `processing`, `costs`, `settings` |
| Grāmatvedība | `/accounting`, `/accounting/salaries`, `/accounting/taxes` |
| Noliktava | `/warehouse`, `/warehouse/prices` |
| Darbinieki | `/employees`, `/employees/now`, `/employees/timesheet` |
| Instrumenti | `/tools` |
| Apģērbs | `/clothing` |
| Uzņēmuma uzstādījumi | `/company_settings` |

Virsraksts mobilajā galvenē nāk no tā paša ceļa. Neapmaksāto un apstrādes skaits ir no `InvoiceProvider`.

Personīgais To Do (`PersonalTodoPanel`) ir virs lietotāja kartītes. Tas nav komandas uzdevums.

## Sadaļas

### Sākums

`app/components/home-view.tsx`. Seši bloki. Paslēptie ID ir `localStorage` atslēgā `bm_dashboard_blocks`. Pirmo renderi neglabā no `localStorage`, lai serveris un klients sakristu.

- Nenoslēgts piedāvājums: dokumentam ir grupas un tukšs `fixedAt`, vai papildu tāmei ir grupas un tukšs `fixedAt`
- Termiņi: neapmaksāts ienākošais rēķins, kuram `dueOn` ir no šodienas līdz `addDays(today, 7)`. Kavētie paliek neapmaksāto blokā
- Instrumenti: pēdējā piesaiste `kind === "assigned"` ir piesaistīts, pārējie ir brīvi. Remontā vienmēr 0, jo kartē tāda statusa nav
- Izejošie neapmaksātie vienmēr ir tukši, kamēr melnraksti netiek saglabāti

### Klienti un piedāvājumi

Klients ir `sites` rinda (`address`, `customer`, `iban`, `bankName`). Piedāvājums ir viena `offers` rinda uz `site_id`, dokuments ir `jsonb`.

`OfferDocument`: `groups`, `extras`, `profitPercent`, `profitHidden`, `fixedAt`. Papildu darbi ir `extras[]` ar savu `fixedAt`. Tukšs `fixedAt` nozīmē, ka tāme vēl nav noslēgta. Peļņas ievade papildu tāmē ir paslēpta.

Cenas nāk no `price_positions` / `price_entries`. Piedāvājums rāda, ja noliktavas cena ir jaunāka par atzīto.

### Ienākošie rēķini

`InvoiceProvider` ielādē rēķinus, pastkasti, klientus un uzņēmuma uzstādījumus serverī (`loadDeskData`) un padod tiem kontekstu.

Apstrāde: fails (PDF teksts vai attēla OCR) vai nelasītā pastkaste (`imapflow`). Apstiprinot ierakstu, tas kļūst par `invoices` rindu un pazūd no rindas. IMAP, ielādējot vēstuli, to atzīmē kā lasītu.

Neapmaksātie: `paid = false`. Eksports ir FiDAViSta vai pain.001.001.09 no piegādātāja IBAN un uzņēmuma konta.

### Izejošie rēķini

`outgoing_invoices` glabā klientam izrakstītos rēķinus: klients, numurs, datums, termiņš, summas un neobligāta piedāvājuma pozīcija. Saraksts rāda tekošo mēnesi ar datuma filtru un iepriekšējo mēnesi. Jauns rēķins pēc izveides aizver sānu paneli un parāda paziņojumu. Grāmatvedības kopsavilkums ieņēmumus no šīs tabulas vēl nerāda.

### Grāmatvedība

Mēnesi tur kopīgs stāvoklis. Kopsavilkums ņem tikai ienākošos rēķinus. Ieņēmumus no izejošajiem neizdomā.

Algas: `work_sessions` pārklājums mēnesī reiz `company_settings.offer_hourly_rate`. Ja likmes nav, stundas rāda, nauda ir "—".

Nodokļi: ienākošais PVN un algas nodokļi. Likmes ir konstantes `app/lib/accounting/payroll.ts` (2026): darbinieka VSAOI 10,50 %, darba devēja 23,59 %, IIN 25,5 % no bruto pēc darbinieka VSAOI un 550 € neapliekamā minimuma.

### Darbinieki

`employees` ir kartīte. Maiņa ir `work_sessions`. Vienam darbiniekam vienlaikus tikai viena atvērta maiņa (`ended_at is null`).

Pauze: `paused_at` un uzkrātais `pause_seconds`. Atverot pauzi, taimeris apstājas. Turpinot, pagājušais pauzes laiks pieskaitās `pause_seconds`. Beidzot pauzētu maiņu, `ended_at` ir `paused_at`.

Atskaite: dienas šūna ar stundām atver sānu paneli. Labošana atver otru paneli pa kreisi (`beside={440}`). Objekta lauks rāda adreses, saglabā `place_name` kā klienta nosaukumu un `place_address` kā adresi. Tukšas beigas nozīmē, ka maiņa paliek atvērta.

### Noliktava, instrumenti, apģērbs

Noliktavas materiāli ir `materials` un iepirkumi `material_receipts` (daudzums, neobligāts veikals, summa, neobligāts `invoice_id` uz ienākošo rēķinu). Pozīciju cenas paliek `price_positions`. Instrumenta piesaiste ir `instrument_assignments` ar `kind` `assigned` vai `returned`. Pēdējā rinda pēc `created_at` ir aktuālais turētājs. Apģērbam ir izmēru atlikums `clothing_stocks` un izsniegšana `clothing_assignments`.

### Uzdevumi

`app/lib/tasks/demo-store.ts` tur sarakstus atmiņā. Pārlādējot lapu, izmaiņas pazūd. Tas nav `work_sessions` un nav personīgais To Do.

## Project structure

```
next.config.ts                    # cacheComponents, ports nav te (skati package.json dev)
app/
  layout.tsx                      # saknes izkārtojums
  globals.css                     # poga, rādiuss, animācijas
  (desk)/
    layout.tsx                    # InvoiceProvider + AppShell; connection() iekš Suspense
    page.tsx                      # / rāda HomeView
    dashboard/page.tsx            # /dashboard
    clients/ incoming_invoices/ outgoing_invoices/
    accounting/ employees/ warehouse/ tools/ clothing/ tasks/
    company_settings/
  components/                     # skati un kopīgais UI
  lib/
    invoices/ offers/ prices/ catalog/
    work-sessions/ accounting/ payments/ mail/ company/
    tasks/demo-store.ts           # uzdevumu paraugs, ne Postgres
  api/                            # pastkaste, rēķina fails, uzņēmuma meklēšana
supabase/migrations/              # 001_ … secīgi; lietotais modelis sākas ar 002
scripts/apply-migrations.mjs      # npm run db:migrate
```

## Supabase

Kopē `.env.example` uz `.env.local`. URL ir tikai projekta hosts (`https://PROJECT_REF.supabase.co`), ne `/rest/v1/`.

| Mainīgais | Kur ņemt |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → `service_role`. Servera pastkastei un failiem. Neliec pārlūkā |
| `SUPABASE_DB_URL` | Settings → Database → connection string (pooler). Tikai `npm run db:migrate` |

```bash
npm run db:migrate
```

`apply-migrations.mjs` pieraksta izpildītos failus `public.schema_migrations` un palaiž tikai pending. Neveiksmīgs fails netiek pierakstīts. Pēc veiksmīgas migrācijas skripts sūta `NOTIFY pgrst, 'reload schema'`.

Jauna migrācija ir nākamais numurs (`028_…`). Jau pielietotu failu nerediģē. SQL ir idempotents (`if not exists`, `on conflict`, `add column if not exists`).

RLS ir ieslēgts, bet darba tabulām politika ir atvērta `anon` un `authenticated` (`demo_*_all`). Tā ir izstrādes piekļuve, ne gatava daudzlietotāju shēma. `001_initial_schema.sql` izveido `organizations`, `estimates`, `projects` un vecās `tools` tabulas. Lietotne tās nevaicā. Dzīvais modelis ir no `002` uz augšu.

## Vercel

Importē [github.com/Sandrulis/business-management](https://github.com/Sandrulis/business-management). Next.js tiek atpazīts pats. Vērtības bez pēdiņām. Pēc `NEXT_PUBLIC_*` maiņas vajag jaunu deploy.

| Name | Obligāts | Piezīme |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | jā | hosts, ne `/rest/v1/` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | jā | `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | jā, ja ir pastkaste vai faili | tikai serverī |
| `SUPABASE_DB_URL` | nē | tikai lokālajām migrācijām |

`PORT` neliek. Vercel ports nav 3140.

## Dati

Darba dati ir Postgres. Izņēmumi ir zemāk.

| Tabula | Saturs |
|---|---|
| `company_settings` | Viena rinda (`id = 1`): profils, PVN, banka, pastkaste, `offer_hourly_rate`, `offer_valid_days`, `offer_note` |
| `mailboxes` | Papildu pastkastes |
| `sites` | Klienti: adrese, nosaukums, IBAN, banka |
| `offers` | Piedāvājuma `jsonb` uz `site_id` |
| `invoices` | Apstiprināti ienākošie rēķini, `paid`, termiņš, piegādātāja IBAN, avota fails |
| `outgoing_invoices` | Izejošie rēķini klientiem: numurs, datums, termiņš, summas, pozīcija |
| `inbox_items` | Vēl neapstiprināti e-pasta vai augšupielādes rēķini |
| `mailbox_imports` | Jau ielasīto vēstuļu identifikatori |
| `materials`, `material_receipts` | Noliktavas materiāls, mērvienība un iepirkumi |
| `price_positions`, `price_entries` | Pozīciju cenas un cenu vēsture |
| `employees` | Darbinieka kartīte |
| `work_sessions` | Maiņa: sākums, beigas, `paused_at`, `pause_seconds`, objekts |
| `instruments`, `instrument_assignments` | Instruments un piesaiste vai atgriešana |
| `clothing`, `clothing_stocks`, `clothing_assignments` | Apģērbs, izmēru atlikums, izsniegšana |
| `schema_migrations` | Kuri SQL faili jau ir palaisti |

`works` ir noņemta (`021`). Rēķina izmaksu veids ir `category_id` / `category_name`.

Kas nav datubāzē:

| Vieta | Kur paliek |
|---|---|
| Uzdevumi | `demo-store.ts` atmiņa |
| Sākuma bloku redzamība | `localStorage` `bm_dashboard_blocks` |
| Personīgais To Do | `localStorage` `bm_personal_todos` |
| Peldošo rēķina logu vieta | `localStorage` `bm-float-email`, `bm-float-file` |

## Versioning & commits

Versija ir `package.json` `"version"`. README rāda to pašu `**Current version:**`. `CHANGELOG.md` jaunākā sadaļa ir augšā (`## vX.Y.Z`). `## Unreleased` ir `- (none)`, kamēr nav nākamās versijas.

Šī repozitorija esošie commit ziņojumi ir viens teikums bez versijas sufiksa. Versiju bumpo tad, kad tiek izlaistas izmaiņas, un to pašu versiju ieraksta CHANGELOG.

Pirms release:

```bash
npm run typecheck
npm run lint
npm run build
```

## Roadmap

- Rādīt izejošo rēķinu ieņēmumus grāmatvedības kopsavilkumā
- Pārcelt uzdevumus no pārlūka parauga uz Postgres
- Instrumenta remonta statuss, lai sākuma bloks "Remontā" nav vienmēr 0
- Aizvērt atvērto demo RLS un pievienot lietotāju pieslēgšanos
- Novākt nelietotās `001` tabulas, kad ir skaidrs, ka tās vairs nevajag
