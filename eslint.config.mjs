import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      'package-lock.json',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
  {
    files: ['frontend/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@ogulix/shared/server',
              message: 'Server-only module; import browser-safe contracts from @ogulix/shared.',
            },
            {
              name: '@prisma/client',
              message: 'Prisma belongs to the API/worker, not the frontend bundle.',
            },
            {
              name: 'argon2',
              message: 'Password hashing belongs to the API, not the frontend bundle.',
            },
            {
              name: 'bullmq',
              message: 'Queue access belongs to the API/worker, not the frontend bundle.',
            },
          ],
          patterns: [
            {
              group: ['@ogulix/shared/server/*'],
              message: 'Server-only module; import browser-safe contracts from @ogulix/shared.',
            },
            {
              group: [
                'node:crypto',
                'node:fs',
                'node:fs/promises',
                'node:child_process',
                'node:net',
                'node:tls',
                'node:dns',
                'node:dns/promises',
              ],
              message: 'Node-only module; the frontend must not import server code.',
            },
            {
              group: ['@prisma/*', 'ioredis', 'mariadb'],
              message: 'Server-only dependency; the frontend must not import it.',
            },
          ],
        },
      ],
    },
  },
);
