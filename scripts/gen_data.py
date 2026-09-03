"""学修要覧2025（情報理工学域）付録C・別表2/3/4 から data/ 以下のJSONを生成する。
入力は手で転記した下記の表。要覧の原本と突き合わせて確認済み（2026-09-03）。
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
        base = re.sub(r"[a-z]$", "", code)
        m = re.match(r"^[A-Z]{3}([1-8])", base)
        sem = int(m.group(1)) if m else None
        SUBJECTS.setdefault(base, {
            "code": base,
            "codes": [],
            "name": name,
            "credits": credits,
            "field": base[:3],
            "standardSemester": sem,
            "standardYear": (sem + 1) // 2 if sem else None,
            "termType": (None if sem is None else ("前学期" if sem % 2 == 1 else "後学期")),
            "eveningAllowed": "e" in flags,
            "forInternational": "i" in flags,
            "graduateLinked": "g" in flags,
            "groups": [],
        })
        s = SUBJECTS[base]
        if code not in s["codes"]:
            s["codes"].append(code)
        if group not in s["groups"]:
            s["groups"].append(group)
        if note:
            s["note"] = note
    return [re.sub(r"[a-z]$", "", r[0]) for r in rows]

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
              alsoAccepts=["INT001", "INT002"], note="INT001/002は1・2年次に修得した場合ここに算入"),
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

# ---------------------------------------------------------------- Ⅰ類 メディア情報学
media = {
    "schemaVersion": 1,
    "entryYear": 2025,
    "course": "day",
    "cluster": "I",
    "program": "media",
    "programName": "メディア情報学プログラム",
    "programSuffix": "a",
    "source": "学修要覧2025（情報理工学域）別表2, 別表3, 別表3の2, 別表4, 付録C C.3.1①",
    "extends": "2025-day-common.json",
    "totalCredits": 128,
    "commonCredits": 8,
    "subtotals": {"general": 27, "practical": 17, "specialized": 76, "common": 8},
    "groups": [
        {"id": "specialized", "name": "専門科目", "label": "専門", "required": 76, "children": [
            g("math-basic", "理数基礎科目", "理数基礎", 18, [], children=[
                g("math-basic-req", "必修", "理数基礎（必修）", 18, add("math-basic", MB_REQ), kind="required"),
                g("math-basic-sel", "選択", "理数基礎（選択）", 0, add("math-basic", MB_SEL), kind="elective", countAs="common",
                  note="修得した単位は共通単位とする"),
            ]),
            g("cluster-basic", "類共通基礎科目", "類共通基礎", 23, [], children=[
                g("cluster-basic-req", "必修", "類共通基礎（必修）", 15, add("cluster-basic", CB_REQ), kind="required"),
                g("cluster-basic-sel", "選択", "類共通基礎（選択）", 8, add("cluster-basic", CB_SEL), kind="elective"),
            ]),
            g("major", "類専門科目", "類専門", 35, [], children=[
                g("major-req", "必修", "類専門（必修）", 13, add("major", MJ_REQ), kind="required"),
                g("major-sel", "選択", "類専門（選択）", 22, add("major", MJ_SEL), kind="elective",
                  alsoAccepts="sameClusterOtherPrograms", note="Ⅰ類の他プログラムの科目も選択として算入可（実験科目を除く）"),
                g("major-free", "自由科目", "自由科目", 0, add("major-free", MJ_FREE), kind="free", countsTowardGraduation=False,
                  note="卒業要件に含まれない（大学院連携科目など）"),
                g("major-intl", "国際科目", "国際科目", 0, add("major-intl", MJ_INTL), kind="international",
                  note="単位の扱いは年度ごとの科目一覧表による"),
            ]),
        ]},
    ],
    "reviews": [
        {"id": "y2-end", "name": "2年次終了時審査", "when": "2年次終了時", "source": "2.4.1, 別表3, 別表3の2",
         "anyOf": [
             {"allOf": [
                 {"type": "groupMin", "groupId": "lang-basic-1", "min": 4},
                 {"type": "groupMin", "groupId": "lang-basic-2", "min": 2},
                 {"type": "allPassed", "groupId": "health-req"},
                 {"type": "allPassed", "groupId": "intro"},
                 {"type": "subjects", "codes": ["UEC301"]},
                 {"type": "allPassed", "groupId": "math-basic-req"},
                 {"type": "subjects", "codes": ["MTH205", "COM202"], "note": "類共通基礎の1年次必修2科目3単位"},
             ]},
             {"type": "totalCredits", "min": 60, "note": "特例。教職科目を除く。卒研着手までには上の科目を全て修得する必要あり"},
         ],
         "onFail": {"blockedSubjects": ["COM501", "COM601"], "note": "不合格時はプログラミング言語実験・メディア情報学実験を履修できない"}},
        {"id": "thesis-start", "name": "卒業研究着手審査", "when": "3年次終了時", "source": "2.4.3, 別表4",
         "allOf": [
             {"type": "review", "id": "y2-end"},
             {"type": "groupMin", "groupId": "lang-basic-1", "min": 4},
             {"type": "groupMin", "groupId": "lang-basic-2", "min": 2},
             {"type": "allPassed", "groupId": "health-req"},
             {"type": "allPassed", "groupId": "intro"},
             {"type": "subjects", "codes": ["UEC301"]},
             {"type": "allPassed", "groupId": "math-basic-req"},
             {"type": "allPassed", "groupId": "cluster-basic-req"},
             {"type": "subjects", "codes": ["COM501", "COM601"]},
             {"type": "totalCredits", "min": 101},
         ]},
        {"id": "graduation", "name": "卒業審査", "when": "4年次終了時", "source": "2.4.4, 別表2",
         "allOf": [{"type": "allGroups"}, {"type": "commonCredits", "min": 8}, {"type": "totalCredits", "min": 128}]},
    ],
}

# ---------------------------------------------------------------- 出力
os.makedirs(os.path.join(OUT, "requirements"), exist_ok=True)
os.makedirs(os.path.join(OUT, "subjects"), exist_ok=True)

def dump(path, obj):
    with open(os.path.join(OUT, path), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")

dump("requirements/2025-day-common.json", common)
dump("requirements/2025-day-I-media.json", media)
dump("subjects/youran-2025.json", {
    "schemaVersion": 1,
    "source": "学修要覧2025（情報理工学域）付録C。昼間コース共通科目＋Ⅰ類メディア情報学プログラムのみ収録",
    "note": "曜日時限・担当・シラバスURLはシラバスから別途取得して offerings に入れる（scripts/fetch_syllabus.py 予定）",
    "subjects": sorted(SUBJECTS.values(), key=lambda s: s["code"]),
})
print("subjects:", len(SUBJECTS))
