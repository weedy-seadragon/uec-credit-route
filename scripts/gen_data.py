"""学修要覧2025（情報理工学域）付録C・別表2/3/4 から data/ 以下のJSONを生成する。
入力は手で転記した下記の表。要覧の原本と突き合わせて確認済み（2026-09-03）。

主キーは末尾記号を含むフルコード（例 COM405a）。以前は末尾記号を除いて名寄せしていたが、
類専門科目の選択科目のようにプログラムごとに独自採番されている科目では、末尾を除くと
番号が一致しても中身が別科目になるケースがあった（例: INS502a=メディアリテラシー ≠
INS502b=多変量解析）ため、名寄せをやめてフルコード1つにつき1エントリの方式にした
（2026-09-04）。COM405a/COM405eのように複数プログラムで本当に共有されている科目は、
単に別々のエントリとして重複して持つ（実害は科目マスタが少し重複する程度）。
"""
import json, os, re

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")

# ---------------------------------------------------------------- 科目マスタ
# (code, name, credits, flags)  flags: e=夜間主履修可(#), i=留学生のみ(※), g=大学院連携
SUBJECTS = {}

def add(group, rows):
    for r in rows:
        code, name, credits = r[0], r[1], r[2]
        flags = r[3] if len(r) > 3 else ""
        note = r[4] if len(r) > 4 else None
        m = re.match(r"^[A-Z]{3}([1-8])", code)
        sem = int(m.group(1)) if m else None
        if code in SUBJECTS:
            s = SUBJECTS[code]
            assert s["name"] == name, f"科目名の不一致: {code} 既存={s['name']!r} 今回={name!r}"
            assert s["credits"] == credits, f"単位数の不一致: {code} 既存={s['credits']} 今回={credits}"
        else:
            SUBJECTS[code] = {
                "code": code,
                "name": name,
                "credits": credits,
                "field": code[:3],
                "standardSemester": sem,
                "standardYear": (sem + 1) // 2 if sem else None,
                "termType": (None if sem is None else ("前学期" if sem % 2 == 1 else "後学期")),
                "eveningAllowed": "e" in flags,
                "forInternational": "i" in flags,
                "graduateLinked": "g" in flags,
                "groups": [],
            }
        s = SUBJECTS[code]
        if group not in s["groups"]:
            s["groups"].append(group)
        if note:
            s["note"] = note
    return [r[0] for r in rows]

# ---- C.1 総合文化科目（昼間）
HSS = [
    ("HSS301z","哲学Ａ",2),("HSS401z","哲学Ｂ",2,"e"),("HSS302z","倫理学Ａ",2),("HSS402z","倫理学Ｂ",2,"e"),
    ("HSS303z","心理学Ａ",2),("HSS403z","心理学Ｂ",2,"e"),("HSS304z","歴史学Ａ",2),("HSS404z","歴史学Ｂ",2,"e"),
    ("HSS305z","科学史Ａ",2),("HSS405z","科学史Ｂ",2,"e"),("HSS306z","文学Ａ",2),("HSS406z","文学Ｂ",2,"e"),
    ("HSS307z","美術Ａ",2,"e"),("HSS407z","美術Ｂ",2,"e"),("HSS308z","音楽Ａ",2),("HSS408z","音楽Ｂ",2,"e"),
    ("HSS309z","経済学Ａ",2,"e"),("HSS409z","経済学Ｂ",2,"e"),("HSS310z","社会学Ａ",2),("HSS410z","社会学Ｂ",2,"e"),
    ("HSS311z","法学Ａ",2),("HSS411z","法学Ｂ",2,"e"),("HSS312z","政治学Ａ",2,"e"),("HSS412z","政治学Ｂ",2,"e"),
    ("HSS313z","地理学Ａ",2),("HSS413z","地理学Ｂ",2,"e"),("HSS314z","社会思想史Ａ",2),("HSS414z","社会思想史Ｂ",2,"e"),
    ("HSS315z","文化人類学Ａ",2,"e"),("HSS415z","文化人類学Ｂ",2,"e"),("HSS316z","技術史",2,"e"),("HSS317z","言語学",2,"e"),
    ("HSS318z","憲法",2,"e"),("HSS319z","外国文学",2,"e"),("HSS320z","アジアの文化",2,"e"),
    # 日本文化科目（留学生）は人文・社会科学科目の単位に含む
    ("FGN101z","日本文化Ａ",2,"i"),("FGN201z","日本文化Ｂ",2,"i"),("FGN301z","日本文化Ｃ",2,"i"),("FGN401z","日本文化Ｄ",2,"i"),("FGN302z","日本文化Ｅ",2,"i"),
]
LANG_BASIC_1 = [("ENG101z","Academic Written EnglishⅠ",1),("ENG102z","Academic Spoken EnglishⅠ",1),
                ("ENG201z","Academic Written EnglishⅡ",1),("ENG202z","Academic Spoken EnglishⅡ",1)]
LANG_APPL_1 = [("ENG301z","Academic English for the Second YearⅠ",1),("ENG401z","Academic English for the Second YearⅡ",1)]
LANG_BASIC_2 = [("GER101z","独語第一",1,"e"),("GER201z","独語第二",1,"e"),("FRE101z","仏語第一",1,"e"),("FRE201z","仏語第二",1,"e"),
                ("RUS101z","露語第一",1,"e"),("RUS201z","露語第二",1,"e"),("CHI101z","中国語第一",1,"e"),("CHI201z","中国語第二",1,"e"),
                ("KOR101z","韓国朝鮮語第一",1,"e"),("KOR201z","韓国朝鮮語第二",1,"e")]
LANG_APPL_2 = [("GER102z","選択独語第一",1,"e"),("GER202z","選択独語第二",1,"e"),("FRE102z","選択仏語第一",1,"e"),("FRE202z","選択仏語第二",1,"e"),
               ("RUS102z","選択露語第一",1,"e"),("RUS202z","選択露語第二",1,"e"),("CHI102z","選択中国語第一",1,"e"),("CHI202z","選択中国語第二",1,"e"),
               ("KOR102z","選択韓国朝鮮語第一",1,"e"),("KOR202z","選択韓国朝鮮語第二",1,"e")]
