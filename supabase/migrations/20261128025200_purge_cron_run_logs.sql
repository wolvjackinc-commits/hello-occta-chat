-- Keep pg_cron's run log small. cron.job_run_details had grown to 2.17M rows
-- (3.1 GB, 97% of the database) because nothing ever purged it; 1.99M of
-- those rows came from a job deleted in October 2026. Old rows were deleted
-- and the table compacted on 28 Nov 2026; this job keeps 14 days of history.
-- Applied live on 28 Nov 2026. Safe to re-run: pg_cron 1.6 updates a job
-- with the same name in place.
select cron.schedule(
  'purge-cron-run-logs',
  '52 2 * * *',
  $$delete from cron.job_run_details where start_time < now() - interval '14 days'$$
);
