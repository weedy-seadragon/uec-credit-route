"""科目マスタの開講学期（termType）を、2026年度の公式シラバスの開講学期に合わせる。

実行: python scripts/sync_term_types.py

「科目自体の属性（科目名・曜日時限・担当教員・単位数）は2026年度の公式シラバスに従う」というルール
（CLAUDE.md）に合わせ、学期も同じ扱いにする（2026-09-27、開発者判断）。学修要覧の学期と、シラバスで
実際に開講される学期が食い違っている科目（例: マルチメディア処理＝要覧は後学期、シラバスは前学期木1）は、
科目一覧の学期表示や修得推奨の学期、再履修枠の判定（classAssignment.ts）がずれてしまうため。

対象は、offerings の開講期がすべて同じ学期（春・夏タームは前学期、秋・冬タームは後学期として数える）に
そろっていて、それが termType と違う科目だけ。通常枠と再履修枠が前後の学期に分かれている科目
（両方の学期に offerings がある）は、どちらが本来の学期か決められないので変えない。
通年の科目・旧区分（legacy）・大学院連携科目も対象外。標準履修学期（standardSemester）も学期に合わせて直す。
"""
import glob, json, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA_DIR = os.path.join(ROOT, "app", "data")

# シラバスの開講期 → 前学期／後学期
SEMESTER_BY_TERM = {
    "前学期": "前学期", "後学期": "後学期",
    "春ﾀｰﾑ": "前学期", "夏ﾀｰﾑ": "前学期", "秋ﾀｰﾑ": "後学期", "冬ﾀｰﾑ": "後学期",
}


def main():
    # 年度ごとの科目マスタをすべて対象にする
    for path in sorted(glob.glob(os.path.join(DATA_DIR, "subjects", "youran-*.json"))):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        changed = []
        for subject in data["subjects"]:
            offerings = subject.get("offerings") or []
            # 開講情報が無い科目・学期が未設定の科目・対象外の科目は触らない
            if not offerings or not subject.get("termType"):
                continue
            if subject.get("legacy") or subject.get("graduateLinked") or "通年" in (subject.get("note") or ""):
                continue
            semesters = {SEMESTER_BY_TERM.get(o["term"]) for o in offerings}
            # 開講期が1つの学期にそろっていて、それが今の学期と違うときだけ直す
            if len(semesters) != 1 or None in semesters:
                continue
            semester = semesters.pop()
            if semester == subject["termType"]:
                continue
            subject["termType"] = semester
            # 標準履修学期は「学年×2−1（前学期）／学年×2（後学期）」の通し番号なので、学年から求め直す
            if subject.get("standardYear"):
                subject["standardSemester"] = subject["standardYear"] * 2 - (1 if semester == "前学期" else 0)
            changed.append(f'{subject["code"]}({subject["name"]}→{semester})')
        # 変更の無いファイルは書き直さない（改行コード等の余計な差分を出さないため）
        if changed:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write("\n")
        print(f"{os.path.basename(path)}: {len(changed)}科目 {changed}", file=sys.stderr)


if __name__ == "__main__":
    main()
