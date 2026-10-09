# Add the 2026 Bahrain Grand Prix in Malaysia

The [official timetable](https://www.formula1.com/en/latest/article/formula-1-gulf-air-bahrain-grand-prix-in-malaysia-2026.1IHoy7D2dfCIugb5mH78cE) and Jolpica calendar identify the event as round 16 at Sepang International Circuit:

- Name: Bahrain Grand Prix in Malaysia
- FP1/pick deadline: October 2, 2026, 04:30 UTC
- Race: October 4, 2026, 07:00 UTC
- Singapore through Abu Dhabi become rounds 17–23.

## Scope and safeguards

`scripts/add-bahrain-malaysia.ts` inserts one new race and changes only the round numbers of seven existing races. It preserves every existing race ID, name, circuit, deadline, and race time. Picks, chip selections, submission times, race results, and player scores remain unchanged. Users, leagues, memberships, and driver seats are not written.

The script expects the complete 22-race calendar without Bahrain, or the already updated 23-race calendar. It stops on unexpected names, circuits, rounds, or Bahrain times. A second run is a no-op. It does not use the old `scripts/fix-2026-schedule.ts`, which deletes picks and results and is unsuitable for this addition.

Execution locks the four affected tables, writes a consistent JSON snapshot with restrictive file permissions before the first database change, and applies all changes in a single transaction. It verifies that every original race ID and all attached picks, results, and scores survived unchanged; any failed check rolls back the transaction. Writes to these tables may wait briefly during the transaction. Lock acquisition is limited to 10 seconds and the transaction to 60 seconds.

The snapshot contains all 2026 race rows and their picks, results, and scores, plus the proposed changes. It is a scoped recovery snapshot, not a full database dump. Keep it in a private directory outside version control. The script refuses to overwrite an existing snapshot.

Production currently uses the historical circuit spelling "Losail International Circuit" for Qatar. Matching treats Losail and Lusail as the same venue, while this addition preserves the stored spelling and race ID. Regression tests cover the alias in both schedule matching and result ingestion.

## Apply

Use the intended environment's `DATABASE_URL`. Do not run the seed or the old schedule repair script to add this race.

```sh
# Read-only preview; DATABASE_URL must already be set securely.
npx tsx scripts/add-bahrain-malaysia.ts

# Apply after reviewing the preview. Use a new, absolute, private backup path.
npx tsx scripts/add-bahrain-malaysia.ts --execute --backup /absolute/private/path/bahrain-before.json

# Verify a repeat run reports no changes needed.
npx tsx scripts/add-bahrain-malaysia.ts
```

If the script stops during a transaction, PostgreSQL rolls back its changes. If a committed change needs reversal, use the snapshot to restore existing race round numbers in a transaction after clearing conflicting round numbers. Remove the newly inserted Bahrain race only after checking that it has no picks, results, or scores; preserve any data added since the snapshot. Do not blindly restore or overwrite the whole database.

## Production sequence

1. Establish authorized access to the production database and run the preview.
2. Deploy the schedule sync and result identity safeguards. Both seeding and `/api/admin/sync-season` now match by name and circuit, preserve race IDs, and abort rather than delete unmatched races. Result ingestion checks the event name, circuit, and race date before writing.
3. Run the backed-up addition against production and verify the repeat preview.
4. Add the user-provided production picks to the new Bahrain race ID, checking each league, user, driver, chip, and any existing conflicting pick before updating. Review existing Bahrain/Singapore results for prior round drift before scoring.

The schedule script does not import picks, ingest results, recalculate scores, or send email. The existing result cron may ingest the newly added past race after commit and send summaries, so coordinate it with the forthcoming pick backfill. Any picks added after results are present need their scores recalculated explicitly.

## Applied to production — October 9, 2026

Deployment `dpl_Ehst4YBzcZ7CKxn2SJsANSTWTVHy` is ready on `www.formulaonefantasy.com`. The insertion committed successfully, and a repeat preview reported no changes needed. The new Bahrain race ID is `cmv1gpit30000pft1t8xqpygp`.

The private recovery snapshot is `backups/production/bahrain-2026-10-09-before.json`, protected with mode 0600 and excluded from version control. Separate before-update fingerprints and a verification record are stored beside it.

Verification confirmed 23 contiguous rounds, the correct Bahrain times, Singapore at round 17, and preservation of all original race IDs and metadata. All 112 picks, 327 race results, and 106 player scores remained unchanged; fingerprints for users, leagues, memberships, and driver seats also matched. Both production leaderboard calculations matched stored totals and included Bahrain. The public home and login pages returned HTTP 200, and the schedule API continued to require authentication. All 243 automated tests, TypeScript checking, targeted lint, and the production build passed.

Authenticated browser verification was not completed: automatic approval review rejected creating a member session from the production signing secret. Verification used direct production data and leaderboard calculations plus public HTTP checks instead.

Subsequent production work added the four requested Bahrain picks in Fair Mu Lawn 1, ingested all 22 race results, and recalculated the affected scores. The requested Singapore pick correction was also applied. Private before-change snapshots and verification records are retained in `backups/production/`; existing unrelated picks and scores were preserved. After these updates, production contained 116 picks, 349 race results, and 110 player scores.
