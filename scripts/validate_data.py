"""data/ のJSONが学修要覧の別表2・別表3・別表4と矛盾していないかを検査する。

実行: python scripts/validate_data.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


# このファイルの場所を基準にしてdataディレクトリを参照する。
DATA_ROOT = Path(__file__).resolve().parents[1] / "data"
YEARS = (2025, 2026)
errors: list[str] = []

# 別表2で検証済みのⅠ類メディア情報学の必要単位を年度共通の基準として持つ。
MEDIA_EXPECTED = {
    "hss": 8, "lang-basic-1": 4, "lang-appl-1": 2, "lang-basic-2": 2,
    "lang-seminar": 2, "health": 3, "sci-liberal": 2, "advanced": 4,
    "general": 27, "intro": 6, "datasci": 3, "career": 4, "tech-eng": 4,
    "practical": 17, "math-basic": 18, "cluster-basic-req": 15,
    "cluster-basic-sel": 8, "major-req": 13, "major-sel": 22, "specialized": 76,
}


def load(relative_path: str) -> dict[str, Any]:
    """dataディレクトリ以下のJSONをUTF-8で読み込む。"""
    with (DATA_ROOT / relative_path).open(encoding="utf-8") as file:
        return json.load(file)


def walk(groups: list[dict[str, Any]]):
    """入れ子になった要件グループを深さ優先で列挙する。"""
    # 親グループを返してから、子グループを同じ規則でたどる。
    for group in groups:
        yield group
        yield from walk(group.get("children", []))


def add_error(year: int, message: str) -> None:
    """どの年度の問題か分かる形で検証エラーを保存する。"""
    errors.append(f"{year}: {message}")


def subject_credits(year: int, codes: list[str], subjects: dict[str, dict[str, Any]]) -> int:
    """科目番号一覧の単位を合計し、未知の番号も同時に報告する。"""
    total = 0
    # 未登録科目は加算せず、別の検証エラーとして記録する。
    for code in codes:
        if code not in subjects:
            add_error(year, f"科目マスタにない科目番号: {code}")
            continue
        total += subjects[code]["credits"]
    return total


def check_required_group(year: int, group: dict[str, Any], subjects: dict[str, dict[str, Any]]) -> None:
    """必修グループの登録単位合計がrequiredと一致するか確かめる。"""
    # 選択科目や科目を直接持たない親グループはこの検査の対象外にする。
    if group.get("kind") == "required" and group.get("subjects"):
        # 留学生専用科目は通常学生の必修単位合計から除く。
        codes = [code for code in group["subjects"] if not subjects.get(code, {}).get("forInternational")]
        total = subject_credits(year, codes, subjects)
        if total != group["required"]:
            add_error(year, f"必修グループ {group['id']} の単位合計 {total} != required {group['required']}")


def check_children_sum(year: int, group: dict[str, Any]) -> None:
    """親グループのrequiredが卒業算入対象の子グループ合計と一致するか確かめる。"""
    children = group.get("children")
    # 子とrequiredの両方を持つ親グループだけを検査する。
    if children and group.get("required"):
        total = sum(
            child.get("required", 0)
            for child in children
            if child.get("countAs") != "common" and child.get("kind") not in ("free", "international")
        )
        if total and total != group["required"]:
            add_error(year, f"グループ {group['id']} の required {group['required']} != 子の合計 {total}")


def walk_condition(
    year: int,
    condition: Any,
    groups_by_id: dict[str, dict[str, Any]],
    subjects: dict[str, dict[str, Any]],
) -> None:
    """審査条件を再帰的に調べ、参照先のグループと科目が存在するか確かめる。"""
    # 条件オブジェクト以外の値は参照を持たないため読み飛ばす。
    if not isinstance(condition, dict):
        return
    if "groupId" in condition and condition["groupId"] not in groups_by_id:
        add_error(year, f"審査条件が未知のグループを参照: {condition['groupId']}")
    # 科目番号を直接参照する条件をすべて確認する。
    for code in condition.get("codes", []):
        if code not in subjects:
            add_error(year, f"審査条件が未知の科目を参照: {code}")
    # allOfとanyOfの内側も同じ規則で確認する。
    for key in ("allOf", "anyOf"):
        for child in condition.get(key, []):
            walk_condition(year, child, groups_by_id, subjects)


def check_group_subjects(
    year: int,
    label: str,
    groups: list[dict[str, Any]],
    subjects: dict[str, dict[str, Any]],
) -> None:
    """グループ内の全科目参照と単位集計上の整合性を確認する。"""
    # 入れ子の各グループへ同じ基本検査を適用する。
    for group in walk(groups):
        check_required_group(year, group, subjects)
        check_children_sum(year, group)
        # subjectsにある番号はすべて同年度の科目マスタに必要となる。
        for code in group.get("subjects", []):
            if code not in subjects:
                add_error(year, f"{label} {group['id']}: 科目マスタにない {code}")


def check_media_table(year: int, common_groups: list[dict[str, Any]], media_document: dict[str, Any]) -> None:
    """Ⅰ類メディア情報学の必要単位を別表2の確認済み数値と照合する。"""
    groups_by_id = {group["id"]: group for group in common_groups + list(walk(media_document["groups"]))}
    # 各区分が存在し、必要単位が別表2の値と一致するかを確認する。
    for group_id, expected in MEDIA_EXPECTED.items():
        if group_id not in groups_by_id:
            add_error(year, f"グループが存在しない: {group_id}")
        elif groups_by_id[group_id]["required"] != expected:
            add_error(year, f"別表2と不一致: {group_id} required={groups_by_id[group_id]['required']} 期待={expected}")


def check_known_2026_differences(
    subjects: dict[str, dict[str, Any]],
    programs: dict[str, dict[str, Any]],
) -> None:
    """PDF比較で確定した2026固有差分が生成後も保たれているか検査する。"""
    required_present = {
        "INT006z", "INT007z", "MTHa02c", "ELE506g", "ELE506h", "BCHa04r",
        *(f"GSE{number}{suffix}" for suffix in "mnpr" for number in ("101", "201")),
    }
    # 新設・分離された科目が2026マスタに存在することを確認する。
    for code in sorted(required_present):
        if code not in subjects:
            add_error(2026, f"学修要覧2026の追加科目がない: {code}")

    required_absent = {
        "MTHb04c", "COMb02k", "MCEb13k", "BIOb02r",
        *(f"UEC{number}{suffix}" for suffix in "mnpr" for number in ("302", "501", "701")),
    }
    # 廃止・番号変更前の科目が2026マスタへ残っていないことを確認する。
    for code in sorted(required_absent):
        if code in subjects:
            add_error(2026, f"学修要覧2026で廃止・変更された科目が残っている: {code}")

    workshop_codes = {f"GSE{number}{suffix}" for suffix in "mnpr" for number in ("101", "201")}
    # Ⅲ類は他プログラムの選択科目も算入できるため、全5要件へ8科目が必要になる。
    for filename, document in programs.items():
        if "day-III-" not in filename:
            continue
        major_select = next(group for group in walk(document["groups"]) if group["id"] == "major-sel")
        missing = workshop_codes - set(major_select["subjects"])
        if missing:
            add_error(2026, f"{filename} のサイエンス工房が不足: {sorted(missing)}")


def validate_year(year: int) -> tuple[int, int]:
    """1年度分の科目マスタ・共通要件・全プログラム要件をまとめて検証する。"""
    subject_document = load(f"subjects/youran-{year}.json")
    subject_list = subject_document["subjects"]
    subjects = {subject["code"]: subject for subject in subject_list}
    # 同じ科目番号が重複すると辞書化で隠れるため、件数差で明示的に検出する。
    if len(subjects) != len(subject_list):
        add_error(year, "科目マスタに重複した科目番号がある")

    common = load(f"requirements/{year}-day-common.json")
    if common.get("entryYear") != year:
        add_error(year, f"{year}-day-common.json: entryYearが{year}ではない")
    program_paths = sorted(
        path for path in (DATA_ROOT / "requirements").glob(f"{year}-*.json")
        if path.name != f"{year}-day-common.json"
    )
    programs = {path.name: load(f"requirements/{path.name}") for path in program_paths}
    if len(programs) != 16:
        add_error(year, f"プログラム要件ファイル数 {len(programs)} != 16")

    common_groups = list(walk(common["groups"]))
    check_group_subjects(year, "共通要件", common["groups"], subjects)
    # 共通単位へ直接算入する科目番号もマスタ参照として検査する。
    for code in common.get("commonCreditSources", {}).get("alwaysCommon", []):
        if code not in subjects:
            add_error(year, f"共通単位対象が科目マスタにない: {code}")

    # 各プログラムの科目参照、小計、審査条件を検証する。
    for filename, document in programs.items():
        if document.get("entryYear") != year:
            add_error(year, f"{filename}: entryYearが{year}ではない")
        # 昼間プログラムは同年度の共通要件を参照し、夜間主は自己完結とする。
        if document.get("course") == "day" and document.get("extends") != f"{year}-day-common.json":
            add_error(year, f"{filename}: extendsが同年度の共通要件ではない")
        check_group_subjects(year, filename, document["groups"], subjects)
        all_groups = common_groups + list(walk(document["groups"]))
        groups_by_id = {group["id"]: group for group in all_groups}
        subtotals = document["subtotals"]
        if sum(subtotals[key] for key in ("general", "practical", "specialized", "common")) != document["totalCredits"]:
            add_error(year, f"{filename}: 小計の和がtotalCreditsと一致しない")
        # 審査条件が参照する科目・区分を再帰的に確認する。
        for review in document.get("reviews", []):
            walk_condition(year, review, groups_by_id, subjects)
            # 審査不合格時の履修不可科目もマスタに存在する必要がある。
            for code in review.get("onFail", {}).get("blockedSubjects", []):
                if code not in subjects:
                    add_error(year, f"{filename} onFailが未知の科目を参照: {code}")

    check_media_table(year, common_groups, programs[f"{year}-day-I-media.json"])
    # standardSemesterは1～8または未設定だけを許可する。
    for subject in subjects.values():
        semester = subject.get("standardSemester")
        if semester is not None and not 1 <= semester <= 8:
            add_error(year, f"standardSemesterが範囲外: {subject['code']}")
    # 2026年度だけは今回確定した差分そのものも回帰検査する。
    if year == 2026:
        check_known_2026_differences(subjects, programs)
    return len(subjects), len(programs)


def main() -> None:
    """対応する全年度を検証し、成功時は年度ごとの件数を表示する。"""
    summaries: list[str] = []
    # 対応年度を順に検証し、最後にまとめて結果を出す。
    for year in YEARS:
        subject_count, program_count = validate_year(year)
        summaries.append(f"{year} subjects={subject_count} programs={program_count}")
    if errors:
        print("NG")
        # 問題を一度に直せるよう、見つかったエラーをすべて表示する。
        for error in errors:
            print(" -", error)
        sys.exit(1)
    print("OK: " + "; ".join(summaries))


# 直接実行時だけ検証を開始し、テストからimportした際の副作用を防ぐ。
if __name__ == "__main__":
    main()
