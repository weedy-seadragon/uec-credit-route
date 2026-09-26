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

情報通信工学・電子情報学の「マルチメディア処理」の科目番号（COM507x→ELE506x）は
2026-09-15に2025年度マスタ側を修正し、2022年度・2021年度も再生成でこの修正を引き継いだ
（docs/YOURAN_CROSS_YEAR_AUDIT.md参照）。

2026-09-15、Ⅱ類・Ⅲ類・夜間主を学修要覧2021原本と画像照合し、次の差分を追加で修正した
（docs/YOURAN_2021_COMPARISON.md参照）。

- 電子工学「回折結晶学」・物理工学5科目（回折結晶学・固体電子論・半導体工学・計算数理工学・
  電子デバイス）は、2022年度にかけて科目番号が変わっている（2022年度データはこの一連の
  科目だけが原本どおりに変更済みで、他は変更なし）
- 夜間主「データサイエンス演習」（UEC501r）は2022年度新設のため2021年度には無い
- 夜間主「電磁気学および演習」・「基礎物理学第三」（PHY301s/PHY302s）は、2022年度にかけて
  科目番号が入れ替わっている
- セキュリティ情報学「マルチメディア処理」は2021年度原本ではデータベース論と同じ番号
  （COM506e）で印字されており、2022年度以降の原本にある distinct な番号（COM507e）と
  食い違うが、これは2021年度原本側の印刷重複（他プログラムのマルチメディア処理で見つかった
  ものと同種）と判断し、現行の値（COM507e、2022年度から継承）を変更していない

なお、電子工学に光工学専用の「画像情報学基礎」（ELEa02k）が誤って混入していた不具合と、
化学生命工学の2024年度新設科目除外が機能していなかった不具合は、いずれも2022年度側
（`build_2022_data.py`）の問題だったため、そちらを修正して2021年度へ再生成で継承した。

