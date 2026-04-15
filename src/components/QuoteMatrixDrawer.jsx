export default function QuoteMatrixDrawer({ quote, lead, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'stretch' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.35)', cursor: 'pointer' }} />

      <div style={{ width: '90%', display: 'flex', flexDirection: 'column', background: '#f7f6f2', borderLeft: '1px solid #e8e6e0', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 56, borderBottom: '1px solid #e8e6e0', background: '#fff', flexShrink: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {lead?.lead_number} / {quote?.quote_number}
          </div>
          {quote?.status && (
            <span style={{
              fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500,
              background: quote.status === 'Open' ? '#f5f4f0' : quote.status === 'Published' ? '#e6f0fb' : '#e1f5ee',
              color: quote.status === 'Open' ? '#666' : quote.status === 'Published' ? '#1a5fa8' : '#0a5a3c',
            }}>
              {quote.status}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #e8e6e0', background: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 14 }}>
          Quote matrix coming soon
        </div>
      </div>
    </div>
  )
}
