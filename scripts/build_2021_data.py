"""学修要覧2021を基準に、2021年度用の要件データを生成する。

2021年度は2022年度と専門科目の構成がほぼ共通する一方、実践教育科目が
「初年次導入8単位・データサイエンス区分なし」であるため、その差分を反映する。

付録Cを画像で照合したところ、Ⅰ類の一部プログラムに次の差分も見つかった
（2026-09-14、docs/YOURAN_2022_COMPARISON.md参照）。

- 経営・社会情報学：2021年度は選択科目「ソーシャルコンピューティング」（INS601b）が独立して
  存在し、2022年度から廃止された。この科目が抜けた分、以降の科目番号が2022年度から1つ若返る
  （人間工学MSS502b→501b、オペレーションズ・リサーチ第一MSS503b→502b、言語認知工学INS602b→601b）
- 情報数理工学・コンピュータサイエンス：選択科目「情報通信システム」「データサイエンス」
  （INS501x/INS502x）は2022年度新設で2021年度には無い

セキュリティ情報学・情報通信工学・電子情報学の「マルチメディア処理」も画像上は2021年度と
2022年度で科目番号が違って見えたが、2022年度側の現在の科目マスタの値（COM507x）と原本画像の
表記（ELE505x/ELE506x）が一致せず、既存データ自体に食い違いがある可能性が高いため、
今回はどちらが正しいか判断できず据え置いた（docs/YOURAN_2022_COMPARISON.md参照）。

実行: python scripts/build_2021_data.py
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
    """入れ子の要件グループを先頭から再帰的に列挙する。"""
    for group in groups:
        yield group
        yield from walk_groups(group.get("children", []))


def copy_requirement_files() -> list[Path]:
    """2022年度の専門要件を2021年度へ複製し、年度参照だけを置き換える。"""
    outputs: list[Path] = []
    for source_path in sorted(REQUIREMENTS_DIR.glob("2022-*.json")):
        document = load_json(source_path)
        document["entryYear"] = 2021
        document["source"] = document.get("source", "").replace("2022", "2021")
        if isinstance(document.get("extends"), str):
            document["extends"] = document["extends"].replace("2022-", "2021-")
        output_path = REQUIREMENTS_DIR / source_path.name.replace("2022-", "2021-", 1)
        write_json(output_path, document)
        outputs.append(output_path)
    return outputs


def update_common_requirements() -> None:
    """付録C C.2どおり、初年次導入8単位とデータサイエンス区分なしの構成に直す。"""
    path = REQUIREMENTS_DIR / "2021-day-common.json"
    document = load_json(path)
    groups = {group["id"]: group for group in walk_groups(document["groups"])}
    # 2021年度の初年次導入は総合コミュニケーション科学と実験A/B、リテラシーの4科目で8単位。
    groups["intro"]["required"] = 8
    groups["intro"]["subjects"] = ["UEC101z", "PHY101z", "CHM101z", "COM101z"]
    # 2021年度はデータサイエンス科目が独立した卒業要件区分ではないため、グループごと取り除く。
    practical = groups["practical"]
    practical["required"] = 16
    practical["children"] = [child for child in practical["children"] if child["id"] != "datasci"]
    write_json(path, document)


def update_program_subtotals() -> None:
    """別表2に合わせ、実践教育の減少分を該当課程の共通単位へ配分する。"""
    common_credits = {
        "media": 7, "management": 6, "mathinfo": 6, "cs": 6,
        "security": 9, "netinfo": 2, "electroinfo": 2,
        "control": 4, "robotics": 5,
        "mecha": 4, "electro": 5, "optical": 4, "physics": 6, "chembio": 5,
        "evening": 6,
    }
    for program, common in common_credits.items():
        filename = REQUIREMENTS_DIR / "2021-evening.json" if program == "evening" else next(REQUIREMENTS_DIR.glob(f"2021-*-{program}.json"))
        document = load_json(filename)
        # 昼間コースは16単位。夜間主は別表2.2どおり14単位を維持する。
        if program != "evening":
            document["subtotals"]["practical"] = 16
        document["subtotals"]["common"] = common
        write_json(filename, document)


def groups_by_id(document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """グループIDから要件グループを引ける辞書を作る。"""
    return {group["id"]: group for group in walk_groups(document["groups"])}


def update_first_cluster_2021_requirements() -> None:
    """Ⅰ類：2022年度にかけて新設・廃止された選択科目の差分を2021年度時点へ戻す。

    情報数理工学・コンピュータサイエンスの新設科目は「他プログラムの類専門科目選択も
    選択科目とできる」規定（付録C注1）で4ファイルすべてに展開されているため、
    どのファイルからも取り除く。
    """
    removed = {"INS501c", "INS502c", "INS501d", "INS502d"}
    for program in ("media", "management", "mathinfo", "cs"):
        path = REQUIREMENTS_DIR / f"2021-day-I-{program}.json"
        document = load_json(path)
        for group in walk_groups(document["groups"]):
            subjects = group.get("subjects")
            if subjects:
                group["subjects"] = [code for code in subjects if code not in removed]
        write_json(path, document)

    # 経営・社会情報学：ソーシャルコンピューティング（INS601b）が独立して存在した分、
    # 以降の科目番号が2022年度より1つ後ろにずれる。
    path = REQUIREMENTS_DIR / "2021-day-I-management.json"
    document = load_json(path)
    groups = groups_by_id(document)
    rename = {"MSS501b": "MSS502b", "MSS502b": "MSS503b", "INS601b": "INS602b"}
    major_sel = groups["major-sel"]
    subjects = [rename.get(code, code) for code in major_sel["subjects"]]
    index = subjects.index("INS501b")
    subjects.insert(index + 1, "INS601b")
    major_sel["subjects"] = subjects
    write_json(path, document)


def update_first_cluster_2021_subjects(subjects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """情報数理工学・コンピュータサイエンスの2022年度新設科目を除き、経営・社会情報学の
    番号ずれ（ソーシャルコンピューティングの廃止による1つ後ろへのずれ）を2021年度時点へ戻す。
    """
    removed = {"INS501c", "INS502c", "INS501d", "INS502d"}
    subjects = [subject for subject in subjects if subject["code"] not in removed]

    by_code = {subject["code"]: subject for subject in subjects}
    old_501b, old_502b, old_601b = (
        copy.deepcopy(by_code[c]) for c in ("MSS501b", "MSS502b", "INS601b")
    )
    # 人間工学（501→502、開講情報ごと引き継ぐ）。
    by_code["MSS502b"].clear()
    by_code["MSS502b"].update(old_501b, code="MSS502b")
    # オペレーションズ・リサーチ第一（502→503、2022年度マスタに503番が無いため新規追加）。
    subjects.append({**old_502b, "code": "MSS503b"})
    # 言語認知工学（601→602、2022年度マスタに602番が無いため新規追加）。
    subjects.append({**old_601b, "code": "INS602b"})
    # ソーシャルコンピューティング（601、2022年度に廃止されたため開講情報は無い）。
    by_code["INS601b"].clear()
    by_code["INS601b"].update(
        code="INS601b", name="ソーシャルコンピューティング", credits=2, field="INS",
        standardSemester=6, standardYear=3, termType="後学期",
        eveningAllowed=True, forInternational=False, graduateLinked=False, groups=["major-sel"],
    )
    return subjects


def copy_subject_master() -> int:
    """2022年度マスタを土台に、2021年度だけの総合コミュニケーション科学の番号を追加する。"""
    document = load_json(SUBJECTS_DIR / "youran-2022.json")
    # 付録C C.2では初年次導入の基礎科学実験A/Bが各2単位として掲載されている。
    for subject in document["subjects"]:
        if subject["code"] in {"PHY101z", "CHM101z"}:
            subject["credits"] = 2
    source_subject = next(subject for subject in document["subjects"] if subject["code"] == "UEC301z")
    legacy_subject = copy.deepcopy(source_subject)
    legacy_subject["code"] = "UEC101z"
    legacy_subject["name"] = "総合コミュニケーション科学"
    document["subjects"] = [subject for subject in document["subjects"] if subject["code"] != "UEC101z"] + [legacy_subject]

    subjects = update_first_cluster_2021_subjects(document["subjects"])
    document["subjects"] = sorted(subjects, key=lambda subject: subject["code"])

    document["source"] = "学修要覧2021（情報理工学域）付録Cを基準にした年度別科目マスタ。開講情報は原則2026年度シラバス基準"
    document["note"] = "2021年度の旧カリキュラム用。年度ごとに科目番号・単位数が異なる可能性があるため、他年度のマスタと分けて参照する"
    write_json(SUBJECTS_DIR / "youran-2021.json", document)
    return len(document["subjects"])


def main() -> None:
    """2021年度の要件JSONと科目マスタを生成して件数を表示する。"""
    requirement_paths = copy_requirement_files()
    update_common_requirements()
    update_program_subtotals()
    update_first_cluster_2021_requirements()
    subject_count = copy_subject_master()
    print(f"2021年度データを生成しました: requirements={len(requirement_paths)} subjects={subject_count}")


if __name__ == "__main__":
    main()
