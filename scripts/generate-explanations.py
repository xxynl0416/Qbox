# -*- coding: utf-8 -*-
"""
用 AI 为题册生成【考点】【选项分析】【知识拓展】解析

用法：python scripts/generate-explanations.py public/books/408-ct.json
"""

import json
import os
import sys
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

API_BASE = "https://token-plan-cn.xiaomimimo.com/v1"
API_KEY = "tp-cdti0skjbd6izkkq5xeq3fyeqoy8dq84sonfz1hgxlakyz83"
MODEL = "mimo-v2.5-pro"

SYSTEM_PROMPT = """你是一位资深的408考研辅导老师，专精计算机组成原理。请为以下选择题生成高质量的解析。

要求：
1. **【考点】**：点明这道题考察的核心知识点（1-2句话）
2. **【选项分析】**：逐个分析每个选项为什么对/错，用 ✓ 标记正确选项，✗ 标记错误选项
3. **【知识拓展】**：补充相关的背景知识、易混淆点、记忆口诀或考试技巧（2-3句话）

格式要求：
- 用 Markdown 格式
- 选项分析用列表，每项以 ✓ 或 ✗ 开头，后跟 **选项字母.** 再跟分析
- 语言简洁精炼，适合考研复习
- 如果题目有年份标注（如"2023"），在考点中提及这是真题"""

def generate_explanation(question):
    """调用 AI 生成解析"""
    # 构建题目文本
    q_text = f"题目：{question['stem']}\n"
    for opt in question['options']:
        q_text += f"{opt['k']}. {opt['v']}\n"
    if question['answer']:
        q_text += f"正确答案：{question['answer']}\n"

    try:
        resp = requests.post(
            f"{API_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": q_text},
                ],
                "max_tokens": 2000,
                "temperature": 0.7,
            },
            timeout=60,
        )
        data = resp.json()
        if "choices" in data and len(data["choices"]) > 0:
            content = data["choices"][0]["message"].get("content", "")
            # 有些模型把内容放在 reasoning_content 里
            if not content and "reasoning_content" in data["choices"][0]["message"]:
                content = data["choices"][0]["message"]["reasoning_content"]
            return content.strip()
        else:
            print(f"  [!] API 返回异常: {json.dumps(data, ensure_ascii=False)[:200]}")
            return None
    except Exception as e:
        print(f"  [!] API 调用失败: {e}")
        return None


def process_question(item):
    """处理单个题目（用于并发）"""
    i, ch_name, qt_name, q = item
    explanation = generate_explanation(q)
    return (i, ch_name, qt_name, q, explanation)


def main():
    if len(sys.argv) < 2:
        print("用法: python scripts/generate-explanations.py public/books/408-ct.json")
        sys.exit(1)

    json_path = sys.argv[1]
    with open(json_path, 'r', encoding='utf-8') as f:
        book = json.load(f)

    # 统计需要生成解析的题目
    todo = []
    for ch_name, qtypes in book['chapters'].items():
        for qt_name, qs in qtypes.items():
            for q in qs:
                if not q.get('_expl'):
                    todo.append((ch_name, qt_name, q))

    print(f"[*] 共 {len(todo)} 道题需要生成解析")

    # 从上次中断处继续
    start_idx = 0
    progress_file = json_path + '.progress'
    if os.path.exists(progress_file):
        with open(progress_file, 'r') as f:
            start_idx = int(f.read().strip())
        print(f"[*] 从第 {start_idx} 题继续")

    remaining = [(i, ch, qt, q) for i, (ch, qt, q) in enumerate(todo[start_idx:], start=start_idx)]
    success = 0
    fail = 0
    processed = 0

    # 并发处理，3个线程，每批20题
    batch_size = 20
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(process_question, item): item for item in remaining[:batch_size]}

        for future in as_completed(futures):
            i, ch_name, qt_name, q, explanation = future.result()
            if explanation:
                q['_expl'] = explanation
                success += 1
                print(f"[{i+1}/{len(todo)}] ✓ {ch_name} - 第{q['num']}题 ({len(explanation)}字)")
            else:
                fail += 1
                print(f"[{i+1}/{len(todo)}] ✗ {ch_name} - 第{q['num']}题")

            processed += 1

            # 每10题保存一次
            if processed % 10 == 0:
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(book, f, ensure_ascii=False, separators=(',', ':'))
                with open(progress_file, 'w') as f:
                    f.write(str(i + 1))
                print(f"  [*] 已保存进度 ({processed}题完成)")
                time.sleep(2)  # 每10题暂停2秒，避免触发频率限制

    # 最终保存
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(book, f, ensure_ascii=False, separators=(',', ':'))

    # 清理进度文件
    if os.path.exists(progress_file):
        os.remove(progress_file)

    print(f"\n🎉 完成！成功 {success} 题，失败 {fail} 题")


if __name__ == '__main__':
    main()
