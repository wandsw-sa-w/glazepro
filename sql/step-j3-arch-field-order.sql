-- ============================================================
-- Step J3 — arch fields grouped under Arch Head in the property editor
--
-- DO NOT RUN — paste into Supabase SQL editor.
--
-- The property editor lists fields in default_field_definitions.sort_order
-- (src/drawingBoard/api.js#loadFieldDefinitions orders by it; DrawingBoard.jsx
-- does no client-side re-sort). assemblyFramePart.width/height/archHead sit
-- at sort_order 635/636/637 (Step A2); archRadius/archHeight/shoulderHeight
-- were added by sql/step-j1-parts.sql at 2300-2302, far down the list.
-- This moves them to sit immediately after Arch Head, in Integrate's order:
-- Frame Width, Frame Height, Arch Head, Arch Radius, Arch Height,
-- Shoulder Height.
--
-- Safe to re-run: plain UPDATEs by field_key, idempotent.
-- ============================================================

BEGIN;

UPDATE default_field_definitions SET sort_order = 638 WHERE field_key = 'assemblyFramePart.archRadius';
UPDATE default_field_definitions SET sort_order = 639 WHERE field_key = 'assemblyFramePart.archHeight';
UPDATE default_field_definitions SET sort_order = 640 WHERE field_key = 'assemblyFramePart.shoulderHeight';

COMMIT;
