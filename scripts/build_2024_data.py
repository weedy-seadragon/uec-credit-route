"""2025年度データを土台に、学修要覧2024との差分を反映して2024年度データを作る。

2024年度以前の入学生は、これまで「2025年度と同一」として扱ってきたが、開発者からの不具合報告
（Ⅲ類機械システムの選択必修の誤り）をきっかけに学修要覧2024（`PDF/youran2024-gakuiki-trimmed.pdf`）と
学修要覧2025を全ページ突き合わせたところ、実際には下記の差分があることが判明した（詳細は
docs/YOURAN_2024_COMPARISON.md参照）。

2026-09-14訂正：計測制御システム・先端ロボティクス・機械システムの大学院連携科目
「Advanced Robotics and Mechatronics Engineering」（MCEb13i/j/k）を「2025年度新設」と
誤認して除いていたが、2022年度の時点で既に存在していた科目だった（docs/YOURAN_2022_COMPARISON.md
参照）。卒業要件・審査条件は入学年度の学修要覧原本にマストで従い、科目自体の属性（名前・
時間・単位区分）は2026年度シラバス基準に統一するという原則（CLAUDE.md参照）に基づき、
これらは2024年度データにも残すよう修正した。一方、光工学の「画像情報学基礎」（ELEa02n）は
科目マスタには存在してよいが、2024年度入学者の卒業要件（原本の付録Cに掲載が無い）としては
認められないため、要件ファイルからのみ除く（`update_optical_requirement`参照）。

実行: python scripts/build_2024_data.py
"""

from __future__ import annotations

import copy
import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
REQUIREMENTS_DIR = DATA_DIR / "requirements"
SUBJECTS_2025_PATH = DATA_DIR / "subjects" / "youran-2025.json"
SUBJECTS_2024_PATH = DATA_DIR / "subjects" / "youran-2024.json"


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
    for group in groups:
        yield group
        yield from walk_groups(group.get("children", []))


def find_group(document: dict[str, Any], group_id: str) -> dict[str, Any]:
    """要件JSONから指定IDのグループを1件取得する。"""
    for group in walk_groups(document["groups"]):
        if group["id"] == group_id:
            return group
    raise KeyError(f"要件グループが見つかりません: {group_id}")


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
    """科目マスタの共通形式に合わせて、2024年度固有の科目を1件作る。"""
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
    if note:
        subject["note"] = note
    return subject


def copy_requirement_files() -> list[Path]:
    """2025年度の全要件JSONを複製し、年度と参照先を2024へ更新する。"""
    output_paths: list[Path] = []
    for source_path in sorted(REQUIREMENTS_DIR.glob("2025-*.json")):
        document = load_json(source_path)
        document["entryYear"] = 2024
        if isinstance(document.get("source"), str):
            document["source"] = document["source"].replace("2025", "2024")
        if isinstance(document.get("extends"), str):
            document["extends"] = document["extends"].replace("2025-", "2024-")
        output_path = REQUIREMENTS_DIR / source_path.name.replace("2025-", "2024-", 1)
        write_json(output_path, document)
        output_paths.append(output_path)
    return output_paths


def shift_advanced_hss_codes(codes: list[str]) -> list[str]:
    """2025年度に新設された「計算と論理の哲学」（HSS601z）を除き、後続のHSS6NNzを1つずつ番号を戻す。"""
    result: list[str] = []
    for code in codes:
        match = re.fullmatch(r"HSS6(\d{2})z", code)
        if not match:
            result.append(code)
            continue
        number = int(match.group(1))
        if number == 1:
            # 2025年度新設科目なので2024年度には存在しない。
            continue
        result.append(f"HSS6{number - 1:02d}z")
    return result


def update_common_requirement() -> None:
    """上級科目のHSS601z新設によるコード繰り下げと、ビジネスPBL（CAR402z）廃止を反映する。"""
    path = REQUIREMENTS_DIR / "2024-day-common.json"
    document = load_json(path)
    adv_a = find_group(document, "adv-A")
    adv_a["subjects"] = shift_advanced_hss_codes(adv_a["subjects"])
    career = find_group(document, "career")
    career["subjects"] = remove_codes(career["subjects"], {"CAR402z"})
    write_json(path, document)


