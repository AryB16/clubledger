// The paper receipts behind three entries, as the vendor handed them over (fictional). Paper stays off the chain:
// the site shows it only to compare with what the contract recorded. The same list prints docs/receipts.html.
export interface PaperReceipt {
  code: string
  vendor: string
  address: string
  date: string
  lines: [string, string][]
  total: string
  note: string
}

export const PAPER_RECEIPTS: PaperReceipt[] = [
  { code: 'EXP-0002', vendor: 'Campus Café', address: 'Academic City, Dubai', date: '12 Nov 2026', lines: [['Workshop refreshments, 40 people', '420.00']], total: '420.00', note: 'Paid by the Robotics Club' },
  { code: 'EXP-0004', vendor: 'PrintHub', address: 'Al Quoz, Dubai', date: '14 Nov 2026', lines: [['A2 event posters × 30', '300.00']], total: '300.00', note: 'Paid by the Robotics Club' },
  { code: 'INC-0001', vendor: 'Nova Robotics LLC', address: 'Dubai Silicon Oasis', date: '03 Nov 2026', lines: [['Season sponsorship', '5,000.00']], total: '5,000.00', note: 'Received by the Robotics Club' },
]
