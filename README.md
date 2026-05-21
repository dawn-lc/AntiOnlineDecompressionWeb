# 🔐 反在线解压

> 一款完全在浏览器端运行的文件加密混淆工具。将文件拆分为**密钥文件** 与**加密数据文件**，即使加密数据被上传到网盘，服务方也无法识别其原始内容。

## ✨ 特性

- **🔒 加密** — 选择任意文件，生成 `密钥` + `加密数据`
- **🔓 解密** — 同时选择 `密钥` + `加密数据` 文件，还原原始文件
- **⚡ 浏览器原生** — 所有加解密在浏览器内完成，文件不上传到任何服务器
- **🧩 流式处理** — 无论文件多大，内存占用保持极低，分块加解密
- **🧵 Web Worker** — 加解密在独立线程进行，不阻塞 UI
- **💾 多级保存策略** — 优先使用 File System Access API，自动回退到 OPFS / ServiceWorker 流式下载 / Blob 下载
- **📱 移动端支持** — 兼容移动浏览器，自动选择最佳保存方式
- **🔐 XChaCha20-Poly1305** — 使用 libsodium 的 `secretstream` 实现认证加密

## 🧬 文件格式

### AODK（密钥文件）

| 字段             | 大小 | 说明                            |
| ---------------- | ---- | ------------------------------- |
| Magic            | 4 B  | `0x41 0x4F 0x44 0x4B`（"AODK"） |
| Version          | 2 B  | 格式版本，当前为 `1`            |
| HeaderSize       | 4 B  | Header 总大小                   |
| Key              | 32 B | XChaCha20 加密密钥              |
| Nonce            | 24 B | XChaCha20 stream header         |
| UUID             | 32 B | 与 AODF 匹配的唯一标识          |
| FileHash         | 32 B | 原始文件 SHA-256 哈希           |
| OriginalFileSize | 8 B  | 原始文件大小                    |
| FilenameLength   | 2 B  | 原始文件名 UTF-8 字节长度       |
| Filename         | 可变 | 原始文件名（UTF-8）             |
| Attachment       | 可变 | 附件(不计入HeaderSize)          |

### AODF（加密数据文件）

| 字段          | 大小 | 说明                                  |
| ------------- | ---- | ------------------------------------- |
| Magic         | 4 B  | `0x41 0x4F 0x44 0x46`（"AODF"）       |
| Version       | 2 B  | 格式版本，当前为 `1`                  |
| HeaderSize    | 4 B  | Header 总大小                         |
| UUID          | 32 B | 与 AODK 匹配的唯一标识                |
| EncryptedData | 可变 | XChaCha20 加密数据 (不计入HeaderSize) |

## 🏗️ 项目结构

