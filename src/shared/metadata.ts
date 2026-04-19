import packageJson from '../../package.json'

function parseAuthorName(author: string): string {
  const [name] = author.split('<')
  return name.trim()
}

const localStorageMetadata = packageJson.desktopMetadata.storage.local

export const APP_METADATA = {
  packageName: packageJson.name,
  displayName: packageJson.build.productName,
  version: packageJson.version,
  description: packageJson.description,
  appId: packageJson.build.appId,
  authorName: parseAuthorName(packageJson.author),
  repositoryUrl: packageJson.desktopMetadata.links.repository,
} as const

export const APP_LINKS = {
  astrbot: packageJson.desktopMetadata.links.astrbot,
  repository: APP_METADATA.repositoryUrl,
  adapterPlugin: packageJson.desktopMetadata.links.adapterPlugin,
} as const

export const PROTOCOL_VERSION = packageJson.desktopMetadata.protocol.version

export const LOCAL_STORAGE_METADATA = {
  advancedSettings: localStorageMetadata.advancedSettings,
  connectionSettings: localStorageMetadata.connectionSettings,
  modelPositions: localStorageMetadata.modelPositions,
  modelScales: localStorageMetadata.modelScales,
  themeState: localStorageMetadata.themeState,
  lastModelPath: localStorageMetadata.lastModelPath,
} as const

export const USER_CONFIG_KEYS = packageJson.desktopMetadata.storage.userConfig

export const SETTINGS_PRESERVED_LOCAL_STORAGE_KEYS = [
  LOCAL_STORAGE_METADATA.lastModelPath.key,
  LOCAL_STORAGE_METADATA.advancedSettings.key,
  LOCAL_STORAGE_METADATA.themeState.key,
] as const
