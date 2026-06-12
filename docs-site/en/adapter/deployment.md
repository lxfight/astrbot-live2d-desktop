# Adapter Deployment

This page covers installation, configuration, cloud-server deployment, and the security baseline for `astrbot_plugin_live2d_adapter`.

## 1. Installation

If you use AstrBot Dashboard:

1. Open the plugin marketplace.
2. Search for and install `astrbot_plugin_live2d_adapter`.
3. Enable the `live2d` adapter in platform configuration.

Most users only need the marketplace installation and do not need to copy code manually.

## 2. First Configuration

Start with the local safe-mode configuration:

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

- `auth_token` is mandatory.
- If left empty, the plugin generates a strong random token and writes it to:

```text
data/plugin_data/astrbot-live2d-adapter/live2d_auth_token.txt
```

Copy that token into the desktop client under Settings -> Connection -> Auth Token.

### Data Directories and Local Files

- All managed plugin files are rooted at `data/plugin_data/astrbot-live2d-adapter/`.
- `resource_dir` defaults to `live2d_resources`, and `temp_dir` defaults to `live2d_temp`; both resolve under the plugin data directory.
- These two directories cannot be configured outside the plugin data directory. Escaping absolute paths are rejected.
- `file:///` images, audio, files, and videos sent by the desktop client are copied into `temp_dir` before entering the AstrBot flow.
- Local resources sent by the adapter are copied into `resource_dir` first and then exposed through the resource service. Raw `file://` paths are not returned to the desktop client.

### Dedicated Performance Planning LLM

- Dedicated performance planning is configured on the plugin configuration page, not inside the `live2d` platform instance.
- Configuration path: AstrBot plugins -> `Live2D Adapter` -> `planner`.
- Recommended setup: set `mode` to `provider`, then select an independent chat Provider via `provider_id`.

## 3. Protocol Upgrade Compatibility

- Newer adapters send enhanced expression protocol fields according to client capabilities, including `expression.combo`, `expression.semantic`, `holdMs`, `resetPolicy`, and `perform.show.interruptible`.
- If capabilities are not declared, the adapter falls back to the basic single-expression protocol.
- To enable enhanced fields, the desktop client must declare `expressionCombo` / `semanticExpression` in `state.model.capabilities`, and send `expressionCatalog` and `semanticPresets`.
- If the desktop client still only understands the old `expression.id` protocol, it will receive the basic single-expression fallback and have reduced follow-up performance capabilities.

See [Protocol Overview](../protocol/overview.md), [State Model v2](../protocol/state-model-v2.md), and [Perform Show](../protocol/perform-show.md) for field details.

## 4. Cloud Server Deployment

If the desktop client is not on the same machine, configure remote access as below.

### Listen Address

Set `ws_host` to a public listening address, commonly `0.0.0.0`, and keep `single_port_mode: true`:

```yaml
ws_host: "0.0.0.0"
ws_port: 9090
single_port_mode: true
public_origin: "http://<your-public-ip-or-domain>:9090"
```

`public_origin` tells the desktop client which public endpoint should be used for `/resources/{rid}`.

- If exposing server IP:port directly, use that public address.
- If using Nginx, Caddy, BT Panel, or another reverse proxy, use the proxied external address.

### Cloud Security Group

By default, only one TCP port is required:

- `9090`: WebSocket + resource API.

Strongly restrict the source IP to your desktop public IP.

### Host Firewall

Ubuntu / Debian (`ufw`):

```bash
# Allow only a fixed source IP (recommended)
sudo ufw allow from <YOUR_DESKTOP_PUBLIC_IP> to any port 9090 proto tcp

# Check rules
sudo ufw status numbered
```

CentOS / Rocky / AlmaLinux (`firewalld`):

```bash
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="<YOUR_DESKTOP_PUBLIC_IP>" port protocol="tcp" port="9090" accept'
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

Do not expose 9090 to the entire internet. Only if you explicitly disable `single_port_mode` and return to the legacy dual-port mode should you also expose `resource_port`.

## 5. Security Baseline

Minimum recommendations:

- Use a random strong token, at least 16 characters and preferably 32+.
- Strictly restrict source IPs in both security groups and host firewall rules.
- Open only necessary ports and close unused ones.
- Rotate `auth_token` regularly and immediately after a leak.
- Monitor AstrBot and system logs for failed connections and abnormal requests.

Further hardening:

- Enable HTTPS/WSS at the reverse proxy layer when possible.
- Converge WebSocket and resource APIs behind one gateway and expose only one port.
- Add basic monitoring for connection spikes, abnormal traffic, and disk usage.

## 6. Desktop Connection

In `astrbot-live2d-desktop`:

1. Open Settings -> Connection.
2. Set the server address to:
   - `ws://<SERVER_IP>:9090/astrbot/live2d`
   - or your `wss://` proxy address
3. Enter the same auth token as the server.
4. Advanced resource settings are usually unnecessary; only old adapters or special port-mapping setups need resource overrides.
5. Click Connect.

After connection, if the desktop supports enhanced model reporting, verify that it sends `state.model` data with `capabilities`, `expressionCatalog`, `semanticPresets`, and `discovery`. Otherwise the server cannot enable combo and semantic expression mapping correctly.

## 7. Common Commands

Management commands are used inside AstrBot:

| Command | Permission | Purpose |
| --- | --- | --- |
| `/live2d status` | All users | Online status, connection count, resource usage |
| `/live2d info` | All users | Current client details, model, motion groups |
| `/live2d list` | All users | Connected client list |
| `/live2d resources` | All users | Resource usage |
| `/live2d cleanup` | Admin | Manually clean expired resources |
| `/live2d config` | Admin | View current configuration |

Legacy dot commands such as `/live2d.status` and `/live2d.info` remain compatible.

## 8. Quick Troubleshooting

### Desktop Shows Authentication Failed

- Check that the desktop token exactly matches the server `auth_token`.
- Check for extra spaces or line breaks when copying the token.

### Cannot Connect to a Cloud Server

- Check whether the security group allows 9090.
- Check whether the Linux firewall allows the same port.
- If using a reverse proxy or public domain, check whether `public_origin` is the real external address reachable by the desktop client.
- Check whether `ws_path` is `/astrbot/live2d`.

### Image or Voice Resources Fail to Load

- Check whether the desktop client can access `http(s)://<server-address>/resources/{rid}`.
- Check `resource_enabled`, `public_origin`, and `resource_base_url`.
- If still using the legacy dual-port mode, also check `resource_port` and desktop advanced resource settings.

## 9. Recommended Reading

- [Usage Tutorial](../guide/usage.md)
- [Connection](../protocol/connection.md)
- [Resources](../protocol/resources.md)
- [Errors](../protocol/errors.md)
