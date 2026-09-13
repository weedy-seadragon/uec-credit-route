"""2024年度データを土台に、学修要覧2023の年度別データを作る。

付録Cと別表2を画像で照合したところ、大半のプログラムは2024年度版と同じ構成だったが、
デザイン思考・データサイエンスプログラムだけ「データサイエンス演習」（COM502e）が独立した
必修科目として存在し、以降のCOM50Xeが2024年度から1つずつ番号がずれる（2026-09-14訂正、
docs/YOURAN_2023_COMPARISON.md参照）。

実行: python scripts/build_2023_data.py
"""

from __future__ import annotations

import copy
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
    """入れ子になった要件グループを上から順にすべて列挙する。"""
    for group in groups:
        yield group
        yield from walk_groups(group.get("children", []))


def find_group(document: dict[str, Any], group_id: str) -> dict[str, Any]:
    """要件JSONから指定IDのグループを1件取得する。"""
    for group in walk_groups(document["groups"]):
        if group["id"] == group_id:
            return group
    raise KeyError(f"要件グループが見つかりません: {group_id}")


def copy_requirement_files() -> list[Path]:
    """2024年度の全要件ファイルを2023年度用として複製し、年度参照だけを置き換える。"""
    outputs: list[Path] = []
    for source_path in sorted(REQUIREMENTS_DIR.glob("2024-*.json")):
        document = load_json(source_path)
        document["entryYear"] = 2023
        document["source"] = document.get("source", "").replace("2024", "2023")
        if isinstance(document.get("extends"), str):
            document["extends"] = document["extends"].replace("2024-", "2023-")
        output_path = REQUIREMENTS_DIR / source_path.name.replace("2024-", "2023-", 1)
        write_json(output_path, document)
        outputs.append(output_path)
    return outputs


def update_designds_requirement() -> None:
    """デザイン思考・データサイエンス：独立必修科目「データサイエンス演習」の追加による
    必修/選択の配分変化と、以降のCOM50Xeの番号ずれを反映する。
    """
    path = REQUIREMENTS_DIR / "2023-day-I-designds.json"
    document = load_json(path)

    major_req = find_group(document, "major-req")
    major_req["required"] = 20
    index = major_req["subjects"].index("COM502e")
    major_req["subjects"].insert(index + 1, "COM503e")

    major_sel = find_group(document, "major-sel")
    major_sel["required"] = 16
    major_sel["subjects"] = [
        {"COM503e": "COM504e", "COM504e": "COM505e"}.get(code, code) for code in major_sel["subjects"]
    ]

    major_free = find_group(document, "major-free")
    major_free["subjects"] = [
        "COM506e" if code == "COM505e" else code
        for code in major_free["subjects"]
        if code not in ("COM002e", "COM003e", "LAB501e")
    ]

    write_json(path, document)


def copy_subject_master() -> int:
    """2024年度と共通の科目マスタを複製し、出典年度とデザイン思考・データサイエンスの
    COM50Xe（データサイエンス演習の追加による番号ずれ）を2023年度向けに直す。
    """
    document = load_json(SUBJECTS_DIR / "youran-2024.json")
    document["source"] = "学修要覧2023（情報理工学域）付録C。昼間コース共通科目＋Ⅰ・Ⅱ・Ⅲ類15プログラム＋夜間主収録"
    document["note"] = "2024年度版を土台に学修要覧2023との差分を反映。開講情報は原則2026年度シラバス基準"

    subjects = document["subjects"]
    by_code = {subject["code"]: subject for subject in subjects}
    old502, old503, old504, old505 = (copy.deepcopy(by_code[c]) for c in ("COM502e", "COM503e", "COM504e", "COM505e"))

    # オペレーティングシステム論（503→504）：offeringsごと引き継ぐ。
    by_code["COM504e"].clear()
    by_code["COM504e"].update(old503, code="COM504e", groups=["major-sel"])
    # メディア分析法（504→505）。
    by_code["COM505e"].clear()
    by_code["COM505e"].update(old504, code="COM505e", groups=["major-sel"])
    # マルチメディア処理（505→506、自由科目として新規追加）。
    subjects.append({**old505, "code": "COM506e", "groups": ["major-free"]})
    # データサイエンス実践演習１（502→503、必修）。
    by_code["COM503e"].clear()
    by_code["COM503e"].update(old502, code="COM503e", groups=["major-req"])
    # データサイエンス演習（502、新規の必修科目）。
    by_code["COM502e"].clear()
    by_code["COM502e"].update(
        code="COM502e", name="データサイエンス演習", credits=1, field="COM",
        standardSemester=5, standardYear=3, termType="前学期",
        eveningAllowed=False, forInternational=False, graduateLinked=False, groups=["major-req"],
    )

    document["subjects"] = sorted(subjects, key=lambda subject: subject["code"])
    write_json(SUBJECTS_DIR / "youran-2023.json", document)
    return len(document["subjects"])


def main() -> None:
    """2023年度の要件JSONと科目マスタを生成して件数を表示する。"""
    requirement_paths = copy_requirement_files()
    update_designds_requirement()
    subject_count = copy_subject_master()
    print(f"2023年度データを生成しました: requirements={len(requirement_paths)} subjects={subject_count}")


if __name__ == "__main__":
    main()
