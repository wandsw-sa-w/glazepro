# Field Notes Import Report

Generated: 2026-10-06

## Summary

- **Source**: docs/integrate-drawingboard-schema.txt
- **Real field keys source**: supabase/migrations/20260923_step_a2_field_definitions.sql + sql/step-*.sql
- **Total properties with notes**: 34
- **Imported**: 26
- **Skipped (no such field in GlazePro)**: 8
- **Skipped (empty after cleaning)**: 0

## Imported

| Field key | Note (first 100 chars) |
|---|---|
| `panelPart.insulationThickness` | 0 = solid timber panel with no insulation Insulation is subtracted from panel thickness for timber v |
| `cillPart.cillBackDepth` | Cill Back Depth — Depth of cill under frame without nosing. Setting this value to -1, will dynamical |
| `assemblyFramePart.cillDepth` | Cill Depth — Cill depth is total cill dimension from front to back, cill back + nosing |
| `mullionPart.mullionStopSize` | Mullion Stop Size — Stop sizes are dynamically labelled on the drawingboard based on the jamb type s |
| `mullionPart.thicknessInSash` | Thickness for sashes or door leaves are set on those parts using defaultMuntinThickness property. Th |
| `transomPart.transomStopSizeTop` | Transom Top Stop Size — Stop sizes are dynamically labelled on the drawingboard based on the jamb ty |
| `transomPart.transomStopSizeBottom` | Transom Bottom Stop Size — Stop sizes are dynamically labelled on the drawingboard based on the jamb |
| `transomPart.thicknessInSash` | Thickness for sashes or door leaves are set on those parts using defaultMuntinThickness property. Th |
| `casementSashPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |
| `casementSashPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |
| `doorLeafPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |
| `doorLeafPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |
| `bottomSashPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |
| `bottomSashPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |
| `rightFrenchCasementSashPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |
| `rightFrenchCasementSashPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |
| `leftFrenchCasementSashPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |
| `leftFrenchCasementSashPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |
| `leftFrenchDoorLeafPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |
| `leftFrenchDoorLeafPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |
| `rightFrenchDoorLeafPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |
| `rightFrenchDoorLeafPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |
| `bottomStableDoorLeafPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |
| `bottomStableDoorLeafPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |
| `bottomFloatingTransomCasementSashPart.bottomHeight` | Internal Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |
| `bottomFloatingTransomCasementSashPart.bottomHeightExternal` | External Bottom Rail Height — Calculation converts between int. & ext. based on angle and/or shape.  |

## Skipped — field not in GlazePro yet

| Integrate field key | Raw note (first 80 chars) |
|---|---|
| `visionPanelGlassPart.internalBeadThickness` | Internal Bead Thickness — <div><img src="/asset/images/drawingboard/VP_bead_tole |
| `visionPanelGlassPart.externalBeadThickness` | External Bead Thickness — <div><img src="/asset/images/drawingboard/VP_bead_tole |
| `visionPanelGlassPart.glassBeadOverlap` | Glass Bead Overlap — <div><img src="/asset/images/drawingboard/VP_bead_tolerance |
| `cillPart.isBrickToBrickCill` | Full Cill Replacement — |
| `assemblyFramePart.casingThickness` | Casing Thickness — |
| `assemblyFramePart.pulleyStileThickness` | Pulley Stile Thickness — |
| `sashPairPart.midRail` | Midrail Height — |
| `sashPairPart.thickness` | Sash Thickness — |

## Skipped — empty after HTML cleaning

None.
