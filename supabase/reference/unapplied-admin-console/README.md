# Unapplied alternate admin schema

These two historical SQL files are preserved as reference outside the executable migration directory. Read-only inspection of OCCTA LIMITED's Lovable Cloud database on 6 September 2026 confirmed:

- Neither version is present in `supabase_migrations.schema_migrations`.
- Production uses the January core tables: text service/invoice status, numeric invoice totals, and the original communications table.
- The alternate `plans`, `audit_log`, `customer_notes`, `app_config`, `invoice_adjustments`, `note_visibility` and `invoice_status` objects are absent. The alternate `log_audit` function is absent too.
- The expansion attempts to recreate existing services/billing/communications tables with incompatible definitions. The adjustment depends on that alternate schema and renames a supplier column into an existing column.

They were therefore not part of OCCTA's applied schema history. Running them during a fresh replay fails with SQLSTATE 42P07 and produces a schema different from production. Keeping them in the executable directory does not accurately reproduce OCCTA.

The originals are retained byte-for-byte for review. No live schema, migration-history entry, customer record or deployment was changed by this reconciliation. Other unapplied migrations remain in the normal directory; this is a targeted removal of the confirmed conflicting alternate schema, not a blanket exclusion of unapplied changes.
