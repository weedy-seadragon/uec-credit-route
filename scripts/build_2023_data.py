"""2024年度データを土台に、学修要覧2023の年度別データを作る。

付録Cと別表2を照合した範囲では、2023年度の科目表・卒業要件は2024年度版と同じ構成だったため、
年度参照と出典だけを2023年度用に置き換える。

実行: python scripts/build_2023_data.py
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


def copy_subject_master() -> int:
    """2024年度と共通の科目マスタを複製し、出典年度だけを2023へ更新する。"""
    document = load_json(SUBJECTS_DIR / "youran-2024.json")
    document["source"] = "学修要覧2023（情報理工学域）付録C。昼間コース共通科目＋Ⅰ・Ⅱ・Ⅲ類15プログラム＋夜間主収録"
    document["note"] = "2024年度版を土台に学修要覧2023との差分を反映。開講情報は原則2026年度シラバス基準"
    write_json(SUBJECTS_DIR / "youran-2023.json", document)
    return len(document["subjects"])


def main() -> None:
    """2023年度の要件JSONと科目マスタを生成して件数を表示する。"""
    requirement_paths = copy_requirement_files()
    subject_count = copy_subject_master()
    print(f"2023年度データを生成しました: requirements={len(requirement_paths)} subjects={subject_count}")


if __name__ == "__main__":
    main()