def update_media_requirement() -> None:
    """メディア情報学：COM603aの科目名変更は科目マスタ側だけの差分のため、要件JSONの変更は無い。"""
    # 要件JSON側（科目番号の一覧）に変更は無く、科目マスタのbuild_subject_masterだけで対応する。
    return None


def update_first_cluster_cross_listed_electives() -> None:
    """Ⅰ類の他プログラム（media/management/mathinfo/cs）が展開しているデザイン思考・
    データサイエンス由来の選択科目一覧から、2025年度新設のMSS502e・MSS602eを外す。

    「他プログラムの類専門科目選択も選択として算入可」（付録C 注1）の展開先なので、
    デザイン思考・データサイエンス側だけでなく、展開されている側の4ファイルも直す必要がある。
    """
    filenames = [
        "2024-day-I-media.json",
        "2024-day-I-management.json",
        "2024-day-I-mathinfo.json",
        "2024-day-I-cs.json",
    ]
    for filename in filenames:
        path = REQUIREMENTS_DIR / filename
        document = load_json(path)
        major_sel = find_group(document, "major-sel")
        major_sel["subjects"] = remove_codes(major_sel["subjects"], {"MSS502e", "MSS602e"})
        write_json(path, document)


def update_mathinfo_requirement() -> None:
    """情報数理工学：2025年度新設の「囲碁とゲームAI」（INS503c）を自由科目から外す。"""
    path = REQUIREMENTS_DIR / "2024-day-I-mathinfo.json"
    document = load_json(path)
    free_group = find_group(document, "major-free")
    free_group["subjects"] = remove_codes(free_group["subjects"], {"INS503c"})
    write_json(path, document)


def update_cs_requirement() -> None:
    """コンピュータサイエンス：2025年度新設の「囲碁とゲームAI」（INS503d）を自由科目から外す。"""
    path = REQUIREMENTS_DIR / "2024-day-I-cs.json"
    document = load_json(path)
    free_group = find_group(document, "major-free")
    free_group["subjects"] = remove_codes(free_group["subjects"], {"INS503d"})
    write_json(path, document)


def update_optical_requirement() -> None:
    """光工学：「画像情報学基礎」（ELEa02n）は学修要覧2024の原本付録Cに掲載が無い。
    科目自体はシラバス基準で存在してよいため科目マスタからは外さないが、2024年度入学者の
    卒業要件は入学年度原本にマストで従うべきところ、この科目を自由科目として認めてよい
    根拠が原本に無い（2026-09-14、docs/YOURAN_2023_COMPARISON.md参照）。
    """
    path = REQUIREMENTS_DIR / "2024-day-III-optical.json"
    document = load_json(path)
    free_group = find_group(document, "major-free")
    free_group["subjects"] = remove_codes(free_group["subjects"], {"ELEa02n"})
    write_json(path, document)


# デザイン思考・データサイエンスプログラムの2024年度・類専門科目一覧
# （学修要覧2024 付録C C.3.1⑤、pdftoppmで画像化して目視確認済み）。
DESIGNDS_MAJOR_REQ = [
    "COM405e", "COM501e", "COM502e", "COM701e", "COM601e",
    "INS601e", "INS701e",
    "LAB701e", "LAB801e", "LAB702e", "LAB802e",
]
DESIGNDS_MAJOR_SEL_OWN = [
    "MSS402e", "COM406e", "COM503e", "MTH501e", "ELE501e", "MSS501e",
    "INS501e", "INS502e", "INS503e", "COM504e", "INS504e",
    "COM602e", "COM603e", "INS602e", "INS505e", "INS603e", "MSS601e",
    "COM001e", "FGN101e", "FGN201e", "FGN102e", "FGN202e", "FGN301e", "FGN401e",
]
DESIGNDS_MAJOR_FREE = [
    "COM505e", "COM002e", "COM003e",
    "INSa01e", "INSa02e", "COMa01e", "INSa03e", "INSa04e", "INSa05e", "INSa06e",
    "COMa02e", "COMa03e", "COMb01e", "INSb01e", "ELEb01e",
    "MTHb01e", "MTHb02e", "MTHb03e", "LAB501e",
]