LANG_SEMINAR = [("ENG302z","英語演習",2,"e"),("GER301z","独語演習",2,"e"),("GER401z","独語運用演習",2,"e"),("FRE301z","仏語演習",2,"e"),
                ("FRE401z","仏語運用演習",2,"e"),("RUS301z","露語演習",2,"e"),("RUS401z","露語運用演習",2,"e"),("CHI301z","中国語演習",2,"e"),
                ("CHI401z","中国語運用演習",2,"e"),("KOR301z","韓国朝鮮語演習",2,"e"),("KOR401z","韓国朝鮮語運用演習",2,"e"),("JPN401z","日本語演習",2,"i")]
JAPANESE = [("JPN101z","日本語第一",2,"i"),("JPN201z","日本語第二",2,"i"),("JPN301z","日本語第三",2,"i")]
HEALTH_REQ = [("HSP101z","健康論",1),("HSP201z","健康・体力つくり実習",1)]
HEALTH_SEL = [("HSP301z","生涯スポーツ演習Ａ",1,"e"),("HSP401z","生涯スポーツ演習Ｂ",1,"e"),
              ("HSP302z","生涯スポーツ演習Ｃ",1,"e","夏期集中講義"),("HSP402z","生涯スポーツ演習Ｄ",1,"e","冬期集中講義")]
SCI_LIB = [("GEO201z","宇宙・地球科学",2,"e"),("PHY301z","物理学概論第三",2),("BIO201z","生物学",2,"e"),("CHM301z","化学とエネルギー",2,"e"),
           ("CHM201z","材料化学",2,"e"),("MTH301z","現代数学入門Ａ",2,"e"),("MTH302z","現代数学入門Ｂ",2,"e")]
ADV_A = [("HSS501z","数学の哲学",2,"e"),("HSS601z","計算と論理の哲学",2,"e"),("HSS502z","人間と外交",2,"e"),("HSS503z","日本の内政と外交",2,"e"),
         ("HSS602z","現代の世界政治",2,"e"),("HSS603z","心の科学",2,"e"),("HSS504z","認知科学",2,"e"),("HSS505z","江戸の社会と数学",2,"e"),
         ("HSS604z","伝統科学と近代科学の相克",2,"e"),("HSS506z","現代の教育",2,"e"),("HSS605z","教育の歴史",2,"e","偶数年度開講"),
         ("HSS606z","人間と教育",2,"e","奇数年度開講"),("HSS507z","科学技術と人間",2),("HSS607z","環境論",2,"e"),("HSS608z","倫理学と哲学の間",2,"e"),
         ("HSS508z","ドイツ倫理学",2,"e"),("HSS609z","英米倫理学",2,"e"),("HSS509z","日本語表現法",2,"e"),("HSS610z","日本語読解法",2,"e")]
ADV_B = [("ENG501z","Reading Scientific Research",2,"e","偶数年度開講"),("ENG601z","Research Writing",2,"e","奇数年度開講"),
         ("ENG502z","Research Presentation",2,"e","偶数年度開講"),("ENG602z","Advanced Reading in Academic English",2,"e","奇数年度開講"),
         ("ENG603z","Innovative and Global Leadership Skills (IGLS)",2,"e","偶数年度開講"),
         ("ENG503z","English for Interpersonal Communication across Cultures",2,"e","奇数年度開講"),
         ("ENG504z","Preparation for Overseas Study",2,"e","奇数年度開講"),("ENG604z","Preparation for Graduate School",2,"e","偶数年度開講"),
         ("GER501z","外国語とその運用A【独語】",2,"e"),("FRE501z","外国語とその運用A【仏語】",2,"e"),("RUS501z","外国語とその運用A【露語】",2,"e"),
         ("CHI501z","外国語とその運用A【中国語】",2,"e"),("KOR501z","外国語とその運用A【韓国朝鮮語】",2,"e"),
         ("GER601z","外国語とその運用B【独語】",2,"e"),("FRE601z","外国語とその運用B【仏語】",2,"e"),("RUS601z","外国語とその運用B【露語】",2,"e"),
         ("CHI601z","外国語とその運用B【中国語】",2,"e"),("KOR601z","外国語とその運用B【韓国朝鮮語】",2,"e")]
ADV_C = [("HSS510z","比較文化論",2,"e"),("HSS611z","地域文化論",2,"e"),("HSS511z","文化干渉論",2,"e"),("HSS612z","国際文化論",2),
         ("HSS512z","文化形態論",2,"e"),("HSS613z","文化と言語",2,"e"),("JPN501z","日本語とコミュニケーションA",2,"e","外国人留学生の履修を優先"),
         ("JPN601z","日本語とコミュニケーションB",2,"e","外国人留学生の履修を優先")]
ADV_D = [("GSC601z","現代物理学を創った人々",2,"e","偶数年度開講"),("GSC501z","サイエンス・コミュニケーション演習",2,"","集中講義"),
         ("GSC602z","物理学の発展と最前線",2,"e","奇数年度開講"),("MTH601z","応用代数学",2),("GSC603z","現代化学",2,"e"),("GSC502z","情報と職業",2,"e"),
         ("GSE501z","日本の科学と技術A",2,"e","外国人留学生の履修を優先"),("GSE601z","日本の科学と技術B",2,"e","外国人留学生の履修を優先")]
ADV_E = [("HSP501z","身体運動のバイオメカニクス",2,"e"),("HSP502z","運動と筋の科学",2,"e"),("HSP601z","健康の科学",2,"e"),("HSP503z","エイジングの健康科学",2,"e"),
         ("HSP602z","スポーツとコミュニケーション",2,"e"),("HSP603z","体力の科学",2,"e"),("HSP504z","日常生活の対人関係",2,"e"),("HSP604z","メンタルヘルス論",2,"e")]
INTL_ADV = [("INT501z","Reading Scientific Research",2,"e","偶数年度開講・上級科目扱い"),("INT502z","Research Presentation",2,"e","偶数年度開講・上級科目扱い"),
            ("INT601z","Preparation for Graduate School",2,"e","偶数年度開講・上級科目扱い"),("INT602z","Innovative and Global Leadership Skills (IGLS)",2,"e","偶数年度開講・上級科目扱い"),
            ("INT603z","Research Writing",2,"e","奇数年度開講・上級科目扱い"),("INT503z","Preparation for Overseas Study",2,"e","奇数年度開講・上級科目扱い"),
            ("INT604z","Advanced Reading in Academic English",2,"e","奇数年度開講・上級科目扱い"),
            ("INT504z","English for Interpersonal Communication across Cultures",2,"e","奇数年度開講・上級科目扱い"),
            ("INT505z","Introduction to Computational Methods in Science and Engineering",2,"e","上級科目扱い")]
