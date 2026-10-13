# Step AV — the TC2 proof (run before any engine change)

The brief: "TC2 (both dividers full) should need no new model at all — prove
that first. If it is not exact on the existing code, stop and report."

TC2's tree (1299 x 1499, mullion full at 590, transom full at 356, four
sashes) priced on the code as it stood at commit 7018b6d, with no engine
change of any kind:

| | GlazePro | Integrate | |
|---|---|---|---|
| openings | 590x356, 608x356, 590x1022, 608x1022 | same | exact |
| sashes | 582x348, 600x348, 582x1014, 600x1014 | same | exact |
| frame timber | 40.90 -> 51.125 -> 28.12 | 40.90 -> 51.13 -> 28.12 | exact |
| production | 1790 min = 29.83 h | 29.83 h | exact |
| glass | 0.30, 0.30, 0.44, 0.45 | same | exact |
| energy | 6.00, 6.00, 8.80, 9.00 | same | exact |
| sash timber | 6.89, 7.03, 11.35, 11.49 | same | exact |
| cill | 13.925 -> 15.11 | 13.93 -> 15.11 | exact |
| architrave | 3.20 -> 9.12, 1.40 -> 3.99 | same | exact |
| consumables, LTW | 30.00, 25.00 | same | exact |
| **labour** | 780 min = 13.00 h | 810 min = 13.50 h | **-30 min** |
| **nosing** | no line | 1.50 m -> 4.14 | **missing** |

Cost 1,522.04 against 1,560.99 — short 38.95, which is exactly three known
and separately named things:

- **20.11** — rule 251 "Windowboard" (30 min) does not fire, because nothing
  computes `has_deep_window_board`. Brief item 1.
- **4.14** — the "Nosing in Solid Redwood" component is not priced. Brief
  item 2 (the stored surround list).
- **14.70** — the two Kenrick gearbox sets, whose four parts carry
  `unit_cost 0` in the captured snapshot. Already fixed live.

20.11 + 4.14 + 14.70 = 38.95.

**So the grid model needed nothing for TC2**: every figure that depends on the
rows-and-columns geometry is exact on the existing code, and the whole
difference is the two additions this brief asks for plus the known data gap.
Nothing was changed before this was established.
