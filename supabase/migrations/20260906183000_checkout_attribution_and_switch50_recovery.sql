-- Allow the fourth reminder slot solely for the explicit-marketing-consent SWITCH50 recovery email.
ALTER TABLE public.checkout_reminders DROP CONSTRAINT IF EXISTS checkout_reminders_reminder_number_check;
ALTER TABLE public.checkout_reminders ADD CONSTRAINT checkout_reminders_reminder_number_check CHECK (reminder_number >= 1 AND reminder_number <= 4);
