$connectionString = "postgresql://postgres.hexluskvmrspfmekaypr:assistentepro2.0dlsa@aws-0-us-west-2.pooler.supabase.com:6543/postgres"
$sqlFile = "supabase/migrations/001_create_transactions.sql"

$env:PGPASSWORD = "assistentepro2.0dlsa"
psql -U postgres.hexluskvmrspfmekaypr -h aws-0-us-west-2.pooler.supabase.com -p 6543 -d postgres -f $sqlFile
Remove-Item env:PGPASSWORD
