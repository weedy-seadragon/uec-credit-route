"""2024年度データを土台に、学修要覧2023の年度別データを作る。

付録Cと別表2を画像で照合したところ、次の差分が見つかった（2026-09-14訂正、
docs/YOURAN_2023_COMPARISON.md参照）。

- Ⅰ類5プログラム共通：「情報工学工房」がA/B/Cに分かれておらず1科目のみ（COM001x、B・Cの
  COM002x/COM003xは2024年度新設）。GLTPラボワーク（LAB501x）も2024年度新設で2023年度には無い
- メディア情報学プログラムのみ：現代代数学・数理解析学が自分専用の番号（MTHb02a/MTHb03a）を
  持たず、経営・社会情報学プログラムの番号（MTHb02b/MTHb03b）をそのまま参照している
- デザイン思考・データサイエンスプログラムだけ「データサイエンス演習」（COM502e）が独立した
  必修科目として存在し、以降のCOM50Xeが2024年度から1つずつ番号がずれる

Ⅱ類5・Ⅲ類5プログラムと夜間主課程についても同様に照合した（2026-09-14追加）。

- Ⅱ類5・Ⅲ類5プログラム共通：GLTPラボワーク（LAB501x）は2024年度新設でⅠ類同様2023年度には無い
- 情報通信工学（g）・電子情報学（h）：「量子と情報」（PHY502g/h）は2024年度に「量子力学」から
  改称された科目。プロジェクトの方針（開発者確認済み、2026-09-14）で、同じ科目番号のまま名前だけ
  変わった科目は現行名（シラバス基準）に統一するため、2023年度データも現行名のままにする
- 計測制御システム（i）・先端ロボティクス（j）：「機械計測工学」（GSE401i/j）も同様に2024年度に
  「計測工学」から改称された科目だが、現行名のまま統一する
- 電子工学（m）：「画像情報学基礎」（ELEa02m）は2024年度新設
- 物理工学（p）：「凝縮体量子工学特論」（PHYb03p）・「ナノトライボロジー特論」（PHYb04p）は
  2024年度新設
- 化学生命工学（r）：大学院連携科目7件（PHYb01r・CHMb01r・BCHa02r・BCHa03r・CHMb02r・
  CHMb03r・BIOb02r）は2024年度新設
- 夜間主課程：人文・社会科学科目に「美術」（HSS102s）・「経済学」（HSS104s）が存在し、
  2024年度に廃止された。以降の科目（音楽・社会学・法学・地理学・社会思想史）は番号が2つ
  ずつ若返る（例: 音楽は2023年度HSS103s→2024年度HSS102s）

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


def update_first_cluster_requirements() -> None:
    """Ⅰ類5プログラム共通：情報工学工房B・C・GLTPラボワークの2024年度新設分を外す。
    メディア情報学だけは、現代代数学・数理解析学を経営・社会情報学の番号で参照するよう戻す。
    """
    for program, suffix in (("media", "a"), ("management", "b"), ("mathinfo", "c"), ("cs", "d")):
        path = REQUIREMENTS_DIR / f"2023-day-I-{program}.json"
        document = load_json(path)
        free_group = find_group(document, "major-free")
        removed = {f"COM002{suffix}", f"COM003{suffix}", f"LAB501{suffix}"}
        subjects = [code for code in free_group["subjects"] if code not in removed]
        if suffix == "a":
            rename = {"MTHb02a": "MTHb02b", "MTHb03a": "MTHb03b"}
            subjects = [rename.get(code, code) for code in subjects]
        free_group["subjects"] = subjects
        write_json(path, document)


def update_second_third_cluster_requirements() -> None:
    """Ⅱ類5・Ⅲ類5プログラム共通：GLTPラボワークの2024年度新設分を外す。
    電子工学（m）・物理工学（p）・化学生命工学（r）は、それぞれ2024年度新設の
    大学院連携科目も合わせて外す。
    """
    removed_by_program = {
        "II-security": {"LAB501f"},
        "II-netinfo": {"LAB501g"},
        "II-electroinfo": {"LAB501h"},
        "II-control": {"LAB501i"},
        "II-robotics": {"LAB501j"},
        "III-mecha": {"LAB501k"},
        "III-electro": {"LAB501m", "ELEa02m"},
        "III-optical": {"LAB501n"},
        "III-physics": {"LAB501p", "PHYb03p", "PHYb04p"},
        "III-chembio": {
            "LAB501r", "PHYb01r", "CHMb01r", "BCHa02r", "BCHa03r", "CHMb02r", "CHMb03r", "BIOb02r",
        },
    }
    for program, removed in removed_by_program.items():
        path = REQUIREMENTS_DIR / f"2023-day-{program}.json"
        document = load_json(path)
        free_group = find_group(document, "major-free")
        free_group["subjects"] = [code for code in free_group["subjects"] if code not in removed]
        write_json(path, document)


def update_evening_requirement() -> None:
    """夜間主課程：2024年度に廃止された「美術」（HSS102s）・「経済学」（HSS104s）を
    選択候補に戻す（以降の科目の番号は2024年度のものを引き継いでいるため、ここでは
    2023年度だけに存在する2科目分のコードを追加するだけでよい）。
    """
    path = REQUIREMENTS_DIR / "2023-evening.json"
    document = load_json(path)
    hss = find_group(document, "hss")
    hss["subjects"] = hss["subjects"] + ["HSS107s", "HSS108s"]
    write_json(path, document)


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


def update_first_cluster_subjects(subjects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Ⅰ類5プログラム共通の情報工学工房B・C・GLTPラボワーク・メディア情報学専用の
    MTHb02a/MTHb03aを2023年度マスタから除く（要件JSON側の参照はupdate_first_cluster_requirementsで調整済み）。
    デザイン思考・データサイエンス（e）も同じ情報工学工房A/B/C・GLTPラボワークの新設対象。
    """
    removed = {
        f"{code}{suffix}"
        for code in ("COM002", "COM003", "LAB501")
        for suffix in ("a", "b", "c", "d", "e")
    } | {"MTHb02a", "MTHb03a"}
    subjects = [subject for subject in subjects if subject["code"] not in removed]
    for subject in subjects:
        if subject["code"] in ("COM001a", "COM001b", "COM001c", "COM001d", "COM001e"):
            subject["name"] = "情報工学工房"
    return subjects


