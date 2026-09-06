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

class_idも複数書くときは通常半角カンマ区切りだが、「情報数理工学プログラム、
コンピュータサイエンスプログラム」のように読点（、）で区切って書かれることがあるため、
カンマ・全角カンマ・読点のどれで区切っても複数のclassIdsに分割する
（2026-09-06、Technical Englishのプログラム名一覧で発覚）。

「クラス7，8」のように「クラス」の後ろに複数の数字をカンマ区切りでまとめて書く省略記法
にも対応する。「クラス7，8」は「クラス7,クラス8」（両方のクラスが対象）と同じ意味に
展開してから通常の分割にかける（2026-09-06、基礎科学実験のデータで発覚。展開しないと
「8」が「クラス」の付かない意味不明な単独トークンになってしまっていた）。

実行: python scripts/build_class_assignment_json.py
"""
import csv, json, os, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "data", "timetable", "class_assignment_filled.csv")
OUT = os.path.join(ROOT, "data", "timetable", "class_assignment.json")

# 「クラス7，8」「クラス9,10」のような、「クラス」1回＋数字を区切り文字でまとめて
# 書く省略記法を「クラス7,クラス8」のように展開する
CLASS_SHORTHAND_RE = re.compile(r"クラス\d+(?:[,，、]\d+)+")


def expand_class_shorthand(text: str) -> str:
    def repl(m: re.Match) -> str:
        nums = re.findall(r"\d+", m.group(0))
        return ",".join(f"クラス{n}" for n in nums)

    return CLASS_SHORTHAND_RE.sub(repl, text)


# 「I1,I2クラス」「I3，I4クラス」のような、Ⅱ類のI1〜I6エリアを数字だけ区切り文字で
# まとめて書く省略記法を「I1クラス,I2クラス」のように展開する（クラス7，8と同じ考え方だが、
# 「クラス」の語がIの数字の後ろに来る書き方。2026-09-07、基礎演習A等のデータで発覚）
IAREA_SHORTHAND_RE = re.compile(r"I\d(?:[,，、]I?\d)*クラス")


def expand_iarea_shorthand(text: str) -> str:
    def repl(m: re.Match) -> str:
        nums = re.findall(r"\d", m.group(0))
        return ",".join(f"I{n}クラス" for n in nums)

    return IAREA_SHORTHAND_RE.sub(repl, text)


def main():
    with open(SRC, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    out = []
    for r in rows:
        class_id = r.get("class_id", "").strip()
        if not class_id:
            continue
        class_id = expand_class_shorthand(class_id)
        class_id = expand_iarea_shorthand(class_id)
        periods = [p.strip() for p in re.split(r"[,，]", r["period"]) if p.strip()]
        for period in periods:
            out.append({
                "code": r["subject_code"],
                "term": r["term"],
                "day": r["day"],
                "period": period,
                "classIds": [t.strip() for t in re.split(r"[,，、]", class_id) if t.strip()],
            })

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"完了: {len(out)}件")


if __name__ == "__main__":
    main()
