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
    styles: [],
    profiles: [],
    audit_log: []
  }

  function chain(table) {
    let filters = []
    let limit = null

    // Builds a thenable whose result is derived from the current filters/limit.
    function queryable(resultFn, mutators) {
      const t = makeThenable(() => resultFn())
      t.eq = (key, val) => {
        filters = filters.concat({ key, val })
        return t
      }
      t.neq = (key, val) => {
        filters = filters.concat({ key, val, negate: true })
        return t
      }
      t.gte = (key, val) => {
        filters = filters.concat({ key, val, op: 'gte' })
        return t
      }
      t.order = () => t
      t.limit = (n) => {
        limit = n
        return t
      }
      t.maybeSingle = () => makeThenable(() => resolveSingle())
      t.single = () => makeThenable(() => resolveSingle())
      mutators && Object.assign(t, mutators(t))
      return t
    }

    function matchesRow(row) {
      return filters.every((f) => {
        if (f.negate) return row[f.key] !== f.val
        if (f.op === 'gte') return row[f.key] >= f.val
        return row[f.key] === f.val
      })
    }

    function resolveRows() {
      let rows = tables[table].filter(matchesRow)
      if (limit != null) rows = rows.slice(0, limit)
      return Promise.resolve({ data: rows, error: null })
    }

    function resolveSingle() {
      const rows = tables[table].filter(matchesRow)
      if (rows.length > 1) {
        return Promise.resolve({ data: rows[0], error: new Error('multiple rows returned for single()') })
      }
      return Promise.resolve({ data: rows[0] || null, error: null })
    }

    return {
      select() {
        return queryable(resolveRows)
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
        return queryable(() => {
          const rows = tables[table].filter(matchesRow)
          rows.forEach((r) => {
            const idx = tables[table].indexOf(r)
            if (idx !== -1) tables[table].splice(idx, 1)
          })
          return Promise.resolve({ data: null, error: null })
        })
      }
    }
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
