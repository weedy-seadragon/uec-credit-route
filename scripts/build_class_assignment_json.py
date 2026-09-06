"""data/timetable/class_assignment_filled.csv（class_idが人手で埋まったもの）から、
アプリが読み込める data/timetable/class_assignment.json を作る。

class_idが空の行（＝まだ解決できていない行）は含めない。
教員名など、アプリ側の判定に使わない列は落とし、code/term/day/period/classIdsだけにする
（1つのofferingに複数の受講対象クラスがある場合は class_ids を配列で持つ）。

class_idの文字列の解釈（「クラス3」「メディア情報学プログラム」「Aクラス」「I3クラス」
「Mエリア」「Mエリア(2クラス)」など）は、TypeScript側（src/domain/classAssignment.ts）で行う。
このスクリプトでは文字列をそのまま右から左に運ぶだけにする。

periodは通常1つの数字だが、「3限・4限で1つの科目」のように連続する複数時限にまたがる
講義は、period列に「3,4」（半角・全角どちらのカンマも可）とまとめて書いてよい。
その場合はperiodごとに別々のJSONエントリ（同じclassIds）に展開する
（2026-09-06、開発者から「3,4限で一科目の授業をどうにかしたい」との相談を受けて対応）。

実行: python scripts/build_class_assignment_json.py
"""
import csv, json, os, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "data", "timetable", "class_assignment_filled.csv")
OUT = os.path.join(ROOT, "data", "timetable", "class_assignment.json")


def main():
    with open(SRC, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    out = []
    for r in rows:
        class_id = r.get("class_id", "").strip()
        if not class_id:
            continue
        periods = [p.strip() for p in re.split(r"[,，]", r["period"]) if p.strip()]
        for period in periods:
            out.append({
                "code": r["subject_code"],
                "term": r["term"],
                "day": r["day"],
                "period": period,
                "classIds": [t.strip() for t in class_id.split(",") if t.strip()],
            })

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"完了: {len(out)}件")


if __name__ == "__main__":
    main()