INTL_SKILLS = [("INT001z","UEC Academic Skills Ⅰ (Computer Literacy)",2,"e","1・2年次修得分は言語文化演習科目、3・4年次修得分は上級科目"),
               ("INT002z","UEC Academic Skills Ⅱ (Information Literacy and Research)",2,"e","1・2年次修得分は言語文化演習科目、3・4年次修得分は上級科目"),
               ("INT003z","UEC Academic Skills Ⅲ (Publishing and Research)",2,"e","3・4年次のみ。上級科目扱い")]
INTL_ABROAD = [("INT004z","海外語学研修Ⅰ",1,"e","集中。共通単位"),("INT005z","海外語学研修Ⅱ",2,"e","集中。共通単位")]
SPECIAL = [("UEC001z","学域特別講義A",1,"","開講年度により扱いが異なる"),("UEC002z","学域特別講義B",2,"","開講年度により扱いが異なる")]

# ---- C.2 実践教育科目（昼間）
INTRO = [("PHY101z","基礎科学実験Ａ１",1),("PHY201z","基礎科学実験Ａ２",1),("CHM101z","基礎科学実験Ｂ１",1),("CHM202z","基礎科学実験Ｂ２",1),("COM101z","コンピュータリテラシー",2)]
DS_REQ = [("UEC301z","総合コミュニケーション科学",2)]
DS_EX = [("UEC501z","データサイエンス演習",1,"","Ⅰ類全P・Ⅱ類ｾｷｭﾘﾃｨ/情報通信/電子情報は必修、Ⅱ類計測制御/ﾛﾎﾞ・Ⅲ類は選択")]
CAREER = [("CAR101z","キャリア教育基礎",2),("CAR201z","アカデミックスキルズ",1),("CAR501z","キャリア教育リーダー",2),("CAR401z","キャリアデザイン",2),
          ("CAR402z","ビジネスPBL",1),("CAR502z","イノベイティブ総合コミュニケーションデザイン1",2,"e"),("CAR601z","イノベイティブ総合コミュニケーションデザイン2",2,"e"),
          ("CAR503z","インターンシップ",2,"","デザイン思考・データサイエンスPのみ必修"),("CAR504z","インターンシップ（海外）",2),
          ("CAR602z","ベンチャービジネス概論",2,"e"),("CAR603z","知的財産権",2),("CAR604z","技術者倫理",2)]
TECH_ENG = [("TEN501z","Technical English – Basic English for Science",2),("TEN601z","Technical English – Intermediate English for Science",2)]

# ---- C.3.1 ① Ⅰ類 メディア情報学プログラム（末尾 a）
MB_REQ = [("MTH101z","微分積分学第一",2),("MTH201z","微分積分学第二",2),("MTH102z","線形代数学第一",2),("MTH202z","線形代数学第二",2),
          ("MTH203z","解析学",2),("MTH103z","数学演習第一",1),("MTH204z","数学演習第二",1),("PHY102z","物理学概論第一",2),
          ("CHM102z","化学概論第一",2),("COM201z","基礎プログラミングおよび演習",2)]
MB_SEL = [("PHY103z","物理学演習第一",1),("PHY202z","物理学概論第二",2),("PHY203z","物理学演習第二",1),("CHM203z","化学概論第二",2)]
CB_REQ = [("MTH205a","離散数学",2),("MTH303a","確率論",2),("COM301a","計算機通論",2),("COM302a","論理設計学",2),("COM303a","プログラミング通論",2),
          ("COM202a","情報領域演習第一",1),("COM304a","情報領域演習第二",1),("COM401a","情報領域演習第三",1),("COM402a","アルゴリズム論第一",2)]
CB_SEL = [("ELE301a","電気・電子回路",2),("MTH304a","複素関数論",2,"e"),("MTH401a","統計学",2),("MSS401a","オペレーションズ・リサーチ基礎",2,"e"),
          ("MTH402a","応用数学第一",2),("COM403a","コンピュータネットワーク",2,"e"),("COM404a","コンピュータ設計論",2)]
MJ_REQ = [("COM405a","メディア情報学プログラミング演習",1),("COM501a","プログラミング言語実験",2),("COM601a","メディア情報学実験",2),
          ("LAB701a","輪講A",1),("LAB801a","輪講B",1),("LAB702a","卒業研究A",3),("LAB802a","卒業研究B",3)]
MJ_SEL = [("MSS402a","社会情報論",2,"e"),("COM502a","オペレーティングシステム論",2),("MTH501a","幾何学概論",2),("ELE501a","情報通信システム",2,"e"),
          ("MSS501a","人間工学",2,"e"),("ELE502a","インタラクティブシステム",2,"e"),("INS501a","コミュニケーション論",2,"e"),("COM503a","メディア分析法",2,"e"),
          ("INS502a","メディアリテラシー",2,"e"),("COM602a","ソフトウェア工学",2,"e"),("COM603a","エージェント論",2,"e"),("COM604a","ユビキタスネットワーク",2,"e"),
          ("INS601a","言語認知工学",2,"e"),("INS602a","物体認識論",2,"e"),("INS503a","ビジュアル情報処理",2,"e"),("INS603a","メディア論",2,"e"),
          ("ELE601a","音響信号処理",2,"e"),("COM001a","情報工学工房A",2,"e","通年１〜４年次開講"),
          ("FGN101a","基礎数学演習第一",1,"i"),("FGN201a","基礎数学演習第二",1,"i"),("FGN102a","基礎物理学演習第一",1,"i"),("FGN202a","基礎物理学演習第二",1,"i"),
          ("FGN301a","情報処理演習第一",2,"i"),("FGN401a","情報処理演習第二",2,"i")]
MJ_FREE = [("COM504a","マルチメディア処理",2),("COM002a","情報工学工房B",2,"e","通年"),("COM003a","情報工学工房C",2,"e","通年"),
           ("INSa01a","メディアアート論",2,"eg"),("INSa02a","知的学習システム",2,"eg"),("COMa01a","コンピュータグラフィックス応用",2,"eg"),
           ("INSa03a","データマイニング",2,"eg"),("INSa04a","音声音響情報処理",2,"eg"),("INSa05a","学習工学特論",2,"eg"),("INSa06a","インタラクティブシステム特論",2,"eg"),
           ("COMa02a","実践ソフトウェア開発基礎論",2,"eg"),("COMa03a","実践ソフトウェア開発概論Ⅱ",2,"eg"),("COMb01a","実践ソフトウェア開発概論Ⅲ",2,"eg"),
           ("INSb01a","画像認識システム特論",2,"eg"),("ELEb01a","情報理論基礎",2,"eg"),("MTHb01a","数理統計学基礎",2,"eg"),
           ("MTHb02a","現代代数学",2,"eg","偶数年度開講"),("MTHb03a","数理解析学",2,"eg","奇数年度開講"),("LAB501a","GLTPラボワーク",1,"","GLTP学生のみ履修可")]
