import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastCtx = createContext(null)

let seed = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const push = useCallback(
    (message, tone = 'info', opts = {}) => {
      const id = ++seed
      const toast = { id, message, tone, ...opts }
      setToasts((t) => [...t, toast])
      if (!opts.undo) {
        timers.current[id] = setTimeout(() => dismiss(id), tone === 'danger' ? 6000 : 3500)
      }
    },
    [dismiss]
  )

  return (
    <ToastCtx.Provider value={{ push, dismiss }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone} ${t.undo ? 'toast-undo' : ''}`} onClick={() => !t.undo && dismiss(t.id)}>
            <span>{t.message}</span>
            {t.undo && (
              <button className="toast-undo-btn" onClick={(e) => { e.stopPropagation(); t.onUndo(); dismiss(t.id) }}>
                Undo
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}