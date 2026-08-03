// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    // Constructing a service under test with `new Service({...} as any, ...)`
    // for each DI dependency is the standard NestJS unit-test pattern here
    // (see any *.spec.ts) — the alternative is fully typing every mock's
    // every method for ~90 constructor calls across the suite, for zero
    // real safety gain (these are compile-time-only casts on test doubles,
    // never a genuine runtime "unsafe" value). Relaxed for spec files only;
    // production code still gets the strict version.
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
);
