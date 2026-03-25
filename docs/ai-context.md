# AI 编码上下文（本项目）

最后更新：2026-03-25

## 1. Vite 自动导入与自动注册规则

依据文件：
- `D:\projects\apt_falcon_system_chat\vite.config.js`

当前启用插件与行为：
- `unplugin-auto-import`
  - 自动导入来源：`vue`、`vue-router`、`pinia`
  - 启用 `ElementPlusResolver()`，可自动导入 Element Plus 的 API（例如消息、弹窗类 API）
- `unplugin-vue-components`
  - 启用 `ElementPlusResolver()`，Element Plus 组件可直接在模板中使用
  - 启用 `IconsResolver({ enabledCollections: ['ep'] })`，支持 `ep` 图标组件自动解析
  - `globs: ['!src/components/**/*.vue']`：`src/components` 下的本地组件不会被该插件自动注册
- `unplugin-icons`
  - `autoInstall: true`，图标依赖可按需自动安装

## 2. 编码时的 import 约定

可以默认不手写 import：
- Vue 组合式 API（来自 `vue`）
- 路由相关 API（来自 `vue-router`）
- Pinia API（来自 `pinia`）
- Element Plus 组件与常见 API（由 resolver 自动处理）
- `ep` 图标组件（由 icons resolver 自动处理）

仍然需要手写 import：
- `src/components/**/*.vue` 下的本地组件（因为被显式排除自动注册）
- 项目内自定义工具函数、常量、服务模块
- 非 `ep` 图标集合（除非后续新增对应 resolver 配置）

## 3. 组件与图标使用建议

- Element Plus 组件：可直接在模板中使用（例如 `ElButton`）
- `ep` 图标：按组件方式使用（例如 `i-ep-search` 对应的组件命名形式）
- 本地通用组件：建议继续显式 import，避免“看起来可用但实际未注册”的问题

## 4. 与 AI 协作约定（重要）

当 AI 在本项目生成代码时，应遵循：
- 优先使用已配置的自动导入能力，不重复添加冗余 import
- 遇到 `src/components` 内组件时，默认显式 import
- 新增图标优先使用 `ep` 集合，保持风格一致
- 若新增依赖于其他图标集合或 UI 库，先评估是否补充 vite resolver，再改业务代码

## 5. 变更触发更新

以下场景发生时，需同步更新本文件：
- `vite.config.js` 中 auto-import/components/icons 配置变更
- 新增或移除 UI 库 resolver
- 修改 `src/components` 的自动注册策略
