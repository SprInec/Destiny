module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended'
  ],
  settings: { react: { version: 'detect' } },
  env: { browser: true, es2022: true },
  ignorePatterns: ['dist']
}

