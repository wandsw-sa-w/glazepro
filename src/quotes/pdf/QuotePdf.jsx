/**
 * QuotePdf.jsx — react-pdf Document for the customer quotation.
 *
 * Consumes the plain model from buildDocModel(). Loaded with a dynamic
 * import() so @react-pdf/renderer stays out of the main bundle.
 */

import React from 'react'
import {
  Document, Page, View, Text, Image, Font, StyleSheet, Link,
} from '@react-pdf/renderer'

// ── Styles ──────────────────────────────────────────────────────────────────

const FOOTER_BG = '#faebce'
const FOOTER_H  = 27
const PAGE_W    = 595.28 // A4 pt
const PAGE_H    = 841.89

Font.register({ family: 'Helvetica' })

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: '#1a1a1a', paddingBottom: FOOTER_H + 10 },
  pageBleed: { fontFamily: 'Helvetica', fontSize: 9, color: '#1a1a1a' },

  // Header
  headerFull: { flexDirection: 'row', justifyContent: 'space-between', padding: '12 24', borderBottom: '1 solid #e8e6e0', marginBottom: 10 },
  headerCompact: { flexDirection: 'row', justifyContent: 'space-between', padding: '8 24', borderBottom: '0.5 solid #ddd', marginBottom: 6 },
  headerTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  headerLogo: { width: 80, height: 30 },
  headerSmall: { fontSize: 7, color: '#888' },

  // Footer
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: FOOTER_H, backgroundColor: FOOTER_BG, padding: '4 24', justifyContent: 'center' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerCenter: { textAlign: 'center', flex: 1 },
  footerBold: { fontWeight: 'bold', fontSize: 7 },
  footerLine: { fontSize: 6, color: '#555' },
  footerSide: { fontSize: 6, color: '#555', width: 50 },

  // Body
  body: { padding: '0 24' },

  // Front cover letter
  letterHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: '20 24 10 24' },
  letterAddress: { fontSize: 8, lineHeight: 1.5 },
  letterLogo: { width: 100, height: 38, objectFit: 'contain' },
  letterRefBold: { fontSize: 11, fontWeight: 'bold', marginTop: 10, marginBottom: 8 },
  letterBody: { fontSize: 8, lineHeight: 1.7, padding: '0 24' },
  letterParagraph: { marginBottom: 6 },

  // Summary
  summaryGrid: { marginBottom: 10, padding: '0 24' },
  summaryHeaderRow: { flexDirection: 'row', borderBottom: '1 solid #1a1a1a', paddingBottom: 3, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', paddingVertical: 2, borderBottom: '0.5 solid #eee' },
  summaryCell: { fontSize: 8 },
  summaryTotals: { width: 170, marginLeft: 'auto', marginTop: 10, padding: '0 24' },
  summaryTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5 },
  summaryLeftBox: { border: '0.5 solid #ccc', padding: 8, fontSize: 7, marginTop: 10, marginHorizontal: 24 },
  summaryLeftBold: { fontWeight: 'bold', fontSize: 7 },

  // Item page
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, padding: '0 24' },
  itemTitle: { fontSize: 10, fontWeight: 'bold' },
  itemPrice: { fontSize: 8, textAlign: 'right' },
  itemBody: { flexDirection: 'row', gap: 12, padding: '0 24' },
  itemLeft: { width: '42%' },
  itemRight: { width: '55%' },
  elevationLabel: { fontSize: 7, color: '#888', textAlign: 'center', marginBottom: 2 },
  elevationBox: { border: '0.5 solid #ddd', marginBottom: 6, padding: 4, height: 210 },
  specTitle: { fontSize: 8, fontWeight: 'bold', marginTop: 4, marginBottom: 1, color: '#333' },
  specContent: { fontSize: 7.5, color: '#555', lineHeight: 1.5, marginBottom: 2 },

  // Ironmongery tiles
  tilesRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', padding: '6 24', marginTop: 6 },
  tile: { width: 90, alignItems: 'center' },
  tileName: { fontSize: 6, textAlign: 'center', marginBottom: 2 },
  tileImg: { width: 80, height: 60, objectFit: 'contain' },

  // Watermark
  watermark: { position: 'absolute', top: '40%', left: '15%', fontSize: 72, color: '#eee', transform: 'rotate(-45deg)', opacity: 0.3, fontWeight: 'bold' },

  // Back letter
  backSection: { marginBottom: 8 },
  backHeading: { fontSize: 9, fontWeight: 'bold', marginBottom: 2 },
  backBody: { fontSize: 8, lineHeight: 1.7, color: '#333' },

  // Hinge note
  hingeNote: { fontSize: 6.5, color: '#888', fontStyle: 'italic', marginBottom: 4, padding: '0 24' },
})

// ── Footer component ────────────────────────────────────────────────────────

