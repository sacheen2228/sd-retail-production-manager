export const CATEGORIES = {
  Bridal: ['Lehenga Set', 'Gown', 'Sharara Set', 'Anarkali', 'Saree Set', 'Set-3'],
  Occasions: ['Suit', 'Anarkali', 'Set-2', 'Set-3', 'Lehenga Set', 'Gown', 'Kurta Set', 'Saree Set', 'Sharara Set'],
  'Cocktail Wear': ['Gown', 'Lehenga Set', 'Sharara Set', 'Anarkali', 'Set-2', 'Saree Set'],
  PreT: ['Kurta Set', 'Suit', 'Set-2', 'Anarkali', 'Saree Set'],
  Menswear: ['Suit', 'Kurta Set', 'Bandhgala', 'Sherwani', 'Waistcoat Set']
}

export const CATEGORY_NAMES = Object.keys(CATEGORIES)

export function subsFor(category) {
  return CATEGORIES[category] || []
}

export const STAGES = [
  'Sampling',
  'Fabric',
  'Trims',
  'Embroidery-Kolkata',
  'Embroidery-Mumbai',
  'Cutting',
  'Stitching',
  'Finishing',
  'QC',
  'Packing',
  'Dispatched'
]

export const STAGE_META = {
  'Embroidery-Kolkata': { tone: 'emb' },
  'Embroidery-Mumbai': { tone: 'emb' },
  Dispatched: { tone: 'done' },
  QC: { tone: 'qc' }
}

export function stageIndex(stage) {
  return STAGES.indexOf(stage)
}

export function fmtMoney(n) {
  if (n === null || n === undefined || isNaN(n)) return '₹0'
  return '₹' + Number(n).toLocaleString('en-IN')
}

export function fmtDate(d) {
  if (!d) return '-'
  const [y, m, day] = d.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${day} ${months[Number(m) - 1]} ${y}`
}

export function daysFromToday(dateStr) {
  if (!dateStr) return null
  const due = new Date(dateStr + 'T00:00:00')
  return Math.ceil((due - new Date()) / 86400000)
}

export function toneForStage(stage) {
  return STAGE_META[stage]?.tone || 'default'
}
