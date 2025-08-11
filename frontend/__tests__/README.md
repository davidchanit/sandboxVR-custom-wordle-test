# Frontend Testing Guide

This directory contains comprehensive tests for the frontend multiplayer Wordle application.

## Test Structure

```
__tests__/
├── multiplayer/
│   ├── basic.test.tsx          # Basic multiplayer functionality tests
│   ├── simple.test.tsx         # Simple multiplayer tests
│   └── functionality.test.tsx  # Comprehensive functionality tests
├── styles/
│   ├── test.ts                 # Main page CSS module tests
│   └── multiplayer.test.ts     # Multiplayer CSS module tests
├── setup/
│   └── types.ts                # TypeScript interfaces for testing
├── utils/
│   └── test-utils.tsx          # Custom test utilities
├── page.test.tsx               # Main page component tests
└── README.md                   # This file
```

## Running Tests

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Tests for CI
```bash
npm run test:ci
```

## Test Coverage

The tests cover:

- **Component Rendering**: All UI components render correctly
- **User Interactions**: Button clicks, form inputs, keyboard events
- **State Management**: Component state changes and updates
- **Socket Communication**: WebSocket event handling and emission
- **Error Handling**: Server errors and connection issues
- **Responsiveness**: UI updates based on game state changes
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **CSS Modules**: Style class exports and naming

## Key Test Areas

### 1. Multiplayer Functionality
- Room creation and joining
- Player management and identification
- Game state transitions
- Ready for next round functionality

### 2. User Experience
- Form validation
- Error messages
- Loading states
- Connection status

### 3. Game Mechanics
- Guess submission
- Virtual keyboard
- Player boards
- Score tracking

### 4. Error Scenarios
- Network disconnections
- Server errors
- Invalid inputs
- Reconnection handling

## Mocking Strategy

- **Socket.io**: Mocked for testing WebSocket communication
- **Next.js Router**: Mocked for navigation testing
- **Local Storage**: Mocked for persistence testing
- **Console Methods**: Mocked to reduce test noise

## Writing New Tests

1. Create test files in the appropriate directory
2. Use descriptive test names
3. Mock external dependencies
4. Test both success and error scenarios
5. Ensure proper cleanup in `beforeEach`/`afterEach`

## Example Test Structure

```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup mocks and test data
  })

  test('should render correctly', () => {
    // Test rendering
  })

  test('should handle user interactions', async () => {
    // Test user events
  })

  test('should handle errors gracefully', () => {
    // Test error scenarios
  })
})
```

## Troubleshooting

### Common Issues
- **TypeScript Errors**: Ensure `@types/jest` is installed
- **Module Resolution**: Check Jest configuration paths
- **Mock Failures**: Verify mock setup in `jest.setup.ts`
- **Async Issues**: Use `waitFor` for asynchronous operations

### Debug Mode
```bash
npm test -- --verbose
```

### Single Test File
```bash
npm test -- __tests__/multiplayer/basic.test.tsx
``` 