// AIエージェントがこのサイトの機能を直接呼び出せるようにする WebMCP（Web Model Context）への登録処理。
//
// WebMCP は2026年時点でChromeの試験機能（chrome://flags の「WebMCP for testing」を有効にしたChrome、
// またはオリジントライアル登録済みのサイト）でだけ使える。API の置き場所も仕様の改訂で
// navigator.modelContext から document.modelContext へ移ったため、両方を探して見つかった方を使う。
// どちらも無いブラウザでは何もしないので、普通の利用者には一切影響しない。

/** エージェントに公開する1つの操作（ツール） */
export interface AgentTool {
  /** ツール名（英小文字とアンダースコア、30文字以内が推奨） */
  name: string
  /** エージェントが「いつ・何のために使うか」を判断するための説明 */
  description: string
  /** 入力の形（JSON Schema） */
  inputSchema: Record<string, unknown>
  /** true ならデータを変更しない読み取り専用の操作 */
  readOnly: boolean
  /** エージェントから呼ばれたときの処理。戻り値はJSONとしてエージェントに渡す */
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>
}

// ブラウザ側 API の最小限の形。仕様が確定していないため、使う部分だけを緩く型付けする。
interface ModelContextLike {
  registerTool: (tool: Record<string, unknown>, options?: Record<string, unknown>) => unknown
  unregisterTool?: (name: string) => unknown
}

/** WebMCP の API（document.modelContext か navigator.modelContext）を探す。無ければ undefined */
function getModelContext(): ModelContextLike | undefined {
  const fromDocument = (document as unknown as { modelContext?: ModelContextLike }).modelContext
  const fromNavigator = (navigator as unknown as { modelContext?: ModelContextLike }).modelContext
  const context = fromDocument ?? fromNavigator
  return typeof context?.registerTool === 'function' ? context : undefined
}

/** このブラウザで WebMCP が使えるか */
export function isWebMcpAvailable(): boolean {
  return getModelContext() !== undefined
}

/**
 * ツールをまとめて登録し、登録を取り消す関数を返す（React の useEffect の後片付けで呼ぶ）。
 * WebMCP が使えないブラウザでは何もせず、何もしない関数を返す。
 */
export function registerAgentTools(tools: readonly AgentTool[]): () => void {
  const context = getModelContext()
  if (!context) return () => {}
  // 新しい仕様では AbortSignal で登録を取り消す。古い仕様では unregisterTool(name) を使うため両方に対応する。
  const controller = new AbortController()
  for (const tool of tools) {
    try {
      const result = context.registerTool(
        {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: { readOnlyHint: tool.readOnly },
          // エージェント側の実装によって期待する戻り値の形が違うため、MCPと同じ
          // { content: [{ type: 'text', text }] } の形でJSON文字列を返す（ただのオブジェクトとしても読める）。
          execute: async (input: Record<string, unknown> | undefined) => {
            try {
              const data = await tool.execute(input ?? {})
              return { content: [{ type: 'text', text: JSON.stringify(data) }] }
            } catch (err) {
              // 想定外のエラーでもページは止めず、エージェントに理由を伝える。
              const message = err instanceof Error ? err.message : String(err)
              return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true }
            }
          },
        },
        { signal: controller.signal },
      )
      // registerTool が Promise を返す実装では、失敗しても画面の動作には影響させない。
      if (result instanceof Promise) result.catch(() => {})
    } catch {
      // 同名ツールの二重登録など、登録に失敗したツールは読み飛ばす。
    }
  }
  // 後片付け：AbortSignal と unregisterTool の両方で登録を取り消す（どちらか一方しか無い実装でも外れる）。
  return () => {
    controller.abort()
    for (const tool of tools) {
      try {
        const result = context.unregisterTool?.(tool.name)
        if (result instanceof Promise) result.catch(() => {})
      } catch {
        // 既に AbortSignal で外れている場合は「存在しない」エラーになるが、問題ないので無視する。
      }
    }
  }
}
