# -*- coding: utf-8 -*-
"""
docx → book.json 转换工具

用法：
  python tools/docx2book.py 题册.docx --id 408-os --title "操作系统基础题册" --subject 操作系统 --category 408 --year 2025

参数：
  题册.docx        必填，输入文件
  --id             必填，书 ID（英文/数字，用于 localStorage key 和文件名）
  --title          选填，书名（默认用 docx 文件名）
  --subject        选填，学科名（默认 "未分类"）
  --category       选填，分类（408 / 公共课 / 其他，默认 "其他"）
  --year           选填，年份（默认当前年）

输出：
  books/{id}.json   题册数据
  books/{id}/images/  配图（如果有）
  books/index.json    自动更新书库索引
"""
import argparse
import json
import os
import re
import shutil
import sys
import xml.etree.ElementTree as ET
import zipfile

NS_W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
NS_R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'

# 复用之前的解析模式
QTYPE_PAT = re.compile(r'^题型[一二三四五六七八九十百]+[:：].*$')
QSTART_PAT = re.compile(r'^(\d+)\.\s*(.*)$')
OPT_PAT = re.compile(r'^([A-D])[\.\s]\s*(.*)$')
ROMAN_PAT = re.compile(r'^[IVXⅠⅡⅢⅣⅤ]+\.\s*')
ANS_PAT = re.compile(r'答案[:：]\s*(.+?)\s*$')
MULTI_OPT_PAT = re.compile(r'(?<![a-zA-Z])([A-D])\.\s*(.*?)(?=(?<![a-zA-Z])[A-D]\.|$)')

# 8 个原始 chapter 标题模式 → 最终章号（1-5），可在 main 中扩展
DEFAULT_CHAPTER_MAP = [
    (re.compile(r'第[一二三四五六七八九十]+章'), None),  # 动态归到下一章
]


def extract_docx(docx_path, work_dir):
    """解压 docx 到 work_dir"""
    if os.path.exists(work_dir):
        shutil.rmtree(work_dir)
    os.makedirs(work_dir)
    with zipfile.ZipFile(docx_path, 'r') as z:
        z.extractall(work_dir)


def extract_images(work_dir, target_dir):
    """从 word/media 拷到 target_dir，返回 {filename: relpath}"""
    src = os.path.join(work_dir, 'word', 'media', 'image')
    if not os.path.exists(src):
        return {}
    os.makedirs(target_dir, exist_ok=True)
    rels = {}
    for f in os.listdir(src):
        if f.lower().endswith(('.jpeg', '.jpg', '.png', '.gif', '.bmp')):
            shutil.copy2(os.path.join(src, f), os.path.join(target_dir, f))
            rels[f] = f
    return rels


def is_chapter_header(text):
    """判断是否为章标题（操作系统第X章...）"""
    return text.startswith('操作系统第') and '章' in text[:20]


def is_qtype_header(text):
    return QTYPE_PAT.match(text.strip()) is not None


def is_known_chapter(text, chapter_map):
    """如果 chapter_map 中显式列出，匹配；否则按 '操作系统第X章' 自动归章"""
    if text in chapter_map:
        return chapter_map[text]
    if is_chapter_header(text):
        # 提取第几章
        m = re.search(r'第([一二三四五六七八九十]+)章', text)
        if m:
            ch_map = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}
            n = ch_map.get(m.group(1), 1)
            # 408 标准：1=概述 2=进程 3=内存 4=文件 5=设备
            # 解析时遇到的"第N章"标题视为新章，但仅当 N<=5 时切换主章；否则挂到当前主章
            return min(n, 5)
    return None


