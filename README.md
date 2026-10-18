# Uzņēmuma vadība

Būvuzņēmuma darba galds: klienti un piedāvājumi, ienākošie rēķini, darbinieki, noliktava un grāmatvedības kopsavilkums. Gaišs Next.js frontend.

**Current version:** `0.1.2`

## Palaist

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Atver [http://localhost:3140](http://localhost:3140).

## Kas iekšā

- **Sākums** — `/` un `/dashboard`. Bloki: nenoslēgtie piedāvājumi, neapmaksātie izejošie un ienākošie rēķini, termiņi tuvākajām 7 dienām, darbinieki šobrīd darbā, instrumentu skaits (piesaistīti / brīvi / remontā). Katru bloku var paslēpt un ieslēgt atpakaļ; izvēle paliek pārlūkā
- **Klienti** — `/clients`. Adrese, nosaukums, IBAN, banka, e-pasts, telefons un piezīme. Jauns klients atveras sānu panelī. Piedāvājums atveras no saraksta: kategorijas, pozīcijas, materiāli, mehānismi, peļņa un papildu darbu tāmes. Nofiksēts piedāvājums vairs nav melnraksts
- **Ienākošie rēķini** — saraksts pa mēnesi, neapmaksātie, apstrādei (augšupielāde vai pastkaste), klientu izmaksas un sadaļas uzstādījumi. Neapmaksātajiem var sagatavot FiDAViSta vai ISO pain.001.001.09 maksājuma failu
- **Izejošie rēķini** — `/outgoing_invoices` glabājas datubāzē. Saraksts rāda tekošo mēnesi ar datuma filtru. Neapmaksāto skaits ir sānjoslā. Statusu var apstiprināt kā samaksātu
- **Grāmatvedība** — rēķinu kopsavilkums no ienākošajiem rēķiniem, algas no nostrādātajām stundām un uzņēmuma stundas likmes, nodokļi ar 2026. gada likmēm (VSAOI darbinieks 10,50 %, darba devējs 23,59 %, IIN 25,5 % pēc 550 € neapliekamā minimuma)
- **Darbinieki** — saraksts, šobrīd darbā (pauze un beigas) un darba laika atskaite pa dienām. Atvērtas maiņas diena ir sarkanīga. Dienas ierakstu var labot vai dzēst sānu panelī
- **Noliktava** — materiāli ar atlikumu, iepirkuma vēsturi un neobligātu ienākošo rēķinu. Pozīciju cenas paliek atsevišķi, un piedāvājums ņem pēdējo cenu
- **Instrumenti un apģērbs** — kartītes, atlikums un piesaiste darbiniekam sānu panelī. Instrumenta remonta statusa vēl nav
- **Uzdevumi** — `/tasks` ir pārlūka paraugs, ne datubāzes saraksts
- **Uzņēmuma uzstādījumi** — profils, banka, PVN, rēķinu pastkaste un piedāvājuma likme, derīgums un piezīme
- **To Do** — personīgais saraksts virs lietotāja kartītes, tikai šajā pārlūkā

## Skripti

| Komanda | Apraksts |
|---|---|
| `npm run dev` | Izstrāde, ports **3140** |
| `npm run start` | Produkcijas serveris |
| `npm run build` | Produkcijas būve |
| `npm run typecheck` | TypeScript pārbaude |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Pending `supabase/migrations/*.sql` |

Kopē `.env.example` uz `.env.local`. `NEXT_PUBLIC_SUPABASE_URL` ir projekta hosts (`https://….supabase.co`), bez `/rest/v1/`. `SUPABASE_DB_URL` vajag tikai migrācijām. Detalizēti: [DEVELOPER.md](DEVELOPER.md).

Izmaiņu vēsture: [CHANGELOG.md](CHANGELOG.md).
