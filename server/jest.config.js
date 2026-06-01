module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/../automated-unit-tests/server'],
  testMatch: ['<rootDir>/../automated-unit-tests/server/**/*.test.js'],
  moduleDirectories: ['node_modules', '<rootDir>/node_modules'],
};
