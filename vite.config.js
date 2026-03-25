import { fileURLToPath, URL } from 'node:url'

import { loadEnv, defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { mockDevServerPlugin } from 'vite-plugin-mock-dev-server'

function forceElementPlusLayer () {
  const targetPackages = [
    '/node_modules/element-plus/',
    '/node_modules/vue-element-plus-x/',
  ]

  return {
    name: 'force-element-plus-layer',
    enforce: 'pre',
    transform (code, id) {
      const cleanId = id.split('?', 1)[0].replace(/\\/g, '/')
      if (!cleanId.endsWith('.css')) return null

      const isTargetCss = targetPackages.some((pkgPath) => cleanId.includes(pkgPath))
      if (!isTargetCss) return null

      return {
        code: `@layer element-plus {\n${code}\n}`,
        map: null,
      }
    },
  }
}
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    plugins: [
      forceElementPlusLayer(),
      vue(),
      Components({
        dts: './components.d.ts',
        globs: ['!src/components/**/*.vue'],
        resolvers: [
          ElementPlusResolver(),
          IconsResolver({
            enabledCollections: ['ep']
          })
        ],
      }),
      AutoImport({
        dts: './auto-imports.d.ts',
        ignore: ['src/components/**'],
        resolvers: [ElementPlusResolver()],
        imports: ['vue', 'vue-router', 'pinia'],
        eslintrc: {
          enabled: false,
          filepath: './.eslintrc-auto-import.json',
        },
      }),
      Icons({
        autoInstall: true
      }),
      tailwindcss(),
      vueDevTools(),
      mockDevServerPlugin(),
    ],
    esbuild: {
      drop: ['console', 'debugger'],
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '0.0.0.0', // 绑定到所有网络地址
      port: +env.VITE_APP_PORT,
      proxy: {
        // 代理 /dev-api 的请求
        [env.VITE_API_BASE_URL]: {
          target: env.VITE_APP_API_URL,
          // 修改代理服务器Origin为目标服务器target
          changeOrigin: true,
        },
      },
    },
  }
})



