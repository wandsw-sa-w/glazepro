# Validation Rules Import Report

Generated: 2026-10-06

## Summary

| Metric | Value |
|--------|-------|
| Total rules parsed | 158 |
| Active | 158 |
| Blocked | 0 |

## Rules per Group

| Group | Count |
|-------|-------|
| Quote Summary | 10 |
| Glass | 13 |
| Sash Windows | 18 |
| Stormproof Casements | 20 |
| Missing Detail | 10 |
| Dimension | 12 |
| Suspicious Detail | 15 |
| Recommendation | 18 |
| Ironmongery | 3 |
| Friction Hinges | 1 |
| Casement Espags | 5 |
| Health & Safety | 3 |
| Doors | 13 |
| Factory | 6 |
| To Be Checked | 1 |
| Heritage | 10 |

## Blocked Rules

None.

## Transformations Applied

1. `not ==` in conditions converted to `!=`
2. `not =` (not followed by `=`) in conditions converted to `!=`
3. `not not` in messages converted to `!!`
4. Word-internal `not` in messages converted to `!` (e.g. "VENTSnot" -> "VENTS!")
5. List names seeded: landvac_fineo, 6_8_acoustic, trickle_vents, timber
