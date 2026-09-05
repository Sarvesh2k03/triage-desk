/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    // Process bootstrap: binds a port / exits the process. Exercised by
    // `npm start` and `npm run migrate`, not by unit tests -- asserting on
    // these would test Node, not this codebase. The logic they call
    // (createApp, migrate) is covered directly.
    '!src/index.ts',
    '!src/db/migrate.cli.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: { statements: 95, branches: 93, functions: 95, lines: 95 },
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', target: 'ES2022', strict: true, esModuleInterop: true } }],
  },
};
