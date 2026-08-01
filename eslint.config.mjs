import js from '@eslint/js'
import ts from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  eslintConfigPrettier,
  {
    files: ['**/*.{ts,tsx,vue}'],
    languageOptions: {
      parserOptions: {
        parser: '@typescript-eslint/parser',
        ecmaVersion: 2020,
        sourceType: 'module',
        extraFileExtensions: ['.vue']
      }
    },
    rules: {
      // TypeScript 规则
      '@typescript-eslint/no-explicit-any': 'off', // 关闭 any 类型警告（225个）
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off', // 关闭非空断言警告（61个）
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off', // 允许使用 Function 类型

      // Vue 规则
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off', // 关闭（2个）
      'vue/require-default-prop': 'off',
      'vue/require-prop-types': 'off',
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/custom-event-name-casing': 'off',
      'vue/define-emits-declaration': ['error', 'type-based'],
      'vue/define-props-declaration': ['error', 'type-based'],
      'vue/html-self-closing': 'off',
      'vue/require-toggle-inside-transition': 'off', // 关闭（1个）
      'vue/max-attributes-per-line': 'off', // 关闭

      // 通用规则
      'no-console': 'off', // 完全关闭（135个）
      'no-debugger': 'warn',
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-unused-expressions': 'warn',
      'no-undef': 'off',
      'no-empty': 'off', // 关闭（9个）
      'no-control-regex': 'off', // 关闭（2个）
      'no-useless-escape': 'off', // 关闭（2个）
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off'
    }
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module'
    }
  },
  {
    files: ['scripts/**/*.js', 'scripts/**/*.mjs'],
    rules: {
      'no-console': 'off'
    }
  },
  {
    ignores: [
      'dist',
      'dist-electron',
      'release',
      'node_modules',
      '.generated',
      'public/lib',
      'coverage',
      'scripts',
      '*.min.js',
      '*.config.ts',
      '*.config.mjs'
    ]
  }
]
