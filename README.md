# 物有所值 · Personal Items

根据工作区《个人物品购置与使用记录软件 V1.0 详细设计说明书》实现的本地优先 PWA。

无需账号、服务器或云数据库。所有业务数据和照片保存在当前浏览器的 IndexedDB 中。手机、电脑、不同浏览器之间**不会自动同步**。

## 启动

需要 **Node.js 22.12+（建议 Node 24 LTS）** 和 npm 11+。

```sh
cd personal-items
npm ci
npm run dev
```

打开终端输出的网址。开发模式用于开发；测试离线能力请使用生产构建：

```sh
npm run build
npm run preview
```

Windows 用户可以在项目上层目录运行 `启动项目.ps1`。脚本优先使用本机已有的兼容运行环境，不改动系统 Node 安装。

## 已实现

- 首页摘要、最近使用、闲置提醒和最近新增。
- 物品新建、编辑、搜索、分类与状态叠加筛选、六种排序，每批显示 30 件。
- 按次数、按分钟、仅标记使用三种模式；快捷记录、历史补记、修改和删除。
- 有日志时锁定物品模式；非在用物品禁止新增日志，仍可更正原有日志。
- 整数分存储金额，区分未知和零元；成本、活跃日期、闲置标签从日志派生。
- 历史支出、持有金额、分类占比、最近六个月购置/次数/时长图表和使用排行。
- 最多五张本地照片、Canvas 重新编码、长边 1600 像素、原图限制 8 MB。
- 自定义分类、排序、重命名、分类迁移；引用约束包含回收站。
- 软删除、恢复、带确认的永久级联删除。
- ZIP 完整备份，包含回收站、照片、设置和 SHA-256 清单；只读预检、数量预览、安全备份、事务覆盖恢复。
- ZIP 路径、重复文件名、解压大小、类型、版本、字段、唯一键与外键验证；压缩与解压均限制 50 MB。
- 物品 / 日志 CSV 导出（文本值添加公式注入保护，金额单位为分）。
- 货币符号、闲置天数、备份提醒、存储估算、持久化申请、安装指引。
- Hash 路由、手机底部导航、桌面侧栏、未保存表单保护、PWA 更新提示和离线缓存。

空库只生成七个分类及默认设置，不写入示例物品。`tests/fixtures/sample-backup-v1.zip` 是明确标注为虚构的测试备份，导入会覆盖数据。

## 验证命令

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

如果已有本机 Chrome，可直接指定它，免下载测试浏览器：

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:e2e
```

端到端测试使用隔离的浏览器上下文，不操作你的日常浏览器数据。测试在 4173 端口启动生产预览，覆盖桌面与手机尺寸；报告位于 `playwright-report/index.html`，失败证据位于 `test-results/`。

## 工程约定

`src/domain` 管理领域类型、校验和纯计算；`src/services` 是业务读写入口；`src/db` 管理 Dexie schema 与幂等初始化；`src/backup` 独立处理完整性校验及恢复；页面只负责交互，使用 `liveQuery` 同步本地数据变更。

跨表变更在单个事务内提交。Canvas 压缩、ZIP 解析和 SHA-256 在事务外完成。导入先全面验证，覆盖中的失败会回滚所有表。记录时间保存 UTC ISO 和用户录入的 `localDate`，月度统计使用后者。

数据库 schema 和备份格式均为版本 1。未来修改字段或表时，必须同步实现 Dexie 迁移、备份版本迁移和兼容性测试；当前明确拒绝未知版本，不静默忽略字段。

## 部署与离线

`npm run build` 的 `dist/` 可部署到提供 HTTPS 的静态托管平台。当前 Vite base 为 `./`，Manifest 的 scope/start_url 和 SW 注册路径使用相对路径，支持独立目录部署；路由采用 `/#/…`。

首次需要联网下载资源。生产 Service Worker 预缓存所有页面及图表代码；照片和日志存放于 IndexedDB，不进入静态资源缓存。更新使用提示模式，用户确认后才启用新版本，未保存表单会再次确认。

PWA / Web Crypto 需要安全上下文：线上 HTTPS 或本机 localhost。手机访问电脑的普通 HTTP 局域网 IP 无法完整验证 PWA 能力，请使用 HTTPS 部署。

浏览器的数据空间受协议、域名和端口影响；切换托管地址或从 dev 端口切到 preview 端口，会使用不同数据库空间。请先备份。

更多说明见 [数据备份与换设备迁移说明](docs/数据备份与换设备迁移说明.md) 和 [验收记录](docs/验收记录.md)。

## 技术资料

- [Dexie 事务与异步操作](<https://dexie.org/docs/Dexie/Dexie.transaction()>)
- [Vite 构建与环境要求](https://vite.dev/guide/)
- [Vite PWA 更新提示](https://vite-pwa-org.netlify.app/guide/prompt-for-update)

不接入分析追踪、广告、远程字体或第三方业务接口。备份 ZIP 不加密，请妥善保管；浏览器清除站点数据仍会删除记录，即使持久化申请已获准。
