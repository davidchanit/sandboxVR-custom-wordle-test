#!/bin/bash

echo "🧪 Installing Frontend Testing Dependencies..."

# Install Jest and testing libraries
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest jest-environment-jsdom @types/jest

echo "✅ Testing dependencies installed successfully!"
echo ""
echo "📝 Available test commands:"
echo "  npm test              - Run all tests"
echo "  npm run test:watch    - Run tests in watch mode"
echo "  npm run test:coverage - Run tests with coverage"
echo "  npm run test:ci       - Run tests for CI"
echo ""
echo "🚀 You can now run: npm test" 