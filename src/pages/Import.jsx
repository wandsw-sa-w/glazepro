import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useUnmatchedCount } from '../hooks/useUnmatchedCount'

// ── Categorisation ────────────────────────────────────────────────────────────

function getCategory(name) {
  const n = name.toLowerCase()
  if (n.includes('trickle') || n.includes('vent grille') || n.includes('xr16') || n.includes('xhd')) return 'Trickle Vent'
  if (n.includes('cylinder') || n.includes('euro cylinder')) return 'Cylinder'
  if (n.includes('deadlock') || n.includes('deadbolt') || n.includes('nightlatch') || n.includes('rim lock') || n.includes('trulock') || n.includes('shootbolt') || n.includes('flushbolt') || n.includes('multipoint lock') || n.includes('thunderbolt')) return 'Door Lock'
  if (n.includes('threshold')) return 'Threshold'
  if (n.includes('letterplate') || n.includes('letter plate') || n.includes('letter tidy')) return 'Letterplate'
  if (n.includes('knocker')) return 'Door Knocker'
  if (n.includes('numeral')) return 'Numerals'
  if (n.includes('sash lift')) return 'Sash Lift'
  if (n.includes('pulley')) return 'Sash Pulley'
  if (n.includes('secure stop') || n.includes('restrictor') || n.includes('sash stop')) return 'Sash Restrictor'
  if (n.includes('fastener') || n.includes('claw') || n.includes('fitch')) return 'Sash Fastener'
  if (n.includes('door hinge') || (n.includes('hinge') && n.includes('door'))) return 'Door Hinge'
  if (n.includes('friction hinge') || (n.includes('hinge') && !n.includes('door'))) return 'Casement Hinge'
  if (n.includes('stay')) return 'Casement Stay'
  if (n.includes('lever') || n.includes('multipoint')) return 'Door Handle'
  if ((n.includes('handle') || n.includes('knob')) && (n.includes('door') || n.includes('lever'))) return 'Door Handle'
  if (n.includes('handle') || n.includes('knob')) return 'Casement Handle'
  return 'Other'
}

// ── Finish detection ──────────────────────────────────────────────────────────

function getFinish(name) {
  const n = name.toLowerCase()
  if (n.includes('antique black') || n.includes('antique blk')) return { name: 'Antique Black', code: 'ABlk' }
  if (n.includes('antique brass')) return { name: 'Antique Brass', code: 'ABs' }
  if (n.includes('antique bronze')) return { name: 'Antique Bronze', code: 'ABz' }
  if (n.includes('aged brass')) return { name: 'Aged Brass', code: 'AgBs' }
  if (n.includes('polished nickel')) return { name: 'Polished Nickel', code: 'PN' }
  if (n.includes('polished brass') || n.endsWith(' pb') || n.includes('- pb')) return { name: 'Polished Brass', code: 'PB' }
  if (n.includes('satin chrome') || n.endsWith(' sc') || n.includes('- sc')) return { name: 'Satin Chrome', code: 'SC' }
  if (n.includes('polished chrome') || n.includes('pol chrome') || n.endsWith(' pc') || n.includes('- pc')) return { name: 'Polished Chrome', code: 'PC' }
  if (n.includes('black')) return { name: 'Black', code: 'Blk' }
  if (n.includes('pewter')) return { name: 'Pewter', code: 'Pwt' }
  if (n.includes('white')) return { name: 'White', code: 'Wht' }
  if (n.includes('satin stainless') || n.includes('stainless') || n.includes('pss')) return { name: 'Satin Stainless', code: 'SS' }
  if (n.includes('brass')) return { name: 'Polished Brass', code: 'PB' }
  if (n.includes('chrome')) return { name: 'Polished Chrome', code: 'PC' }
  if (n.includes('silver') || n.includes('metalic') || n.includes('brushed')) return { name: 'Satin Chrome', code: 'SC' }
  if (n.includes('titanium')) return { name: 'Satin Chrome', code: 'SC' }
  if (n.includes('bronze')) return { name: 'Antique Bronze', code: 'ABz' }
  return { name: 'Polished Brass', code: 'PB' }
}

// ── Base name stripping ───────────────────────────────────────────────────────

