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
      { id: uid(), name: 'AZA Fashion', city: 'Mumbai', contact: '+91 98xxx 10002' }
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
      { id: uid(), name: 'Ivory Silk Lehenga Set', styleCode: 'BR-LH-001', color: 'Ivory', size: 'M', category: 'Bridal', subCategory: 'Lehenga Set', quantity: 4, receivedStock: 2, costPrice: 8500, sellingPrice: 24500, lowStockLevel: 2, location: 'Mumbai', notes: '' },
      { id: uid(), name: 'Ivory Silk Saree Set', styleCode: 'BR-SA-001', color: 'Ivory', size: 'Free', category: 'Bridal', subCategory: 'Saree Set', quantity: 5, receivedStock: 1, costPrice: 9800, sellingPrice: 26900, lowStockLevel: 2, location: 'Mumbai', notes: '' },
      { id: uid(), name: 'Black Organza Gown', styleCode: 'CW-GW-001', color: 'Black', size: 'L', category: 'Cocktail Wear', subCategory: 'Gown', quantity: 6, receivedStock: 0, costPrice: 6800, sellingPrice: 18900, lowStockLevel: 2, location: 'Delhi', notes: '' },
      { id: uid(), name: 'Teal Sharara Set', styleCode: 'CW-SH-001', color: 'Teal', size: 'M', category: 'Cocktail Wear', subCategory: 'Sharara Set', quantity: 3, receivedStock: 0, costPrice: 5100, sellingPrice: 14200, lowStockLevel: 2, location: 'Mumbai', notes: '' },
      { id: uid(), name: 'Maroon Velvet Gown', styleCode: 'CW-GW-002', color: 'Maroon', size: 'S', category: 'Cocktail Wear', subCategory: 'Gown', quantity: 1, receivedStock: 0, costPrice: 6400, sellingPrice: 17500, lowStockLevel: 2, location: 'Delhi', notes: '' },
      { id: uid(), name: 'Navy Bandhgala', styleCode: 'MN-BD-001', color: 'Navy', size: 'L', category: 'Menswear', subCategory: 'Bandhgala', quantity: 2, receivedStock: 0, costPrice: 7400, sellingPrice: 19900, lowStockLevel: 2, location: 'Delhi', notes: '' },
      { id: uid(), name: 'Off-white Sherwani', styleCode: 'MN-SW-001', color: 'Off-white', size: 'M', category: 'Menswear', subCategory: 'Sherwani', quantity: 4, receivedStock: 0, costPrice: 8200, sellingPrice: 22500, lowStockLevel: 2, location: 'Kolkata', notes: '' },
      { id: uid(), name: 'Red Banarasi Suit', styleCode: 'OC-ST-001', color: 'Red', size: 'M', category: 'Occasions', subCategory: 'Suit', quantity: 12, receivedStock: 0, costPrice: 3200, sellingPrice: 8900, lowStockLevel: 2, location: 'Mumbai', notes: '' },
      { id: uid(), name: 'Gold Raw Silk Anarkali', styleCode: 'OC-AN-001', color: 'Gold', size: 'Free', category: 'Occasions', subCategory: 'Anarkali', quantity: 0, receivedStock: 0, costPrice: 4200, sellingPrice: 11500, lowStockLevel: 2, location: 'Kolkata', notes: '' },
      { id: uid(), name: 'Pastel Kurta Set', styleCode: 'OC-KS-001', color: 'Pastel Pink', size: 'M', category: 'Occasions', subCategory: 'Kurta Set', quantity: 9, receivedStock: 0, costPrice: 2100, sellingPrice: 5900, lowStockLevel: 2, location: 'Kolkata', notes: '' }
    ],
    purchaseOrders: [
      {
        id: uid(),
        poNumber: 'PO-2026-001',
        retailerId: '',
        orderDate: daysAgo(15),
        deliveryDate: daysFromNow(12),
        status: 'In Production',
        value: 7050000,
        notes: 'Bridal capsule for trunk show',
        createdAt: daysAgo(15)
      },
      {
        id: uid(),
        poNumber: 'PO-2026-002',
        retailerId: '',
        orderDate: daysAgo(8),
        deliveryDate: daysFromNow(20),
        status: 'In Production',
        value: 6400000,
        notes: 'Occasion wear re-order',
        createdAt: daysAgo(8)
      },
      {
        id: uid(),
        poNumber: 'PO-2026-003',
        retailerId: '',
        orderDate: daysAgo(40),
        deliveryDate: daysAgo(5),
        status: 'Dispatched',
        value: 128200,
        notes: 'Dispatched stock replenishment',
        createdAt: daysAgo(40)
      }
    ],
    styles: [
      {
        id: uid(),
        poId: '',
        styleCode: 'BR-001',
        styleName: 'Red Banarasi Lehenga Set',
        category: 'Bridal',
        subCategory: 'Lehenga Set',
        color: 'Red',
        size: 'M',
        quantity: 50,
        price: 95000,
        fabric: 'Banarasi Silk',
        trim: 'Zari Border (gold)',
        stage: 'Stitching',
        stageEnteredAt: daysAgo(8),
        qtyDispatched: 8,
        notes: '50 pcs on order, 8 already dispatched',
        createdAt: daysAgo(15)
      },
      {
        id: uid(),
        poId: '',
        styleCode: 'BR-001',
        styleName: 'Red Banarasi Lehenga Set',
        category: 'Bridal',
        subCategory: 'Lehenga Set',
        color: 'Red',
        size: 'L',
        quantity: 40,
        price: 95000,
        fabric: 'Banarasi Silk',
        trim: 'Zari Border (gold)',
        stage: 'Finishing',
        stageEnteredAt: daysAgo(5),
        qtyDispatched: 5,
        notes: '',
        createdAt: daysAgo(15)
      },
      {
        id: uid(),
        poId: '',
        styleCode: 'OC-101',
        styleName: 'Pastel Organza Saree Set',
        category: 'Occasions',
        subCategory: 'Saree Set',
        color: 'Navy',
        size: 'XL',
        quantity: 100,
        price: 28000,
        fabric: 'Organza',
        trim: 'Zari Border (gold)',
        stage: 'Cutting',
        stageEnteredAt: daysAgo(3),
        qtyDispatched: 10,
        notes: '',
        createdAt: daysAgo(8)
      },
      {
        id: uid(),
        poId: '',
        styleCode: 'BR-LH-001',
        styleName: 'Ivory Silk Lehenga Set',
        category: 'Bridal',
        subCategory: 'Lehenga Set',
        color: 'Ivory',
        size: 'M',
        quantity: 3,
        price: 24500,
        fabric: 'Banarasi Silk',
        trim: 'Zari Border (gold)',
        stage: 'Dispatched',
        stageEnteredAt: daysAgo(12),
        qtyDispatched: 3,
        notes: '',
        createdAt: daysAgo(40)
      },
      {
        id: uid(),
        poId: '',
        styleCode: 'BR-SA-001',
        styleName: 'Ivory Silk Saree Set',
        category: 'Bridal',
        subCategory: 'Saree Set',
        color: 'Ivory',
        size: 'Free',
        quantity: 2,
        price: 26900,
        fabric: 'Raw Silk Dupion',
        trim: 'Pearl Buttons',
        stage: 'Dispatched',
        stageEnteredAt: daysAgo(10),
        qtyDispatched: 2,
        notes: '',
        createdAt: daysAgo(40)
      },
      {
        id: uid(),
        poId: '',
        styleCode: 'CW-GW-001',
        styleName: 'Black Organza Gown',
        category: 'Cocktail Wear',
        subCategory: 'Gown',
        color: 'Black',
        size: 'L',
        quantity: 2,
        price: 18900,
        fabric: 'Organza',
        trim: 'Pearl Buttons',
        stage: 'Dispatched',
        stageEnteredAt: daysAgo(8),
        qtyDispatched: 2,
        notes: '',
        createdAt: daysAgo(40)
      },
      {
        id: uid(),
        poId: '',
        styleCode: 'CW-SH-001',
        styleName: 'Teal Sharara Set',
        category: 'Cocktail Wear',
        subCategory: 'Sharara Set',
        color: 'Teal',
        size: 'M',
        quantity: 1,
        price: 14200,
        fabric: 'Raw Silk Dupion',
        trim: 'Pearl Buttons',
        stage: 'Dispatched',
        stageEnteredAt: daysAgo(6),
        qtyDispatched: 1,
        notes: '',
        createdAt: daysAgo(40)
      },
      {
        id: uid(),
        poId: '',
        styleCode: 'CW-GW-002',
        styleName: 'Maroon Velvet Gown',
        category: 'Cocktail Wear',
        subCategory: 'Gown',
        color: 'Maroon',
        size: 'S',
        quantity: 1,
        price: 17500,
        fabric: 'Banarasi Silk',
        trim: 'Pearl Buttons',
        stage: 'Dispatched',
        stageEnteredAt: daysAgo(4),
        qtyDispatched: 1,
        notes: '',
        createdAt: daysAgo(40)
      }
    ]
  }

  db.purchaseOrders[1].retailerId = db.retailers[0].id

  const poStyles = [
    [0, 1],
    [2],
    [3, 4, 5, 6, 7]
  ]
  poStyles.forEach((styleIdx, poIdx) => {
    styleIdx.forEach((s) => {
      db.styles[s].poId = db.purchaseOrders[poIdx].id
    })
  })

  return db
}

function normalize(db) {
  if (!Array.isArray(db.auditLog)) db.auditLog = []
  db.styles.forEach((s) => {
    if (s.color === undefined) s.color = ''
    if (s.size === undefined) s.size = ''
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
    if (r.styleCode === undefined) r.styleCode = ''
    if (r.color === undefined) r.color = ''
    if (r.size === undefined) r.size = ''
    if (r.receivedStock === undefined) r.receivedStock = 0
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
