"""学修要覧2022を基準に、2022年度用の要件データを生成する。

2022年度はデザイン思考・データサイエンスプログラムがまだ無いため、2024年度の対応する
要件ファイルを土台にして当該プログラムを除く。別表2で確認できるⅠ類の単位配分もここで反映する。

付録Cを画像で照合したところ、単なる単位配分の差ではなく、次の根本的な差分が見つかった
（2026-09-14、docs/YOURAN_2022_COMPARISON.md参照）。

- 理数基礎科目：基礎科学実験A・Bは2022年度にはA1/A2・B1/B2に分かれておらず、それぞれ
  1科目2単位（PHY101z・CHM101z）。現行のPHY201z・CHM202z（後半科目扱い）は2022年度には
  存在せず、それぞれ物理学概論第二・化学概論第二という別科目を指す
- Ⅰ類（メディア情報学・経営社会情報学・情報数理工学・コンピュータサイエンス）：
  デザイン思考・データサイエンスがまだ無いため、他プログラムからの展開先にeサフィックスの
  科目が混入してはいけない。また類共通基礎科目・専門選択科目の一部科目番号が2024年度と異なる
- Ⅱ類（セキュリティ情報学〜先端ロボティクス）：デザイン思考・データサイエンスが「e」を
  占めていないため、プログラム記号自体が2024年度より1つ若い（セキュリティ情報学はf→e、
  情報通信工学はg→f、電子情報学はh→g、計測制御システムはi→h、先端ロボティクスはj→i）

2026-09-15、2022〜2026年度の横断デバッグ（docs/YOURAN_CROSS_YEAR_AUDIT.md参照）でⅢ類の
2件の不具合を追加修正した。electro（電子工学）に光工学専用の「画像情報学基礎」
（ELEa02k）が一般則の科目番号変換で誤って混入していたため要件ファイルの参照から除外し、
chembio（化学生命工学）の2024年度新設科目除外リストがrename前のサフィックスで指定されて
いて実際には機能していなかったバグを修正した。

実行: python scripts/build_2022_data.py
"""

from __future__ import annotations

import copy
import json
import re
from pathlib import Path
from typing import Any
from special_lecture_data import normalize_special_lecture_subjects


# プロジェクト内のデータディレクトリと、複製元・出力先をまとめて定義する。
ROOT = Path(__file__).resolve().parents[1]
REQUIREMENTS_DIR = ROOT / "data" / "requirements"
SUBJECTS_DIR = ROOT / "data" / "subjects"


def load_json(path: Path) -> dict[str, Any]:
    """UTF-8のJSONを辞書として読み込む。"""
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    """生成結果を差分確認しやすい整形済みJSONで保存する。"""
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def walk_groups(groups: list[dict[str, Any]]):
    """入れ子の要件グループを先頭から再帰的に列挙する。"""
    for group in groups:
        yield group
        yield from walk_groups(group.get("children", []))


