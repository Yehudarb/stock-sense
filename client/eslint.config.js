import eslint from '@eslint/js'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  eslint.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { browser: true, node: true },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-constant-binary-expression': 'off',
      'no-empty': 'off',
    },
  },
]
