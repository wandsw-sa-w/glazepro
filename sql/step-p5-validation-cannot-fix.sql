-- ============================================================================
-- step-p5-validation-cannot-fix.sql — RUN THIS ONE
-- The validation import turned the word "cannot" into "can!" in rule messages
-- (e.g. "Frame depth can! be 0mm"). This puts "cannot" back.
-- Only the message text changes. Conditions, severity and active state are untouched.
-- Safe to re-run.
-- ============================================================================

UPDATE public.validation_rules
SET    message = replace(replace(message, 'Can!', 'Cannot'), 'can!', 'cannot')
WHERE  message LIKE '%can!%' OR message LIKE '%Can!%';

-- Check: should return 0
SELECT count(*) AS still_wrong
FROM   public.validation_rules
WHERE  message LIKE '%can!%' OR message LIKE '%Can!%';

-- ROLLBACK — DO NOT RUN: not needed; the old text was a mistake.
