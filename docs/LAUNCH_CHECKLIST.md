# Launch checklist (two weeks)

Work through these in order. Each item says who does it and how to check it worked.

## Week 1 — accounts, data and safety

1. **Upgrade Supabase to Pro** (owner, Supabase dashboard → Billing). Free projects have no
   automatic backups and pause when quiet; Pro does neither. Check: Settings → Database → Backups lists daily backups.
2. **Run the database migrations, oldest first** (developer, Supabase → SQL Editor → paste each file → Run).
   All are safe to run more than once. The new ones are:
   - `supabase/migrations/20261017000000_lock_down_remaining_tables.sql` — row level security on two tables.
   - `supabase/migrations/20261017010000_clean_library_and_paper_columns.sql` — deletes the 200 invented
     "papers" an old seed script put in the library (only if it was ever run), and adds the paper columns
     the order form writes. Check: `select count(*) from knowledge_chunks where source_url like '%/handle/123456789/%' and source_url ~ '[a-z][0-9]+$';` returns 0.
3. **Register with the Data Protection Commission** (owner, dataprotection.org.gh). Required under the Data Protection Act, 2012 (Act 843).
4. **Ask Paystack to confirm the Study Draft model** (owner, Paystack dashboard → Get Help). Keep their written reply.
5. **Review the Terms, Privacy and Refund pages** (owner, ideally with a lawyer): `/terms`, `/privacy`, `/refunds`.
   Business choices to confirm: 7 days to report an incomplete draft, 14-day refunds of unused top-ups,
   account deletion within 30 days, replies within 2 working days.

## Week 1 — fill the library

6. **Check every library source answers** (developer, from `backend/`): `npm run rag:verify`.
   Any line marked UNREACHABLE is skipped automatically; fix or remove it in `src/services/rag/repositories.ts`.
7. **Run a first harvest** (developer): `npm run rag:harvest`. It harvests every repository and journal, then
   recent OpenAlex works by Ghana-based authors plus one past year. The weekly job (Sundays 02:00 GMT) carries on
   a year at a time back to 2010. Needs `OPENAI_API_KEY` (embeddings) and, optionally, `OPENALEX_EMAIL`.

## Week 2 — test like a student

8. **Merge the branch into `main`** so Render and Vercel deploy it.
9. **Smoke test on the live site** with a real phone number and a small Paystack top-up:
   - sign in by SMS code; a wrong code five times asks for a new code;
   - top up GHS 1 and see it in the wallet with its reference;
   - order a research Study Draft (the checkbox is required) and a Maternity Care Study; both finish, show the
     reference check, and download a .docx marked "AI-generated study draft" on every page;
   - press "Write your own version": the Workspace opens with headings only, the Draft & coach panel, and the
     own-words check;
   - Premium: select text → Feedback / Explain; type "/" → Write from my sources; Sources panel → From library.
10. **Watch the logs for a day** (Render → Logs): look for `Pipeline failed`, `Wallet credit failed`,
    `Paper columns missing` and `Repository unreachable`.
