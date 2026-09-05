"""シラバスWeb公開システムから曜日時限・担当教員・シラバスURLを取得し、
data/subjects/youran-2025.json の各科目に offerings（docs/SPEC.md §7.1）として追記する。

実行: python scripts/fetch_syllabus.py

やること：
1. 学期一覧ページ（情報理工学域2025年度）から全科目行（時間割コード・科目名・
   曜日時限・担当教員・個別シラバスページへのリンク）を取得する。学域コードは
   昼間コースが31、夜間主課程が32（2026-09-05に発見。学籍番号末尾s/tの科目名で
   実際に確認済み）の2つがあり、両方まわる
2. 一覧表には科目コード（COM405aのような形式）が載っていないので、まず現在の
   data/subjects/youran-2025.json に載っている科目名と一致する行だけに絞り込む
   （名前が一致しない行の個別ページは開かない＝全1157件ではなく数百件で済む）
3. 絞り込んだ行だけ、個別シラバスページを1件ずつ開いて実際の科目コードを読み取る
   （1つの講義が複数プログラムで共有されている場合、科目番号欄に複数コードが
   空白区切りで並ぶことがある。例: "ELE301a ELE301b ELE301c ELE301d ELE301e"）
4. 読み取ったコードが科目マスタに存在すれば、その科目の offerings に追記する

CLAUDE.md本文のルール通り、個別ページの取得は1.2秒間隔を空け、連絡先入りのUser-Agentを使う。
一覧ページ・個別ページのHTML構造は2026-09-04時点で確認したもの。サイト側の構造が変わったら
正規表現を調整すること。
"""
import json, os, re, sys, time, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SUBJECTS_PATH = os.path.join(ROOT, "data", "subjects", "youran-2025.json")

# 31=昼間コース、32=夜間主課程（先端工学基礎課程）
FACULTIES = ["31", "32"]
LIST_URL_TMPL = "https://kyoumu.office.uec.ac.jp/syllabus/2025/GakkiIchiran_{faculty}_0.html"
DETAIL_URL_TMPL = "https://kyoumu.office.uec.ac.jp/syllabus/2025/{faculty}/{faculty}_{code}.html"
USER_AGENT = "uec-credit-route data collection (https://github.com/weedy-seadragon/uec-credit-route)"
REQUEST_INTERVAL_SEC = 1.2

ROW_RE = re.compile(
    r'<tr onmouseout="TRMouseOut\(this\)" onmouseover="TRMouseOver\(this\)">(.*?)</tr>',
    re.S,
)
TD_RE = re.compile(r"<td[^>]*>(.*?)</td>", re.S)
LINK_RE = re.compile(r'href="([^"]+)">([^<]*)<')
CODE_CELL_RE = re.compile(r"科目番号<br\s*/?>/Code</th>\s*<td[^>]*>([^<]+)</td>")
# 「前もって履修しておくべき科目」欄は自由記述のテキストで、科目コードの一覧ではない
# （例:「なし」「化学関連授業。化学構造式を多く用いて授業を進めます。」）。中身が
# 自由記述である以上、ここから科目コードを機械的に抜き出すのは誤検出のリスクが高いので、
# テキストのまま保存するだけにとどめる（docs/SPEC.md §7.1の`prerequisites`とは別に
# `prerequisitesText`として持つ）。このtdは閉じタグ</td>が無いままになっていることが
# あるHTMLなので、次の<th>が出てくるところまでを内容とみなす
PREREQ_RE = re.compile(r"Prerequisites.*?</th>\s*<td[^>]*>(.*?)<th", re.S)
SLOT_RE = re.compile(r"^([月火水木金土日])(\d+)$")
# 一覧表の科目名には「Academic Written EnglishⅠ（金1・F）」のように、末尾にクラス表記
# （曜日時限・クラス記号）が付いていることが多い。科目マスタの名前にはこの表記が無いので、
# 素の名前と完全一致させるだけだと、クラスが多い科目（語学・実験科目など）を一件も
# 拾えなくなってしまう（2026-09-05に発覚したバグ：本来12クラスある金曜日の授業が
# 1件も取得できず、たまたま名前が完全一致した無関係な1件だけを「唯一の時限」として
# 誤って扱っていた）。末尾の（…）を取り除いた名前でも科目マスタと突き合わせる
TRAILING_PAREN_RE = re.compile(r"[（(][^（）()]*[）)]$")


def strip_class_suffix(name: str) -> str:
    return TRAILING_PAREN_RE.sub("", name).strip()


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req) as res:
        return res.read().decode("utf-8")


def parse_list(html: str):
    rows = []
    for m in ROW_RE.finditer(html):
        tds = [t.strip() for t in TD_RE.findall(m.group(1))]
        if len(tds) < 7:
            continue
        link = LINK_RE.search(tds[5])
        rows.append({
            "no": tds[0],
            "semester": tds[1],
            "dayPeriod": tds[3],
            "timetableCode": tds[4],
            "name": (link.group(2).strip() if link else re.sub(r"<[^>]+>", "", tds[5]).strip()),
            "href": (link.group(1) if link else None),
            "instructor": tds[6],
        })
    return rows


