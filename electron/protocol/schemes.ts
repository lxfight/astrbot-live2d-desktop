import { protocol } from 'electron'

/**
 * 集中注册所有自定义协议的 Privileges
 * 此方法必须在 app.whenReady() 之前调用，且全应用只能调用一次
 */
export function registerAllSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'cubism',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
    {
      scheme: 'model',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])
}
