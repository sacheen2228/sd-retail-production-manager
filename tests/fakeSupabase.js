// In-memory fake of the Supabase query builder used by src/api.js.
// Tables are stored keyed by the real table names (snake_case).

const FIXED = { created_at: new Date().toISOString() }

function makeThenable(fn) {
  return {
    then(resolve, reject) {
      return fn().then(resolve, reject)
    },
    catch(reject) {
      return fn().then((v) => v, reject)
    }
  }
}

export function createFake() {
  const tables = {
    retailers: [],
    vendors: [],
    fabrics: [],
    ready_stock: [],
    purchase_orders: [],
    styles: []
  }

  function chain(table) {
    let filter = null

    function matches(row) {
      return !filter || row[filter.key] === filter.val
    }
    function resolveRows(single) {
      const rows = tables[table].filter(matches)
      if (single && rows.length > 1) {
        return Promise.resolve({ data: rows[0], error: new Error('multiple rows returned for single()') })
      }
      return Promise.resolve({ data: single ? rows[0] || null : rows, error: null })
    }

    const ops = {
      select() {
        const t = makeThenable(() => resolveRows(false))
        t.eq = (key, val) => {
          filter = { key, val }
          return t
        }
        t.maybeSingle = () => makeThenable(() => resolveRows(true))
        t.single = () => makeThenable(() => resolveRows(true))
        return t
      },
      insert(obj) {
        const row = { id: crypto.randomUUID(), ...FIXED, ...obj }
        tables[table].push(row)
        return { select: () => ({ single: () => Promise.resolve({ data: row, error: null }) }) }
      },
      update(obj) {
        return {
          eq(key, val) {
            return {
              select() {
                return {
                  single() {
                    const row = tables[table].find((r) => r[key] === val)
                    if (!row) return Promise.resolve({ data: null, error: new Error('Not found') })
                    Object.assign(row, obj)
                    return Promise.resolve({ data: row, error: null })
                  }
                }
              }
            }
          }
        }
      },
      delete() {
        return {
          eq(key, val) {
            return makeThenable(() => {
              const idx = tables[table].findIndex((r) => r[key] === val)
              if (idx !== -1) tables[table].splice(idx, 1)
              return Promise.resolve({ data: null, error: null })
            })
          }
        }
      }
    }
    return ops
  }

  const fake = {
    from(table) {
      return chain(table)
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null })
    },
    _tables: tables,
    _seed(table, rows) {
      tables[table].push(...rows.map((r) => ({ id: crypto.randomUUID(), ...FIXED, ...r })))
      return fake
    }
  }
  return fake
}
