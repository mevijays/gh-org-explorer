import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * Node 22+ ships an experimental `localStorage` global that resolves to
 * `undefined` unless the runtime is started with `--localstorage-file`, and it
 * shadows the one jsdom installs. Defining our own keeps behaviour identical on
 * every Node version, and keeping the methods on `Storage.prototype` means
 * `vi.spyOn(Storage.prototype, …)` still works.
 */
class MemoryStorage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }

  setItem(key: string, value: string): void {
    this.store.set(String(key), String(value))
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null
  }
}

Object.defineProperty(globalThis, 'Storage', {
  value: MemoryStorage,
  configurable: true,
  writable: true,
})

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
