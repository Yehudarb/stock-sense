import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

// ESLint 9 flat config. There was no config file at all — `npm run lint` failed
// on every invocation, which is why nothing in this project was ever linted.
//
// Deliberately dependency-free: @eslint/js and globals are already present as
// transitive dependencies of eslint itself, so this adds nothing to install.
// The React plugins are not used; they would be a new dependency on every
// production build for rules that overlap what the recommended set already
// catches here.
//
// Scope is real defects — undefined identifiers, unused bindings, unreachable
// code, accidental assignment in conditionals. Style is left alone: a
// formatting sweep across a codebase this size would bury the findings that
// matter under thousands that do not.
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Three bugs in this codebase were exactly this: an effect that read
      // state it did not depend on. The chart kept a stale visible range when
      // the interval changed, redrew nothing after a rebuild, and selected gaps
      // against the wrong window. All three were missing dependencies, and this
      // rule reports them. It is a warning rather than an error so the existing
      // deliberate exceptions do not fail the build.
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      // JSX components are referenced by the compiler, not by name at runtime,
      // so the base no-unused-vars cannot see them. Capitalised identifiers are
      // exempted rather than switching the rule off entirely.
      'no-unused-vars': ['warn', {
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      // An empty catch is how this codebase deliberately ignores failures it
      // has already accounted for (chart series removal, storage reads).
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'off',
    },
  },
]
