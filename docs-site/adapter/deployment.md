# 适配器部署

本文档说明 `astrbot_plugin_live2d_adapter` 的安装、配置、云服务器部署和安全基线。

## 1. 安装

如果你使用 AstrBot Dashboard：

1. 打开插件市场。
2. 搜索并安装 `astrbot_plugin_live2d_adapter`。
3. 在平台配置中启用 `live2d` 适配器。

大多数用户只需要插件市场安装，不需要手动拷贝代码。

## 2. 首次配置

建议先按本机安全模式配置：

```yaml
type: "live2d"
enable: true
id: "live2d_default"

ws_host: "127.0.0.1"
ws_port: 9090
ws_path: "/astrbot/live2d"
auth_token: ""
single_port_mode: true
public_origin: ""

resource_enabled: true
resource_path: "/resources"
resource_dir: "live2d_resources"
temp_dir: "live2d_temp"
resource_base_url: ""
resource_token: ""
```

### `auth_token`

- `auth_token` 现在为强制鉴权。
- 如果留空，插件会自动生成高强度随机密钥，并写入：

```text
data/plugin_data/astrbot-live2d-adapter/live2d_auth_token.txt
```

请把该密钥填到桌面端「设置 -> 连接 -> 认证令牌」。

### 数据目录与本地文件

- 插件受管文件统一落在 `data/plugin_data/astrbot-live2d-adapter/` 下。
- `resource_dir` 默认是 `live2d_resources`，`temp_dir` 默认是 `live2d_temp`；它们都会解析到插件数据目录内。
- 这两个目录不能配置到插件数据目录外，越界的绝对路径会被拒绝。
- 桌面端传入的 `file:///` 图片、语音、文件、视频，会先复制到 `temp_dir` 再进入 AstrBot 流程。
- 适配器下发本地资源时，也会先复制到 `resource_dir`，再通过资源服务暴露；不会直接把原始 `file://` 路径返回给桌面端。

### 独立表演规划 LLM

- 独立表演规划不再放在 `live2d` 平台实例配置里，而是放在插件配置页。
- 配置入口：AstrBot 插件页 -> `Live2D 适配器` -> `planner`。
- 推荐将 `mode` 设为 `provider`，再用 `provider_id` 选择一个单独的对话 Provider。

## 3. 协议升级兼容

- 新版适配器会按客户端声明能力发送增强表情协议，包括 `expression.combo`、`expression.semantic`、`holdMs`、`resetPolicy` 与 `perform.show.interruptible`。
- 未声明能力时会退化为基础单表情协议。
- 桌面端若要启用这些增强字段，需要在 `state.model.capabilities` 中声明 `expressionCombo` / `semanticExpression`，并同步回传 `expressionCatalog`、`semanticPresets`。
- 如果桌面端仍停留在只识别 `expression.id` 的旧协议，只会退化为基础单表情模式，补发表演能力会明显受限。

字段细节见 [协议总览](../protocol/overview.md)、[State Model v2](../protocol/state-model-v2.md) 和 [Perform Show](../protocol/perform-show.md)。

## 4. 云服务器部署

如果桌面端不在同一台机器，需要远程访问，请按下面配置。

### 修改监听地址

将 `ws_host` 改为公网可监听地址，常见为 `0.0.0.0`，并保持 `single_port_mode: true`：

```yaml
ws_host: "0.0.0.0"
ws_port: 9090
single_port_mode: true
public_origin: "http://<你的公网IP或域名>:9090"
```

`public_origin` 用于告诉桌面端应该从哪个公网入口访问 `/resources/{rid}`。

- 直接使用服务器 IP:端口 对外暴露时，填公网地址。
- 通过 Nginx、Caddy、宝塔等反向代理时，填反代后的外部地址。

### 云厂商安全组

默认只需要放行一个 TCP 端口：

- `9090`：WebSocket + 资源接口。

强烈建议设置来源 IP 白名单，只允许你的桌面公网 IP。

### 主机防火墙

Ubuntu / Debian（ufw）：

```bash
# 仅允许固定来源 IP（推荐）
sudo ufw allow from <YOUR_DESKTOP_PUBLIC_IP> to any port 9090 proto tcp

# 查看规则
sudo ufw status numbered
```

CentOS / Rocky / AlmaLinux（firewalld）：

```bash
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="<YOUR_DESKTOP_PUBLIC_IP>" port protocol="tcp" port="9090" accept'
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

请不要直接对全网开放 9090。只有主动关闭 `single_port_mode` 回退到旧双端口模式时，才需要额外放行 `resource_port`。

## 5. 安全基线

最低建议：

- 使用随机强密钥，长度至少 16，建议 32+。
- 严格限制来源 IP，安全组和主机防火墙都要限制。
- 只开放必要端口，不用的端口一律关闭。
- 定期轮换 `auth_token`，泄露后立即更换。
- 关注 AstrBot 与系统日志中的连接失败、异常请求。

进一步增强：

- 在具备条件时于反向代理层启用 HTTPS/WSS。
- 将 WebSocket 与资源接口统一收敛到网关，仅暴露一个端口。
- 配置基础监控告警，例如连接暴增、异常流量、磁盘占用异常。

## 6. 桌面端连接

在 `astrbot-live2d-desktop` 里：

1. 打开「设置 -> 连接」。
2. 服务器地址填：
   - `ws://<SERVER_IP>:9090/astrbot/live2d`
   - 或你的 `wss://` 代理地址
3. 填写与服务端一致的认证令牌。
4. 一般不需要填写高级资源设置；只有老版本适配器或特殊端口映射场景才需要额外覆盖资源地址。
5. 点击连接。

连接后，若桌面端支持增强模型上报，建议检查它是否已经向服务端发送带有 `capabilities`、`expressionCatalog`、`semanticPresets`、`discovery` 的 `state.model` 数据。否则服务端无法正确启用组合表情和语义表情映射。

## 7. 常用命令

管理命令在 AstrBot 中使用：

| 命令 | 权限 | 用途 |
| --- | --- | --- |
| `/live2d status` | 所有用户 | 查看在线状态、连接数、资源使用 |
| `/live2d info` | 所有用户 | 查看当前客户端详情、模型、动作组 |
| `/live2d list` | 所有用户 | 查看连接客户端列表 |
| `/live2d resources` | 所有用户 | 查看资源占用 |
| `/live2d cleanup` | 管理员 | 手动清理过期资源 |
| `/live2d config` | 管理员 | 查看当前配置 |

兼容旧写法：`/live2d.status`、`/live2d.info` 等点号命令仍可使用。

## 8. 快速排障

### 桌面端提示认证失败

- 检查桌面端 token 与服务端 `auth_token` 是否完全一致。
- 检查是否复制了多余空格或换行。

### 连接不上云服务器

- 检查安全组是否放行 9090。
- 检查 Linux 防火墙是否放行相同端口。
- 如通过反向代理或公网域名访问，检查 `public_origin` 是否填写为桌面端真实可访问的外部地址。
- 检查 `ws_path` 是否为 `/astrbot/live2d`。

### 图片/语音资源加载失败

- 检查桌面端是否能访问 `http(s)://<服务地址>/resources/{rid}`。
- 检查 `resource_enabled`、`public_origin` 与 `resource_base_url` 配置。
- 若仍使用旧双端口模式，再检查 `resource_port` 与桌面端高级资源设置。

## 9. 推荐阅读

- [使用教程](../guide/usage.md)
- [连接与握手](../protocol/connection.md)
- [资源协议](../protocol/resources.md)
- [错误码](../protocol/errors.md)
