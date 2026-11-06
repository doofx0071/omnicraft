import { describe, expect, it } from 'vitest'
import { formatInstallCommand, getNativePackageManager } from './pkg-manager.js'

describe('getNativePackageManager', () => {
  it('prints the native install command for each supported package manager', () => {
    expect(formatInstallCommand('npm')).toBe('npm install')
    expect(formatInstallCommand('pnpm')).toBe('pnpm install')
    expect(formatInstallCommand('yarn')).toBe('yarn')
    expect(formatInstallCommand('bun')).toBe('bun install')
  })

  it('keeps Expo on the caller package manager and pins Tauri to npm', () => {
    expect(getNativePackageManager('mobile', 'pnpm')).toBe('pnpm')
    expect(getNativePackageManager('desktop', 'bun')).toBe('npm')
  })
})
