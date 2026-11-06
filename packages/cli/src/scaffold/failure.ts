export function formatScaffoldFailure(error: unknown, targetDir: string): string {
  const message = error instanceof Error ? error.message : String(error)
  return `${message}\nPartial scaffold may remain at "${targetDir}". Inspect it and remove incomplete files before retrying.`
}