def clean_text(html_fragment: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", html_fragment)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line).strip()


def parse_slots(day_period: str):
    if not day_period or day_period == "他":
        return []
    slots = []
    for token in re.split(r",\s*", day_period):
        m = SLOT_RE.match(token)
        if m:
            slots.append({"day": m.group(1), "period": int(m.group(2))})
    return slots


def main():
    with open(SUBJECTS_PATH, encoding="utf-8") as f:
        subjects_data = json.load(f)
    known_names = {s["name"] for s in subjects_data["subjects"]}
    known_codes = {s["code"] for s in subjects_data["subjects"]}

    offerings_by_code: dict[str, list[dict]] = {}
    prereq_text_by_code: dict[str, str] = {}
    today = time.strftime("%Y-%m-%d")

    for faculty in FACULTIES:
        print(f"[{faculty}] 一覧ページを取得中...", file=sys.stderr)
        list_html = fetch(LIST_URL_TMPL.format(faculty=faculty))
        rows = parse_list(list_html)
        print(f"[{faculty}] 総行数: {len(rows)}", file=sys.stderr)

        candidates = [
            r for r in rows
            if r["href"] and (r["name"] in known_names or strip_class_suffix(r["name"]) in known_names)
        ]
        print(f"[{faculty}] 科目名が一致する行数（個別ページを取得する件数）: {len(candidates)}", file=sys.stderr)

        for i, row in enumerate(candidates, 1):
            url = f"https://kyoumu.office.uec.ac.jp/syllabus/2025/{row['href']}"
            try:
                detail_html = fetch(url)
            except Exception as e:
                print(f"  取得失敗: {row['timetableCode']} {row['name']}: {e}", file=sys.stderr)
                time.sleep(REQUEST_INTERVAL_SEC)
                continue
            m = CODE_CELL_RE.search(detail_html)
            raw_codes = m.group(1).strip().split() if m else []
            matched_codes = [c for c in raw_codes if c in known_codes]
            instructors = [s.strip() for s in re.split(r"[・,、]", row["instructor"]) if s.strip()]
            prereq_m = PREREQ_RE.search(detail_html)
            prereq_text = clean_text(prereq_m.group(1)) if prereq_m else ""
            for code in matched_codes:
                if prereq_text and prereq_text != "なし":
                    prereq_text_by_code[code] = prereq_text
                offerings_by_code.setdefault(code, []).append({
                    "timetableCode": row["timetableCode"],
                    "faculty": faculty,
                    "term": row["semester"],
                    "slots": parse_slots(row["dayPeriod"]),
                    "instructors": instructors,
                    "syllabusUrl": DETAIL_URL_TMPL.format(faculty=faculty, code=row["timetableCode"]),
                    "updatedAt": today,
                })
            if i % 20 == 0:
                print(f"[{faculty}] 進捗: {i}/{len(candidates)}", file=sys.stderr)
            time.sleep(REQUEST_INTERVAL_SEC)

    # シラバスWeb公開システム側の登録ミスと思われる補正（2026-09-05に発覚）：
    # ENG101s（夜間主・Academic Written English I）とENG101z（昼間・同科目）で、
    # 科目番号欄の記載が入れ替わっている。ENG101sの欄には昼間の金曜多クラス分（26件、
    # 学修要覧の昼間用担当教員陣と一致）が、ENG101zの欄には夜間主の1クラス分（土曜、
    # Dusza/Jeffreys担当）が、それぞれ逆に登録されていた。他の夜間主科目にはこの現象は
    # 見られない（この2科目だけの個別の登録ミスと判断）ため、ここで入れ替えて補正する
    CODE_SWAP_FIXUPS = [("ENG101s", "ENG101z")]
    for code_a, code_b in CODE_SWAP_FIXUPS:
        a = offerings_by_code.pop(code_a, None)
        b = offerings_by_code.pop(code_b, None)
        if b is not None:
            offerings_by_code[code_a] = b
        if a is not None:
            offerings_by_code[code_b] = a

    updated = 0
    prereq_updated = 0
    for s in subjects_data["subjects"]:
        if s["code"] in offerings_by_code:
            s["offerings"] = offerings_by_code[s["code"]]
            updated += 1
        if s["code"] in prereq_text_by_code:
            s["prerequisitesText"] = prereq_text_by_code[s["code"]]
            prereq_updated += 1

    with open(SUBJECTS_PATH, "w", encoding="utf-8") as f:
        json.dump(subjects_data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"完了: offerings付与 {updated} 科目、prerequisitesText付与 {prereq_updated} 科目 / 全体 {len(subjects_data['subjects'])}", file=sys.stderr)


if __name__ == "__main__":
    main()
