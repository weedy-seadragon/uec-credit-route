"""fetch_syllabus.pyのシラバス一覧行の変換を確認する小さな単体テスト。"""
import unittest

from fetch_syllabus import build_special_offerings_by_code, extract_special_topic


class SpecialOfferingTests(unittest.TestCase):
    """一覧のテーマ接頭辞から、学域特別講義の開講データを作る規則を検証する。"""

    def test_fullwidth_prefix_splits_a_and_b_and_keeps_topic_separate(self):
        """全角A/BもNFKCで分類され、統合後のA/Bコードへ別々に配る。"""
        rows = {
            "31": [
                {"name": "学域特別講義Ａ（基盤理工学B）", "semester": "前学期", "dayPeriod": "他", "timetableCode": "A-1", "instructor": "甲", "href": "31/A-1.html"},
                {"name": "学域特別講義Ｂ（AI時代の著作権ビジネス）", "semester": "後学期", "dayPeriod": "木5", "timetableCode": "B-1", "instructor": "乙", "href": "31/B-1.html"},
            ],
            "32": [],
        }
        result = build_special_offerings_by_code(rows, "2026-09-27")

        self.assertEqual(set(result), {"UEC001z", "UEC004z"})
        self.assertEqual([item["topic"] for item in result["UEC001z"]], ["基盤理工学B"])
        self.assertEqual(result["UEC001z"][0]["slots"], [])
        self.assertNotIn("sectionLabel", result["UEC001z"][0])
        self.assertEqual([item["topic"] for item in result["UEC004z"]], ["AI時代の著作権ビジネス"])
        self.assertEqual(result["UEC004z"][0]["term"], "後学期")
        self.assertEqual(result["UEC004z"][0]["slots"], [{"day": "木", "period": 5}])
        self.assertTrue(result["UEC004z"][0]["syllabusUrl"].endswith("/31/31_B-1.html"))

    def test_topic_keeps_bilingual_titles_and_drops_sponsorship_prefix(self):
        """括弧の入れ子を保ち、テーマではない寄附講座名だけを取り除く。"""
        self.assertEqual(
            extract_special_topic("(アルゴリズムの基礎) (Fundamentals of Algorithms)"),
            "アルゴリズムの基礎 (Fundamentals of Algorithms)",
        )
        self.assertEqual(
            extract_special_topic("(JAPIA寄附講義)「自動車の大変革(CASE)に必要な技術」"),
            "「自動車の大変革(CASE)に必要な技術」",
        )
        self.assertEqual(extract_special_topic("(デザイン思考実践)(集中)"), "デザイン思考実践 (集中)")


if __name__ == "__main__":
    unittest.main()
