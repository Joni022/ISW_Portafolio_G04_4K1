import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/**', 'prototipo/assets/**'] },
  js.configs.recommended,
  prettier,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-eval': 'error',
      'no-new-wrappers': 'error',
      'no-nested-ternary': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.js', 'test/**/*.js', 'prototipo/serveLocal.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['prototipo/**/*.js'],
    ignores: ['prototipo/serveLocal.js'],
    languageOptions: { globals: globals.browser },
  },
];
