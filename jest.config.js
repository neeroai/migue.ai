/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: '@edge-runtime/jest-environment',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // ESM support
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ES2022',
          moduleResolution: 'bundler',
        },
      },
    ],
  },

  // Test patterns
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.ts',
    '<rootDir>/tests/integration/**/*.test.ts',
    '<rootDir>/tests/gemini/**/*.test.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/.vercel/'],

  // Coverage
  collectCoverageFrom: [
    'src/**/*.ts',
    'app/**/*.ts',
    'api/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Note: Coverage disabled for Edge Runtime (doesn't support code generation)
  // coverageThreshold: {
  //   global: { branches: 60, functions: 60, lines: 60, statements: 60 },
  //   './lib/': { branches: 80, functions: 80, lines: 80, statements: 80 },
  // },

  // Performance
  maxWorkers: '50%',
  testTimeout: 10000,

  // Output
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
};
