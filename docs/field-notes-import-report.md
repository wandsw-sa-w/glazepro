# Field Notes Import Report

Generated: 2026-10-06

## Summary

- **Source**: docs/integrate-drawingboard-schema.txt
- **Real field keys source**: supabase/migrations/20260923_step_a2_field_definitions.sql + sql/step-*.sql
- **Total properties with notes**: 34
- **Imported**: 6
- **Skipped (no such field in GlazePro)**: 28
- **Skipped (empty after cleaning)**: 0

## Imported

| Field key | Note (first 100 chars) |
|---|---|
| `mullionPart.mullionStopSize` | Mullion Stop Size — Stop sizes are dynamically labelled on the drawingboard based on the jamb type s |
| `mullionPart.thicknessInSash` | Thickness for sashes or door leaves are set on those parts using defaultMuntinThickness property. Th |
| `transomPart.transomStopSizeTop` | Transom Top Stop Size — Stop sizes are dynamically labelled on the drawingboard based on the jamb ty |
| `transomPart.transomStopSizeBottom` | Transom Bottom Stop Size — Stop sizes are dynamically labelled on the drawingboard based on the jamb |
| `transomPart.thicknessInSash` | Thickness for sashes or door leaves are set on those parts using defaultMuntinThickness property. Th |
| `bottomSashPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |

## Skipped — field not in GlazePro yet

| Integrate field key | Raw note (first 80 chars) |
|---|---|
| `panelPart.insulationThickness` | 0 = solid timber panel with no insulation<br>Insulation is subtracted from panel |
| `visionPanelGlassPart.internalBeadThickness` | Internal Bead Thickness — <div><img src="/asset/images/drawingboard/VP_bead_tole |
| `visionPanelGlassPart.externalBeadThickness` | External Bead Thickness — <div><img src="/asset/images/drawingboard/VP_bead_tole |
| `visionPanelGlassPart.glassBeadOverlap` | Glass Bead Overlap — <div><img src="/asset/images/drawingboard/VP_bead_tolerance |
| `cillPart.cillBackDepth` | Cill Back Depth — Depth of cill under frame without nosing. Setting this value t |
| `cillPart.isBrickToBrickCill` | Full Cill Replacement — |
| `assemblyFramePart.cillDepth` | Cill Depth — Cill depth is total cill dimension from front to back, cill back +  |
| `assemblyFramePart.casingThickness` | Casing Thickness — |
| `assemblyFramePart.pulleyStileThickness` | Pulley Stile Thickness — |
| `casementSashPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on  |
| `casementSashPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on  |
| `sashPairPart.midRail` | Midrail Height — |
| `sashPairPart.thickness` | Sash Thickness — |
| `doorLeafPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on  |
| `doorLeafPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on  |
| `bottomSashPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on  |
| `rightFrenchCasementSashPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on  |
| `rightFrenchCasementSashPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on  |
| `leftFrenchCasementSashPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on  |
| `leftFrenchCasementSashPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on  |
| `leftFrenchDoorLeafPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on  |
| `leftFrenchDoorLeafPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on  |
| `rightFrenchDoorLeafPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on  |
| `rightFrenchDoorLeafPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on  |
| `bottomStableDoorLeafPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on  |
| `bottomStableDoorLeafPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on  |
| `bottomFloatingTransomCasementSashPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on  |
| `bottomFloatingTransomCasementSashPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on  |

## Skipped — empty after HTML cleaning

None.
