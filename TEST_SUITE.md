# Test Suite Documentation

## Overview
Comprehensive test suite for The Premier League Oracle application using Vitest.

## Test Structure

### Unit Tests
- **`src/services/betting/kelly.test.ts`** - Kelly Criterion calculator tests
- **`src/services/dataService.test.ts`** - Data service layer tests  
- **`src/types/types.test.ts`** - Type validation tests
- **`src/services/api/footballData.test.ts`** - Football Data API tests

### Component Tests
- **`src/components/Dashboard.test.ts`** - Dashboard component tests

## Running Tests

```bash
# Run all tests
npm test

# Run tests once
npm run test:run

# Run tests with coverage
npm run test:coverage

# Open test UI
npm run test:ui

# Watch mode for development
npm run test:watch
```

## Coverage Goals

- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

## Test Configuration

Tests are configured in `vitest.config.ts` with:
- **Environment**: jsdom for DOM testing
- **Coverage Provider**: V8
- **Setup File**: `src/tests/setup.ts` for global mocks

## Mocking Strategy

### Global Mocks
- IndexedDB for browser storage
- localStorage for settings
- fetch for API calls
- Chart.js for chart rendering

### Service Mocks
- dataService for component tests
- Supabase client for integration tests
- Football Data API for unit tests

## Writing New Tests

1. Create test file next to source: `Component.test.ts`
2. Import test utilities: `import { describe, it, expect } from 'vitest'`
3. Mock dependencies at top of file
4. Group related tests with `describe`
5. Use clear test names describing behaviour

## Known Issues

Some tests currently fail due to:
1. Missing method implementations (detectArbitrage, calculateRequiredWinRate)
2. Export differences between test expectations and actual implementation
3. These can be fixed by updating either tests or implementation

## Future Improvements

- [ ] Add E2E tests with Playwright
- [ ] Add performance benchmarks
- [ ] Add visual regression tests
- [ ] Increase coverage to 90%+
- [ ] Add mutation testing