def update_second_third_cluster_subjects(subjects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Ⅱ類5・Ⅲ類5プログラム共通のGLTPラボワーク・プログラム固有の2024年度新設科目を
    2023年度マスタから除く（要件JSON側の参照はupdate_second_third_cluster_requirementsで
    調整済み）。「量子と情報」（PHY502g/h、2024年度改称）・「機械計測工学」（GSE401i/j、
    2024年度改称）は、同じ科目番号のまま名前だけ変わった科目は現行名に統一するという
    プロジェクトの方針（開発者確認済み、2026-09-14）により、2023年度データでもあえて
    改称前の名前へは戻さない。
    """
    removed = {
        "LAB501f", "LAB501g", "LAB501h", "LAB501i", "LAB501j",
        "LAB501k", "LAB501m", "LAB501n", "LAB501p", "LAB501r",
        "ELEa02m", "PHYb03p", "PHYb04p",
        "PHYb01r", "CHMb01r", "BCHa02r", "BCHa03r", "CHMb02r", "CHMb03r", "BIOb02r",
    }
    return [subject for subject in subjects if subject["code"] not in removed]


def update_evening_subjects(subjects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """夜間主課程：2024年度に廃止された「美術」（HSS102s）・「経済学」（HSS104s）を復元し、
    以降の科目（音楽・社会学・法学・地理学・社会思想史）を2023年度の科目番号（2024年度より
    2つ若い番号）へ振り直す。開講情報（offerings）は科目そのものに付随する情報なので、
    番号の振り直しに合わせてそのまま引き継ぐ。
    """
    by_code = {subject["code"]: subject for subject in subjects}
    old102, old103, old104, old105, old106 = (
        copy.deepcopy(by_code[c]) for c in ("HSS102s", "HSS103s", "HSS104s", "HSS105s", "HSS106s")
    )

    # 音楽（102→103）：開講情報ごと引き継ぐ。
    by_code["HSS103s"].clear()
    by_code["HSS103s"].update(old102, code="HSS103s")
    # 社会学（103→105）。
    by_code["HSS105s"].clear()
    by_code["HSS105s"].update(old103, code="HSS105s")
    # 法学（104→106）。
    by_code["HSS106s"].clear()
    by_code["HSS106s"].update(old104, code="HSS106s")
    # 地理学（105→107、新規追加）。
    subjects.append({**old105, "code": "HSS107s"})
    # 社会思想史（106→108、新規追加）。
    subjects.append({**old106, "code": "HSS108s"})
    # 美術（102、2024年度に廃止されたため開講情報は無い）。
    by_code["HSS102s"].clear()
    by_code["HSS102s"].update(
        code="HSS102s", name="美術", credits=2, field="HSS",
        standardSemester=1, standardYear=1, termType="前学期",
        eveningAllowed=True, forInternational=False, graduateLinked=False, groups=["hss"],
    )
    # 経済学（104、2024年度に廃止されたため開講情報は無い）。
    by_code["HSS104s"].clear()
    by_code["HSS104s"].update(
        code="HSS104s", name="経済学", credits=2, field="HSS",
        standardSemester=1, standardYear=1, termType="前学期",
        eveningAllowed=True, forInternational=False, graduateLinked=False, groups=["hss"],
    )
    return subjects


def copy_subject_master() -> int:
    """2024年度と共通の科目マスタを複製し、出典年度とデザイン思考・データサイエンスの
    COM50Xe（データサイエンス演習の追加による番号ずれ）を2023年度向けに直す。
    """
    document = load_json(SUBJECTS_DIR / "youran-2024.json")
    document["source"] = "学修要覧2023（情報理工学域）付録C。昼間コース共通科目＋Ⅰ・Ⅱ・Ⅲ類15プログラム＋夜間主収録"
    document["note"] = "2024年度版を土台に学修要覧2023との差分を反映。開講情報は原則2026年度シラバス基準"

    subjects = update_first_cluster_subjects(document["subjects"])
    subjects = update_second_third_cluster_subjects(subjects)
    subjects = update_evening_subjects(subjects)
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
    update_first_cluster_requirements()
    update_second_third_cluster_requirements()
    update_evening_requirement()
    update_designds_requirement()
    subject_count = copy_subject_master()
    print(f"2023年度データを生成しました: requirements={len(requirement_paths)} subjects={subject_count}")


if __name__ == "__main__":
    main()
