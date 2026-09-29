"""開講情報（offerings）が1件も無い科目について、シラバスの個別ページを確かめて後から補う。

実行: python scripts/backfill_missing_offerings.py

scripts/fetch_syllabus.py は 2025年度の科目マスタにある科目名しか取得しないため、
2026年度に新設された科目（例: サイエンス工房A/B、海外研修Ⅰ・Ⅱ）や、前回の取得後にシラバス側の
科目番号欄が更新された科目は offerings が空のまま残る（2026-09-27、開発者依頼の点検で発覚）。
このスクリプトは、全年度の科目マスタから「offerings が空で、名前がシラバス一覧の行と一致する科目」を
集め、その行の個別ページだけを開いて科目番号欄を読む。次のどれかに当てはまるページだけを offerings として付ける。
1. 科目番号欄にその科目番号が明記されている
2. 科目番号欄が空欄（例: Topics in Informatics Ⅰ）で、科目名が完全に一致する
3. 科目番号欄に書かれた番号が、すべて同じ科目名の別の科目番号（例: 同じ授業を「上級科目扱い」で
   数える INT502z と、シラバスに載っている ENG502z。形式言語理論の COM406a と COM405c/d）
2・3は「シラバスに従う」という開発者の判断（2026-09-27）と、「科目名が同じなら同一科目として扱ってよい」
という判断（2026-09-13）による。番号欄に**別の名前の科目**の番号が書かれているページには付けない
（別の授業の可能性があるため）。取得は既存と同じく1.2秒間隔・連絡先入りのUser-Agent。
学域特別講義A/Bはテーマ付きの表示名を名前照合できないため、一覧接頭辞から科目コードへ直接割り当てる。
"""
import glob, json, os, re, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_syllabus import (  # noqa: E402  （一覧の解析・名前の正規化・個別ページの取得を共用する）
    CODE_CELL_RE, DETAIL_URL_TMPL, FACULTIES, LIST_URL_TMPL, REQUEST_INTERVAL_SEC,
    build_special_offerings_by_code, fetch, normalize_for_match, parse_list, parse_slots, section_label, strip_class_suffix,
)

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA_DIR = os.path.join(ROOT, "app", "data")


def load_subject_files() -> dict[str, dict]:
    """年度ごとの科目マスタを、ファイルパス→内容の辞書で読み込む。"""
    files = {}
    # app/data/subjects/youran-*.json をすべて対象にする（年度が増えてもそのまま動くように）
    for path in sorted(glob.glob(os.path.join(DATA_DIR, "subjects", "youran-*.json"))):
        with open(path, encoding="utf-8") as f:
            files[path] = json.load(f)
    return files


def apply_special_offerings_by_code(
    subjects: list[dict],
    offerings_by_code: dict[str, list[dict]],
) -> list[str]:
    """テーマ名を含む表示名と照合せず、A/B講義のコードで不足情報を補う。"""
    changed_codes = []
    # UEC001z・UEC004zはテーマごとに一覧名が変わるため、科目コードで直接結び付ける。
    for subject in subjects:
        offerings = offerings_by_code.get(subject["code"], [])
        if not offerings or subject.get("offerings") or subject.get("legacy"):
            continue
        subject["offerings"] = offerings
        changed_codes.append(subject["code"])
    return changed_codes


