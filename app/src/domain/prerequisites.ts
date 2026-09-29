// シラバスの「前もって履修しておくべき科目」欄（`prerequisitesText`、自由記述のテキスト）から、
// recommend.ts が使う `SubjectInfo.prerequisites`（科目コードの配列）を安全に作るための変換ロジック。
// requirements.ts・reviews.ts と同じく、React にも DOM にも依存しない純粋な関数だけで構成する。
//
// 方針（CLAUDE.mdの進捗ログ参照）：`prerequisitesText`は自由記述で、
// 「微分積分学や線形代数学などの数学科目」のような曖昧な言い回しや、
// 「特になし」「None」のような否定、英語の文章など形式がバラバラ。ここから科目コードを
// 機械的に断定するのは誤検出のリスクが高いので、**区切り文字で分けた1トークンが
// 実在する科目名と完全一致する場合だけ**採用する（部分一致・曖昧な言い回しは一切拾わない）。
// 見逃し（先修科目が拾えない）は「先修条件なしとして扱われるだけ」で無害だが、
// 誤って別の科目を先修科目として要求してしまう方は推奨順位を歪めるため、常に見逃す側に倒す。

/** 科目名の中に含まれる区切り文字（読点・カンマ・中点・スラッシュ・空白など） */
const DELIMITER_RE = /[、，,・/／;；\s　]+/

/**
 * 科目一覧から「科目名 → 科目コードの一覧」の逆引きを作る。
 * 同じ科目名が複数のプログラムに存在する（例:「力学演習」がⅢ類5プログラム分ある）ことが
 * 普通にあるので、値は配列で持つ。
 */
export function buildNameToCodes(subjects: readonly { code: string; name: string }[]): ReadonlyMap<string, string[]> {
  const map = new Map<string, string[]>()
  for (const s of subjects) {
    const list = map.get(s.name)
    if (list) list.push(s.code)
    else map.set(s.name, [s.code])
  }
  return map
}

/**
 * 科目名が複数のプログラムにまたがって重複するとき、対象科目（ownCode）にとって
 * 一番もっともらしい1つを選ぶ。
 * 1. 対象科目と同じ末尾記号（同じプログラム）の候補があればそれを使う
 * 2. 無ければ、対象科目が夜間主（末尾 s/t）でない限り、共通科目（末尾 z）の候補を使う
 *    （類専門科目が「微分積分学第一」のような共通科目を先修科目に挙げるのはよくあるパターンのため）
 * 3. それでも決まらない（曖昧）場合は諦める（undefined）
 */
function pickCode(candidates: readonly string[], ownCode: string): string | undefined {
  if (candidates.length === 1) return candidates[0]
  const ownSuffix = ownCode.slice(-1)
  const sameProgram = candidates.find((c) => c.slice(-1) === ownSuffix)
  if (sameProgram) return sameProgram
  if (ownSuffix !== 's' && ownSuffix !== 't') {
    const common = candidates.find((c) => c.slice(-1) === 'z')
    if (common) return common
  }
  return undefined
}

/**
 * prerequisitesText を先修科目のコード配列に変換する。
 * テキストが無い・トークンが1件も一致しない場合は空配列（＝先修条件なし扱い）を返す。
 */
export function derivePrerequisites(
  text: string | undefined,
  ownCode: string,
  nameToCodes: ReadonlyMap<string, string[]>,
): string[] {
  if (!text) return []
  const codes = new Set<string>()
  for (const rawToken of text.split(DELIMITER_RE)) {
    const token = rawToken.trim()
    if (!token || token === ownCode) continue
    const candidates = nameToCodes.get(token)
    if (!candidates) continue
    const picked = pickCode(candidates, ownCode)
    if (picked && picked !== ownCode) codes.add(picked)
  }
  return [...codes]
}
