"""開講情報（offerings）が1件も無い科目について、シラバスの個別ページを確かめて後から補う。

実行: python scripts/backfill_missing_offerings.py

scripts/fetch_syllabus.py は 2025年度の科目マスタにある科目名しか取得しないため、
2026年度に新設された科目（例: サイエンス工房A/B、海外研修Ⅰ・Ⅱ）や、前回の取得後にシラバス側の
科目番号欄が更新された科目は offerings が空のまま残る（2026-09-27、開発者依頼の点検で発覚）。
このスクリプトは、全年度の科目マスタから「offerings が空で、名前がシラバス一覧の行と一致する科目」を
集め、その行の個別ページだけを開いて科目番号欄を読む。**科目番号欄にその科目番号が明記されている
ページだけ**を offerings として付ける（名前が同じでも番号の無いページには付けない。誤った時限を
付けないため）。取得は既存と同じく1.2秒間隔・連絡先入りのUser-Agent。
"""
import glob, json, os, re, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_syllabus import (  # noqa: E402  （一覧の解析・名前の正規化・個別ページの取得を共用する）
    CODE_CELL_RE, DETAIL_URL_TMPL, FACULTIES, LIST_URL_TMPL, REQUEST_INTERVAL_SEC,
    fetch, normalize_for_match, parse_list, parse_slots, section_label, strip_class_suffix,
)

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def load_subject_files() -> dict[str, dict]:
    """年度ごとの科目マスタを、ファイルパス→内容の辞書で読み込む。"""
    files = {}
    # data/subjects/youran-*.json をすべて対象にする（年度が増えてもそのまま動くように）
    for path in sorted(glob.glob(os.path.join(ROOT, "data", "subjects", "youran-*.json"))):
        with open(path, encoding="utf-8") as f:
            files[path] = json.load(f)
    return files


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
    for i, faculty in enumerate(FACULTIES):
        # 2ページ目以降は、サーバー負荷を避けるため間隔を空けてから取得する
        if i > 0:
            time.sleep(REQUEST_INTERVAL_SEC)
        for row in parse_list(fetch(LIST_URL_TMPL.format(faculty=faculty))):
            key = normalize_for_match(strip_class_suffix(row["name"]))
            # 名前が一致し、個別ページへのリンクがある行だけを残す
            if row["href"] and key in missing_codes_by_name:
                target_rows.append((faculty, row, missing_codes_by_name[key]))
    print(f"個別ページを確認する行: {len(target_rows)}件", file=sys.stderr)

    # 個別ページの科目番号欄に明記された科目番号 → 付ける offering の一覧
    offerings_by_code: dict[str, list[dict]] = {}
    for faculty, row, codes in target_rows:
        time.sleep(REQUEST_INTERVAL_SEC)
        detail_html = fetch(DETAIL_URL_TMPL.format(faculty=faculty, code=row["timetableCode"]))
        m = CODE_CELL_RE.search(detail_html)
        page_codes = set(m.group(1).split()) if m else set()
        # 科目番号欄に書かれていない番号には付けない（名前だけの一致は根拠にしない）
        for code in sorted(codes & page_codes):
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
            offerings_by_code.setdefault(code, []).append(offering)

    # 各年度の科目マスタで、offerings が空のままの科目にだけ書き込む（既存の offerings は触らない）
    for path, data in files.items():
        changed = []
        for subject in data["subjects"]:
            if subject.get("offerings") or subject["code"] not in offerings_by_code:
                continue
            subject["offerings"] = offerings_by_code[subject["code"]]
            changed.append(subject["code"])
        # 変更の無いファイルは書き直さない（改行コード等の余計な差分を出さないため）
        if changed:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write("\n")
        print(f"{os.path.basename(path)}: {len(changed)}科目に開講情報を追加 {sorted(changed)}", file=sys.stderr)


if __name__ == "__main__":
    main()
