// sqlConsole.test.js — Step AT item 1
//
// The /dev/sql page's URL handling and table building. The read-only
// GUARANTEE is not tested here and cannot be: it lives in
// public.claude_readonly_query (STABLE, SECURITY INVOKER, one SELECT/WITH,
// Nathan's login) and in PostgREST running a GET rpc in a READ ONLY
// transaction. These tests cover what the page itself decides.

import { describe, it, expect } from 'vitest'
import {
  queryFromSearch, shareLinkFor, resultColumns, formatCell,
  rowCountLabel, errorText, rowsFromResult,
} from './sqlConsole.js'

describe('queryFromSearch', () => {
  it('reads a URL-encoded query, so one can be opened by link', () => {
    const q = "select name from validation_rules where loop_target = 'casement_sash'"
    expect(queryFromSearch(`?q=${encodeURIComponent(q)}`)).toBe(q)
  })

  it('handles the awkward characters a real query contains', () => {
    // &, +, # and % all mean something in a URL; a query full of them has to
    // survive the round trip or the share link is useless.
    const q = "select a #>> '{b,c}' as x from t where s = 'a&b' and n > 1 + 2 and p like '%x%'"
    expect(queryFromSearch(shareLinkFor(q, '', '').replace(/^\?*/, '?'))).toBe(q)
  })

  it('a plus sign survives (it would otherwise decode as a space)', () => {
    const q = 'select 1 + 1 as two'
    expect(queryFromSearch(`?q=${encodeURIComponent(q)}`)).toBe(q)
  })

  it('is null with no query, an empty query or only whitespace', () => {
    expect(queryFromSearch('')).toBeNull()
    expect(queryFromSearch(undefined)).toBeNull()
    expect(queryFromSearch('?')).toBeNull()
    expect(queryFromSearch('?other=1')).toBeNull()
    expect(queryFromSearch('?q=')).toBeNull()
    expect(queryFromSearch('?q=%20%20')).toBeNull()
  })

  it('trims, and works with or without the leading ?', () => {
    expect(queryFromSearch('?q=%20select%201%20')).toBe('select 1')
    expect(queryFromSearch('q=select%201')).toBe('select 1')
  })

  it('a malformed escape does not break the page', () => {
    // URLSearchParams does not throw on a bad escape — it decodes it to
    // U+FFFD — so a hand-edited link gives a query with a replacement
    // character. The page must not crash; the function then refuses it,
    // because it is not a SELECT or WITH.
    expect(() => queryFromSearch('?q=%E0%A4%A')).not.toThrow()
    const q = queryFromSearch('?q=%E0%A4%A')
    expect(typeof q).toBe('string')
    expect(q).not.toMatch(/^(select|with)s/i)
  })
})

describe('shareLinkFor', () => {
  it('builds a link that queryFromSearch reads back exactly', () => {
    const q = "select * from t where a = 'x y' and b > 1"
    const link = shareLinkFor(q, 'https://glazepro.vercel.app')
    expect(link.startsWith('https://glazepro.vercel.app/dev/sql?q=')).toBe(true)
    expect(queryFromSearch(link.slice(link.indexOf('?')))).toBe(q)
  })

  it('an empty query gives the bare page', () => {
    expect(shareLinkFor('', 'https://x')).toBe('https://x/dev/sql')
    expect(shareLinkFor('   ', 'https://x')).toBe('https://x/dev/sql')
  })
})

describe('resultColumns', () => {
  it('keeps the order the keys are first met', () => {
    expect(resultColumns([{ b: 1, a: 2 }, { a: 3, b: 4 }])).toEqual(['b', 'a'])
  })

  it('UNIONS the keys across rows, not just the first row', () => {
    // jsonb_agg can omit a key on some row shapes; taking row 0's keys alone
    // would silently drop a column that only later rows carry.
    expect(resultColumns([{ a: 1 }, { a: 2, b: 3 }, { c: 4 }]))
      .toEqual(['a', 'b', 'c'])
  })

  it('is empty for no rows, and for anything that is not a row list', () => {
    expect(resultColumns([])).toEqual([])
    expect(resultColumns(null)).toEqual([])
    expect(resultColumns('nope')).toEqual([])
  })

  it('skips nulls and non-objects without losing the real rows', () => {
    expect(resultColumns([null, { a: 1 }, 5, [1, 2], { b: 2 }])).toEqual(['a', 'b'])
  })
})

describe('formatCell', () => {
  it('shows null and undefined as a marker, not an empty cell', () => {
    // An empty string and a SQL NULL must not look the same
    expect(formatCell(null)).toBe('—')
    expect(formatCell(undefined)).toBe('—')
    expect(formatCell('')).toBe('')
  })

  it('passes strings through and stringifies numbers and booleans', () => {
    expect(formatCell('casement_sash')).toBe('casement_sash')
    expect(formatCell(0)).toBe('0')
    expect(formatCell(1035.52)).toBe('1035.52')
    expect(formatCell(false)).toBe('false')
    expect(formatCell(true)).toBe('true')
  })

  it('shows nested JSON compactly so a jsonb row cannot break the table', () => {
    expect(formatCell({ a: 1, b: [2, 3] })).toBe('{"a":1,"b":[2,3]}')
    expect(formatCell([1, 'two'])).toBe('[1,"two"]')
  })

  it('survives a value JSON.stringify cannot take', () => {
    const circular = {}
    circular.self = circular
    expect(() => formatCell(circular)).not.toThrow()
  })
})

describe('rowCountLabel', () => {
  it('counts in words', () => {
    expect(rowCountLabel([])).toBe('no rows')
    expect(rowCountLabel([{}])).toBe('1 row')
    expect(rowCountLabel([{}, {}])).toBe('2 rows')
    expect(rowCountLabel(null)).toBe('no rows')
  })

  it('warns at exactly the 2000-row cap, because there may be more', () => {
    const rows = Array.from({ length: 2000 }, () => ({}))
    expect(rowCountLabel(rows)).toContain('2000 rows')
    expect(rowCountLabel(rows)).toContain('cap')
    expect(rowCountLabel(rows.slice(0, 1999))).toBe('1999 rows')
  })
})

describe('errorText', () => {
  it('shows the function’s own refusal verbatim', () => {
    // These messages are the only explanation of WHY a query was refused,
    // so they must not be reworded.
    expect(errorText({ message: 'claude_readonly_query: only a SELECT or WITH query is allowed' }))
      .toBe('claude_readonly_query: only a SELECT or WITH query is allowed')
    expect(errorText({ message: 'claude_readonly_query: not allowed for this user' }))
      .toContain('not allowed for this user')
  })

  it('joins details and hint when PostgREST sends them', () => {
    expect(errorText({ message: 'syntax error', details: 'at or near "slect"', hint: 'check the spelling' }))
      .toBe('syntax error — at or near "slect" — check the spelling')
  })

  it('is null for no error', () => {
    expect(errorText(null)).toBeNull()
    expect(errorText(undefined)).toBeNull()
  })
})

describe('rowsFromResult', () => {
  it('takes the jsonb array the function returns', () => {
    expect(rowsFromResult([{ a: 1 }])).toEqual([{ a: 1 }])
    expect(rowsFromResult([])).toEqual([])
  })

  it('wraps a single object and ignores anything else', () => {
    expect(rowsFromResult({ a: 1 })).toEqual([{ a: 1 }])
    expect(rowsFromResult(null)).toEqual([])
    expect(rowsFromResult(undefined)).toEqual([])
    expect(rowsFromResult('x')).toEqual([])
    expect(rowsFromResult(7)).toEqual([])
  })
})
