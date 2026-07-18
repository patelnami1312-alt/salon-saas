import type { AxeResults } from 'axe-core';

declare module 'vitest-axe/matchers' {
  export function toHaveNoViolations(this: unknown, results: AxeResults): { pass: boolean; message: () => string };
}

declare module 'vitest' {
  interface Assertion {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
