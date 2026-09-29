// ビルド時に data/requirements/*.json を読み、「どの入学年度・コース・類・プログラムのデータがあるか」
// だけの小さな一覧を作って、アプリへ `virtual:program-index` という名前で渡すViteプラグイン。
//
// 要件データと科目マスタの本体は年度ごとに分けて必要なときだけ読み込む（src/data/requirementSets.ts）。
// ただしプロフィール設定画面のプルダウンなどは全年度のプログラム一覧を最初から必要とするため、
// その一覧だけをここで本体から切り離して作る（本体を丸ごと読み込むと数MBになるため）。
// 「virtual:」で始まる名前は実在するファイルではなく、このプラグインが中身を返す仮想的なモジュール。
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

const VIRTUAL_ID = 'virtual:program-index'
// Viteの慣習で、仮想モジュールの内部IDには先頭に \0 を付けて実ファイルと区別する
const RESOLVED_ID = '\0' + VIRTUAL_ID

/** プログラム一覧の1件（src/data/requirementSets.ts の ProgramOption と同じ形＋読み込むファイル名） */
interface ProgramIndexEntry {
  entryYear: number
  course: 'day' | 'evening'
  cluster: 'I' | 'II' | 'III' | null
  program: string
  programName: string
  programSuffix: string
  file: string
}

/** data/requirements からプログラム一覧を作るプラグインを返す（vite.config.ts・vitest.config.ts の両方で使う） */
export function programIndexPlugin(): Plugin {
  const requirementsDir = path.resolve(import.meta.dirname, 'data', 'requirements')
  return {
    name: 'program-index',
    // アプリ側の import 'virtual:program-index' をこのプラグインが引き受ける
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null
    },
    load(id) {
      // 自分が引き受けたモジュール以外は、通常どおりViteに任せる
      if (id !== RESOLVED_ID) return null
      const entries: ProgramIndexEntry[] = []
      // 昼間共通要件（*-common.json）はプログラムではないので一覧に入れない
      for (const file of readdirSync(requirementsDir).filter((name) => name.endsWith('.json') && !name.endsWith('-common.json'))) {
        const fullPath = path.join(requirementsDir, file)
        // 開発中にJSONを書き換えたら一覧も作り直されるよう、監視対象に加える
        this.addWatchFile(fullPath)
        const doc = JSON.parse(readFileSync(fullPath, 'utf-8'))
        entries.push({
          entryYear: doc.entryYear,
          course: doc.course,
          cluster: doc.cluster ?? null,
          program: doc.program,
          programName: doc.programName,
          programSuffix: doc.programSuffix,
          file,
        })
      }
      // 画面に並べる順番：入学年度 → 昼間コースを先 → 科目番号末尾記号（学修要覧のプログラム順と一致する）
      entries.sort((a, b) =>
        a.entryYear - b.entryYear
        || Number(a.course === 'evening') - Number(b.course === 'evening')
        || a.programSuffix.localeCompare(b.programSuffix),
      )
      return `export default ${JSON.stringify(entries)}`
    },
  }
}
