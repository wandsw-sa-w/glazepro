/**
 * ScheduleOfWorkPdf.jsx — react-pdf Document for the internal Schedule of Work.
 *
 * 3 items per page, no prices, no letters, no cover, no financial summary.
 * Reuses the compact item layout from QuotePdf.
 */

import React from 'react'
import {
  Document, Page, View, Text, Image, Font, StyleSheet,
} from '@react-pdf/renderer'

const FOOTER_H = 40
const FOOTER_BG = '#f5f4f0'

Font.register({ family: 'Helvetica' })

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: '#1a1a1a', paddingBottom: FOOTER_H + 4 },

  header: { flexDirection: 'row', justifyContent: 'space-between', padding: '10 24 8 24', borderBottom: '0.5 solid #ddd', marginBottom: 6 },
  headerTitle: { fontSize: 12, fontWeight: 'bold' },
  headerSub: { fontSize: 7, color: '#888', marginTop: 2 },
  headerLogo: { width: 60, height: 22, objectFit: 'contain' },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: FOOTER_H, backgroundColor: FOOTER_BG, padding: '4 24', justifyContent: 'center' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: 6, color: '#888' },

  itemBlock: { marginBottom: 4 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3, padding: '0 24' },
  itemTitle: { fontSize: 8, fontWeight: 'bold' },
  itemBody: { flexDirection: 'row', gap: 8, padding: '0 24' },
  itemLeft: { width: '35%' },
  itemRight: { width: '62%' },

  elevationLabel: { fontSize: 6, color: '#888', textAlign: 'center', marginBottom: 1 },
  elevationBox: { border: '0.5 solid #ddd', marginBottom: 3, padding: 2, height: 90 },

  specTitle: { fontSize: 7, fontWeight: 'bold', marginTop: 2, marginBottom: 0.5, color: '#333' },
  specContent: { fontSize: 6.5, color: '#555', lineHeight: 1.4, marginBottom: 1 },

  divider: { borderBottom: '0.5 solid #e8e6e0', marginVertical: 5, marginHorizontal: 24 },
})

function Footer() {
  return (
    <View style={s.footer} fixed>
      <View style={s.footerRow}>
        <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        <Text style={s.footerText}>Schedule of Work — Internal Use Only</Text>
      </View>
    </View>
  )
}

function HeaderBlock({ model, logoUrl }) {
  const { header, quoteRef } = model
  return (
    <View style={s.header}>
      <View>
        <Text style={s.headerTitle}>{model.title}</Text>
        <Text style={s.headerSub}>Ref: {quoteRef}</Text>
        {header.mode === 'customer' ? (
          <View style={{ marginTop: 4 }}>
            {header.contactName && <Text style={{ fontSize: 7 }}>{header.contactName}</Text>}
            {header.address && <Text style={{ fontSize: 7, color: '#555' }}>{header.address}</Text>}
          </View>
        ) : (
          <View style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 7 }}>{header.line1}</Text>
            {header.line2 && <Text style={{ fontSize: 7, color: '#555' }}>{header.line2}</Text>}
          </View>
        )}
      </View>
      {logoUrl && <Image src={logoUrl} style={s.headerLogo} />}
    </View>
  )
}

function ItemBlock({ item, idx, elevationImages }) {
  return (
    <View style={s.itemBlock} wrap={false}>
      <View style={s.itemHeader}>
        <Text style={s.itemTitle}>ITEM {item.itemNumber}{item.location ? ` - ${item.location}` : ''}</Text>
      </View>
      <View style={s.itemBody}>
        <View style={s.itemLeft}>
          <Text style={s.elevationLabel}>Internal View</Text>
          <View style={s.elevationBox}>
            {elevationImages?.[idx]?.internal ? (
              <Image src={elevationImages[idx].internal} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <Text style={{ fontSize: 6, color: '#ccc', textAlign: 'center', marginTop: 30 }}>Elevation not available</Text>
            )}
          </View>
          <Text style={s.elevationLabel}>External View</Text>
          <View style={s.elevationBox}>
            {elevationImages?.[idx]?.external ? (
              <Image src={elevationImages[idx].external} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <Text style={{ fontSize: 6, color: '#ccc', textAlign: 'center', marginTop: 30 }}>Elevation not available</Text>
            )}
          </View>
        </View>
        <View style={s.itemRight}>
          <Text style={{ fontSize: 7.5, fontWeight: 'bold', marginBottom: 3 }}>{item.heading}</Text>
          {item.specSections.map((sec, si) => (
            <View key={si}>
              <Text style={s.specTitle}>{sec.title}</Text>
              <Text style={s.specContent}>{sec.content}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

export default function ScheduleOfWorkPdf({ model, logoUrl, elevationImages }) {
  const { items, itemPages } = model

  return (
    <Document title={`Schedule of Work — ${model.quoteRef}`} author="Wandsworth Sash Windows">
      {(itemPages || []).map((pageItems, pageIdx) => (
        <Page key={pageIdx} size="A4" style={s.page}>
          <HeaderBlock model={model} logoUrl={logoUrl} />
          {pageItems.map((item, itemIdx) => {
            const flatIdx = items.indexOf(item)
            return (
              <View key={itemIdx}>
                {itemIdx > 0 && <View style={s.divider} />}
                <ItemBlock item={item} idx={flatIdx} elevationImages={elevationImages} />
              </View>
            )
          })}
          <Footer />
        </Page>
      ))}
    </Document>
  )
}