def main():
    today = time.strftime("%Y-%m-%d")
    files = load_subject_files()

    # offerings が空の科目の、正規化した名前 → 科目番号の集合（全年度分をまとめる）
    missing_codes_by_name: dict[str, set[str]] = {}
    for data in files.values():
        # 旧区分（legacy）は引き継ぎ用で開講情報を持たせないため対象外にする
        for subject in data["subjects"]:
            if subject.get("offerings") or subject.get("legacy"):
                continue
            missing_codes_by_name.setdefault(normalize_for_match(subject["name"]), set()).add(subject["code"])

    # シラバス一覧の行のうち、名前が上の科目と一致するものだけを個別ページの取得対象にする
    target_rows = []
    rows_by_faculty = {}
    for i, faculty in enumerate(FACULTIES):
        # 2ページ目以降は、サーバー負荷を避けるため間隔を空けてから取得する
        if i > 0:
            time.sleep(REQUEST_INTERVAL_SEC)
        rows = parse_list(fetch(LIST_URL_TMPL.format(faculty=faculty)))
        rows_by_faculty[faculty] = rows
        for row in rows:
            key = normalize_for_match(strip_class_suffix(row["name"]))
            # 名前が一致し、個別ページへのリンクがある行だけを残す
            if row["href"] and key in missing_codes_by_name:
                target_rows.append((faculty, row, missing_codes_by_name[key]))
    print(f"個別ページを確認する行: {len(target_rows)}件", file=sys.stderr)
    # 学域特別講義の一覧名には年度ごとのテーマが付くため、共通関数でコード別に作る。
    special_offerings_by_code = build_special_offerings_by_code(rows_by_faculty, today)

    # 科目番号 → 正規化した科目名。番号欄の番号はシラバス年度（2026）の採番なので、最新年度の
    # 科目マスタを優先して引く（プログラム記号がずれた古い年度では、同じ番号が別の科目を指すことがあるため）
    name_by_code: dict[str, str] = {}
    for data in reversed(list(files.values())):
        for subject in data["subjects"]:
            name_by_code.setdefault(subject["code"], normalize_for_match(subject["name"]))

    # 付けてよい (科目名, 科目番号) の組 → 付ける offering の一覧。
    # 同じ番号が年度によって別の科目を指すことがあるので、番号だけでなく科目名とセットで持つ
    offerings_by_key: dict[tuple[str, str], list[dict]] = {}
    for faculty, row, codes in target_rows:
        time.sleep(REQUEST_INTERVAL_SEC)
        detail_html = fetch(DETAIL_URL_TMPL.format(faculty=faculty, code=row["timetableCode"]))
        m = CODE_CELL_RE.search(detail_html)
        page_codes = set(m.group(1).split()) if m else set()
        row_name = normalize_for_match(strip_class_suffix(row["name"]))
        if not page_codes:
            # 規則2：番号欄が空欄なら、科目名が一致した科目すべてに付ける
            target_codes = codes
        elif all(name_by_code.get(code) == row_name for code in page_codes):
            # 規則1・3：番号欄の番号がすべて同じ名前の科目なら、同じ名前の科目すべてに付ける
            target_codes = codes
        else:
            # 別の名前の科目の番号が混ざるページは、番号欄に明記された科目にだけ付ける（規則1のみ）
            target_codes = codes & page_codes
        for code in sorted(target_codes):
            offering = {
                "timetableCode": row["timetableCode"],
                "faculty": faculty,
                "term": row["semester"],
                "slots": parse_slots(row["dayPeriod"]),
                "instructors": [s.strip() for s in re.split(r"[・,、]", row["instructor"]) if s.strip()],
                "syllabusUrl": DETAIL_URL_TMPL.format(faculty=faculty, code=row["timetableCode"]),
                "updatedAt": today,
            }
            # クラス表記がある行だけ sectionLabel を付ける（fetch_syllabus.py と同じ形）
            if section_label(row["name"]):
                offering["sectionLabel"] = section_label(row["name"])
            offerings_by_key.setdefault((row_name, code), []).append(offering)

    # 各年度の科目マスタで、offerings が空のままの科目にだけ書き込む（既存の offerings は触らない）。
    # 通常科目は年度別科目名、学域特別講義は科目コードで照合する。
    for path, data in files.items():
        # 表示名を変えた学域特別講義は、科目コードから先に不足データを補う。
        changed = apply_special_offerings_by_code(data["subjects"], special_offerings_by_code)
        for subject in data["subjects"]:
            key = (normalize_for_match(subject["name"]), subject["code"])
            if subject.get("offerings") or subject.get("legacy") or key not in offerings_by_key:
                continue
            subject["offerings"] = offerings_by_key[key]
            changed.append(subject["code"])
        # 変更の無いファイルは書き直さない（改行コード等の余計な差分を出さないため）
        if changed:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write("\n")
        print(f"{os.path.basename(path)}: {len(changed)}科目に開講情報を追加 {sorted(changed)}", file=sys.stderr)


if __name__ == "__main__":
    main()
