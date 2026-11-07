export async function runBusyAction(
  action: () => Promise<void>,
  setBusy: (busy: boolean) => void,
  onError: (cause: unknown) => void,
): Promise<void> {
  setBusy(true);
  try {
    await action();
  } catch (cause) {
    onError(cause);
  } finally {
    setBusy(false);
  }
}
