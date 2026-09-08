// 科目詳細ページ（"/courses/:id"）。F-5に対応。
//
// `useParams` はReact Routerのフックで、URLの `:id` の部分を読み取れる。
// 例えば "/courses/COM301k" というURLで表示されたときは `id` が "COM301k" になる。
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { findSubjectUsages, getSubjectsByCode } from '../data/requirementSets'

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  // 同じ科目番号でも年度で別科目になるため、URLのyearを優先して年度別マスタを引く。
  const requestedYear = Number(searchParams.get('year'))
  const entryYear = requestedYear === 2026 ? 2026 : 2025
  const subject = id ? getSubjectsByCode(entryYear).get(id) : undefined

  if (!subject) {
    return (
      <main>
        <h1>科目詳細</h1>
        <p>科目番号「{id}」は見つかりませんでした。</p>
        <p>
          <Link to={`/courses?year=${entryYear}`}>科目一覧に戻る</Link>
        </p>
      </main>
    )
  }

  // この科目が卒業要件のどのプログラムのどの区分で使われているかを、全プログラム分探す
  const usages = findSubjectUsages(entryYear, subject.code)

  return (
    <main>
      <h1>{subject.name}</h1>
      <p>
        科目番号: {subject.code} ／ 単位数: {subject.credits}
      </p>
      <p>適用年度: {entryYear}年度</p>
      {subject.standardYear && (
        <p>
          標準履修年次: {subject.standardYear}年 {subject.termType ?? ''}
        </p>
      )}
      {subject.note && <p>備考: {subject.note}</p>}
      {subject.prerequisitesText && <p>先修科目（シラバスの記載そのまま）: {subject.prerequisitesText}</p>}

      <h2>要件上の位置づけ</h2>
      {usages.length > 0 ? (
        <ul>
          {usages.map((u, i) => (
            // 同じプログラム名が複数行に分かれることもある（例:他プログラムの選択科目としての
            // 展開分と本来の区分の両方に載っている場合）ので、配列の添字も含めてkeyにする
            <li key={`${u.programName}-${u.groupPath}-${i}`}>
              {u.programName}: {u.groupPath}
            </li>
          ))}
        </ul>
      ) : (
        <p>卒業要件のどの区分にも直接は登場しません（自由科目・大学院連携科目など）。</p>
      )}

      <h2>開講情報（シラバスより）</h2>
      {subject.offerings && subject.offerings.length > 0 ? (
        <ul>
          {subject.offerings.map((o) => (
            <li key={o.timetableCode}>
              {o.term}{' '}
              {o.slots.length > 0 ? o.slots.map((slot) => `${slot.day}・${slot.period}限`).join('／') : '曜日時限の記載なし（集中講義等）'}
              　担当: {o.instructors.length > 0 ? o.instructors.join('、') : '記載なし'}{' '}
              <a href={o.syllabusUrl} target="_blank" rel="noopener noreferrer">
                シラバス
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>シラバスの開講情報はまだ取得できていません。</p>
      )}

      <p>
        <Link to={`/courses?year=${entryYear}`}>科目一覧に戻る</Link>
      </p>
    </main>
  )
}
