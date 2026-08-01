// ---------------------------------------------------------------------------
// Role-based permissions for v1.0.
//   admin   — everything, including delete, restore, and role management
//   manager — create & edit records, but cannot delete or manage users
//   viewer  — read-only
// ---------------------------------------------------------------------------

export const ROLES = [
  { id: 'admin', label: 'Admin' },
  { id: 'manager', label: 'Manager' },
  { id: 'viewer', label: 'Viewer' }
]

const RANK = { admin: 3, manager: 2, viewer: 1 }

export function can(role, action) {
  const rank = RANK[role] || 0
  switch (action) {
    case 'view':
      return rank >= 1
    case 'create':
    case 'edit':
      return rank >= 2
    case 'delete':
    case 'manage':
    case 'restore':
      return rank >= 3
    default:
      return false
  }
}

export function roleLabel(role) {
  return (ROLES.find((r) => r.id === role) || {}).label || role || '-'
}
