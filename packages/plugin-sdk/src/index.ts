/**
 * @astrbot/plugin-sdk 入口
 * 类型（HostApi/PluginManifest 等）与运行时辅助（definePlugin/常量）。
 * 由 tsc（tsconfig.sdk.json）编译到 dist/ 发布，勿手改 dist。
 */

export {
  PLUGIN_API_VERSION,
  PLUGIN_DEFAULT_PERMISSIONS,
  PLUGIN_PERMISSION_VALID_VALUES,
  PLUGIN_EVENT_VALID_VALUES
} from '../../../src/shared/pluginManifest'
export type {
  PluginManifest,
  PluginPermission,
  PluginEventKind,
  PluginSettingKind,
  PluginSettingsSchema,
  PluginTrayMenuItem,
  PluginRuntimeStatus,
  PluginInfo,
  PluginEntrypoint,
  PluginHostRpcCall,
  PluginHostRpcResult,
  PluginHostEventPush,
  PluginLifecycleCommand
} from '../../../src/shared/pluginManifest'
export { PLUGIN_ID_PATTERN, definePlugin } from '../../../src/shared/pluginSdk'
export type { HostApi } from '../../../src/shared/pluginSdk'
