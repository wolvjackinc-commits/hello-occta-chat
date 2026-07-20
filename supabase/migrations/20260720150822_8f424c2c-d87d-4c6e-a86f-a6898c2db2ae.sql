
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'business_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ticket_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales_admin';
