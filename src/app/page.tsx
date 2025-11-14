const meta = [
  { label: "科目", value: "ノート術 / Cornell Method" },
  { label: "日付", value: "2024-05-30" },
  { label: "講師 / 参考資料", value: "Productivity Summit" },
];

const cues = [
  { marker: "Q1", text: "コーネルメソッドの目的は？" },
  { marker: "Q2", text: "各エリアで書く内容" },
  { marker: "Q3", text: "復習のタイミング" },
  { marker: "Q4", text: "デジタル化のコツ" },
];

const notes = [
  {
    title: "メインノート",
    items: [
      "講義や読書中に得た情報を時系列で記録。箇条書きでもOK。",
      "発言者・ページ番号などの参照先も合わせて記録すると後で探しやすい。",
      "重要度に応じてハイライトや記号を使い分け、視線で意味が取れるようにする。",
    ],
  },
  {
    title: "深掘りメモ",
    items: [
      "気づき／疑問はメモ中にすぐ書いておき、後でキーワード欄へ転記。",
      "「なぜ？」を少なくとも 3 回繰り返し、表面的な覚え書きで終わらせない。",
      "関連するアイデアは図解や矢印で繋げると復習時に文脈が残りやすい。",
    ],
  },
];

const summary = [
  "学んだ内容を 3～4 行で要約し、次回アクションを 1 つ以上書き出す。",
  "24 時間以内に見返す → 1 週間後に再確認 → 1 か月後に再整理のサイクルを回す。",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-stone-100 px-4 py-10 font-sans text-stone-800">
      <main className="mx-auto flex max-w-5xl flex-col gap-8 rounded-3xl bg-white p-8 shadow-2xl shadow-stone-200">
        <header className="flex flex-col gap-6 border-b border-dashed border-stone-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-stone-400">
              Cornell Note
            </p>
            <h1 className="text-3xl font-semibold">
              コーネル式ノートテンプレート
            </h1>
            <p className="mt-2 text-base text-stone-500">
              キーワード欄・メインノート・サマリーの 3 分割で情報を整理します。
            </p>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            {meta.map((item) => (
              <div key={item.label}>
                <dt className="text-stone-400">{item.label}</dt>
                <dd className="font-medium text-stone-700">{item.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <section className="grid gap-6 border-b border-dashed border-stone-200 pb-6 md:grid-cols-[1fr_2fr]">
          <div className="rounded-2xl border border-stone-100 bg-stone-50/70 p-5">
            <p className="text-sm font-semibold text-stone-500">
              キーワード / 質問
            </p>
            <ul className="mt-4 space-y-4">
              {cues.map((item) => (
                <li
                  key={item.marker}
                  className="rounded-xl border-l-4 border-stone-300/80 bg-white p-4 shadow-sm"
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
                    {item.marker}
                  </p>
                  <p className="text-sm font-medium text-stone-700">
                    {item.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-stone-100 bg-white p-5">
            <p className="text-sm font-semibold text-stone-500">ノートエリア</p>
            <div className="mt-4 space-y-6">
              {notes.map((block) => (
                <article
                  key={block.title}
                  className="rounded-2xl border border-stone-100 p-4 shadow-[inset_0_1px_0_0_rgba(0,0,0,0.03)]"
                >
                  <h2 className="text-base font-semibold text-stone-800">
                    {block.title}
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-700">
                    {block.items.map((item) => (
                      <li key={item} className="relative pl-5">
                        <span className="absolute left-0 top-2 h-2 w-2 rounded-full bg-amber-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-amber-100 bg-amber-50/60 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-amber-400">
            Summary
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-amber-900">
            要約 & 次のアクション
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-amber-900/90">
            {summary.map((item) => (
              <li key={item} className="relative pl-5">
                <span className="absolute left-0 top-2 h-2 w-2 rounded-sm bg-amber-400" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
