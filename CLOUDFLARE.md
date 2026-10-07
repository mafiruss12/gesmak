# Cloudflare Pages — sans Vercel

Production: https://stock-manager-ai.pages.dev

## Variables (Pages → Settings → Environment variables)
Front: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
API: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, INTERNAL_API_SECRET
Optionnel: WA_TOKEN, WA_PHONE_NUMBER_ID, AT_USERNAME, AT_API_KEY, CINETPAY_API_KEY, CINETPAY_SITE_ID

## Crons (cron-job.org gratuit)
- https://stock-manager-ai.pages.dev/api/cron/daily-report-reminder  Header Authorization: Bearer CRON_SECRET  0 21 * * *
- https://stock-manager-ai.pages.dev/api/cron/weekly-profit-report  même header  0 7 * * 1