def parse_questions(doc_xml_path, rels_path):
    """解析 document.xml，返回扁平化的题目列表（含 ch/qtype 元数据）"""
    # 关系
    rels_map = {}
    rels_root = ET.parse(rels_path).getroot()
    for r in rels_root.iter('{http://schemas.openxmlformats.org/package/2006/relationships}Relationship'):
        rels_map[r.get('Id')] = r.get('Target')

    # 遍历 body
    tree = ET.parse(doc_xml_path)
    body = tree.getroot().find(NS_W + 'body')

    sequence = []
    for child in list(body):
        tag = child.tag.split('}')[-1]
        if tag == 'p':
            parts = [t.text for t in child.iter(NS_W + 't') if t.text]
            text = ''.join(parts)
            if text.strip():
                sequence.append({'kind': 'p', 'text': text})
        elif tag == 'pict':
            relid = None
            for img in child.iter('{urn:schemas-microsoft-com:vml}imagedata'):
                relid = img.get(NS_R + 'id')
                break
            if relid:
                target = rels_map.get(relid, '')
                fname = target.split('/')[-1]
                sequence.append({'kind': 'img', 'file': fname})

    # 分组
    questions = []
    cur_ch = None
    cur_ch_idx = 0
    cur_qtype = None
    cur_q = None

    def flush():
        nonlocal cur_q
        if cur_q is not None:
            questions.append(cur_q)
            cur_q = None

    for item in sequence:
        if item['kind'] == 'img':
            if cur_q is not None:
                cur_q['image'] = item['file']
            elif questions:
                questions[-1]['image'] = item['file']
            continue
        text = item['text'].strip()
        if not text:
            continue
        if is_chapter_header(text):
            flush()
            cur_ch = text
            cur_ch_idx += 1
            cur_qtype = None
            continue
        if is_qtype_header(text):
            flush()
            cur_qtype = text
            continue
        m = QSTART_PAT.match(text)
        if m and (cur_qtype is not None or cur_ch is not None):
            flush()
            num, rest = m.group(1), m.group(2)
            year_m = re.match(r'^\((20\d{2})\)\s*', rest)
            year = year_m.group(1) if year_m else None
            stem = re.sub(r'^\(20\d{2}\)\s*', '', rest) if year_m else rest
            # 切分题干内嵌的 A.X（即使只有 1 个也要切）
            cur_options = []
            stem_opts = MULTI_OPT_PAT.findall(stem)
            if len(stem_opts) >= 1:
                first = re.search(r'(?<![a-zA-Z])[A-D]\.', stem)
                if first:
                    stem = stem[:first.start()].strip()
                cur_options = [{'k': k, 'v': v.strip()} for k, v in stem_opts]
            cur_q = {
                'num': num, 'year': year, 'stem': stem,
                'options': cur_options, 'answer': None, 'image': None,
                'qtype': cur_qtype or '其他', 'chapter': cur_ch or '未分章',
            }
            continue
        if cur_q is not None:
            # 一行内 Roman 子项 + A. 选项
            m_split = re.search(r'(?<=[一-鿿IVXⅠⅡⅢⅣⅤ0-9])[A-D]\.', text)
            if m_split and re.search(r'[IVXⅠⅡⅢⅣⅤ]+\.', text[:m_split.start()]):
                pre = text[:m_split.start()].strip()
                post = text[m_split.start():].strip()
                if pre:
                    cur_q['stem'] += ' ' + pre
                    text = post
            ans_m = ANS_PAT.search(text)
            if ans_m:
                cur_q['answer'] = ans_m.group(1).strip()
                opt_text = ANS_PAT.sub('', text).strip()
                if opt_text:
                    sub_opts = MULTI_OPT_PAT.findall(opt_text)
                    if len(sub_opts) >= 2:
                        for k, v in sub_opts:
                            cur_q['options'].append({'k': k, 'v': v.strip()})
                    else:
                        opt_m = OPT_PAT.match(opt_text)
                        if opt_m:
                            cur_q['options'].append({'k': opt_m.group(1), 'v': opt_m.group(2).strip()})
                        elif cur_q['options']:
                            cur_q['options'][-1]['v'] += ' ' + opt_text
                        else:
                            cur_q['options'].append({'k': '?', 'v': opt_text})
                flush()
                continue
            opt_m = OPT_PAT.match(text)
            if opt_m:
                sub_opts = MULTI_OPT_PAT.findall(text)
                if len(sub_opts) >= 2:
                    for k, v in sub_opts:
                        cur_q['options'].append({'k': k, 'v': v.strip()})
                else:
                    cur_q['options'].append({'k': opt_m.group(1), 'v': opt_m.group(2).strip()})
            elif ROMAN_PAT.match(text):
                if cur_q['options']:
                    cur_q['options'][-1]['v'] += ' ' + text
                else:
                    cur_q['stem'] += ' ' + text
            else:
                sub_opts = MULTI_OPT_PAT.findall(text)
                if len(sub_opts) >= 2:
                    for k, v in sub_opts:
                        cur_q['options'].append({'k': k, 'v': v.strip()})
                elif cur_q['options']:
                    cur_q['options'][-1]['v'] += ' ' + text
                else:
                    cur_q['stem'] += ' ' + text
    flush()
    return questions


def build_book(questions, meta):
    """从题目列表构建 book 结构"""
    # 归到 5 个最终章
    CHAPTER_MAP = {
        '操作系统第一章题型精讲': 1,
        '操作系统第二章基础题型（一）': 2,
        '操作系统基础题型（二）': 2,
        '操作系统第二章基础题型（二）': 2,
        '操作系统第二章基础题型（四）': 2,
        '操作系统第三章题型直播（一）': 3,
        '操作系统第三章基础题型（二）': 3,
        '操作系统第四章基础题型': 4,
        '操作系统第五章基础题型': 5,
    }
    SECTION_TITLES = {1: '操作系统概述', 2: '进程与处理机管理', 3: '内存管理', 4: '文件管理', 5: '设备管理与磁盘'}

    # 结构：{final_chapter_name: {qtype: [questions]}}
    chapters = {}
    for ch in SECTION_TITLES.values():
        chapters[ch] = {}
    cur_final = None
    for q in questions:
        ch = q.get('chapter', '')
        # 优先用 CHAPTER_MAP 显式映射
        if ch in CHAPTER_MAP:
            cur_final = SECTION_TITLES[CHAPTER_MAP[ch]]
        else:
            # 兜底：按当前 final
            if cur_final is None:
                cur_final = SECTION_TITLES[1]
        qtype = q.get('qtype', '其他')
        chapters[cur_final].setdefault(qtype, []).append(q)

    # 给题目加 qid
    all_qids = []
    for ch_name in chapters:
        for qt in chapters[ch_name]:
            qts = chapters[ch_name][qt]
            for i, q in enumerate(qts):
                q['_qid'] = f"q_{list(chapters.keys()).index(ch_name)}_{list(chapters[ch_name].keys()).index(qt)}_{q['num']}"
                all_qids.append(q['_qid'])

    book = {
        'id': meta['id'],
        'title': meta['title'],
        'subject': meta['subject'],
        'category': meta['category'],
        'year': meta['year'],
        'source': 'docx',
        'total_questions': len(all_qids),
        'qtypes_count': sum(len(chapters[ch]) for ch in chapters),
        'chapters': chapters,
    }
    return book


