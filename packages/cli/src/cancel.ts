import { isCancel } from '@clack/prompts'

/** Thrown when the user aborts a prompt (Ctrl+C or Esc) or declines to proceed. */
export class CancelledError extends Error {
  constructor(message = 'Scaffold cancelled.') {
    super(message)
    this.name = 'CancelledError'
  }
}

/**
 * Unwraps a clack prompt result, converting a cancellation symbol into a
 * thrown CancelledError so the whole flow unwinds from one catch site.
 */
export function unwrap<T>(value: T | symbol): T {
  if (isCancel(value)) throw new CancelledError()
  return value as T
}
