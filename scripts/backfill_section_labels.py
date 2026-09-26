"""既存の科目マスタ（data/subjects/youran-*.json）の offerings に、sectionLabel を後から付け足す。

実行: python scripts/backfill_section_labels.py

sectionLabel は、シラバスの学期一覧に載っている科目名の末尾の（…）表記（例:「情報領域演習第三
（Aクラス）」の「（Aクラス）」）。曜日時限が「他」で空の科目は、この表記だけがどのクラス向けの
セクションかを見分ける手がかりになる（2026-09-26、情報領域演習第三をA/B/Cクラスで分けられない
不具合の修正で追加）。

scripts/fetch_syllabus.py も同じ値を付けるようにしたが、あちらは個別ページを数百件取得するため
10〜15分かかる。こちらは一覧ページ（昼間・夜間主の2ページ）だけを取得して、時間割コードで
既存の offerings に sectionLabel を書き足すので、数秒で終わる。offerings の他の項目は変更しない。
"""
import glob, json, os, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_syllabus import (  # noqa: E402  （同じフォルダのスクリプトから一覧取得の部品を借りる）
    FACULTIES, LIST_URL_TMPL, REQUEST_INTERVAL_SEC, fetch, parse_list, section_label,
)

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def main():
    # 学域コードと時間割コードの組 → 末尾の（…）表記。表記が無い行は入れない
    labels: dict[tuple[str, str], str] = {}
    for i, faculty in enumerate(FACULTIES):
        # 2ページ目以降は、サーバー負荷を避けるため間隔を空けてから取得する
        if i > 0:
            time.sleep(REQUEST_INTERVAL_SEC)
        rows = parse_list(fetch(LIST_URL_TMPL.format(faculty=faculty)))
        # 一覧の各行から、クラス表記だけを取り出して覚えておく
        for row in rows:
            label = section_label(row["name"])
            if label:
                labels[(faculty, row["timetableCode"])] = label
    print(f"クラス表記のある行: {len(labels)}件", file=sys.stderr)

    # 年度ごとの科目マスタすべてに、同じ時間割コードのセクションへ表記を書き足す
    for path in sorted(glob.glob(os.path.join(ROOT, "data", "subjects", "youran-*.json"))):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        changed = 0
        # 科目 → セクションの順にたどり、表記が見つかったものだけ更新する
        for subject in data["subjects"]:
            for offering in subject.get("offerings") or []:
                label = labels.get((offering.get("faculty", ""), offering.get("timetableCode", "")))
                if label and offering.get("sectionLabel") != label:
                    offering["sectionLabel"] = label
                    changed += 1
        # 変更が無いファイルは書き直さない（改行コード等の余計な差分を出さないため）
        if changed:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write("\n")
        print(f"{os.path.basename(path)}: {changed}件のセクションに表記を追加", file=sys.stderr)


if __name__ == "__main__":
    main()
