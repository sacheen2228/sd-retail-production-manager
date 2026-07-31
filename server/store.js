import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const DB_PATH = path.join(DATA_DIR, 'db.json')

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function seedData() {
  const today = new Date()
  const daysFromNow = (n) => {
    const d = new Date(today)
    d.setDate(d.getDate() + n)
    return d.toISOString().slice(0, 10)
  }
  const daysAgo = (n) => daysFromNow(-n)
  const db = {
    retailers: [
      { id: uid(), name: 'The Wedding House', city: 'New Delhi', contact: '+91 98xxx 10001' },
      { id: uid(), name: 'Bridal Atelier Store', city: 'Mumbai', contact: '+91 98xxx 10002' },
      { id: uid(), name: 'Ethnic Couture Boutique', city: 'Kolkata', contact: '+91 98xxx 10003' },
      { id: uid(), name: 'Royal Occasions', city: 'Jaipur', contact: '+91 98xxx 10004' }
    ],
    vendors: [
      { id: uid(), name: 'Meher Embroidery House', type: 'Embroidery-Kolkata', location: 'Kolkata', contact: 'meher@example.com' },
      { id: uid(), name: 'Zari & Thread Studio', type: 'Embroidery-Mumbai', location: 'Mumbai', contact: 'zari@example.com' },
      { id: uid(), name: 'Banaras Silk Traders', type: 'Fabric', location: 'Varanasi', contact: 'banaras@example.com' },
      { id: uid(), name: 'Trim & Beads Supply Co.', type: 'Trims', location: 'Mumbai', contact: 'trims@example.com' },
      { id: uid(), name: 'Heritage Tailoring Unit', type: 'Stitching', location: 'Jaipur', contact: 'heritage@example.com' }
    ],
    fabrics: [
      { id: uid(), name: 'Banarasi Silk', type: 'Silk', stock: 240, uom: 'mtr', vendor: 'Banaras Silk Traders', leadTimeDays: 10, costPrice: 1400, consumption: 5, lowStockLevel: 80 },
      { id: uid(), name: 'Raw Silk Dupion', type: 'Silk', stock: 180, uom: 'mtr', vendor: 'Banaras Silk Traders', leadTimeDays: 12, costPrice: 950, consumption: 4, lowStockLevel: 60 },
      { id: uid(), name: 'Organza', type: 'Georgette', stock: 320, uom: 'mtr', vendor: 'Banaras Silk Traders', leadTimeDays: 8, costPrice: 520, consumption: 4, lowStockLevel: 100 },
      { id: uid(), name: 'Zari Border (gold)', type: 'Trim', stock: 60, uom: 'pcs', vendor: 'Trim & Beads Supply Co.', leadTimeDays: 6, costPrice: 1600, consumption: 1, lowStockLevel: 25 },
      { id: uid(), name: 'Pearl Buttons', type: 'Trim', stock: 420, uom: 'pcs', vendor: 'Trim & Beads Supply Co.', leadTimeDays: 5, costPrice: 12, consumption: 6, lowStockLevel: 100 }
    ],
    readyStock: [
      { id: uid(), name: 'Red Banarasi Lehenga Set', category: 'Bridal', subCategory: 'Lehenga Set', quantity: 6, costPrice: 45000, sellingPrice: 95000, lowStockLevel: 2, location: 'Showroom', notes: 'Heavy zardozi' },
      { id: uid(), name: 'Ivory Raw Silk Anarkali', category: 'Occasions', subCategory: 'Anarkali', quantity: 8, costPrice: 20000, sellingPrice: 42000, lowStockLevel: 3, location: 'Store', notes: '' },
      { id: uid(), name: 'Gold Organza Sharara Set', category: 'Occasions', subCategory: 'Sharara Set', quantity: 4, costPrice: 22000, sellingPrice: 48000, lowStockLevel: 2, location: 'Store', notes: '' },
      { id: uid(), name: 'Emerald Dupion Gown', category: 'Cocktail Wear', subCategory: 'Gown', quantity: 3, costPrice: 30000, sellingPrice: 65000, lowStockLevel: 2, location: 'Showroom', notes: '' },
      { id: uid(), name: 'Pastel Kurta Set', category: 'PreT', subCategory: 'Kurta Set', quantity: 15, costPrice: 8000, sellingPrice: 15000, lowStockLevel: 5, location: 'Store', notes: '' },
      { id: uid(), name: 'Black Bandhgala Suit', category: 'Menswear', subCategory: 'Bandhgala', quantity: 5, costPrice: 18000, sellingPrice: 35000, lowStockLevel: 2, location: 'Store', notes: '' }
    ],
    purchaseOrders: [
      {
        id: uid(),
        poNumber: 'PO-2401',
        retailerId: '',
        orderDate: daysAgo(12),
        deliveryDate: daysFromNow(25),
        status: 'In Production',
        value: 1850000,
        notes: 'Bridal trunk show order',
        createdAt: daysAgo(12)
      },
      {
        id: uid(),
        poNumber: 'PO-2402',
        retailerId: '',
        orderDate: daysAgo(20),
        deliveryDate: daysFromNow(9),
        status: 'In Production',
        value: 960000,
        notes: 'Occasion wear capsule',
        createdAt: daysAgo(20)
      },
      {
        id: uid(),
        poNumber: 'PO-2403',
        retailerId: '',
        orderDate: daysAgo(30),
        deliveryDate: daysFromNow(3),
        status: 'Dispatched',
        value: 1240000,
        notes: 'Festive collection early dispatch',
        createdAt: daysAgo(30)
      },
      {
        id: uid(),
        poNumber: 'PO-2404',
        retailerId: '',
        orderDate: daysAgo(6),
        deliveryDate: daysFromNow(40),
        status: 'Confirmed',
        value: 720000,
        notes: 'Repeat order',
        createdAt: daysAgo(6)
      }
    ],
    styles: [
      {
        id: uid(),
        poId: '',
        styleCode: 'BR-2412',
        styleName: 'Red Banarasi Lehenga Set',
        category: 'Bridal',
        subCategory: 'Lehenga Set',
        quantity: 12,
        price: 95000,
        fabric: 'Banarasi Silk',
        trim: 'Zari Border (gold)',
        stage: 'Embroidery-Kolkata',
        stageEnteredAt: daysAgo(4),
        qtyDispatched: 0,
        notes: 'Heavy zardozi on lehenga + dupatta',
        createdAt: daysAgo(12)
      },
      {
        id: uid(),
        poId: '',
        styleCode: 'BR-2415',
        styleName: 'Ivory Raw Silk Anarkali',
        category: 'Occasions',
        subCategory: 'Anarkali',
        quantity: 20,
        price: 42000,
        fabric: 'Raw Silk Dupion',
        trim: 'Pearl Buttons',
        stage: 'Cutting',
        stageEnteredAt: daysAgo(2),
        qtyDispatched: 0,
        notes: 'Awaiting Master fit approval',
        createdAt: daysAgo(12)
      },
      {
        id: uid(),
        poId: '',
        styleCode: 'BR-2411',
        styleName: 'Gold Organza Sharara',
        category: 'Occasions',
        subCategory: 'Sharara Set',
        quantity: 15,
        price: 48000,
        fabric: 'Organza',
        trim: 'Zari Border (gold)',
        stage: 'Stitching',
        stageEnteredAt: daysAgo(3),
        qtyDispatched: 0,
        notes: 'Split across two stitchers',
        createdAt: daysAgo(20)
      },
      {
        id: uid(),
        poId: '',
        styleCode: 'BR-2408',
        styleName: 'Maroon Velvet Jacket Set',
        category: 'Bridal',
        subCategory: 'Jacket Set',
        quantity: 8,
        price: 88000,
        fabric: 'Banarasi Silk',
        trim: 'Zari Border (gold)',
        stage: 'QC',
        stageEnteredAt: daysAgo(1),
        qtyDispatched: 0,
        notes: 'Final QC sign-off before packing',
        createdAt: daysAgo(30)
      },
      {
        id: uid(),
        poId: '',
        styleCode: 'BR-2406',
        styleName: 'Emerald Dupion Gown',
        category: 'Occasions',
        subCategory: 'Gown',
        quantity: 10,
        price: 65000,
        fabric: 'Raw Silk Dupion',
        trim: 'Pearl Buttons',
        stage: 'Dispatched',
        stageEnteredAt: daysAgo(2),
        qtyDispatched: 10,
        notes: 'Dispatched ahead of festival window',
        createdAt: daysAgo(30)
      },
      {
        id: uid(),
        poId: '',
        styleCode: 'BR-2420',
        styleName: 'Pastel Organza Saree Set',
        category: 'Occasions',
        subCategory: 'Saree Set',
        quantity: 25,
        price: 28000,
        fabric: 'Organza',
        trim: 'Zari Border (gold)',
        stage: 'Sampling',
        stageEnteredAt: daysAgo(3),
        qtyDispatched: 0,
        notes: 'Sample pending retailer approval',
        createdAt: daysAgo(6)
      }
    ]
  }

  db.purchaseOrders[0].retailerId = db.retailers[0].id
  db.purchaseOrders[1].retailerId = db.retailers[1].id
  db.purchaseOrders[2].retailerId = db.retailers[2].id
  db.purchaseOrders[3].retailerId = db.retailers[3].id

  const poStyles = [
    [0, 1],
    [2, 3],
    [4],
    [5]
  ]
  poStyles.forEach((styleIdx, poIdx) => {
    styleIdx.forEach((s) => {
      db.styles[s].poId = db.purchaseOrders[poIdx].id
    })
  })

  return db
}

function normalize(db) {
  db.styles.forEach((s) => {
    if (!Array.isArray(s.history)) {
      s.history = [
        {
          at: s.stageEnteredAt || s.createdAt || new Date().toISOString().slice(0, 10),
          from: null,
          to: s.stage || 'Sampling',
          note: 'Order created'
        }
      ]
    }
  })
  db.fabrics.forEach((f) => {
    if (f.costPrice === undefined) f.costPrice = 0
    if (f.consumption === undefined) f.consumption = 0
    if (f.lowStockLevel === undefined) f.lowStockLevel = 30
  })
  if (!Array.isArray(db.readyStock)) db.readyStock = []
  db.readyStock.forEach((r) => {
    if (r.lowStockLevel === undefined) r.lowStockLevel = 2
    if (r.costPrice === undefined) r.costPrice = 0
    if (r.sellingPrice === undefined) r.sellingPrice = 0
  })
  return db
}

export function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    const seeded = normalize(seedData())
    fs.writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2))
    return seeded
  }
  try {
    const db = normalize(JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')))
    saveDB(db)
    return db
  } catch {
    const seeded = normalize(seedData())
    fs.writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2))
    return seeded
  }
}

export function saveDB(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}
