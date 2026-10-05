/**
 * ItemDetailSheetPdf.jsx — react-pdf Document for the Item Detail Sheet.
 *
 * 1 item per page, no prices, shows overall frame dimensions.
 * For surveyors and the workshop.
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

  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, padding: '0 24' },
  itemTitle: { fontSize: 10, fontWeight: 'bold' },

  itemBody: { flexDirection: 'row', gap: 12, padding: '0 24' },
  itemLeft: { width: '42%' },
  itemRight: { width: '55%' },

  elevationLabel: { fontSize: 7, color: '#888', textAlign: 'center', marginBottom: 2 },
  elevationBox: { border: '0.5 solid #ddd', marginBottom: 6, padding: 4, height: 190 },

  dimsRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 6, padding: '0 24' },
  dimLabel: { fontSize: 7, color: '#888' },
  dimValue: { fontSize: 8, fontWeight: 'bold' },

  specTitle: { fontSize: 8, fontWeight: 'bold', marginTop: 4, marginBottom: 1, color: '#333' },
  specContent: { fontSize: 7.5, color: '#555', lineHeight: 1.5, marginBottom: 2 },

  notesSection: { padding: '6 24', marginTop: 6, borderTop: '0.5 solid #e8e6e0' },
  notesTitle: { fontSize: 8, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  notesContent: { fontSize: 7.5, color: '#555', lineHeight: 1.5 },
})

function Footer() {
  return (
    <View style={s.footer} fixed>
      <View style={s.footerRow}>
        <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        <Text style={s.footerText}>Item Detail Sheet — Internal Use Only</Text>
      </View>
    </View>
  )
}

export default function ItemDetailSheetPdf({ model, logoUrl, elevationImages }) {
  const { items, quoteRef, lead } = model

  return (
    <Document title={`Item Detail Sheet — ${quoteRef}`} author="Wandsworth Sash Windows">
      {items.map((item, idx) => (
        <Page key={idx} size="A4" style={s.page}>
          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={s.headerTitle}>{model.title}</Text>
              <Text style={s.headerSub}>Ref: {quoteRef}</Text>
              {lead?.installation_address_one_line && (
                <Text style={{ fontSize: 7, color: '#555', marginTop: 2 }}>{lead.installation_address_one_line}</Text>
              )}
            </View>
            {logoUrl && <Image src={logoUrl} style={s.headerLogo} />}
          </View>

          {/* Item title */}
          <View style={s.itemHeader}>
            <Text style={s.itemTitle}>ITEM {item.itemNumber}{item.location ? ` - ${item.location}` : ''}</Text>
          </View>

          {/* Overall frame dimensions */}
          {(item.frameWidth || item.frameHeight) && (
            <View style={s.dimsRow}>
              {item.frameWidth && (
                <View style={{ flexDirection: 'row', gap: 4, alignItems: 'baseline' }}>
                  <Text style={s.dimLabel}>Overall Width:</Text>
                  <Text style={s.dimValue}>{item.frameWidth} mm</Text>
                </View>
              )}
              {item.frameHeight && (
                <View style={{ flexDirection: 'row', gap: 4, alignItems: 'baseline' }}>
                  <Text style={s.dimLabel}>Overall Height:</Text>
                  <Text style={s.dimValue}>{item.frameHeight} mm</Text>
                </View>
              )}
            </View>
          )}

          {/* Elevations + spec */}
          <View style={s.itemBody}>
            <View style={s.itemLeft}>
              <Text style={s.elevationLabel}>Internal View</Text>
              <View style={s.elevationBox}>
                {elevationImages?.[idx]?.internal ? (
                  <Image src={elevationImages[idx].internal} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <Text style={{ fontSize: 7, color: '#ccc', textAlign: 'center', marginTop: 65 }}>Elevation not available</Text>
                )}
              </View>
              <Text style={s.elevationLabel}>External View</Text>
              <View style={s.elevationBox}>
                {elevationImages?.[idx]?.external ? (
                  <Image src={elevationImages[idx].external} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <Text style={{ fontSize: 7, color: '#ccc', textAlign: 'center', marginTop: 65 }}>Elevation not available</Text>
                )}
              </View>
            </View>

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

          {/* Notes sections */}
          {(item.installationNotes || item.productionNotes || item.quoteNotes) && (
            <View style={s.notesSection}>
              {item.installationNotes && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={s.notesTitle}>Installation Notes</Text>
                  <Text style={s.notesContent}>{item.installationNotes}</Text>
                </View>
              )}
              {item.productionNotes && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={s.notesTitle}>Notes for Production</Text>
                  <Text style={s.notesContent}>{item.productionNotes}</Text>
                </View>
              )}
              {item.quoteNotes && (
                <View>
                  <Text style={s.notesTitle}>Quote Notes</Text>
                  <Text style={s.notesContent}>{item.quoteNotes}</Text>
                </View>
              )}
            </View>
          )}

          <Footer />
        </Page>
      ))}
    </Document>
  )
}