def update_designds_requirement() -> None:
    """デザイン思考・データサイエンス：科目名変更・必修/選択の再編・大幅なコード振り直しを反映する。

    2024年度は次の点で2025年度と異なる（学修要覧2024 付録C C.3.1⑤・別表2・別表4で確認済み）。
    - 必修にデザイン思考概論（INS601e）・システム思考概論（INS701e）を含み、必修19単位（2025年度は15単位）
    - 実践演習・実験の科目名に「デザイン思考・」が付かない（データサイエンス実践演習１/２・データサイエンス実験）
    - 選択科目のINS5xxe・COM50xe・MSS60xeが2025年度と異なる科目を指す（例: INS501eは社会シミュレーション。
      2025年度はデザイン思考概論に変わった）。年度ごとに別ファイルなので、同じコードを別の科目として
      定義しても問題ない
    - 卒業研究着手審査の条件文言は「データサイエンス実験」（別表4、審査自体の判定コードはCOM601eのまま不変）
    - このプログラムだけ、インターンシップ（CAR503z）を必修とする規定（2025年度の学修要覧C.2 注5）が
      まだ無いため、commonOverridesを適用しない
    """
    path = REQUIREMENTS_DIR / "2024-day-I-designds.json"
    document = load_json(path)
    # 2025年度だけの規定（インターンシップ必修化）を2024年度データからは外す。
    document.pop("commonOverrides", None)

    major_req = find_group(document, "major-req")
    major_req["subjects"] = list(DESIGNDS_MAJOR_REQ)
    major_req["required"] = 19

    major_sel = find_group(document, "major-sel")
    # 他プログラム（media/management/mathinfo/cs）からの展開分は2024・2025年度で変わらないため、
    # 自プログラム分（先頭）だけを差し替え、他プログラム分（"MSS402a"以降）はそのまま引き継ぐ。
    other_program_start = major_sel["subjects"].index("MSS402a")
    major_sel["subjects"] = DESIGNDS_MAJOR_SEL_OWN + major_sel["subjects"][other_program_start:]
    major_sel["required"] = 17

    major_free = find_group(document, "major-free")
    major_free["subjects"] = list(DESIGNDS_MAJOR_FREE)

    write_json(path, document)


