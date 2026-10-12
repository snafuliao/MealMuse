// @ts-check
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'apps/ios/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // T2 结构化日志：禁止 console，日志一律走 Providers.logger。
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.object.name=/^(logger|log)$/] > TemplateLiteral.arguments',
          message:
            'T2 结构化日志：不要用模板字符串拼日志。修复：把变量放进第一个参数对象，消息保持常量，例如 logger.info({ recipeId }, "recipe created")。',
        },
        {
          selector:
            'CallExpression[callee.object.name=/^(logger|log)$/] > BinaryExpression.arguments[operator="+"]',
          message:
            'T2 结构化日志：不要用 + 拼日志。修复：logger.info({ field }, "constant message")。',
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['apps/admin-web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
