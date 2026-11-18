# dsh-windows-agents

> 给 DeepSeek Harness 加一个页面，用来编辑**用户全局** `AGENTS.md` —— 就是每个会话在项目指令之前都会加载的那份「长期规矩」。

- 中文界面里叫 **个性化**（设置 → 个性化），英文界面里叫 **Personalization**。
- 底层是 DSH 的 settings 分区 + 配置表单，没有自己的网络协议，也不往提示词里加任何东西。
- 只做一件事：把编辑器里的文本写进 `$DSH_HOME/AGENTS.md`，并且不让它覆盖你手改过的文件。

*An English one-line summary: this is a DeepSeek Harness plugin that adds a settings page for the user-global `AGENTS.md`, the instruction file every session loads before its project instructions.*

---

## 目录

- [这个插件解决什么问题](#这个插件解决什么问题)
- [功能一览](#功能一览)
- [页面长什么样](#页面长什么样)
- [安装](#安装)
- [使用指南](#使用指南)
  - [1. 写下适用于所有会话的规矩](#1-写下适用于所有会话的规矩)
  - [2. 保存，然后开一个新会话验证](#2-保存然后开一个新会话验证)
  - [3. 清空就是「不要全局指令」](#3-清空就是不要全局指令)
  - [4. 想放到别的路径](#4-想放到别的路径)
- [和项目级 AGENTS.md 的关系](#和项目级-agentsmd-的关系)
- [配置项](#配置项)
- [常见问题](#常见问题)
- [卸载](#卸载)
- [兼容性](#兼容性)
- [目录结构](#目录结构)
- [开发与打包](#开发与打包)
- [License](#license)

---

## 这个插件解决什么问题

DeepSeek Harness 的 `@deepseek-ai/dsh-agent-instructions` 会在会话的**第一次请求**时，把一份指令链塞进上下文。这条链的开头是**用户全局**的两份文件：

1. `$DSH_HOME/AGENTS.md`（通常是 `~/.dsh/AGENTS.md`）
2. `<agentsHome>/AGENTS.md`（`$DSH_AGENTS_HOME` 或 `~/.agents/AGENTS.md`）

然后再接项目级指令（从项目根目录到当前会话工作目录，逐层的 `AGENTS.md` / `CLAUDE.md`，以及 `.local.md` 叠加层）。

问题在于：第一份文件**没有界面**。它是个藏在用户主目录里的纯文本文件，路径还带点黑客味（`~/.dsh/`），并且：

- 用编辑器改完，不知道有没有写进正确的路径；
- 想检查现在到底生效了什么，只能去翻文件；
- 多个 profile 共用它，一不小心就改坏了别的项目在用的规矩；
- 文件是 UTF-8，超了预算会被 harness 静默省略或截断，你根本看不出来。

这个插件就是给这份文件补上一个正经的编辑页面：定位、编辑、字节预算、保存、清空，都在设置里完成。

它**不**负责注入。注入、预算、去重、变更通知全部由 `dsh-agent-instructions` 处理，本插件只在磁盘上维护文件内容。所以它不会改变 harness 的提示词行为，只是给已有的行为配了个编辑器。

## 功能一览

| 能力 | 说明 |
|---|---|
| 编辑用户全局指令 | 一个等宽字体的大编辑器，内容即 `$DSH_HOME/AGENTS.md` 的全文 |
| 字节预算显示 | 实时显示 `当前字节 / 65536 字节`，按 UTF-8 计算，和 harness 的指令链预算同一个口径 |
| 原子保存 | 先写临时文件再 rename，中途失败不会留下半个文件；`$DSH_HOME` 不存在会创建 |
| 清空 | 删除该文件（harness 读不到文件就等于「没有全局指令」），不会碰其它文件 |
| 文件优先 | Host 启动时如果文件内容和表单里的不一致，以**文件**为准导入表单，手改的内容不会被旧值覆盖 |
| 中英双语 | 跟随界面语言，`en` / `zh` 两套词条 |
| 就地生效 | `content` 是 volatile 字段，保存时更新运行中的插件，不重启、不掉会话 |

## 页面长什么样

打开 **设置**，左侧分区列表里会多出一项：

- 中文：**个性化**
- 英文：**Personalization**

页面从上到下是：

1. 标题与一句说明：*编辑用户全局 AGENTS.md：每个会话都会在项目指令之前加载它。*
2. 一行路径提示：*文件：`$DSH_HOME/AGENTS.md`（默认 `~/.dsh/AGENTS.md`）。启动时以文件为准；在这里保存会重写该文件。*
3. 编辑器（最小高度 320px，可拖高，等宽字体，关闭拼写检查）。
4. 底部一行：字节计数、状态文字、**保存**、**清空**。
5. 脚注：*注入由 harness 自身完成，本页不额外添加任何提示词。*

状态文字会告诉你现在处于哪一种情况：

| 状态 | 你看得到 |
|---|---|
| 空闲 | 改动对新会话生效；已打开的会话仍保留它加载时的指令。 |
| 保存中 | 保存中… |
| 已保存 | 已保存。新会话与恢复的会话会加载它。 |
| 失败 | Host 拒绝了这次写入。检查 profile 配置后重试。 |
| 不可用 | 当前 profile 未提供 `global-agents` 命名空间，没有可编辑的内容。 |
| 只读 | 该部署的 Host 设置文档为只读。 |

## 安装

插件是一个 DSH bundle：`package.json` 里的 `dsh.bundle.patch` 指向 `cordis.patch.yml`，安装时往 profile 的插件列表插入一条 id 为 `global-agents` 的 Host 行（`config: {}`），浏览器半注册设置分区。

### 方式 A：从本地目录安装（推荐，改代码时也用这个）

```bash
git clone https://github.com/LXMH1982/dsh-windows-agents.git
cd dsh-windows-agents
npm install
```

然后在 DSH 里：

1. 打开 **Plugins** 页面。
2. 点 **Add plugin**，选中仓库目录（**含 `package.json` 的那一层**）。
3. 回到 **Plugins** 列表，确认 `dsh-windows-agents` 这一行是启用状态。
4. 打开 **设置**，左侧应出现「个性化」/ *Personalization*。

### 方式 B：打包成 tgz 安装

```bash
npm install
npm pack
```

得到 `dsh-windows-agents-0.2.0.tgz`（`files` 白名单只会打进运行所需的文件），把这个 tgz 作为插件包安装即可。适合分发给别人，或者不想让 profile 指向一个 git 工作区。

> 不需要手工编辑 profile 的 `package.json` 或 `cordis.patch.yml`，也不需要自己跑包管理器 —— 安装、启用、重启都由 DSH 的插件管理器完成。安装后改动对新会话生效，重启 DSH 依然在。

## 使用指南

### 1. 写下适用于所有会话的规矩

打开 **设置 → 个性化**，在编辑器里写。这里的内容会被注入到**每一个**会话的最前面（在所有项目级 `AGENTS.md` 之前），所以只放真正全局的东西：语言、沟通风格、文件操作习惯、工具偏好。

一个可以直接抄的起点：

```markdown
# 全局工作约定

- 回答使用简体中文；代码、命令、日志保持原文。
- 改文件前先读文件；只做完成目标必需的最小改动。
- 不确定的地方标注出来，不要编造路径、版本号或 API。
- 破坏性或不可逆的操作先说明影响，再执行。
- 汇报时先给结论，再给依据和验证方式。
```

几类常见的写法：

| 想达到的效果 | 写什么 |
|---|---|
| 固定回答语言 | `回答使用简体中文。` |
| 固定回答结构 | `先结论后细节；执行后报告做了什么、如何验证。` |
| 安全习惯 | `改动前先读文件；不要删除或覆盖无关内容。` |
| 减少客套 | `不要开场白、不要复述我的问题。` |
| 工具偏好 | `优先用 ripgrep 搜索、用 pnpm 管理依赖。` |

不要放的东西：某个项目专用的构建命令（那是项目级 `AGENTS.md` 的活）、会过期的一次性任务、大段参考资料（会吃掉 64 KiB 预算）。

### 2. 保存，然后开一个新会话验证

点 **保存**。看到「已保存。新会话与恢复的会话会加载它。」就说明文件已经落盘。

**什么时候生效：**

- 新会话：直接生效（基线在首次请求时渲染）。
- 恢复的会话：会重新对账基线，生效。
- 正在运行、已经发过请求的会话：**不会**重新加载，它保留打开时那份指令。想立刻验证就新开一个会话。

验证方法：随便开个新会话，问一句「你现在加载了哪些全局指令」，或者看会话开头注入的 `Instructions from: ~/.dsh/AGENTS.md` 段落。

### 3. 清空就是「不要全局指令」

点 **清空** 会把 `$DSH_HOME/AGENTS.md` 删掉 —— 这正是 harness 理解的「没有用户全局指令链」。其它文件一律不动。

注意这不是「清空编辑器但留个空文件」：空文件和不存在在语义上很接近，但本插件选择**删除**，这样磁盘上不会留下一个会误导后来人的空文件。

### 4. 想放到别的路径

默认维护 `$DSH_HOME/AGENTS.md`。如果你想让这个页面去维护别的文件（例如把全局指令集中放到某个同步盘），在 profile 的插件配置里给这一行加 `file`：

```yaml
- id: global-agents
  name: dsh-windows-agents
  config:
    file: 'D:/sync/agents/AGENTS.md'
```

`file` 是普通字段，改它会让插件重启以读取新路径，所以它**只出现在 YAML 里**，页面上没有这个输入框。

> 路径必须是自己写完整绝对路径；插件不会替你展开 `~`。

## 和项目级 AGENTS.md 的关系

注入时的顺序（从宽泛到具体）：

```
1. $DSH_HOME/AGENTS.md            ← 本插件编辑的文件（用户全局链）
2. <agentsHome>/AGENTS.md         ← 例如 ~/.agents/AGENTS.md（用户全局链）
3. <项目根>/AGENTS.md             ┐
   ...  逐层向下的目录 ...        ├ 项目指令链
4. <会话工作目录>/AGENTS.md       ┘
   （同目录的 CLAUDE.md、AGENTS.local.md、CLAUDE.local.md 也参与）
```

要点：

- **两条链各有独立的 65,536 字节预算**，互不挪用。用户全局文件超预算不会去抢项目链的额度，反之亦然。
- 同一候选组里内容一致的文件只渲染一次，所以 `CLAUDE.md` 复制自 `AGENTS.md` 时不会重复加载。
- 注入只发生在首次请求（以及之后文件系统操作触发的增量变更），harness **不监视**外部编辑。你在编辑器里改完文件、又不重启，会话不会自己刷新。

## 配置项

| 字段 | 默认值 | 出现位置 | 说明 |
|---|---|---|---|
| `content` | `''` | 页面表单 | 指令正文。volatile 字段：表单保存会原地更新运行中的插件，不重启。 |
| `file` | `''` | 仅 YAML | 改为维护这个绝对路径。空字符串表示 `$DSH_HOME/AGENTS.md`。 |

`$DSH_HOME` 的解析：优先环境变量 `DSH_HOME`，否则 `~/.dsh`。这与 `dsh-agent-instructions` 的解析口径一致，所以页面写的就是会话真正读取的那份文件。

## 常见问题

**保存成功了，但当前会话没变化？**
这是设计行为。指令基线在会话首次请求时渲染，已经在跑的会话保留它加载的那份。开一个新会话，或恢复一个会话。

**我手改了文件，页面会自动更新吗？**
只在插件激活（Host 启动）时读一次：如果文件内容和表单不一致，**以文件为准**导入，所以启动时手改的内容不会被旧值覆盖。但插件运行期间不会再监视文件 —— 此时如果你手改文件再在页面上点保存，页面里的旧文本会覆盖掉手改内容。要么先在页面里刷新内容（重启 DSH 或重新激活插件），要么就只在页面上改。

**写了超过 65536 字节会怎样？**
照样保存。harness 会在渲染时按预算处理：同一链内先丢弃完整的较宽泛文件，再截断最具体的那个，并给模型一条 `Workspace instruction budget ...` 通知。页面上的计数就是为了让你在写爆之前看到还有多少余量。

**左侧没有「个性化」这一项？**
三种可能：插件没装上、装了但那一行是禁用的、或者当前 profile 的 Host 设置文档是只读的（页面会显示「该部署的 Host 设置文档为只读」）。先在 **Plugins** 列表里确认这一行。

**多个 profile 会各有一份吗？**
不会。文件位置由进程的 `DSH_HOME` 决定，不是 profile 目录，所以同一台机器上的多个 profile 共用同一份用户全局指令。想隔离就在各自的配置里用 `file` 指向不同路径。

**这段内容会覆盖项目里的 `AGENTS.md` 吗？**
不会。它是**更低优先级**的通用层，项目级文件排在它后面、更具体、按「具体优先」参与预算取舍。它也无法覆盖 system / developer 级指令。

**中文会不会算超预算？**
会按 UTF-8 字节算，一个汉字 3 字节。页面显示的计数就是字节数，不是字符数 —— 和 harness 的判断完全一致。

## 卸载

在 **Plugins** 页面把 `dsh-windows-agents` 停用或移除，设置里的「个性化」分区随之消失。

**文件不会被删。** 你的 `$DSH_HOME/AGENTS.md` 留在原处，仍然会被 harness 加载 —— 这正是关键：插件只是编辑器，指令本身属于 harness。想连指令一起去掉，就在卸载前先用页面上的 **清空**。

## 兼容性

- 面向 DSH 的 **Web** 客户端（`dsh.client.platform: "web"`），注入 `@deepseek-ai/dsh-client-ui-settings`，通过共享的 `ctx.configForms` 配置表单通道读写，不需要自己的 wire 命名空间。
- Host 侧依赖：`settings` 服务、`loader/volatile-update` 事件、`configEditor` 能力，以及 `@deepseek-ai/dsh-agent-instructions` 对 `$DSH_HOME/AGENTS.md` 的读取。
- 运行时依赖只有 `@deepseek-ai/schemastery`（用于 Config schema）。
- 开发与验证环境：DeepSeek Harness 桌面运行时 `0.2.2-rc.3`。

## 目录结构

```
index.js            Host 半：激活时导入文件、保存时原子写回、清空时删除
client.js           浏览器半：注册 settings.section 分区、编辑器 UI、导航图标
cordis.patch.yml    插入 id 为 global-agents 的 Host 行（config: {}）
locale/en.json      插件卡片标题与描述（英文）
locale/zh.json      插件卡片标题与描述（中文）
docs/DETAIL.md      插件详情页正文
icon.svg            插件图标
```

## 开发与打包

```bash
npm install     # 只有 @deepseek-ai/schemastery 一个依赖
npm pack        # 生成 tgz，files 白名单控制内容
```

- 仓库里的目录名沿用开发时的 `dsh-plugin-global-agents`，而包名、仓库名是 `dsh-windows-agents`。安装与引用一律以 `package.json` 的 `name` 为准。
- `package.json` 保留 `private: true`：这是给 DSH 安装的 bundle，不走 npm 公共发布，分发用 `npm pack` 出来的 tgz。
- `.gitignore` 排除了 `node_modules/` 与 `*.tgz`；`.gitattributes` 统一 LF 行尾，避免 Windows 检出后整文件 diff。

## License

[MIT](LICENSE) © 2026 LXMH1982
