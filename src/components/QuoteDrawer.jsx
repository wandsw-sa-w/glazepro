import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

const STATUS_STYLE = {
  Open:      { bg: '#f5f4f0', color: '#666' },
  Published: { bg: '#e6f0fb', color: '#1a5fa8' },
  Ordered:   { bg: '#e1f5ee', color: '#0a5a3c' },
}

export default function QuoteDrawer({ quote, lead, onClose, onQuoteUpdate }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [selectedItem, setSelectedItem] = useState(null)
  const [addingItem, setAddingItem] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [locationDraft, setLocationDraft] = useState('')
  const [savingLocation, setSavingLocation] = useState(false)

  const statusStyle = STATUS_STYLE[quote.status] || STATUS_STYLE.Open

  useEffect(() => {
    fetchItems()
  }, [quote.id])

  useEffect(() => {
    if (selectedItem) {
      setLocationDraft(selectedItem.location || '')
    }
  }, [selectedItem?.id])

  async function fetchItems() {
    setLoadingItems(true)
    const { data } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quote.id)
      .order('item_number', { ascending: true })
    setItems(data || [])
    setLoadingItems(false)
  }

  async function addItem() {
    setAddingItem(true)
    const nextNum = items.length + 1
    const { data: newItem, error } = await supabase
      .from('quote_items')
      .insert({
        quote_id: quote.id,
        item_number: nextNum,
      })
      .select()
      .single()
    setAddingItem(false)
    if (!error && newItem) {
      setItems(prev => [...prev, newItem])
      setSelectedItem(newItem)
    }
  }

  async function publishQuote() {
    setPublishing(true)
    const { data: updated, error } = await supabase
      .from('quotes')
      .update({ status: 'Published' })
      .eq('id', quote.id)
      .select('*, quote_items(calculated_price), salesperson:salesperson_id(first_name, last_name)')
      .single()
    setPublishing(false)
    if (!error && updated && onQuoteUpdate) {
      onQuoteUpdate(updated)
    }
  }

  async function saveLocation() {
    if (!selectedItem) return
    setSavingLocation(true)
    const { data: updated, error } = await supabase
      .from('quote_items')
      .update({ location: locationDraft })
      .eq('id', selectedItem.id)
      .select()
      .single()
    setSavingLocation(false)
    if (!error && updated) {
      setItems(prev => prev.map(it => it.id === updated.id ? updated : it))
      setSelectedItem(updated)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'stretch',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ flex: 1, background: 'rgba(0,0,0,0.35)', cursor: 'pointer' }}
      />

      {/* Drawer */}
      <div style={{
        width: '90%', display: 'flex', flexDirection: 'column',
        background: '#f7f6f2', borderLeft: '1px solid #e8e6e0',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 20px', height: 56, borderBottom: '1px solid #e8e6e0',
          background: '#fff', flexShrink: 0,
        }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {lead?.lead_number} / {quote.quote_number}
          </div>
          <span style={{
            fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500,
            background: statusStyle.bg, color: statusStyle.color,
          }}>
            {quote.status}
          </span>

          <div style={{ flex: 1 }} />

          {quote.status === 'Open' && (
            <button
              onClick={publishQuote}
              disabled={publishing}
              style={{
                fontSize: 13, padding: '6px 16px', border: 'none', borderRadius: 8,
                background: '#3d35a8', color: '#fff', cursor: publishing ? 'not-allowed' : 'pointer',
                fontWeight: 500, opacity: publishing ? 0.7 : 1,
              }}
            >
              {publishing ? 'Publishing…' : 'Publish Quote'}
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%', border: '1px solid #e8e6e0',
              background: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#555', flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left panel — items list */}
          <div style={{
            width: '35%', borderRight: '1px solid #e8e6e0', background: '#fff',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 16px 10px', fontSize: 12, fontWeight: 600, color: '#555', borderBottom: '1px solid #f0ede8', flexShrink: 0 }}>
              Items
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingItems ? (
                <div style={{ padding: 24, color: '#aaa', fontSize: 13, textAlign: 'center' }}>Loading…</div>
              ) : items.length === 0 ? (
                <div style={{ padding: '32px 16px', color: '#aaa', fontSize: 13, textAlign: 'center' }}>
                  No items yet
                </div>
              ) : (
                items.map(item => {
                  const isSelected = selectedItem?.id === item.id
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      style={{
                        padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f0ede8',
                        background: isSelected ? '#f0eefc' : 'transparent',
                        borderLeft: isSelected ? '3px solid #3d35a8' : '3px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? '#3d35a8' : '#333' }}>
                          Item {item.item_number}
                        </div>
                        {item.calculated_price != null && (
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>
                            £{Number(item.calculated_price).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                      {item.location && (
                        <div style={{ fontSize: 12, color: '#777', marginTop: 3 }}>{item.location}</div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid #e8e6e0', flexShrink: 0 }}>
              <button
                onClick={addItem}
                disabled={addingItem}
                style={{
                  width: '100%', padding: '8px 0', fontSize: 13, border: '1px dashed #c0bdb5',
                  borderRadius: 8, background: 'transparent', cursor: addingItem ? 'not-allowed' : 'pointer',
                  color: '#555', fontWeight: 500, opacity: addingItem ? 0.6 : 1,
                }}
              >
                {addingItem ? 'Adding…' : '+ Add Item'}
              </button>
            </div>
          </div>

          {/* Right panel — drawing board */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selectedItem ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 14 }}>
                Select an item or add a new one
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24, gap: 20, overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Item {selectedItem.item_number}</div>
                </div>

                {/* Location field */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Location</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={locationDraft}
                      onChange={e => setLocationDraft(e.target.value)}
                      onBlur={saveLocation}
                      placeholder="e.g. Front door, Kitchen window…"
                      style={{
                        flex: 1, padding: '8px 10px', fontSize: 13, border: '1px solid #d8d5cf',
                        borderRadius: 8, outline: 'none', background: '#fff',
                      }}
                    />
                    {savingLocation && <span style={{ fontSize: 12, color: '#aaa', alignSelf: 'center' }}>Saving…</span>}
                  </div>
                </div>

                {/* Drawing board placeholder */}
                <div style={{
                  flex: 1, minHeight: 300, border: '2px dashed #d8d5cf', borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#bbb', fontSize: 14, background: '#fafaf8',
                }}>
                  Drawing board coming soon
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
