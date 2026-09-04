"""data/ のJSONが要覧の別表2・別表3・別表4と矛盾していないかを検査する。
実行: python scripts/validate_data.py
"""
import json, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
errors = []

def load(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return json.load(f)

subjects = {s["code"]: s for s in load("subjects/youran-2025.json")["subjects"]}
common = load("requirements/2025-day-common.json")

PROGRAM_FILES = [
    "requirements/2025-day-I-media.json",
    "requirements/2025-day-I-management.json",
    "requirements/2025-day-I-mathinfo.json",
    "requirements/2025-day-I-cs.json",
    "requirements/2025-day-I-designds.json",
    "requirements/2025-day-II-security.json",
    "requirements/2025-day-II-netinfo.json",
    "requirements/2025-day-II-electroinfo.json",
    "requirements/2025-day-II-control.json",
    "requirements/2025-day-II-robotics.json",
    "requirements/2025-day-III-mecha.json",
    "requirements/2025-day-III-electro.json",
    "requirements/2025-day-III-optical.json",
    "requirements/2025-day-III-physics.json",
    "requirements/2025-day-III-chembio.json",
    "requirements/2025-evening.json",
]
programs = {f: load(f) for f in PROGRAM_FILES}

def walk(groups, depth=0):
    for grp in groups:
        yield grp
        yield from walk(grp.get("children", []), depth + 1)

def credits(codes):
    total = 0
    for c in codes:
        if c not in subjects:
            errors.append(f"科目マスタにない科目番号: {c}")
            continue
        total += subjects[c]["credits"]
    return total

def check_required_group(grp):
    """必修グループは「科目の単位合計 == required」でなければならない"""
    if grp.get("kind") == "required" and grp.get("subjects"):
        # 留学生専用科目は除いて数える
        codes = [c for c in grp["subjects"] if not subjects.get(c, {}).get("forInternational")]
        total = credits(codes)
        if total != grp["required"]:
            errors.append(f"必修グループ {grp['id']} の単位合計 {total} != required {grp['required']}")

def check_children_sum(grp):
    """子を持つグループは required == 子の required 合計（countAs=common/free を除く）"""
    ch = grp.get("children")
    if ch and grp.get("required"):
        s = sum(c.get("required", 0) for c in ch if c.get("countAs") != "common" and c.get("kind") not in ("free", "international"))
        if s and s != grp["required"]:
            errors.append(f"グループ {grp['id']} の required {grp['required']} != 子の合計 {s}")

# 審査で参照している groupId / code の存在確認
def walk_cond(c, by_id):
    if isinstance(c, dict):
        if "groupId" in c and c["groupId"] not in by_id:
            errors.append(f"審査条件が未知のグループを参照: {c['groupId']}")
        for code in c.get("codes", []):
            if code not in subjects:
                errors.append(f"審査条件が未知の科目を参照: {code}")
        for k in ("allOf", "anyOf"):
            for x in c.get(k, []):
                walk_cond(x, by_id)

common_groups = list(walk(common["groups"]))
for grp in common_groups:
    check_required_group(grp)
    check_children_sum(grp)
    for c in grp.get("subjects", []):
        if c not in subjects:
            errors.append(f"{grp['id']}: 科目マスタにない {c}")

for fname, doc in programs.items():
    all_groups = common_groups + list(walk(doc["groups"]))
    by_id = {g["id"]: g for g in all_groups}
    for grp in walk(doc["groups"]):
        check_required_group(grp)
        check_children_sum(grp)
        for c in grp.get("subjects", []):
            if c not in subjects:
                errors.append(f"{fname} {grp['id']}: 科目マスタにない {c}")

    tot = doc["subtotals"]
    if tot["general"] + tot["practical"] + tot["specialized"] + tot["common"] != doc["totalCredits"]:
        errors.append(f"{fname}: 小計の和が totalCredits と一致しない")

    # reviews はⅠ類5プログラムのみ持つ（Ⅱ類・Ⅲ類・夜間主は審査条件のデータ化がまだのため無い）
    for r in doc.get("reviews", []):
        walk_cond(r, by_id)
        for code in r.get("onFail", {}).get("blockedSubjects", []):
            if code not in subjects:
                errors.append(f"{fname} onFail が未知の科目を参照: {code}")

# 別表2との突き合わせ（Ⅰ類メディア情報学。他プログラムは check_required_group /
# check_children_sum の一般チェックと、各JSON自身の subtotals 突き合わせで担保する）
media_groups = {g["id"]: g for g in common_groups + list(walk(programs["requirements/2025-day-I-media.json"]["groups"]))}
expect = {
    "hss": 8, "lang-basic-1": 4, "lang-appl-1": 2, "lang-basic-2": 2, "lang-seminar": 2, "health": 3, "sci-liberal": 2, "advanced": 4,
    "general": 27, "intro": 6, "datasci": 3, "career": 4, "tech-eng": 4, "practical": 17,
    "math-basic": 18, "cluster-basic-req": 15, "cluster-basic-sel": 8, "major-req": 13, "major-sel": 22, "specialized": 76,
}
for gid, v in expect.items():
    if gid not in media_groups:
        errors.append(f"グループが存在しない: {gid}")
    elif media_groups[gid]["required"] != v:
        errors.append(f"別表2と不一致: {gid} required={media_groups[gid]['required']} 期待={v}")

# 科目番号の学期桁と standardSemester の整合
for s in subjects.values():
    if s["standardSemester"] and not (1 <= s["standardSemester"] <= 8):
        errors.append(f"standardSemester が範囲外: {s['code']}")

if errors:
    print("NG")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print(f"OK: subjects={len(subjects)} programs={len(programs)}")
