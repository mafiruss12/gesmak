# Rappel automatique — rapport journalier

## Vercel Cron (configuré)

- Path : `/api/cron/daily-report-reminder`
- Horaire : **21:00 UTC** chaque jour
- Notifications in-app si clôture absente

## Variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

## Test

`/api/cron/daily-report-reminder?secret=CRON_SECRET`

## Backup : https://cron-job.org (gratuit)
