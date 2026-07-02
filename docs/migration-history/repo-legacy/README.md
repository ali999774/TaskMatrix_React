# Legacy `supabase/migrations/` files (pre-reconciliation)

These 6 files are exactly what used to live in `supabase/migrations/` before
the migration ledger reconciliation (see
`docs/migration-ledger-reconciliation-plan.md`). They are archived here,
unmodified, for history. They are **not** applied by `supabase db push` /
`supabase db reset` from this location.

Disposition of each file, per the plan's §1.4 diff:

| File | Disposition | Detail |
|------|-------------|--------|
| `20260621_device_tokens.sql` | Applied under a different version | Ledger `20260621233823_device_tokens`, identical content. |
| `20260621_task_reminders.sql` | Applied under a different version | Ledger `20260621235200_task_reminders`, identical content. Also collided with the file above: both parsed to CLI version `20260621`. |
| `20260624_core_table_rls.sql` | Applied under different versions (split) | Consolidated rewrite whose end state matches two ledger entries: `20260627003941_core_table_rls` + `20260627004336_harden_user_settings_update_with_check`. End-state equivalent, no 1:1 ledger row. |
| `20260626_sticky_notes_soft_delete.sql` | Applied under a different version | Ledger `20260626133345_sticky_notes_soft_delete`, identical content (comments differ). |
| `20260627_add_series_id.sql` | Never applied under any version | No ledger record exists for this content. The `series_id` column exists in prod, added fully out-of-band (no ledger row). See plan §5. |
| `20260629_add_lead_days.sql` | Applied under a different version | Ledger `20260629192953_add_lead_days`, identical content (comments differ). |

The verbatim, applied SQL for every ledger-recorded migration (including the
5 files above that matched under a different version string) lives in
`docs/migration-history/applied/`, keyed by the ledger's own version.

The current schema state — including everything these 6 files intended,
plus the out-of-band `series_id` column and its
`uniq_active_occurrence_per_series` index — is captured in the generated
baseline migration at `supabase/migrations/20260703000000_baseline.sql`.