MJ_INTL = [("INT001a","Topics in Informatics Ⅰ",2,"e"),("INT002a","Topics in Informatics Ⅱ",2,"e"),("INT003a","Topics in Informatics Ⅲ",2,"e")]

# ---------------------------------------------------------------- 要件セット（共通部分）
def g(id, name, label, required, subjects, **kw):
    d = {"id": id, "name": name, "label": label, "required": required, "subjects": subjects}
    d.update(kw)
    return d

common = {
    "schemaVersion": 1,
    "entryYear": 2025,
    "course": "day",
    "source": "学修要覧2025（情報理工学域）別表2, 付録C C.1, C.2",
    "note": "総合文化科目・実践教育科目の要件。昼間コース全プログラム共通（データサイエンス科目の必要単位のみプログラムで異なる）",
    "groups": [
        {"id": "general", "name": "総合文化科目", "label": "総合文化", "required": 27, "children": [
            g("hss", "人文・社会科学科目", "人文・社会", 8, add("hss", HSS), kind="elective", overflowToCommon=False,
              note="日本文化科目（留学生）はここに含む。超過分は共通単位にならない"),
            g("lang-basic-1", "言語文化基礎科目Ⅰ", "英語（1年）", 4, add("lang-basic-1", LANG_BASIC_1), kind="required"),
            g("lang-appl-1", "言語文化応用科目Ⅰ", "英語（2年）", 2, add("lang-appl-1", LANG_APPL_1), kind="required"),
            g("lang-basic-2", "言語文化基礎科目Ⅱ", "第二外国語", 2, add("lang-basic-2", LANG_BASIC_2), kind="elective",
              rule={"type": "oneLanguagePair", "note": "第一・第二は通年でセット。1言語2単位"}),
            g("lang-seminar", "言語文化演習科目", "語学演習", 2, add("lang-seminar", LANG_SEMINAR), kind="elective",
              alsoAccepts=["INT001z", "INT002z"], note="INT001/002は1・2年次に修得した場合ここに算入"),
            g("health", "健康・スポーツ科学科目", "健康・スポーツ", 3, [], children=[
                g("health-req", "必修", "健康論・実習", 2, add("health", HEALTH_REQ), kind="required"),
                g("health-sel", "生涯スポーツ演習", "生涯スポーツ", 1, add("health", HEALTH_SEL), kind="elective"),
            ]),
            g("sci-liberal", "理工系教養科目", "理工系教養", 2, add("sci-liberal", SCI_LIB), kind="elective"),
            g("advanced", "上級科目", "上級科目", 4, [], kind="elective", children=[
                g("adv-A", "A類 文化と社会", "上級A", 0, add("advanced", ADV_A)),
                g("adv-B", "B類 言語によるコミュニケーション", "上級B", 0, add("advanced", ADV_B)),
                g("adv-C", "C類 異文化の理解", "上級C", 0, add("advanced", ADV_C)),
                g("adv-D", "D類 現代の科学", "上級D", 0, add("advanced", ADV_D)),
                g("adv-E", "E類 健康とスポーツの科学", "上級E", 0, add("advanced", ADV_E)),
                g("adv-intl", "国際科目（上級科目扱い）", "上級（国際）", 0, add("advanced", INTL_ADV) + add("advanced", INTL_SKILLS),
                  note="INT001/002は3・4年次修得分のみ。INT003は3・4年次のみ"),
            ]),
        ]},
        {"id": "practical", "name": "実践教育科目", "label": "実践教育", "required": 17, "children": [
            g("intro", "初年次導入科目", "初年次導入", 6, add("intro", INTRO), kind="required"),
            g("datasci", "データサイエンス科目", "データサイエンス", 3, [], children=[
                g("datasci-req", "必修", "総合コミュニケーション科学", 2, add("datasci", DS_REQ), kind="required"),
                g("datasci-ex", "データサイエンス演習", "DS演習", 1, add("datasci", DS_EX), kind="required",
                  note="Ⅰ類は必修。Ⅱ類計測制御/ロボ・Ⅲ類は選択（required=0, 超過は共通単位）"),
            ]),
            g("career", "倫理・キャリア教育科目", "キャリア単位", 4, add("career", CAREER), kind="elective"),
            g("tech-eng", "技術英語科目", "技術英語", 4, add("tech-eng", TECH_ENG), kind="required"),
        ]},
    ],
    "commonCreditSources": {
        "note": "卒業所要単位を超えた分に加え、以下はそのまま共通単位になる",
        "alwaysCommon": add("lang-appl-2", LANG_APPL_2) + add("intl-abroad", INTL_ABROAD),
        "external": [{"code": "EXT-ENG", "name": "学外英語能力試験", "credits": 2, "note": "TOEFL iBT 62 / TOEIC 600 / 英検2級 / IELTS 5"}],
    },
    "otherSubjects": {
        "japanese": add("japanese", JAPANESE),
        "special": add("special", SPECIAL),
    },
}

# ---------------------------------------------------------------- Ⅰ類 5プログラム共通の理数基礎科目
def math_basic_group():
    mb_req = add("math-basic-req", MB_REQ)
    mb_sel = add("math-basic-sel", MB_SEL)
    return g("math-basic", "理数基礎科目", "理数基礎", 18, [], children=[
        g("math-basic-req", "必修", "理数基礎（必修）", 18, mb_req, kind="required"),
        g("math-basic-sel", "選択", "理数基礎（選択）", 0, mb_sel, kind="elective", countAs="common",
          note="修得した単位は共通単位とする"),
    ])

