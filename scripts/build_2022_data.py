"""学修要覧2022を基準に、2022年度用の要件データを生成する。

2022年度はデザイン思考・データサイエンスプログラムがまだ無いため、2024年度の対応する
要件ファイルを土台にして当該プログラムを除く。別表2で確認できるⅠ類の単位配分もここで反映する。

実行: python scripts/build_2022_data.py
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


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
    """別表2の2022年度Ⅰ類の理数基礎・専門・共通単位の値へ合わせる。"""
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
        # 別表2ではⅠ類の理数基礎は20単位。基礎科学実験A2を必修として加える。
        groups["math-basic"]["required"] = 20
        groups["math-basic-req"]["required"] = 20
        if "PHY201z" not in groups["math-basic-req"]["subjects"]:
            groups["math-basic-req"]["subjects"].append("PHY201z")
        groups["specialized"]["required"] = specialized
        document["subtotals"]["specialized"] = specialized
        document["subtotals"]["common"] = common
        write_json(path, document)


def update_common_requirements() -> None:
    """2022年度の共通要件へ、理数基礎へ移っていた実験科目の所属を反映する。"""
    path = REQUIREMENTS_DIR / "2022-day-common.json"
    document = load_json(path)
    groups = groups_by_id(document)
    # 基礎科学実験A2は2022年度には初年次導入ではなく理数基礎へ算入される。
    groups["intro"]["subjects"] = [code for code in groups["intro"]["subjects"] if code != "PHY201z"]
    write_json(path, document)


def copy_subject_master() -> int:
    """旧体系と共通する科目情報を2022年度マスタとして複製し、年度参照を分離する。"""
    document = load_json(SUBJECTS_DIR / "youran-2024.json")
    # 付録Cでは基礎科学実験A1/A2は2022年度に各2単位として掲載されている。
    for subject in document["subjects"]:
        if subject["code"] in {"PHY101z", "PHY201z"}:
            subject["credits"] = 2
    document["source"] = "学修要覧2022（情報理工学域）付録Cを基準にした年度別科目マスタ。開講情報は原則2026年度シラバス基準"
    document["note"] = "2022年度の旧カリキュラム用。年度ごとに科目番号・単位数が異なる可能性があるため、他年度のマスタと分けて参照する"
    write_json(SUBJECTS_DIR / "youran-2022.json", document)
    return len(document["subjects"])


def main() -> None:
    """2022年度の要件JSONと科目マスタを生成して件数を表示する。"""
    requirement_paths = copy_requirement_files()
    update_common_requirements()
    update_class_i_requirements()
    subject_count = copy_subject_master()
    print(f"2022年度データを生成しました: requirements={len(requirement_paths)} subjects={subject_count}")


if __name__ == "__main__":
    main()
