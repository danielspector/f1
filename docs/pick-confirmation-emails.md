# Pick confirmation emails

New picks and changes to a driver or chip send a confirmation to the player who owns the pick. Admin entries notify the target member and identify that an admin saved the pick. Re-saving the same driver and chip skips the confirmation.

The receipt includes the league, season, race, round, driver, team, chip (including "None"), FP1 deadline in UTC, and a link to view the pick. It uses the saved selection rather than reloading a pick that might have changed before delivery.

Delivery uses the existing Resend configuration and Next.js `after`, so it runs after the pick response. Database lookup, rendering, sending, and scheduling errors are logged without turning a saved pick into a failed submission. Delivery is best effort; there is no persistent retry queue.

Confirmations are receipts for saving a pick and are independent of reminder and race-summary preferences. The preferences page explains this distinction. No database schema changes or backfill are required, and existing picks do not trigger emails on deployment.

Tests cover both submission routes, the target recipient for admin entries, driver/chip changes, unchanged submissions, failures, the saved snapshot, UTC deadlines, and actual rendered email HTML. Tests mock email delivery and do not send real mail.

## Production status — October 9, 2026

Deployment `dpl_8hNdNfHC4dXCcsM2Sw34NRSexP64` is ready on `www.formulaonefantasy.com`. All 268 tests, targeted lint, TypeScript checking, and the production build passed. Production data fingerprints before and after deployment matched, including all 116 picks, 349 race results, and 110 scores. The home, login, and preferences routes returned HTTP 200; both pick submission routes continued to reject unauthenticated requests.

Vercel metadata confirms `RESEND_API_KEY` is a sensitive variable scoped to Production, updated on October 9; `RESEND_FROM_EMAIL` is set. Sensitive values are withheld from environment downloads, so an empty downloaded value is not evidence that the production secret is empty. The initial local configuration check incorrectly treated the withheld value as missing. Verify sensitive configuration through metadata, without retrieving secret values.

The application was redeployed with the saved production secret and the final read-only checks passed. No real emails were sent during verification, so inbox delivery has not been confirmed. Private deployment verification records are in `backups/production/pick-confirmation-2026-10-09-*.json`.
