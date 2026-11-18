# dsh-windows-agents

在 DeepSeek Harness 的 **设置** 里直接编辑用户全局 `AGENTS.md` 的插件。

Edit the user-global `AGENTS.md` that every DeepSeek Harness session loads before any project instructions — from a settings page instead of a text editor.

- 设置里新增一个独立分区（中文界面为「个性化」，英文界面为 `Personalization`），一个等宽字体编辑器 + 字节计数 + 保存 / 清空。
- 只负责写文件；提示词注入、预算与去重由 harness 的 `@deepseek-ai/dsh-agent-instructions` 完成，插件本身不向提示词追加任何文本。
- 目标文件默认 `$DSH_HOME/AGENTS.md`（通常是 `~/.dsh/AGENTS.md`），可用 `file` 配置指向任意绝对路径。

## 行为要点

- **启动时以文件为准。** Host 启动时若 `AGENTS.md` 与设置里保存的文本不同，会把文件内容导入表单。手改过的文件不会被旧的保存值覆盖，下一次保存从文件内容开始。
- **保存是原子写入**（临时文件 + rename），`$DSH_HOME` 不存在时会创建。
- **清空即删除文件**，也就是 harness 读取到的「没有用户全局指令」状态；不触碰其它文件。
- **新会话生效。** 指令基线在会话首次请求时渲染，恢复的会话会重新对齐；正在运行的会话保留它已加载的指令。
- **字节计数**按 UTF-8 长度对比指令链的 65,536 字节预算。超预算的文件仍会保存，随后由 harness 在该指令链内截断或跳过并给出预算提示。

## 安装

插件以 DSH bundle 形式分发（`package.json` 的 `dsh.bundle.patch` 指向 `cordis.patch.yml`，插入一条 id 为 `global-agents` 的 Host 行）。

**方式 A：从本地目录安装（开发用）**

1. `npm install` 安装依赖。
2. 打开 DSH 的 **Plugins** 页面，选择 **Add plugin**，选中本仓库目录（含 `package.json` 的这一层）。
3. 在 **Plugins** 列表确认 `dsh-windows-agents` 已启用，然后打开 **设置**，左侧应有「个性化」分区。

**方式 B：打包后安装**

```bash
npm install
npm pack          # 生成 dsh-windows-agents-<version>.tgz，files 白名单只打包运行所需的 8 个文件
```

把生成的 `.tgz` 作为插件包安装即可；`files` 字段保证 `node_modules/`、锁文件和文档目录之外的杂物不会进入产物。

安装本身由 DSH 的插件管理器完成（bundle patch 会被插进 profile 的 `cordis.patch.yml`），不需要手工编辑 profile 的文件。改动对新会话生效，重启后仍然存在。

## 配置

| 字段 | 默认值 | 说明 |
|---|---|---|
| `content` | `''` | 指令正文。volatile 字段，表单保存时原地更新运行中的插件，不重启。 |
| `file` | `''` | 改为维护这个绝对路径，而不是 `$DSH_HOME/AGENTS.md`。仅 YAML 可见，表单里不出现。 |

`file` 是普通字段：在 profile patch 里改它会让插件重启，重启后读取新路径。想在 UI 里改路径是做不到的，这是有意设计。

## 兼容性

- 面向 DSH 的 **Web** 客户端（`dsh.client.platform: web`），注入 `@deepseek-ai/dsh-client-ui-settings`，通过 `ctx.configForms` 共用配置表单通道，因此不需要自己的 wire 命名空间。
- 依赖 Host 侧的 `settings` 服务、`loader/volatile-update` 事件与 `configEditor` 能力。
- 开发与验证环境：DeepSeek Harness 桌面运行时 `0.2.2-rc.3`。

## 目录结构

```
index.js            Host 半：以文件为准导入、保存时原子写回、清空时删除
client.js           浏览器半：注册 settings.section 分区、编辑器 UI、导航图标
cordis.patch.yml    插入 id 为 global-agents 的 Host 行（config: {}）
locale/en.json      插件卡片标题与描述（en）
locale/zh.json      插件卡片标题与描述（zh）
docs/DETAIL.md      插件详情页正文
icon.svg            插件图标
```

## 备注

- 仓库里的目录名沿用开发时的 `dsh-plugin-global-agents`，包名与仓库名是 `dsh-windows-agents`；安装时以 `package.json` 的 `name` 为准。
- `package.json` 保留 `private: true`：这是给 DSH 安装的 bundle，不走 npm 公共发布，分发用 `npm pack` 的 tgz。

## License

[MIT](LICENSE)
