# Working rules for this repo
- Chat replies to Nathan are SHORT: at most 5 lines. Say what was done, the commit(s), whether the offline tests and `npm run e2e` passed, any SQL files waiting to be run, and any question that needs Nathan. All detail goes in the step report in docs/reports/, never in the chat.
- Never run SQL. Write SQL files in sql/ with a SECTION 0 of read-only checks and a DO NOT RUN rollback section. The reviewer reviews and runs them.
- After every deploy, run `npm run e2e` (not test:e2e) and record the result in the report.
- Write a failing test before each fix.
- Reviewers' briefs live in docs/step-*-brief.md; follow docs/handover-pricing.md for the report format.
- Never commit .env.e2e or customer details. Leave public/version.json uncommitted.
Use the Supabase tools only to read the schema and data (list_tables, select queries). Never run inserts, updates, deletes, DDL or migrations — write them as sql/step-*.sql files for the reviewer.