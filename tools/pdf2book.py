# -*- coding: utf-8 -*-
"""
pdf → book.json 转换工具

依赖：pdftotext (poppler-utils，Windows 上一般已自带)

用法：
  python tools/pdf2book.py 题册.pdf --id 408-cn --title "计算机网络题册" --subject 计算机网络 --category 408 --year 2025

参数同 docx2book.py。
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

# 复用 docx2book.py 的解析逻辑
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import docx2book  # 全文引用避免循环
build_book_from_questions = docx2book.build_book
update_index_file = docx2book.update_index


def find_pdftotext():
    """查找 pdftotext 可执行文件"""
    candidates = ['pdftotext']
    # Windows 上常见的 poppler 路径
    for path in [
        r'C:\Program Files\poppler\bin\pdftotext.exe',
        r'C:\Program Files (x86)\poppler\bin\pdftotext.exe',
        r'C:\ProgramData\chocolatey\bin\pdftotext.exe',
        '/mingw64/bin/pdftotext',
    ]:
        if os.path.exists(path):
            return path
    # 在 PATH 中找
    for cand in candidates:
        try:
            subprocess.run([cand, '-v'], capture_output=True, timeout=5)
            return cand
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
    return None


def extract_pdf_text(pdf_path, work_dir):
    """用 pdftotext 提取 PDF 文本为 .txt"""
    txt_path = os.path.join(work_dir, 'extracted.txt')
    pdftotext = find_pdftotext()
    if pdftotext is None:
        raise RuntimeError('找不到 pdftotext，请安装 poppler-utils（Windows 建议用 choco install poppler）')

    # -layout 保留布局，-enc UTF-8 编码
    # 用 \f (form feed) 分页
    cmd = [pdftotext, '-layout', '-enc', 'UTF-8', pdf_path, txt_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f'pdftotext 失败: {result.stderr}')
    if not os.path.exists(txt_path):
        raise RuntimeError('pdftotext 未生成输出文件')
    return txt_path


def clean_text(text):
    """
    清理 PDF 文本：
    - 去页眉页脚（重复行）
    - 去页码
    - 合并断行
    """
    lines = text.split('\n')

    # 1. 去 \f (form feed) 分页
    cleaned_lines = []
    for line in lines:
        # 用 \f 分页，每页单独处理
        parts = line.split('\f')
        for p in parts:
            cleaned_lines.append(p)
        cleaned_lines.append('__PAGE_BREAK__')

    # 2. 去页眉页脚：找每页都出现的短行（页眉/页脚通常是页码或书名）
    # 简单方法：去掉以数字/罗马数字单独成行的（页码），去掉长度<30的重复行
    page_count = cleaned_lines.count('__PAGE_BREAK__')
    if page_count > 2:
        # 统计每行出现次数
        from collections import Counter
        line_counter = Counter(l.strip() for l in cleaned_lines if l.strip() and l.strip() != '__PAGE_BREAK__')
        # 出现次数 > 50% 页数的短行视为页眉/页脚
        threshold = max(2, int(page_count * 0.5))
        header_footer = set()
        for line, count in line_counter.items():
            if count >= threshold and len(line) < 50:
                header_footer.add(line)
        cleaned_lines = [l for l in cleaned_lines if l.strip() not in header_footer]

    # 3. 去孤立的页码行
    page_num_pat = re.compile(r'^\s*-?\s*\d{1,4}\s*-?\s*$|^\s*第\s*\d+\s*页\s*$')
    cleaned_lines = [l for l in cleaned_lines if not page_num_pat.match(l.strip())]

    # 4. 合并段落：去行内多空格，把短行并到上一段
    merged = []
    for line in cleaned_lines:
        if line.strip() == '__PAGE_BREAK__':
            merged.append('\n')  # 段落分隔
        elif line.strip() == '':
            merged.append('\n')
        else:
            # 合并多空格为单空格
            merged.append(re.sub(r'\s+', ' ', line).strip())

    text = '\n'.join(merged)
    # 多个空行合并
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text


def extract_images_from_pdf(pdf_path, target_dir):
    """
    简单提取 PDF 中的图片到 target_dir
    用 pdfimages 工具（poppler 自带），或退回 pymupdf
    """
    os.makedirs(target_dir, exist_ok=True)
    images = []
    # 尝试 pdfimages
    pdfimages = shutil.which('pdfimages') or shutil.which('pdfimages.exe')
    if pdfimages:
        # -j: jpg, -png: png
        try:
            subprocess.run([pdfimages, '-j', '-png', pdf_path, os.path.join(target_dir, 'img')],
                          capture_output=True, timeout=60)
        except Exception:
            pass
    # 列出提取的图片
    for f in sorted(os.listdir(target_dir)):
        if f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp')):
            images.append(f)
    return images


def parse_pdf_to_questions(pdf_path, work_dir):
    """从 PDF 提取并解析为题目列表"""
    txt_path = extract_pdf_text(pdf_path, work_dir)
    with open(txt_path, 'r', encoding='utf-8') as f:
        raw_text = f.read()

    print(f'[*] PDF 文本已提取（{len(raw_text)} 字符），开始清洗...')
    text = clean_text(raw_text)
    print(f'[*] 清洗后 {len(text)} 字符')

    # 把清洗后的文本按行处理，模拟"段落"
    # 但 docx2book 的 parse_questions 需要 sequence 格式（kind: 'p' 或 'img'）
    # 我们用整段作为一个段落
    paragraphs = []
    for para in text.split('\n'):
        para = para.strip()
        if para:
            paragraphs.append({'kind': 'p', 'text': para})

    # 提取图片（pdfimages 提取的）作为全局图，不在题里
    img_dir = os.path.join(work_dir, 'images')
    images = extract_images_from_pdf(pdf_path, img_dir)

    # 直接调用 docx2book 的解析（它接受 sequence）
    # 但 parse_questions 需要 doc_xml_path 和 rels_path
    # 简单做法：复制 parse_questions 的核心逻辑，但接受 sequence
    questions = parse_questions_from_sequence(paragraphs)
    return questions, images


def parse_questions_from_sequence(sequence):
    """
    复用 docx2book 的解析逻辑（去掉了 docx XML 依赖，直接用 sequence）
    """
    NS_W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    QTYPE_PAT = re.compile(r'^题型[一二三四五六七八九十百]+[:：].*$')
    QSTART_PAT = re.compile(r'^(\d+)\.\s*(.*)$')
    OPT_PAT = re.compile(r'^([A-D])[\.\s]\s*(.*)$')
    ROMAN_PAT = re.compile(r'^[IVXⅠⅡⅢⅣⅤ]+\.\s*')
    ANS_PAT = re.compile(r'答案[:：]\s*(.+?)\s*$')
    MULTI_OPT_PAT = re.compile(r'(?<![a-zA-Z])([A-D])\.\s*(.*?)(?=(?<![a-zA-Z])[A-D]\.|$)')

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

    def is_chapter_header(text):
        return text.startswith('操作系统第') and '章' in text[:20]

    def is_qtype_header(text):
        return QTYPE_PAT.match(text.strip()) is not None

    for item in sequence:
        text = item.get('text', '').strip()
        if not text:
            continue
        if is_chapter_header(text):
            flush()
            cur_ch = text
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


def main():
    parser = argparse.ArgumentParser(description='将 PDF 题册转换为 book.json')
    parser.add_argument('pdf', help='输入的 PDF 文件路径')
    parser.add_argument('--id', required=True, help='书 ID')
    parser.add_argument('--title', help='书名（默认用 PDF 文件名）')
    parser.add_argument('--subject', default='未分类', help='学科名')
    parser.add_argument('--category', default='其他', help='分类（408 / 公共课 / 其他）')
    parser.add_argument('--year', type=int, default=0, help='年份')
    parser.add_argument('--books-dir', default=None, help='books 目录')
    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        print(f'错误：找不到文件 {args.pdf}')
        sys.exit(1)

    if args.year == 0:
        from datetime import datetime
        args.year = datetime.now().year

    if not args.title:
        args.title = os.path.splitext(os.path.basename(args.pdf))[0]

    if args.books_dir is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        args.books_dir = os.path.normpath(os.path.join(script_dir, '..', 'books'))

    # 检查 pdftotext
    pdftotext = find_pdftotext()
    if pdftotext is None:
        print('❌ 找不到 pdftotext，请先安装 poppler-utils：')
        print('   Windows: choco install poppler  或  scoop install poppler')
        print('   Mac:     brew install poppler')
        print('   Linux:   apt install poppler-utils  (Debian/Ubuntu)')
        sys.exit(1)

    # 临时工作目录
    work_dir = tempfile.mkdtemp(prefix='pdf2book_')
    print(f'[*] 临时目录：{work_dir}')

    try:
        # 提取并解析
        questions, images = parse_pdf_to_questions(args.pdf, work_dir)
        print(f'[*] 解析出 {len(questions)} 道题，{len(images)} 张图片')

        if not questions:
            print('⚠️  未解析到任何题目。可能原因：')
            print('   1. PDF 是扫描版（图片），需要 OCR')
            print('   2. PDF 排版与预期格式差异较大（请打开 extracted.txt 检查）')
            print('   3. 章节标题不是"操作系统第X章..."格式')

        # 拷贝图片
        img_target = os.path.join(args.books_dir, args.id, 'images')
        os.makedirs(img_target, exist_ok=True)
        for f in images:
            shutil.copy2(os.path.join(work_dir, 'images', f),
                        os.path.join(img_target, f))
        if images:
            print(f'[*] 已拷贝 {len(images)} 张图片到 {img_target}')

        # 构建 book
        meta = {
            'id': args.id,
            'title': args.title,
            'subject': args.subject,
            'category': args.category,
            'year': args.year,
            'total_questions': len(questions),
            'qtypes_count': 0,
            'year_str': str(args.year),
        }
        book = build_book_from_questions(questions, meta)
        meta['qtypes_count'] = book['qtypes_count']

        # 写 book.json
        book_path = os.path.join(args.books_dir, f'{args.id}.json')
        with open(book_path, 'w', encoding='utf-8') as f:
            json.dump(book, f, ensure_ascii=False, separators=(',', ':'))
        print(f'[✓] 写入 {book_path}')

        # 更新 index.json
        update_index_file(args.books_dir, meta)
        print(f'[✓] 更新 books/index.json')

        print()
        print(f'🎉 完成！')
        print(f'  书名：{meta["title"]}')
        print(f'  学科：{meta["subject"]} ({meta["category"]})')
        print(f'  题目：{meta["total_questions"]} 题 / {meta["qtypes_count"]} 个题型')
        print(f'  图片：{len(images)} 张')
        if not questions:
            print(f'\n调试信息：原文已保存到 {work_dir}/extracted.txt')

    finally:
        # 清理临时目录（除非有调试需要）
        if questions and len(questions) > 10:
            shutil.rmtree(work_dir, ignore_errors=True)
        else:
            print(f'\n💡 临时目录保留在 {work_dir}，可查看 extracted.txt 排查问题')


if __name__ == '__main__':
    main()