function Footer({ isLastPage }) {
  return (
    <View style={s.footer} fixed>
      <View style={s.footerRow}>
        <Text style={s.footerSide} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        <View style={s.footerCenter}>
          <Text style={s.footerBold}>Wandsworth Sash Windows &amp; Parsons Joinery</Text>
          <Text style={s.footerLine}>461 Fulham Road, London, SW6 1HL</Text>
          <Text style={s.footerLine}>Tel: 0207 924 7303, Email: info@sashwindows.london, Web: sashwindows.london</Text>
          {!isLastPage && <Text style={s.footerBold}>- Please Continue -</Text>}
        </View>
        <Text style={{ ...s.footerSide, textAlign: 'right' }}>E&amp;OE</Text>
      </View>
    </View>
  )
}

// ── Main document ───────────────────────────────────────────────────────────

export default function QuotePdf({ model, watermark, logoUrl, coverUrl, elevationImages }) {
  const { quoteRef, frontLetter, backLetterSections, summary, items, lead, salesperson } = model

  return (
    <Document title={`Quotation ${quoteRef}`} author="Wandsworth Sash Windows">

      {/* ── 1. Front cover ── */}
      {coverUrl && (
        <Page size="A4" style={s.pageBleed}>
          <Image src={coverUrl} style={{ width: PAGE_W, height: PAGE_H }} />
        </Page>
      )}

      {/* ── 2. Front cover letter ── */}
      <Page size="A4" style={s.page}>
        <View style={s.letterHeader}>
          <View style={s.letterAddress}>
            {lead.contact_name && <Text>{lead.contact_name}</Text>}
            {(lead.postal_address_lines || []).map((line, i) => <Text key={i}>{line}</Text>)}
          </View>
          {logoUrl && <Image src={logoUrl} style={s.letterLogo} />}
        </View>
        <View style={s.body}>
          <Text style={s.letterRefBold}>Quotation Ref.:  {quoteRef}</Text>
        </View>
        <View style={s.letterBody}>
          {frontLetter.split('\n\n').map((para, i) => (
            <Text key={i} style={s.letterParagraph}>{para}</Text>
          ))}
        </View>
        {watermark && <Text style={s.watermark}>{watermark}</Text>}
        <Footer />
      </Page>

      {/* ── 3. Financial summary ── */}
      <Page size="A4" style={s.page}>
        {/* Header block with labelled rows */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: '14 24 10 24', borderBottom: '1 solid #e8e6e0' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 6 }}>Quotation</Text>
            <View style={{ fontSize: 7, lineHeight: 1.6 }}>
              {lead.contact_name && <Text><Text style={{ color: '#888' }}>Customer name: </Text>{lead.contact_name}</Text>}
              {lead.installation_address_one_line && <Text><Text style={{ color: '#888' }}>Installation address: </Text>{lead.installation_address_one_line}</Text>}
              {lead.contact_name && <Text><Text style={{ color: '#888' }}>Contact: </Text>{lead.contact_name}</Text>}
              {lead.postal_address_lines?.length > 0 && <Text><Text style={{ color: '#888' }}>Postal address: </Text>{lead.postal_address_lines.join(', ')}</Text>}
              {lead.phone && <Text><Text style={{ color: '#888' }}>Phone*: </Text>{lead.phone}</Text>}
              {lead.email && <Text><Text style={{ color: '#888' }}>Email*: </Text>{lead.email}</Text>}
              {(lead.phone || lead.email) && <Text style={{ fontSize: 6, color: '#999', marginTop: 2 }}>*: Customer</Text>}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', width: 160 }}>
            {logoUrl && <Image src={logoUrl} style={s.headerLogo} />}
            <View style={{ fontSize: 7, lineHeight: 1.6, marginTop: 6, textAlign: 'right' }}>
              {salesperson.full_name && <Text><Text style={{ color: '#888' }}>Sales manager: </Text>{salesperson.full_name}</Text>}
              {salesperson.phone && <Text><Text style={{ color: '#888' }}>Phone: </Text>{salesperson.phone}</Text>}
              {salesperson.email && <Text><Text style={{ color: '#888' }}>Email: </Text>{salesperson.email}</Text>}
            </View>
          </View>
        </View>

        {/* Item grid with borders */}
        <View style={{ margin: '10 24', border: '0.5 solid #ccc' }}>
          <View style={{ flexDirection: 'row', backgroundColor: '#f5f4f0', borderBottom: '0.5 solid #ccc', padding: '4 6' }}>
            <Text style={{ fontSize: 7, fontWeight: 'bold', width: 25 }}>Item</Text>
            <Text style={{ fontSize: 7, fontWeight: 'bold', width: 156 }}>Location</Text>
            <Text style={{ fontSize: 7, fontWeight: 'bold', flex: 1 }}>Description of Work</Text>
            <Text style={{ fontSize: 7, fontWeight: 'bold', width: 62, textAlign: 'right' }}>Net Price excl. VAT</Text>
          </View>
          {summary.rows.map((row, i) => (
            <View key={i} style={{ flexDirection: 'row', borderBottom: '0.5 solid #eee', padding: '3 6' }}>
              <Text style={{ fontSize: 7, width: 25 }}>{row.itemNumber}</Text>
              <Text style={{ fontSize: 7, width: 156 }}>{row.location}</Text>
              <Text style={{ fontSize: 7, flex: 1 }}>{row.descriptionOfWork}</Text>
              <Text style={{ fontSize: 7, width: 62, textAlign: 'right' }}>{row.netPrice}</Text>
            </View>
          ))}
        </View>

        {/* Bottom: left box + right totals, side by side */}
        <View style={{ flexDirection: 'row', margin: '6 24', gap: 12 }}>
          {/* Left: reference/banking box */}
          <View style={{ flex: 1, border: '0.5 solid #ccc', padding: 8, fontSize: 7, lineHeight: 1.5 }}>
            <Text>Quotation Ref.: {summary.leftBox.quoteRef}</Text>
            {summary.leftBox.bankDetails && <Text>Banking Details: {summary.leftBox.bankDetails}</Text>}
            <Text>{summary.leftBox.vatNote}</Text>
            <Text style={{ fontWeight: 'bold', marginTop: 3 }}>{summary.leftBox.validLine}</Text>
            <Text style={{ fontSize: 6, color: '#999', marginTop: 2 }}>{summary.leftBox.generatedLine}</Text>
          </View>
          {/* Right: totals box */}
          <View style={{ width: 200, border: '0.5 solid #ccc', padding: 8 }}>
            {summary.totalsLines.map((line, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5 }}>
                <Text style={{ fontSize: 7, fontWeight: line.bold ? 'bold' : 'normal', flex: 1 }}>{line.label}</Text>
                <Text style={{ fontSize: 7, fontWeight: line.bold ? 'bold' : 'normal', width: 60, textAlign: 'right' }}>{line.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {watermark && <Text style={s.watermark}>{watermark}</Text>}
        <Footer />
      </Page>

      {/* ── 4. Item pages ── */}
      {items.map((item, idx) => (
        <Page key={idx} size="A4" style={s.page}>
          <View style={s.headerCompact}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'baseline' }}>
              <Text style={{ fontSize: 7, color: '#888' }}>{quoteRef}</Text>
              <Text style={{ fontSize: 10, fontWeight: 'bold' }}>Quotation</Text>
            </View>
            {logoUrl && <Image src={logoUrl} style={{ width: 60, height: 22 }} />}
          </View>

          <Text style={s.hingeNote}>The opening sash symbol (or arrow head) points to the hinge position</Text>

          <View style={s.itemHeader}>
            <Text style={s.itemTitle}>ITEM {item.itemNumber}{item.location ? ` - ${item.location}` : ''}</Text>
            <Text style={s.itemPrice}>{item.priceLabel}</Text>
          </View>

          <View style={s.itemBody}>
            {/* Left column: elevations */}
            <View style={s.itemLeft}>
              <Text style={s.elevationLabel}>Internal View</Text>
              <View style={s.elevationBox}>
                {elevationImages?.[idx]?.internal ? (
                  <Image src={elevationImages[idx].internal} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <Text style={{ fontSize: 7, color: '#ccc', textAlign: 'center', marginTop: 70 }}>Elevation not available</Text>
                )}
              </View>
              <Text style={s.elevationLabel}>External View</Text>
              <View style={s.elevationBox}>
                {elevationImages?.[idx]?.external ? (
                  <Image src={elevationImages[idx].external} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <Text style={{ fontSize: 7, color: '#ccc', textAlign: 'center', marginTop: 70 }}>Elevation not available</Text>
                )}
              </View>
            </View>

            {/* Right column: heading + spec sections */}
            <View style={s.itemRight}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 6 }}>{item.heading}</Text>
              {item.specSections.map((sec, si) => (
                <View key={si} wrap={false}>
                  <Text style={s.specTitle}>{sec.title}</Text>
                  <Text style={s.specContent}>{sec.content}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Ironmongery tiles */}
          {item.ironmongeryTiles.length > 0 && (
            <View style={s.tilesRow}>
              {item.ironmongeryTiles.map((tile, ti) => (
                <View key={ti} style={s.tile}>
                  <Text style={s.tileName}>{tile.name}</Text>
                  {tile.photo_url && <Image src={tile.photo_url} style={s.tileImg} />}
                </View>
              ))}
            </View>
          )}

          {watermark && <Text style={s.watermark}>{watermark}</Text>}
          <Footer />
        </Page>
      ))}

      {/* ── 5. Back cover letter ── */}
      <Page size="A4" style={s.page}>
        <View style={s.body}>
          {backLetterSections.map((sec, i) => (
            <View key={i} style={s.backSection}>
              <Text style={s.backHeading}>{sec.heading}</Text>
              <Text style={s.backBody}>{sec.body}</Text>
            </View>
          ))}
        </View>
        {watermark && <Text style={s.watermark}>{watermark}</Text>}
        <Footer isLastPage />
      </Page>

    </Document>
  )
}
