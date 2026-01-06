-- Add CHECK constraints to support_tickets table for server-side validation
ALTER TABLE public.support_tickets
ADD CONSTRAINT check_subject_length CHECK (LENGTH(subject) BETWEEN 5 AND 100),
ADD CONSTRAINT check_description_length CHECK (LENGTH(description) BETWEEN 20 AND 2000);