```
├── build/                     # 构建脚本
│   ├── index.mjs              # 构建入口
│   ├── bundle.mjs             # 单 bundle 构建函数
│   └── config.mjs             # 共享构建配置
├── test/                      # 测试
│   ├── e2e.mjs                # 端到端测试
│   ├── helpers.mjs            # 测试工具函数
│   ├── generate-fixture.mjs   # 测试文件生成脚本
│   ├── fixtures/              # 测试数据文件（gitignored）
│   └── output/                # 测试输出（gitignored）
├── package.json
├── tsconfig.json
├── src/
│   ├── index.html             # 入口 HTML
│   ├── style.css              # 样式（暗色主题）
│   ├── main/                  # 主线程代码
│   │   ├── index.ts           # 入口：初始化各模块
│   │   ├── AppController.ts   # 加解密流程编排
│   │   ├── FileIOManager.ts   # 文件流式读取
│   │   ├── KeyFileManager.ts  # AODK 文件解析
│   │   ├── SaveHelper.ts      # 多级保存策略（FSAA / OPFS / SW / Blob）
│   │   └── UI.ts              # 界面交互逻辑
│   ├── worker/                # Web Worker 线程代码
│   │   ├── CryptoWorker.ts    # Worker 消息调度
│   │   ├── StreamEncryptor.ts # XChaCha20-Poly1305 流加密
│   │   ├── StreamDecryptor.ts # XChaCha20-Poly1305 流解密
│   │   ├── HashCalculator.ts  # 通用哈希计算（BLAKE2b）
│   │   └── WasmLoader.ts      # libsodium WASM 加载
│   ├── sw/                    # ServiceWorker
│   │   └── DownloadSW.ts      # 流式文件下载 SW
│   └── shared/                # 共享代码
│       ├── constants.ts       # 常量（分块大小、Magic 字节等）
│       ├── EventBus.ts        # 轻量发布/订阅事件总线
│       ├── formatBytes.ts     # 字节格式化工具
│       ├── compareUUID.ts     # UUID 比较工具
│       ├── computeFileHash.ts # Worker 流式文件哈希计算
│       ├── MessageTypes.ts    # Worker ↔ 主线程消息类型
│       ├── i18n/              # 国际化
│       │   ├── types.ts       # 翻译键类型定义
│       │   ├── index.ts       # i18n
│       │   ├── zh-CN.ts       # 简体中文语言包
│       │   └── en.ts          # English language pack
│       └── schemas/
│           ├── aodf.ts        # AODF Header 类型定义
│           ├── aodk.ts        # AODK Header 类型定义
│           └── serializer.ts  # Header 序列化/反序列化
```

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 构建
npm run build

# 构建产物在 dist/ 目录
```

构建完成后，使用任意静态服务器打开 `dist/index.html` 即可使用。

### 开发

```bash
# 带 sourcemap 的开发构建
node build/index.mjs --dev
```

## 🌐 国际化

支持中英文界面，按浏览器语言自动选择。点击标题下方的语言按钮可实时切换。

| 语言     | 标识    | 文件                       |
| -------- | ------- | -------------------------- |
| 简体中文 | `zh-CN` | `src/shared/i18n/zh-CN.ts` |
| English  | `en`    | `src/shared/i18n/en.ts`    |

如需新增语言，在 `types.ts` 的 `Locale` 类型中添加标识，创建对应的语言包文件，并在 `index.ts` 的 `bundles` 中注册即可。

## 🤔 设计理念

**反在线解压**，就是要防止某些网盘对压缩文件的自动扫描。当你在某些网盘上传压缩包时，它们会在后台自动解压你的文件，扫描其中的内容——无论你是否知情。

- **未加密的压缩包** 如普通 `.zip` / `.rar` / `.7z` 会被直接解压扫描，内容完全透明
- **带密码的加密压缩包** 看似安全，但只要任何一个用户（不一定是上传者）使用了"在线解压"并输入密码，服务方就可以畅通无阻的扫描你的加密压缩包。——你根本控制不了谁、什么时候会去输入那个密码

本工具采用**密钥-数据分离设计**：将加密密钥与加密数据分别存放于独立的文件中。加密数据文件本身不具备可解密的密钥信息，网盘无法在没有密钥的前提下通过任何方式解压，从而杜绝内容被扫描的可能性。

- 加密后产生两个文件：**AODK（密钥）** 和 **AODF（加密数据）**，必须同时拥有才能解密
- AODK 文件极小（通常仅几百字节），应**通过安全渠道（如端到端加密聊天、U 盘当面拷贝等）单独分享**，绝不随加密数据一起上传 ~~当然您也可以选择将此文件上传到其他网盘，毕竟两个网盘大概率不会对账来着~~
- AODF 文件即使上传至任何云存储，服务方也无法扫描其内容，可**通过任意渠道（网盘、邮件、即时通讯等）自由分发**

## 🗺️ 开发计划

- [ ] **格式伪装** — 将加密数据文件伪装为常见媒体格式（如 MP4、JPG、PNG），进一步降低网盘对加密文件的疑心，使其在文件列表中"看起来人畜无害"
