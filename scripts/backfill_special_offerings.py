"""学期一覧2ページから学域特別講義A/Bの全テーマを全年度データへ反映する。

実行: python scripts/backfill_special_offerings.py
"""
import glob, json, os, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_syllabus import (  # noqa: E402  （共通の一覧取得・テーマ抽出関数を使う）
    FACULTIES, LIST_URL_TMPL, REQUEST_INTERVAL_SEC, build_special_offerings_by_code, fetch, parse_list,
)
from special_lecture_data import SPECIAL_SUBJECTS, normalize_special_lecture_subjects  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def main():
    # 昼間・夜間主の一覧を取得し、2ページの間には既定の間隔を置く。
    rows_by_faculty = {}
    for index, faculty in enumerate(FACULTIES):
        if index > 0:
            time.sleep(REQUEST_INTERVAL_SEC)
        rows_by_faculty[faculty] = parse_list(fetch(LIST_URL_TMPL.format(faculty=faculty)))
    offerings_by_code = build_special_offerings_by_code(rows_by_faculty, time.strftime("%Y-%m-%d"))
    missing = [code for code, offerings in offerings_by_code.items() if not offerings]
    if missing:
        raise RuntimeError(f"一覧からテーマ行を取得できませんでした: {', '.join(missing)}")

    # A/Bのテーマ情報は全年度の正規科目へ、旧コードは記録保持用の名称だけを反映する。
    for path in sorted(glob.glob(os.path.join(ROOT, "data", "subjects", "youran-*.json"))):
        with open(path, encoding="utf-8") as source:
            data = json.load(source)
        changed = 0
        for subject in data["subjects"]:
            if subject["code"] in SPECIAL_SUBJECTS:
                if subject["code"] in offerings_by_code:
                    subject["offerings"] = offerings_by_code[subject["code"]]
                changed += 1
        normalize_special_lecture_subjects(data["subjects"])
        if changed:
            with open(path, "w", encoding="utf-8") as output:
                json.dump(data, output, ensure_ascii=False, indent=2)
                output.write("\n")
        print(f"{os.path.basename(path)}: 学域特別講義 {changed}科目を更新", file=sys.stderr)

if __name__ == "__main__":
    main()
