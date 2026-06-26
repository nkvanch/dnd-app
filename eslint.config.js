// eslint.config.js
// Flat-config ESLint setup for the Grimoire D&D app (React Native + Expo + TS).
//
// Focus: catch the mechanical issues a human reviewer misses by eye —
//   • unused variables / imports
//   • floating (un-awaited / un-handled) promises  <- high-value here
//   • React hook dependency mistakes
//
// Type-aware rules need the TS project, so they are scoped ONLY to .ts/.tsx
// files that tsconfig.json actually includes. Loose scripts (.mjs/.js, the
// scripts/ folder) are ignored so the type-aware parser never trips on a file
// outside the project (which throws, as it did on scripts/convert-spells.mjs).

const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = tseslint.config(
  // 1. Global ignores — anything not part of the typed app source.
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'scripts/**',     // loose .mjs build/convert scripts, not in tsconfig
      '**/*.mjs',
      '**/*.cjs',
      '**/*.js',        // config files, etc. — only lint TS/TSX
    ],
  },

  // 2. Base JS recommendations (untyped, safe everywhere that survives ignores).
  js.configs.recommended,

  // 3. Typed linting — scoped to project TS/TSX only.
  ...tseslint.configs.recommendedTypeChecked.map(cfg => ({
    ...cfg,
    files: ['**/*.{ts,tsx}'],
  })),

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // -- react hooks --
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // -- promises (the big one for this codebase) --
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // -- unused code --
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],

      // -- pragmatic loosenings for an app already written in this style --
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-base-to-string': 'off',

      // Keep these as real signal.
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      'no-console': 'off',
    },
  },
);