function getBaseName(name) {
  let base = name
  const toStrip = [
    ' Polished Brass', ' Polished Chrome', ' Satin Chrome', ' Antique Black',
    ' Antique Brass', ' Antique Bronze', ' Aged Brass', ' Polished Nickel',
    ' Black', ' Pewter', ' White', ' Satin Stainless', ' Stainless Steel',
    ' - Black', ' - Polished Brass', ' - Polished Chrome', ' - Satin Chrome',
    ' - PC', ' - PB', ' - SC', ' - BL', ' - BC', ' - HG',
    ' RH', ' LH', ' Left Hand', ' Right Hand',
    ' Brushed Metalic', ' Titanium', ' Silver', ' Bronze',
  ]
  toStrip.forEach(s => {
    base = base.replace(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
  })
  return base.replace(/\s+/g, ' ').trim()
}

// ── Import data ───────────────────────────────────────────────────────────────

const IMPORT_DATA = [
  { part_no: "ANV20460", name: "Anvil Teardrop Black", cost: 15.65 },
  { part_no: "ANV20461", name: "Anvil Teardrop Polished Brass", cost: 15.65 },
  { part_no: "ANV20462", name: "Anvil Teardrop Polished Chrome", cost: 15.65 },
  { part_no: "ANV20463", name: "Anvil Teardrop Satin Chrome", cost: 15.65 },
  { part_no: "ANV33033", name: "Anvil Avon Multipoint Lever Antique Black", cost: 62.34 },
  { part_no: "ANV33034", name: "Anvil Avon Multipoint Lever Pewter", cost: 72.27 },
  { part_no: "ANV33035", name: "Anvil Cottage Lever Black", cost: 59.94 },
  { part_no: "ANV33036", name: "Anvil Cottage Lever Pewter", cost: 66.64 },
  { part_no: "ANV33039", name: "Anvil Reeded Handle Aged Brass", cost: 125.01 },
  { part_no: "ANV33050", name: "Anvil Period Letterplate Polished Brass", cost: 42.54 },
  { part_no: "ANV33051", name: "Anvil Period Letter Tidy Polished Brass", cost: 31.97 },
  { part_no: "ANV33052", name: "Anvil Period Letterplate Polished Chrome", cost: 53.14 },
  { part_no: "ANV33053", name: "Anvil Period Letter Tidy Polished Chrome", cost: 40.43 },
  { part_no: "ANV33119", name: "Anvil Narrow Handle Antique Black", cost: 30.83 },
  { part_no: "ANV33172", name: "Anvil Tudor Lever Black", cost: 59.07 },
  { part_no: "ANV33226", name: "Anvil Blacksmith Letterplate Black", cost: 34.35 },
  { part_no: "ANV33242", name: "Monkeytail Espag Handle RH - Black", cost: 16.14 },
  { part_no: "ANV33243", name: "Monkeytail Espag Handle LH - Black", cost: 16.14 },
  { part_no: "ANV33245", name: "Round Door Knocker Black", cost: 48.54 },
  { part_no: "ANV33246", name: "Pear Door Knocker Black", cost: 41.1 },
  { part_no: "ANV33282", name: "Anvil Monkey Tail Black 10in", cost: 11.23 },
  { part_no: "ANV33292", name: "Anvil Peardrop Stay Black 10in", cost: 11.17 },
  { part_no: "ANV33305", name: "Anvil Reeded Handle Polished Chrome", cost: 143.74 },
  { part_no: "ANV33328", name: "Anvil Peardrop Handle Satin Chrome LH", cost: 25.83 },
  { part_no: "ANV33329", name: "Anvil Peardrop Handle Satin Chrome RH", cost: 25.83 },
  { part_no: "ANV33331", name: "Anvil Peardrop Handle Black LH", cost: 21.38 },
  { part_no: "ANV33332", name: "Anvil Peardrop Handle Black RH", cost: 21.38 },
  { part_no: "ANV33333", name: "Anvil Peardrop Handle Pewter LH", cost: 23.83 },
  { part_no: "ANV33334", name: "Anvil Peardrop Handle Pewter RH", cost: 23.83 },
  { part_no: "ANV33335", name: "Anvil Peardrop Handle Polished Brass LH", cost: 22.45 },
  { part_no: "ANV33336", name: "Anvil Peardrop Handle Polished Brass RH", cost: 22.45 },
  { part_no: "ANV33337", name: "Anvil Peardrop Handle Polished Chrome RH", cost: 23.72 },
  { part_no: "ANV33338", name: "Anvil Peardrop Handle Polished Chrome LH", cost: 23.72 },
  { part_no: "ANV33602", name: "Shepherds Crook Handle Pewter RH", cost: 21.97 },
  { part_no: "ANV33603", name: "Shepherds Crook Handle Pewter LH", cost: 21.97 },
  { part_no: "ANV33606", name: "Anvil Shepherds Crook Pewter 10in", cost: 18.16 },
  { part_no: "ANV33611", name: "Pear Door Knocker Pewter", cost: 50.17 },
  { part_no: "ANV33633", name: "Anvil Narrow Handle Pewter", cost: 43.83 },
  { part_no: "ANV33658", name: "Round Door Knocker Pewter", cost: 58.81 },
  { part_no: "ANV33678", name: "Anvil Peardrop Stay Pewter 10in", cost: 17.09 },
  { part_no: "ANV33680", name: "Anvil Blacksmith Letterplate Pewter", cost: 72.28 },
  { part_no: "ANV33766", name: "Anvil Tudor Lever Pewter", cost: 63.07 },
  { part_no: "ANV33957", name: "Sheperds Crook Handle Black RH", cost: 19.75 },
  { part_no: "ANV33958", name: "Sheperds Crook Handle Black LH", cost: 19.75 },
  { part_no: "ANV33961", name: "Anvil Shepherds Crook Black 10in", cost: 13.78 },
  { part_no: "ANV45527", name: "Anvil Brompton Handle Black", cost: 78.16 },
  { part_no: "ANV45529", name: "Anvil Brompton Handle Pewter", cost: 86.39 },
  { part_no: "ANV45935", name: "Beehive Claw Fastener Polished Brass", cost: 14.55 },
  { part_no: "ANV45938", name: "Beehive Claw Fastener Polished Chrome", cost: 14.14 },
  { part_no: "ANV45940", name: "Beehive Claw Fastener Satin Chrome", cost: 14.51 },
  { part_no: "ANV46527", name: "Anvil Newbury Handle Polished Brass RH", cost: 38.87 },
  { part_no: "ANV46528", name: "Anvil Newbury Handle Polished Brass LH", cost: 38.87 },
  { part_no: "ANV46529", name: "Anvil Newbury Handle Polished Brass", cost: 125.01 },
  { part_no: "ANV46545", name: "Anvil Reeded Handle Polished Brass", cost: 125 },
  { part_no: "ANV46707", name: "Anvil Reeded Stay Polished Brass 10in", cost: 26.67 },
  { part_no: "ANV46709", name: "Anvil Reeded Handle Polished Brass RH", cost: 38.87 },
  { part_no: "ANV46710", name: "Anvil Reeded Handle Polished Brass LH", cost: 38.87 },
  { part_no: "ANV46711", name: "Avon Handle Polished Brass", cost: 46.64 },
  { part_no: "ANV46716", name: "Anvil Newbury Stay Polished Brass 10in", cost: 26.67 },
  { part_no: "ANV49591", name: "Anvil Secure Stops Satin Chrome", cost: 37.18 },
  { part_no: "ANV51417L", name: "Monkeytail Face Fix Casement Handle LH - Black", cost: 15.11 },
  { part_no: "ANV51417R", name: "Monkeytail Face Fix Casement Handle RH - Black", cost: 15.11 },
  { part_no: "ANV83637", name: "Anvil Sash Pulley - Black", cost: 15.15 },
  { part_no: "ANV83638", name: "Anvil Sash Lift Black", cost: 4.91 },
  { part_no: "ANV83639", name: "Ball Claw Fastener Black", cost: 15.45 },
  { part_no: "ANV83640", name: "Anvil Secure Stops Black", cost: 30.73 },
  { part_no: "ANV83641", name: "Anvil Sash Pulley - Pewter", cost: 18.26 },
  { part_no: "ANV83642", name: "Anvil Sash Lift Pewter", cost: 5.29 },
  { part_no: "ANV83643", name: "Ball Claw Fastener Pewter", cost: 17.73 },
  { part_no: "ANV83644", name: "Anvil Secure Stops Pewter", cost: 41.64 },
  { part_no: "ANV83890", name: "Anvil Sash Lift Polished Brass", cost: 4.38 },
  { part_no: "ANV83893", name: "Anvil Sash Lift Polished Chrome", cost: 4.88 },
  { part_no: "ANV83901", name: "Anvil Reeded Stay Aged Brass 10in", cost: 26.67 },
  { part_no: "ANV83911", name: "Anvil Aged Brass Night-Vent Locking Reeded Fastener", cost: 38.36 },
  { part_no: "ANV83913", name: "Anvil Reeded Handle Aged Brass LH", cost: 38.87 },
  { part_no: "ANV83915", name: "Anvil Reeded Handle Aged Brass RH", cost: 38.87 },
  { part_no: "ANV83941", name: "Anvil Secure Stops Polished Brass", cost: 33.79 },
  { part_no: "ANV83942", name: "Anvil Secure Stops Polished Chrome", cost: 33.79 },
  { part_no: "ANV90033", name: "Art Deco Knocker Polished Chrome", cost: 85.55 },
  { part_no: "ANV90034", name: "Art Deco Knocker Black", cost: 61.63 },
  { part_no: "ANV90035", name: "Art Deco Knocker Pewter", cost: 67.64 },
  { part_no: "ANV90330", name: "Anvil Polished Chrome Night-Vent Locking Reeded Fastener", cost: 44.97 },
  { part_no: "ANV90331", name: "Anvil Reeded Handle Polished Chrome RH", cost: 45.11 },
  { part_no: "ANV90332", name: "Anvil Reeded Handle Polished Chrome LH", cost: 45.11 },
  { part_no: "ANV90334", name: "Anvil Reeded Stay Polished Chrome 10in", cost: 32.62 },
  { part_no: "ANV90390", name: "Anvil Black Night-Vent Locking Avon Fastener", cost: 24.53 },
  { part_no: "ANV90391", name: "Anvil Pewter Night-Vent Locking Avon Fastener", cost: 26.87 },
  { part_no: "ANV90393", name: "Avon Handle Black", cost: 24.47 },
  { part_no: "ANV90394", name: "Avon Handle Pewter", cost: 26.81 },
  { part_no: "ANV90405", name: "Anvil Black 12 Avon Stay", cost: 23.3 },
  { part_no: "ANV90406", name: "Anvil Pewter 12 Avon Stay", cost: 23.97 },
  { part_no: "ANV90415", name: "Avon Handle Aged Brass", cost: 46.64 },
  { part_no: "ANV90416", name: "Avon Handle Polished Chrome", cost: 51.13 },
  { part_no: "ANV91413", name: "Anvil Newbury Handle Aged Brass", cost: 125.01 },
  { part_no: "ANV91420", name: "Anvil Newbury Handle Polished Chrome", cost: 143.74 },
  { part_no: "ANV91442", name: "Anvil Aged Brass Night-Vent Locking Newbury Fastener", cost: 38.36 },
  { part_no: "ANV91443", name: "Anvil Newbury Handle Aged Brass RH", cost: 38.87 },
  { part_no: "ANV91444", name: "Anvil Newbury Handle Aged Brass LH", cost: 38.87 },
  { part_no: "ANV91446", name: "Anvil Newbury Stay Aged Brass 10in", cost: 26.67 },
  { part_no: "ANV91449", name: "Anvil Polished Chrome Night-Vent Locking Newbury Fastener", cost: 44.97 },
  { part_no: "ANV91450", name: "Anvil Newbury Handle Polished Chrome RH", cost: 45.11 },
  { part_no: "ANV91451", name: "Anvil Newbury Handle Polished Chrome LH", cost: 45.11 },
  { part_no: "ANV91453", name: "Anvil Newbury Stay Polished Chrome 10in", cost: 32.62 },
  { part_no: "ANV91881", name: "Anvil Period Letterplate Aged Brass", cost: 61.18 },
  { part_no: "ANV91883", name: "Anvil Period Letter Tidy Aged Brass", cost: 52.81 },
  { part_no: "BDL299", name: "Sash Ring Polished Brass", cost: 1.73 },
  { part_no: "BGG1028", name: "Sash Ring Antique Brass", cost: 1.75 },
  { part_no: "BGG1044", name: "Reeded Escutcheon Antique Brass", cost: 6.12 },
  { part_no: "BGG1045", name: "Covered Escutcheon Antique Brass", cost: 4.39 },
  { part_no: "BGG141", name: "Bulb End Stay Polished Brass 10in", cost: 14.29 },
  { part_no: "BGG151", name: "Victorian Knocker Polished Brass", cost: 14 },
  { part_no: "BGG162", name: "Covered Escutcheon Polished Brass", cost: 3.04 },
  { part_no: "BGG189", name: "Large Victorian Letterplate Polished Brass", cost: 30.22 },
  { part_no: "BGG191", name: "Small Victorian Letterplate Polished Brass", cost: 15.05 },
  { part_no: "BGG197", name: "Numerals 1 Polished Brass", cost: 3.46 },
  { part_no: "BGG198", name: "Numerals 2 Polished Brass", cost: 3.46 },
  { part_no: "BGG199", name: "Numerals 3 Polished Brass", cost: 3.46 },
  { part_no: "BGG200", name: "Numerals 4 Polished Brass", cost: 3.46 },
  { part_no: "BGG201", name: "Numerals 5 Polished Brass", cost: 3.46 },
  { part_no: "BGG202", name: "Numerals 6 Polished Brass", cost: 3.46 },
  { part_no: "BGG203", name: "Numerals 7 Polished Brass", cost: 3.46 },
  { part_no: "BGG204", name: "Numerals 8 Polished Brass", cost: 3.46 },
  { part_no: "BGG205", name: "Numerals 9 Polished Brass", cost: 3.46 },
  { part_no: "BGG209", name: "Doctor Knocker Polished Brass", cost: 43.46 },
  { part_no: "BGG281", name: "Victorian Scroll Door Lever Handle - Polished Brass", cost: 24.27 },
  { part_no: "BGG318", name: "Stella Handle Polished Brass", cost: 58.67 },
  { part_no: "BGG327", name: "Pole Hook Polished Brass", cost: 6 },
  { part_no: "BGG328", name: "Pole Hook Antique Brass", cost: 7 },
  { part_no: "BGG340", name: "Rosa Handle Polished Brass", cost: 34.77 },
  { part_no: "BGG344", name: "Kensington Handle Polished Brass", cost: 42.8 },
  { part_no: "BGG357", name: "Stella Handle Antique Brass", cost: 63.51 },
  { part_no: "BGG365", name: "Bulb End Stay Antique Brass 10in", cost: 13.45 },
  { part_no: "BGG498", name: "Burnham Handle Polished Brass", cost: 26.99 },
  { part_no: "BGG555", name: "Cranked Handle Polished Brass LH", cost: 12.5 },
  { part_no: "BGG556", name: "Cranked Handle Polished Brass RH", cost: 12.5 },
  { part_no: "BGG558", name: "Cranked Handle Antique Brass LH", cost: 13.59 },
  { part_no: "BGG559", name: "Cranked Handle Antique Brass RH", cost: 13.59 },
  { part_no: "BGG563", name: "Windsor Inline Polished Brass", cost: 16 },
  { part_no: "BGG596", name: "Windsor Swan Polished Brass LH", cost: 28.45 },
  { part_no: "BGG597", name: "Windsor Swan Polished Brass RH", cost: 28.45 },
  { part_no: "BGG618", name: "Reeded Escutcheon Polished Brass", cost: 6.12 },
  { part_no: "BGG627", name: "Round Centre Door Knob Polished Brass", cost: 43.6 },
  { part_no: "BGG700", name: "Doctor Knocker Antique Brass", cost: 48.85 },
  { part_no: "BGG702", name: "Victorian Knocker Antique Brass", cost: 11.38 },
  { part_no: "CARML050121", name: "ProSecure Handle 2* Security Polished Chrome", cost: 36.75 },
  { part_no: "CARML050122", name: "ProSecure Handle 2* Security Satin Chrome", cost: 45.13 },
  { part_no: "CARML050124", name: "ProSecure Handle 2* Security Polished Brass", cost: 39.27 },
  { part_no: "CARML050127", name: "ProSecure Handle 2* Security Black", cost: 30.12 },
  { part_no: "CAT01", name: "PetSafe Staywell 4 Way Locking Classic Cat Flap", cost: 25 },
  { part_no: "CAT02", name: "SureFlap DualScan Microchip Cat Flap", cost: 100 },
  { part_no: "CDL568", name: "Sash Ring Polished Chrome", cost: 1.43 },
  { part_no: "CENDBCS", name: "Centor Dropbolt Cup Satin Stainless", cost: 6.4 },
  { part_no: "CENDBCTG", name: "Centor Dropbolt Cup Brass", cost: 5.77 },
  { part_no: "CENDBFO200KRTG", name: "Centor 200mm Dropbolt Keyed Brass", cost: 45.5 },
  { part_no: "CENDBFO200KRX", name: "Centor 200mm Dropbolt Keyed Brushed Metalic", cost: 37.41 },
  { part_no: "CENDBFO200NRTG", name: "Centor 200mm Dropbolt Non-Keyed Brass", cost: 43.47 },
  { part_no: "CENDBFO200NRX", name: "Centor 200mm Dropbolt Non-Keyed Brushed Metalic", cost: 33.82 },
  { part_no: "CENE3HSTS", name: "Centor E3 Hinge Set Stainless Steel", cost: 40.82 },
  { part_no: "CENE3HSTG", name: "Centor E3 Hinge Set Brass", cost: 40.82 },
  { part_no: "CENF3HSTS", name: "Centor F3 Hinge Set Stainless Steel", cost: 95.04 },
  { part_no: "CENF3HSTG", name: "Centor F3 Hinge Set Brass", cost: 95.04 },
  { part_no: "CENF4HSTS", name: "Centor F4 Hinge Set Stainless Steel", cost: 95.04 },
  { part_no: "CENF4HSTG", name: "Centor F4 Hinge Set Brass", cost: 95.04 },
  { part_no: "CENF5HSTS", name: "Centor F5 Hinge Set Stainless Steel", cost: 95.04 },
  { part_no: "CENF5HSTG", name: "Centor F5 Hinge Set Brass", cost: 95.04 },
  { part_no: "CENF6HSTS", name: "Centor F6 Hinge Set Stainless Steel", cost: 95.04 },
  { part_no: "CENF6HSTG", name: "Centor F6 Hinge Set Brass", cost: 95.04 },
  { part_no: "CENLKTS", name: "Centor Lock Kit Stainless Steel", cost: 95.04 },
  { part_no: "CENLKTG", name: "Centor Lock Kit Brass", cost: 95.04 },
  { part_no: "CENMBTS", name: "Centor Multipoint Bottom Stainless Steel", cost: 40.82 },
  { part_no: "CENMBTG", name: "Centor Multipoint Bottom Brass", cost: 40.82 },
  { part_no: "CENMHTS", name: "Centor Multipoint Head Stainless Steel", cost: 40.82 },
  { part_no: "CENMHTG", name: "Centor Multipoint Head Brass", cost: 40.82 },
  { part_no: "CENMLTS", name: "Centor Multipoint Left Stainless Steel", cost: 40.82 },
  { part_no: "CENMLTG", name: "Centor Multipoint Left Brass", cost: 40.82 },
  { part_no: "CENMRSS", name: "Centor Multipoint Right Stainless Steel", cost: 40.82 },
  { part_no: "CENMRSG", name: "Centor Multipoint Right Brass", cost: 40.82 },
  { part_no: "CENSLTS", name: "Centor Sill Stainless Steel", cost: 95.04 },
  { part_no: "CENSLTG", name: "Centor Sill Brass", cost: 95.04 },
  { part_no: "CENWTS", name: "Centor Weather Trim Stainless Steel", cost: 19.44 },
  { part_no: "CENWTG", name: "Centor Weather Trim Brass", cost: 19.44 },
  { part_no: "CWF100", name: "Claw Fastener Ironmongery Set with Pulleys Polished Brass", cost: 29.3 },
  { part_no: "CWF101", name: "Claw Fastener Ironmongery Set with Pulleys Polished Chrome", cost: 30.73 },
  { part_no: "CWF102", name: "Claw Fastener Ironmongery Set with Pulleys Satin Chrome", cost: 36.24 },
  { part_no: "CWF103", name: "Claw Fastener Ironmongery Set with Pulleys Black", cost: 30.73 },
  { part_no: "CWF104", name: "Claw Fastener Ironmongery Set with Pulleys Pewter", cost: 30.73 },
  { part_no: "CWF200", name: "Claw Fastener Ironmongery Set without Pulleys Polished Brass", cost: 14.15 },
  { part_no: "CWF201", name: "Claw Fastener Ironmongery Set without Pulleys Polished Chrome", cost: 15.58 },
  { part_no: "CWF202", name: "Claw Fastener Ironmongery Set without Pulleys Satin Chrome", cost: 21.09 },
  { part_no: "CWF203", name: "Claw Fastener Ironmongery Set without Pulleys Black", cost: 15.58 },
  { part_no: "CWF204", name: "Claw Fastener Ironmongery Set without Pulleys Pewter", cost: 15.58 },
  { part_no: "CWF300", name: "Claw Fastener Ironmongery Set with Spiral Balances Polished Brass", cost: 29.3 },
  { part_no: "CWF301", name: "Claw Fastener Ironmongery Set with Spiral Balances Polished Chrome", cost: 30.73 },
  { part_no: "CWF302", name: "Claw Fastener Ironmongery Set with Spiral Balances Satin Chrome", cost: 36.24 },
  { part_no: "CWF303", name: "Claw Fastener Ironmongery Set with Spiral Balances Black", cost: 30.73 },
  { part_no: "CWF304", name: "Claw Fastener Ironmongery Set with Spiral Balances Pewter", cost: 30.73 },
  { part_no: "CWF400", name: "Ball Claw Fastener Set with Pulleys Polished Brass", cost: 29.3 },
  { part_no: "CWF401", name: "Ball Claw Fastener Set with Pulleys Polished Chrome", cost: 30.73 },
  { part_no: "CWF402", name: "Ball Claw Fastener Set with Pulleys Satin Chrome", cost: 36.24 },
  { part_no: "CWF403", name: "Ball Claw Fastener Set with Pulleys Black", cost: 30.73 },
  { part_no: "CWF404", name: "Ball Claw Fastener Set with Pulleys Pewter", cost: 30.73 },
  { part_no: "CWF500", name: "Ball Claw Fastener Set without Pulleys Polished Brass", cost: 14.15 },
  { part_no: "CWF501", name: "Ball Claw Fastener Set without Pulleys Polished Chrome", cost: 15.58 },
  { part_no: "CWF502", name: "Ball Claw Fastener Set without Pulleys Satin Chrome", cost: 21.09 },
  { part_no: "CWF503", name: "Ball Claw Fastener Set without Pulleys Black", cost: 15.58 },
  { part_no: "CWF504", name: "Ball Claw Fastener Set without Pulleys Pewter", cost: 15.58 },
  { part_no: "CWF600", name: "Beehive Claw Fastener Set with Pulleys Polished Brass", cost: 29.3 },
  { part_no: "CWF601", name: "Beehive Claw Fastener Set with Pulleys Polished Chrome", cost: 30.73 },
  { part_no: "CWF602", name: "Beehive Claw Fastener Set with Pulleys Satin Chrome", cost: 36.24 },
  { part_no: "CWF603", name: "Beehive Claw Fastener Set with Pulleys Black", cost: 30.73 },
  { part_no: "CWF604", name: "Beehive Claw Fastener Set with Pulleys Pewter", cost: 30.73 },
  { part_no: "CWF700", name: "Beehive Claw Fastener Set without Pulleys Polished Brass", cost: 14.15 },
  { part_no: "CWF701", name: "Beehive Claw Fastener Set without Pulleys Polished Chrome", cost: 15.58 },
  { part_no: "CWF702", name: "Beehive Claw Fastener Set without Pulleys Satin Chrome", cost: 21.09 },
  { part_no: "CWF703", name: "Beehive Claw Fastener Set without Pulleys Black", cost: 15.58 },
  { part_no: "CWF704", name: "Beehive Claw Fastener Set without Pulleys Pewter", cost: 15.58 },
  { part_no: "DL001PB", name: "Claw Fastener Polished Brass", cost: 14.55 },
  { part_no: "DL001PC", name: "Claw Fastener Polished Chrome", cost: 13.9 },
  { part_no: "DL001SC", name: "Claw Fastener Satin Chrome", cost: 19.41 },
  { part_no: "DL001BLK", name: "Claw Fastener Black", cost: 13.9 },
  { part_no: "DL001PWT", name: "Claw Fastener Pewter", cost: 13.9 },
  { part_no: "DL002PB", name: "Fitch Fastener Polished Brass", cost: 10.54 },
  { part_no: "DL002PC", name: "Fitch Fastener Polished Chrome", cost: 10.39 },
  { part_no: "DL002SC", name: "Fitch Fastener Satin Chrome", cost: 13.22 },
  { part_no: "DL002BLK", name: "Fitch Fastener Black", cost: 10.39 },
  { part_no: "DL002PWT", name: "Fitch Fastener Pewter", cost: 10.39 },
  { part_no: "DL003PB", name: "Peardrop Casement Fastener Polished Brass", cost: 8.33 },
  { part_no: "DL003PC", name: "Peardrop Casement Fastener Polished Chrome", cost: 8.33 },
  { part_no: "DL003SC", name: "Peardrop Casement Fastener Satin Chrome", cost: 10.47 },
  { part_no: "DL003BLK", name: "Peardrop Casement Fastener Black", cost: 8.33 },
  { part_no: "DL003PWT", name: "Peardrop Casement Fastener Pewter", cost: 8.33 },
  { part_no: "DL004PB", name: "Monkey Tail Casement Fastener Polished Brass", cost: 10.54 },
  { part_no: "DL004PC", name: "Monkey Tail Casement Fastener Polished Chrome", cost: 10.39 },
  { part_no: "DL004SC", name: "Monkey Tail Casement Fastener Satin Chrome", cost: 13.22 },
  { part_no: "DL004BLK", name: "Monkey Tail Casement Fastener Black", cost: 10.39 },
  { part_no: "DL004PWT", name: "Monkey Tail Casement Fastener Pewter", cost: 10.39 },
  { part_no: "DL005PB", name: "Casement Stays Polished Brass 8in", cost: 9.73 },
  { part_no: "DL005PC", name: "Casement Stays Polished Chrome 8in", cost: 9.37 },
  { part_no: "DL005SC", name: "Casement Stays Satin Chrome 8in", cost: 10.54 },
  { part_no: "DL005BLK", name: "Casement Stays Black 8in", cost: 9.37 },
  { part_no: "DL005PWT", name: "Casement Stays Pewter 8in", cost: 9.37 },
  { part_no: "DL006PB", name: "Casement Stays Polished Brass 10in", cost: 10.54 },
  { part_no: "DL006PC", name: "Casement Stays Polished Chrome 10in", cost: 9.73 },
  { part_no: "DL006SC", name: "Casement Stays Satin Chrome 10in", cost: 12.17 },
  { part_no: "DL006BLK", name: "Casement Stays Black 10in", cost: 9.73 },
  { part_no: "DL006PWT", name: "Casement Stays Pewter 10in", cost: 9.73 },
  { part_no: "DL007PB", name: "Casement Stays Polished Brass 12in", cost: 11.64 },
  { part_no: "DL007PC", name: "Casement Stays Polished Chrome 12in", cost: 11.22 },
  { part_no: "DL007SC", name: "Casement Stays Satin Chrome 12in", cost: 13.58 },
  { part_no: "DL007BLK", name: "Casement Stays Black 12in", cost: 11.22 },
  { part_no: "DL007PWT", name: "Casement Stays Pewter 12in", cost: 11.22 },
  { part_no: "DL008PB", name: "Casement Pegs Polished Brass", cost: 1.84 },
  { part_no: "DL008PC", name: "Casement Pegs Polished Chrome", cost: 1.84 },
  { part_no: "DL008SC", name: "Casement Pegs Satin Chrome", cost: 1.84 },
  { part_no: "DL008BLK", name: "Casement Pegs Black", cost: 1.84 },
  { part_no: "DL008PWT", name: "Casement Pegs Pewter", cost: 1.84 },
  { part_no: "DL009PB", name: "Sash Lift Polished Brass", cost: 4.38 },
  { part_no: "DL009PC", name: "Sash Lift Polished Chrome", cost: 4.88 },
  { part_no: "DL009SC", name: "Sash Lift Satin Chrome", cost: 4.88 },
  { part_no: "DL009BLK", name: "Sash Lift Black", cost: 4.91 },
  { part_no: "DL009PWT", name: "Sash Lift Pewter", cost: 5.29 },
  { part_no: "DL010PB", name: "Spiral Balance Sash Lift Polished Brass", cost: 4.38 },
  { part_no: "DL010PC", name: "Spiral Balance Sash Lift Polished Chrome", cost: 4.88 },
  { part_no: "DL010SC", name: "Spiral Balance Sash Lift Satin Chrome", cost: 4.88 },
  { part_no: "DL010BLK", name: "Spiral Balance Sash Lift Black", cost: 4.91 },
  { part_no: "DL010PWT", name: "Spiral Balance Sash Lift Pewter", cost: 5.29 },
  { part_no: "DL011PB", name: "Sash Pulley Polished Brass", cost: 15.15 },
  { part_no: "DL011PC", name: "Sash Pulley Polished Chrome", cost: 15.15 },
  { part_no: "DL011SC", name: "Sash Pulley Satin Chrome", cost: 15.15 },
  { part_no: "DL011BLK", name: "Sash Pulley Black", cost: 15.15 },
  { part_no: "DL011PWT", name: "Sash Pulley Pewter", cost: 18.26 },
  { part_no: "DL012PB", name: "Victorian Sash Lift Polished Brass", cost: 13.15 },
  { part_no: "DL012PC", name: "Victorian Sash Lift Polished Chrome", cost: 13.15 },
  { part_no: "DL012SC", name: "Victorian Sash Lift Satin Chrome", cost: 13.15 },
  { part_no: "DL012BLK", name: "Victorian Sash Lift Black", cost: 13.15 },
  { part_no: "DL012PWT", name: "Victorian Sash Lift Pewter", cost: 13.15 },
  { part_no: "DL013PB", name: "Spiral Balance Ironmongery Set Polished Brass", cost: 14.15 },
  { part_no: "DL013PC", name: "Spiral Balance Ironmongery Set Polished Chrome", cost: 15.58 },
  { part_no: "DL013SC", name: "Spiral Balance Ironmongery Set Satin Chrome", cost: 21.09 },
  { part_no: "DL013BLK", name: "Spiral Balance Ironmongery Set Black", cost: 15.58 },
  { part_no: "DL013PWT", name: "Spiral Balance Ironmongery Set Pewter", cost: 15.58 },
  { part_no: "DL020PB", name: "Victorian Sash Fastener Polished Brass", cost: 14.55 },
  { part_no: "DL020PC", name: "Victorian Sash Fastener Polished Chrome", cost: 13.9 },
  { part_no: "DL020SC", name: "Victorian Sash Fastener Satin Chrome", cost: 19.41 },
  { part_no: "DL020BLK", name: "Victorian Sash Fastener Black", cost: 13.9 },
  { part_no: "DL020PWT", name: "Victorian Sash Fastener Pewter", cost: 13.9 },
  { part_no: "DL021PB", name: "Reeded Sash Fastener Polished Brass", cost: 14.55 },
  { part_no: "DL021PC", name: "Reeded Sash Fastener Polished Chrome", cost: 13.9 },
  { part_no: "DL021SC", name: "Reeded Sash Fastener Satin Chrome", cost: 19.41 },
  { part_no: "DL021BLK", name: "Reeded Sash Fastener Black", cost: 13.9 },
  { part_no: "DL021PWT", name: "Reeded Sash Fastener Pewter", cost: 13.9 },
  { part_no: "DL022PB", name: "Night Vent Sash Fastener Polished Brass", cost: 38.36 },
  { part_no: "DL022PC", name: "Night Vent Sash Fastener Polished Chrome", cost: 44.97 },
  { part_no: "DL022SC", name: "Night Vent Sash Fastener Satin Chrome", cost: 44.97 },
  { part_no: "DL022BLK", name: "Night Vent Sash Fastener Black", cost: 38.36 },
  { part_no: "DL022PWT", name: "Night Vent Sash Fastener Pewter", cost: 38.36 },
  { part_no: "EXT001", name: "Exitex Brushpile 7x6 White", cost: 2.19 },
  { part_no: "EXT002", name: "Exitex Brushpile 9x9 White", cost: 2.93 },
  { part_no: "EXT003", name: "Exitex Brushpile 7x6 Brown", cost: 2.19 },
  { part_no: "EXT004", name: "Exitex Brushpile 9x9 Brown", cost: 2.93 },
  { part_no: "EXT005", name: "Exitex Brushpile 5x5 White", cost: 2.07 },
  { part_no: "EXT006", name: "Exitex Brushpile 5x5 Brown", cost: 2.07 },
  { part_no: "FHDH001", name: "102mm Ball Bearing Hinges (Pair) Polished Brass", cost: 7.04 },
  { part_no: "FHDH002", name: "102mm Ball Bearing Hinges (Pair) Polished Chrome", cost: 4.39 },
  { part_no: "FHDH003", name: "102mm Ball Bearing Hinges (Pair) Satin Chrome", cost: 3.13 },
  { part_no: "FHDH004", name: "102mm Ball Bearing Hinges (Pair) Black", cost: 7.05 },
  { part_no: "FHDH005", name: "102mm Ball Bearing Hinges (Pair) Antique Brass", cost: 7.93 },
  { part_no: "FHDH006", name: "76mm Ball Bearing Hinges (Pair) Polished Brass", cost: 4.9 },
  { part_no: "FHDH007", name: "76mm Ball Bearing Hinges (Pair) Polished Chrome", cost: 3.39 },
  { part_no: "FHDH008", name: "76mm Ball Bearing Hinges (Pair) Satin Chrome", cost: 2.78 },
  { part_no: "FHDH009", name: "76mm Ball Bearing Hinges (Pair) Black", cost: 4.9 },
  { part_no: "FHDH010", name: "76mm Ball Bearing Hinges (Pair) Antique Brass", cost: 5.25 },
  { part_no: "FHDH011", name: "4 inch Parliament Hinge (152mm depth) Polished Brass", cost: 32.72 },
  { part_no: "FHDH012", name: "4 inch Parliament Hinge (152mm depth) Polished Chrome", cost: 43.16 },
  { part_no: "FHDH013", name: "4 inch Parliament Hinge (152mm depth) Satin Chrome", cost: 43.16 },
  { part_no: "FHDH014", name: "4 inch Parliament Hinge (152mm depth) Antique Brass", cost: 40.45 },
  { part_no: "HHD367", name: "4 inch Parliament Hinge (152mm depth) - Polished Brass", cost: 32.72 },
  { part_no: "HHD390", name: "4 inch Parliament Hinge (152mm depth) - Polished Chrome", cost: 43.16 },
  { part_no: "HHD395", name: "4 inch Parliament Hinge (152mm depth) - Satin Chrome", cost: 43.16 },
  { part_no: "HHD932", name: "4 inch Parliament Hinge (152mm depth) - Antique Brass", cost: 40.45 },
  { part_no: "HHD678", name: "76x51x2.0mm Ball Bearing Hinge PSS", cost: 2.78 },
  { part_no: "HHD680", name: "76x51x2.0mm Ball Bearing Hinge Polished Brass", cost: 4.9 },
  { part_no: "HHD681", name: "102mm Ball Bearing Hinges (Pair) Brass", cost: 7.04 },
  { part_no: "HHD691", name: "102mm Ball Bearing Hinges (Pair) Antique Brass", cost: 7.93 },
  { part_no: "HHD692", name: "102mm Ball Bearing Hinges (Pair) Polished Chrome", cost: 4.39 },
  { part_no: "HHD694", name: "76x51x2.0mm Ball Bearing Hinge Black", cost: 4.9 },
  { part_no: "HHD695", name: "102mm Ball Bearing Hinges (Pair) Black", cost: 7.05 },
  { part_no: "IM100100", name: "Banham M2002 Mortice Deadlock (2 keys) - Polished Brass", cost: 277.2 },
  { part_no: "IM100105", name: "Banham M2002 Mortice Deadlock (2 keys) - Polished Chrome", cost: 277.2 },
  { part_no: "IM100110", name: "Banham M2002 Mortice Deadlock (2 keys) - Satin Chrome", cost: 277.2 },
  { part_no: "IM100115", name: "Banham L2000 Rim Nightlatch (2 keys) - Polished Brass", cost: 301.09 },
  { part_no: "IM100120", name: "Banham L2000 Rim Nightlatch (2 keys) - Polished Chrome", cost: 301.09 },
  { part_no: "IM100125", name: "Banham L2000 Rim Nightlatch (2 keys) - Satin Chrome", cost: 301.09 },
  { part_no: "IM100130", name: "Banham L2000 Rim Deadbolt (2 keys) - Polished Brass", cost: 273.6 },
  { part_no: "IM100135", name: "Banham L2000 Rim Deadbolt (2 keys) - Polished Chrome", cost: 273.6 },
  { part_no: "IM100140", name: "Banham L2000 Rim Deadbolt (2 keys) - Satin Chrome", cost: 273.6 },
  { part_no: "IM200100", name: "Banham L2000 Rim Nightlatch & M2002 Mortice Deadlock KA (2 keys) - Polished Brass", cost: 525.6 },
  { part_no: "IM200105", name: "Banham L2000 Rim Nightlatch & M2002 Mortice Deadlock KA (2 keys) - Polished Chrome", cost: 525.6 },
  { part_no: "IM200110", name: "Banham L2000 Rim Nightlatch & M2002 Mortice Deadlock KA (2 keys) - Satin Chrome", cost: 525.6 },
  { part_no: "IM200115", name: "Banham L2000 Rim Deadbolt & M2002 Mortice Deadlock KA (2 keys) - Polished Brass", cost: 525.6 },
  { part_no: "IM200120", name: "Banham L2000 Rim Deadbolt & M2002 Mortice Deadlock KA (2 keys) - Polished Chrome", cost: 525.6 },
  { part_no: "IM200125", name: "Banham L2000 Rim Deadbolt & M2002 Mortice Deadlock KA (2 keys) - Satin Chrome", cost: 525.6 },
  { part_no: "IM300100", name: "Banham M2002 Mortice Deadlock (2 keys) - Polished Brass", cost: 277.2 },
  { part_no: "IM300105", name: "Banham M2002 Mortice Deadlock (2 keys) - Polished Chrome", cost: 277.2 },
  { part_no: "IM300110", name: "Banham M2002 Mortice Deadlock (2 keys) - Satin Chrome", cost: 277.2 },
  { part_no: "IM300115", name: "Banham L2000 Rim Nightlatch (2 keys) - Polished Brass", cost: 301.09 },
  { part_no: "IM300120", name: "Banham L2000 Rim Nightlatch (2 keys) - Polished Chrome", cost: 301.09 },
  { part_no: "IM300125", name: "Banham L2000 Rim Nightlatch (2 keys) - Satin Chrome", cost: 301.09 },
  { part_no: "IM300130", name: "Banham L2000 Rim Deadbolt (2 keys) - Polished Chrome", cost: 273.6 },
  { part_no: "IM300135", name: "Banham L2000 Rim Deadbolt (2 keys) - Satin Chrome", cost: 273.6 },
  { part_no: "IM300140", name: "Banham L2000 Rim Deadbolt & M2002 Mortice Deadlock KA (2 keys) - Polished Brass", cost: 525.6 },
  { part_no: "IM300145", name: "Banham L2000 Rim Deadbolt & M2002 Mortice Deadlock KA (2 keys) - Polished Chrome", cost: 525.6 },
  { part_no: "IM300150", name: "Banham L2000 Rim Deadbolt & M2002 Mortice Deadlock KA (2 keys) - Satin Chrome", cost: 525.6 },
  { part_no: "IM300155", name: "Additional Banham Key", cost: 25 },
  { part_no: "IM300160", name: "Additional Deadlock Key", cost: 10 },
  { part_no: "IM300165", name: "Additional Nightlatch Key", cost: 10 },
  { part_no: "ironmongeryPlaceholder", name: "Ironmongery Placeholder", cost: 0 },
  { part_no: "KP108310", name: "Kirkpatrick Letterplate Antique Black", cost: 34.59 },
  { part_no: "KP1100", name: "Kirkpatrick Letter Tidy Antique Black", cost: 19.1 },
  { part_no: "KP197930", name: "Kirkpatrick Numerals 0 Black", cost: 5.2 },
  { part_no: "KP197931", name: "Kirkpatrick Numerals 1 Black", cost: 5.2 },
  { part_no: "KP197932", name: "Kirkpatrick Numerals 2 Black", cost: 5.2 },
  { part_no: "KP197933", name: "Kirkpatrick Numerals 3 Black", cost: 5.2 },
  { part_no: "KP197934", name: "Kirkpatrick Numerals 4 Black", cost: 5.2 },
  { part_no: "KP197935", name: "Kirkpatrick Numerals 5 Black", cost: 5.2 },
  { part_no: "KP197936", name: "Kirkpatrick Numerals 6 Black", cost: 5.2 },
  { part_no: "KP197937", name: "Kirkpatrick Numerals 7 Black", cost: 5.2 },
  { part_no: "KP197938", name: "Kirkpatrick Numerals 8 Black", cost: 5.2 },
  { part_no: "KP197939", name: "Kirkpatrick Numerals 9 Black", cost: 5.2 },
  { part_no: "KP245992", name: "Kirkpatrick 2459 Handle Antique Black", cost: 54.61 },
  { part_no: "KP3045", name: "Oval Escutcheon Black", cost: 4.55 },
  { part_no: "L2000CP", name: "Banham L2000 Rim Nightlatch Polished Chrome", cost: 301.09 },
  { part_no: "L2000PB", name: "Banham L2000 Rim Nightlatch Polished Brass", cost: 301.09 },
  { part_no: "L2000sc", name: "Banham L2000 Rim Nightlatch Satin Chrome", cost: 301.09 },
  { part_no: "LJZ5064040AB", name: "Double Euro Cylinder 40/40 Antique Brass", cost: 23.81 },
  { part_no: "LJZ5064040BK", name: "Double Euro Cylinder 40/40 Black", cost: 20.95 },
  { part_no: "LJZ5064040CP", name: "Double Euro Cylinder 40/40 Polished Chrome", cost: 21.7 },
  { part_no: "LJZ5064040PB", name: "Double Euro Cylinder 40/40 Polished Brass", cost: 19.6 },
  { part_no: "LJZ5064040SC", name: "Double Euro Cylinder 40/40 Satin Chrome", cost: 21.83 },
  { part_no: "LJZ5074040AB", name: "Thumbturn Euro Cylinder 40/40 Antique Brass", cost: 25.82 },
  { part_no: "LJZ5074040BK", name: "Thumbturn Euro Cylinder 40/40 Black", cost: 26.26 },
  { part_no: "LJZ5074040CP", name: "Thumbturn Euro Cylinder 40/40 Polished Chrome", cost: 25.84 },
  { part_no: "LJZ5074040PB", name: "Thumbturn Euro Cylinder 40/40 Polished Brass", cost: 25.04 },
  { part_no: "LJZ5074040SC", name: "Thumbturn Euro Cylinder 40/40 Satin Chrome", cost: 24.92 },
  { part_no: "LJZ5174040PB", name: "Ultion Double Euro 3* Cylinder 40/40 Polished Brass", cost: 44.69 },
  { part_no: "LJZ5174040PC", name: "Ultion Double Euro 3* Cylinder 40/40 Polished Chrome", cost: 47.59 },
  { part_no: "LJZ5184040PB", name: "Ultion Thumbturn Euro 3* Cylinder 40/40 Polished Brass", cost: 50.8 },
  { part_no: "LJZ5184040PC", name: "Ultion Thumbturn Euro 3* Cylinder 40/40 Polished Chrome", cost: 48.7 },
  { part_no: "M2002CP", name: "M2002 Banham Deadlock Polished Chrome", cost: 277.2 },
  { part_no: "M2002PB", name: "M2002 Banham Deadlock Polished Brass", cost: 277.2 },
  { part_no: "M2002SCP", name: "M2002 Banham Deadlock Satin Chrome", cost: 277.2 },
  { part_no: "MIGHT01", name: "MIGHTON - Linked Sash Chain Lacquered Brass", cost: 75 },
  { part_no: "MIGHT02", name: "MIGHTON - Linked Sash Chain Antique Brass", cost: 74.2 },
  { part_no: "MIGHTON-WC", name: "MIGHTON - Steel Weight Connector for Sash Chain", cost: 2 },
  { part_no: "MJZ2500", name: "Maco Panorama 250kg Rollers Set", cost: 149.73 },
  { part_no: "MJZ2503", name: "Maco Panorama 692 Connecting Rod", cost: 2.92 },
  { part_no: "MJZ2504", name: "Maco Panorama 1196 Connecting Rod", cost: 4.6 },
  { part_no: "MJZ2505", name: "Maco Panorama 1700 Connecting Rod", cost: 7.36 },
  { part_no: "MJZ2506", name: "Maco Panorama 2204 Connecting Rod", cost: 8.79 },
  { part_no: "MJZ2507", name: "Maco Panorama 2708 Connecting Rod", cost: 10.06 },
  { part_no: "MJZ2508", name: "Maco Connection Rod Supports", cost: 1.28 },
  { part_no: "MJZ2509", name: "Maco Bottom Roller Track 2500", cost: 28.27 },
  { part_no: "MJZ2510", name: "Maco Bottom Roller Track 3500", cost: 40.95 },
  { part_no: "MJZ2511", name: "Maco Bottom Roller Track 5000", cost: 26.84 },
  { part_no: "MJZ2512", name: "Maco Bottom Roller Track 6500", cost: 35.98 },
  { part_no: "MJZ2515", name: "Maco Gasket Bridge Bottom Flat", cost: 2.41 },
  { part_no: "MJZ2516", name: "Maco Gasket Piece for Flat Bottom Roller Track", cost: 3.59 },
  { part_no: "MJZ2517", name: "Maco Top Guide Track 3500", cost: 28.55 },
  { part_no: "MJZ2518", name: "Maco Top Guide Track 5000", cost: 43.29 },
  { part_no: "MJZ2519", name: "Maco Top Guide Track 6500", cost: 50.4 },
  { part_no: "MJZ2523", name: "Maco Accessories for Flush Tracks", cost: 34.46 },
  { part_no: "MJZ2524", name: "Maco Universal Buffer Stop", cost: 11.2 },
  { part_no: "MJZ2525", name: "Maco Panorama Drive Gear PC1", cost: 68.86 },
  { part_no: "MJZ2526", name: "Maco Panorama Drive Gear PC2", cost: 80.74 },
  { part_no: "MJZ2527", name: "Maco Panorama Drive Gear PC3", cost: 81.9 },
  { part_no: "MJZ2528", name: "Maco Panorama Drive Gear PC4", cost: 88.98 },
  { part_no: "MJZ2529", name: "Maco Panorama Drive Gear PC5", cost: 100.09 },
  { part_no: "MJZ2530", name: "Maco Panorama Drive Gear PC6", cost: 152.26 },
  { part_no: "MJZ2532", name: "Maco Pin Bolts", cost: 5.2 },
  { part_no: "MJZ2533", name: "Maco Panorama Rubber Seals", cost: 1.34 },
  { part_no: "MJZ2572", name: "Maco HS12 Lift and Slide Lever Silver", cost: 74.1 },
  { part_no: "MJZ2573", name: "Maco HS12 Lift and Slide Lever Titanium", cost: 74.1 },
  { part_no: "MJZ2575", name: "Maco HS12 Lift and Slide Lever Bronze", cost: 74.1 },
  { part_no: "MJZ2579", name: "Maco HS12 Lift and Slide Lever White", cost: 74.1 },
  { part_no: "MJZ2580", name: "Maco HS12 Lift and Slide Lever Black", cost: 59.05 },
  { part_no: "MJZ2584", name: "Maco Adapta Sash Seals Black 2.5x2.5m", cost: 28.7 },
  { part_no: "MJZ2585", name: "Maco Adapta Sash Seals Black 3.5x3.5m", cost: 28.7 },
  { part_no: "MJZ2586", name: "Maco Adapta Double Strand Black", cost: 1.89 },
  { part_no: "PRIBC2012A", name: "Premium Letter Tidy Polished Chrome", cost: 26.46 },
  { part_no: "PRIPB2012A", name: "Premium Letter Tidy Polished Brass", cost: 26.46 },
  { part_no: "PRISCP2012A", name: "Premium Letter Tidy Satin Chrome", cost: 26.46 },
  { part_no: "PRIXL2012A", name: "Premium Letter Tidy Antique Brass", cost: 30.49 },
  { part_no: "QEE387", name: "Pole", cost: 3.08 },
  { part_no: "RFH203", name: "Defender 310mm Side Hung Friction Hinge", cost: 7.82 },
  { part_no: "RFH204", name: "Defender 412mm Side Hung Friction Hinge", cost: 11.92 },
  { part_no: "RFH205", name: "Defender 208mm Top Hung Friction Hinge", cost: 4 },
  { part_no: "RFH206", name: "Defender 259mm Top Hung Friction Hinge", cost: 4.54 },
  { part_no: "RFH207", name: "Defender 310mm Top Hung Friction Hinge", cost: 5.1 },
  { part_no: "RFH208", name: "Defender 412mm Top Hung Friction Hinge", cost: 7.09 },
  { part_no: "RFH209", name: "Defender 513mm Top Hung Friction Hinge", cost: 8.2 },
  { part_no: "RFH210", name: "Defender 615mm Top Hung Friction Hinge", cost: 12.61 },
  { part_no: "RFZ176", name: "Connoisseur Locking Stay - Satin Chrome", cost: 12.18 },
  { part_no: "RFZ525", name: "Connoisseur Locking Stay - Polished Chrome", cost: 12.18 },
  { part_no: "RFZ528", name: "Connoisseur Locking Stay - Black", cost: 14.94 },
  { part_no: "RFZ529", name: "Connoisseur Locking Stay - Polished Brass", cost: 10.47 },
  { part_no: "RGE2105", name: "Macclex Inward Opening Ali Threshold", cost: 49.99 },
  { part_no: "RGE2928", name: "OUM 5 Outward Opening Ali Threshold", cost: 65.27 },
  { part_no: "RHE2757", name: "Yorkshire Sliding Sash Kit - Brass", cost: 221.07 },
  { part_no: "RHZ1648", name: "Winkhaus Flushbolt LH", cost: 89.47 },
  { part_no: "RHZ1649", name: "Winkhaus Flushbolt RH", cost: 89.47 },
  { part_no: "RHZ1650", name: "Winkhaus FAB Tall Shootbolt LH", cost: 112.32 },
  { part_no: "RHZ1651", name: "Winkhaus FAB Tall Shootbolt RH", cost: 112.32 },
  { part_no: "RHZ1652", name: "Winkhaus Shootbolt", cost: 18.73 },
  { part_no: "RHZ1653", name: "Winkhaus FAB Shootbolt 399", cost: 34.92 },
  { part_no: "RHZ1654", name: "Winkhaus FAB Shootbolt 541", cost: 36.45 },
  { part_no: "RHZ1667", name: "Adj Single Shootbolt Keep", cost: 5.61 },
  { part_no: "RHZ1800", name: "Winkhaus Single Keep Radius End", cost: 3.45 },
  { part_no: "RHZ2107", name: "Winkhaus Interlocking Stable Door Lock 45mm Backset", cost: 173.12 },
  { part_no: "RHZ2213", name: "Winkhaus FAB Shootbolt 683", cost: 45.21 },
  { part_no: "RHZ2214", name: "Winkhaus FAB Shootbolt 825", cost: 47.86 },
  { part_no: "RHZ2295", name: "Winkhaus Centre Keep", cost: 8.61 },
  { part_no: "RHZ2427", name: "Winkhaus AV4 Pocket Keep", cost: 5.33 },
  { part_no: "RHZ2481", name: "Winkhaus AV4 Heritage Lock LH", cost: 106.56 },
  { part_no: "RHZ2482", name: "Winkhaus AV4 Heritage Lock RH", cost: 106.56 },
  { part_no: "RHZ2910", name: "Fixed Sash Fixing Clip System", cost: 1.85 },
  { part_no: "RHZ3091", name: "Winkhaus AV4 LH Centre Keep w Dayswitch", cost: 29.8 },
  { part_no: "RHZ3092", name: "Winkhaus AV4 RH Centre Keep w Dayswitch", cost: 29.8 },
  { part_no: "RHZ664", name: "Trickle Vent XR16 Recessed Slot Vent White", cost: 5.13 },
  { part_no: "RHZ665", name: "Trickle Vent XR16 Recessed Slot Vent White", cost: 7.23 },
  { part_no: "RHZ770", name: "Trickle Vent XHD16 Grille Brown", cost: 2.47 },
  { part_no: "RHZ771", name: "Trickle Vent XHD16 Grille White", cost: 2.18 },
  { part_no: "RJZ1015", name: "Connoisseur Handle Premium Satin RH", cost: 8.08 },
  { part_no: "RJZ1016", name: "Connoisseur Handle Premium Satin LH", cost: 8.08 },
  { part_no: "RJZ1648", name: "Winkhaus FAB Flushbolt LH", cost: 89.47 },
  { part_no: "RJZ1700", name: "Kenrick Excalibur Gearbox 25mm", cost: 3.89 },
  { part_no: "RJZ1701", name: "Kenrick Excalibur Extension Shootbolt 300-440mm", cost: 0.78 },
  { part_no: "RJZ1702", name: "Kenrick Excalibur Extension Shootbolt 370-500mm", cost: 0.82 },
  { part_no: "RJZ1703", name: "Kenrick Excalibur Extension Shootbolt 490-700mm", cost: 1.1 },
  { part_no: "RJZ1704", name: "Kenrick Excalibur Extension Shootbolt 690-950mm", cost: 1.57 },
  { part_no: "RJZ1705", name: "Kenrick Excalibur Extension Shootbolt 950-1210mm", cost: 2.07 },
  { part_no: "RJZ1708", name: "Kenrick Centre Strike", cost: 2.02 },
  { part_no: "RJZ1709", name: "Kenrick LH Shootbolt Strike", cost: 0.72 },
  { part_no: "RJZ1710", name: "Kenrick RH Shootbolt Strike", cost: 0.72 },
  { part_no: "RJZ1776", name: "Kenrick Excalibur Extension Shootbolt 1210-1470mm", cost: 2.35 },
  { part_no: "RJZ2016", name: "Teardrop Handle LH - Black", cost: 25 },
  { part_no: "RJZ2017", name: "Teardrop Handle RH - Black", cost: 25 },
  { part_no: "RJZ2018", name: "Teardrop Handle LH - Polished Chrome", cost: 23.29 },
  { part_no: "RJZ2019", name: "Teardrop Handle RH - Polished Chrome", cost: 23.29 },
  { part_no: "RJZ2020", name: "Teardrop Handle LH - Antique Brass", cost: 28.3 },
  { part_no: "RJZ2021", name: "Teardrop Handle RH - Antique Brass", cost: 28.3 },
  { part_no: "RJZ2344", name: "Kenrick Excalibur Straight Extension 300mm", cost: 3.82 },
  { part_no: "RJZ2382", name: "Winkhaus Thunderbolt Master Multipoint Lock", cost: 50.83 },
  { part_no: "RJZ3300", name: "Burnham Straight Handle White", cost: 2.6 },
  { part_no: "RJZ3302", name: "Burnham Straight Handle Polished Brass", cost: 5 },
  { part_no: "RJZ3304", name: "Burnham Straight Handle Polished Chrome", cost: 5 },
  { part_no: "RJZ3305", name: "Burnham Straight Handle Satin Chrome", cost: 5 },
  { part_no: "RJZ3306", name: "Burnham Straight Handle Black", cost: 2.6 },
  { part_no: "RJZ675", name: "Connoisseur Handle Polished Brass RH", cost: 7.55 },
  { part_no: "RJZ676", name: "Connoisseur Handle Polished Brass LH", cost: 7.55 },
  { part_no: "RJZ6762", name: "Connoisseur Handle Polished Brass LH", cost: 7.55 },
  { part_no: "RJZ679", name: "Connoisseur Handle Polished Chrome RH", cost: 7.55 },
  { part_no: "RJZ680", name: "Connoisseur Handle Polished Chrome LH", cost: 7.55 },
  { part_no: "RJZ683", name: "Connoisseur Handle Antique Black RH", cost: 7.55 },
  { part_no: "RJZ684", name: "Connoisseur Handle Antique Black LH", cost: 7.55 },
  { part_no: "SCON", name: "MIGHTON - Sash Stile Connector", cost: 1.4 },
  { part_no: "WIN5002439", name: "Winkhaus Short TruLock Right Hand", cost: 91.08 },
  { part_no: "WIN5002560", name: "Winkhaus Short TruLock Left Hand", cost: 91.08 },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function Import() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const unmatchedCount = useUnmatchedCount()

  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [log, setLog] = useState([])
  const [done, setDone] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const logRef = useRef(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [log])

  const addLog = msg => setLog(prev => [...prev, msg])

  // ── Import ──────────────────────────────────────────────────────────────────

  async function startImport() {
    setImporting(true)
    setDone(false)
    setLog([])
    setProgress(0)
    setProgressLabel('')

    // Step 1: annotate each item
    const annotated = IMPORT_DATA.map(item => ({
      ...item,
      finish:   getFinish(item.name),
      category: getCategory(item.name),
      baseName: getBaseName(item.name),
    }))

    // Step 2: group by baseName + category
    const groupMap = {}
    annotated.forEach(item => {
      const key = `${item.baseName}||${item.category}`
      if (!groupMap[key]) {
        groupMap[key] = { name: item.baseName, category: item.category, variants: [] }
      }
      groupMap[key].variants.push(item)
    })
    const groups = Object.values(groupMap).sort((a, b) => a.name.localeCompare(b.name))
    const total = groups.length

    addLog(`Found ${IMPORT_DATA.length} items → ${total} unique products. Starting import…`)
    addLog('')

    let productsDone = 0
    let variantsDone = 0
    let errors = 0

    for (const group of groups) {
      setProgressLabel(`${group.name}`)

      // Upsert product — SELECT then INSERT/UPDATE for reliability
      let productId = null
      const { data: existing } = await supabase
        .from('ironmongery_products')
        .select('id')
        .eq('name', group.name)
        .maybeSingle()

      if (existing) {
        const { error: upErr } = await supabase
          .from('ironmongery_products')
          .update({ category: group.category, is_trickle_vent: group.category === 'Trickle Vent' })
          .eq('id', existing.id)
        if (upErr) {
          addLog(`  ✗ Failed to update product "${group.name}": ${upErr.message}`)
          errors++
          continue
        }
        productId = existing.id
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from('ironmongery_products')
          .insert({ name: group.name, category: group.category, is_trickle_vent: group.category === 'Trickle Vent' })
          .select('id')
          .single()
        if (insErr || !inserted) {
          addLog(`  ✗ Failed to insert product "${group.name}": ${insErr?.message}`)
          errors++
          continue
        }
        productId = inserted.id
      }

      // Batch upsert all variants for this product
      const variantRows = group.variants.map(v => ({
        product_id:   productId,
        finish_name:  v.finish.name,
        finish_code:  v.finish.code,
        part_no:      v.part_no,
        cost:         v.cost,
        available:    true,
      }))

      const { error: vErr } = await supabase
        .from('ironmongery_variants')
        .upsert(variantRows, { onConflict: 'product_id,finish_name' })

      if (vErr) {
        addLog(`  ✗ Variant error for "${group.name}": ${vErr.message}`)
        errors++
      } else {
        variantsDone += variantRows.length
        const finishList = variantRows.map(v => `${v.finish_name} [${v.finish_code}]`).join(', ')
        addLog(`✓ ${group.name}  (${group.category})  — ${variantRows.length} finish${variantRows.length !== 1 ? 'es' : ''}: ${finishList}`)
      }

      productsDone++
      setProgress(Math.round((productsDone / total) * 100))

      // Yield to UI between products
      await new Promise(r => setTimeout(r, 0))
    }

    addLog('')
    addLog(`─────────────────────────────────────────────`)
    addLog(`Import complete: ${productsDone} products, ${variantsDone} variants${errors > 0 ? `, ${errors} errors` : ' — no errors'}.`)
    setProgress(100)
    setProgressLabel('Complete')
    setDone(true)
    setImporting(false)
  }

  // ── Clear ───────────────────────────────────────────────────────────────────

  async function clearAll() {
    setClearing(true)
    setShowConfirm(false)
    setLog([])
    setProgress(0)
    setDone(false)
    setProgressLabel('')

    addLog('Clearing all ironmongery data…')

    const { error: vErr } = await supabase
      .from('ironmongery_variants')
      .delete()
      .gt('id', 0)
    if (vErr) {
      addLog(`✗ Error clearing variants: ${vErr.message}`)
    } else {
      addLog('✓ All variants deleted')
    }

    const { error: pErr } = await supabase
      .from('ironmongery_products')
      .delete()
      .gt('id', 0)
    if (pErr) {
      addLog(`✗ Error clearing products: ${pErr.message}`)
    } else {
      addLog('✓ All products deleted')
    }

    addLog('Done.')
    setClearing(false)
  }

  const busy = importing || clearing

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'inherit' }}>

      {/* Sidebar */}
      <div style={{ width: 215, background: '#fff', borderRight: '1px solid #e8e6e0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid #e8e6e0' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>GlazePro</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Window management</div>
        </div>
        <div style={{ padding: '14px 14px 4px', fontSize: 10, color: '#aaa', letterSpacing: '.07em', textTransform: 'uppercase' }}>Workflow</div>
        {[
          ['Leads',            '/leads',             null],
          ['Quotes & orders',  null,                 null],
          ['Production',       null,                 null],
          ['Scheduling',       '/calendar',          null],
          ['Invoicing',        null,                 null],
          ['Tasks',            '/tasks',             null],
          ['Unmatched emails', '/unmatched-emails',  unmatchedCount || null],
        ].map(([item, path, badge]) => (
          <div
            key={item}
            onClick={path ? () => navigate(path) : undefined}
            style={{
              padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: path ? '#555' : '#aaa',
              fontWeight: 400,
              background: 'transparent',
              cursor: path ? 'pointer' : 'not-allowed',
              opacity: path ? 1 : 0.5,
            }}
          >
            <span>{item}</span>
            {badge > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: '#fceaea', color: '#8b2020', fontWeight: 600, flexShrink: 0 }}>{badge}</span>}
          </div>
        ))}
        <div style={{ padding: '14px 14px 4px', fontSize: 10, color: '#aaa', letterSpacing: '.07em', textTransform: 'uppercase' }}>Catalogue</div>
        <div
          onClick={() => navigate('/ironmongery')}
          style={{ padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px', display: 'flex', alignItems: 'center', color: '#555', fontWeight: 400, background: 'transparent', cursor: 'pointer' }}
        >
          <span>Ironmongery</span>
        </div>
        <div
          onClick={() => navigate('/settings')}
          style={{ margin: '4px 7px 2px', padding: '8px 11px', fontSize: 13, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#555', cursor: 'pointer' }}
        >
          <span>⚙</span><span>Settings</span>
        </div>
        <div style={{ marginTop: 'auto', padding: 13, borderTop: '1px solid #e8e6e0' }}>
          <div style={{ fontSize: 11, color: '#555', fontWeight: 500, marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
          <button
            onClick={signOut}
            style={{ fontSize: 11, padding: '5px 10px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#555' }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', padding: '0 20px', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Ironmongery Import</div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
          <div style={{ maxWidth: 760 }}>

            {/* Description */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#222', marginBottom: 6 }}>Import ironmongery catalogue</div>
              <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
                This will import all {IMPORT_DATA.length} ironmongery items from the catalogue into the database,
                grouping them into products with finish variants. Existing records will be updated; new ones will be created.
              </div>
            </div>

            {/* Progress */}
            {(importing || done || clearing) && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                    {progressLabel || (done ? 'Complete' : 'Working…')}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', flexShrink: 0 }}>{progress}%</div>
                </div>
                <div style={{ width: '100%', height: 8, background: '#e8e6e0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: done ? '#0a5a3c' : '#3d35a8',
                    borderRadius: 4,
                    transition: 'width 0.2s ease',
                  }} />
                </div>
              </div>
            )}

            {/* Log */}
            {log.length > 0 && (
              <div
                ref={logRef}
                style={{
                  marginBottom: 24,
                  background: '#0e0e10',
                  borderRadius: 10,
                  padding: '14px 16px',
                  height: 340,
                  overflowY: 'auto',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 11,
                  lineHeight: 1.7,
                  color: '#d4d4d4',
                }}
              >
                {log.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      color: line.startsWith('✗') ? '#f87171'
                           : line.startsWith('✓') ? '#86efac'
                           : line.startsWith('Found') || line.startsWith('Import complete') ? '#fde68a'
                           : line.startsWith('─') ? '#555'
                           : '#d4d4d4',
                    }}
                  >
                    {line || '\u00a0'}
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={startImport}
                disabled={busy}
                style={{
                  fontSize: 13, fontWeight: 600, padding: '10px 24px',
                  borderRadius: 8, border: 'none',
                  background: busy ? '#c4c0e8' : '#3d35a8',
                  color: '#fff',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                {importing ? 'Importing…' : done ? 'Run again' : 'Start Import'}
              </button>

              <button
                onClick={() => setShowConfirm(true)}
                disabled={busy}
                style={{
                  fontSize: 13, fontWeight: 500, padding: '10px 20px',
                  borderRadius: 8, border: '1px solid #e8d0d0',
                  background: '#fff',
                  color: busy ? '#ccc' : '#8b2020',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                {clearing ? 'Clearing…' : 'Clear all ironmongery data'}
              </button>
            </div>

            {/* Confirm dialog */}
            {showConfirm && (
              <div style={{
                marginTop: 16,
                padding: '16px 18px',
                background: '#fceaea',
                border: '1px solid #f0c8c8',
                borderRadius: 10,
                maxWidth: 480,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#8b2020', marginBottom: 6 }}>
                  Delete all ironmongery data?
                </div>
                <div style={{ fontSize: 12, color: '#7a2020', marginBottom: 14, lineHeight: 1.5 }}>
                  This will permanently delete every product and variant from the ironmongery tables. This cannot be undone.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={clearAll}
                    style={{
                      fontSize: 12, fontWeight: 600, padding: '7px 18px',
                      borderRadius: 7, border: 'none',
                      background: '#8b2020', color: '#fff', cursor: 'pointer',
                    }}
                  >
                    Yes, delete everything
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    style={{
                      fontSize: 12, fontWeight: 500, padding: '7px 14px',
                      borderRadius: 7, border: '1px solid #d8d5cf',
                      background: '#fff', color: '#555', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