def build_subject_master() -> int:
    """2025科目マスタを複製し、2024年度の廃止・番号変更・名称差を適用する。"""
    document = copy.deepcopy(load_json(SUBJECTS_2025_PATH))
    document["source"] = "学修要覧2024（情報理工学域）付録C。昼間コース共通科目＋Ⅰ・Ⅱ・Ⅲ類15プログラム＋夜間主収録"
    document["note"] = (
        "2025年度版を土台に学修要覧2024との差分を反映。変更のない科目のofferingsは、"
        "2026年度シラバスから取得済みの情報を引き継ぐ（開講情報は原則2026年度シラバス基準）"
    )

    # 2025年度に新設され、2024年度には存在しない科目番号を削除する。
    removed_codes = {
        "HSS601z",  # 計算と論理の哲学
        "CAR402z",  # ビジネスPBL
        "INS503c",  # 囲碁とゲームAI（情報数理工学）
        "INS503d",  # 囲碁とゲームAI（コンピュータサイエンス）
    }
    # HSS602z〜610zは番号を1つ戻すため、いったん削除して新番号で作り直す。
    removed_codes.update(f"HSS6{n:02d}z" for n in range(2, 11))
    # デザイン思考・データサイエンスプログラムは大幅にコードの指す科目が異なるため、
    # 2025年度の値をいったん全部外し、2024年度の実際の科目で作り直す。
    removed_codes.update(
        {
            "COM502e", "COM701e", "COM601e", "COM504e",
            "INS501e", "INS502e", "INS503e", "INS504e", "INS601e", "INS602e", "INS603e",
            "MSS502e", "MSS601e", "MSS602e",
        }
    )
    by_code = {subject["code"]: subject for subject in document["subjects"]}
    subjects = [subject for subject in document["subjects"] if subject["code"] not in removed_codes]

    additions: list[dict[str, Any]] = []

    # 上級科目：新設科目の分だけ番号を1つ戻す（名称・単位数・学期はそのまま引き継ぐ）。
    for old_number in range(2, 11):
        old_code = f"HSS6{old_number:02d}z"
        new_code = f"HSS6{old_number - 1:02d}z"
        old_subject = by_code[old_code]
        additions.append(
            make_subject(
                new_code,
                old_subject["name"],
                old_subject["credits"],
                old_subject["standardSemester"],
                old_subject["groups"],
                evening_allowed=old_subject.get("eveningAllowed", False),
                note=old_subject.get("note"),
            )
        )

    # 科目名の変更（同じ科目番号のまま、2025年度に改称された）。
    for code, old_name in (
        ("COM603a", "進化計算論"),
        ("ENG503z", "English for Intercultural Communication"),
        ("INT504z", "English for Intercultural Communication"),
    ):
        renamed = copy.deepcopy(by_code[code])
        renamed["name"] = old_name
        subjects = [s for s in subjects if s["code"] != code]
        additions.append(renamed)

    # デザイン思考・データサイエンスプログラム（e）の2024年度固有科目。
    additions.extend(
        [
            make_subject("COM502e", "データサイエンス実践演習１", 1, 5, ["major-req"]),
            make_subject("COM701e", "データサイエンス実践演習２", 1, 7, ["major-req"]),
            make_subject("COM601e", "データサイエンス実験", 2, 6, ["major-req"]),
            make_subject("INS601e", "デザイン思考概論", 2, 6, ["major-req"]),
            make_subject("INS701e", "システム思考概論", 2, 7, ["major-req"]),
            make_subject("COM406e", "形式言語理論", 2, 4, ["major-sel"], note="外国人留学生のみ履修可"),
            make_subject("INS501e", "社会シミュレーション", 2, 5, ["major-sel"]),
            make_subject("INS502e", "コミュニケーション論", 2, 5, ["major-sel"], note="外国人留学生のみ履修可"),
            make_subject("INS503e", "多変量解析", 2, 5, ["major-sel"], note="外国人留学生のみ履修可"),
            make_subject("COM504e", "メディア分析法", 2, 5, ["major-sel"], note="外国人留学生のみ履修可"),
            make_subject("INS504e", "メディアリテラシー", 2, 5, ["major-sel"], note="外国人留学生のみ履修可"),
            make_subject("INS602e", "言語認知工学", 2, 6, ["major-sel"], note="外国人留学生のみ履修可"),
            make_subject("INS603e", "メディア論", 2, 6, ["major-sel"], note="外国人留学生のみ履修可"),
            make_subject("MSS601e", "金融工学", 2, 6, ["major-sel"], note="外国人留学生のみ履修可"),
            make_subject("COM505e", "マルチメディア処理", 2, 5, ["major-free"]),
        ]
    )

    subjects.extend(additions)
    document["subjects"] = sorted(subjects, key=lambda subject: subject["code"])
    write_json(SUBJECTS_2024_PATH, document)
    return len(document["subjects"])


def main() -> None:
    """要件と科目マスタを生成し、作成件数を表示する。"""
    requirement_paths = copy_requirement_files()
    update_common_requirement()
    update_mathinfo_requirement()
    update_cs_requirement()
    update_optical_requirement()
    update_designds_requirement()
    update_first_cluster_cross_listed_electives()
    subject_count = build_subject_master()
    print(f"2024年度データを生成しました: requirements={len(requirement_paths)} subjects={subject_count}")


if __name__ == "__main__":
    main()
