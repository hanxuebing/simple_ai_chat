import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'
import { createRequire } from 'module'

const autoImport = createRequire(import.meta.url)('./.eslintrc-auto-import.json')

export default defineConfig([
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,js,mjs,jsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...autoImport.globals,
      },
    },
  },
  {
    name: 'app/node-config-files',
    files: ['vite.config.js', 'eslint.config.js', '**/vite.config.*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    name: 'app/vue-rules',
    rules: {
      // Vue specific rules
      'vue/multi-word-component-names': 'off',
    }
  },
  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),
  {
    name: 'app/javascript-rules',
    rules: {
      // Basic rules
      'no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'none',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^ignore',
        },
      ],
      'no-debugger': 'warn',
    }
  },

  skipFormatting,
])


