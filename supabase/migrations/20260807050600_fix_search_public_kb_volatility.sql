-- search_public_kb records search analytics, so it must be VOLATILE.
-- The original function was declared STABLE, causing PostgreSQL to reject
-- its INSERT into help_search_logs at runtime.
ALTER FUNCTION public.search_public_kb(text, text, integer) VOLATILE;