def update_index(books_dir, book_meta):
    """更新 books/index.json"""
    index_path = os.path.join(books_dir, 'index.json')
    if os.path.exists(index_path):
        with open(index_path, 'r', encoding='utf-8') as f:
            idx = json.load(f)
    else:
        idx = {'version': 1, 'updated': '', 'books': []}
    # 替换同名
    idx['books'] = [b for b in idx['books'] if b['id'] != book_meta['id']]
    idx['books'].append({
        'id': book_meta['id'],
        'title': book_meta['title'],
        'subject': book_meta['subject'],
        'category': book_meta['category'],
        'year': book_meta['year'],
        'total_questions': book_meta['total_questions'],
        'qtypes_count': book_meta['qtypes_count'],
        'file': f"{book_meta['id']}.json",
    })
    idx['updated'] = book_meta['year_str']
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(idx, f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(description='将 docx 题册转换为 book.json')
    parser.add_argument('docx', help='输入的 docx 文件路径')
    parser.add_argument('--id', required=True, help='书 ID（英文/数字，用于文件名）')
    parser.add_argument('--title', help='书名（默认用 docx 文件名去后缀）')
    parser.add_argument('--subject', default='未分类', help='学科名')
    parser.add_argument('--category', default='其他', help='分类（408 / 公共课 / 其他）')
    parser.add_argument('--year', type=int, default=0, help='年份（默认当前年）')
    parser.add_argument('--books-dir', default=None, help='books 目录（默认：脚本同级 ../books）')
    args = parser.parse_args()

    if not os.path.exists(args.docx):
        print(f'错误：找不到文件 {args.docx}')
        sys.exit(1)

    if args.year == 0:
        from datetime import datetime
        args.year = datetime.now().year

    if not args.title:
        args.title = os.path.splitext(os.path.basename(args.docx))[0]

    if args.books_dir is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        args.books_dir = os.path.normpath(os.path.join(script_dir, '..', 'books'))

    work_dir = os.path.join(args.books_dir, '_tmp_' + args.id)
    print(f'[*] 解压 {args.docx} ...')
    extract_docx(args.docx, work_dir)

    # 提取图片
    img_dir = os.path.join(args.books_dir, args.id, 'images')
    print(f'[*] 提取图片到 {img_dir} ...')
    extract_images(work_dir, img_dir)

    # 解析题目
    print(f'[*] 解析题目 ...')
    doc_xml = os.path.join(work_dir, 'word', 'document.xml')
    rels_xml = os.path.join(work_dir, 'word', '_rels', 'document.xml.rels')
    questions = parse_questions(doc_xml, rels_xml)
    print(f'[*] 共解析 {len(questions)} 道题')

    # 构建 book
    meta = {
        'id': args.id,
        'title': args.title,
        'subject': args.subject,
        'category': args.category,
        'year': args.year,
        'total_questions': len(questions),
        'qtypes_count': 0,  # build_book 后再填
        'year_str': str(args.year),
    }
    book = build_book(questions, meta)
    meta['qtypes_count'] = book['qtypes_count']

    # 写入 book.json
    book_path = os.path.join(args.books_dir, f'{args.id}.json')
    with open(book_path, 'w', encoding='utf-8') as f:
        json.dump(book, f, ensure_ascii=False, separators=(',', ':'))
    print(f'[✓] 写入 {book_path}')

    # 更新 index.json
    update_index(args.books_dir, meta)
    print(f'[✓] 更新 books/index.json')

    # 清理
    shutil.rmtree(work_dir, ignore_errors=True)

    print()
    print(f'🎉 完成！')
    print(f'  书名：{meta["title"]}')
    print(f'  学科：{meta["subject"]} ({meta["category"]})')
    print(f'  题目：{meta["total_questions"]} 题 / {meta["qtypes_count"]} 个题型')
    print(f'  图片：{img_dir}')
    print()
    print(f'浏览器打开 index.html 即可看到新书。')


if __name__ == '__main__':
    main()
