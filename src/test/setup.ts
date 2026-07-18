import "@testing-library/jest-dom";

// jsdom niceties used across the app.
Object.defineProperty(window, "matchMedia", {
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

if (!("ResizeObserver" in window)) {
  // @ts-expect-error polyfill for Radix components under jsdom
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Silence noisy console.error from expected React warnings inside tests.
const origError = console.error;
console.error = (...args: unknown[]) => {
  const msg = String(args[0] ?? "");
  if (msg.includes("Not implemented: HTMLCanvasElement")) return;
  origError(...(args as [unknown]));
};