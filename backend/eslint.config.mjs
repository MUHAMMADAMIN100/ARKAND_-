import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'prisma/**', 'coverage/**', 'eslint.config.mjs'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'common', pattern: 'src/common/*' },
        { type: 'config', pattern: 'src/config/*' },
        { type: 'module', pattern: 'src/modules/*', capture: ['moduleName'] },
        { type: 'root', pattern: 'src/*.ts', mode: 'file' },
      ],
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-extraneous-class': 'off',
      // Границы: домен НЕ импортирует внутренности другого домена.
      // Общение между доменами — только через экспортируемые *.facade/*.service из barrel.
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'root', allow: ['module', 'common', 'config'] },
            { from: 'config', allow: ['common', 'config'] },
            { from: 'common', allow: ['common', 'config'] },
            {
              from: 'module',
              allow: [
                'common',
                'config',
                // модуль может импортировать фасады других модулей (файлы *.facade.ts)
                ['module', { moduleName: '*' }],
              ],
            },
          ],
        },
      ],
    },
  },
);
