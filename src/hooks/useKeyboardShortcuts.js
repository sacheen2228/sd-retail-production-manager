import { useEffect } from 'react'

export function useKeyboardShortcuts(bindings) {
  useEffect(() => {
    function onKey(e) {
      const target = e.target
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      for (const [combo, handler] of Object.entries(bindings)) {
        const keys = combo.toLowerCase().split('+')
        const match = keys.every((k) => {
          if (k === 'ctrl' || k === 'control') return e.ctrlKey
          if (k === 'meta' || k === 'cmd' || k === 'command') return e.metaKey
          if (k === 'shift') return e.shiftKey
          if (k === 'alt') return e.altKey
          return e.key.toLowerCase() === k
        })
        if (match && keys.length === Object.keys({ ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey, alt: e.altKey }).filter((k) => e[k]).length + 1) {
          e.preventDefault()
          handler(e)
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bindings])
}