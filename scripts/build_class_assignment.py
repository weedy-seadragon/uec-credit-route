"""複数セクション（クラス）がある科目について、「このクラスがどれか」だけを
埋めればよい形のCSV（data/timetable/class_assignment.csv）を作る。

科目名・曜日時限・担当教員は data/subjects/youran-2025.json の offerings に
既にあるので、そこから1行ずつ機械的に埋めて出力する。人間が書き込むのは
class_id列（受講対象クラス）だけでよい。

data/timetable/class_schedule.csv（時間割PDFを書き起こしたもの。今のところ
A1=1年前期分のみ）に、同じ科目名・曜日時限・担当教員の行があれば、
そこからclass_idを自動で埋める（status列が"auto"になる）。
class_schedule.csvにA2・A3…と追記していくほど、自動で埋まる行が増える。

再実行しても、既存の記入済みデータ（data/timetable/class_assignment_filled.csv があれば
そちらを優先、無ければ data/timetable/class_assignment.csv）に人が書き込んだclass_id
（空でないもの）は上書きしない（そのまま引き継ぐ）。空欄のままだった行にだけ、
新しい自動解決結果を入れる。

引き継ぎのキーは「科目コード・学期・曜日・時限」で、担当教員名は含めない
（シラバスの年度を切り替えると、同じ時限でも担当教員が変わることがあるが、
その時限に来るクラスは変わらない、という前提。2026-09-05にシラバスの年度を
2025→2026に切り替えた際、担当教員名だけ変わったケースが見つかったため）。

英語系科目（Academic Spoken English等）は、そもそもクラスを聞かない方針
（CLAUDE.md参照。曜日時限は範囲表示で済ませる）なので対象外にしている。

実行: python scripts/build_class_assignment.py
"""
import csv, json, os, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SUBJECTS_PATH = os.path.join(ROOT, "data", "subjects", "youran-2025.json")
SCHEDULE_PATH = os.path.join(ROOT, "data", "timetable", "class_schedule.csv")
OUT_PATH = os.path.join(ROOT, "data", "timetable", "class_assignment.csv")
FILLED_PATH = os.path.join(ROOT, "data", "timetable", "class_assignment_filled.csv")


def norm_name(name: str) -> str:
    return re.sub(r"[\s　【】\[\]（）()春夏秋冬]", "", name)


def teacher_tokens(text: str) -> set[str]:
    tokens = re.split(r"[・,、]", text)
    # 姓のみ・フルネームどちらの表記でも比較できるよう、空白（全角・半角）も取り除く
    return {re.sub(r"[\s　]", "", t).lstrip("○*〇") for t in tokens if t.strip()}


def teacher_overlaps(tokens_a: set[str], tokens_b: set[str]) -> bool:
    return any(a and b and (a in b or b in a) for a in tokens_a for b in tokens_b)


def find_existing(existing_by_key: dict, code: str, term: str, day: str, period: str, my_tokens: set[str]):
    """同じ(科目・学期・曜日・時限)の記入済み行を探す。
    同時限に教員違いの複数セクションがある科目（例:分子生物学の学籍番号偶数/奇数クラス）は
    1つのキーに複数行がぶら下がることがあるので、教員名が重なる行を優先して選ぶ。
    1件しか無ければ教員名が変わっていても（シラバス年度の切り替え等で）そのまま使う。"""
    candidates = existing_by_key.get((code, term, day, period), [])
    if len(candidates) == 1:
        return candidates[0]
    for c in candidates:
        if teacher_overlaps(my_tokens, teacher_tokens(c["instructors"])):
            return c
    return None


def main():
    with open(SUBJECTS_PATH, encoding="utf-8") as f:
        subjects = json.load(f)["subjects"]

    schedule_rows = []
    if os.path.exists(SCHEDULE_PATH):
        with open(SCHEDULE_PATH, encoding="utf-8-sig") as f:
            schedule_rows = list(csv.DictReader(f))

    # 既存の記入済みデータに人が書き込んだclass_idは、再生成時も引き継ぐ
    # （このスクリプトを再実行するたびに手書き分が消えてしまうと運用が壊れるため）。
    # class_assignment_filled.csv（実際に記入している方）があればそちらを優先する
    existing_source = FILLED_PATH if os.path.exists(FILLED_PATH) else OUT_PATH
    existing_by_key: dict[tuple[str, str, str, str], list[dict]] = {}
    if os.path.exists(existing_source):
        with open(existing_source, encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                key = (r["subject_code"], r["term"], r["day"], r["period"])
                existing_by_key.setdefault(key, []).append(r)

    # 突き合わせを速くするため、科目名(正規化)＋曜日＋時限をキーにして時間割データを引けるようにする
    schedule_by_key: dict[tuple[str, str, str], list[dict]] = {}
    for r in schedule_rows:
        key = (norm_name(r["subject_name"]), r["day"], r["period"])
        schedule_by_key.setdefault(key, []).append(r)

    out_rows = []
    for s in subjects:
        offerings = s.get("offerings") or []
        if len(offerings) <= 1:
            continue  # セクションが1つだけの科目は既にMainPageで表示できているので対象外
        if "English" in s["name"]:
            continue  # 英語系は範囲表示にする方針なので対象外（CLAUDE.md参照）
        if all(len(o["slots"]) == 0 for o in offerings):
            continue  # インターンシップ等、そもそも曜日時限が無い科目は解決しようがないので対象外

        for o in offerings:
            slots = o["slots"] or [{"day": "", "period": ""}]
            instructors_text = "・".join(o["instructors"])
            my_tokens = teacher_tokens(instructors_text)
            for slot in slots:
                day = slot.get("day", "")
                period = str(slot.get("period", ""))
                key = (norm_name(s["name"]), day, period)
                candidates = schedule_by_key.get(key, [])
                # 担当教員名が1人でも重なっている時間割データの行だけを採用する
                matched = [
                    c for c in candidates
                    if teacher_overlaps(my_tokens, teacher_tokens(c["teacher_name"]))
                ]
                if matched:
                    class_ids = sorted({f"{c['pdf']}-{c['class_id']}" for c in matched})
                    class_id = ",".join(class_ids)
                    status = "auto"
                else:
                    class_id = ""
                    status = ""
                note = ""
                existing = find_existing(existing_by_key, s["code"], o["term"], day, period, my_tokens)
                if existing and existing["class_id"]:
                    class_id = existing["class_id"]
                    status = existing["status"]
                    # note列は"note"または"note(特筆事項)"のどちらの見出しでも読めるようにする
                    note = existing.get("note") or existing.get("note(特筆事項)") or ""
                out_rows.append([
                    s["code"], s["name"], o["term"], day, period,
                    instructors_text, class_id, status, note,
                ])

    with open(OUT_PATH, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "subject_code", "subject_name", "term", "day", "period",
            "instructors", "class_id", "status", "note",
        ])
        w.writerows(out_rows)

    auto = sum(1 for r in out_rows if r[7] == "auto")
    print(f"出力: {len(out_rows)}行（うち自動で埋まったもの {auto}行）")


if __name__ == "__main__":
    main()
