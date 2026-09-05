// プロフィール設定ページ（"/setup"）。F-1に対応。
//
// 入学年度・コース・類・プログラム・現在の学年・推薦入学かどうかを入力してもらい、
// localStorageに保存する。保存した内容から、メイン画面（/main）で使う卒業要件セットが決まる。
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { programOptions } from '../data/requirementSets'
import type { Profile } from '../storage/profile'
import { loadProfile, saveProfile } from '../storage/profile'

export default function SetupPage() {
  const navigate = useNavigate()

  // 保存済みのプロフィールがあれば、入力欄の初期値として使う。
  // useState(() => ...) のように関数を渡すと、その関数は最初の描画時に1回だけ呼ばれる
  // （「レイジー初期化」という）。localStorageの読み込みのような多少コストのある処理を
  // 毎回の再描画で走らせずに済む。
  const [saved] = useState(() => loadProfile())

  // 入力欄の状態。useState は「今の値」と「その値を書き換える関数」のペアを返すReactの基本機能で、
  // 値が変わるとその値を使っている画面部分が自動的に再描画される。
  const [entryYear, setEntryYear] = useState(saved?.entryYear ?? 2025)
  const [course, setCourse] = useState<Profile['course']>(saved?.course ?? 'day')
  const [cluster, setCluster] = useState<Profile['cluster']>(saved?.cluster ?? 'I')
  const [program, setProgram] = useState<string | null>(saved?.program ?? null)
  const [grade, setGrade] = useState(saved?.grade ?? 1)
  const [recommended, setRecommended] = useState(saved?.recommended ?? false)
  // 曜日時限表示用のクラス情報（docs/SPEC.md §7.1、CLAUDE.md進捗ログ参照）。昼間コースのみ使う
  const [yearOneClass, setYearOneClass] = useState(saved?.yearOneClass ?? 1)
  const [classIABC, setClassIABC] = useState<Profile['classIABC']>(saved?.classIABC ?? null)
  const [classIIArea, setClassIIArea] = useState<Profile['classIIArea']>(saved?.classIIArea ?? null)
  const [classIIIYear2Class, setClassIIIYear2Class] = useState<Profile['classIIIYear2Class']>(saved?.classIIIYear2Class ?? null)
  const [classIIIYear2Area, setClassIIIYear2Area] = useState<Profile['classIIIYear2Area']>(saved?.classIIIYear2Area ?? null)
  // 夜間主コース用の学年（昼間コースの grade とは別に持つ。プログラム配属の概念が無いので推薦入学欄も出さない）
  const [eveningGrade, setEveningGrade] = useState(saved?.course === 'evening' ? (saved?.grade ?? 1) : 1)

  // 今持っているデータの中から、選んだ年度・コースに対応する「類」の一覧を作る（重複は除く）。
  // useMemo は「依存配列が変わったときだけ再計算する」ためのフック。単なる関数呼び出しでも動くが、
  // 依存が変わっていないのに毎回の再描画で計算し直すのを避けられる。
  const availableClusters = useMemo(() => {
    const set = new Set(
      programOptions.filter((p) => p.entryYear === entryYear && p.course === course).map((p) => p.cluster),
    )
    return [...set]
  }, [entryYear, course])

  // さらに「類」まで絞り込んだ、選べるプログラムの一覧
  const availablePrograms = useMemo(
    () => programOptions.filter((p) => p.entryYear === entryYear && p.course === course && p.cluster === cluster),
    [entryYear, course, cluster],
  )

  // 1年次クラスの選べる範囲（類に直結。docs/SPEC.md §7.1、CLAUDE.md進捗ログ参照）。
  // 類を切り替えたときに前の範囲の番号が残らないよう、範囲外なら先頭の番号に読み替える
  const yearOneClassRange = cluster === 'I' ? [1, 2, 3, 4] : cluster === 'II' ? [5, 6, 7, 8] : [9, 10, 11, 12]
  const effectiveYearOneClass = yearOneClassRange.includes(yearOneClass) ? yearOneClass : yearOneClassRange[0]

  // 1年生（推薦入学でない場合）はまだプログラムに配属されていないので、選択欄を無効化して「未定」に固定する。
  // ここでは program の状態そのものは書き換えず、「実際に使う値」をその場で導出するだけにする
  // （useEffectでstateを書き換えると再描画が連鎖してしまうため、これは今の描画中に計算できる値として扱う）。
  const programLocked = grade === 1 && !recommended
  const effectiveProgram = programLocked ? null : program

  // フォーム送信時：ページの再読み込みを止め（preventDefault）、今の入力内容を保存して
  // メイン画面に移動する
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // 夜間主コースは類・プログラムの区分が無い単一課程（docs/SPEC.md §3）なので、
    // cluster: null・program: 'evening' 固定で保存する
    if (course === 'evening') {
      saveProfile({ entryYear, course, cluster: null, program: 'evening', grade: eveningGrade, recommended: false })
      navigate('/main')
      return
    }
    if (!cluster) return // 昼間コースは類が必須（docs/SPEC.md F-1）
    const profile: Profile = {
      entryYear, course, cluster, program: effectiveProgram, grade, recommended,
      yearOneClass: effectiveYearOneClass,
      classIABC: cluster === 'I' ? classIABC : null,
      classIIArea: cluster === 'II' ? classIIArea : null,
      classIIIYear2Class: cluster === 'III' ? classIIIYear2Class : null,
      classIIIYear2Area: cluster === 'III' ? classIIIYear2Area : null,
    }
    saveProfile(profile)
    navigate('/main')
  }

  return (
    <main>
      <h1>プロフィール設定</h1>
      <p>入学年度・類・プログラムを設定すると、あなたに適用される卒業要件が決まります。</p>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="entryYear">入学年度</label>
          <select id="entryYear" value={entryYear} onChange={(e) => setEntryYear(Number(e.target.value))}>
            {[...new Set(programOptions.map((p) => p.entryYear))].map((year) => (
              <option key={year} value={year}>
                {year}年度
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="course">コース</label>
          <select
            id="course"
            value={course}
            onChange={(e) => setCourse(e.target.value as Profile['course'])}
          >
            <option value="day">昼間コース</option>
            <option value="evening">夜間主コース</option>
          </select>
        </div>

        {/* 夜間主コースは類・プログラムの区分が無い単一課程なので、学年だけ聞く */}
        {course === 'evening' ? (
          <div>
            <label htmlFor="eveningGrade">現在の学年</label>
            <select
              id="eveningGrade"
              value={eveningGrade}
              onChange={(e) => setEveningGrade(Number(e.target.value))}
            >
              {[1, 2, 3, 4].map((g) => (
                <option key={g} value={g}>
                  {g}年生
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="cluster">類</label>
              <select
                id="cluster"
                value={cluster ?? ''}
                onChange={(e) => setCluster(e.target.value as Profile['cluster'])}
              >
                {availableClusters.length === 0 && <option value="">（データなし）</option>}
                {availableClusters.map((c) => (
                  <option key={c} value={c ?? ''}>
                    {c}類
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="grade">現在の学年</label>
              <select id="grade" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
                {[1, 2, 3, 4].map((g) => (
                  <option key={g} value={g}>
                    {g}年生
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>
                <input type="checkbox" checked={recommended} onChange={(e) => setRecommended(e.target.checked)} />
                推薦入学（入学時からプログラムが確定している）
              </label>
            </div>

            <div>
              <label htmlFor="program">教育プログラム</label>
              <select
                id="program"
                value={effectiveProgram ?? ''}
                disabled={programLocked}
                onChange={(e) => setProgram(e.target.value === '' ? null : e.target.value)}
              >
                <option value="">未定</option>
                {availablePrograms.map((p) => (
                  <option key={p.program} value={p.program}>
                    {p.programName}
                  </option>
                ))}
              </select>
              {programLocked && <p>1年生は2年次後学期にプログラム配属されるまで「未定」になります。</p>}
            </div>

            {/* 曜日時限の表示に使うクラス情報（docs/SPEC.md §7.1、CLAUDE.md進捗ログ参照）。
                1年次クラスは学籍番号による機械的な割り当てで、本人には選べないが他から逆算する
                方法も無いので、必ず本人に直接答えてもらう。2番目以降は類によって聞く内容が変わる
                （該当しない類の分は聞かず、nullのまま保存する） */}
            <div>
              <label htmlFor="yearOneClass">1年次クラス</label>
              <select
                id="yearOneClass"
                value={effectiveYearOneClass}
                onChange={(e) => setYearOneClass(Number(e.target.value))}
              >
                {yearOneClassRange.map((n) => (
                  <option key={n} value={n}>
                    クラス{n}
                  </option>
                ))}
              </select>
            </div>

            {cluster === 'I' && (
              <div>
                <label htmlFor="classIABC">1年後期〜2年後期クラス（第二外国語など一部科目用）</label>
                <select
                  id="classIABC"
                  value={classIABC ?? ''}
                  onChange={(e) => setClassIABC(e.target.value === '' ? null : (e.target.value as 'A' | 'B' | 'C'))}
                >
                  <option value="">未定</option>
                  <option value="A">Aクラス</option>
                  <option value="B">Bクラス</option>
                  <option value="C">Cクラス</option>
                </select>
              </div>
            )}

            {cluster === 'II' && (
              <div>
                <label htmlFor="classIIArea">2年前期クラス/エリア</label>
                <select
                  id="classIIArea"
                  value={classIIArea ?? ''}
                  onChange={(e) => setClassIIArea(e.target.value === '' ? null : (e.target.value as NonNullable<Profile['classIIArea']>))}
                >
                  <option value="">未定</option>
                  {(['I1', 'I2', 'I3', 'I4', 'I5', 'I6'] as const).map((c) => (
                    <option key={c} value={c}>
                      {c}クラス
                    </option>
                  ))}
                  <option value="M">Mエリア</option>
                </select>
              </div>
            )}

            {cluster === 'III' && (
              <>
                <div>
                  <label htmlFor="classIIIYear2Class">2年前期クラス</label>
                  <select
                    id="classIIIYear2Class"
                    value={classIIIYear2Class ?? ''}
                    onChange={(e) => setClassIIIYear2Class(e.target.value === '' ? null : (e.target.value as '1' | '2' | '3' | '4'))}
                  >
                    <option value="">未定</option>
                    {(['1', '2', '3', '4'] as const).map((c) => (
                      <option key={c} value={c}>
                        {c}クラス
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="classIIIYear2Area">2年後期エリア</label>
                  <select
                    id="classIIIYear2Area"
                    value={classIIIYear2Area ?? ''}
                    onChange={(e) => setClassIIIYear2Area(e.target.value === '' ? null : (e.target.value as 'M' | 'S'))}
                  >
                    <option value="">未定</option>
                    <option value="M">Mエリア</option>
                    <option value="S">Sエリア</option>
                  </select>
                </div>
              </>
            )}
          </>
        )}

        <button type="submit" disabled={course === 'day' && !cluster}>
          この内容で始める
        </button>
      </form>
    </main>
  )
}
