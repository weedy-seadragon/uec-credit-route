"""2025年度データを土台に、学修要覧2026で確認した差分を反映して2026年度データを作る。

実行: python scripts/build_2026_data.py
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any


# このスクリプトの場所を基準にして、実行場所に左右されない入出力先を決める。
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
REQUIREMENTS_DIR = DATA_DIR / "requirements"
SUBJECTS_2025_PATH = DATA_DIR / "subjects" / "youran-2025.json"
SUBJECTS_2026_PATH = DATA_DIR / "subjects" / "youran-2026.json"

# 2026年度にサイエンス工房へ置き換わった4プログラムをまとめて扱う。
SCIENCE_WORKSHOP_SUFFIXES = ("m", "n", "p", "r")


def load_json(path: Path) -> dict[str, Any]:
    """UTF-8のJSONファイルを読み込み、辞書として返す。"""
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def write_json(path: Path, value: dict[str, Any]) -> None:
    """差分を確認しやすいインデント付きUTF-8 JSONとして保存する。"""
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def walk_groups(groups: list[dict[str, Any]]):
    """入れ子になった要件グループを上から順にすべて列挙する。"""
    # 各グループ自身を返した後、その子グループも再帰的にたどる。
    for group in groups:
        yield group
        yield from walk_groups(group.get("children", []))


def find_group(document: dict[str, Any], group_id: str) -> dict[str, Any]:
    """要件JSONから指定IDのグループを1件取得する。"""
    # IDが一致するグループを見つけた時点で返す。
    for group in walk_groups(document["groups"]):
        if group["id"] == group_id:
            return group
    # 生成規則の変更漏れを黙って通さないため、見つからなければ停止する。
    raise KeyError(f"要件グループが見つかりません: {group_id}")


def append_unique(codes: list[str], additions: list[str]) -> None:
    """既存の順番を保ちながら、未登録の科目番号だけを末尾へ追加する。"""
    # 再実行しても同じ番号が重複しないように存在確認する。
    for code in additions:
        if code not in codes:
            codes.append(code)


def remove_codes(codes: list[str], removals: set[str]) -> list[str]:
    """指定された科目番号を一覧から除外して返す。"""
    return [code for code in codes if code not in removals]


def make_subject(
    code: str,
    name: str,
    credits: int,
    standard_semester: int | None,
    groups: list[str],
    *,
    graduate_linked: bool = False,
    evening_allowed: bool = False,
    note: str | None = None,
) -> dict[str, Any]:
    """科目マスタの共通形式に合わせて、新設・番号変更科目を1件作る。"""
    # 学期番号がある場合だけ、学年と前後学期を機械的に求める。
    if standard_semester is not None:
        standard_year = (standard_semester + 1) // 2
        term_type = "前学期" if standard_semester % 2 == 1 else "後学期"
    else:
        standard_year = None
        term_type = None

    subject: dict[str, Any] = {
        "code": code,
        "name": name,
        "credits": credits,
        "field": code[:3],
        "standardSemester": standard_semester,
        "standardYear": standard_year,
        "termType": term_type,
        "eveningAllowed": evening_allowed,
        "forInternational": False,
        "graduateLinked": graduate_linked,
        "groups": groups,
    }
    # 注釈がある科目だけnoteを持たせ、空の項目を増やさない。
    if note:
        subject["note"] = note
    return subject


def copy_requirement_files() -> list[Path]:
    """2025年度の全要件JSONを複製し、年度と参照先を2026へ更新する。"""
    output_paths: list[Path] = []
    # 共通・昼間15プログラム・夜間主の全ファイルを同じ規則で複製する。
    for source_path in sorted(REQUIREMENTS_DIR.glob("2025-*.json")):
        document = load_json(source_path)
        document["entryYear"] = 2026
        # 出典文字列に含まれる年度だけを更新し、章・別表番号は保持する。
        if isinstance(document.get("source"), str):
            document["source"] = document["source"].replace("2025", "2026")
        # プログラム要件が参照する昼間共通要件も2026年度版へ切り替える。
        if isinstance(document.get("extends"), str):
            document["extends"] = document["extends"].replace("2025-", "2026-")
        output_path = REQUIREMENTS_DIR / source_path.name.replace("2025-", "2026-", 1)
        write_json(output_path, document)
        output_paths.append(output_path)
    return output_paths


def update_common_requirement() -> None:
    """2026年度に追加された海外研修I・IIを共通単位対象へ加える。"""
    path = REQUIREMENTS_DIR / "2026-day-common.json"
    document = load_json(path)
    always_common = document["commonCreditSources"]["alwaysCommon"]
    append_unique(always_common, ["INT006z", "INT007z"])
    write_json(path, document)


def update_mathinfo_requirement() -> None:
    """情報数理工学の大学院連携科目の追加・廃止・番号変更を反映する。"""
    path = REQUIREMENTS_DIR / "2026-day-I-mathinfo.json"
    document = load_json(path)
    group = find_group(document, "major-free")
    old_codes = {"MTHb01c", "MTHb02c", "MTHb03c", "MTHb04c"}
    group["subjects"] = remove_codes(group["subjects"], old_codes)
    append_unique(
        group["subjects"],
        ["MTHa02c", "MTHb01c", "MTHb02c", "MTHb03c"],
    )
    write_json(path, document)


def update_second_cluster_requirements() -> None:
    """Ⅱ類で重複番号から分離されたマルチメディア処理を自由科目へ加える。"""
    targets = {
        "2026-day-II-netinfo.json": "ELE506g",
        "2026-day-II-electroinfo.json": "ELE506h",
    }
    # それぞれのプログラム固有番号を対応する自由科目一覧へ加える。
    for filename, code in targets.items():
        path = REQUIREMENTS_DIR / filename
        document = load_json(path)
        append_unique(find_group(document, "major-free")["subjects"], [code])
        write_json(path, document)


def update_third_cluster_requirements() -> None:
    """Ⅲ類のサイエンス工房追加とUECパスポート廃止を全プログラムへ反映する。"""
    workshop_codes = [
        f"GSE{number}{suffix}"
        for suffix in SCIENCE_WORKSHOP_SUFFIXES
        for number in ("101", "201")
    ]
    target_paths = sorted(REQUIREMENTS_DIR.glob("2026-day-III-*.json"))

    # 他プログラムの選択科目も算入できるため、5プログラムすべてに8科目を展開する。
    for path in target_paths:
        document = load_json(path)
        append_unique(find_group(document, "major-sel")["subjects"], workshop_codes)
        # 機械システム以外の4プログラムではUECパスポート3科目が科目表から外れた。
        if document.get("programSuffix") in SCIENCE_WORKSHOP_SUFFIXES:
            suffix = document["programSuffix"]
            passport_codes = {f"UEC302{suffix}", f"UEC501{suffix}", f"UEC701{suffix}"}
            free_group = find_group(document, "major-free")
            free_group["subjects"] = remove_codes(free_group["subjects"], passport_codes)
            free_group["note"] = free_group["note"].replace("UECパスポートプログラム、", "")
        write_json(path, document)


def update_mechanical_requirement() -> None:
    """機械システムの廃止科目とMCEb系列の繰り上げ後の番号を反映する。"""
    path = REQUIREMENTS_DIR / "2026-day-III-mecha.json"
    document = load_json(path)
    free_group = find_group(document, "major-free")
    removed = {"COMb02k", "MCEb13k"} | {f"MCEb{number:02d}k" for number in range(3, 13)}
    free_group["subjects"] = remove_codes(free_group["subjects"], removed)
    append_unique(free_group["subjects"], [f"MCEb{number:02d}k" for number in range(3, 13)])
    write_json(path, document)


def update_chembio_requirement() -> None:
    """化学生命工学の特論分割とゲノム生物学特論の廃止を反映する。"""
    path = REQUIREMENTS_DIR / "2026-day-III-chembio.json"
    document = load_json(path)
    free_group = find_group(document, "major-free")
    free_group["subjects"] = remove_codes(free_group["subjects"], {"BIOb02r"})
    # 化学生命工学特論BをAの直後に置き、一覧で連続して見えるようにする。
    index = free_group["subjects"].index("BCHa03r") + 1
    if "BCHa04r" not in free_group["subjects"]:
        free_group["subjects"].insert(index, "BCHa04r")
    write_json(path, document)


def build_subject_master() -> int:
    """2025科目マスタを複製し、2026年度の新設・廃止・番号変更を適用する。"""
    document = copy.deepcopy(load_json(SUBJECTS_2025_PATH))
    document["source"] = "学修要覧2026（情報理工学域）付録C。昼間コース共通科目＋Ⅰ・Ⅱ・Ⅲ類15プログラム＋夜間主収録"
    document["note"] = (
        "2025年度版を土台に学修要覧2026との差分を反映。変更のない科目のofferingsは、"
        "2026年度シラバスから取得済みの情報を引き継ぐ。新設・番号変更科目は誤リンク防止のため未設定"
    )
    by_code = {subject["code"]: subject for subject in document["subjects"]}

    # 2026年度に科目表から外れた科目番号をマスタから削除する。
    removed_codes = {
        "MTHb04c",
        "COMb02k",
        "MCEb13k",
        "BIOb02r",
        "BCHa03r",
        *(
            f"UEC{number}{suffix}"
            for suffix in SCIENCE_WORKSHOP_SUFFIXES
            for number in ("302", "501", "701")
        ),
    }
    # 旧MCEb03は廃止、旧MCEb04以降は後で新番号として作り直すため一度除く。
    removed_codes.update(f"MCEb{number:02d}k" for number in range(3, 14))
    # 名称と科目番号の対応が変わるMTHb系列も一度除いて再作成する。
    removed_codes.update({"MTHb01c", "MTHb02c", "MTHb03c"})
    subjects = [subject for subject in document["subjects"] if subject["code"] not in removed_codes]

    additions: list[dict[str, Any]] = [
        make_subject("INT006z", "海外研修Ⅰ", 1, None, ["intl-abroad"], evening_allowed=True, note="集中。共通単位。1～8学期で履修可"),
        make_subject("INT007z", "海外研修Ⅱ", 2, None, ["intl-abroad"], evening_allowed=True, note="集中。共通単位。1～8学期で履修可"),
        make_subject("MTHa02c", "プログラム言語基礎論", 2, 8, ["major-free"], graduate_linked=True, evening_allowed=True),
        make_subject("MTHb01c", "シミュレーション理工学基礎論", 2, 8, ["major-free"], graduate_linked=True, evening_allowed=True),
        make_subject("MTHb02c", "離散最適化基礎論", 2, 8, ["major-free"], graduate_linked=True, evening_allowed=True),
        make_subject("MTHb03c", "連続最適化基礎論", 2, 8, ["major-free"], graduate_linked=True, evening_allowed=True),
        make_subject("ELE506g", "マルチメディア処理", 2, 5, ["major-free"], graduate_linked=True),
        make_subject("ELE506h", "マルチメディア処理", 2, 5, ["major-free"], graduate_linked=True),
        make_subject("BCHa03r", "化学生命工学特論A", 1, None, ["major-free"], graduate_linked=True, note="集中"),
        make_subject("BCHa04r", "化学生命工学特論B", 1, None, ["major-free"], graduate_linked=True, note="集中"),
    ]

    # 4プログラム分のサイエンス工房A・Bを追加する。
    for suffix in SCIENCE_WORKSHOP_SUFFIXES:
        additions.extend(
            [
                make_subject(f"GSE101{suffix}", "サイエンス工房A", 1, 1, ["major-sel"], note="複数学年で履修可"),
                make_subject(f"GSE201{suffix}", "サイエンス工房B", 1, 2, ["major-sel"], note="複数学年で履修可"),
            ]
        )

    # 旧MCEb04～13の名称を保ち、2026年度のMCEb03～12へ一つずつ繰り上げる。
    for old_number in range(4, 14):
        old_code = f"MCEb{old_number:02d}k"
        new_code = f"MCEb{old_number - 1:02d}k"
        old_subject = by_code[old_code]
        additions.append(
            make_subject(
                new_code,
                old_subject["name"],
                old_subject["credits"],
                old_subject["standardSemester"],
                old_subject["groups"],
                graduate_linked=old_subject.get("graduateLinked", False),
                evening_allowed=old_subject.get("eveningAllowed", False),
                note=old_subject.get("note"),
            )
        )

    subjects.extend(additions)
    # 科目番号順に揃え、生成のたびに安定した差分になるようにする。
    document["subjects"] = sorted(subjects, key=lambda subject: subject["code"])
    write_json(SUBJECTS_2026_PATH, document)
    return len(document["subjects"])


def main() -> None:
    """要件と科目マスタを生成し、作成件数を表示する。"""
    requirement_paths = copy_requirement_files()
    update_common_requirement()
    update_mathinfo_requirement()
    update_second_cluster_requirements()
    update_third_cluster_requirements()
    update_mechanical_requirement()
    update_chembio_requirement()
    subject_count = build_subject_master()
    print(f"2026年度データを生成しました: requirements={len(requirement_paths)} subjects={subject_count}")


# 直接実行された場合だけ生成処理を開始し、import時の意図しない書き込みを防ぐ。
if __name__ == "__main__":
    main()
