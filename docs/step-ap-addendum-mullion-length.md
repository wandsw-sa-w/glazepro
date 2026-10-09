# Step AP addendum — J's mullion length (closes the £0.34 from Step AO)

Reviewer reading, 9 Oct 2026: L31115 item 2 drawing 20 (drawingId 310319) = a copy of J (1/12, utile, mullion), read
through a temporary Quote 2 test quote (Quote 2 emptied and the test quote set back to L34046 / 8 afterwards).
- As copied (head 47, internal height 1205): Casement Transoms & Mullions 1.35 x 12.40 = 16.78 -> length ~1230.
- Head (profiled) changed 47 -> 57 (internal height 1195): 1.34 x 12.40 = 16.64 -> qty 1.3419 -> length 1220.
So for rule 121's frame_muntin_to_be_replaced_length a casement mullion is INTERNAL HEIGHT + 25 (it follows the head,
not the overall height). The frame-timber volume (Step AO §5) uses internal height + 20 for the same mullion — Integrate
really does use two lengths in two rules; keep both, each commented with its reading.
Append this to docs/integrate-L31115-direct-glazed.txt. J should then be exact apart from the ironmongery data
(sql/step-ap0-gearbox-part-costs.sql, written by the reviewer — list it as the reviewer's file, not yours).