def reviews_for(suffix, experiment_codes, common_credits):
    """2年次終了時審査・卒業研究着手審査・卒業審査。Ⅰ類はどのプログラムも別表3・4の単位数は同じで、
    参照する科目コードだけプログラムの末尾記号（suffix）で変わる。"""
    return [
        {"id": "y2-end", "name": "2年次終了時審査", "when": "2年次終了時", "source": "2.4.1, 別表3, 別表3の2",
         "anyOf": [
             {"allOf": [
                 {"type": "groupMin", "groupId": "lang-basic-1", "min": 4},
                 {"type": "groupMin", "groupId": "lang-basic-2", "min": 2},
                 {"type": "allPassed", "groupId": "health-req"},
                 {"type": "allPassed", "groupId": "intro"},
                 {"type": "subjects", "codes": ["UEC301z"]},
                 {"type": "allPassed", "groupId": "math-basic-req"},
                 {"type": "subjects", "codes": [f"MTH205{suffix}", f"COM202{suffix}"], "note": "類共通基礎の1年次必修2科目3単位"},
             ]},
             {"type": "totalCredits", "min": 60, "note": "特例。教職科目を除く。卒研着手までには上の科目を全て修得する必要あり"},
         ],
         "onFail": {"blockedSubjects": experiment_codes, "note": f"不合格時は{'・'.join(experiment_codes)}を履修できない"}},
        {"id": "thesis-start", "name": "卒業研究着手審査", "when": "3年次終了時", "source": "2.4.3, 別表4",
         "allOf": [
             {"type": "review", "id": "y2-end"},
             {"type": "groupMin", "groupId": "lang-basic-1", "min": 4},
             {"type": "groupMin", "groupId": "lang-basic-2", "min": 2},
             {"type": "allPassed", "groupId": "health-req"},
             {"type": "allPassed", "groupId": "intro"},
             {"type": "subjects", "codes": ["UEC301z"]},
             {"type": "allPassed", "groupId": "math-basic-req"},
             {"type": "allPassed", "groupId": "cluster-basic-req"},
             {"type": "subjects", "codes": experiment_codes},
             {"type": "totalCredits", "min": 101},
         ]},
        {"id": "graduation", "name": "卒業審査", "when": "4年次終了時", "source": "2.4.4, 別表2",
         "allOf": [{"type": "allGroups"}, {"type": "commonCredits", "min": common_credits}, {"type": "totalCredits", "min": 128}]},
    ]

# ---- ②経営・社会情報学プログラム（末尾 b）
CB_REQ_b = [("MTH205b","離散数学",2),("MTH303b","確率論",2),("COM301b","計算機通論",2),("COM302b","論理設計学",2),("COM303b","プログラミング通論",2),
            ("COM202b","情報領域演習第一",1),("COM304b","情報領域演習第二",1),("COM401b","情報領域演習第三",1),("COM402b","アルゴリズム論第一",2)]
CB_SEL_b = [("ELE301b","電気・電子回路",2),("MTH304b","複素関数論",2,"e"),("MTH401b","統計学",2),("MSS401b","オペレーションズ・リサーチ基礎",2,"e"),
            ("MTH402b","応用数学第一",2),("COM403b","コンピュータネットワーク",2,"e"),("COM404b","コンピュータ設計論",2)]
MJ_REQ_b = [("COM501b","プログラミング言語実験",2),("MSS601b","経営・社会情報学実験",2),
            ("LAB701b","輪講A",1),("LAB801b","輪講B",1),("LAB702b","卒業研究A",3),("LAB802b","卒業研究B",3)]
MJ_SEL_b = [("MSS402b","社会情報論",2,"e"),("MSS403b","生産管理",2,"e"),("MSS404b","品質管理第一",2,"e"),("MSS602b","品質管理第二",2,"e"),
            ("COM502b","オペレーティングシステム論",2),("MTH501b","幾何学概論",2),("ELE501b","情報通信システム",2,"e"),("MSS501b","人間工学",2,"e"),
            ("INS501b","コミュニケーション論",2,"e"),("INS502b","多変量解析",2,"e"),("MSS502b","オペレーションズ・リサーチ第一",2,"e"),
            ("MSS603b","オペレーションズ・リサーチ第二",2,"e"),("COM601b","ソフトウェア工学",2,"e"),("INS601b","言語認知工学",2,"e"),
            ("MSS604b","マーケティング科学",2,"e"),("MSS605b","信頼性工学",2,"e"),("COM001b","情報工学工房A",2,"e","通年１〜４年次開講"),
            ("FGN101b","基礎数学演習第一",1,"i"),("FGN201b","基礎数学演習第二",1,"i"),("FGN102b","基礎物理学演習第一",1,"i"),
            ("FGN202b","基礎物理学演習第二",1,"i"),("FGN301b","情報処理演習第一",2,"i"),("FGN401b","情報処理演習第二",2,"i")]
MJ_FREE_b = [("COM503b","マルチメディア処理",2),("COM002b","情報工学工房B",2,"e","通年"),("COM003b","情報工学工房C",2,"e","通年"),
             ("INSa01b","データマイニング",2,"eg"),("MSSa01b","会計情報システム",2,"eg"),("MSSa02b","経営情報システム",2,"eg"),
             ("MSSa03b","サービス・サイエンス特論",2,"eg"),("COMa01b","実践ソフトウェア開発基礎論",2,"eg"),("COMa02b","実践ソフトウェア開発概論Ⅱ",2,"eg"),
             ("COMb01b","実践ソフトウェア開発概論Ⅲ",2,"eg"),("COMb02b","ソフトウェア品質学",2,"eg"),("ELEb01b","情報理論基礎",2,"eg"),
             ("MTHb01b","数理統計学基礎",2,"eg"),("MTHb02b","現代代数学",2,"eg","偶数年度開講"),("MTHb03b","数理解析学",2,"eg","奇数年度開講"),
             ("LAB501b","GLTPラボワーク",1,"","GLTP学生のみ履修可")]
MJ_INTL_b = [("INT001b","Topics in Informatics Ⅰ",2,"e"),("INT002b","Topics in Informatics Ⅱ",2,"e"),("INT003b","Topics in Informatics Ⅲ",2,"e")]

# ---- ③情報数理工学プログラム（末尾 c）
CB_REQ_c = [("MTH205c","離散数学",2),("MTH303c","確率論",2),("COM301c","計算機通論",2),("COM302c","論理設計学",2),("COM303c","プログラミング通論",2),
            ("COM202c","情報領域演習第一",1),("COM304c","情報領域演習第二",1),("COM401c","情報領域演習第三",1),("COM402c","アルゴリズム論第一",2)]
CB_SEL_c = [("ELE301c","電気・電子回路",2),("MTH304c","複素関数論",2,"e"),("MTH401c","統計学",2),("MSS401c","オペレーションズ・リサーチ基礎",2,"e"),
            ("MTH402c","応用数学第一",2),("COM403c","コンピュータネットワーク",2,"e"),("COM404c","コンピュータ設計論",2)]
