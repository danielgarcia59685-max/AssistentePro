Supabase migration: Apply `001_create_transactions.sql`

Options to apply this migration:

1) Supabase web UI (recommended)
- Open your project in Supabase
- Go to SQL Editor
- Paste the contents of `supabase/migrations/001_create_transactions.sql`
- Click Run

2) Using `psql` (requires DB connection string)
- Get your Supabase DB connection string from Settings → Database → Connection string
- Run:

```bash
psql "postgres://<db_user>:<db_pass>@<db_host>:5432/postgres" -f supabase/migrations/001_create_transactions.sql
```

3) Using `supabase` CLI (example workflow)
- Install CLI: https://supabase.com/docs/guides/cli
- Login and link project:

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

- Run SQL through the CLI (if supported) or use `psql` with the DB connection string above.

Notes:
- If Row-Level Security (RLS) is enabled, add suitable policies to allow inserts/reads for your app users.
- The migration enables `pgcrypto` for `gen_random_uuid()`; if you prefer `uuid-ossp`, adapt accordingly.
