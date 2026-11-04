import { unwrap } from './cancel.js'

/** The subset of clack's `confirm` the install decisions use. */
export type ConfirmPrompt = (
  opts: { message: string; initialValue?: boolean },
) => Promise<boolean | symbol>

/**
 * Resolves an install decision: `--yes` accepts the default (install now)
 * without prompting, otherwise the user decides and a cancellation unwinds as
 * a CancelledError via unwrap.
 *
 * Every install confirm must go through this helper: a non-TTY run without
 * `--yes` is refused upstream, so any confirm a non-TTY run with `--yes` can
 * still reach would wait for keypresses that never arrive — an infinite hang
 * in the advertised CI mode.
 */
export async function confirmOrYes(
  yes: boolean,
  message: string,
  confirm: ConfirmPrompt,
): Promise<boolean> {
  if (yes) return true
  return unwrap(await confirm({ message, initialValue: true }))
}
