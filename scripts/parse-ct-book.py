# -*- coding: utf-8 -*-
"""
计算机组成原理题册 docx → book.json 解析器

用法：python scripts/parse-ct-book.py "计组题册.docx"
输出：public/books/408-ct.json
"""

import json
import os
import re
import sys
import xml.etree.ElementTree as ET

def extract_text_from_docx(docx_path):
    """从 docx 提取文本行"""
    import zipfile
    with zipfile.ZipFile(docx_path, 'r') as z:
        xml_content = z.read('word/document.xml')

    root = ET.fromstring(xml_content)
    texts = []
    for p in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
        parts = []
        for t in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
            if t.text:
                parts.append(t.text)
        line = ''.join(parts).strip()
        if line:
            texts.append(line)
    return texts


def parse_questions(texts):
    """解析文本行，提取题目结构"""
    questions = []
    current_chapter = ''
    current_qtype = ''
    current_q = None

    # 正则模式
    chapter_pat = re.compile(r'^第[一二三四五六七八九十]+章')
    qtype_pat = re.compile(r'^题型[一二三四五六七八九十百]*[:：]')
    qstart_pat = re.compile(r'^(\d+)[、.．]\s*(.*)')
    opt_pat = re.compile(r'^([A-D])[.．]\s*(.*)')
    answer_pat = re.compile(r'答案[:：]\s*(.+?)\s*$')

    def flush():
        nonlocal current_q
        if current_q is not None:
            # 清理选项
            current_q['options'] = [o for o in current_q['options'] if o['k'] in 'ABCD']
            # 去重选项
            seen = set()
            deduped = []
            for o in current_q['options']:
                if o['k'] not in seen:
                    seen.add(o['k'])
                    deduped.append(o)
            current_q['options'] = deduped
            questions.append(current_q)
            current_q = None

    for line in texts:
        # 章标题
        if chapter_pat.match(line):
            flush()
            current_chapter = line
            current_qtype = ''
            continue

        # 题型标题
        if qtype_pat.match(line):
            flush()
            current_qtype = line
            continue

        # 题目开始
        m = qstart_pat.match(line)
        if m and current_qtype:
            flush()
            num = m.group(1)
            rest = m.group(2)

            # 提取年份
            year_m = re.match(r'[（(](\d{4})[）)]\s*', rest)
            year = year_m.group(1) if year_m else None
            stem = re.sub(r'^[（(]\d{4}[）)]\s*', '', rest) if year_m else rest

            # 检查行内是否有答案
            ans_m = answer_pat.search(line)
            if ans_m:
                answer = ans_m.group(1).strip()
                # 移除答案部分，保留题干
                stem = answer_pat.sub('', stem).strip()
            else:
                answer = None

            current_q = {
                'num': num,
                'year': year,
                'stem': stem,
                'options': [],
                'answer': answer,
                'image': None,
                'chapter': current_chapter,
                'qtype': current_qtype,
            }
            continue

        # 如果当前有题目在处理
        if current_q is not None:
            # 检查答案
            ans_m = answer_pat.search(line)
            if ans_m:
                current_q['answer'] = ans_m.group(1).strip()
                # 如果行内还有选项内容，提取
                before_ans = answer_pat.sub('', line).strip()
                if before_ans:
                    opt_m = opt_pat.match(before_ans)
                    if opt_m:
                        current_q['options'].append({'k': opt_m.group(1), 'v': opt_m.group(2).strip()})
                continue

            # 检查选项
            opt_m = opt_pat.match(line)
            if opt_m:
                current_q['options'].append({'k': opt_m.group(1), 'v': opt_m.group(2).strip()})
                continue

            # 其他内容追加到题干或最后一个选项
            if current_q['options']:
                current_q['options'][-1]['v'] += ' ' + line
            else:
                current_q['stem'] += ' ' + line

    flush()
    return questions


def build_book(questions, book_id, title, subject):
    """构建 book JSON 结构"""
    chapters = {}

    for q in questions:
        ch = q['chapter'] or '未分章'
        qt = q['qtype'] or '其他'

        if ch not in chapters:
            chapters[ch] = {}
        if qt not in chapters[ch]:
            chapters[ch][qt] = []

        # 生成 _qid
        ch_idx = list(chapters.keys()).index(ch)
        qt_idx = list(chapters[ch].keys()).index(qt)
        q['_qid'] = f"q_{ch_idx}_{qt_idx}_{q['num']}"

        chapters[ch][qt].append(q)

    total = sum(sum(len(qs) for qs in qtypes.values()) for qtypes in chapters.values())
    qtypes_count = sum(len(qtypes) for qtypes in chapters.values())

    return {
        'id': book_id,
        'title': title,
        'subject': subject,
        'category': '408',
        'year': 2025,
        'source': 'docx',
        'total_questions': total,
        'qtypes_count': qtypes_count,
        'chapters': chapters,
    }


def main():
    if len(sys.argv) < 2:
        print('用法: python scripts/parse-ct-book.py "计组题册.docx"')
        sys.exit(1)

    docx_path = sys.argv[1]
    if not os.path.exists(docx_path):
        print(f'错误: 文件不存在 {docx_path}')
        sys.exit(1)

    book_id = '408-ct'
    title = '计算机组成原理基础题册'
    subject = '计算机组成原理'

    print(f'[*] 解析 {docx_path} ...')
    texts = extract_text_from_docx(docx_path)
    print(f'[*] 共 {len(texts)} 行文本')

    print(f'[*] 提取题目 ...')
    questions = parse_questions(texts)
    print(f'[*] 共提取 {len(questions)} 道题')

    # 统计
    chapters = {}
    for q in questions:
        ch = q['chapter'] or '未分章'
        chapters.setdefault(ch, 0)
        chapters[ch] += 1

    print(f'\n[*] 章节统计:')
    for ch, count in chapters.items():
        print(f'  {ch}: {count} 题')

    # 检查缺失答案
    missing = [q for q in questions if not q['answer']]
    if missing:
        print(f'\n[!] {len(missing)} 道题缺失答案:')
        for q in missing[:10]:
            print(f'  {q["chapter"]} - {q["qtype"]} - 第{q["num"]}题: {q["stem"][:50]}...')

    print(f'\n[*] 构建 book JSON ...')
    book = build_book(questions, book_id, title, subject)

    # 输出
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'books')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f'{book_id}.json')

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(book, f, ensure_ascii=False, separators=(',', ':'))

    print(f'\n🎉 完成!')
    print(f'  书名: {title}')
    print(f'  学科: {subject}')
    print(f'  题目: {book["total_questions"]} 题 / {book["qtypes_count"]} 个题型')
    print(f'  输出: {out_path}')


if __name__ == '__main__':
    main()
