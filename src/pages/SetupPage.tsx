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

  // 1年生（推薦入学でない場合）はまだプログラムに配属されていないので、選択欄を無効化して「未定」に固定する。
  // ここでは program の状態そのものは書き換えず、「実際に使う値」をその場で導出するだけにする
  // （useEffectでstateを書き換えると再描画が連鎖してしまうため、これは今の描画中に計算できる値として扱う）。
  const programLocked = grade === 1 && !recommended
  const effectiveProgram = programLocked ? null : program

  // フォーム送信時：ページの再読み込みを止め（preventDefault）、今の入力内容を保存して
  // メイン画面に移動する
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!cluster) return // 類は必須（docs/SPEC.md F-1）
    const profile: Profile = { entryYear, course, cluster, program: effectiveProgram, grade, recommended }
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

        {/* 夜間主コースはデータが無いので、類・プログラムの入力欄ごと出さない */}
        {course === 'evening' ? (
          <p>夜間主コースのデータはまだ準備中です（フェーズ3で対応予定）。</p>
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
          </>
        )}

        <button type="submit" disabled={!cluster}>
          この内容で始める
        </button>
      </form>
    </main>
  )
}
