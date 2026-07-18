import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { toHaveNoViolations } from 'vitest-axe/matchers';

// Register vitest-axe matcher explicitly (extend-expect is a no-op in this version)
expect.extend({ toHaveNoViolations });

// Fix: RTK Query calls `new Request(url, { signal: jsdomSignal })`.
// MSW patches globalThis.Request with a Proxy, which forwards to undici's Request
// constructor — and undici rejects jsdom's AbortSignal (different class instance).
// Workaround: replace globalThis.Request with a subclass that drops the signal
// BEFORE server.listen() wraps it. Tests don't need request cancellation.
const _OriginalRequest = globalThis.Request;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).Request = class NoSignalRequest extends _OriginalRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (init?.signal !== undefined) {
      const { signal: _dropped, ...rest } = init;
      super(input, rest);
    } else {
      super(input, init);
    }
  }
};

// Also strip signal from globalThis.fetch so it never reaches undici
const _nativeFetch = globalThis.fetch;
globalThis.fetch = (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  if (init?.signal !== undefined) {
    const { signal: _s, ...rest } = init;
    return _nativeFetch(input as RequestInfo, rest);
  }
  return _nativeFetch(input as RequestInfo, init);
};

import { server } from './msw-server';

// MSW server lifecycle — must start AFTER the Request/fetch patches above
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ResizeObserver is not available in jsdom — MUI Charts + DataGrid need it
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

// matchMedia is not available in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