MJ_REQ_c = [("MTH403c","数値計算",2),("COM501c","オペレーティングシステム論",2),("COM502c","情報数理工学実験第一",4),
            ("COM601c","情報数理工学実験第二A",2),("COM602c","情報数理工学実験第二B",2),
            ("LAB701c","輪講A",1),("LAB801c","輪講B",1),("LAB702c","卒業研究A",3),("LAB802c","卒業研究B",3)]
MJ_SEL_c = [("COM405c","形式言語理論",2,"e"),("MTH501c","幾何学概論",2),("MTH502c","数値解析",2,"e"),("COM503c","アルゴリズム論第二",2,"e"),
            ("COM504c","言語処理系論",2,"e"),("COM505c","ヒューマンインタフェース",2),("COM506c","プログラム言語論",2,"e"),("COM507c","データベース論",2,"e"),
            ("MTH503c","応用数学第二",2,"e"),("MTH504c","グラフとネットワーク",2,"e"),("MTH505c","シミュレーション理工学",2,"e"),
            ("INS501c","情報通信システム",2,"e"),("INS502c","データサイエンス",2,"e"),("COM603c","ソフトウェア工学",2,"e"),
            ("MTH602c","ハイパフォーマンスコンピューティング",2,"e"),("COM604c","ゲーム情報学",2,"e"),("MTH603c","数理計画法",2,"e"),
            ("MTH604c","離散数理工学",2,"e"),("COM605c","計算理論",2,"e"),("COM606c","コンピュータグラフィックス",2,"e"),("MTH605c","知的情報処理",2,"e"),
            ("COM001c","情報工学工房A",2,"e","通年1-4年次開講"),
            ("FGN101c","基礎数学演習第一",1,"i"),("FGN201c","基礎数学演習第二",1,"i"),("FGN102c","基礎物理学演習第一",1,"i"),
            ("FGN202c","基礎物理学演習第二",1,"i"),("FGN301c","情報処理演習第一",2,"i"),("FGN401c","情報処理演習第二",2,"i")]
MJ_FREE_c = [("COM508c","マルチメディア処理",2),("INS503c","囲碁とゲームAI",2),("COM002c","情報工学工房B",2,"e","通年"),
             ("COM003c","情報工学工房C",2,"e","通年"),("COMa01c","情報・ネットワーク工学専攻基礎",2,"eg"),("COMa02c","計算機アーキテクチャ基礎論",2,"eg"),
             ("MTHa01c","応用解析基礎論",2,"eg"),("COMa03c","ソフトウェア基礎特論",2,"eg"),("COMa04c","アルゴリズム基礎論",2,"eg"),
             ("COMb01c","応用アルゴリズム論",2,"eg"),("COMb02c","アルゴリズム特論",2,"eg"),("MTHb01c","ハイパフォーマンスコンピューティング基礎論",2,"eg"),
             ("MTHb02c","シミュレーション理工学基礎論",2,"eg"),("MTHb03c","離散最適化基礎論",2,"eg"),("MTHb04c","連続最適化基礎論",2,"eg"),
             ("LAB501c","GLTPラボワーク",1,"","GLTP学生のみ履修可")]
MJ_INTL_c = [("INT001c","Advanced Communication Engineering and Informatics Ⅰ",2,"e"),
             ("INT002c","Advanced Communication Engineering and Informatics Ⅱ",2,"e"),
             ("INT003c","Advanced Communication Engineering and Informatics Ⅲ",2,"e"),
             ("INT004c","Advanced Communication Engineering and Informatics Ⅳ",2,"e")]

# ---- ④コンピュータサイエンスプログラム（末尾 d）
CB_REQ_d = [("MTH205d","離散数学",2),("MTH303d","確率論",2),("COM301d","計算機通論",2),("COM302d","論理設計学",2),("COM303d","プログラミング通論",2),
            ("COM202d","情報領域演習第一",1),("COM304d","情報領域演習第二",1),("COM401d","情報領域演習第三",1),("COM402d","アルゴリズム論第一",2)]
CB_SEL_d = [("ELE301d","電気・電子回路",2),("MTH304d","複素関数論",2,"e"),("MTH401d","統計学",2),("MSS401d","オペレーションズ・リサーチ基礎",2,"e"),
            ("MTH402d","応用数学第一",2),("COM403d","コンピュータネットワーク",2,"e"),("COM404d","コンピュータ設計論",2)]
MJ_REQ_d = [("MTH403d","数値計算",2),("COM501d","オペレーティングシステム論",2),("COM502d","コンピュータサイエンス実験第一",4),
            ("COM601d","コンピュータサイエンス実験第二A",2),("COM602d","コンピュータサイエンス実験第二B",2),
            ("LAB701d","輪講A",1),("LAB801d","輪講B",1),("LAB702d","卒業研究A",3),("LAB802d","卒業研究B",3)]
MJ_SEL_d = [("COM405d","形式言語理論",2,"e"),("MTH501d","幾何学概論",2),("MTH502d","数値解析",2,"e"),("COM503d","アルゴリズム論第二",2,"e"),
            ("COM504d","言語処理系論",2,"e"),("COM505d","ヒューマンインタフェース",2),("COM506d","プログラム言語論",2,"e"),("COM507d","データベース論",2,"e"),
            ("MTH503d","応用数学第二",2,"e"),("MTH504d","グラフとネットワーク",2,"e"),("MTH505d","シミュレーション理工学",2,"e"),
            ("INS501d","情報通信システム",2,"e"),("INS502d","データサイエンス",2,"e"),("COM603d","ソフトウェア工学",2,"e"),
            ("MTH602d","ハイパフォーマンスコンピューティング",2,"e"),("COM604d","ゲーム情報学",2,"e"),("MTH603d","数理計画法",2,"e"),
            ("MTH604d","離散数理工学",2,"e"),("COM605d","計算理論",2,"e"),("COM606d","コンピュータグラフィックス",2,"e"),("MTH605d","知的情報処理",2,"e"),
            ("COM001d","情報工学工房A",2,"e","通年1-4年次開講"),
            ("FGN101d","基礎数学演習第一",1,"i"),("FGN201d","基礎数学演習第二",1,"i"),("FGN102d","基礎物理学演習第一",1,"i"),
            ("FGN202d","基礎物理学演習第二",1,"i"),("FGN301d","情報処理演習第一",2,"i"),("FGN401d","情報処理演習第二",2,"i")]
