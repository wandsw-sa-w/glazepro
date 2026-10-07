/**
 * PriceBreakdown.jsx
 * In-page dialog showing what a drawing's LATEST stored pricing run was made
 * of: price file, date, who ran it, every price rule that fired grouped the
 * way the benchmark page groups them, group totals, item cost and price, and
 * all warnings stored with the run.
 *
 * It renders only what was stored for that run (pricing_runs +
 * drawing_rule_results) — it never re-runs the pricing engine. The table is
 * the same PriceTable the benchmark page uses, so the two cannot drift.
 *
 * Reachable from the drawing board's Price part and from each drawing card
 * on the Quote Matrix.
 */

import { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'
import { PriceTable, fmt } from '../pricing/PriceRuleTable.jsx'
import { buildBreakdownLines, hasRecordedDetail } from '../quotes/runBreakdown.js'

export function PriceBreakdown({ drawingId, onClose }) {
  const [state, setState] = useState({ status: 'loading', error: null, data: null })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // 1. Latest completed pricing run for this drawing
        const { data: runs, error: runErr } = await supabase
          .from('pricing_runs')
          .select('id, price_file_id, status, created_at, created_by, warnings, total_cost, total_sales')
          .eq('drawing_id', drawingId)
          .eq('status', 'complete')
          .order('created_at', { ascending: false })
          .limit(1)
        if (runErr) throw new Error(`pricing_runs: ${runErr.message}`)
        const run = runs?.[0] ?? null
        if (!run) {
          if (!cancelled) setState({ status: 'empty', error: null, data: null })
          return
        }

        // 2. Stored rule results for that run (price rows carry sales;
        //    labour rows store minutes and are excluded by the mapper)
        const { data: resultRows, error: resErr } = await supabase
          .from('drawing_rule_results')
          .select('price_rule_id, cost, sales, markup_applied, quantity, value, part_label, part_code')
          .eq('pricing_run_id', run.id)
          .not('sales', 'is', null)
        if (resErr) throw new Error(`drawing_rule_results: ${resErr.message}`)

        // 3. Rule names/groups (fetched by id — no FK join dependency)
        const ruleIds = [...new Set((resultRows ?? []).map(r => r.price_rule_id).filter(Boolean))]
        let rulesById = {}
        if (ruleIds.length > 0) {
          const { data: ruleRows, error: ruleErr } = await supabase
            .from('price_rules')
            .select('id, name, group_name')
            .in('id', ruleIds)
          if (ruleErr) throw new Error(`price_rules: ${ruleErr.message}`)
          rulesById = Object.fromEntries((ruleRows ?? []).map(r => [r.id, r]))
        }

        // 4. Price file name
        let priceFileName = null
        if (run.price_file_id) {
          const { data: pf, error: pfErr } = await supabase
            .from('price_files').select('name').eq('id', run.price_file_id).maybeSingle()
          if (pfErr) throw new Error(`price_files: ${pfErr.message}`)
          priceFileName = pf?.name ?? null
        }

        // 5. Who ran it
        let runBy = null
        if (run.created_by) {
          const { data: u, error: uErr } = await supabase
            .from('users').select('full_name').eq('id', run.created_by).maybeSingle()
          if (uErr) throw new Error(`users: ${uErr.message}`)
          runBy = u?.full_name ?? null
        }

        if (cancelled) return
        setState({
          status: 'done',
          error:  null,
          data: {
            run,
            priceFileName,
            runBy,
            lines: buildBreakdownLines(resultRows ?? [], rulesById),
            detailRecorded: hasRecordedDetail(resultRows ?? []),
            warnings: Array.isArray(run.warnings) ? run.warnings : null,
          },
        })
      } catch (err) {
        // A failed load must never be shown as an empty or zero result.
        if (!cancelled) setState({ status: 'error', error: err.message, data: null })
      }
    }

    load()
    return () => { cancelled = true }
  }, [drawingId])

  const { status, error, data } = state

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,30,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 12, maxWidth: 1100, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: '18px 22px', fontFamily: 'monospace', fontSize: 13, color: '#222', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Price breakdown</div>
          <button onClick={onClose} style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#faf9f7', cursor: 'pointer' }}>Close</button>
        </div>

        {status === 'loading' && <p style={{ color: '#888' }}>Loading stored pricing run…</p>}

        {status === 'error' && (
          <div style={{ color: '#c00', padding: 12, background: '#fff0f0', border: '1px solid #fcc', borderRadius: 6 }}>
            <strong>Could not load the stored pricing run:</strong> {error}
            <div style={{ color: '#884444', marginTop: 6, fontSize: 12 }}>
              If this mentions a missing column, sql/step-t1-price-breakdown.sql has not been run yet.
            </div>
          </div>
        )}

        {status === 'empty' && (
          <p style={{ color: '#888' }}>This drawing has no completed pricing run yet.</p>
        )}

        {status === 'done' && data && (
          <>
            {/* Run header: price file, date, who ran it */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '8px 12px', background: '#f7f7f7', border: '1px solid #ddd', borderRadius: 6, marginBottom: 12, fontSize: 12 }}>
              <span><span style={{ color: '#888' }}>Price file: </span><strong>{data.priceFileName ?? '—'}</strong></span>
              <span><span style={{ color: '#888' }}>Priced: </span><strong>{data.run.created_at ? new Date(data.run.created_at).toLocaleString('en-GB') : '—'}</strong></span>
              <span><span style={{ color: '#888' }}>Run by: </span><strong>{data.runBy ?? '—'}</strong></span>
              <span><span style={{ color: '#888' }}>Item cost: </span><strong>{'£'}{fmt(data.run.total_cost)}</strong></span>
              <span><span style={{ color: '#888' }}>Item price: </span><strong>{'£'}{fmt(data.run.total_sales)}</strong></span>
            </div>

            {/* Older runs predate the detail columns */}
            {!data.detailRecorded && (
              <div style={{ padding: '6px 12px', background: '#fffbe6', border: '1px solid #e6c800', borderRadius: 6, marginBottom: 12, fontSize: 12 }}>
                Detail not recorded for this run (it predates the breakdown columns) — quantity, value and part labels
                will appear on the next pricing run. Cost, markup and price below are as stored.
              </div>
            )}

            {/* Warnings stored with the run */}
            {data.warnings == null ? (
              <div style={{ padding: '6px 12px', background: '#fffbe6', border: '1px solid #e6c800', borderRadius: 6, marginBottom: 12, fontSize: 12 }}>
                Warnings were not recorded for this run (it predates warning storage).
              </div>
            ) : data.warnings.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 10px', marginBottom: 12, fontSize: 12 }}>
                {data.warnings.map((w, i) => <div key={i} style={{ color: '#991b1b' }}>{'⚠'} {String(w)}</div>)}
              </div>
            )}

            {/* The shared benchmark table — stored lines, no targets */}
            <PriceTable lines={data.lines} />
          </>
        )}
      </div>
    </div>
  )
}
