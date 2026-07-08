# 408 题库阅读器

一个支持多本书的通用题库刷题工具。自带书库视图、自测模式、错题本、笔记、进度导入导出。

## ✨ 特性

- **书库视图**：网格展示所有题册，一键进入
- **通用阅读器**：浏览/自测双模式，键盘快捷键
- **每本书独立**：进度、重点、笔记按书 ID 隔离，不串台
- **跨设备同步**：导出/导入 JSON（包含笔记）
- **分享给同学**：把 `books/{id}.json` 发给他即可
- **深色模式 / 移动端响应式**

## 📁 项目结构

```
reader/
├── index.html              # 🌐 唯一入口（书库 + 阅读器）
├── books/                  # 题册 JSON 库
│   ├── index.json          # 书库索引
│   ├── 408-os.json         # 操作系统
│   ├── 408-os/images/      # 该书的配图
│   └── ...                 # 以后随便加
├── tools/
│   ├── docx2book.py        # docx → book.json 转换
│   └── pdf2book.py         # PDF  → book.json 转换
├── screenshot-library.png  # 书库页截图
├── screenshot-reader.png   # 阅读器截图
└── README.md
```

## 🚀 快速开始

### 1.5 工具一览

`tools/` 下有两个转换脚本：

- **`docx2book.py`** — Word 题册 → `books/{id}.json`（推荐）
- **`pdf2book.py`** — PDF 题册 → `books/{id}.json`
  - 依赖 poppler 的 `pdftotext`：Windows `choco install poppler`，Mac `brew install poppler`，Linux `apt install poppler-utils`
  - 不支持扫描版 PDF（图片）

### 1. 启动本地服务器

```bash
cd D:\408\reader
python -m http.server 8765
```

浏览器打开 `http://localhost:8765/`，看到书库页。

### 2. 加新书

```bash
# 把你的 docx 题册转成 JSON
python tools/docx2book.py 你的题册.docx \
    --id 408-cn \
    --title "计算机网络题册" \
    --subject 计算机网络 \
    --category 408 \
    --year 2025
```

参数说明：
- `--id` 书 ID（英文/数字，用于文件名和 localStorage key，**不可重复**）
- `--title` 书名（默认用文件名）
- `--subject` 学科名（显示在卡片标签上）
- `--category` 分类（`408` / `公共课` / `其他`，决定标签颜色）
- `--year` 年份（默认当前年）

转换完成后**刷新浏览器**，新书自动出现在书库。

### 3. 分享给同学

- 把 `books/408-xxx.json` 发给他
- 他放进自己的 `books/` 目录
- 刷新浏览器即可看到

### 4. 换电脑/同步进度

**方式 A：本地文件（无需任何账号）**
- 右上角「📤 导出全部」下载 `progress-all-YYYYMMDD.json`（含笔记）
- 新机器上「📥 导入进度」选择这个文件
- 所有进度恢复

**方式 B：云同步 GitHub Gist（自动跨设备）**
- 右上角「☁️ 云同步」打开弹窗
- 填 GitHub Token（[点这里创建一个](https://github.com/settings/tokens/new)，勾 `gist` 权限即可）
- 点「保存配置」→「⬆️ 推送到云」
- 换电脑/浏览器只需填同一 Token + Gist ID，点「⬇️ 从云拉取」

## 🎮 阅读器快捷键

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
| `?` | 显示本帮助 |

## 🛠 book.json 格式

如果你想自己写/修改题册 JSON：

```json
{
  "id": "408-os",
  "title": "操作系统基础题册",
  "subject": "操作系统",
  "category": "408",
  "year": 2025,
  "source": "docx",
  "total_questions": 392,
  "qtypes_count": 82,
  "chapters": {
    "操作系统概述": {
      "题型一：操作系统的功能": [
        {
          "num": "1",
          "year": null,
          "stem": "下列关于操作系统的叙述中，错误的是()。",
          "options": [
            {"k": "A", "v": "操作系统是管理资源的程序"},
            {"k": "B", "v": "操作系统是管理用户程序执行的程序"},
            {"k": "C", "v": "操作系统是能使系统资源提高效率的程序"},
            {"k": "D", "v": "操作系统是用来编程的程序"}
          ],
          "answer": "D",
          "image": null,
          "_qid": "q_0_0_1"
        }
      ]
    }
  }
}
```

每本书必须有 5 个最终章（操作系统概述/进程与处理机管理/内存管理/文件管理/设备管理与磁盘），但你可以根据自己的题册结构重新组织 `chapters` 的 keys。

## ⚠️ 已知限制

- **需要 HTTP 服务器**：浏览器对 `file://` 协议的 fetch 有限制，必须用 `python -m http.server` 或类似方式
- **PDF 仅支持文本版**：扫描版 PDF（图片）需要 OCR，本工具暂不支持
- **云同步需要 GitHub Token**：免费，gist 权限即可。仅存本地浏览器，代码无后端。

## 📜 路线图

- [x] 通用阅读器（v1）
- [x] docx 转换工具（v1）
- [x] 书库视图 + 进度导入导出（v1）
- [x] PDF 解析（v2）
- [x] 云同步 - GitHub Gist（v2）
- [ ] PWA 离线支持（v3）
