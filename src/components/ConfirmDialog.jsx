import React, { useCallback, useRef, useState } from 'react'
import { Modal, Btn } from './ui.jsx'

/**
 * useConfirm() -> { confirm, node }
 *   confirm({ title, message, tone }) returns a Promise<boolean>.
 *   Render {node} inside the view; it shows an in-app dialog styled like
 *   the rest of the app instead of a native window.confirm().
 */
export function useConfirm() {
  const [state, setState] = useState(null)
  const resolveRef = useRef(null)

  const confirm = useCallback((opts = {}) => {
    setState(opts)
    return new Promise((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const close = useCallback((result) => {
    setState(null)
    resolveRef.current?.(result)
    resolveRef.current = null
  }, [])

  const node = state ? (
    <Modal open title={state.title || 'Please confirm'} onClose={() => close(false)} wide={false}>
      <div className="modal-sm-body">
        <p className="confirm-msg">{state.message || 'Are you sure?'}</p>
        <div className="modal-foot">
          <Btn tone="ghost" onClick={() => close(false)}>
            Cancel
          </Btn>
          <Btn tone={state.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)}>
            {state.confirmLabel || 'Confirm'}
          </Btn>
        </div>
      </div>
    </Modal>
  ) : null

  return { confirm, node }
}
