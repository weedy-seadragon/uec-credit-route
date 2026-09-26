"""学域特別講義の統合後科目名・単位数を年度別生成処理で共通利用する。"""

SPECIAL_SUBJECTS = {
    "UEC001z": ("学域特別講義A", 1),
    "UEC002z": ("学域特別講義（旧区分・1単位）", 1),
    "UEC003z": ("学域特別講義（旧区分・2単位）", 2),
    "UEC004z": ("学域特別講義B", 2),
}


def normalize_special_lecture_subjects(subjects: list[dict]) -> list[dict]:
    """全年度で科目統合の定義をそろえ、旧区分のシラバス情報を除く。"""
    for subject in subjects:
        definition = SPECIAL_SUBJECTS.get(subject["code"])
        if definition is None:
            continue
        subject["name"], subject["credits"] = definition
        if subject["code"] in ("UEC002z", "UEC003z"):
            subject.pop("offerings", None)
            subject["legacy"] = True
        else:
            subject.pop("legacy", None)
    return subjects