実行: python scripts/build_2021_data.py
"""

from __future__ import annotations

import copy
import json
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


def remove_condition_deep(node: Any, is_target) -> Any:
    """審査条件の木（allOf/anyOf）から、is_target(leaf)がTrueになる葉条件を取り除く。"""
    if "allOf" in node:
        node["allOf"] = [
            remove_condition_deep(child, is_target)
            for child in node["allOf"]
            if not ("allOf" not in child and "anyOf" not in child and is_target(child))
        ]
        return node
    if "anyOf" in node:
        node["anyOf"] = [
            remove_condition_deep(child, is_target)
            for child in node["anyOf"]
            if not ("allOf" not in child and "anyOf" not in child and is_target(child))
        ]
        return node
    return node


def fix_y2end_uec_reference_2021() -> None:
    """昼間14プログラムの「2年次終了時審査」（y2-end）・「卒業研究着手審査」（thesis-start）は、
    総合コミュニケーション科学の単位を`subjects: ["UEC301z"]`として個別にチェックしているが、
    2021年度はこの科目が「初年次導入科目」に統合されコード自体もUEC101zへ変わっている
    （`update_common_requirements`・`copy_subject_master`参照）ため、2021年度の学生はUEC301z
    という科目番号を一切履修しない。このままでは`allPassed(intro)`は満たせてもこの条件だけが
    永久に不合格のままになり、2年次終了時審査・卒業研究着手審査のどちらも2021年度入学者は
    絶対に合格できなくなってしまう不具合だった（2026-09-15発見。両方の審査に同じ条件が別々に
    重複して書かれているため、両方から取り除く必要がある）。UEC101zは既に`intro`グループに
    含まれ`allPassed(intro)`でカバーされているため、この条件は単純に削除する。
    """
    is_uec301z = lambda cond: cond.get("type") == "subjects" and cond.get("codes") == ["UEC301z"]
    for path in sorted(REQUIREMENTS_DIR.glob("2021-day-*.json")):
        if path.name == "2021-day-common.json":
            continue
        document = load_json(path)
        for review in document.get("reviews", []):
            if review["id"] in ("y2-end", "thesis-start"):
                remove_condition_deep(review, is_uec301z)
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


def sync_graduation_common_credits() -> None:
    """卒業審査（reviews内の"graduation"）のcommonCredits条件を、その課程自身の
    subtotals.commonへ同期する。`update_program_subtotals`はsubtotals.commonだけを
    書き換えており、reviews側は2024年度の値（2025年度から継承）のまま取り残されていた
    （2026-09-15、2021年度のⅡ類・Ⅲ類・夜間主を別表4と照合していた際に発見。
    docs/YOURAN_2021_COMPARISON.md参照）。全プログラムのファイルを対象に最後に実行する。
    """
    for path in sorted(REQUIREMENTS_DIR.glob("2021-*.json")):
        document = load_json(path)
        common = document.get("subtotals", {}).get("common")
        reviews = document.get("reviews")
        if common is None or not reviews:
            continue
        graduation = next((review for review in reviews if review["id"] == "graduation"), None)
        if graduation is None:
            continue
        common_condition = next(cond for cond in graduation["allOf"] if cond.get("type") == "commonCredits")
        if common_condition["min"] != common:
            common_condition["min"] = common
            write_json(path, document)


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


# Ⅲ類：電子工学「回折結晶学」・物理工学5科目の番号が2022年度にかけて変わっている
# （画像照合済み、docs/YOURAN_2021_COMPARISON.md参照）。物理工学は単純な1対1リネームでは
# 衝突するため、循環的な入れ替えを1つの辞書で表す。
THIRD_CLUSTER_2021_RENAME = {
    "PHY504k": "PHY607k",  # 電子工学：回折結晶学
    "PHY506n": "PHY607n",  # 物理工学：回折結晶学
    "PHY507n": "PHY506n",  # 物理工学：固体電子論
    "PHY607n": "PHY608n",  # 物理工学：半導体工学
    "PHY608n": "PHY609n",  # 物理工学：計算数理工学
    "PHY609n": "PHY610n",  # 物理工学：電子デバイス
}


def update_third_cluster_2021_requirements() -> None:
    """Ⅲ類5プログラム：電子工学・物理工学の科目番号を2021年度原本の値へ戻す。他プログラム
    の自由科目区分でも同じ科目番号を選択科目として展開しているため、5ファイルすべてを走査
    する。
    """
    rename = lambda code: THIRD_CLUSTER_2021_RENAME.get(code, code)
    for program in ("mecha", "electro", "optical", "physics", "chembio"):
        path = REQUIREMENTS_DIR / f"2021-day-III-{program}.json"
        document = load_json(path)
        document["groups"] = rename_codes_deep(document["groups"], rename)
        document["reviews"] = rename_codes_deep(document.get("reviews", []), rename)
        write_json(path, document)


def update_third_cluster_2021_subjects(subjects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """科目マスタ側も電子工学・物理工学の科目番号を2021年度原本の値へ戻す。"""
    rename = lambda code: THIRD_CLUSTER_2021_RENAME.get(code, code)
    for subject in subjects:
        subject["code"] = rename(subject["code"])
    return subjects


def update_evening_2021_requirements() -> None:
    """夜間主：データサイエンス演習（UEC501r）は2022年度新設のため2021年度には無いので除く。
    また「電磁気学および演習」・「基礎物理学第三」（PHY301s/PHY302s）の科目番号が2022年度に
    かけて入れ替わっているため、要件区分（選択必修⇔必修）ごと2021年度原本の値へ戻す
    （画像照合済み、docs/YOURAN_2021_COMPARISON.md参照）。

    別表4 4.2（夜間主コース）卒業研究着手審査基準のうち「初年次導入科目」の必要単位数も
    2022年度にかけて6単位から4単位へ変更されている（画像照合済み）。2022年度以降のデータは
    正しく4単位のままでよいが、2021年度は原本どおり6単位へ戻す。
    """
    path = REQUIREMENTS_DIR / "2021-evening.json"
    document = load_json(path)
    groups = groups_by_id(document)
    datasci = groups["datasci"]
    datasci["children"] = [child for child in datasci["children"] if child["id"] != "datasci-ex"]

    math_elec = groups["math-basic-elec"]
    prof_req = groups["prof-basic-req"]
    math_elec["subjects"] = ["PHY302s" if code == "PHY301s" else code for code in math_elec["subjects"]]
    prof_req["subjects"] = ["PHY301s" if code == "PHY302s" else code for code in prof_req["subjects"]]

    thesis_start = next(review for review in document["reviews"] if review["id"] == "thesis-start")
    intro_condition = next(cond for cond in thesis_start["allOf"] if cond.get("groupId") == "intro")
    intro_condition["min"] = 6

    write_json(path, document)


def update_evening_2021_subjects(subjects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """科目マスタ側も「電磁気学および演習」・「基礎物理学第三」の内容（科目名・単位数・
    開講情報など）ごと2021年度原本の科目番号へ入れ替える。
    """
    by_code = {subject["code"]: subject for subject in subjects}
    old_301s = copy.deepcopy(by_code["PHY301s"])
    old_302s = copy.deepcopy(by_code["PHY302s"])
    by_code["PHY301s"].clear()
    by_code["PHY301s"].update(old_302s, code="PHY301s")
    by_code["PHY302s"].clear()
    by_code["PHY302s"].update(old_301s, code="PHY302s")
    return subjects


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
    subjects = update_third_cluster_2021_subjects(subjects)
    subjects = update_evening_2021_subjects(subjects)
    subjects = normalize_special_lecture_subjects(subjects)
    document["subjects"] = sorted(subjects, key=lambda subject: subject["code"])

    document["source"] = "学修要覧2021（情報理工学域）付録Cを基準にした年度別科目マスタ。開講情報は原則2026年度シラバス基準"
    document["note"] = "2021年度の旧カリキュラム用。年度ごとに科目番号・単位数が異なる可能性があるため、他年度のマスタと分けて参照する"
    write_json(SUBJECTS_DIR / "youran-2021.json", document)
    return len(document["subjects"])


def main() -> None:
    """2021年度の要件JSONと科目マスタを生成して件数を表示する。"""
    requirement_paths = copy_requirement_files()
    update_common_requirements()
    fix_y2end_uec_reference_2021()
    update_program_subtotals()
    update_first_cluster_2021_requirements()
    update_third_cluster_2021_requirements()
    update_evening_2021_requirements()
    sync_graduation_common_credits()
    subject_count = copy_subject_master()
    print(f"2021年度データを生成しました: requirements={len(requirement_paths)} subjects={subject_count}")


if __name__ == "__main__":
    main()
