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
media = load("requirements/2025-day-I-media.json")

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

all_groups = list(walk(common["groups"])) + list(walk(media["groups"]))
for grp in all_groups:
    check_required_group(grp)
    check_children_sum(grp)
    for c in grp.get("subjects", []):
        if c not in subjects:
            errors.append(f"{grp['id']}: 科目マスタにない {c}")

# 別表2との突き合わせ（Ⅰ類メディア情報学）
by_id = {g["id"]: g for g in all_groups}
expect = {
    "hss": 8, "lang-basic-1": 4, "lang-appl-1": 2, "lang-basic-2": 2, "lang-seminar": 2, "health": 3, "sci-liberal": 2, "advanced": 4,
    "general": 27, "intro": 6, "datasci": 3, "career": 4, "tech-eng": 4, "practical": 17,
    "math-basic": 18, "cluster-basic-req": 15, "cluster-basic-sel": 8, "major-req": 13, "major-sel": 22, "specialized": 76,
}
for gid, v in expect.items():
    if gid not in by_id:
        errors.append(f"グループが存在しない: {gid}")
    elif by_id[gid]["required"] != v:
        errors.append(f"別表2と不一致: {gid} required={by_id[gid]['required']} 期待={v}")

tot = media["subtotals"]
if tot["general"] + tot["practical"] + tot["specialized"] + tot["common"] != media["totalCredits"]:
    errors.append("小計の和が totalCredits と一致しない")

# 審査で参照している groupId / code の存在確認
def walk_cond(c):
    if isinstance(c, dict):
        if "groupId" in c and c["groupId"] not in by_id:
            errors.append(f"審査条件が未知のグループを参照: {c['groupId']}")
        for code in c.get("codes", []):
            if code not in subjects:
                errors.append(f"審査条件が未知の科目を参照: {code}")
        for k in ("allOf", "anyOf"):
            for x in c.get(k, []):
                walk_cond(x)
for r in media["reviews"]:
    walk_cond(r)
    for code in r.get("onFail", {}).get("blockedSubjects", []):
        if code not in subjects:
            errors.append(f"onFail が未知の科目を参照: {code}")

# 科目番号の学期桁と standardSemester の整合
for s in subjects.values():
    if s["standardSemester"] and not (1 <= s["standardSemester"] <= 8):
        errors.append(f"standardSemester が範囲外: {s['code']}")

if errors:
    print("NG")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print(f"OK: subjects={len(subjects)} groups={len(all_groups)}")
