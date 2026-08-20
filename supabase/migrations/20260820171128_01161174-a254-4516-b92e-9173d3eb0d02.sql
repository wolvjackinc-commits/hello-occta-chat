UPDATE public.communications_log
SET status = 'failed',
    error_message = 'Logged only - not dispatched via email provider; superseded by delivered email 005c96bd-8499-4c92-acda-cc67474f53c9'
WHERE id IN ('92ceea07-27f8-4491-99c1-5ae789b3394b','6bfa0a81-7022-4cc1-8cad-e1cfe388d73d');