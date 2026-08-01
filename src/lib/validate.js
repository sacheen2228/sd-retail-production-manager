export function required(v, label = 'This field') {
  const s = String(v ?? '').trim()
  return s ? '' : `${label} is required`
}

export function min(v, n, label) {
  const num = Number(v)
  if (Number.isNaN(num)) return `${label} must be a number`
  return num >= n ? '' : `${label} must be ${n} or more`
}

export function notAfter(from, to, label = 'Delivery date') {
  if (!from || !to) return ''
  return String(to) >= String(from) ? '' : `${label} cannot be before the order date`
}

export function validatePurchaseOrder(e) {
  const errors = []
  errors.push(required(e.poNumber, 'PO number'))
  if (!e.retailerId && !e.retailerIsNew) errors.push('Select a retailer')
  errors.push(min(e.orderDate ? 1 : 0, 1, 'Order date'))
  errors.push(required(e.deliveryDate, 'Delivery date'))
  errors.push(notAfter(e.orderDate, e.deliveryDate))
  if (!e.lineItems || !e.lineItems.some((l) => String(l.styleCode || '').trim())) {
    errors.push('Add at least one style line with a style code')
  }
  return errors.filter(Boolean)
}

export function validateStyle(e) {
  const errors = []
  errors.push(required(e.styleCode, 'Style code'))
  errors.push(min(e.quantity, 1, 'Quantity'))
  return errors.filter(Boolean)
}

export function validateStockItem(e) {
  const errors = []
  errors.push(required(e.name, 'Item name'))
  errors.push(required(e.styleCode, 'Style code'))
  errors.push(min(e.quantity, 0, 'Quantity'))
  errors.push(min(e.costPrice, 0, 'Cost price'))
  errors.push(min(e.sellingPrice, 0, 'Selling price'))
  return errors.filter(Boolean)
}

export function validatePartner(type, e) {
  const errors = []
  if (type === 'retailer' || type === 'vendor' || type === 'fabric') {
    errors.push(required(e.name, 'Name'))
  }
  if (type === 'fabric') errors.push(min(e.stock, 0, 'Stock'))
  return errors.filter(Boolean)
}

export function firstError(errors) {
  return errors.length ? errors[0] : ''
}
