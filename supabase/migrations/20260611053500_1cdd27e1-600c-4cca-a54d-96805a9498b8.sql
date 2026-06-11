-- Phase D hardening: deny-all writes on contract-pdfs except for staff/admin.
-- Service role bypasses RLS, so server-side PDF generation continues to work.

DROP POLICY IF EXISTS "contract_pdfs_staff_insert" ON storage.objects;
DROP POLICY IF EXISTS "contract_pdfs_staff_update" ON storage.objects;
DROP POLICY IF EXISTS "contract_pdfs_staff_delete" ON storage.objects;

CREATE POLICY "contract_pdfs_staff_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contract-pdfs'
  AND public.is_staff(auth.uid())
);

CREATE POLICY "contract_pdfs_staff_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'contract-pdfs'
  AND public.is_staff(auth.uid())
)
WITH CHECK (
  bucket_id = 'contract-pdfs'
  AND public.is_staff(auth.uid())
);

CREATE POLICY "contract_pdfs_staff_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'contract-pdfs'
  AND public.is_staff(auth.uid())
);