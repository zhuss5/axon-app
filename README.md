# 灵犀平台集成

保留页面入口、token/request 方法与资产目录约定，供平台功能开发后集成到 AXON App。

## 启动

Node.js >= 22.12：

```sh
npm ci
npm run debug
```

修改源码后重新启动。验证使用 `npm run build`。

## Token 与请求

在 `assets/axon-auth-config.json` 中设置平台的 `allowedApiOrigins`，在首页手动填写 accessToken。默认地址仅供本地联调，不是真实平台接口。

主进程业务调用方式与 AXON App 对应：

```ts
const token = await manager.getAccessToken(); // 未设置时返回 null
const requiredToken = await manager.requireAccessToken(); // 未设置时抛错
const response = await manager.request(url, { method: 'GET' });
```

`request()` 自动添加 Bearer token，处理 Origin 校验、超时和 HTTP 错误。回迁时使用 AXON App 已有的认证管理器，不迁入手动 token 输入和明文存储逻辑。

## 连接器页与本地 mock

「专家·技能·连接器 → 连接器」展示我的 MCP / 公共 MCP，数据经主进程调用平台 aihub 目录接口，契约见《详细设计文档/Axon 连接器中心与灵犀平台 MCP 集成技术设计方案》。

```sh
npm run mock   # 本地 aihub 目录 mock（127.0.0.1:18080）
npm run test   # 主进程连接器模块单测（node --test）
```

mock 鉴权接受 Bearer 任意非空 token；token 设为 `expired` 模拟 401；namespace 设为 `FORBIDDEN-403` / `BROKEN-500` 模拟错误。我的 MCP 的系统编号命名空间默认 `TEST-101`，用 `AXON_CONNECTOR_NAMESPACE` 覆盖，平台接口确定后替换 `src/main/features/connectors/namespace.ts`。

## Linux 资产位置

下面是默认位置，代码必须通过系统 API 获取根目录，不写死用户名或绝对路径。统一解析入口为 `src/main/features/capabilities/assetPaths.ts`。

| 资源 | Linux 默认位置 | 主进程获取方式 |
| --- | --- | --- |
| 用户数据 | `~/.config/axon` | `app.getPath('userData')`；App 将它设为 `path.join(app.getPath('appData'), 'axon')` |
| 专家 | `~/.config/axon/experts/<id>/expert.json` | `path.join(app.getPath('userData'), 'experts', id, 'expert.json')` |
| 技能 | `~/.config/opencode/skills/<name>/SKILL.md` | `path.join(app.getPath('home'), '.config/opencode/skills', name, 'SKILL.md')` |
| 工作流 | `~/.opencode/workflows` | `path.join(app.getPath('home'), '.opencode', 'workflows')` |
| 连接器配置 | `~/.config/opencode/opencode.json` | `path.join(app.getPath('home'), '.config/opencode/opencode.json')`，合并其中的 `mcp` 字段 |
| 工作空间 | 系统文档目录下的 `axon` | `path.join(app.getPath('documents'), 'axon')` |

下载后安装到相应资源目录，不以工程临时目录替代。流水线和资料库暂不约定安装目录，按实际平台接口补充。

## 新增与工作流同级的页面

以新增“知识库”为例，修改以下位置，不需要引入路由库。

1. 创建 `src/renderer/features/knowledge/KnowledgePage.tsx`：

```tsx
export function KnowledgePage() {
  return <div className="axon-content"><div className="axon-empty">暂无知识库内容</div></div>;
}
```

2. 在 `src/renderer/App.tsx` 导入组件，并给已有 `Page` 类型增加 `knowledge`：

```tsx
import { KnowledgePage } from './features/knowledge/KnowledgePage';

type Page = 'home' | 'skills' | 'workflows' | 'knowledge' | 'pipeline' | 'library';
```

3. 在同一文件的 `navigationItems` 中，紧接工作流后插入这一项：

```tsx
['knowledge', '知识库'],
```

4. 在同一文件的页面条件渲染中，紧接工作流分支后插入：

```tsx
: page === 'knowledge' ? <KnowledgePage />
```

现有 `navigateTo(id)` 会切换页面，标题由 `navigationItems` 自动获得。新增页面保持 `.axon-content` 根容器，功能样式放在对应目录并显式 import，迁移时一起带上。

## 回迁要点

- 页面和功能代码按对应目录合并到 AXON App，样式一起带上，允许少量 UI 微调。
- token 获取、请求和目录解析复用 App 已有的方法。
- 首页调试表单、手动 token 存储和示例启动代码不用迁回，不整体覆盖 App 的入口文件。

交付时不要携带 `node_modules/`、`dist/`、个人配置或凭证。