def groups_by_id(document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """グループIDから要件グループを引ける辞書を作る。"""
    return {group["id"]: group for group in walk_groups(document["groups"])}


def copy_requirement_files() -> list[Path]:
    """2024年度の要件を2022年度へ複製し、存在しなかったプログラムだけ除外する。"""
    outputs: list[Path] = []
    for source_path in sorted(REQUIREMENTS_DIR.glob("2024-*.json")):
        # 2022年度にはデザイン思考・データサイエンスプログラムが存在しない。
        if source_path.name == "2024-day-I-designds.json":
            continue
        document = load_json(source_path)
        document["entryYear"] = 2022
        document["source"] = document.get("source", "").replace("2024", "2022")
        if isinstance(document.get("extends"), str):
            document["extends"] = document["extends"].replace("2024-", "2022-")
        output_path = REQUIREMENTS_DIR / source_path.name.replace("2024-", "2022-", 1)
        write_json(output_path, document)
        outputs.append(output_path)
    return outputs


def update_class_i_requirements() -> None:
    """別表2の2022年度Ⅰ類の理数基礎・専門・共通単位の値へ合わせる。

    2026-09-15追加：卒業審査（reviews内の"graduation"）のcommonCredits条件は、
    2025年度の値（media=8, 他=7）が2022年度分もそのまま残っており、subtotals.commonを
    ここで書き換えても同期されていなかった（2021年度のⅡ類・Ⅲ類・夜間主の卒研着手条件を
    別表4と照合していた際に発見。docs/YOURAN_2021_COMPARISON.md参照）。common変数と
    同じ値を明示的に書き込む。
    """
    expected = {
        "media": (78, 6),
        "management": (79, 5),
        "mathinfo": (79, 5),
        "cs": (79, 5),
    }
    for program, (specialized, common) in expected.items():
        path = REQUIREMENTS_DIR / f"2022-day-I-{program}.json"
        document = load_json(path)
        groups = groups_by_id(document)
        # 別表2ではⅠ類の理数基礎は20単位。2022年度のPHY201z（物理学概論第二）は
        # 2024年度の同名グループには含まれていないため、必修として加える必要がある
        # （2026-09-14訂正：基礎科学実験A2ではなく物理学概論第二。update_basic_science_subjects参照）。
        groups["math-basic"]["required"] = 20
        groups["math-basic-req"]["required"] = 20
        if "PHY201z" not in groups["math-basic-req"]["subjects"]:
            groups["math-basic-req"]["subjects"].append("PHY201z")
        groups["specialized"]["required"] = specialized
        document["subtotals"]["specialized"] = specialized
        document["subtotals"]["common"] = common
        graduation = next(review for review in document["reviews"] if review["id"] == "graduation")
        common_condition = next(cond for cond in graduation["allOf"] if cond.get("type") == "commonCredits")
        common_condition["min"] = common
        write_json(path, document)


def update_common_requirements() -> None:
    """2022年度の共通要件から、まだ存在しない基礎科学実験A2・B2への参照を外す。

    2026-09-14訂正：2022年度は基礎科学実験A・Bがそれぞれ1科目2単位のみで、A1/A2・B1/B2の
    分割は無い（docs/YOURAN_2022_COMPARISON.md参照）。
    """
    path = REQUIREMENTS_DIR / "2022-day-common.json"
    document = load_json(path)
    groups = groups_by_id(document)
    groups["intro"]["subjects"] = [
        code for code in groups["intro"]["subjects"] if code not in ("PHY201z", "CHM202z")
    ]
    write_json(path, document)


def update_math_basic_requirements() -> None:
    """全プログラム共通：理数基礎科目の必修・選択科目一覧を2022年度時点の科目番号に直す。

    2024年度以降は物理学概論第二がPHY202z、物理学演習第二がPHY203z、化学概論第二がCHM203z
    という番号だが、2022年度時点ではそれぞれPHY201z・PHY202z・CHM202zだった（画像で確認済み。
    update_basic_science_subjectsで科目マスタ側の実体もこの2022年度時点の番号へ入れ替えている）。
    Ⅰ類はもともと物理学概論第二が理数基礎の必修に含まれていない（update_class_i_requirementsで
    別途PHY201zを必修へ追加済み）ため、ここでのPHY202z→PHY201z置換はⅡ類・Ⅲ類・夜間主にのみ効く。
    """
    for path in sorted(REQUIREMENTS_DIR.glob("2022-day-*.json")):
        if path.name == "2022-day-common.json":
            continue
        document = load_json(path)
        groups = groups_by_id(document)
        req = groups.get("math-basic-req")
        if req is not None:
            req["subjects"] = ["PHY201z" if code == "PHY202z" else code for code in req["subjects"]]
        sel = groups.get("math-basic-sel")
        if sel is not None:
            subjects = [code for code in sel["subjects"] if code != "PHY203z"]
            sel["subjects"] = ["CHM202z" if code == "CHM203z" else code for code in subjects]
        write_json(path, document)


DESIGNDS_ABSENT_SUFFIX = "e"


def remove_designds_crosslisting(document: dict[str, Any]) -> None:
    """2022年度にはまだ存在しないデザイン思考・データサイエンス（サフィックスe）の
    展開科目を、他のⅠ類プログラムの要件から取り除く。
    """
    for group in walk_groups(document["groups"]):
        subjects = group.get("subjects")
        if subjects:
            group["subjects"] = [code for code in subjects if not code.endswith(DESIGNDS_ABSENT_SUFFIX)]


FIRST_CLUSTER_BASIC_RENUMBER = {
    suffix: {f"MTH303{suffix}": f"MTH301{suffix}", f"MTH304{suffix}": f"MTH302{suffix}"}
    for suffix in ("a", "b", "c", "d")
}
# 情報数理工学・コンピュータサイエンスは、2024年度にかけて選択科目のMTH60X系列が
# 1つずつ後ろへずれている（数理計画法・離散数理工学・知的情報処理・ハイパフォーマンス
# コンピューティングの4科目が連鎖的にずれる）。
FIRST_CLUSTER_MAJOR_RENUMBER = {
    suffix: {
        f"MTH602{suffix}": f"MTH601{suffix}",
        f"MTH603{suffix}": f"MTH602{suffix}",
        f"MTH604{suffix}": f"MTH603{suffix}",
        f"MTH605{suffix}": f"MTH604{suffix}",
    }
    for suffix in ("c", "d")
}


def rename_codes_everywhere(document: dict[str, Any], rename: dict[str, str]) -> None:
    """要件JSON内のどのグループに出現していても、指定の科目番号を一括で置き換える。"""
    for group in walk_groups(document["groups"]):
        subjects = group.get("subjects")
        if subjects:
            group["subjects"] = [rename.get(code, code) for code in subjects]


def update_first_cluster_requirements() -> None:
    """Ⅰ類4プログラム：デザイン思考・データサイエンス展開分の除去、類共通基礎・
    専門選択科目の番号ずれの是正、メディア情報学固有の差分を反映する。

    番号ずれは「他プログラムの類専門科目選択も選択科目とできる」規定（付録C注1）により
    4ファイルすべてに展開されているため、どの科目の番号ずれも全ファイル共通で適用する。
    """
    all_renames: dict[str, str] = {}
    for mapping in FIRST_CLUSTER_BASIC_RENUMBER.values():
        all_renames.update(mapping)
    for mapping in FIRST_CLUSTER_MAJOR_RENUMBER.values():
        all_renames.update(mapping)

    for suffix, program in (("a", "media"), ("b", "management"), ("c", "mathinfo"), ("d", "cs")):
        path = REQUIREMENTS_DIR / f"2022-day-I-{program}.json"
        document = load_json(path)
        remove_designds_crosslisting(document)
        rename_codes_everywhere(document, all_renames)
        groups = groups_by_id(document)
        removed_2024_only = {f"COM002{suffix}", f"COM003{suffix}", f"LAB501{suffix}"}
        groups["major-free"]["subjects"] = [
            code for code in groups["major-free"]["subjects"] if code not in removed_2024_only
        ]
        write_json(path, document)

    # メディア情報学固有：現代代数学・数理解析学は経営・社会情報学の番号を参照する
    # （「形式言語理論」COM406aは2025年度の要件ファイルに追加済みのため、2024年度経由で
    # ここまで自然に引き継がれる）。
    path = REQUIREMENTS_DIR / "2022-day-I-media.json"
    document = load_json(path)
    groups = groups_by_id(document)
    rename = {"MTHb02a": "MTHb02b", "MTHb03a": "MTHb03b"}
    groups["major-free"]["subjects"] = [rename.get(code, code) for code in groups["major-free"]["subjects"]]
    write_json(path, document)


# Ⅱ類5プログラム：デザイン思考・データサイエンスが「e」を占めていないため、
# プログラム記号自体が2024年度より1つ若い（画像で確認済み、docs/YOURAN_2022_COMPARISON.md参照）。
SECOND_CLUSTER_PROGRAMS = [
    ("e", "f", "security"),
    ("f", "g", "netinfo"),
    ("g", "h", "electroinfo"),
    ("h", "i", "control"),
    ("i", "j", "robotics"),
]
SECOND_CLUSTER_SUFFIX_2024_TO_2022 = {new: old for old, new, _ in SECOND_CLUSTER_PROGRAMS}
CODE_SUFFIX_RE = re.compile(r"^(.+\d)([a-z])$")

# 確率統計・力学・応用数学Ａ・離散数学・複素関数論は、プログラム記号のずれとは別に
# 科目番号自体も2024年度にかけて後ろへずれている（画像で確認済み、5プログラム共通）。
SECOND_CLUSTER_MTH_NUMBER_SHIFT = {205: 301, 301: 302, 302: 303, 303: 304}
SECOND_CLUSTER_PHY_NUMBER_SHIFT = {203: 204}


def build_second_cluster_rename_map() -> dict[str, str]:
    """2024年度時点の科目番号（サフィックス込み）から2022年度時点の科目番号への変換表を作る。"""
    rename: dict[str, str] = {}
    for old_suffix, new_suffix, _ in SECOND_CLUSTER_PROGRAMS:
        for old_number, new_number in SECOND_CLUSTER_MTH_NUMBER_SHIFT.items():
            rename[f"MTH{new_number}{new_suffix}"] = f"MTH{old_number}{old_suffix}"
        for old_number, new_number in SECOND_CLUSTER_PHY_NUMBER_SHIFT.items():
            rename[f"PHY{new_number}{new_suffix}"] = f"PHY{old_number}{old_suffix}"
    return rename


def rename_second_cluster_code(code: str, special: dict[str, str]) -> str:
    """1つの科目番号を2024年度時点から2022年度時点へ変換する。特殊な番号ずれを優先し、
    それ以外はプログラム記号を1つ若返らせるだけの一般則を適用する。
    """
    if code in special:
        return special[code]
    match = CODE_SUFFIX_RE.match(code)
    if not match:
        return code
    base, suffix = match.groups()
    old_suffix = SECOND_CLUSTER_SUFFIX_2024_TO_2022.get(suffix)
    if old_suffix is None:
        return code
    return base + old_suffix


def rename_codes_deep(value: Any, rename_fn) -> Any:
    """JSON構造全体（要件グループだけでなく審査条件のcodes・onFail等も含む）を再帰的に
    走査し、科目番号らしき文字列をすべて変換関数にかける。
    """
    if isinstance(value, list):
        return [
            rename_fn(item) if isinstance(item, str) else rename_codes_deep(item, rename_fn)
            for item in value
        ]
    if isinstance(value, dict):
        return {key: rename_codes_deep(val, rename_fn) for key, val in value.items()}
    return value


def update_second_cluster_requirements() -> None:
    """Ⅱ類5プログラム：プログラム記号のずれ・科目番号のずれ・GLTPラボワークの2024年度
    新設分を2022年度時点へ是正する。審査条件（reviews）のcodes・onFail.blockedSubjectsにも
    旧サフィックスの科目番号が残っているため、要件グループだけでなく文書全体を走査する。
    計測制御システム・先端ロボティクスのAdvanced Robotics and Mechatronics Engineering
    （大学院連携科目）は、2024年度データが同科目を保持するよう修正済みのため
    （docs/YOURAN_2022_COMPARISON.md参照）、一般則の科目番号変換だけで自然に2022年度
    時点の番号へ戻る（個別の復元処理は不要）。
    """
    special = build_second_cluster_rename_map()
    for old_suffix, _new_suffix, program in SECOND_CLUSTER_PROGRAMS:
        path = REQUIREMENTS_DIR / f"2022-day-II-{program}.json"
        document = load_json(path)
        document["programSuffix"] = old_suffix
        document["groups"] = rename_codes_deep(
            document["groups"], lambda code: rename_second_cluster_code(code, special)
        )
        document["reviews"] = rename_codes_deep(
            document.get("reviews", []), lambda code: rename_second_cluster_code(code, special)
        )
        groups = groups_by_id(document)
        groups["major-free"]["subjects"] = [
            code for code in groups["major-free"]["subjects"] if code != f"LAB501{old_suffix}"
        ]
        write_json(path, document)


def update_second_cluster_subjects(subjects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Ⅱ類5プログラムの科目マスタを2022年度時点の科目番号へ入れ替え、GLTPラボワークの
    2024年度新設分を除く。計測制御システム・先端ロボティクスのAdvanced Robotics and
    Mechatronics Engineering（MCEb13h/i）は、2024年度マスタが同科目を保持するよう修正済み
    のため（docs/YOURAN_2022_COMPARISON.md参照）、一般則の科目番号変換だけで自然に
    2022年度時点の番号へ戻る（個別の復元処理は不要）。
    """
    special = build_second_cluster_rename_map()
    for subject in subjects:
        subject["code"] = rename_second_cluster_code(subject["code"], special)

    removed = {f"LAB501{old_suffix}" for old_suffix, _new_suffix, _program in SECOND_CLUSTER_PROGRAMS}
    subjects = [subject for subject in subjects if subject["code"] not in removed]
    return subjects


# Ⅲ類5プログラム：Ⅱ類が1つ前へ詰まった分、Ⅲ類のプログラム記号も2024年度より1つ若い
# （画像で確認済み、docs/YOURAN_2022_COMPARISON.md参照）。
THIRD_CLUSTER_PROGRAMS = [
    ("j", "k", "mecha"),
    ("k", "m", "electro"),
    ("m", "n", "optical"),
    ("n", "p", "physics"),
    ("p", "r", "chembio"),
]
THIRD_CLUSTER_SUFFIX_2024_TO_2022 = {new: old for old, new, _ in THIRD_CLUSTER_PROGRAMS}

# 力学・力学演習・UECパスポートプログラムAは、プログラム記号のずれとは別に科目番号自体も
# 2024年度にかけて後ろへずれている（画像で確認済み、5プログラム共通）。
THIRD_CLUSTER_PHY_NUMBER_SHIFT = {203: 204, 204: 205}
THIRD_CLUSTER_UEC_NUMBER_SHIFT = {301: 302}


def build_third_cluster_rename_map() -> dict[str, str]:
    """2024年度時点の科目番号（サフィックス込み）から2022年度時点の科目番号への変換表を作る。"""
    rename: dict[str, str] = {}
    for old_suffix, new_suffix, _ in THIRD_CLUSTER_PROGRAMS:
        for old_number, new_number in THIRD_CLUSTER_PHY_NUMBER_SHIFT.items():
            rename[f"PHY{new_number}{new_suffix}"] = f"PHY{old_number}{old_suffix}"
        for old_number, new_number in THIRD_CLUSTER_UEC_NUMBER_SHIFT.items():
            rename[f"UEC{new_number}{new_suffix}"] = f"UEC{old_number}{old_suffix}"
    return rename


def rename_third_cluster_code(code: str, special: dict[str, str]) -> str:
    """1つの科目番号を2024年度時点から2022年度時点へ変換する。特殊な番号ずれを優先し、
    それ以外はプログラム記号を1つ若返らせるだけの一般則を適用する。
    """
    if code in special:
        return special[code]
    match = CODE_SUFFIX_RE.match(code)
    if not match:
        return code
    base, suffix = match.groups()
    old_suffix = THIRD_CLUSTER_SUFFIX_2024_TO_2022.get(suffix)
    if old_suffix is None:
        return code
    return base + old_suffix


def update_third_cluster_requirements() -> None:
    """Ⅲ類5プログラム：プログラム記号のずれ・科目番号のずれ・GLTPラボワークの2024年度
    新設分を2022年度時点へ是正する。2024年度には無い選択科目「Modern Engineering and
    Science」（GSE701x）を復元し、物理工学・化学生命工学の2024年度新設科目を除く。
    機械システムのAdvanced Robotics and Mechatronics Engineering（MCEb13j）は、2024年度
    データが同科目を保持しているため（docs/YOURAN_2022_COMPARISON.md参照）、一般則の
    科目番号変換だけで自然に2022年度時点の番号へ戻る。光工学の「画像情報学基礎」
    （ELEa02m）は、2024年度の要件ファイルが原本に掲載の無いELEa02nを参照しないよう
    修正済みのため（docs/YOURAN_2023_COMPARISON.md参照）一般則では引き継がれず、個別に
    復元する（科目マスタ側は2024年度がELEa02nを保持したままのため、一般則で自然に戻る）。

    2026-09-15追加：electro（電子工学）の「画像情報学基礎」（2024年度時点コードELEa02m）は、
    一般則の科目番号変換で2022年度時点コードELEa02kへ変換されるが、2022年度の原本付録Cには
    電子工学向けのこの科目が掲載されていない（光工学向けのELEa02mのみ掲載）ため、要件ファイル
    の参照からは除く（docs/YOURAN_CROSS_YEAR_AUDIT.md参照。科目マスタ側は現行シラバスに実在
    するため残す）。また、chembio（化学生命工学）の2024年度新設科目除外リストは、rename後
    （2022年度時点のサフィックスp）ではなくrename前（2024年度時点のサフィックスr）のコード
    で指定されていたため、実際には一件も除外されていなかったバグを修正する。
    """
    special = build_third_cluster_rename_map()
    removed_2024_only = {
        "physics": {"PHYb03n", "PHYb04n"},
        "electro": {"ELEa02k"},
        "chembio": {"PHYb01p", "CHMb01p", "BCHa02p", "BCHa03p", "CHMb02p", "CHMb03p", "BIOb02p"},
    }
    for old_suffix, _new_suffix, program in THIRD_CLUSTER_PROGRAMS:
        path = REQUIREMENTS_DIR / f"2022-day-III-{program}.json"
        document = load_json(path)
        document["programSuffix"] = old_suffix
        document["groups"] = rename_codes_deep(
            document["groups"], lambda code: rename_third_cluster_code(code, special)
        )
        document["reviews"] = rename_codes_deep(
            document.get("reviews", []), lambda code: rename_third_cluster_code(code, special)
        )
        groups = groups_by_id(document)
        major_free = groups["major-free"]
        remove_now = {f"LAB501{old_suffix}"} | removed_2024_only.get(program, set())
        major_free["subjects"] = [code for code in major_free["subjects"] if code not in remove_now]
        major_sel = groups["major-sel"]
        gse_code = f"GSE701{old_suffix}"
        if gse_code not in major_sel["subjects"]:
            major_sel["subjects"].append(gse_code)
        write_json(path, document)

    # 光工学：画像情報学基礎（ELEa02m）の復元。2024年度の要件ファイルは原本に掲載の無い
    # ELEa02nを参照しないよう修正済みのため（docs/YOURAN_2023_COMPARISON.md参照）、一般則の
    # 科目番号変換では引き継がれない。2022年度は自分自身の原本に掲載があるため個別に復元する。
    path = REQUIREMENTS_DIR / "2022-day-III-optical.json"
    document = load_json(path)
    groups = groups_by_id(document)
    if "ELEa02m" not in groups["major-free"]["subjects"]:
        groups["major-free"]["subjects"].append("ELEa02m")
    write_json(path, document)


def update_third_cluster_subjects(subjects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Ⅲ類5プログラムの科目マスタを2022年度時点の科目番号へ入れ替え、GLTPラボワーク・
    2024年度新設科目を除き、Modern Engineering and Scienceを復元する。機械システムの
    Advanced Robotics and Mechatronics Engineering（MCEb13j）・光工学の画像情報学基礎
    （ELEa02m）は、2024年度の科目マスタが同科目を保持しているため（docs/YOURAN_2022_
    COMPARISON.md・YOURAN_2023_COMPARISON.md参照）、一般則の科目番号変換だけで自然に
    2022年度時点の番号へ戻る（個別の復元処理は不要）。electro自身の画像情報学基礎
    （ELEa02k、2024年度時点コードELEa02m）は、科目自体はシラバス基準で実在するため科目
    マスタからは外さず、要件ファイルの参照だけを`update_third_cluster_requirements`側で
    除く（docs/YOURAN_CROSS_YEAR_AUDIT.md参照）。
    """
    special = build_third_cluster_rename_map()
    for subject in subjects:
        subject["code"] = rename_third_cluster_code(subject["code"], special)

    removed = {f"LAB501{old_suffix}" for old_suffix, _new_suffix, _program in THIRD_CLUSTER_PROGRAMS}
    # 2026-09-15修正：化学生命工学の2024年度新設科目除外は、rename後（2022年度時点の
    # サフィックスp）ではなくrename前（2024年度時点のサフィックスr）で指定されていたため、
    # 実際には一件も除外されていなかった。
    removed |= {"PHYb03n", "PHYb04n", "PHYb01p", "CHMb01p", "BCHa02p", "BCHa03p", "CHMb02p", "CHMb03p", "BIOb02p"}
    subjects = [subject for subject in subjects if subject["code"] not in removed]

    for old_suffix, _new_suffix, _program in THIRD_CLUSTER_PROGRAMS:
        subjects.append(
            {
                "code": f"GSE701{old_suffix}", "name": "Modern Engineering and Science", "credits": 2,
                "field": "GSE", "standardSemester": 7, "standardYear": 4, "termType": "前学期",
                "eveningAllowed": True, "forInternational": False, "graduateLinked": False,
                "groups": ["major-sel"],
            }
        )
    return subjects


def update_basic_science_subjects(subjects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """理数基礎科目のうち、2022年度にはA1/A2・B1/B2の分割が無かった基礎科学実験A・Bと、
    番号がずれている物理学概論第二・物理学演習第二・化学概論第二を2022年度時点へ戻す。

    2026-09-14訂正：PHY201z・CHM202zは「基礎科学実験A2・B2」ではなく、それぞれ
    物理学概論第二・化学概論第二という別科目を指す（画像で確認済み）。開講情報
    （offerings）は科目そのものに付随する情報なので、正しい2022年度の科目番号へ
    実体ごと付け替える。
    """
    by_code = {subject["code"]: subject for subject in subjects}
    old_phy202, old_phy203, old_chm203 = (
        copy.deepcopy(by_code[c]) for c in ("PHY202z", "PHY203z", "CHM203z")
    )

    # 物理学概論第二（202→201、理数基礎必修）。
    by_code["PHY201z"].clear()
    by_code["PHY201z"].update(old_phy202, code="PHY201z", groups=["math-basic-req"])
    # 物理学演習第二（203→202、理数基礎選択）。
    by_code["PHY202z"].clear()
    by_code["PHY202z"].update(old_phy203, code="PHY202z", groups=["math-basic-sel"])
    # 化学概論第二（現CHM203z→CHM202z、理数基礎選択）。
    by_code["CHM202z"].clear()
    by_code["CHM202z"].update(old_chm203, code="CHM202z", groups=["math-basic-sel"])

    subjects = [subject for subject in subjects if subject["code"] not in ("PHY203z", "CHM203z")]
    by_code["PHY101z"]["name"] = "基礎科学実験A"
    by_code["PHY101z"]["credits"] = 2
    by_code["CHM101z"]["name"] = "基礎科学実験B"
    by_code["CHM101z"]["credits"] = 2
    return subjects


# 夜間主課程：Ⅲ類が1つ前へ詰まった分、夜間主独自のプログラム記号も2024年度より1つ若い
# （総合文化科目r・専門基礎/専門科目s。2024年度はそれぞれs・t。画像で確認済み）。
EVENING_SUFFIX_2024_TO_2022 = {"s": "r", "t": "s"}

# 人文・社会科学科目：「美術」（HSS102s→103r）「経済学」（HSS104s→106r）「政治学」（廃止）が
# 抜けた分、以降の科目番号が2024年度から後ろへずれている。総合コミュニケーション科学・
# 基礎数学系科目も番号自体が変わっている（画像で確認済み）。
EVENING_SPECIAL_RENUMBER = {
    "HSS102s": "HSS103r", "HSS103s": "HSS105r", "HSS104s": "HSS106r", "HSS105s": "HSS107r",
    "HSS106s": "HSS108r",
    "UEC301s": "UEC401r",
    "MTH102t": "MTH101s", "MTH103t": "MTH102s", "PHY202t": "PHY201s",
    "MTH403t": "MTH401s", "MTH404t": "MTH402s",
}


def rename_evening_code(code: str) -> str:
    """1つの科目番号を2024年度時点から2022年度時点へ変換する。特殊な番号ずれを優先し、
    それ以外はプログラム記号を1つ若返らせるだけの一般則を適用する。
    """
    if code in EVENING_SPECIAL_RENUMBER:
        return EVENING_SPECIAL_RENUMBER[code]
    match = CODE_SUFFIX_RE.match(code)
    if not match:
        return code
    base, suffix = match.groups()
    old_suffix = EVENING_SUFFIX_2024_TO_2022.get(suffix)
    if old_suffix is None:
        return code
    return base + old_suffix


def update_evening_requirements() -> None:
    """夜間主課程：プログラム記号のずれ・科目番号のずれを2022年度時点へ是正し、2024年度に
    廃止された人文・社会科学科目「美術」（HSS102r）・「経済学」（HSS104r）・「政治学」
    （HSS206r）を復元する（画像で確認済み、docs/YOURAN_2022_COMPARISON.md参照）。
    """
    path = REQUIREMENTS_DIR / "2022-evening.json"
    document = load_json(path)
    document["groups"] = rename_codes_deep(document["groups"], rename_evening_code)
    document["reviews"] = rename_codes_deep(document.get("reviews", []), rename_evening_code)
    groups = groups_by_id(document)
    hss = groups["hss"]
    for code in ("HSS102r", "HSS104r", "HSS206r"):
        if code not in hss["subjects"]:
            hss["subjects"].append(code)
    write_json(path, document)


def update_evening_subjects(subjects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """夜間主課程の科目マスタを2022年度時点の科目番号へ入れ替え、2024年度に廃止された
    「美術」「経済学」「政治学」を復元する（2026年度シラバスに無いため開講情報は無し）。
    """
    for subject in subjects:
        subject["code"] = rename_evening_code(subject["code"])

    for code, name in (("HSS102r", "美術"), ("HSS104r", "経済学"), ("HSS206r", "政治学")):
        subjects.append(
            {
                "code": code, "name": name, "credits": 2, "field": "HSS",
                "standardSemester": 1, "standardYear": 1, "termType": "前学期",
                "eveningAllowed": True, "forInternational": False, "graduateLinked": False,
                "groups": ["hss"],
            }
        )
    return subjects


def copy_subject_master() -> int:
    """旧体系と共通する科目情報を2022年度マスタとして複製し、年度参照を分離する。

    デザイン思考・データサイエンス（サフィックスe）はまだ存在しないため科目ごと除く。
    """
    document = load_json(SUBJECTS_DIR / "youran-2024.json")
    subjects = [s for s in document["subjects"] if not s["code"].endswith(DESIGNDS_ABSENT_SUFFIX)]
    subjects = update_basic_science_subjects(subjects)

    # Ⅰ類：類共通基礎・専門選択科目の番号ずれ（同じ科目の番号違いのみで、名称・単位数は
    # 変わらない）を科目マスタ側にも反映する。要件JSON側はupdate_first_cluster_requirementsで調整済み。
    code_renames: dict[str, str] = {}
    for mapping in FIRST_CLUSTER_BASIC_RENUMBER.values():
        code_renames.update(mapping)
    for mapping in FIRST_CLUSTER_MAJOR_RENUMBER.values():
        code_renames.update(mapping)
    for subject in subjects:
        if subject["code"] in code_renames:
            subject["code"] = code_renames[subject["code"]]

    by_code = {subject["code"]: subject for subject in subjects}
    for code in ("COM001a", "COM001b", "COM001c", "COM001d"):
        by_code[code]["name"] = "情報工学工房"

    subjects = update_second_cluster_subjects(subjects)
    subjects = update_third_cluster_subjects(subjects)
    subjects = update_evening_subjects(subjects)

    # メディア情報学の「形式言語理論」（COM406a）は2025年度マスタに追加済みのため、
    # 2024年度経由でここまで自然に引き継がれる（2026-09-14訂正：以前はここで個別に追加
    # していたが、2025年度マスタへの追加により科目マスタ側の重複原因になっていた）。

    subjects = normalize_special_lecture_subjects(subjects)
    document["subjects"] = sorted(subjects, key=lambda subject: subject["code"])
    document["source"] = "学修要覧2022（情報理工学域）付録Cを基準にした年度別科目マスタ。開講情報は原則2026年度シラバス基準"
    document["note"] = "2022年度の旧カリキュラム用。年度ごとに科目番号・単位数が異なる可能性があるため、他年度のマスタと分けて参照する"
    write_json(SUBJECTS_DIR / "youran-2022.json", document)
    return len(document["subjects"])


def main() -> None:
    """2022年度の要件JSONと科目マスタを生成して件数を表示する。"""
    requirement_paths = copy_requirement_files()
    update_common_requirements()
    update_class_i_requirements()
    update_math_basic_requirements()
    update_first_cluster_requirements()
    update_second_cluster_requirements()
    update_third_cluster_requirements()
    update_evening_requirements()
    subject_count = copy_subject_master()
    print(f"2022年度データを生成しました: requirements={len(requirement_paths)} subjects={subject_count}")


if __name__ == "__main__":
    main()
