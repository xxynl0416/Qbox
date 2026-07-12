# Qbox - 408 考研题库

在线刷题工具，支持多书库、自测模式、错题本、笔记、进度云同步。

**线上地址**：https://qqbox.vercel.app

## ✨ 特性

- **📚 书库视图** — 网格展示所有题册，进度实时同步
- **🎯 自测模式** — 选答案即时判对错，自动跳题
- **🔍 全文搜索** — 搜索题号、题干、选项、解析
- **⭐ 重点标记** — 标记重要题目，快速筛选
- **📝 个人笔记** — 每题可写笔记，自动保存
- **📊 错题本** — 按错题/重点/未答/有笔记等筛选
- **🎨 三套主题** — 浅色 / 薄荷绿 / 暗色
- **⌨️ 键盘快捷键** — j/k 导航、Space 展开答案、1-4 选选项
- **☁️ 云端同步** — 登录后进度自动同步到 Supabase
- **📱 移动端响应式**

## 🛠 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Next.js 16 (App Router) + TypeScript |
| 后端 | Supabase (PostgreSQL + Auth) |
| 部署 | Vercel |
| 样式 | CSS Variables（无 Tailwind） |

## 📁 项目结构

```
├── app/
│   ├── page.tsx              # 书库页
│   ├── login/page.tsx        # 登录/注册
│   └── book/[id]/page.tsx    # 阅读器
├── components/
│   ├── AuthProvider.tsx      # 用户认证
│   ├── BookCard.tsx          # 书库卡片
│   ├── QuestionCard.tsx      # 题目卡片
│   ├── Sidebar.tsx           # 侧边栏（筛选+导航）
│   ├── QuizBar.tsx           # 自测模式底部栏
│   ├── ThemeSwitch.tsx       # 主题切换
│   └── Toast.tsx             # 提示消息
├── lib/
│   ├── store.ts              # 数据层（Supabase + localStorage 降级）
│   ├── utils.ts              # 工具函数
│   ├── types.ts              # TypeScript 类型
│   └── supabase/             # Supabase 客户端
├── public/books/             # 书库数据 + 图片
├── scripts/
│   ├── schema.sql            # 数据库 Schema
│   └── import-book.ts        # 数据导入脚本
```

## 🚀 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.local.example` 为 `.env.local`，填入 Supabase 凭据：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. 初始化数据库

在 Supabase 控制台的 SQL Editor 中执行 `scripts/schema.sql`

### 4. 导入题目数据

```bash
# 设置 service_role key（在 Supabase 控制台 Settings → API 获取）
export SUPABASE_SERVICE_KEY=your-service-role-key

# 导入
npx tsx scripts/import-book.ts public/books/408-os.json
```

### 5. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000

## 📦 部署

### Vercel

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel --prod --yes

# 设置环境变量
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```

### 环境变量

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 公开 key |

## 📖 加新书

```bash
# 1. 用 docx2book.py 转换题册（需要 Python）
python tools/docx2book.py 你的题册.docx --id 408-cn --title "计算机网络题册"

# 2. 导入到 Supabase
npx tsx scripts/import-book.ts public/books/408-cn.json

# 3. 重新部署
vercel --prod --yes
```

## 🎮 快捷键

| 键 | 动作 |
|---|------|
| `j` / `↓` | 下一题 |
| `k` / `↑` | 上一题 |
| `Space` / `Enter` | 展开/折叠答案 |
| `1` `2` `3` `4` | 自测模式选 A/B/C/D |
| `i` | 标记/取消重点 |
| `m` | 编辑笔记 |
| `/` | 聚焦搜索框 |
| `Esc` | 取消搜索 |

## 📊 数据库结构

- **books** — 书库元数据
- **questions** — 题目（392 道操作系统题 + 示例题）
- **user_progress** — 用户进度（答案、重点、笔记，按用户+书隔离）

## 📜 License

MIT
