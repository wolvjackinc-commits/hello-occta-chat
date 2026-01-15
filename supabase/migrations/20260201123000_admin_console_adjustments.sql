-- Service enhancements
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activation_date DATE,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

ALTER TABLE public.services
  RENAME COLUMN supplier_ref TO supplier_reference;

-- Invoice status enum and service linkage
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft', 'issued', 'sent', 'paid', 'overdue');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL;

ALTER TABLE public.invoices
  ALTER COLUMN status TYPE public.invoice_status USING status::public.invoice_status;

-- Ticket message visibility
ALTER TABLE public.ticket_messages
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

-- Support role policies for tickets
CREATE POLICY "Support can manage tickets"
ON public.support_tickets FOR ALL
USING (public.has_role(auth.uid(), 'support'))
WITH CHECK (public.has_role(auth.uid(), 'support'));

CREATE POLICY "Support can manage ticket messages"
ON public.ticket_messages FOR ALL
USING (public.has_role(auth.uid(), 'support'))
WITH CHECK (public.has_role(auth.uid(), 'support'));

-- Audit logging for inserts
CREATE TRIGGER audit_invoices_insert
  AFTER INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_services_insert
  AFTER INSERT ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_customer_notes_insert
  AFTER INSERT ON public.customer_notes
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();