MJ_FREE_d = [("COM508d","マルチメディア処理",2),("INS503d","囲碁とゲームAI",2),("COM002d","情報工学工房B",2,"e","通年"),
             ("COM003d","情報工学工房C",2,"e","通年"),("COMa01d","情報・ネットワーク工学専攻基礎",2,"eg"),("COMa02d","計算機アーキテクチャ基礎論",2,"eg"),
             ("MTHa01d","プログラム言語基礎論",2,"eg"),("COMa03d","ソフトウェア基礎特論",2,"eg"),("COMa04d","アルゴリズム基礎論",2,"eg"),
             ("COMb01d","応用アルゴリズム論",2,"eg"),("COMb02d","アルゴリズム特論",2,"eg"),("MTHb01d","ハイパフォーマンスコンピューティング基礎論",2,"eg"),
             ("MTHb02d","離散最適化基礎論",2,"eg"),("MTHb03d","連続最適化基礎論",2,"eg"),("MTHb04d","画像認識システム特論",2,"eg"),
             ("LAB501d","GLTPラボワーク",1,"","GLTP学生のみ履修可")]
MJ_INTL_d = [("INT001d","Advanced Communication Engineering and Informatics Ⅰ",2,"e"),
             ("INT002d","Advanced Communication Engineering and Informatics Ⅱ",2,"e"),
             ("INT003d","Advanced Communication Engineering and Informatics Ⅲ",2,"e"),
             ("INT004d","Advanced Communication Engineering and Informatics Ⅳ",2,"e")]

# ---- ⑤デザイン思考・データサイエンスプログラム（末尾 e）。類共通基礎の必修に「統計学」が入る（required=17）。
CB_REQ_e = [("MTH205e","離散数学",2),("MTH303e","確率論",2),("COM301e","計算機通論",2),("COM302e","論理設計学",2),("COM303e","プログラミング通論",2),
            ("COM202e","情報領域演習第一",1),("COM304e","情報領域演習第二",1),("COM401e","情報領域演習第三",1),("COM402e","アルゴリズム論第一",2),
            ("MTH401e","統計学",2)]
CB_SEL_e = [("ELE301e","電気・電子回路",2),("MTH304e","複素関数論",2,"e"),("MSS401e","オペレーションズ・リサーチ基礎",2,"e"),
            ("MTH402e","応用数学第一",2),("COM403e","コンピュータネットワーク",2,"e"),("COM404e","コンピュータ設計論",2)]
MJ_REQ_e = [("COM405e","メディア情報学プログラミング演習",1),("COM501e","プログラミング言語実験",2),
            ("COM502e","デザイン思考・データサイエンス実践演習１",1),("COM701e","デザイン思考・データサイエンス実践演習２",1),
            ("COM601e","デザイン思考・データサイエンス実験",2),
            ("LAB701e","輪講A",1),("LAB801e","輪講B",1),("LAB702e","卒業研究A",3),("LAB802e","卒業研究B",3)]
MJ_SEL_e = [("INS501e","デザイン思考概論",2),("INS601e","システム思考概論",2),("MSS402e","社会情報論",2,"e"),
            ("COM503e","オペレーティングシステム論",2),("MTH501e","統計学第二",2),("ELE501e","情報通信システム",2,"e"),("MSS501e","人間工学",2,"e"),
            ("INS502e","社会シミュレーション",2),("INS503e","コミュニケーション論",2,"e"),("INS504e","多変量解析",2,"e"),
            ("MSS502e","オペレーションズ・リサーチ第一",2,"e"),("MSS601e","オペレーションズ・リサーチ第二",2,"e"),("MSS602e","マーケティング科学",2,"e"),
            ("INS602e","物体認識論",2,"e"),("COM602e","ソフトウェア工学",2,"e"),("COM603e","ユビキタスネットワーク",2,"e"),
            ("INS603e","言語認知工学",2,"e"),("INS505e","ビジュアル情報処理",2,"e"),("COM001e","情報工学工房A",2,"e","通年１〜４年次開講"),
            ("FGN101e","基礎数学演習第一",1,"i"),("FGN201e","基礎数学演習第二",1,"i"),("FGN102e","基礎物理学演習第一",1,"i"),
            ("FGN202e","基礎物理学演習第二",1,"i"),("FGN301e","情報処理演習第一",2,"i"),("FGN401e","情報処理演習第二",2,"i")]
MJ_FREE_e = [("COM504e","マルチメディア処理",2),("COM002e","情報工学工房B",2,"e","通年"),("COM003e","情報工学工房C",2,"e","通年"),
             ("INSa01e","メディアアート論",2,"eg"),("INSa02e","知的学習システム",2,"eg"),("COMa01e","コンピュータグラフィックス応用",2,"eg"),
             ("INSa03e","データマイニング",2,"eg"),("INSa04e","音声音響情報処理",2,"eg"),("INSa05e","学習工学特論",2,"eg"),
             ("INSa06e","インタラクティブシステム特論",2,"eg"),("COMa02e","実践ソフトウェア開発基礎論",2,"eg"),("COMa03e","実践ソフトウェア開発概論Ⅱ",2,"eg"),
             ("COMb01e","実践ソフトウェア開発概論Ⅲ",2,"eg"),("INSb01e","画像認識システム特論",2,"eg"),("ELEb01e","情報理論基礎",2,"eg"),
             ("MTHb01e","数理統計学基礎",2,"eg"),("MTHb02e","現代代数学",2,"eg","偶数年度開講"),("MTHb03e","数理解析学",2,"eg","奇数年度開講"),
             ("LAB501e","GLTPラボワーク",1,"","GLTP学生のみ履修可")]
MJ_INTL_e = [("INT001e","Topics in Informatics Ⅰ",2,"e"),("INT002e","Topics in Informatics Ⅱ",2,"e"),("INT003e","Topics in Informatics Ⅲ",2,"e")]

