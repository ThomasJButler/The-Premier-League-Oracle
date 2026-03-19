import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import globals from 'globals';

export default [
  // Global ignores
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.svelte-kit/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  // Base JS/TS recommended rules
  js.configs.recommended,

  // TypeScript recommended (type-aware rules disabled to avoid requiring tsconfig in ESLint)
  ...tseslint.configs.recommended,

  // Svelte recommended rules
  ...svelte.configs['flat/recommended'],

  // Global settings for all JS/TS files
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    rules: {
      // Relax rules for existing codebase — focus on catching real bugs
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'off',       // Svelte 4 requires `any` in places
      '@typescript-eslint/no-empty-function': 'off',     // Common in event handler stubs
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-duplicate-case': 'error',
      'no-empty-pattern': 'error',
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'warn',
      'no-unreachable': 'error',
      'no-constant-binary-expression': 'error',
      'prefer-const': 'warn',
    },
  },

  // Svelte file overrides
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      // Svelte-specific relaxations
      'no-undef': 'off',                                  // Svelte reactive declarations
      '@typescript-eslint/no-unused-vars': 'off',         // Svelte template refs often appear unused
      'svelte/no-at-html-tags': 'warn',                   // Flag {@html} usage (XSS risk)
      'svelte/valid-compile': ['error', {
        ignoreWarnings: true,                              // Svelte a11y warnings handled by svelte-check
      }],
      'svelte/require-each-key': 'warn',                  // Best practice but not a runtime bug
      'svelte/require-event-dispatcher-types': 'warn',    // Svelte 4 limitation
      'svelte/no-unused-svelte-ignore': 'warn',           // Informational cleanup
    },
  },

  // shadcn UI components — custom implementations with intentional patterns
  {
    files: ['**/lib/components/ui/**/*.svelte'],
    rules: {
      'svelte/valid-compile': 'off',                      // shadcn overlays intentionally use div click handlers
      'svelte/no-unused-svelte-ignore': 'off',            // May have forward-compat ignores
      'no-useless-assignment': 'off',                     // Focus management patterns in Dialog/Sheet
    },
  },

  // Components using Tailwind @apply in <style> blocks — triggers CSS syntax error in Svelte parser
  {
    files: ['**/components/Help.svelte'],
    rules: {
      'svelte/valid-compile': 'off',                      // @apply is valid Tailwind but not standard CSS
    },
  },

  // Test file overrides
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
