# Darba Plūsma

Uzņēmuma vadība mazam uzņēmumam. Pašreizējā sadaļa ir ienākošie rēķini: mēneša kopsavilkums, saraksts, neapmaksātie un e-pasta rēķinu apstrāde.

## Tehnoloģijas

- Next.js 16 un React 19
- TypeScript un Tailwind CSS 4
- Supabase (PostgreSQL, Auth un RLS)
- Vercel izvietošanai
- Lucide ikonas

## Lokālā palaišana

Nepieciešams Node.js 20 vai jaunāks.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sistēma būs pieejama [http://localhost:3140](http://localhost:3140).

## Supabase sagatavošana

1. Izveido jaunu projektu [Supabase](https://supabase.com).
2. `.env.local` ieliec projekta URL, anon atslēgu un datubāzes savienojumu. Skatīt `.env.example`.
3. Palaiž `npm run db:migrate`.

Migrācijas ir `supabase/migrations`: rēķini, klienti, darbi, neapstrādātā rinda un uzņēmuma uzstādījumi ar pastkastes laukiem. Saraksts rāda izvēlēto mēnesi, neapmaksātie rāda visus apstrādātos neapmaksātos, apstrāde rāda vēl neieliktos. Bez `.env.local` saraksti ir tukši.

## Pieejamie skripti

```bash
npm run dev        # lokālais serveris portā 3140
npm run lint       # ESLint pārbaude
npm run typecheck  # TypeScript pārbaude
npm run build      # production būvējums
npm run start      # production serveris
npm run db:migrate # Supabase migrācijas no .env.local
```

## Vercel

Importē repozitoriju Vercel, pievieno `NEXT_PUBLIC_SUPABASE_URL` un `NEXT_PUBLIC_SUPABASE_ANON_KEY` vides mainīgos un izvieto projektu. Next.js tiek atpazīts automātiski.

## Pašreizējā saskarne

- Sākums: izvēlētā mēneša kopsavilkums, izmaksu veidi un tuvākie termiņi
- Saraksts: izvēlētā mēneša rēķini
- Neapmaksātie: visi neapmaksātie rēķini
- Klienti: nosaukums, adrese un IBAN; darbi atsevišķi
- Apstrādei: augšupielāde vai e-pasta rēķins, kuram pievieno klientu un darbu
- Neapmaksātie: maksājuma fails FiDAViSta vai ISO pain.001.001.09
- Ienākošo rēķinu uzstādījumi: PVN, termiņš un rēķinu pastkaste
- Uzņēmuma uzstādījumi: profils, rēķinu noklusējumi, IBAN un paziņojumi
