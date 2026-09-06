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


# 「プログラムA、プログラムBの学籍番号偶数/奇数」のような、複数プログラム共通で
# さらに学籍番号の偶奇でも分かれる科目の書き方に対応する（2026-09-07、ELE402g等のデータで発覚。
# 開発者確認：「両方のプログラム共通で、学籍番号偶数の人だけ対象」という意味）。
# 読点はこのスクリプトの他の箇所で「複数候補の一覧（OR）」の区切りに使っているため、
# そのまま分割すると「プログラムAの一覧」と「プログラムBの学籍番号偶数」という
# 別々の（しかも後者は意味の通らない）条件に壊れてしまう。それを避けるため、
# 既知のプログラム名だけを対象に「＆」区切りへ変換してから渡す
# （src/domain/classAssignment.ts側で「＆」を含む場合だけ複数プログラムの意味として扱う）
PROGRAM_NAMES = [
    "メディア情報学プログラム", "経営・社会情報学プログラム", "情報数理工学プログラム",
    "コンピュータサイエンスプログラム", "デザイン思考・データサイエンスプログラム",
    "セキュリティ情報学プログラム", "情報通信工学プログラム", "電子情報学プログラム",
    "計測・制御システムプログラム", "先端ロボティクスプログラム",
    "機械システムプログラム", "電子工学プログラム", "光工学プログラム",
    "物理工学プログラム", "化学生命工学プログラム",
]
# 開発者の手書きでよくある表記ゆれ（正式名称に寄せる）
PROGRAM_NAME_TYPOS = {
    "電気情報プログラム": "電子情報学プログラム",
    "計測・制御システムプロフラム": "計測・制御システムプログラム",
}

_PROGRAM_ALTERNATION = "|".join(re.escape(p) for p in PROGRAM_NAMES)
PARITY_PROGRAMS_RE = re.compile(rf"(?:(?:{_PROGRAM_ALTERNATION})[、,，]?)+の学籍番号[偶奇]数")
# 「…の学籍番号偶数と<別のプログラム>」のように、学籍番号条件付きの一覧のうしろに
# 無条件のプログラムがさらに「と」で繋がることがある。「と」を読点と同じ区切りとして
# 扱えるよう、先にカンマへ変換しておく（この後のPARITY_PROGRAMS_REは「の学籍番号◯数」で
# 終わるところまでしかマッチしないので、「と」の前後を混同する心配はない）
PARITY_AND_PROGRAM_RE = re.compile(rf"(偶数|奇数)と(?=(?:{_PROGRAM_ALTERNATION}))")


def fix_program_name_typos(text: str) -> str:
    for typo, correct in PROGRAM_NAME_TYPOS.items():
        text = text.replace(typo, correct)
    return text


def expand_parity_programs(text: str) -> str:
    text = fix_program_name_typos(text)
    text = PARITY_AND_PROGRAM_RE.sub(r"\1,", text)

    def repl(m: re.Match) -> str:
        s = m.group(0)
        suffix_m = re.search(r"の学籍番号[偶奇]数$", s)
        programs_part = s[: suffix_m.start()]
        programs = [p for p in re.split(r"[、,，]", programs_part) if p]
        return "＆".join(programs) + suffix_m.group(0)

    return PARITY_PROGRAMS_RE.sub(repl, text)


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
        class_id = expand_parity_programs(class_id)
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
