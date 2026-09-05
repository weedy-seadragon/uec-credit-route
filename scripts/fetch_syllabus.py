"""シラバスWeb公開システムから曜日時限・担当教員・シラバスURLを取得し、
data/subjects/youran-2025.json の各科目に offerings（docs/SPEC.md §7.1）として追記する。

実行: python scripts/fetch_syllabus.py

やること：
1. 学期一覧ページ（情報理工学域2025年度、学部コード31）から全科目行（時間割コード・科目名・
   曜日時限・担当教員・個別シラバスページへのリンク）を取得する
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

LIST_URL = "https://kyoumu.office.uec.ac.jp/syllabus/2025/GakkiIchiran_31_0.html"
DETAIL_URL_TMPL = "https://kyoumu.office.uec.ac.jp/syllabus/2025/31/31_{code}.html"
USER_AGENT = "uec-credit-route data collection (https://github.com/weedy-seadragon/uec-credit-route)"
REQUEST_INTERVAL_SEC = 1.2

ROW_RE = re.compile(
    r'<tr onmouseout="TRMouseOut\(this\)" onmouseover="TRMouseOver\(this\)">(.*?)</tr>',
    re.S,
)
TD_RE = re.compile(r"<td[^>]*>(.*?)</td>", re.S)
LINK_RE = re.compile(r'href="([^"]+)">([^<]*)<')
CODE_CELL_RE = re.compile(r"科目番号<br\s*/?>/Code</th>\s*<td[^>]*>([^<]+)</td>")
SLOT_RE = re.compile(r"^([月火水木金土日])(\d+)$")


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

    print("一覧ページを取得中...", file=sys.stderr)
    list_html = fetch(LIST_URL)
    rows = parse_list(list_html)
    print(f"総行数: {len(rows)}", file=sys.stderr)

    candidates = [r for r in rows if r["name"] in known_names and r["href"]]
    print(f"科目名が一致する行数（個別ページを取得する件数）: {len(candidates)}", file=sys.stderr)

    offerings_by_code: dict[str, list[dict]] = {}
    today = time.strftime("%Y-%m-%d")
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
        for code in matched_codes:
            offerings_by_code.setdefault(code, []).append({
                "timetableCode": row["timetableCode"],
                "faculty": "31",
                "term": row["semester"],
                "slots": parse_slots(row["dayPeriod"]),
                "instructors": instructors,
                "syllabusUrl": f"https://kyoumu.office.uec.ac.jp/syllabus/2025/31/31_{row['timetableCode']}.html",
                "updatedAt": today,
            })
        if i % 20 == 0:
            print(f"進捗: {i}/{len(candidates)}", file=sys.stderr)
        time.sleep(REQUEST_INTERVAL_SEC)

    updated = 0
    for s in subjects_data["subjects"]:
        if s["code"] in offerings_by_code:
            s["offerings"] = offerings_by_code[s["code"]]
            updated += 1

    with open(SUBJECTS_PATH, "w", encoding="utf-8") as f:
        json.dump(subjects_data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"完了: offerings付与 {updated} 科目 / 全体 {len(subjects_data['subjects'])}", file=sys.stderr)


if __name__ == "__main__":
    main()
