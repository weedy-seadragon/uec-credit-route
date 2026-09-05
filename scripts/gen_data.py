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

def add2(rows):
    """add() の拡張版（Ⅱ類・Ⅲ類・夜間主で使用）。
    add() は科目番号の4文字目の数字から標準学期を自動推定するが、Ⅱ類以降は
    学修要覧の週時間数表を実際に読み取った標準年次・学期・学期種別を持っているので、
    それを行に明示的に持たせる（自動推定だと一致しないケースがあるため）。
    row = (code, name, credits, standardYear, standardSemester, termType, flags, note, groups)
    ここで生成する行は data/*.json から機械的に書き出したもの（scripts/README的な位置づけの
    generate_gen_data_ii_iii_evening.mjs 相当のスクリプトで生成。このリポジトリには含めていない）。
    """
    for code, name, credits, year, sem, term, flags, note, groups in rows:
        if code in SUBJECTS:
            s = SUBJECTS[code]
            assert s["name"] == name, f"科目名の不一致: {code} 既存={s['name']!r} 今回={name!r}"
            assert s["credits"] == credits, f"単位数の不一致: {code} 既存={s['credits']} 今回={credits}"
            continue
        SUBJECTS[code] = {
            "code": code,
            "name": name,
            "credits": credits,
            "field": code[:3],
            "standardSemester": sem,
            "standardYear": year,
            "termType": term,
            "eveningAllowed": "e" in flags,
            "forInternational": "i" in flags,
            "graduateLinked": "g" in flags,
            "groups": list(groups),
        }
        if note:
            SUBJECTS[code]["note"] = note

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
        "note": "卒業所要単位を超えた分に加え、以下はそのまま共通単位になる。UEC001z・UEC002z（学域特別講義A・B）は、開講年度により必修/選択の扱いが異なり一意の区分に割り当てられないため、修得した単位はそのまま共通単位として扱う（開発者の指示、2026-09-05）",
        # 学域特別講義（SPECIAL）は開講年度により扱いが異なり必修/選択のどの区分にも一意に
        # 割り当てられないため、修得した単位はそのまま共通単位として扱う（開発者の指示、2026-09-05）
        "alwaysCommon": add("lang-appl-2", LANG_APPL_2) + add("intl-abroad", INTL_ABROAD) + add("special", SPECIAL),
        "external": [{"code": "EXT-ENG", "name": "学外英語能力試験", "credits": 2, "note": "TOEFL iBT 62 / TOEIC 600 / 英検2級 / IELTS 5"}],
    },
    "otherSubjects": {
        "japanese": add("japanese", JAPANESE),
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
# _majorSelOwnの削除は全プログラム分の合算が終わってから行う。ループ内で消すと、
# 後の方で処理するプログラムが前のプログラムの_majorSelOwnを読めなくなる（KeyError）
for p in cluster_i:
    del p["_majorSelOwn"]

# ---------------------------------------------------------------- Ⅱ類・Ⅲ類・夜間主
# 以下は data/requirements/2025-day-II-*.json, 2025-day-III-*.json, 2025-evening.json
# （学修要覧2025の原本と突き合わせ済み。付録C C.3.2/C.3.3/C.5/C.6より作成）から機械的に生成したもの。
# Ⅰ類と違い、この環境ではPythonが使えず実行して data/ と一致するか確認できていない。
# 次にPythonが使える環境で python scripts/gen_data.py && python scripts/validate_data.py を実行し、
# git diff が出ない（＝出力が今のdata/と一致する）ことを確認してほしい。


# ---- Ⅱ類・Ⅲ類・夜間主 科目マスタ（相互展開分を含む全科目、1回だけadd2する）
II_III_EVENING_ROWS = [
    ('BCH501r', '化学生命工学実験第一', 3, 3, 6, '後学期', '', None, ['major-req']),
    ('BCH502r', '化学生命工学演習第一', 1, 3, 5, '前学期', '', None, ['major-req']),
    ('BCH601r', '化学生命工学実験第二', 3, 4, 7, '前学期', '', None, ['major-req']),
    ('BCH602r', '化学生命工学演習第二', 1, 3, 6, '後学期', '', None, ['major-req']),
    ('BCHa01r', '生物有機化学', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('BCHa02r', '生命分子化学特論', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('BCHa03r', '化学生命工学特論', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('BIO201i', '生物学概論', 2, 2, 4, '後学期', '', None, ['major-free']),
    ('BIO201j', '生物学概論', 2, 2, 4, '後学期', '', None, ['major-free']),
    ('BIO401k', '分子生物学', 2, 3, 6, '後学期', '', None, ['cluster-basic-elecreq']),
    ('BIO401m', '分子生物学', 2, 3, 5, '前学期', '', None, ['cluster-basic-elecreq']),
    ('BIO401n', '分子生物学', 2, 3, 5, '前学期', '', None, ['cluster-basic-elecreq']),
    ('BIO401p', '分子生物学', 2, 3, 5, '前学期', '', None, ['cluster-basic-sel']),
    ('BIO401r', '分子生物学', 2, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('BIO501i', '生物学実験', 2, 3, 5, '前学期', '', None, ['major-free']),
    ('BIO501j', '生物学実験', 2, 3, 5, '前学期', '', None, ['major-free']),
    ('BIO501k', '生物学実験', 2, 3, 5, '前学期', '', None, ['major-free']),
    ('BIO501m', '生物学実験', 2, 3, 6, '後学期', '', None, ['major-free']),
    ('BIO501n', '生体計測工学', 2, 3, 5, '前学期', '', None, ['major-sel']),
    ('BIO501p', '生物学実験', 2, 3, 5, '前学期', '', None, ['major-free']),
    ('BIO501r', '生物化学', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('BIO502n', '生物学実験', 2, 3, 6, '後学期', '', None, ['major-free']),
    ('BIO502r', '細胞生物工学', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('BIO503r', '生体計測工学', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('BIO504r', '生物学実験', 2, 3, 6, '後学期', '', None, ['major-free']),
    ('BIO601r', '神経科学', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('BIO602r', 'システム生物学', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('BIO603r', '生体システム工学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('BIOa01m', '分子細胞生物学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('BIOa01r', '分子細胞生物学基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('BIOa02m', '生体情報学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('BIOa02r', '生体情報学基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('BIOb01r', '生体機能システム学基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('BIOb02r', 'ゲノム生物学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('CAR501s', '技術課程演習第一', 2, 2, 3, '前学期', 'e', None, ['sangaku']),
    ('CAR601s', '技術課程演習第二', 2, 2, 4, '後学期', 'e', None, ['sangaku']),
    ('CAR701s', '知的財産権', 2, 4, 7, '前学期', 'e', None, ['gijutsu']),
    ('CAR801s', '技術者倫理', 2, 4, 8, '後学期', 'e', None, ['gijutsu']),
    ('CHM101t', '化学結合と構造', 2, 1, 1, '前学期', 'e', None, ['math-basic-elec']),
    ('CHM102z', '化学概論第一', 2, 1, 1, '前学期', '', None, ['math-basic-req']),
    ('CHM201s', '基礎化学実験', 1, 1, 1, '前学期', 'e', None, ['intro']),
    ('CHM203z', '化学概論第二', 2, 1, 2, '後学期', '', None, ['math-basic-sel']),
    ('CHM401m', '基礎物理化学', 2, 3, 5, '前学期', '', None, ['major-sel']),
    ('CHM401n', '基礎物理化学', 2, 3, 5, '前学期', '', None, ['major-sel']),
    ('CHM401p', '基礎物理化学', 2, 3, 5, '前学期', '', None, ['major-sel']),
    ('CHM401r', '基礎物理化学', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('CHM402m', '無機化学', 2, 3, 5, '前学期', '', None, ['major-sel']),
    ('CHM402n', '無機化学', 2, 3, 5, '前学期', '', None, ['major-sel']),
    ('CHM402p', '無機化学', 2, 3, 5, '前学期', '', None, ['major-sel']),
    ('CHM402r', '無機化学', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('CHM501r', '物理化学第一', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('CHM502r', '有機化学第一', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('CHM503r', '機器分析学', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('CHM601n', '高分子有機化学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('CHM601r', '物理化学第二', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('CHM602r', '有機化学第二', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('CHM603r', '高分子有機化学', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('CHM701m', '環境工学', 2, 4, 8, '後学期', '', None, ['major-sel']),
    ('CHM701r', '環境工学', 2, 4, 8, '後学期', '', None, ['major-sel']),
    ('CHMa01n', '光化学', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('CHMa01r', '光化学', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('CHMb01r', '固体物性化学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('CHMb02r', '無機物質化学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('CHMb03r', '物理化学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('COM101s', 'コンピュータリテラシー', 2, 1, 1, '前学期', 'e', None, ['intro']),
    ('COM201t', '基礎プログラミングおよび演習', 2, 1, 2, '後学期', 'e', None, ['math-basic-req']),
    ('COM201z', '基礎プログラミングおよび演習', 2, 1, 2, '後学期', '', None, ['math-basic-req']),
    ('COM301f', '数値解析およびプログラミング演習', 3, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('COM301g', '数値解析およびプログラミング演習', 3, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('COM301h', '数値解析およびプログラミング演習', 3, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('COM301i', '数値解析およびプログラミング演習', 3, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('COM301j', '数値解析およびプログラミング演習', 3, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('COM301k', '数値解析', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('COM301m', '数値解析', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('COM301n', '数値解析', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('COM301p', '数値解析', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('COM301r', '数値解析', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('COM301t', 'プログラミング通論および演習', 2, 2, 3, '前学期', 'e', None, ['prof-basic-req']),
    ('COM302t', '論理回路学', 2, 2, 3, '前学期', 'e', None, ['prof-basic-req']),
    ('COM401f', 'アルゴリズムとデータ構造およびプログラミング演習', 3, 3, 6, '後学期', '', None, ['cluster-basic-req']),
    ('COM401g', 'アルゴリズムとデータ構造およびプログラミング演習', 3, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('COM401h', 'アルゴリズムとデータ構造およびプログラミング演習', 3, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('COM401i', 'アルゴリズムとデータ構造およびプログラミング演習', 3, 3, 5, '前学期', '', None, ['cluster-basic-free']),
    ('COM401j', 'アルゴリズムとデータ構造およびプログラミング演習', 3, 3, 5, '前学期', '', None, ['cluster-basic-free']),
    ('COM401k', 'プログラミング演習', 2, 3, 6, '後学期', '', None, ['cluster-basic-elecreq']),
    ('COM401m', 'プログラミング演習', 2, 3, 5, '前学期', '', None, ['cluster-basic-elecreq']),
    ('COM401n', 'プログラミング演習', 2, 3, 5, '前学期', '', None, ['cluster-basic-elecreq']),
    ('COM401p', 'プログラミング演習', 2, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('COM401r', 'プログラミング演習', 2, 3, 5, '前学期', '', None, ['cluster-basic-elecreq']),
    ('COM401t', 'アルゴリズム・データ構造および演習', 2, 2, 4, '後学期', 'e', None, ['prof-basic-elec']),
    ('COM402f', '計算機アーキテクチャー', 2, 3, 5, '前学期', '', None, ['major-sel']),
    ('COM402g', '計算機アーキテクチャー', 2, 2, 4, '後学期', '', None, ['major-elecreq']),
    ('COM402h', '計算機アーキテクチャー', 2, 2, 4, '後学期', '', None, ['major-elecreq']),
    ('COM402i', '計算機アーキテクチャー', 2, 2, 4, '後学期', '', None, ['major-elecreq']),
    ('COM402j', '計算機アーキテクチャー', 2, 2, 4, '後学期', '', None, ['major-elecreq']),
    ('COM402k', '計算機工学', 2, 3, 6, '後学期', '', None, ['cluster-basic-elecreq']),
    ('COM402m', '計算機工学', 2, 3, 5, '前学期', '', None, ['cluster-basic-elecreq']),
    ('COM402n', '計算機工学', 2, 3, 5, '前学期', '', None, ['cluster-basic-elecreq']),
    ('COM402p', '計算機工学', 2, 3, 5, '前学期', '', None, ['cluster-basic-sel']),
    ('COM402r', '計算機工学', 2, 3, 5, '前学期', '', None, ['cluster-basic-sel']),
    ('COM403i', '計算機工学', 2, 3, 5, '前学期', '', None, ['major-elecreq']),
    ('COM403j', '計算機工学', 2, 3, 5, '前学期', '', None, ['major-elecreq']),
    ('COM404i', 'プログラミング演習', 2, 3, 5, '前学期', '', None, ['major-elecreq']),
    ('COM404j', 'プログラミング演習', 2, 3, 5, '前学期', '', None, ['major-elecreq']),
    ('COM405i', '論理回路学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('COM405j', '論理回路学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('COM501f', 'プログラミング言語実験', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('COM501g', 'コンピュータネットワーク', 2, 3, 5, '前学期', '', None, ['major-elecreq']),
    ('COM501h', 'コンピュータネットワーク', 2, 3, 5, '前学期', '', None, ['major-elecreq']),
    ('COM501m', '上級コンピュータ演習', 2, 3, 6, '後学期', '', None, ['major-free']),
    ('COM501n', '上級コンピュータ演習', 2, 3, 6, '後学期', '', None, ['major-free']),
    ('COM501p', '上級コンピュータ演習', 2, 3, 6, '後学期', '', None, ['major-free']),
    ('COM501r', '上級コンピュータ演習', 2, 3, 6, '後学期', '', None, ['major-free']),
    ('COM501t', 'プログラミング実験', 1, 3, 5, '前学期', 'e', None, ['prof-basic-req']),
    ('COM502f', 'アルゴリズム論', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('COM502t', '情報通信と符号化', 2, 3, 5, '前学期', 'e', None, ['prof-basic-elec']),
    ('COM503f', 'メディアネットワーク', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('COM504f', 'オペレーティングシステム', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('COM505f', 'コンピュータネットワーク', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('COM506f', 'データベース論', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('COM507f', 'マルチメディア処理', 2, 3, 5, '前学期', '', None, ['major-sel']),
    ('COM507g', 'マルチメディア処理', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('COM507h', 'マルチメディア処理', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('COM601f', 'セキュリティ情報学実験', 2, 4, 7, '前学期', '', None, ['major-req']),
    ('COM601t', '計算機工学', 2, 3, 6, '後学期', 'e', None, ['major-req']),
    ('COM602f', 'ユビキタスネットワーク', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('COM602t', '信号処理論', 2, 3, 6, '後学期', 'e', None, ['major-req']),
    ('COM603f', '暗号理論', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('COM603t', '情報学実験', 1, 3, 6, '後学期', 'e', None, ['major-req']),
    ('COM604f', 'ハードウェアセキュリティ', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('COM605f', 'ソフトウェアセキュリティ', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('COM606f', 'コンテンツセキュリティ', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('COM607f', 'ネットワークセキュリティ', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('COM701t', '通信・ネットワーク', 2, 3, 6, '後学期', 'e', None, ['major-sel']),
    ('COM801t', '暗号情報セキュリティ', 2, 4, 8, '後学期', 'e', None, ['major-sel']),
    ('COMa01f', 'セキュリティ基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('COMa02f', '実践ソフトウェア開発基礎論', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('COMa03f', '実践ソフトウェア開発概論Ⅱ', 2, 4, 7, '前学期', 'g', None, ['major-free']),
    ('COMb01f', '実践ソフトウェア開発概論Ⅲ', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('COMb01i', 'コンピュータビジョン特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('COMb01j', 'コンピュータビジョン特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('COMb01k', 'コンピュータビジョン特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('COMb02f', 'ソフトウェア品質学', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('COMb02i', '機械情報学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('COMb02j', '機械情報学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('COMb02k', '機械情報学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('ELE001g', '電子工学工房', 2, 1, 1, '前学期', '', None, ['major-sel']),
    ('ELE001h', '電子工学工房', 2, 1, 1, '前学期', '', None, ['major-sel']),
    ('ELE301f', '基礎電気回路', 2, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('ELE301g', '基礎電気回路', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('ELE301h', '基礎電気回路', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('ELE301i', '基礎電気回路', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('ELE301j', '基礎電気回路', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('ELE301k', '基礎電気回路', 2, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('ELE301m', '基礎電気回路', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('ELE301n', '基礎電気回路', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('ELE301p', '基礎電気回路', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('ELE301r', '基礎電気回路', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('ELE401g', '回路システム学第一', 2, 2, 4, '後学期', '', None, ['major-req']),
    ('ELE401h', '論理回路学', 2, 2, 4, '後学期', '', None, ['major-req']),
    ('ELE401k', '基礎電子回路', 2, 3, 6, '後学期', '', None, ['cluster-basic-elecreq']),
    ('ELE401m', '基礎電子回路', 2, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('ELE401n', '基礎電子回路', 2, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('ELE401p', '基礎電子回路', 2, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('ELE401r', '基礎電子回路', 2, 3, 5, '前学期', '', None, ['cluster-basic-elecreq']),
    ('ELE401t', '電気回路学および演習', 3, 2, 4, '後学期', 'e', None, ['prof-basic-req']),
    ('ELE402g', '基礎情報通信', 2, 2, 4, '後学期', '', None, ['major-elecreq']),
    ('ELE402h', '回路システム学第一', 2, 2, 3, '前学期', '', None, ['major-req']),
    ('ELE402m', '理工学基礎実験', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('ELE402n', '理工学基礎実験', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('ELE402p', '理工学基礎実験', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('ELE402r', '理工学基礎実験', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('ELE402t', '基礎電子工学', 2, 2, 4, '後学期', 'e', None, ['prof-basic-req']),
    ('ELE403g', '論理回路学', 2, 2, 4, '後学期', '', None, ['major-elecreq']),
    ('ELE403h', '情報通信と符号化', 2, 2, 4, '後学期', '', None, ['major-elecreq']),
    ('ELE404g', '基礎電子工学', 2, 2, 4, '後学期', '', None, ['major-elecreq']),
    ('ELE404h', '基礎電子工学', 2, 2, 4, '後学期', '', None, ['major-elecreq']),
    ('ELE501f', '情報通信システム', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('ELE501g', '回路システム学第二', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('ELE501h', '回路システム学第二', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('ELE501m', '電子工学実験第一', 3, 3, 6, '後学期', '', None, ['major-req']),
    ('ELE501n', '電磁波工学', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('ELE501t', 'アナログ回路実験', 1, 3, 5, '前学期', 'e', None, ['prof-basic-req']),
    ('ELE502g', '情報通信工学実験A', 3, 3, 5, '前学期', '', None, ['major-req']),
    ('ELE502h', '電子情報学実験A', 3, 3, 5, '前学期', '', None, ['major-req']),
    ('ELE502m', '電気回路', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('ELE502t', '電子回路学', 2, 3, 5, '前学期', 'e', None, ['prof-basic-elec']),
    ('ELE503g', '情報理論', 2, 3, 5, '前学期', '', None, ['major-elecreq']),
    ('ELE503h', '情報理論', 2, 3, 5, '前学期', '', None, ['major-elecreq']),
    ('ELE503m', '電気回路演習', 1, 3, 5, '前学期', '', None, ['major-req']),
    ('ELE503t', '回路システム学', 2, 3, 5, '前学期', 'e', None, ['prof-basic-elec']),
    ('ELE504g', '信号処理論', 2, 3, 5, '前学期', '', None, ['major-elecreq']),
    ('ELE504h', '信号処理論', 2, 3, 5, '前学期', '', None, ['major-elecreq']),
    ('ELE504m', '論理回路学', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('ELE505g', '宇宙通信工学', 2, 3, 5, '前学期', '', None, ['major-sel']),
    ('ELE505h', '宇宙通信工学', 2, 3, 5, '前学期', '', None, ['major-sel']),
    ('ELE601f', 'デジタル信号処理', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('ELE601g', '情報通信工学実験B1', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('ELE601h', '電子回路学', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('ELE601i', '電子回路学', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('ELE601j', '電子回路学', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('ELE601m', '電子工学実験第二', 3, 4, 7, '前学期', '', None, ['major-req']),
    ('ELE601n', '画像工学', 2, 4, 7, '前学期', '', None, ['major-req']),
    ('ELE601p', '電子回路学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('ELE601r', '画像工学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('ELE601t', '組み込みシステム', 2, 3, 6, '後学期', 'e', None, ['major-req']),
    ('ELE602g', '情報通信工学実験B2', 1, 3, 6, '後学期', '', None, ['major-req']),
    ('ELE602h', '電子情報学実験B1', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('ELE602m', '電子回路学', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('ELE602n', '電子回路学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('ELE603g', '電子回路学', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('ELE603h', '電子情報学実験B2', 1, 3, 6, '後学期', '', None, ['major-req']),
    ('ELE603m', '線形システム理論', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('ELE603n', 'デジタル信号処理', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('ELE604h', '伝送回路論', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('ELE604m', '画像工学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('ELE605h', '電磁波工学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('ELE605m', 'デジタル信号処理', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('ELE606h', '電子機器システム学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('ELE607h', '線形システム理論', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('ELE608g', '線形システム理論', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('ELE701g', '集積回路学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('ELE701h', '集積回路学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('ELE701m', '電磁波工学', 2, 4, 8, '後学期', '', None, ['major-sel']),
    ('ELE701t', '計測工学', 2, 3, 6, '後学期', 'e', None, ['major-sel']),
    ('ELE702g', '画像処理工学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('ELE702h', '音響工学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('ELE703h', '画像処理工学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('ELE801g', '通信法規', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('ELE801h', '通信法規', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('ELEa01f', 'VLSI Low Power Circuit Design', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('ELEa01g', '情報伝送基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('ELEa01h', '情報通信ネットワーク', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('ELEa01i', 'VLSI Low Power Circuit Design', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('ELEa01j', 'VLSI Low Power Circuit Design', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('ELEa01m', '集積回路基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('ELEa01n', '集積回路基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('ELEa01p', '集積回路基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('ELEa02g', '情報通信ネットワーク', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('ELEa02h', 'データ圧縮基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('ELEa02m', '画像情報学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('ELEa02n', '画像情報学基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('ELEa03g', 'データ圧縮基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('ELEa03h', 'ディジタル信号処理基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('ELEa04g', 'マイクロ波回路設計特論', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('ELEa04h', 'VLSI Low Power Circuit Design', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('ELEa05g', '環境電磁工学特論', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('ELEa06g', 'VLSI Low Power Circuit Design', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('ELEb01f', '情報理論基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('ELEb01g', '回路システム基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('ELEb01h', '回路システム基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('ENG101s', 'Academic Written English I', 1, 1, 1, '前学期', 'e', None, ['language']),
    ('ENG102s', 'Academic Spoken English I', 1, 1, 1, '前学期', 'e', None, ['language']),
    ('ENG201s', 'Academic Written English II', 1, 1, 2, '後学期', 'e', None, ['language']),
    ('ENG202s', 'Academic Spoken English II', 1, 1, 2, '後学期', 'e', None, ['language']),
    ('ENG301s', 'Academic English for the 2nd Year I', 1, 2, 3, '前学期', 'e', None, ['language']),
    ('ENG401s', 'Academic English for the 2nd Year II', 1, 2, 4, '後学期', 'e', None, ['language']),
    ('ENG501s', 'Academic Presentation in English', 1, 3, 5, '前学期', 'e', None, ['language']),
    ('ENG601s', 'Academic Writing in English', 1, 3, 6, '後学期', 'e', None, ['language']),
    ('FGN101f', '基礎数学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN101g', '基礎数学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN101h', '基礎数学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN101i', '基礎数学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN101j', '基礎数学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN101k', '基礎数学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN101m', '基礎数学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN101n', '基礎数学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN101p', '基礎数学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN101r', '基礎数学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN102f', '基礎物理学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN102g', '基礎物理学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN102h', '基礎物理学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN102i', '基礎物理学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN102j', '基礎物理学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN102k', '基礎物理学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN102m', '基礎物理学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN102n', '基礎物理学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN102p', '基礎物理学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN102r', '基礎物理学演習第一', 1, 1, 1, '前学期', 'i', None, ['major-sel']),
    ('FGN201f', '基礎数学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN201g', '基礎数学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN201h', '基礎数学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN201i', '基礎数学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN201j', '基礎数学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN201k', '基礎数学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN201m', '基礎数学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN201n', '基礎数学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN201p', '基礎数学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN201r', '基礎数学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN202f', '基礎物理学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN202g', '基礎物理学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN202h', '基礎物理学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN202i', '基礎物理学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN202j', '基礎物理学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN202k', '基礎物理学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN202m', '基礎物理学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN202n', '基礎物理学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN202p', '基礎物理学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN202r', '基礎物理学演習第二', 1, 1, 2, '後学期', 'i', None, ['major-sel']),
    ('FGN301f', '情報処理演習第一', 2, 2, 3, '前学期', 'i', None, ['major-sel']),
    ('FGN301g', '情報処理演習第一', 2, 2, 3, '前学期', 'i', None, ['major-sel']),
    ('FGN301h', '情報処理演習第一', 2, 2, 3, '前学期', 'i', None, ['major-sel']),
    ('FGN301i', '情報処理演習第一', 2, 2, 3, '前学期', 'i', None, ['major-sel']),
    ('FGN301j', '情報処理演習第一', 2, 2, 3, '前学期', 'i', None, ['major-sel']),
    ('FGN301k', '情報処理演習第一', 2, 2, 3, '前学期', 'i', None, ['major-sel']),
    ('FGN301m', '情報処理演習第一', 2, 2, 3, '前学期', 'i', None, ['major-sel']),
    ('FGN301n', '情報処理演習第一', 2, 2, 3, '前学期', 'i', None, ['major-sel']),
    ('FGN301p', '情報処理演習第一', 2, 2, 3, '前学期', 'i', None, ['major-sel']),
    ('FGN301r', '情報処理演習第一', 2, 2, 3, '前学期', 'i', None, ['major-sel']),
    ('FGN401f', '情報処理演習第二', 2, 2, 4, '後学期', 'i', None, ['major-sel']),
    ('FGN401g', '情報処理演習第二', 2, 2, 4, '後学期', 'i', None, ['major-sel']),
    ('FGN401h', '情報処理演習第二', 2, 2, 4, '後学期', 'i', None, ['major-sel']),
    ('FGN401i', '情報処理演習第二', 2, 2, 4, '後学期', 'i', None, ['major-sel']),
    ('FGN401j', '情報処理演習第二', 2, 2, 4, '後学期', 'i', None, ['major-sel']),
    ('FGN401k', '情報処理演習第二', 2, 2, 4, '後学期', 'i', None, ['major-sel']),
    ('FGN401m', '情報処理演習第二', 2, 2, 4, '後学期', 'i', None, ['major-sel']),
    ('FGN401n', '情報処理演習第二', 2, 2, 4, '後学期', 'i', None, ['major-sel']),
    ('FGN401p', '情報処理演習第二', 2, 2, 4, '後学期', 'i', None, ['major-sel']),
    ('FGN401r', '情報処理演習第二', 2, 2, 4, '後学期', 'i', None, ['major-sel']),
    ('GEO201i', '地学', 2, 2, 3, '前学期', '', None, ['major-free']),
    ('GEO201j', '地学', 2, 2, 3, '前学期', '', None, ['major-free']),
    ('GEO201k', '地学', 2, 2, 3, '前学期', '', None, ['major-free']),
    ('GEO201m', '地学', 2, 2, 3, '前学期', '', None, ['major-free']),
    ('GEO201n', '地学', 2, 2, 3, '前学期', '', None, ['major-free']),
    ('GEO201p', '地学', 2, 2, 3, '前学期', '', None, ['major-free']),
    ('GEO201r', '地学', 2, 2, 3, '前学期', '', None, ['major-free']),
    ('GEO501i', '地学実験', 2, 3, 5, '前学期', '', None, ['major-free']),
    ('GEO501j', '地学実験', 2, 3, 5, '前学期', '', None, ['major-free']),
    ('GEO501k', '地学実験', 2, 3, 5, '前学期', '', None, ['major-free']),
    ('GEO501m', '地学実験', 2, 3, 5, '前学期', '', None, ['major-free']),
    ('GEO501n', '地学実験', 2, 3, 6, '後学期', '', None, ['major-free']),
    ('GEO501p', '地学実験', 2, 3, 5, '前学期', '', None, ['major-free']),
    ('GEO501r', '地学実験', 2, 3, 5, '前学期', '', None, ['major-free']),
    ('GSC301s', '環境科学', 2, 2, 3, '前学期', 'e', None, ['sci-liberal']),
    ('GSE301f', '基礎演習A', 1, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('GSE301g', '基礎演習A', 1, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('GSE301h', '基礎演習A', 1, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('GSE301i', '基礎演習A', 1, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('GSE301j', '基礎演習A', 1, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('GSE301k', '計測工学概論', 2, 2, 3, '前学期', '', None, ['cluster-basic-elecreq']),
    ('GSE301m', '計測工学概論', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('GSE301n', '計測工学概論', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('GSE301p', '計測工学概論', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('GSE301r', '計測工学概論', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('GSE401g', '基礎演習B', 1, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('GSE401h', '基礎演習B', 1, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('GSE401i', '機械計測工学', 2, 3, 5, '前学期', '', None, ['major-elecreq']),
    ('GSE401j', '機械計測工学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('GSE501i', '電気電子計測', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('GSE501j', '電気電子計測', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('GSE501k', '電気電子計測', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('GSE601g', '計測工学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('GSE601h', '計測工学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('GSE601i', 'デジタル信号処理', 2, 4, 7, '前学期', '', None, ['major-req']),
    ('GSE601j', 'デジタル信号処理', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('GSE601k', 'デジタル信号処理', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('GSE701t', '先端トピックス', 2, 3, 6, '後学期', 'e', None, ['major-sel']),
    ('GSEa01i', '機械知能システム学専攻基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('GSEa01j', '機械知能システム学専攻基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('GSEa01k', '機械知能システム学専攻基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('GSEa02i', '計測工学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('GSEa02j', '計測工学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('GSEa02k', '計測工学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('GSEa03i', '知覚システム特論', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('GSEa03j', '知覚システム特論', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('GSEa03k', '知覚システム特論', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('GSEa04i', '感覚運動システム特論', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('GSEa04j', '感覚運動システム特論', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('GSEa04k', '感覚運動システム特論', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('GSEb01g', 'センシング工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('GSEb01h', 'センシング工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('GSEb01i', 'センサ信号処理学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('GSEb01j', 'センサ信号処理学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('GSEb01k', 'センサ信号処理学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('GSEb01m', '量子エネルギー科学', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('GSEb01r', '量子エネルギー科学', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('GSEb02h', '電磁波環境観測技術特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('HSP101s', '健康実践論', 2, 1, 1, '前学期', 'e', None, ['health']),
    ('HSS101s', '歴史学', 2, 1, 1, '前学期', 'e', None, ['hss']),
    ('HSS102s', '音楽', 2, 1, 1, '前学期', 'e', None, ['hss']),
    ('HSS103s', '社会学', 2, 1, 1, '前学期', 'e', None, ['hss']),
    ('HSS104s', '法学', 2, 1, 1, '前学期', 'e', None, ['hss']),
    ('HSS105s', '地理学', 2, 1, 1, '前学期', 'e', None, ['hss']),
    ('HSS106s', '社会思想史', 2, 1, 1, '前学期', 'e', None, ['hss']),
    ('HSS201s', '哲学', 2, None, None, None, 'e', None, ['hss']),
    ('HSS202s', '倫理学', 2, None, None, None, 'e', None, ['hss']),
    ('HSS203s', '心理学', 2, None, None, None, 'e', None, ['hss']),
    ('HSS204s', '科学史', 2, None, None, None, 'e', None, ['hss']),
    ('HSS205s', '文学', 2, None, None, None, 'e', None, ['hss']),
    ('HSS501s', '科学という文化', 2, 3, 5, '前学期', 'e', None, ['advanced']),
    ('HSS502s', '科学技術と倫理', 2, 3, 5, '前学期', 'e', None, ['advanced']),
    ('HSS503s', '国際文化論', 2, 3, 5, '前学期', 'e', None, ['advanced']),
    ('HSS701s', '国際技術協力論', 2, 4, 7, '前学期', 'e', None, ['advanced']),
    ('INS701t', '情報メディアシステム', 2, 3, 6, '後学期', 'e', None, ['major-sel']),
    ('INS801t', '知能システム', 2, 4, 8, '後学期', 'e', None, ['major-sel']),
    ('INSa01f', 'データマイニング', 2, 4, 7, '前学期', 'g', None, ['major-free']),
    ('INSa01g', '情報・ネットワーク工学専攻基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('INSa01h', '情報・ネットワーク工学専攻基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('INSa02f', '学習工学特論', 2, 4, 7, '前学期', 'g', None, ['major-free']),
    ('INSb01f', '画像認識システム特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('INT001f', 'Topics in Informatics Ⅰ', 2, None, None, None, '', None, ['major-intl']),
    ('INT001g', 'Advanced Communication Engineering and Informatics Ⅰ', 2, None, None, None, '', None, ['major-intl']),
    ('INT001h', 'Advanced Communication Engineering and Informatics Ⅰ', 2, None, None, None, '', None, ['major-intl']),
    ('INT001i', 'Topics in Mechanical and Intelligent Systems Engineering Ⅰ', 2, None, None, None, '', None, ['major-intl']),
    ('INT001j', 'Topics in Mechanical and Intelligent Systems Engineering Ⅰ', 2, None, None, None, '', None, ['major-intl']),
    ('INT001k', 'Topics in Mechanical and Intelligent Systems Engineering Ⅰ', 2, None, None, None, '', None, ['major-intl']),
    ('INT001m', 'Advanced Engineering Science Ⅰ', 2, None, None, None, '', None, ['major-intl']),
    ('INT001n', 'Advanced Engineering Science Ⅰ', 2, None, None, None, '', None, ['major-intl']),
    ('INT001p', 'Advanced Engineering Science Ⅰ', 2, None, None, None, '', None, ['major-intl']),
    ('INT001r', 'Advanced Engineering Science Ⅰ', 2, None, None, None, '', None, ['major-intl']),
    ('INT002f', 'Topics in Informatics Ⅱ', 2, None, None, None, '', None, ['major-intl']),
    ('INT002g', 'Advanced Communication Engineering and Informatics Ⅱ', 2, None, None, None, '', None, ['major-intl']),
    ('INT002h', 'Advanced Communication Engineering and Informatics Ⅱ', 2, None, None, None, '', None, ['major-intl']),
    ('INT002i', 'Topics in Mechanical and Intelligent Systems Engineering Ⅱ', 2, None, None, None, '', None, ['major-intl']),
    ('INT002j', 'Topics in Mechanical and Intelligent Systems Engineering Ⅱ', 2, None, None, None, '', None, ['major-intl']),
    ('INT002k', 'Topics in Mechanical and Intelligent Systems Engineering Ⅱ', 2, None, None, None, '', None, ['major-intl']),
    ('INT002m', 'Advanced Engineering Science Ⅱ', 2, None, None, None, '', None, ['major-intl']),
    ('INT002n', 'Advanced Engineering Science Ⅱ', 2, None, None, None, '', None, ['major-intl']),
    ('INT002p', 'Advanced Engineering Science Ⅱ', 2, None, None, None, '', None, ['major-intl']),
    ('INT002r', 'Advanced Engineering Science Ⅱ', 2, None, None, None, '', None, ['major-intl']),
    ('INT003f', 'Topics in Informatics Ⅲ', 2, None, None, None, '', None, ['major-intl']),
    ('INT003g', 'Advanced Communication Engineering and Informatics Ⅲ', 2, None, None, None, '', None, ['major-intl']),
    ('INT003h', 'Advanced Communication Engineering and Informatics Ⅲ', 2, None, None, None, '', None, ['major-intl']),
    ('INT003m', 'Advanced Engineering Science Ⅲ', 2, None, None, None, '', None, ['major-intl']),
    ('INT003n', 'Advanced Engineering Science Ⅲ', 2, None, None, None, '', None, ['major-intl']),
    ('INT003p', 'Advanced Engineering Science Ⅲ', 2, None, None, None, '', None, ['major-intl']),
    ('INT003r', 'Advanced Engineering Science Ⅲ', 2, None, None, None, '', None, ['major-intl']),
    ('INT004g', 'Advanced Communication Engineering and Informatics Ⅳ', 2, None, None, None, '', None, ['major-intl']),
    ('INT004h', 'Advanced Communication Engineering and Informatics Ⅳ', 2, None, None, None, '', None, ['major-intl']),
    ('INT401m', 'Experimental Electronics Laboratory', 2, 3, 5, '前学期', '', None, ['major-intl']),
    ('INT401n', 'Experimental Electronics Laboratory', 2, 3, 5, '前学期', '', None, ['major-intl']),
    ('INT401p', 'Experimental Electronics Laboratory', 2, 3, 5, '前学期', '', None, ['major-intl']),
    ('INT401r', 'Experimental Electronics Laboratory', 2, 3, 5, '前学期', '', None, ['major-intl']),
    ('LAB501f', 'GLTPラボワーク', 1, 4, 7, '前学期', '', None, ['major-free']),
    ('LAB501g', 'GLTPラボワーク', 1, 3, 6, '後学期', '', None, ['major-free']),
    ('LAB501h', 'GLTPラボワーク', 1, 3, 6, '後学期', '', None, ['major-free']),
    ('LAB501i', 'GLTPラボワーク', 1, 3, 6, '後学期', '', None, ['major-free']),
    ('LAB501j', 'GLTPラボワーク', 1, 3, 6, '後学期', '', None, ['major-free']),
    ('LAB501k', 'GLTPラボワーク', 1, 3, 6, '後学期', '', None, ['major-free']),
    ('LAB501m', 'GLTPラボワーク', 1, 3, 6, '後学期', '', None, ['major-free']),
    ('LAB501n', 'GLTPラボワーク', 1, 3, 6, '後学期', '', None, ['major-free']),
    ('LAB501p', 'GLTPラボワーク', 1, 3, 6, '後学期', '', None, ['major-free']),
    ('LAB501r', 'GLTPラボワーク', 1, 3, 6, '後学期', '', None, ['major-free']),
    ('LAB701f', '輪講A', 1, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB701g', '輪講A', 1, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB701h', '輪講A', 1, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB701i', '輪講A', 1, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB701j', '輪講A', 1, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB701k', '輪講A', 1, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB701m', '輪講A', 1, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB701n', '輪講A', 1, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB701p', '輪講A', 1, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB701r', '輪講A', 1, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB701t', '輪講A', 1, 4, 7, '前学期', 'e', None, ['major-req']),
    ('LAB702f', '卒業研究A', 3, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB702g', '卒業研究A', 3, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB702h', '卒業研究A', 3, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB702i', '卒業研究A', 3, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB702j', '卒業研究A', 3, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB702k', '卒業研究A', 3, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB702m', '卒業研究A', 3, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB702n', '卒業研究A', 3, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB702p', '卒業研究A', 3, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB702r', '卒業研究A', 3, 4, 7, '前学期', '', None, ['major-req']),
    ('LAB702t', '卒業研究A', 3, 4, 7, '前学期', 'e', None, ['major-sel']),
    ('LAB801f', '輪講B', 1, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB801g', '輪講B', 1, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB801h', '輪講B', 1, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB801i', '輪講B', 1, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB801j', '輪講B', 1, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB801k', '輪講B', 1, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB801m', '輪講B', 1, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB801n', '輪講B', 1, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB801p', '輪講B', 1, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB801r', '輪講B', 1, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB801t', '輪講B', 1, 4, 8, '後学期', 'e', None, ['major-req']),
    ('LAB802f', '卒業研究B', 3, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB802g', '卒業研究B', 3, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB802h', '卒業研究B', 3, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB802i', '卒業研究B', 3, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB802j', '卒業研究B', 3, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB802k', '卒業研究B', 3, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB802m', '卒業研究B', 3, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB802n', '卒業研究B', 3, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB802p', '卒業研究B', 3, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB802r', '卒業研究B', 3, 4, 8, '後学期', '', None, ['major-req']),
    ('LAB802t', '卒業研究B', 3, 4, 8, '後学期', 'e', None, ['major-sel']),
    ('MCE401i', '機械力学および演習', 3, 3, 5, '前学期', '', None, ['major-req']),
    ('MCE401j', '機械力学および演習', 3, 3, 5, '前学期', '', None, ['major-req']),
    ('MCE401k', '材料力学および演習', 3, 3, 5, '前学期', '', None, ['major-req']),
    ('MCE402i', '材料力学および演習', 3, 3, 5, '前学期', '', None, ['major-req']),
    ('MCE402j', '材料力学および演習', 3, 3, 5, '前学期', '', None, ['major-req']),
    ('MCE402k', 'メカノデザイン', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('MCE403i', 'メカノデザイン', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('MCE403j', 'メカノデザイン', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('MCE403k', '機械力学および演習', 3, 3, 5, '前学期', '', None, ['major-req']),
    ('MCE501i', '基礎制御工学および演習', 3, 3, 6, '後学期', '', None, ['major-req']),
    ('MCE501j', 'ロボットの機構と力学', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('MCE501k', '知能機械工学基礎実験第一', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('MCE501t', '制御工学', 2, 3, 5, '前学期', 'e', None, ['prof-basic-elec']),
    ('MCE502i', 'メカトロニクス基礎実験A', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('MCE502j', '人間機械システム', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('MCE502k', 'マシンデザインA', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('MCE502t', '設計工学', 2, 3, 5, '前学期', 'e', None, ['prof-basic-elec']),
    ('MCE503i', 'マシンデザインA', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('MCE503j', 'メカトロニクス基礎実験A', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('MCE503k', '設計基礎工学', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('MCE504i', '加工学および演習', 3, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('MCE504j', 'マシンデザインA', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('MCE504k', '熱力学応用', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('MCE505i', '熱力学および演習', 3, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('MCE505j', '基礎制御工学および演習', 3, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('MCE505k', '機構要素設計', 2, 3, 5, '前学期', '', None, ['major-elecreq']),
    ('MCE506i', 'ロボットの機構と力学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('MCE506j', '加工学および演習', 3, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('MCE506k', '加工学および演習', 3, 3, 5, '前学期', '', None, ['major-elecreq']),
    ('MCE507i', '人間機械システム', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('MCE507j', '熱力学および演習', 3, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('MCE507k', '基礎制御工学および演習', 3, 3, 5, '前学期', '', None, ['major-elecreq']),
    ('MCE508i', '設計基礎工学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('MCE508j', '設計基礎工学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('MCE508k', 'ロボットの機構と力学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('MCE509i', '機構要素設計', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('MCE509j', '機構要素設計', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('MCE509k', '人間機械システム', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('MCE601i', 'メカトロニクス基礎実験B', 2, 4, 7, '前学期', '', None, ['major-req']),
    ('MCE601j', 'メカトロニクス基礎実験B', 2, 4, 7, '前学期', '', None, ['major-req']),
    ('MCE601k', '知能機械工学基礎実験第二', 2, 4, 7, '前学期', '', None, ['major-req']),
    ('MCE601t', '知能機械工学実験', 1, 3, 6, '後学期', 'e', None, ['major-req']),
    ('MCE602i', 'マシンデザインB', 2, 4, 7, '前学期', '', None, ['major-req']),
    ('MCE602j', 'マシンデザインB', 2, 4, 7, '前学期', '', None, ['major-req']),
    ('MCE602k', 'マシンデザインB', 2, 4, 7, '前学期', '', None, ['major-req']),
    ('MCE603i', '現代制御工学', 2, 4, 7, '前学期', '', None, ['major-req']),
    ('MCE603j', '知能ロボット工学', 2, 4, 7, '前学期', '', None, ['major-req']),
    ('MCE603k', '流体力学および演習', 3, 3, 6, '後学期', '', None, ['major-req']),
    ('MCE604i', '流体力学および演習', 3, 4, 7, '前学期', '', None, ['major-elecreq']),
    ('MCE604j', '流体力学および演習', 3, 4, 7, '前学期', '', None, ['major-elecreq']),
    ('MCE604k', '生産システム工学', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('MCE605i', '材料工学', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('MCE605j', '材料工学', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('MCE605k', '材料工学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('MCE606i', 'メカトロニクス', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('MCE606j', 'メカトロニクス', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('MCE606k', 'メカトロニクス', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('MCE607i', '知能ロボット工学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('MCE607j', '現代制御工学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('MCE607k', '知能ロボット工学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('MCE608i', '生産システム工学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('MCE608j', '生産システム工学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('MCE608k', '現代制御工学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('MCE609i', '生体システム工学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('MCE609j', '生体システム工学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('MCE609k', '生体システム工学', 2, 4, 8, '後学期', '', None, ['major-sel']),
    ('MCE701i', '自動車工学', 2, 4, 8, '後学期', '', None, ['major-sel']),
    ('MCE701j', '自動車工学', 2, 4, 8, '後学期', '', None, ['major-sel']),
    ('MCE701k', '自動車工学', 2, 4, 8, '後学期', '', None, ['major-sel']),
    ('MCE701t', 'メカトロニクス', 2, 3, 6, '後学期', 'e', None, ['major-sel']),
    ('MCE702i', '航空宇宙工学', 2, 4, 8, '後学期', '', None, ['major-sel']),
    ('MCE702j', '航空宇宙工学', 2, 4, 8, '後学期', '', None, ['major-sel']),
    ('MCE702k', '航空宇宙工学', 2, 4, 8, '後学期', '', None, ['major-sel']),
    ('MCE801t', 'ロボティックス', 2, 4, 8, '後学期', 'e', None, ['major-sel']),
    ('MCE802t', 'ヒューマンインタフェース', 2, 4, 8, '後学期', 'e', None, ['major-sel']),
    ('MCEa01i', '熱工学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa01j', '熱工学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa01k', '熱工学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa02i', '流体工学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa02j', '流体工学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa02k', '流体工学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa03i', 'バイオメカニクス基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa03j', 'バイオメカニクス基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa03k', 'バイオメカニクス基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa04i', '材料強度学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa04j', '材料強度学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa04k', '材料強度学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa05i', '生産加工学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa05j', '生産加工学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa05k', '生産加工学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa06i', 'ロボット工学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa06j', 'ロボット工学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa06k', 'ロボット工学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa07i', '制御系設計学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa07j', '制御系設計学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEa07k', '制御系設計学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('MCEb01i', 'メカトロニクス特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb01j', 'メカトロニクス特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb01k', '生体計測工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb02i', 'ロボット応用工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb02j', 'ロボット応用工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb02k', 'ロバスト制御工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb03i', 'ロボット機構制御特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb03j', 'ロボット機構制御特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb03k', '組込み制御システム学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb04i', '運動計測学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb04j', '運動計測学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb04k', 'メカトロニクス特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb05i', 'バーチャルリアリティ特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb05j', 'バーチャルリアリティ特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb05k', 'ロボット応用工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb06i', 'ロボット情報工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb06j', 'ロボット情報工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb06k', 'ロボット機構制御特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb07i', '設計システム工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb07j', '設計システム工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb07k', '運動計測学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb08i', '知的生産システム特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb08j', '知的生産システム特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb08k', 'バーチャルリアリティ特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb09i', '計算力学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb09j', '計算力学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb09k', 'ロボット情報工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb10i', '生体計測工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb10j', '生体計測工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb10k', '設計システム工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb11i', 'ロバスト制御工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb11j', 'ロバスト制御工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb11k', '知的生産システム特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb12i', '組込み制御システム学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb12j', '組込み制御システム学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb12k', '計算力学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MCEb13i', 'Advanced Robotics and Mechatronics Engineering', 2, None, None, None, 'g', None, ['major-free']),
    ('MCEb13j', 'Advanced Robotics and Mechatronics Engineering', 2, None, None, None, 'g', None, ['major-free']),
    ('MCEb13k', 'Advanced Robotics and Mechatronics Engineering', 2, None, None, None, 'g', None, ['major-free']),
    ('MTH101s', 'アカデミックリテラシー', 2, 1, 1, '前学期', 'e', None, ['intro']),
    ('MTH101z', '微分積分学第一', 2, 1, 1, '前学期', '', None, ['math-basic-req']),
    ('MTH102t', '基礎微分積分学第一', 2, 1, 1, '前学期', 'e', None, ['math-basic-req']),
    ('MTH102z', '線形代数学第一', 2, 1, 1, '前学期', '', None, ['math-basic-req']),
    ('MTH103t', 'ベクトルと行列第一', 2, 1, 1, '前学期', 'e', None, ['math-basic-req']),
    ('MTH103z', '数学演習第一', 1, 1, 1, '前学期', '', None, ['math-basic-req']),
    ('MTH201t', '基礎微分積分学第二', 2, 1, 2, '後学期', 'e', None, ['math-basic-req']),
    ('MTH201z', '微分積分学第二', 2, 1, 2, '後学期', '', None, ['math-basic-req']),
    ('MTH202t', 'ベクトルと行列第二', 2, 1, 2, '後学期', 'e', None, ['math-basic-req']),
    ('MTH202z', '線形代数学第二', 2, 1, 2, '後学期', '', None, ['math-basic-req']),
    ('MTH203t', '離散数学', 2, 1, 2, '後学期', 'e', None, ['prof-basic-req']),
    ('MTH203z', '解析学', 2, 1, 2, '後学期', '', None, ['math-basic-req']),
    ('MTH204z', '数学演習第二', 1, 1, 2, '後学期', '', None, ['math-basic-req']),
    ('MTH301f', '確率統計', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('MTH301g', '確率統計', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('MTH301h', '確率統計', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('MTH301i', '確率統計', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('MTH301j', '確率統計', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('MTH301k', '工学基礎数学および演習', 3, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('MTH301m', '工学基礎数学および演習', 3, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('MTH301n', '工学基礎数学および演習', 3, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('MTH301p', '工学基礎数学および演習', 3, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('MTH301r', '工学基礎数学および演習', 3, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('MTH301t', '基礎解析学', 2, 2, 3, '前学期', 'e', None, ['math-basic-elec']),
    ('MTH302f', '応用数学A', 2, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('MTH302g', '応用数学A', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('MTH302h', '応用数学A', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('MTH302i', '複素関数論', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('MTH302j', '複素関数論', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('MTH302k', '複素関数論', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('MTH302m', '複素関数論', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('MTH302n', '複素関数論', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('MTH302p', '複素関数論', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('MTH302r', '複素関数論', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('MTH302t', '応用数学第一', 2, 2, 3, '前学期', 'e', None, ['prof-basic-req']),
    ('MTH303f', '離散数学', 2, 2, 4, '後学期', '', None, ['cluster-basic-sel']),
    ('MTH303g', '離散数学', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('MTH303h', '離散数学', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('MTH303i', '応用数学A', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('MTH303j', '応用数学A', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('MTH303k', '確率統計', 2, 2, 3, '前学期', '', None, ['cluster-basic-elecreq']),
    ('MTH303m', '確率統計', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('MTH303n', '確率統計', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('MTH303p', '確率統計', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('MTH303r', '確率統計', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('MTH304f', '複素関数論', 2, 2, 4, '後学期', '', None, ['cluster-basic-sel']),
    ('MTH304g', '複素関数論', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('MTH304h', '複素関数論', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('MTH304i', '離散数学', 2, 3, 5, '前学期', '', None, ['cluster-basic-elecreq']),
    ('MTH304j', '離散数学', 2, 3, 5, '前学期', '', None, ['cluster-basic-elecreq']),
    ('MTH401f', '応用数学B', 2, 3, 5, '前学期', '', None, ['cluster-basic-sel']),
    ('MTH401g', '応用数学B', 2, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('MTH401h', '応用数学B', 2, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('MTH401i', '応用数学B', 2, 3, 5, '前学期', '', None, ['cluster-basic-elecreq']),
    ('MTH401j', '応用数学B', 2, 3, 5, '前学期', '', None, ['cluster-basic-elecreq']),
    ('MTH401s', '応用幾何学', 2, 3, 5, '前学期', 'e', None, ['advanced']),
    ('MTH402f', '数理統計', 2, 3, 5, '前学期', '', None, ['major-sel']),
    ('MTH402g', '数理統計', 2, 2, 4, '後学期', '', None, ['major-elecreq']),
    ('MTH402h', '数理統計', 2, 2, 4, '後学期', '', None, ['major-elecreq']),
    ('MTH402i', '基礎演習B', 1, 3, 5, '前学期', '', None, ['cluster-basic-free']),
    ('MTH402j', '基礎演習B', 1, 3, 5, '前学期', '', None, ['cluster-basic-free']),
    ('MTH402s', '応用代数学', 2, 3, 5, '前学期', 'e', None, ['advanced']),
    ('MTH403i', '数理統計', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('MTH403j', '数理統計', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('MTH403t', '応用数学第二', 2, 2, 4, '後学期', 'e', None, ['prof-basic-req']),
    ('MTH404t', '確率統計', 2, 2, 4, '後学期', 'e', None, ['prof-basic-req']),
    ('MTH501f', '離散数学応用', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('MTH501g', '幾何学概論', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('MTH501h', '幾何学概論', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('MTH501i', '幾何学概論', 2, 3, 6, '後学期', '', None, ['major-free']),
    ('MTH501j', '幾何学概論', 2, 3, 6, '後学期', '', None, ['major-free']),
    ('MTH502f', '幾何学概論', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('MTH701g', '暗号と符号化の数理', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('MTHb01f', '数理統計学基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('MTHb02f', '現代代数学', 2, None, None, None, 'g', None, ['major-free']),
    ('MTHb03f', '数理解析学', 2, None, None, None, 'g', None, ['major-free']),
    ('PHO501n', '光工学実験第一', 3, 3, 6, '後学期', '', None, ['major-req']),
    ('PHO601m', '量子エレクトロニクス', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('PHO601n', '光工学実験第二', 3, 4, 7, '前学期', '', None, ['major-req']),
    ('PHO601p', '量子エレクトロニクス', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('PHO602n', '量子エレクトロニクス', 2, 4, 7, '前学期', '', None, ['major-req']),
    ('PHO603n', '光波工学', 2, 4, 7, '前学期', '', None, ['major-req']),
    ('PHO604n', '光通信工学', 2, 4, 7, '前学期', '', None, ['major-req']),
    ('PHOa01m', '光・量子エレクトロニクス基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('PHOa01n', '光・量子エレクトロニクス基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHOa01p', '光・量子エレクトロニクス基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHOa02m', '光デバイス工学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('PHOa02n', '光デバイス工学基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHOa02p', '光デバイス工学基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHY101t', '基礎物理学第一', 2, 1, 1, '前学期', 'e', None, ['math-basic-req']),
    ('PHY102z', '物理学概論第一', 2, 1, 1, '前学期', '', None, ['math-basic-req']),
    ('PHY103z', '物理学演習第一', 1, 1, 1, '前学期', '', None, ['math-basic-sel']),
    ('PHY201s', '基礎物理学実験', 1, 1, 2, '後学期', 'e', None, ['intro']),
    ('PHY202t', '基礎物理学第二', 2, 1, 2, '後学期', 'e', None, ['math-basic-req']),
    ('PHY202z', '物理学概論第二', 2, 1, 2, '後学期', '', None, ['math-basic-sel']),
    ('PHY203z', '物理学演習第二', 1, 1, 2, '後学期', '', None, ['math-basic-sel']),
    ('PHY204f', '力学', 2, 2, 3, '前学期', '', None, ['cluster-basic-req']),
    ('PHY204g', '力学', 2, 2, 3, '前学期', '', None, ['cluster-basic-req']),
    ('PHY204h', '力学', 2, 2, 3, '前学期', '', None, ['cluster-basic-req']),
    ('PHY204i', '力学', 2, 2, 3, '前学期', '', None, ['cluster-basic-req']),
    ('PHY204j', '力学', 2, 2, 3, '前学期', '', None, ['cluster-basic-req']),
    ('PHY204k', '力学', 2, 2, 3, '前学期', '', None, ['cluster-basic-req']),
    ('PHY204m', '力学', 2, 2, 3, '前学期', '', None, ['cluster-basic-req']),
    ('PHY204n', '力学', 2, 2, 3, '前学期', '', None, ['cluster-basic-req']),
    ('PHY204p', '力学', 2, 2, 3, '前学期', '', None, ['cluster-basic-req']),
    ('PHY204r', '力学', 2, 2, 3, '前学期', '', None, ['cluster-basic-req']),
    ('PHY205k', '力学演習', 1, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('PHY205m', '力学演習', 1, 2, 3, '前学期', '', None, ['cluster-basic-req']),
    ('PHY205n', '力学演習', 1, 2, 3, '前学期', '', None, ['cluster-basic-req']),
    ('PHY205p', '力学演習', 1, 2, 3, '前学期', '', None, ['cluster-basic-req']),
    ('PHY205r', '力学演習', 1, 2, 3, '前学期', '', None, ['cluster-basic-req']),
    ('PHY301f', '基礎電磁気学', 2, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('PHY301g', '基礎電磁気学', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('PHY301h', '基礎電磁気学', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('PHY301i', '基礎電磁気学', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('PHY301j', '基礎電磁気学', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('PHY301k', '熱力学', 2, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('PHY301m', '熱力学', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('PHY301n', '熱力学', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('PHY301p', '熱力学', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('PHY301r', '熱力学', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('PHY301t', '基礎物理学第三', 2, 2, 3, '前学期', 'e', None, ['math-basic-elec']),
    ('PHY302f', '波動と光', 2, 2, 4, '後学期', '', None, ['cluster-basic-sel']),
    ('PHY302g', '波動と光', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('PHY302h', '波動と光', 2, 2, 4, '後学期', '', None, ['cluster-basic-elecreq']),
    ('PHY302i', '力学演習', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('PHY302j', '力学演習', 2, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('PHY302k', '基礎電磁気学および演習', 3, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('PHY302m', '基礎電磁気学および演習', 3, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('PHY302n', '基礎電磁気学および演習', 3, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('PHY302p', '基礎電磁気学および演習', 3, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('PHY302r', '基礎電磁気学および演習', 3, 2, 4, '後学期', '', None, ['cluster-basic-req']),
    ('PHY302t', '電磁気学および演習', 3, 2, 3, '前学期', 'e', None, ['prof-basic-req']),
    ('PHY303f', '力学演習', 2, 3, 5, '前学期', '', None, ['cluster-basic-sel']),
    ('PHY303g', '力学演習', 2, 3, 5, '前学期', '', None, ['cluster-basic-free']),
    ('PHY303h', '力学演習', 2, 3, 5, '前学期', '', None, ['cluster-basic-free']),
    ('PHY303i', '波動と光', 2, 3, 5, '前学期', '', None, ['cluster-basic-elecreq']),
    ('PHY303j', '波動と光', 2, 3, 5, '前学期', '', None, ['cluster-basic-elecreq']),
    ('PHY401g', '電磁気学第一', 2, 2, 4, '後学期', '', None, ['major-req']),
    ('PHY401h', '電磁気学第一', 2, 2, 4, '後学期', '', None, ['major-elecreq']),
    ('PHY401k', '電磁気学および演習', 3, 3, 5, '前学期', '', None, ['cluster-basic-elecreq']),
    ('PHY401m', '電磁気学および演習', 3, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('PHY401n', '電磁気学および演習', 3, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('PHY401p', '電磁気学および演習', 3, 3, 5, '前学期', '', None, ['cluster-basic-req']),
    ('PHY401r', '電磁気学および演習', 3, 3, 5, '前学期', '', None, ['cluster-basic-elecreq']),
    ('PHY402m', '波動と光', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('PHY402n', '波動と光', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('PHY402p', '波動と光', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('PHY402r', '波動と光', 2, 3, 5, '前学期', '', None, ['major-elecreq']),
    ('PHY501g', '電磁気学第二', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('PHY501h', '電磁気学第二', 2, 3, 5, '前学期', '', None, ['major-elecreq']),
    ('PHY501m', '固体電子論', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('PHY501n', '固体電子論', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('PHY501p', '物理工学実験第一', 3, 3, 6, '後学期', '', None, ['major-req']),
    ('PHY502g', '量子と情報', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('PHY502h', '量子と情報', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('PHY502m', '量子力学第一', 2, 3, 5, '前学期', '', None, ['major-sel']),
    ('PHY502n', '基礎量子工学', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('PHY502p', '解析力学', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('PHY503m', '量子力学第一演習', 1, 3, 5, '前学期', '', None, ['major-sel']),
    ('PHY503p', '量子力学第一', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('PHY504m', '回折結晶学', 2, None, None, None, '', None, ['major-sel']),
    ('PHY504p', '量子力学第一演習', 1, 3, 5, '前学期', '', None, ['major-req']),
    ('PHY505p', '固体物理工学第一', 2, 3, 5, '前学期', '', None, ['major-req']),
    ('PHY506p', '回折結晶学', 2, None, None, None, '', None, ['major-elecreq']),
    ('PHY507p', '固体電子論', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('PHY601m', '半導体工学', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('PHY601n', '光電子材料学', 2, 4, 7, '前学期', '', None, ['major-req']),
    ('PHY601p', '物理工学実験第二', 3, 4, 7, '前学期', '', None, ['major-req']),
    ('PHY601t', '電磁波工学', 2, 3, 6, '後学期', 'e', None, ['major-req']),
    ('PHY602m', '電子デバイス', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('PHY602n', '熱・統計物理学基礎', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('PHY602p', '熱・統計物理学基礎', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('PHY603m', '光電子材料学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('PHY603n', '熱・統計物理学応用', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('PHY603p', '熱・統計物理学応用', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('PHY604m', '熱・統計物理学基礎', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('PHY604n', '半導体工学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('PHY604p', '固体物理工学第二', 2, 3, 6, '後学期', '', None, ['major-req']),
    ('PHY605m', '熱・統計物理学応用', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('PHY605n', '計算数理工学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('PHY605p', '量子力学第二', 2, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('PHY606m', '計算数理工学', 2, 3, 6, '後学期', '', None, ['major-sel']),
    ('PHY606p', '量子力学第二演習', 1, 3, 6, '後学期', '', None, ['major-elecreq']),
    ('PHY607p', '半導体工学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('PHY608p', '計算数理工学', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('PHY609p', '電子デバイス', 2, 4, 7, '前学期', '', None, ['major-sel']),
    ('PHYa01m', '量子物理工学基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('PHYa01n', '量子物理工学基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYa01p', '量子物理工学基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYa01r', '固体物性論基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYa02m', '固体物性論基礎', 2, 3, 6, '後学期', 'g', None, ['major-free']),
    ('PHYa02n', '固体物性論基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYa02p', '固体物性論基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYa03p', '固体量子工学', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYb01i', '力学系現象特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYb01j', '力学系現象特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYb01k', '力学系現象特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYb01m', '先端半導体デバイス基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYb01n', '先端半導体デバイス基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYb01p', '先端半導体デバイス基礎', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYb01r', 'X線結晶学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYb02i', 'ナノトライボロジー特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYb02j', 'ナノトライボロジー特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYb02k', 'ナノトライボロジー特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYb02n', '応用電磁気学', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYb02p', '応用電磁気学', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYb03p', '凝縮体量子工学特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('PHYb04p', 'ナノトライボロジー特論', 2, 4, 8, '後学期', 'g', None, ['major-free']),
    ('UEC301s', '総合コミュニケーション科学', 2, 1, 2, '後学期', 'e', None, ['datasci-req']),
    ('UEC302m', 'UECパスポートプログラムA', 2, 3, 5, '前学期', '', None, ['major-free']),
    ('UEC302n', 'UECパスポートプログラムA', 2, 3, 5, '前学期', '', None, ['major-free']),
    ('UEC302p', 'UECパスポートプログラムA', 2, 3, 5, '前学期', '', None, ['major-free']),
    ('UEC302r', 'UECパスポートプログラムA', 2, 3, 5, '前学期', '', None, ['major-free']),
    ('UEC501m', 'UECパスポートプログラムB', 2, 3, 6, '後学期', '', None, ['major-free']),
    ('UEC501n', 'UECパスポートプログラムB', 2, 3, 6, '後学期', '', None, ['major-free']),
    ('UEC501p', 'UECパスポートプログラムB', 2, 3, 6, '後学期', '', None, ['major-free']),
    ('UEC501r', 'UECパスポートプログラムB', 2, 3, 6, '後学期', '', None, ['major-free']),
    ('UEC501s', 'データサイエンス演習', 1, 2, 3, '前学期', 'e', None, ['datasci-ex']),
    ('UEC701m', 'UECパスポートプログラムC', 2, 4, 8, '後学期', '', None, ['major-free']),
    ('UEC701n', 'UECパスポートプログラムC', 2, 4, 8, '後学期', '', None, ['major-free']),
    ('UEC701p', 'UECパスポートプログラムC', 2, 4, 8, '後学期', '', None, ['major-free']),
    ('UEC701r', 'UECパスポートプログラムC', 2, 4, 8, '後学期', '', None, ['major-free']),
]
add2(II_III_EVENING_ROWS)

# ---- セキュリティ情報学プログラム（data/requirements/2025-day-II-security.json）
SECURITY_GROUPS = [{'id': 'specialized', 'name': '専門科目', 'label': '専門', 'required': 81, 'children': [{'id': 'math-basic', 'name': '理数基礎科目', 'required': 20, 'children': [{'id': 'math-basic-req', 'name': '必修', 'label': '理数基礎（必修）', 'required': 20, 'kind': 'required', 'subjects': ['MTH101z', 'MTH201z', 'MTH102z', 'MTH202z', 'MTH203z', 'MTH103z', 'MTH204z', 'PHY102z', 'PHY202z', 'CHM102z', 'COM201z']}, {'id': 'math-basic-sel', 'name': '選択', 'label': '理数基礎（選択）', 'required': 0, 'kind': 'elective', 'countAs': 'common', 'note': '修得した単位は共通単位とする', 'subjects': ['PHY103z', 'PHY203z', 'CHM203z']}]}, {'id': 'cluster-basic', 'name': '類共通基礎科目', 'required': 19, 'children': [{'id': 'cluster-basic-req', 'name': '必修', 'label': '類共通基礎（必修）', 'required': 17, 'kind': 'required', 'subjects': ['MTH301f', 'PHY204f', 'MTH302f', 'ELE301f', 'PHY301f', 'GSE301f', 'COM301f', 'COM401f'], 'note': '基礎演習Aの履修方法は注2参照（応用数学A・基礎電気回路・基礎電磁気学を同じクラスで履修）'}, {'id': 'cluster-basic-sel', 'name': '選択', 'label': '類共通基礎（選択）', 'required': 2, 'kind': 'elective', 'subjects': ['MTH303f', 'MTH304f', 'PHY302f', 'MTH401f']}, {'id': 'cluster-basic-free', 'name': '自由', 'label': '類共通基礎（自由科目）', 'required': 0, 'kind': 'free', 'countsTowardGraduation': False, 'note': '力学演習は類共通基礎科目の中でも自由科目区分（卒業要件に含まれない）', 'subjects': ['PHY303f']}]}, {'id': 'major', 'name': '類専門科目', 'required': 42, 'children': [{'id': 'major-req', 'name': '必修', 'label': '類専門（必修）', 'required': 12, 'kind': 'required', 'subjects': ['COM501f', 'COM601f', 'LAB701f', 'LAB801f', 'LAB702f', 'LAB802f']}, {'id': 'major-sel', 'name': '選択', 'label': '類専門（選択）', 'required': 30, 'kind': 'elective', 'note': '他プログラムの類専門科目選択も選択として算入可（実験科目を除く。付録C 注1）。このJSONのsubjectsには他プログラム分もあらかじめ展開済み', 'subjects': ['MTH402f', 'COM402f', 'ELE501f', 'MTH501f', 'COM502f', 'COM503f', 'COM504f', 'COM505f', 'COM602f', 'COM603f', 'COM604f', 'COM605f', 'COM606f', 'COM607f', 'COM506f', 'ELE601f', 'FGN101f', 'FGN201f', 'FGN102f', 'FGN202f', 'FGN301f', 'FGN401f', 'ELE608g', 'GSE601g', 'MTH701g', 'ELE701g', 'ELE702g', 'ELE505g', 'ELE801g', 'ELE001g', 'FGN101g', 'FGN201g', 'FGN102g', 'FGN202g', 'FGN301g', 'FGN401g', 'ELE604h', 'ELE605h', 'ELE606h', 'ELE607h', 'GSE601h', 'ELE701h', 'ELE702h', 'ELE703h', 'ELE505h', 'ELE801h', 'ELE001h', 'FGN101h', 'FGN201h', 'FGN102h', 'FGN202h', 'FGN301h', 'FGN401h', 'MTH403i', 'COM405i', 'MCE506i', 'MCE507i', 'MCE508i', 'MCE509i', 'MCE607i', 'MCE608i', 'MCE609i', 'MCE701i', 'MCE702i', 'FGN101i', 'FGN201i', 'FGN102i', 'FGN202i', 'FGN301i', 'FGN401i', 'MTH403j', 'COM405j', 'GSE401j', 'MCE508j', 'MCE509j', 'GSE501j', 'MCE607j', 'GSE601j', 'MCE608j', 'MCE609j', 'MCE701j', 'MCE702j', 'FGN101j', 'FGN201j', 'FGN102j', 'FGN202j', 'FGN301j', 'FGN401j']}, {'id': 'major-free', 'name': '自由科目', 'label': '自由科目', 'required': 0, 'kind': 'free', 'countsTowardGraduation': False, 'note': '大学院連携科目（大学院情報理工学研究科の授業科目）。卒業要件に含まれない。幾何学概論・マルチメディア処理も自由科目区分', 'subjects': ['MTH502f', 'COM507f', 'INSa01f', 'INSa02f', 'COMa01f', 'COMa02f', 'COMa03f', 'COMb01f', 'INSb01f', 'ELEb01f', 'MTHb01f', 'COMb02f', 'MTHb02f', 'MTHb03f', 'ELEa01f', 'LAB501f']}, {'id': 'major-intl', 'name': '国際科目', 'label': '国際科目', 'required': 0, 'kind': 'international', 'note': '単位の扱いは年度ごとの科目一覧表による', 'subjects': ['INT001f', 'INT002f', 'INT003f']}]}]}]
SECURITY = {
    'schemaVersion': 1, 'entryYear': 2025, 'course': 'day',
    'cluster': 'II', 'program': 'security',
    'programName': 'セキュリティ情報学プログラム', 'programSuffix': 'f',
    'source': '学修要覧2025（情報理工学域）別表2, 別表3, 別表3の2, 別表4, 付録C C.3.2①',
    'extends': '2025-day-common.json',
    'totalCredits': 133, 'commonCredits': 8,
    'subtotals': {'general': 27, 'practical': 17, 'specialized': 81, 'common': 8},
    'groups': SECURITY_GROUPS,
}

# ---- 情報通信工学プログラム（data/requirements/2025-day-II-netinfo.json）
NETINFO_GROUPS = [{'id': 'specialized', 'name': '専門科目', 'label': '専門', 'required': 88, 'children': [{'id': 'math-basic', 'name': '理数基礎科目', 'required': 20, 'children': [{'id': 'math-basic-req', 'name': '必修', 'label': '理数基礎（必修）', 'required': 20, 'kind': 'required', 'subjects': ['MTH101z', 'MTH201z', 'MTH102z', 'MTH202z', 'MTH203z', 'MTH103z', 'MTH204z', 'PHY102z', 'PHY202z', 'CHM102z', 'COM201z']}, {'id': 'math-basic-sel', 'name': '選択', 'label': '理数基礎（選択）', 'required': 0, 'kind': 'elective', 'countAs': 'common', 'note': '修得した単位は共通単位とする', 'subjects': ['PHY103z', 'PHY203z', 'CHM203z']}]}, {'id': 'cluster-basic', 'name': '類共通基礎科目', 'required': 24, 'children': [{'id': 'cluster-basic-req', 'name': '必修', 'label': '類共通基礎（必修）', 'required': 20, 'kind': 'required', 'subjects': ['MTH301g', 'PHY204g', 'MTH302g', 'MTH401g', 'ELE301g', 'PHY301g', 'GSE301g', 'GSE401g', 'COM301g', 'COM401g'], 'note': '基礎演習A履修時は応用数学A・基礎電気回路・基礎電磁気学、基礎演習B履修時は応用数学B・回路システム学第一も同じクラスで履修（注2）'}, {'id': 'cluster-basic-elecreq', 'name': '選択必修', 'label': '類共通基礎（選択必修）', 'required': 4, 'kind': 'elective-required', 'subjects': ['MTH303g', 'MTH304g', 'PHY302g']}, {'id': 'cluster-basic-free', 'name': '自由', 'label': '類共通基礎（自由科目）', 'required': 0, 'kind': 'free', 'countsTowardGraduation': False, 'subjects': ['PHY303g']}]}, {'id': 'major', 'name': '類専門科目', 'required': 44, 'children': [{'id': 'major-req', 'name': '必修', 'label': '類専門（必修）', 'required': 22, 'kind': 'required', 'subjects': ['PHY401g', 'PHY501g', 'ELE401g', 'ELE501g', 'ELE502g', 'ELE601g', 'ELE602g', 'LAB701g', 'LAB801g', 'LAB702g', 'LAB802g']}, {'id': 'major-elecreq', 'name': '選択必修', 'label': '類専門（選択必修）', 'required': 12, 'kind': 'elective-required', 'note': '計算機アーキテクチャーは計算機工学と重複履修不可（注3）', 'subjects': ['MTH402g', 'ELE402g', 'ELE403g', 'ELE404g', 'COM402g', 'ELE503g', 'ELE504g', 'COM501g', 'ELE603g', 'PHY502g']}, {'id': 'major-sel', 'name': '選択', 'label': '類専門（選択）', 'required': 10, 'kind': 'elective', 'note': '他プログラムの類専門科目選択も選択として算入可（実験科目を除く。付録C 注1）。このJSONのsubjectsには他プログラム分もあらかじめ展開済み', 'subjects': ['ELE608g', 'GSE601g', 'MTH701g', 'ELE701g', 'ELE702g', 'ELE505g', 'ELE801g', 'ELE001g', 'FGN101g', 'FGN201g', 'FGN102g', 'FGN202g', 'FGN301g', 'FGN401g', 'MTH402f', 'COM402f', 'ELE501f', 'MTH501f', 'COM502f', 'COM503f', 'COM504f', 'COM505f', 'COM602f', 'COM603f', 'COM604f', 'COM605f', 'COM606f', 'COM607f', 'COM506f', 'ELE601f', 'FGN101f', 'FGN201f', 'FGN102f', 'FGN202f', 'FGN301f', 'FGN401f', 'ELE604h', 'ELE605h', 'ELE606h', 'ELE607h', 'GSE601h', 'ELE701h', 'ELE702h', 'ELE703h', 'ELE505h', 'ELE801h', 'ELE001h', 'FGN101h', 'FGN201h', 'FGN102h', 'FGN202h', 'FGN301h', 'FGN401h', 'MTH403i', 'COM405i', 'MCE506i', 'MCE507i', 'MCE508i', 'MCE509i', 'MCE607i', 'MCE608i', 'MCE609i', 'MCE701i', 'MCE702i', 'FGN101i', 'FGN201i', 'FGN102i', 'FGN202i', 'FGN301i', 'FGN401i', 'MTH403j', 'COM405j', 'GSE401j', 'MCE508j', 'MCE509j', 'GSE501j', 'MCE607j', 'GSE601j', 'MCE608j', 'MCE609j', 'MCE701j', 'MCE702j', 'FGN101j', 'FGN201j', 'FGN102j', 'FGN202j', 'FGN301j', 'FGN401j']}, {'id': 'major-free', 'name': '自由科目', 'label': '自由科目', 'required': 0, 'kind': 'free', 'countsTowardGraduation': False, 'note': '大学院連携科目（大学院情報理工学研究科の授業科目）。卒業要件に含まれない。幾何学概論・マルチメディア処理も自由科目区分', 'subjects': ['MTH501g', 'COM507g', 'INSa01g', 'ELEa01g', 'ELEa02g', 'ELEa03g', 'ELEa04g', 'ELEa05g', 'ELEb01g', 'GSEb01g', 'ELEa06g', 'LAB501g']}, {'id': 'major-intl', 'name': '国際科目', 'label': '国際科目', 'required': 0, 'kind': 'international', 'note': '単位の扱いは年度ごとの科目一覧表による', 'subjects': ['INT001g', 'INT002g', 'INT003g', 'INT004g']}]}]}]
NETINFO = {
    'schemaVersion': 1, 'entryYear': 2025, 'course': 'day',
    'cluster': 'II', 'program': 'netinfo',
    'programName': '情報通信工学プログラム', 'programSuffix': 'g',
    'source': '学修要覧2025（情報理工学域）別表2, 別表3, 別表3の2, 別表4, 付録C C.3.2②',
    'extends': '2025-day-common.json',
    'totalCredits': 133, 'commonCredits': 1,
    'subtotals': {'general': 27, 'practical': 17, 'specialized': 88, 'common': 1},
    'groups': NETINFO_GROUPS,
}

# ---- 電子情報学プログラム（data/requirements/2025-day-II-electroinfo.json）
ELECTROINFO_GROUPS = [{'id': 'specialized', 'name': '専門科目', 'label': '専門', 'required': 88, 'children': [{'id': 'math-basic', 'name': '理数基礎科目', 'required': 20, 'children': [{'id': 'math-basic-req', 'name': '必修', 'label': '理数基礎（必修）', 'required': 20, 'kind': 'required', 'subjects': ['MTH101z', 'MTH201z', 'MTH102z', 'MTH202z', 'MTH203z', 'MTH103z', 'MTH204z', 'PHY102z', 'PHY202z', 'CHM102z', 'COM201z']}, {'id': 'math-basic-sel', 'name': '選択', 'label': '理数基礎（選択）', 'required': 0, 'kind': 'elective', 'countAs': 'common', 'note': '修得した単位は共通単位とする', 'subjects': ['PHY103z', 'PHY203z', 'CHM203z']}]}, {'id': 'cluster-basic', 'name': '類共通基礎科目', 'required': 24, 'children': [{'id': 'cluster-basic-req', 'name': '必修', 'label': '類共通基礎（必修）', 'required': 20, 'kind': 'required', 'subjects': ['MTH301h', 'PHY204h', 'MTH302h', 'MTH401h', 'ELE301h', 'PHY301h', 'GSE301h', 'GSE401h', 'COM301h', 'COM401h'], 'note': '基礎演習A履修時は応用数学A・基礎電気回路・基礎電磁気学、基礎演習B履修時は応用数学B・回路システム学第一も同じクラスで履修（注2）'}, {'id': 'cluster-basic-elecreq', 'name': '選択必修', 'label': '類共通基礎（選択必修）', 'required': 4, 'kind': 'elective-required', 'subjects': ['MTH303h', 'MTH304h', 'PHY302h']}, {'id': 'cluster-basic-free', 'name': '自由', 'label': '類共通基礎（自由科目）', 'required': 0, 'kind': 'free', 'countsTowardGraduation': False, 'subjects': ['PHY303h']}]}, {'id': 'major', 'name': '類専門科目', 'required': 44, 'children': [{'id': 'major-req', 'name': '必修', 'label': '類専門（必修）', 'required': 22, 'kind': 'required', 'subjects': ['ELE401h', 'ELE402h', 'ELE501h', 'ELE601h', 'ELE502h', 'ELE602h', 'ELE603h', 'LAB701h', 'LAB801h', 'LAB702h', 'LAB802h']}, {'id': 'major-elecreq', 'name': '選択必修', 'label': '類専門（選択必修）', 'required': 12, 'kind': 'elective-required', 'note': '計算機アーキテクチャーは計算機工学と重複履修不可（注3）', 'subjects': ['MTH402h', 'ELE403h', 'ELE404h', 'COM402h', 'PHY401h', 'PHY501h', 'ELE503h', 'ELE504h', 'PHY502h', 'COM501h']}, {'id': 'major-sel', 'name': '選択', 'label': '類専門（選択）', 'required': 10, 'kind': 'elective', 'note': '他プログラムの類専門科目選択も選択として算入可（実験科目を除く。付録C 注1）。このJSONのsubjectsには他プログラム分もあらかじめ展開済み', 'subjects': ['ELE604h', 'ELE605h', 'ELE606h', 'ELE607h', 'GSE601h', 'ELE701h', 'ELE702h', 'ELE703h', 'ELE505h', 'ELE801h', 'ELE001h', 'FGN101h', 'FGN201h', 'FGN102h', 'FGN202h', 'FGN301h', 'FGN401h', 'MTH402f', 'COM402f', 'ELE501f', 'MTH501f', 'COM502f', 'COM503f', 'COM504f', 'COM505f', 'COM602f', 'COM603f', 'COM604f', 'COM605f', 'COM606f', 'COM607f', 'COM506f', 'ELE601f', 'FGN101f', 'FGN201f', 'FGN102f', 'FGN202f', 'FGN301f', 'FGN401f', 'ELE608g', 'GSE601g', 'MTH701g', 'ELE701g', 'ELE702g', 'ELE505g', 'ELE801g', 'ELE001g', 'FGN101g', 'FGN201g', 'FGN102g', 'FGN202g', 'FGN301g', 'FGN401g', 'MTH403i', 'COM405i', 'MCE506i', 'MCE507i', 'MCE508i', 'MCE509i', 'MCE607i', 'MCE608i', 'MCE609i', 'MCE701i', 'MCE702i', 'FGN101i', 'FGN201i', 'FGN102i', 'FGN202i', 'FGN301i', 'FGN401i', 'MTH403j', 'COM405j', 'GSE401j', 'MCE508j', 'MCE509j', 'GSE501j', 'MCE607j', 'GSE601j', 'MCE608j', 'MCE609j', 'MCE701j', 'MCE702j', 'FGN101j', 'FGN201j', 'FGN102j', 'FGN202j', 'FGN301j', 'FGN401j']}, {'id': 'major-free', 'name': '自由科目', 'label': '自由科目', 'required': 0, 'kind': 'free', 'countsTowardGraduation': False, 'note': '大学院連携科目（大学院情報理工学研究科の授業科目）。卒業要件に含まれない。幾何学概論・マルチメディア処理も自由科目区分', 'subjects': ['MTH501h', 'COM507h', 'INSa01h', 'ELEa01h', 'ELEa02h', 'ELEa03h', 'ELEb01h', 'GSEb01h', 'GSEb02h', 'ELEa04h', 'LAB501h']}, {'id': 'major-intl', 'name': '国際科目', 'label': '国際科目', 'required': 0, 'kind': 'international', 'note': '単位の扱いは年度ごとの科目一覧表による', 'subjects': ['INT001h', 'INT002h', 'INT003h', 'INT004h']}]}]}]
ELECTROINFO = {
    'schemaVersion': 1, 'entryYear': 2025, 'course': 'day',
    'cluster': 'II', 'program': 'electroinfo',
    'programName': '電子情報学プログラム', 'programSuffix': 'h',
    'source': '学修要覧2025（情報理工学域）別表2, 別表3, 別表3の2, 別表4, 付録C C.3.2③',
    'extends': '2025-day-common.json',
    'totalCredits': 133, 'commonCredits': 1,
    'subtotals': {'general': 27, 'practical': 17, 'specialized': 88, 'common': 1},
    'groups': ELECTROINFO_GROUPS,
}

# ---- 計測・制御システムプログラム（data/requirements/2025-day-II-control.json）
CONTROL_GROUPS = [{'id': 'specialized', 'name': '専門科目', 'label': '専門', 'required': 86, 'children': [{'id': 'math-basic', 'name': '理数基礎科目', 'required': 20, 'children': [{'id': 'math-basic-req', 'name': '必修', 'label': '理数基礎（必修）', 'required': 20, 'kind': 'required', 'subjects': ['MTH101z', 'MTH201z', 'MTH102z', 'MTH202z', 'MTH203z', 'MTH103z', 'MTH204z', 'PHY102z', 'PHY202z', 'CHM102z', 'COM201z']}, {'id': 'math-basic-sel', 'name': '選択', 'label': '理数基礎（選択）', 'required': 0, 'kind': 'elective', 'countAs': 'common', 'note': '修得した単位は共通単位とする', 'subjects': ['PHY103z', 'PHY203z', 'CHM203z']}]}, {'id': 'cluster-basic', 'name': '類共通基礎科目', 'required': 15, 'children': [{'id': 'cluster-basic-req', 'name': '必修', 'label': '類共通基礎（必修）', 'required': 11, 'kind': 'required', 'subjects': ['MTH301i', 'PHY204i', 'ELE301i', 'PHY301i', 'PHY302i', 'GSE301i'], 'note': '基礎演習Aの履修方法は注2参照'}, {'id': 'cluster-basic-elecreq', 'name': '選択必修', 'label': '類共通基礎（選択必修）', 'required': 4, 'kind': 'elective-required', 'subjects': ['MTH302i', 'COM301i', 'MTH303i', 'MTH401i', 'MTH304i', 'PHY303i']}, {'id': 'cluster-basic-free', 'name': '自由', 'label': '類共通基礎（自由科目）', 'required': 0, 'kind': 'free', 'countsTowardGraduation': False, 'subjects': ['COM401i', 'MTH402i']}]}, {'id': 'major', 'name': '類専門科目', 'required': 51, 'children': [{'id': 'major-req', 'name': '必修', 'label': '類専門（必修）', 'required': 31, 'kind': 'required', 'subjects': ['MCE401i', 'MCE402i', 'MCE403i', 'MCE501i', 'MCE502i', 'MCE601i', 'MCE503i', 'MCE602i', 'MCE603i', 'GSE601i', 'LAB701i', 'LAB801i', 'LAB702i', 'LAB802i']}, {'id': 'major-elecreq', 'name': '選択必修', 'label': '類専門（選択必修）', 'required': 12, 'kind': 'elective-required', 'note': '計算機アーキテクチャーは計算機工学と重複履修不可（注3）', 'subjects': ['COM402i', 'COM403i', 'COM404i', 'GSE401i', 'GSE501i', 'MCE504i', 'MCE505i', 'MCE604i', 'ELE601i', 'MCE605i', 'MCE606i']}, {'id': 'major-sel', 'name': '選択', 'label': '類専門（選択）', 'required': 8, 'kind': 'elective', 'note': '他プログラムの類専門科目選択も選択として算入可（実験科目を除く。付録C 注1）。このJSONのsubjectsには他プログラム分もあらかじめ展開済み', 'subjects': ['MTH403i', 'COM405i', 'MCE506i', 'MCE507i', 'MCE508i', 'MCE509i', 'MCE607i', 'MCE608i', 'MCE609i', 'MCE701i', 'MCE702i', 'FGN101i', 'FGN201i', 'FGN102i', 'FGN202i', 'FGN301i', 'FGN401i', 'MTH402f', 'COM402f', 'ELE501f', 'MTH501f', 'COM502f', 'COM503f', 'COM504f', 'COM505f', 'COM602f', 'COM603f', 'COM604f', 'COM605f', 'COM606f', 'COM607f', 'COM506f', 'ELE601f', 'FGN101f', 'FGN201f', 'FGN102f', 'FGN202f', 'FGN301f', 'FGN401f', 'ELE608g', 'GSE601g', 'MTH701g', 'ELE701g', 'ELE702g', 'ELE505g', 'ELE801g', 'ELE001g', 'FGN101g', 'FGN201g', 'FGN102g', 'FGN202g', 'FGN301g', 'FGN401g', 'ELE604h', 'ELE605h', 'ELE606h', 'ELE607h', 'GSE601h', 'ELE701h', 'ELE702h', 'ELE703h', 'ELE505h', 'ELE801h', 'ELE001h', 'FGN101h', 'FGN201h', 'FGN102h', 'FGN202h', 'FGN301h', 'FGN401h', 'MTH403j', 'COM405j', 'GSE401j', 'MCE508j', 'MCE509j', 'GSE501j', 'MCE607j', 'GSE601j', 'MCE608j', 'MCE609j', 'MCE701j', 'MCE702j', 'FGN101j', 'FGN201j', 'FGN102j', 'FGN202j', 'FGN301j', 'FGN401j']}, {'id': 'major-free', 'name': '自由科目', 'label': '自由科目', 'required': 0, 'kind': 'free', 'countsTowardGraduation': False, 'note': '地学・生物学関連科目、幾何学概論、大学院連携科目など。卒業要件に含まれない', 'subjects': ['GEO201i', 'GEO501i', 'BIO201i', 'BIO501i', 'MTH501i', 'GSEa01i', 'MCEa01i', 'MCEa02i', 'MCEa03i', 'MCEa04i', 'MCEa05i', 'GSEa02i', 'MCEa06i', 'MCEa07i', 'GSEa03i', 'GSEa04i', 'MCEb01i', 'MCEb02i', 'MCEb03i', 'MCEb04i', 'MCEb05i', 'COMb01i', 'MCEb06i', 'MCEb07i', 'MCEb08i', 'COMb02i', 'PHYb01i', 'MCEb09i', 'PHYb02i', 'GSEb01i', 'MCEb10i', 'MCEb11i', 'MCEb12i', 'MCEb13i', 'ELEa01i', 'LAB501i']}, {'id': 'major-intl', 'name': '国際科目', 'label': '国際科目', 'required': 0, 'kind': 'international', 'note': '単位の扱いは年度ごとの科目一覧表による', 'subjects': ['INT001i', 'INT002i']}]}]}]
CONTROL = {
    'schemaVersion': 1, 'entryYear': 2025, 'course': 'day',
    'cluster': 'II', 'program': 'control',
    'programName': '計測・制御システムプログラム', 'programSuffix': 'i',
    'source': '学修要覧2025（情報理工学域）別表2, 別表3, 別表3の2, 別表4, 付録C C.3.2④',
    'extends': '2025-day-common.json',
    'totalCredits': 133, 'commonCredits': 4,
    'subtotals': {'general': 27, 'practical': 16, 'specialized': 86, 'common': 4},
    'commonOverrides': {'datasci-ex': {'required': 0, 'kind': 'elective', 'note': '計測・制御システム/先端ロボティクス・Ⅲ類は選択科目（required=0）。超過分は共通単位に繰り入れ（day-common.jsonの元の注記参照）'}},
    'groups': CONTROL_GROUPS,
}

# ---- 先端ロボティクスプログラム（data/requirements/2025-day-II-robotics.json）
ROBOTICS_GROUPS = [{'id': 'specialized', 'name': '専門科目', 'label': '専門', 'required': 85, 'children': [{'id': 'math-basic', 'name': '理数基礎科目', 'required': 20, 'children': [{'id': 'math-basic-req', 'name': '必修', 'label': '理数基礎（必修）', 'required': 20, 'kind': 'required', 'subjects': ['MTH101z', 'MTH201z', 'MTH102z', 'MTH202z', 'MTH203z', 'MTH103z', 'MTH204z', 'PHY102z', 'PHY202z', 'CHM102z', 'COM201z']}, {'id': 'math-basic-sel', 'name': '選択', 'label': '理数基礎（選択）', 'required': 0, 'kind': 'elective', 'countAs': 'common', 'note': '修得した単位は共通単位とする', 'subjects': ['PHY103z', 'PHY203z', 'CHM203z']}]}, {'id': 'cluster-basic', 'name': '類共通基礎科目', 'required': 15, 'children': [{'id': 'cluster-basic-req', 'name': '必修', 'label': '類共通基礎（必修）', 'required': 11, 'kind': 'required', 'subjects': ['MTH301j', 'PHY204j', 'ELE301j', 'PHY301j', 'PHY302j', 'GSE301j'], 'note': '基礎演習Aの履修方法は注2参照'}, {'id': 'cluster-basic-elecreq', 'name': '選択必修', 'label': '類共通基礎（選択必修）', 'required': 4, 'kind': 'elective-required', 'subjects': ['MTH302j', 'COM301j', 'MTH303j', 'MTH401j', 'MTH304j', 'PHY303j']}, {'id': 'cluster-basic-free', 'name': '自由', 'label': '類共通基礎（自由科目）', 'required': 0, 'kind': 'free', 'countsTowardGraduation': False, 'subjects': ['COM401j', 'MTH402j']}]}, {'id': 'major', 'name': '類専門科目', 'required': 50, 'children': [{'id': 'major-req', 'name': '必修', 'label': '類専門（必修）', 'required': 30, 'kind': 'required', 'subjects': ['MCE401j', 'MCE402j', 'MCE403j', 'MCE501j', 'MCE502j', 'MCE503j', 'MCE601j', 'MCE504j', 'MCE602j', 'MCE603j', 'LAB701j', 'LAB801j', 'LAB702j', 'LAB802j']}, {'id': 'major-elecreq', 'name': '選択必修', 'label': '類専門（選択必修）', 'required': 12, 'kind': 'elective-required', 'note': '計算機アーキテクチャーは計算機工学と重複履修不可（注3）', 'subjects': ['COM402j', 'COM403j', 'COM404j', 'MCE505j', 'MCE506j', 'MCE507j', 'MCE604j', 'ELE601j', 'MCE605j', 'MCE606j']}, {'id': 'major-sel', 'name': '選択', 'label': '類専門（選択）', 'required': 8, 'kind': 'elective', 'note': '他プログラムの類専門科目選択も選択として算入可（実験科目を除く。付録C 注1）。このJSONのsubjectsには他プログラム分もあらかじめ展開済み', 'subjects': ['MTH403j', 'COM405j', 'GSE401j', 'MCE508j', 'MCE509j', 'GSE501j', 'MCE607j', 'GSE601j', 'MCE608j', 'MCE609j', 'MCE701j', 'MCE702j', 'FGN101j', 'FGN201j', 'FGN102j', 'FGN202j', 'FGN301j', 'FGN401j', 'MTH402f', 'COM402f', 'ELE501f', 'MTH501f', 'COM502f', 'COM503f', 'COM504f', 'COM505f', 'COM602f', 'COM603f', 'COM604f', 'COM605f', 'COM606f', 'COM607f', 'COM506f', 'ELE601f', 'FGN101f', 'FGN201f', 'FGN102f', 'FGN202f', 'FGN301f', 'FGN401f', 'ELE608g', 'GSE601g', 'MTH701g', 'ELE701g', 'ELE702g', 'ELE505g', 'ELE801g', 'ELE001g', 'FGN101g', 'FGN201g', 'FGN102g', 'FGN202g', 'FGN301g', 'FGN401g', 'ELE604h', 'ELE605h', 'ELE606h', 'ELE607h', 'GSE601h', 'ELE701h', 'ELE702h', 'ELE703h', 'ELE505h', 'ELE801h', 'ELE001h', 'FGN101h', 'FGN201h', 'FGN102h', 'FGN202h', 'FGN301h', 'FGN401h', 'MTH403i', 'COM405i', 'MCE506i', 'MCE507i', 'MCE508i', 'MCE509i', 'MCE607i', 'MCE608i', 'MCE609i', 'MCE701i', 'MCE702i', 'FGN101i', 'FGN201i', 'FGN102i', 'FGN202i', 'FGN301i', 'FGN401i']}, {'id': 'major-free', 'name': '自由科目', 'label': '自由科目', 'required': 0, 'kind': 'free', 'countsTowardGraduation': False, 'note': '地学・生物学関連科目、幾何学概論、大学院連携科目など。卒業要件に含まれない', 'subjects': ['GEO201j', 'GEO501j', 'BIO201j', 'BIO501j', 'MTH501j', 'GSEa01j', 'MCEa01j', 'MCEa02j', 'MCEa03j', 'MCEa04j', 'MCEa05j', 'GSEa02j', 'MCEa06j', 'MCEa07j', 'GSEa03j', 'GSEa04j', 'MCEb01j', 'MCEb02j', 'MCEb03j', 'MCEb04j', 'MCEb05j', 'COMb01j', 'MCEb06j', 'MCEb07j', 'MCEb08j', 'COMb02j', 'PHYb01j', 'MCEb09j', 'PHYb02j', 'GSEb01j', 'MCEb10j', 'MCEb11j', 'MCEb12j', 'MCEb13j', 'ELEa01j', 'LAB501j']}, {'id': 'major-intl', 'name': '国際科目', 'label': '国際科目', 'required': 0, 'kind': 'international', 'note': '単位の扱いは年度ごとの科目一覧表による', 'subjects': ['INT001j', 'INT002j']}]}]}]
ROBOTICS = {
    'schemaVersion': 1, 'entryYear': 2025, 'course': 'day',
    'cluster': 'II', 'program': 'robotics',
    'programName': '先端ロボティクスプログラム', 'programSuffix': 'j',
    'source': '学修要覧2025（情報理工学域）別表2, 別表3, 別表3の2, 別表4, 付録C C.3.2⑤',
    'extends': '2025-day-common.json',
    'totalCredits': 133, 'commonCredits': 5,
    'subtotals': {'general': 27, 'practical': 16, 'specialized': 85, 'common': 5},
    'commonOverrides': {'datasci-ex': {'required': 0, 'kind': 'elective', 'note': '計測・制御システム/先端ロボティクス・Ⅲ類は選択科目（required=0）。超過分は共通単位に繰り入れ（day-common.jsonの元の注記参照）'}},
    'groups': ROBOTICS_GROUPS,
}

# ---- 機械システムプログラム（data/requirements/2025-day-III-mecha.json）
MECHA_GROUPS = [{'id': 'specialized', 'name': '専門科目', 'label': '専門', 'required': 86, 'children': [{'id': 'math-basic', 'name': '理数基礎科目', 'required': 20, 'children': [{'id': 'math-basic-req', 'name': '必修', 'label': '理数基礎（必修）', 'required': 20, 'kind': 'required', 'subjects': ['MTH101z', 'MTH201z', 'MTH102z', 'MTH202z', 'MTH203z', 'MTH103z', 'MTH204z', 'PHY102z', 'PHY202z', 'CHM102z', 'COM201z']}, {'id': 'math-basic-sel', 'name': '選択', 'label': '理数基礎（選択）', 'required': 0, 'kind': 'elective', 'countAs': 'common', 'note': '修得した単位は共通単位とする', 'subjects': ['PHY103z', 'PHY203z', 'CHM203z']}]}, {'id': 'cluster-basic', 'name': '類共通基礎科目', 'required': 22, 'children': [{'id': 'cluster-basic-req', 'name': '必修', 'label': '類共通基礎（必修）', 'required': 13, 'kind': 'required', 'subjects': ['PHY204k', 'PHY205k', 'MTH301k', 'PHY301k', 'PHY302k', 'ELE301k']}, {'id': 'cluster-basic-elecreq', 'name': '選択必修', 'label': '類共通基礎（選択必修）', 'required': 9, 'kind': 'elective-required', 'note': '夜間主コース学生が「分子生物学」の単位を修得した場合は専門基礎科目の選択科目とする', 'subjects': ['MTH302k', 'COM301k', 'MTH303k', 'GSE301k', 'PHY401k', 'ELE401k', 'COM401k', 'COM402k', 'BIO401k']}]}, {'id': 'major', 'name': '類専門科目', 'required': 44, 'children': [{'id': 'major-req', 'name': '必修', 'label': '類専門（必修）', 'required': 31, 'kind': 'required', 'subjects': ['MCE401k', 'MCE402k', 'MCE403k', 'MCE501k', 'MCE601k', 'MCE502k', 'MCE602k', 'MCE503k', 'MCE603k', 'MCE504k', 'LAB701k', 'LAB801k', 'LAB702k', 'LAB802k']}, {'id': 'major-elecreq', 'name': '選択必修', 'label': '類専門（選択必修）', 'required': 9, 'kind': 'elective-required', 'subjects': ['MCE505k', 'MCE604k', 'MCE506k', 'MCE507k']}, {'id': 'major-sel', 'name': '選択', 'label': '類専門（選択）', 'required': 4, 'kind': 'elective', 'note': '他プログラムの類専門科目選択も選択として算入可（実験科目を除く。付録C 注1）。このJSONのsubjectsには他プログラム分もあらかじめ展開済み', 'subjects': ['MCE605k', 'MCE606k', 'MCE508k', 'MCE509k', 'GSE501k', 'MCE607k', 'MCE608k', 'GSE601k', 'MCE609k', 'MCE701k', 'MCE702k', 'FGN101k', 'FGN201k', 'FGN102k', 'FGN202k', 'FGN301k', 'FGN401k', 'CHM401m', 'CHM402m', 'PHY502m', 'PHY503m', 'PHY603m', 'PHY604m', 'PHY605m', 'PHY606m', 'PHO601m', 'PHY504m', 'ELE603m', 'ELE604m', 'ELE605m', 'ELE701m', 'CHM701m', 'FGN101m', 'FGN201m', 'FGN102m', 'FGN202m', 'FGN301m', 'FGN401m', 'CHM401n', 'CHM402n', 'BIO501n', 'PHY602n', 'PHY603n', 'PHY604n', 'ELE602n', 'PHY605n', 'ELE603n', 'CHM601n', 'FGN101n', 'FGN201n', 'FGN102n', 'FGN202n', 'FGN301n', 'FGN401n', 'CHM401p', 'CHM402p', 'PHY507p', 'PHY607p', 'ELE601p', 'PHY608p', 'PHY609p', 'FGN101p', 'FGN201p', 'FGN102p', 'FGN202p', 'FGN301p', 'FGN401p', 'ELE601r', 'BIO603r', 'CHM701r', 'FGN101r', 'FGN201r', 'FGN102r', 'FGN202r', 'FGN301r', 'FGN401r']}, {'id': 'major-free', 'name': '自由科目', 'label': '自由科目', 'required': 0, 'kind': 'free', 'countsTowardGraduation': False, 'note': '地学・生物学関連科目、大学院連携科目など。卒業要件に含まれない', 'subjects': ['GEO201k', 'GEO501k', 'BIO501k', 'GSEa01k', 'MCEa01k', 'MCEa02k', 'MCEa03k', 'MCEa04k', 'MCEa05k', 'GSEa02k', 'MCEa06k', 'MCEa07k', 'GSEa03k', 'GSEa04k', 'GSEb01k', 'MCEb01k', 'MCEb02k', 'MCEb03k', 'MCEb04k', 'MCEb05k', 'MCEb06k', 'MCEb07k', 'MCEb08k', 'COMb01k', 'MCEb09k', 'MCEb10k', 'MCEb11k', 'COMb02k', 'PHYb01k', 'MCEb12k', 'PHYb02k', 'MCEb13k', 'LAB501k']}, {'id': 'major-intl', 'name': '国際科目', 'label': '国際科目', 'required': 0, 'kind': 'international', 'note': '単位の扱いは年度ごとの科目一覧表による', 'subjects': ['INT001k', 'INT002k']}]}]}]
MECHA = {
    'schemaVersion': 1, 'entryYear': 2025, 'course': 'day',
    'cluster': 'III', 'program': 'mecha',
    'programName': '機械システムプログラム', 'programSuffix': 'k',
    'source': '学修要覧2025（情報理工学域）別表2, 別表3, 別表3の2, 別表4, 付録C C.3.3①',
    'extends': '2025-day-common.json',
    'totalCredits': 133, 'commonCredits': 4,
    'subtotals': {'general': 27, 'practical': 16, 'specialized': 86, 'common': 4},
    'commonOverrides': {'datasci-ex': {'required': 0, 'kind': 'elective', 'note': '計測・制御システム/先端ロボティクス・Ⅲ類は選択科目（required=0）。超過分は共通単位に繰り入れ（day-common.jsonの元の注記参照）'}},
    'groups': MECHA_GROUPS,
}

# ---- 電子工学プログラム（data/requirements/2025-day-III-electro.json）
ELECTRO3_GROUPS = [{'id': 'specialized', 'name': '専門科目', 'label': '専門', 'required': 85, 'children': [{'id': 'math-basic', 'name': '理数基礎科目', 'required': 20, 'children': [{'id': 'math-basic-req', 'name': '必修', 'label': '理数基礎（必修）', 'required': 20, 'kind': 'required', 'subjects': ['MTH101z', 'MTH201z', 'MTH102z', 'MTH202z', 'MTH203z', 'MTH103z', 'MTH204z', 'PHY102z', 'PHY202z', 'CHM102z', 'COM201z']}, {'id': 'math-basic-sel', 'name': '選択', 'label': '理数基礎（選択）', 'required': 0, 'kind': 'elective', 'countAs': 'common', 'note': '修得した単位は共通単位とする', 'subjects': ['PHY103z', 'PHY203z', 'CHM203z']}]}, {'id': 'cluster-basic', 'name': '類共通基礎科目', 'required': 20, 'children': [{'id': 'cluster-basic-req', 'name': '必修', 'label': '類共通基礎（必修）', 'required': 18, 'kind': 'required', 'subjects': ['PHY204m', 'PHY205m', 'MTH301m', 'PHY301m', 'PHY302m', 'PHY401m', 'ELE301m', 'ELE401m']}, {'id': 'cluster-basic-elecreq', 'name': '選択必修', 'label': '類共通基礎（選択必修）', 'required': 2, 'kind': 'elective-required', 'note': '修得した単位は共通単位とする。夜間主コース学生が「分子生物学」の単位を修得した場合は専門基礎科目の選択科目とする', 'subjects': ['MTH302m', 'MTH303m', 'GSE301m', 'COM301m', 'COM401m', 'COM402m', 'BIO401m']}]}, {'id': 'major', 'name': '類専門科目', 'required': 45, 'children': [{'id': 'major-req', 'name': '必修', 'label': '類専門（必修）', 'required': 31, 'kind': 'required', 'subjects': ['ELE402m', 'PHY402m', 'ELE501m', 'ELE601m', 'ELE502m', 'ELE503m', 'PHY501m', 'ELE504m', 'PHY601m', 'ELE602m', 'PHY602m', 'LAB701m', 'LAB801m', 'LAB702m', 'LAB802m']}, {'id': 'major-sel', 'name': '選択', 'label': '類専門（選択）', 'required': 14, 'kind': 'elective', 'note': '他プログラムの類専門科目選択も選択として算入可（実験科目を除く。付録C 注1）。このJSONのsubjectsには他プログラム分もあらかじめ展開済み', 'subjects': ['CHM401m', 'CHM402m', 'PHY502m', 'PHY503m', 'PHY603m', 'PHY604m', 'PHY605m', 'PHY606m', 'PHO601m', 'PHY504m', 'ELE603m', 'ELE604m', 'ELE605m', 'ELE701m', 'CHM701m', 'FGN101m', 'FGN201m', 'FGN102m', 'FGN202m', 'FGN301m', 'FGN401m', 'MCE605k', 'MCE606k', 'MCE508k', 'MCE509k', 'GSE501k', 'MCE607k', 'MCE608k', 'GSE601k', 'MCE609k', 'MCE701k', 'MCE702k', 'FGN101k', 'FGN201k', 'FGN102k', 'FGN202k', 'FGN301k', 'FGN401k', 'CHM401n', 'CHM402n', 'BIO501n', 'PHY602n', 'PHY603n', 'PHY604n', 'ELE602n', 'PHY605n', 'ELE603n', 'CHM601n', 'FGN101n', 'FGN201n', 'FGN102n', 'FGN202n', 'FGN301n', 'FGN401n', 'CHM401p', 'CHM402p', 'PHY507p', 'PHY607p', 'ELE601p', 'PHY608p', 'PHY609p', 'FGN101p', 'FGN201p', 'FGN102p', 'FGN202p', 'FGN301p', 'FGN401p', 'ELE601r', 'BIO603r', 'CHM701r', 'FGN101r', 'FGN201r', 'FGN102r', 'FGN202r', 'FGN301r', 'FGN401r']}, {'id': 'major-free', 'name': '自由科目', 'label': '自由科目', 'required': 0, 'kind': 'free', 'countsTowardGraduation': False, 'note': '地学・生物学関連科目、UECパスポートプログラム、大学院連携科目など。卒業要件に含まれない', 'subjects': ['GEO201m', 'GEO501m', 'BIO501m', 'UEC302m', 'UEC501m', 'UEC701m', 'COM501m', 'PHOa01m', 'PHOa02m', 'PHYa01m', 'PHYa02m', 'BIOa01m', 'BIOa02m', 'ELEa01m', 'ELEa02m', 'PHYb01m', 'GSEb01m', 'LAB501m']}, {'id': 'major-intl', 'name': '国際科目', 'label': '国際科目', 'required': 0, 'kind': 'international', 'note': '単位の扱いは年度ごとの科目一覧表による', 'subjects': ['INT401m', 'INT001m', 'INT002m', 'INT003m']}]}]}]
ELECTRO3 = {
    'schemaVersion': 1, 'entryYear': 2025, 'course': 'day',
    'cluster': 'III', 'program': 'electro',
    'programName': '電子工学プログラム', 'programSuffix': 'm',
    'source': '学修要覧2025（情報理工学域）別表2, 別表3, 別表3の2, 別表4, 付録C C.3.3②',
    'extends': '2025-day-common.json',
    'totalCredits': 133, 'commonCredits': 5,
    'subtotals': {'general': 27, 'practical': 16, 'specialized': 85, 'common': 5},
    'commonOverrides': {'datasci-ex': {'required': 0, 'kind': 'elective', 'note': '計測・制御システム/先端ロボティクス・Ⅲ類は選択科目（required=0）。超過分は共通単位に繰り入れ（day-common.jsonの元の注記参照）'}},
    'groups': ELECTRO3_GROUPS,
}

# ---- 光工学プログラム（data/requirements/2025-day-III-optical.json）
OPTICAL_GROUPS = [{'id': 'specialized', 'name': '専門科目', 'label': '専門', 'required': 86, 'children': [{'id': 'math-basic', 'name': '理数基礎科目', 'required': 20, 'children': [{'id': 'math-basic-req', 'name': '必修', 'label': '理数基礎（必修）', 'required': 20, 'kind': 'required', 'subjects': ['MTH101z', 'MTH201z', 'MTH102z', 'MTH202z', 'MTH203z', 'MTH103z', 'MTH204z', 'PHY102z', 'PHY202z', 'CHM102z', 'COM201z']}, {'id': 'math-basic-sel', 'name': '選択', 'label': '理数基礎（選択）', 'required': 0, 'kind': 'elective', 'countAs': 'common', 'note': '修得した単位は共通単位とする', 'subjects': ['PHY103z', 'PHY203z', 'CHM203z']}]}, {'id': 'cluster-basic', 'name': '類共通基礎科目', 'required': 20, 'children': [{'id': 'cluster-basic-req', 'name': '必修', 'label': '類共通基礎（必修）', 'required': 18, 'kind': 'required', 'subjects': ['PHY204n', 'PHY205n', 'MTH301n', 'PHY301n', 'PHY302n', 'PHY401n', 'ELE301n', 'ELE401n']}, {'id': 'cluster-basic-elecreq', 'name': '選択必修', 'label': '類共通基礎（選択必修）', 'required': 2, 'kind': 'elective-required', 'note': '修得した単位は共通単位とする。夜間主コース学生が「分子生物学」の単位を修得した場合は専門基礎科目の選択科目とする', 'subjects': ['MTH302n', 'MTH303n', 'GSE301n', 'COM301n', 'COM401n', 'COM402n', 'BIO401n']}]}, {'id': 'major', 'name': '類専門科目', 'required': 46, 'children': [{'id': 'major-req', 'name': '必修', 'label': '類専門（必修）', 'required': 34, 'kind': 'required', 'subjects': ['ELE402n', 'PHY402n', 'PHO501n', 'PHO601n', 'PHY501n', 'PHY502n', 'ELE501n', 'PHY601n', 'PHO602n', 'PHO603n', 'ELE601n', 'PHO604n', 'LAB701n', 'LAB801n', 'LAB702n', 'LAB802n']}, {'id': 'major-sel', 'name': '選択', 'label': '類専門（選択）', 'required': 12, 'kind': 'elective', 'note': '他プログラムの類専門科目選択も選択として算入可（実験科目を除く。付録C 注1）。このJSONのsubjectsには他プログラム分もあらかじめ展開済み', 'subjects': ['CHM401n', 'CHM402n', 'BIO501n', 'PHY602n', 'PHY603n', 'PHY604n', 'ELE602n', 'PHY605n', 'ELE603n', 'CHM601n', 'FGN101n', 'FGN201n', 'FGN102n', 'FGN202n', 'FGN301n', 'FGN401n', 'MCE605k', 'MCE606k', 'MCE508k', 'MCE509k', 'GSE501k', 'MCE607k', 'MCE608k', 'GSE601k', 'MCE609k', 'MCE701k', 'MCE702k', 'FGN101k', 'FGN201k', 'FGN102k', 'FGN202k', 'FGN301k', 'FGN401k', 'CHM401m', 'CHM402m', 'PHY502m', 'PHY503m', 'PHY603m', 'PHY604m', 'PHY605m', 'PHY606m', 'PHO601m', 'PHY504m', 'ELE603m', 'ELE604m', 'ELE605m', 'ELE701m', 'CHM701m', 'FGN101m', 'FGN201m', 'FGN102m', 'FGN202m', 'FGN301m', 'FGN401m', 'CHM401p', 'CHM402p', 'PHY507p', 'PHY607p', 'ELE601p', 'PHY608p', 'PHY609p', 'FGN101p', 'FGN201p', 'FGN102p', 'FGN202p', 'FGN301p', 'FGN401p', 'ELE601r', 'BIO603r', 'CHM701r', 'FGN101r', 'FGN201r', 'FGN102r', 'FGN202r', 'FGN301r', 'FGN401r']}, {'id': 'major-free', 'name': '自由科目', 'label': '自由科目', 'required': 0, 'kind': 'free', 'countsTowardGraduation': False, 'note': '地学・生物学関連科目、UECパスポートプログラム、大学院連携科目など。卒業要件に含まれない', 'subjects': ['GEO201n', 'GEO501n', 'BIO502n', 'UEC302n', 'UEC501n', 'UEC701n', 'COM501n', 'PHOa01n', 'PHOa02n', 'PHYa01n', 'PHYa02n', 'ELEa01n', 'ELEa02n', 'CHMa01n', 'PHYb01n', 'PHYb02n', 'LAB501n']}, {'id': 'major-intl', 'name': '国際科目', 'label': '国際科目', 'required': 0, 'kind': 'international', 'note': '単位の扱いは年度ごとの科目一覧表による', 'subjects': ['INT401n', 'INT001n', 'INT002n', 'INT003n']}]}]}]
OPTICAL = {
    'schemaVersion': 1, 'entryYear': 2025, 'course': 'day',
    'cluster': 'III', 'program': 'optical',
    'programName': '光工学プログラム', 'programSuffix': 'n',
    'source': '学修要覧2025（情報理工学域）別表2, 別表3, 別表3の2, 別表4, 付録C C.3.3③',
    'extends': '2025-day-common.json',
    'totalCredits': 133, 'commonCredits': 4,
    'subtotals': {'general': 27, 'practical': 16, 'specialized': 86, 'common': 4},
    'commonOverrides': {'datasci-ex': {'required': 0, 'kind': 'elective', 'note': '計測・制御システム/先端ロボティクス・Ⅲ類は選択科目（required=0）。超過分は共通単位に繰り入れ（day-common.jsonの元の注記参照）'}},
    'groups': OPTICAL_GROUPS,
}

# ---- 物理工学プログラム（data/requirements/2025-day-III-physics.json）
PHYSICS3_GROUPS = [{'id': 'specialized', 'name': '専門科目', 'label': '専門', 'required': 84, 'children': [{'id': 'math-basic', 'name': '理数基礎科目', 'required': 20, 'children': [{'id': 'math-basic-req', 'name': '必修', 'label': '理数基礎（必修）', 'required': 20, 'kind': 'required', 'subjects': ['MTH101z', 'MTH201z', 'MTH102z', 'MTH202z', 'MTH203z', 'MTH103z', 'MTH204z', 'PHY102z', 'PHY202z', 'CHM102z', 'COM201z']}, {'id': 'math-basic-sel', 'name': '選択', 'label': '理数基礎（選択）', 'required': 0, 'kind': 'elective', 'countAs': 'common', 'note': '修得した単位は共通単位とする', 'subjects': ['PHY103z', 'PHY203z', 'CHM203z']}]}, {'id': 'cluster-basic', 'name': '類共通基礎科目', 'required': 26, 'children': [{'id': 'cluster-basic-req', 'name': '必修', 'label': '類共通基礎（必修）', 'required': 20, 'kind': 'required', 'subjects': ['PHY204p', 'PHY205p', 'MTH301p', 'PHY301p', 'PHY302p', 'PHY401p', 'ELE301p', 'ELE401p', 'COM401p']}, {'id': 'cluster-basic-elecreq', 'name': '選択必修', 'label': '類共通基礎（選択必修）', 'required': 4, 'kind': 'elective-required', 'subjects': ['MTH302p', 'MTH303p', 'GSE301p', 'COM301p']}, {'id': 'cluster-basic-sel', 'name': '選択', 'label': '類共通基礎（選択）', 'required': 2, 'kind': 'elective', 'note': '修得した単位は共通単位とする。夜間主コース学生が「分子生物学」の単位を修得した場合は専門基礎科目の選択科目とする', 'subjects': ['COM402p', 'BIO401p']}]}, {'id': 'major', 'name': '類専門科目', 'required': 38, 'children': [{'id': 'major-req', 'name': '必修', 'label': '類専門（必修）', 'required': 31, 'kind': 'required', 'subjects': ['ELE402p', 'PHY402p', 'PHY501p', 'PHY601p', 'PHY502p', 'PHY503p', 'PHY504p', 'PHY602p', 'PHY603p', 'PHY505p', 'PHY604p', 'LAB701p', 'LAB801p', 'LAB702p', 'LAB802p']}, {'id': 'major-elecreq', 'name': '選択必修', 'label': '類専門（選択必修）', 'required': 5, 'kind': 'elective-required', 'subjects': ['PHY605p', 'PHY606p', 'PHO601p', 'PHY506p']}, {'id': 'major-sel', 'name': '選択', 'label': '類専門（選択）', 'required': 2, 'kind': 'elective', 'note': '他プログラムの類専門科目選択も選択として算入可（実験科目を除く。付録C 注1）。このJSONのsubjectsには他プログラム分もあらかじめ展開済み', 'subjects': ['CHM401p', 'CHM402p', 'PHY507p', 'PHY607p', 'ELE601p', 'PHY608p', 'PHY609p', 'FGN101p', 'FGN201p', 'FGN102p', 'FGN202p', 'FGN301p', 'FGN401p', 'MCE605k', 'MCE606k', 'MCE508k', 'MCE509k', 'GSE501k', 'MCE607k', 'MCE608k', 'GSE601k', 'MCE609k', 'MCE701k', 'MCE702k', 'FGN101k', 'FGN201k', 'FGN102k', 'FGN202k', 'FGN301k', 'FGN401k', 'CHM401m', 'CHM402m', 'PHY502m', 'PHY503m', 'PHY603m', 'PHY604m', 'PHY605m', 'PHY606m', 'PHO601m', 'PHY504m', 'ELE603m', 'ELE604m', 'ELE605m', 'ELE701m', 'CHM701m', 'FGN101m', 'FGN201m', 'FGN102m', 'FGN202m', 'FGN301m', 'FGN401m', 'CHM401n', 'CHM402n', 'BIO501n', 'PHY602n', 'PHY603n', 'PHY604n', 'ELE602n', 'PHY605n', 'ELE603n', 'CHM601n', 'FGN101n', 'FGN201n', 'FGN102n', 'FGN202n', 'FGN301n', 'FGN401n', 'ELE601r', 'BIO603r', 'CHM701r', 'FGN101r', 'FGN201r', 'FGN102r', 'FGN202r', 'FGN301r', 'FGN401r']}, {'id': 'major-free', 'name': '自由科目', 'label': '自由科目', 'required': 0, 'kind': 'free', 'countsTowardGraduation': False, 'note': '地学・生物学関連科目、UECパスポートプログラム、大学院連携科目など。卒業要件に含まれない', 'subjects': ['GEO201p', 'GEO501p', 'BIO501p', 'UEC302p', 'UEC501p', 'UEC701p', 'COM501p', 'PHOa01p', 'PHOa02p', 'PHYa01p', 'PHYa02p', 'ELEa01p', 'PHYa03p', 'PHYb01p', 'PHYb02p', 'PHYb03p', 'PHYb04p', 'LAB501p']}, {'id': 'major-intl', 'name': '国際科目', 'label': '国際科目', 'required': 0, 'kind': 'international', 'note': '単位の扱いは年度ごとの科目一覧表による', 'subjects': ['INT401p', 'INT001p', 'INT002p', 'INT003p']}]}]}]
PHYSICS3 = {
    'schemaVersion': 1, 'entryYear': 2025, 'course': 'day',
    'cluster': 'III', 'program': 'physics',
    'programName': '物理工学プログラム', 'programSuffix': 'p',
    'source': '学修要覧2025（情報理工学域）別表2, 別表3, 別表3の2, 別表4, 付録C C.3.3④',
    'extends': '2025-day-common.json',
    'totalCredits': 133, 'commonCredits': 6,
    'subtotals': {'general': 27, 'practical': 16, 'specialized': 84, 'common': 6},
    'commonOverrides': {'datasci-ex': {'required': 0, 'kind': 'elective', 'note': '計測・制御システム/先端ロボティクス・Ⅲ類は選択科目（required=0）。超過分は共通単位に繰り入れ（day-common.jsonの元の注記参照）'}},
    'groups': PHYSICS3_GROUPS,
}

# ---- 化学生命工学プログラム（data/requirements/2025-day-III-chembio.json）
CHEMBIO_GROUPS = [{'id': 'specialized', 'name': '専門科目', 'label': '専門', 'required': 85, 'children': [{'id': 'math-basic', 'name': '理数基礎科目', 'required': 20, 'children': [{'id': 'math-basic-req', 'name': '必修', 'label': '理数基礎（必修）', 'required': 20, 'kind': 'required', 'subjects': ['MTH101z', 'MTH201z', 'MTH102z', 'MTH202z', 'MTH203z', 'MTH103z', 'MTH204z', 'PHY102z', 'PHY202z', 'CHM102z', 'COM201z']}, {'id': 'math-basic-sel', 'name': '選択', 'label': '理数基礎（選択）', 'required': 0, 'kind': 'elective', 'countAs': 'common', 'note': '修得した単位は共通単位とする', 'subjects': ['PHY103z', 'PHY203z', 'CHM203z']}]}, {'id': 'cluster-basic', 'name': '類共通基礎科目', 'required': 23, 'children': [{'id': 'cluster-basic-req', 'name': '必修', 'label': '類共通基礎（必修）', 'required': 15, 'kind': 'required', 'subjects': ['PHY204r', 'PHY205r', 'MTH301r', 'PHY301r', 'PHY302r', 'ELE301r', 'BIO401r']}, {'id': 'cluster-basic-elecreq', 'name': '選択必修', 'label': '類共通基礎（選択必修）', 'required': 6, 'kind': 'elective-required', 'subjects': ['MTH302r', 'MTH303r', 'GSE301r', 'COM301r', 'PHY401r', 'ELE401r', 'COM401r']}, {'id': 'cluster-basic-sel', 'name': '選択', 'label': '類共通基礎（選択）', 'required': 2, 'kind': 'elective', 'note': '修得した単位は共通単位とする', 'subjects': ['COM402r']}]}, {'id': 'major', 'name': '類専門科目', 'required': 42, 'children': [{'id': 'major-req', 'name': '必修', 'label': '類専門（必修）', 'required': 32, 'kind': 'required', 'subjects': ['CHM401r', 'CHM402r', 'ELE402r', 'BCH501r', 'BCH601r', 'BCH502r', 'BCH602r', 'CHM501r', 'CHM502r', 'BIO501r', 'BIO502r', 'BIO601r', 'LAB701r', 'LAB801r', 'LAB702r', 'LAB802r']}, {'id': 'major-elecreq', 'name': '選択必修', 'label': '類専門（選択必修）', 'required': 8, 'kind': 'elective-required', 'subjects': ['PHY402r', 'CHM503r', 'BIO503r', 'CHM601r', 'CHM602r', 'CHM603r', 'BIO602r']}, {'id': 'major-sel', 'name': '選択', 'label': '類専門（選択）', 'required': 2, 'kind': 'elective', 'note': '他プログラムの類専門科目選択も選択として算入可（実験科目を除く。付録C 注1）。このJSONのsubjectsには他プログラム分もあらかじめ展開済み', 'subjects': ['ELE601r', 'BIO603r', 'CHM701r', 'FGN101r', 'FGN201r', 'FGN102r', 'FGN202r', 'FGN301r', 'FGN401r', 'MCE605k', 'MCE606k', 'MCE508k', 'MCE509k', 'GSE501k', 'MCE607k', 'MCE608k', 'GSE601k', 'MCE609k', 'MCE701k', 'MCE702k', 'FGN101k', 'FGN201k', 'FGN102k', 'FGN202k', 'FGN301k', 'FGN401k', 'CHM401m', 'CHM402m', 'PHY502m', 'PHY503m', 'PHY603m', 'PHY604m', 'PHY605m', 'PHY606m', 'PHO601m', 'PHY504m', 'ELE603m', 'ELE604m', 'ELE605m', 'ELE701m', 'CHM701m', 'FGN101m', 'FGN201m', 'FGN102m', 'FGN202m', 'FGN301m', 'FGN401m', 'CHM401n', 'CHM402n', 'BIO501n', 'PHY602n', 'PHY603n', 'PHY604n', 'ELE602n', 'PHY605n', 'ELE603n', 'CHM601n', 'FGN101n', 'FGN201n', 'FGN102n', 'FGN202n', 'FGN301n', 'FGN401n', 'CHM401p', 'CHM402p', 'PHY507p', 'PHY607p', 'ELE601p', 'PHY608p', 'PHY609p', 'FGN101p', 'FGN201p', 'FGN102p', 'FGN202p', 'FGN301p', 'FGN401p']}, {'id': 'major-free', 'name': '自由科目', 'label': '自由科目', 'required': 0, 'kind': 'free', 'countsTowardGraduation': False, 'note': '地学・生物学関連科目、UECパスポートプログラム、大学院連携科目など。卒業要件に含まれない', 'subjects': ['GEO201r', 'GEO501r', 'BIO504r', 'UEC302r', 'UEC501r', 'UEC701r', 'COM501r', 'PHYa01r', 'CHMa01r', 'BCHa01r', 'BIOa01r', 'BIOa02r', 'GSEb01r', 'BIOb01r', 'PHYb01r', 'CHMb01r', 'BCHa02r', 'BCHa03r', 'CHMb02r', 'CHMb03r', 'BIOb02r', 'LAB501r']}, {'id': 'major-intl', 'name': '国際科目', 'label': '国際科目', 'required': 0, 'kind': 'international', 'note': '単位の扱いは年度ごとの科目一覧表による', 'subjects': ['INT401r', 'INT001r', 'INT002r', 'INT003r']}]}]}]
CHEMBIO = {
    'schemaVersion': 1, 'entryYear': 2025, 'course': 'day',
    'cluster': 'III', 'program': 'chembio',
    'programName': '化学生命工学プログラム', 'programSuffix': 'r',
    'source': '学修要覧2025（情報理工学域）別表2, 別表3, 別表3の2, 別表4, 付録C C.3.3⑤',
    'extends': '2025-day-common.json',
    'totalCredits': 133, 'commonCredits': 5,
    'subtotals': {'general': 27, 'practical': 16, 'specialized': 85, 'common': 5},
    'commonOverrides': {'datasci-ex': {'required': 0, 'kind': 'elective', 'note': '計測・制御システム/先端ロボティクス・Ⅲ類は選択科目（required=0）。超過分は共通単位に繰り入れ（day-common.jsonの元の注記参照）'}},
    'groups': CHEMBIO_GROUPS,
}

# ---- 先端工学基礎課程（夜間主コース）（data/requirements/2025-evening.json）
EVENING_GROUPS = [{'id': 'general', 'name': '総合文化科目', 'label': '総合文化', 'required': 24, 'children': [{'id': 'hss', 'name': '人文・社会科学科目', 'label': '人文・社会', 'required': 8, 'kind': 'elective-required', 'note': '8単位を修得すること', 'subjects': ['HSS201s', 'HSS202s', 'HSS203s', 'HSS101s', 'HSS204s', 'HSS205s', 'HSS102s', 'HSS103s', 'HSS104s', 'HSS105s', 'HSS106s']}, {'id': 'advanced', 'name': '上級科目', 'label': '上級科目', 'required': 4, 'kind': 'elective-required', 'note': '4単位を修得すること', 'subjects': ['HSS501s', 'HSS502s', 'HSS503s', 'HSS701s', 'MTH401s', 'MTH402s']}, {'id': 'language', 'name': '言語文化科目', 'label': '言語文化', 'required': 8, 'kind': 'required', 'note': '8単位必修', 'subjects': ['ENG101s', 'ENG201s', 'ENG102s', 'ENG202s', 'ENG301s', 'ENG401s', 'ENG501s', 'ENG601s']}, {'id': 'health', 'name': '健康科学科目', 'label': '健康科学', 'required': 2, 'kind': 'required', 'note': '2単位必修', 'subjects': ['HSP101s']}, {'id': 'sci-liberal', 'name': '理工系教養科目', 'label': '理工系教養', 'required': 2, 'kind': 'elective-required', 'note': '2単位を修得すること', 'subjects': ['GSC301s']}]}, {'id': 'practical', 'name': '実践教育科目', 'label': '実践教育', 'required': 14, 'children': [{'id': 'intro', 'name': '初年次導入科目', 'label': '初年次導入', 'required': 6, 'kind': 'required', 'note': '6単位必修', 'subjects': ['MTH101s', 'COM101s', 'PHY201s', 'CHM201s']}, {'id': 'datasci', 'name': 'データサイエンス科目', 'label': 'データサイエンス', 'required': 2, 'subjects': [], 'children': [{'id': 'datasci-req', 'name': '必修', 'label': '総合コミュニケーション科学', 'required': 2, 'kind': 'required', 'subjects': ['UEC301s']}, {'id': 'datasci-ex', 'name': 'データサイエンス演習', 'label': 'DS演習', 'required': 0, 'kind': 'elective', 'note': '総合コミュニケーション科学のみで2単位を満たすため選択（超過分は共通単位）', 'subjects': ['UEC501s']}]}, {'id': 'sangaku', 'name': '産学連携教育科目', 'label': '産学連携', 'required': 4, 'kind': 'required', 'note': '4単位必修', 'subjects': ['CAR501s', 'CAR601s']}, {'id': 'gijutsu', 'name': '技術者教養科目', 'label': '技術者教養', 'required': 2, 'kind': 'elective-required', 'note': '2単位を修得すること', 'subjects': ['CAR701s', 'CAR801s']}]}, {'id': 'specialized', 'name': '専門科目', 'label': '専門', 'required': 80, 'children': [{'id': 'math-basic', 'name': '理数基礎科目', 'required': 18, 'children': [{'id': 'math-basic-req', 'name': '必修', 'label': '理数基礎（必修）', 'required': 14, 'kind': 'required', 'note': '14単位必修', 'subjects': ['MTH102t', 'MTH201t', 'MTH103t', 'MTH202t', 'PHY101t', 'PHY202t', 'COM201t']}, {'id': 'math-basic-elec', 'name': '選択', 'label': '理数基礎（選択）', 'required': 4, 'kind': 'elective-required', 'note': '4単位を修得すること', 'subjects': ['CHM101t', 'MTH301t', 'PHY301t']}]}, {'id': 'prof-basic', 'name': '専門基礎科目', 'required': 32, 'children': [{'id': 'prof-basic-req', 'name': '必修', 'label': '専門基礎（必修）', 'required': 22, 'kind': 'required', 'note': '22単位必修', 'subjects': ['MTH203t', 'MTH302t', 'MTH403t', 'MTH404t', 'COM301t', 'COM302t', 'PHY302t', 'ELE401t', 'ELE402t', 'ELE501t', 'COM501t']}, {'id': 'prof-basic-elec', 'name': '選択', 'label': '専門基礎（選択）', 'required': 10, 'kind': 'elective-required', 'note': '10単位を修得すること', 'subjects': ['COM502t', 'COM401t', 'MCE501t', 'MCE502t', 'ELE502t', 'ELE503t']}]}, {'id': 'major', 'name': '専門科目（類専門相当）', 'required': 30, 'children': [{'id': 'major-req', 'name': '必修', 'label': '専門（必修）', 'required': 12, 'kind': 'required', 'note': '12単位必修', 'subjects': ['COM601t', 'COM602t', 'PHY601t', 'ELE601t', 'COM603t', 'MCE601t', 'LAB701t', 'LAB801t']}, {'id': 'major-sel', 'name': '選択', 'label': '専門（選択）', 'required': 18, 'kind': 'elective', 'note': '18単位を修得すること。卒業研究A・Bも学修要覧上は選択科目として記載されている（◎ではなく○）', 'subjects': ['INS701t', 'INS801t', 'COM701t', 'COM801t', 'ELE701t', 'MCE701t', 'MCE801t', 'MCE802t', 'GSE701t', 'LAB702t', 'LAB802t']}]}]}]
EVENING = {
    'schemaVersion': 1, 'entryYear': 2025, 'course': 'evening',
    'cluster': None, 'program': 'evening',
    'programName': '先端工学基礎課程（夜間主コース）', 'programSuffix': 't',
    'source': '学修要覧2025（情報理工学域）別表2, 付録C C.5, C.6',
    'note': '夜間主コースは類・プログラムの区分がなく単一課程（docs/SPEC.md §3）。総合文化・実践教育・専門科目とも昼間コースとは別の科目区分・科目コード体系（総合文化/実践教育は\'s\'サフィックス、専門は\'t\'サフィックス）のため、day-common.jsonをextendsせずこのファイル単独で完結させている。国際科目（付録C C.4、夜間主は3・4年次のみ履修可・上級科目扱い）の組み込みは今回未対応（要フォローアップ）',
    'totalCredits': 124, 'commonCredits': 6,
    'subtotals': {'general': 24, 'practical': 14, 'specialized': 80, 'common': 6},
    'groups': EVENING_GROUPS,
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
dump("requirements/2025-day-I-management.json", management)
dump("requirements/2025-day-I-mathinfo.json", mathinfo)
dump("requirements/2025-day-I-cs.json", cs)
dump("requirements/2025-day-I-designds.json", designds)
dump("requirements/2025-day-II-security.json", SECURITY)
dump("requirements/2025-day-II-netinfo.json", NETINFO)
dump("requirements/2025-day-II-electroinfo.json", ELECTROINFO)
dump("requirements/2025-day-II-control.json", CONTROL)
dump("requirements/2025-day-II-robotics.json", ROBOTICS)
dump("requirements/2025-day-III-mecha.json", MECHA)
dump("requirements/2025-day-III-electro.json", ELECTRO3)
dump("requirements/2025-day-III-optical.json", OPTICAL)
dump("requirements/2025-day-III-physics.json", PHYSICS3)
dump("requirements/2025-day-III-chembio.json", CHEMBIO)
dump("requirements/2025-evening.json", EVENING)
dump("subjects/youran-2025.json", {
    "schemaVersion": 1,
    "source": "学修要覧2025（情報理工学域）付録C。昼間コース共通科目＋Ⅰ・Ⅱ・Ⅲ類15プログラム＋夜間主収録",
    "note": "曜日時限・担当・シラバスURLはシラバスから別途取得して offerings に入れる（scripts/fetch_syllabus.py 予定）。"
            "主キーは末尾記号を含むフルコード（例 COM405a）。同じ番号でもプログラムが違えば別科目のことがあるため、名寄せはしない",
    "subjects": sorted(SUBJECTS.values(), key=lambda s: s["code"]),
})
print("subjects:", len(SUBJECTS))
