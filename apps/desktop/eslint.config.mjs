import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import eslintPluginJsxA11y from 'eslint-plugin-jsx-a11y'

export default defineConfig(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/out',
      '**/coverage',
      '**/playwright-report',
      '**/test-results',
      'apps/desktop/tests/visual/__screenshots__'
    ]
  },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh,
      'jsx-a11y': eslintPluginJsxA11y
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules,
      ...eslintPluginJsxA11y.configs.recommended.rules
    }
  },
  /* Playwright fixtures use empty-object destructuring and the `test.use`
     calls trip the React Hooks plugin's `use` heuristic. Scope-disable
     both inside the visual test folder only. */
  {
    files: ['tests/visual/**/*.{ts,tsx}'],
    rules: {
      'no-empty-pattern': 'off',
      'react-hooks/rules-of-hooks': 'off'
    }
  },
  eslintConfigPrettier
)
