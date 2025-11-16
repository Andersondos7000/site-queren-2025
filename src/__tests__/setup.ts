import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import 'fake-indexeddb/auto';

// Polyfills for Node.js environment
Object.assign(global, { TextDecoder, TextEncoder });

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
});

// Mock BroadcastChannel
global.BroadcastChannel = jest.fn().mockImplementation(() => ({
  postMessage: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  close: jest.fn(),
}));

// Mock Navigator API
Object.defineProperty(navigator, 'connection', {
  writable: true,
  value: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 50,
    saveData: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }
});

// Mock online/offline events
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
  }
});

// Mock crypto API for UUID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substring(2, 11)),
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    })
  }
});

// Mock URL.createObjectURL
Object.defineProperty(URL, 'createObjectURL', {
  value: jest.fn(() => 'mock-object-url')
});

// Mock URL.revokeObjectURL
Object.defineProperty(URL, 'revokeObjectURL', {
  value: jest.fn()
});

// Mock fetch for tests that need it
global.fetch = jest.fn();

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}));

// Console warnings/errors that should fail tests
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args) => {
  originalError(...args);
  // Fail tests on React warnings/errors
  if (typeof args[0] === 'string' && args[0].includes('Warning:')) {
    throw new Error(`Console error: ${args[0]}`);
  }
};

console.warn = (...args) => {
  originalWarn(...args);
  // Optionally fail on warnings too
  if (process.env.FAIL_ON_CONSOLE_WARN === 'true') {
    throw new Error(`Console warning: ${args[0]}`);
  }
};

// Cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Clear localStorage
  localStorageMock.clear();
  sessionStorageMock.clear();
  
  // Clear timers
  jest.clearAllTimers();
  
  // Reset modules
  jest.resetModules();
});

// Global test utilities
global.testUtils = {
  // Helper to wait for async operations
  waitFor: (ms: number = 0) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to create mock functions with specific return values
  createMockFn: <T>(returnValue?: T) => jest.fn().mockReturnValue(returnValue),
  
  // Helper to create async mock functions
  createAsyncMockFn: <T>(returnValue?: T) => jest.fn().mockResolvedValue(returnValue),
  
  // Helper to simulate network conditions
  simulateNetworkCondition: (condition: 'online' | 'offline' | 'slow') => {
    switch (condition) {
      case 'offline':
        Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
        Object.defineProperty(navigator, 'connection', {
          value: {
            effectiveType: 'slow-2g',
            downlink: 0,
            rtt: 0,
            saveData: true
          },
          writable: true
        });
        break;
      case 'slow':
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
        Object.defineProperty(navigator, 'connection', {
          value: {
            effectiveType: 'slow-2g',
            downlink: 0.5,
            rtt: 2000,
            saveData: true
          },
          writable: true
        });
        break;
      case 'online':
      default:
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
        Object.defineProperty(navigator, 'connection', {
          value: {
            effectiveType: '4g',
            downlink: 10,
            rtt: 50,
            saveData: false
          },
          writable: true
        });
        break;
    }
  }
};

// Type declarations for global test utilities
declare global {
  var testUtils: {
    waitFor: (ms?: number) => Promise<void>;
    createMockFn: <T>(returnValue?: T) => jest.MockedFunction<() => T>;
    createAsyncMockFn: <T>(returnValue?: T) => jest.MockedFunction<() => Promise<T>>;
    simulateNetworkCondition: (condition: 'online' | 'offline' | 'slow') => void;
  };
}