def build_program(program, program_name, suffix, common_credits, specialized_required,
                   cb_req_rows, cb_req_credits, cb_sel_rows, cb_sel_credits,
                   mj_req_rows, mj_req_credits, mj_sel_own_rows, mj_sel_credits, major_required,
                   mj_free_rows, mj_intl_rows, source, experiment_codes):
    cb_req = add("cluster-basic-req", cb_req_rows)
    cb_sel = add("cluster-basic-sel", cb_sel_rows)
    mj_req = add("major-req", mj_req_rows)
    mj_sel_own = add("major-sel", mj_sel_own_rows)
    mj_free = add("major-free", mj_free_rows)
    mj_intl = add("major-intl", mj_intl_rows)
    return {
        "schemaVersion": 1, "entryYear": 2025, "course": "day", "cluster": "I", "program": program,
        "programName": program_name, "programSuffix": suffix, "source": source,
        "extends": "2025-day-common.json", "totalCredits": 128, "commonCredits": common_credits,
        "subtotals": {"general": 27, "practical": 17, "specialized": specialized_required, "common": common_credits},
        "groups": [
            {"id": "specialized", "name": "専門科目", "label": "専門", "required": specialized_required, "children": [
                math_basic_group(),
                g("cluster-basic", "類共通基礎科目", "類共通基礎", cb_req_credits + cb_sel_credits, [], children=[
                    g("cluster-basic-req", "必修", "類共通基礎（必修）", cb_req_credits, cb_req, kind="required"),
                    g("cluster-basic-sel", "選択", "類共通基礎（選択）", cb_sel_credits, cb_sel, kind="elective"),
                ]),
                g("major", "類専門科目", "類専門", major_required, [], children=[
                    g("major-req", "必修", "類専門（必修）", mj_req_credits, mj_req, kind="required"),
                    # major-sel の subjects は後で他プログラムの選択科目を合算して差し替える（_inject_cross_program_electives）
                    g("major-sel", "選択", "類専門（選択）", mj_sel_credits, mj_sel_own, kind="elective",
                      alsoAccepts="sameClusterOtherPrograms",
                      note="Ⅰ類の他プログラムの科目も選択として算入可（実験科目を除く。付録C 注1）。"
                           "このJSONの subjects には他プログラム分もあらかじめ展開済み"),
                    g("major-free", "自由科目", "自由科目", 0, mj_free, kind="free", countsTowardGraduation=False,
                      note="卒業要件に含まれない（大学院連携科目など）"),
                    g("major-intl", "国際科目", "国際科目", 0, mj_intl, kind="international",
                      note="単位の扱いは年度ごとの科目一覧表による"),
                ]),
            ]},
        ],
        "reviews": reviews_for(suffix, experiment_codes, common_credits),
        "_majorSelOwn": mj_sel_own,  # 出力前に取り除く。他プログラムへの合算にだけ使う内部フィールド
    }

media = build_program("media", "メディア情報学プログラム", "a", 8, 76,
    CB_REQ, 15, CB_SEL, 8, MJ_REQ, 13, MJ_SEL, 22, 35, MJ_FREE, MJ_INTL,
    "学修要覧2025（情報理工学域）別表2, 別表3, 別表3の2, 別表4, 付録C C.3.1①", ["COM501a", "COM601a"])
management = build_program("management", "経営・社会情報学プログラム", "b", 7, 77,
    CB_REQ_b, 15, CB_SEL_b, 8, MJ_REQ_b, 12, MJ_SEL_b, 24, 36, MJ_FREE_b, MJ_INTL_b,
    "学修要覧2025（情報理工学域）別表2, 別表3, 別表3の2, 別表4, 付録C C.3.1②", ["COM501b", "MSS601b"])
mathinfo = build_program("mathinfo", "情報数理工学プログラム", "c", 7, 77,
    CB_REQ_c, 15, CB_SEL_c, 8, MJ_REQ_c, 20, MJ_SEL_c, 16, 36, MJ_FREE_c, MJ_INTL_c,
    "学修要覧2025（情報理工学域）別表2, 別表3, 別表3の2, 別表4, 付録C C.3.1③", ["COM502c", "COM601c", "COM602c"])
cs = build_program("cs", "コンピュータサイエンスプログラム", "d", 7, 77,
    CB_REQ_d, 15, CB_SEL_d, 8, MJ_REQ_d, 20, MJ_SEL_d, 16, 36, MJ_FREE_d, MJ_INTL_d,
    "学修要覧2025（情報理工学域）別表2, 別表3, 別表3の2, 別表4, 付録C C.3.1④", ["COM502d", "COM601d", "COM602d"])
designds = build_program("designds", "デザイン思考・データサイエンスプログラム", "e", 7, 77,
    CB_REQ_e, 17, CB_SEL_e, 6, MJ_REQ_e, 15, MJ_SEL_e, 21, 36, MJ_FREE_e, MJ_INTL_e,
    "学修要覧2025（情報理工学域）別表2, 別表3, 別表3の2, 別表4, 付録C C.3.1⑤", ["COM501e", "COM601e"])

cluster_i = [media, management, mathinfo, cs, designds]

# 付録C 注1「他プログラムの科目も選択として履修できる（実験科目を除く）」の反映。
# 各プログラムの類専門（選択）に、他の同じ類のプログラムの類専門（選択）だけを合算する
# （必修・自由・国際は対象外。理由は本ファイル冒頭のコメントとCLAUDE.mdの進捗ログを参照）。
for p in cluster_i:
    own = p["_majorSelOwn"]
    others = [code for other in cluster_i if other is not p for code in other["_majorSelOwn"]]
    p["groups"][0]["children"][2]["children"][1]["subjects"] = own + others
    del p["_majorSelOwn"]

# ---------------------------------------------------------------- 出力
os.makedirs(os.path.join(OUT, "requirements"), exist_ok=True)
os.makedirs(os.path.join(OUT, "subjects"), exist_ok=True)

def dump(path, obj):
    with open(os.path.join(OUT, path), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")

dump("requirements/2025-day-common.json", common)
dump("requirements/2025-day-I-media.json", media)
dump("requirements/2025-day-I-management.json", management)
dump("requirements/2025-day-I-mathinfo.json", mathinfo)
dump("requirements/2025-day-I-cs.json", cs)
dump("requirements/2025-day-I-designds.json", designds)
dump("subjects/youran-2025.json", {
    "schemaVersion": 1,
    "source": "学修要覧2025（情報理工学域）付録C。昼間コース共通科目＋Ⅰ類5プログラム収録",
    "note": "曜日時限・担当・シラバスURLはシラバスから別途取得して offerings に入れる（scripts/fetch_syllabus.py 予定）。"
            "主キーは末尾記号を含むフルコード（例 COM405a）。同じ番号でもプログラムが違えば別科目のことがあるため、名寄せはしない",
    "subjects": sorted(SUBJECTS.values(), key=lambda s: s["code"]),
})
print("subjects:", len(SUBJECTS))
