
-- ============== user_roles: consolidate policies ==============
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins may write user_roles" ON public.user_roles;

-- Single restrictive write gate covering admin + super_admin
CREATE POLICY "Only admins or super_admins may write user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Permissive SELECT for admins/super_admins (own-role policy remains)
CREATE POLICY "Admins and super_admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- ============== quotes: narrow staff read access ==============
DROP POLICY IF EXISTS "q_staff_select_all" ON public.quotes;

CREATE POLICY "q_finance_sales_select"
ON public.quotes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'finance_admin'::app_role)
  OR has_role(auth.uid(), 'sales_agent'::app_role)
);
