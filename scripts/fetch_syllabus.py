"""シラバスWeb公開システムから曜日時限・担当教員・シラバスURLを取得し、
data/subjects/youran-2025.json の各科目に offerings（docs/SPEC.md §7.1）として追記する。

実行: python scripts/fetch_syllabus.py

**重要（2026-09-05に発覚）**：シラバスは学修要覧の入学年度（2025）ではなく、
「今実際に開講されている年度」で見る必要がある。データファイル名の「2025」は
学修要覧の入学年度（カリキュラムの版）であって、シラバスの年度とは別物。
時間割PDF（https://kyoumu.office.uec.ac.jp/timet/A*.pdf）は2026（令和8）年度のものなので、
シラバスも2026年度分（SYLLABUS_YEAR）を見る。過去に2025年度分を取得していたことがあったが、
年度がずれていたため、同じ科目でも担当教員・曜日時限が実際の時間割と食い違っていた
（例: コンピュータリテラシーの担当教員2人の曜日時限が、2025年度と2026年度で入れ替わっていた）。
SYLLABUS_YEARは学年が進んでも定期的に見直すこと（来年度以降は2027などに変える）。

やること：
1. 学期一覧ページ（情報理工学域、SYLLABUS_YEAR年度）から全科目行（時間割コード・科目名・
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
# シラバスを見る年度（学修要覧の入学年度2025とは別物。上のコメント参照）
SYLLABUS_YEAR = "2026"
LIST_URL_TMPL = f"https://kyoumu.office.uec.ac.jp/syllabus/{SYLLABUS_YEAR}/GakkiIchiran_{{faculty}}_0.html"
DETAIL_URL_TMPL = f"https://kyoumu.office.uec.ac.jp/syllabus/{SYLLABUS_YEAR}/{{faculty}}/{{faculty}}_{{code}}.html"
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
# 誤って扱っていた）。末尾の（…）を取り除いた名前でも科目マスタと突き合わせる。
# 「日本語第一（１年）（月２・木２）」のように末尾の（…）が2つ連続することがあるため、
# 1回だけでなく、無くなるまで繰り返し取り除く（2026-09-06に発覚。取りきらないと
# 「日本語第一（１年）」のような半端な文字列が残ってマッチしなかった）
TRAILING_PAREN_RE = re.compile(r"[（(][^（）()]*[）)]$")


def strip_class_suffix(name: str) -> str:
    while True:
        stripped = TRAILING_PAREN_RE.sub("", name).strip()
        if stripped == name:
            return stripped
        name = stripped


# 全角/半角スペースの有無（「Academic Spoken English Ⅰ」と科目マスタの
# 「Academic Spoken EnglishⅠ」など）や、ローマ数字と半角英字の表記ゆれ（「Academic English
# for the 2nd Year Ⅰ」と科目マスタの「...Year I」など）、ダッシュの字体違い（「Technical
# English － Basic English for Science」と科目マスタの「Technical English – Basic English
# for Science」など）で名前が一致しない科目が多数あることが判明した（2026-09-06）。
# これらは科目名の表記ゆれであって別の科目ではないので、マッチング専用の正規化を行う
# （科目マスタ側のnameフィールド自体は学修要覧の表記のまま変更しない）
ROMAN_NUMERAL_TO_ASCII = str.maketrans({
    "Ⅰ": "I", "Ⅱ": "II", "Ⅲ": "III", "Ⅳ": "IV", "Ⅴ": "V",
    "Ⅵ": "VI", "Ⅶ": "VII", "Ⅷ": "VIII", "Ⅸ": "IX", "Ⅹ": "X",
})
DASH_CHARS = ["－", "‐", "‑", "–", "—", "―", "−"]
# 全角英数字・全角記号（Ｕ+FF01〜FF5E）は、対応する半角（Ｕ+0021〜007E）へ一括変換する
# （2026-09-06に発覚：「イノベイティブ総合コミュニケーションデザイン２」のように、シラバス側
# だけ全角数字になっていて科目マスタの半角「2」と一致しない科目があった。哲学Ａ・生涯スポーツ
# 演習Ａ等、シラバス側も全角のまま一致している科目はこの変換後も両辺が揃うので問題ない）
FULLWIDTH_TO_HALFWIDTH = str.maketrans(
    {chr(c): chr(c - 0xFEE0) for c in range(0xFF01, 0xFF5F)}
)


def normalize_for_match(name: str) -> str:
    normalized = re.sub(r"[\s　]+", "", name)
    normalized = normalized.translate(ROMAN_NUMERAL_TO_ASCII)
    normalized = normalized.translate(FULLWIDTH_TO_HALFWIDTH)
    for dash in DASH_CHARS:
        normalized = normalized.replace(dash, "-")
    return normalized


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
    known_names_normalized = {normalize_for_match(n) for n in known_names}
    known_codes = {s["code"] for s in subjects_data["subjects"]}

    # シラバスWeb公開システム側の科目番号欄に、無関係な科目コードが紛れ込んでいるケース
    # （2026-09-07に発覚）："プログラミング演習（クラスA）"（timetableCode 21322216、
    # 木曜2限、結城先生）の科目番号欄に"COM402k"（計算機工学、機械システムプログラム向け）が
    # 誤って混入していた。実際のCOM402k（計算機工学）は別の独立した講義のはずだが、
    # 2026年度シラバスにはそれらしいページが見当たらない（大学側の登録漏れの可能性）。
    # 誤った時限のデータが付くよりは何も付かない方が安全なため、この(ページ, コード)の
    # 組み合わせだけを機械的に無視する
    IGNORE_CODE_MATCH = {
        ("21322216", "COM402k"),
    }

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
            if r["href"] and (
                r["name"] in known_names
                or strip_class_suffix(r["name"]) in known_names
                or normalize_for_match(strip_class_suffix(r["name"])) in known_names_normalized
            )
        ]
        print(f"[{faculty}] 科目名が一致する行数（個別ページを取得する件数）: {len(candidates)}", file=sys.stderr)

        for i, row in enumerate(candidates, 1):
            # 個別ページのURLも一覧ページと同じSYLLABUS_YEARを使う（2026-09-06に発覚：
            # ここだけ"2025"が直書きされたままで、一覧はSYLLABUS_YEAR（2026）を見ているのに
            # 個別ページ（科目コード・前もって履修しておくべき科目の抽出元）だけ2025年度分を
            # 見てしまっていた。timetableCodeが年度で変わることがあるため、抽出される
            # 科目コードや前提科目テキストが実際とずれる可能性があった）
            url = f"https://kyoumu.office.uec.ac.jp/syllabus/{SYLLABUS_YEAR}/{row['href']}"
            try:
                detail_html = fetch(url)
            except Exception as e:
                print(f"  取得失敗: {row['timetableCode']} {row['name']}: {e}", file=sys.stderr)
                time.sleep(REQUEST_INTERVAL_SEC)
                continue
            m = CODE_CELL_RE.search(detail_html)
            raw_codes = m.group(1).strip().split() if m else []
            matched_codes = [
                c for c in raw_codes
                if c in known_codes and (row["timetableCode"], c) not in IGNORE_CODE_MATCH
            ]
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

    # シラバスWeb公開システム側の登録ミスと思われる補正（2026-09-05に発覚、2026-09-06に対象を拡大）：
    # ENG101s（夜間主・Academic Written English I）とENG101z（昼間・同科目）で、
    # 科目番号欄の記載が入れ替わっている。ENG101sの欄には昼間の金曜多クラス分（26件、
    # 学修要覧の昼間用担当教員陣と一致）が、ENG101zの欄には夜間主の1クラス分（土曜、
    # Dusza/Jeffreys担当）が、それぞれ逆に登録されていた。
    # 同じ入れ替わりがENG102（Academic Spoken English I）・ENG201/ENG202（同II）の
    # s/zペアにも存在することが2026-09-06に判明（1年次の英語がすべて土曜表示になる不具合として発覚）。
    # ENG301以降（Academic English for the 2nd Year等）にはこの現象は見られない
    # （s/z双方とも同じ昼間側データを指しているか、s/zで別の科目名になっている）ため対象外
    CODE_SWAP_FIXUPS = [
        ("ENG101s", "ENG101z"),
        ("ENG102s", "ENG102z"),
        ("ENG201s", "ENG201z"),
        ("ENG202s", "ENG202z"),
    ]
    for code_a, code_b in CODE_SWAP_FIXUPS:
        a = offerings_by_code.pop(code_a, None)
        b = offerings_by_code.pop(code_b, None)
        if b is not None:
            offerings_by_code[code_a] = b
        if a is not None:
            offerings_by_code[code_b] = a

    # 学域特別講義A/B（2026-09-07にUEC001z/UEC003z=A、UEC002z/UEC004z=Bの単位数違いで分割）は、
    # 開講年度ごとに具体的なテーマ・担当教員が変わる科目（例:「学域特別講義A(アルゴリズムの基礎)」）で、
    # 科目マスタの名前には単位数の注記まで含めているため、科目名の完全一致では
    # 一覧ページの行を拾えない。ただし開講される曜日時限自体は毎年固定（前学期木5/前学期金5）
    # と開発者から確認済み（2026-09-06）なので、ここで固定値を補う。将来もし名前一致で
    # 本当に取得できるようになった場合はそちらを優先する（setdefaultなので上書きしない）
    for code in ("UEC001z", "UEC003z"):
        offerings_by_code.setdefault(code, [{
            "timetableCode": "", "faculty": "31", "term": "前学期",
            "slots": [{"day": "木", "period": 5}], "instructors": [],
            "syllabusUrl": "", "updatedAt": today,
        }])
    for code in ("UEC002z", "UEC004z"):
        offerings_by_code.setdefault(code, [{
            "timetableCode": "", "faculty": "31", "term": "前学期",
            "slots": [{"day": "金", "period": 5}], "instructors": [],
            "syllabusUrl": "", "updatedAt": today,
        }])

    # 昼間の「知的財産権」(CAR603z)・「技術者倫理」(CAR604z)の登録漏れ補正（2026-09-06発覚）：
    # シラバスWeb公開システム側で、夜間主の個別ページ（22018104・22018205）の科目番号欄に
    # 昼間コード（CAR603z・CAR604z）と夜間コード（CAR701s・CAR801s）が両方書かれている一方、
    # 昼間の個別ページ（21018233・21018234）の科目番号欄は空欄になっていた。このため
    # CAR603z/CAR604zには夜間の時限（水7）が誤って付いてしまい、本来の昼間の時限
    # （知的財産権=月1、技術者倫理=水1）が一件も取得できていなかった。開発者確認・
    # 一覧ページの行データから直接補う（CAR701s/CAR801sは夜間の時限のままで正しい）
    offerings_by_code["CAR603z"] = [{
        "timetableCode": "21018233", "faculty": "31", "term": "後学期",
        "slots": [{"day": "月", "period": 1}], "instructors": ["本間", "○重森"],
        "syllabusUrl": f"{DETAIL_URL_TMPL.format(faculty='31', code='21018233')}", "updatedAt": today,
    }]
    offerings_by_code["CAR604z"] = [{
        "timetableCode": "21018234", "faculty": "31", "term": "後学期",
        "slots": [{"day": "水", "period": 1}], "instructors": ["濁川　義和"],
        "syllabusUrl": f"{DETAIL_URL_TMPL.format(faculty='31', code='21018234')}", "updatedAt": today,
    }]

    # 複素関数論：Ⅰ類（media/mathinfo/cs/designds）・Ⅱ類（control/robotics/security/netinfo/electroinfo）の
    # 9科目コードは、シラバスWeb公開システム上でこれらの科目番号自体が登録されていない
    # （南泰浩先生・龍野智哉先生の講義＝Ⅰ類向け、宮脇陽一先生／鈴木淳先生／小木曽公尚先生の講義＝
    # Ⅱ類向けの、いずれの個別ページも科目番号欄が空欄）。一方、古川怜先生・遠藤晋平先生が担当する
    # 別講義（Ⅲ類向け、複素関数論(Ⅲ類)）の個別ページには、本来登録されるべきでないこの9科目コードが
    # まとめて誤登録されている（大学側の登録ミス、2026-09-06に開発者が直接確認・専門知識で判明）。
    # 自動マッチングに任せると誤って古川・遠藤先生側のofferingsを拾ってしまうため、
    # 正しい担当・時限を固定値として上書きする（管理プログラム(management, MTH304b)は
    # 元々別講義で対象外。将来もし大学側の登録が修正されて自動マッチングが正しく機能するように
    # なっても、この上書きが優先されたままになる点は注意）
    fukusokansuuron_i = [{
        "timetableCode": "21122118", "faculty": "31", "term": "前学期",
        "slots": [{"day": "火", "period": 4}], "instructors": ["南　泰浩"],
        "syllabusUrl": DETAIL_URL_TMPL.format(faculty="31", code="21122118"), "updatedAt": today,
    }, {
        "timetableCode": "21122119", "faculty": "31", "term": "前学期",
        "slots": [{"day": "水", "period": 4}], "instructors": ["龍野　智哉"],
        "syllabusUrl": DETAIL_URL_TMPL.format(faculty="31", code="21122119"), "updatedAt": today,
    }]
    fukusokansuuron_ii = [{
        "timetableCode": "21222124", "faculty": "31", "term": "前学期",
        "slots": [{"day": "水", "period": 3}], "instructors": ["宮脇　陽一"],
        "syllabusUrl": DETAIL_URL_TMPL.format(faculty="31", code="21222124"), "updatedAt": today,
    }, {
        "timetableCode": "21222122", "faculty": "31", "term": "前学期",
        "slots": [{"day": "木", "period": 3}], "instructors": ["鈴木　淳"],
        "syllabusUrl": DETAIL_URL_TMPL.format(faculty="31", code="21222122"), "updatedAt": today,
    }, {
        "timetableCode": "21222123", "faculty": "31", "term": "前学期",
        "slots": [{"day": "木", "period": 3}], "instructors": ["小木曽　公尚"],
        "syllabusUrl": DETAIL_URL_TMPL.format(faculty="31", code="21222123"), "updatedAt": today,
    }]
    for code in ["MTH304a", "MTH304c", "MTH304d", "MTH304e"]:
        offerings_by_code[code] = fukusokansuuron_i
    for code in ["MTH302i", "MTH302j", "MTH304f", "MTH304g", "MTH304h"]:
        offerings_by_code[code] = fukusokansuuron_ii

    updated = 0
    prereq_updated = 0
    for s in subjects_data["subjects"]:
        if s["code"] in offerings_by_code:
            s["offerings"] = offerings_by_code[s["code"]]
            updated += 1
        if s["code"] in prereq_text_by_code:
            s["prerequisitesText"] = prereq_text_by_code[s["code"]]

        # 学修要覧側で学期が空欄でも、2026年度シラバスの全セクションが同じ前／後学期なら表示に使える。
        # 年次はシラバスの「開講年次」が空欄の科目もあるため、この補完では推測しない。
        offering_terms = {o["term"] for o in s.get("offerings", []) if o.get("term") in {"前学期", "後学期"}}
        if s.get("termType") is None and len(offering_terms) == 1:
            s["termType"] = offering_terms.pop()
            prereq_updated += 1

    with open(SUBJECTS_PATH, "w", encoding="utf-8") as f:
        json.dump(subjects_data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"完了: offerings付与 {updated} 科目、prerequisitesText付与 {prereq_updated} 科目 / 全体 {len(subjects_data['subjects'])}", file=sys.stderr)


if __name__ == "__main__":
    main()
