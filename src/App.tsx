import { useEffect, useState } from 'react'

/*
 * TEMPORARY SKELETON PAGE
 *
 * This exists only to prove the app can read the extracted 5etools JSON from
 * public/data/ at runtime. It will be replaced by the real character sheet UI.
 *
 * Deliberately no game-data types here: every file is validated as nothing
 * more than a top-level array and counted. Real type definitions arrive with
 * the features that consume them.
 */

// Same order as the "Output files" section of NOTES.md.
const DATA_FILES = [
  'feats.json',
  'spells.json',
  'species.json',
  'backgrounds.json',
  'classes.json',
  'class-features.json',
  'subclass-features.json',
  'optional-features.json',
  'items.json',
] as const

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; counts: readonly number[] }
  | { status: 'error'; message: string }

async function countEntries(file: string): Promise<number> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`)
  if (!response.ok) {
    throw new Error(`${file} — HTTP ${response.status}`)
  }
  const parsed: unknown = await response.json()
  if (!Array.isArray(parsed)) {
    throw new Error(`${file} — expected a top-level array`)
  }
  return parsed.length
}

function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    Promise.all(DATA_FILES.map(countEntries))
      .then((counts) => {
        if (!cancelled) setState({ status: 'ready', counts })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main>
      <h1>Familliar</h1>
      <p className="subtitle">D&amp;D 5e (2024) character sheet</p>

      {state.status === 'loading' && <p>Loading data…</p>}

      {state.status === 'error' && (
        <p className="error">Could not load data: {state.message}</p>
      )}

      {state.status === 'ready' && (
        <table>
          <thead>
            <tr>
              <th scope="col">File</th>
              <th scope="col">Entries</th>
            </tr>
          </thead>
          <tbody>
            {DATA_FILES.map((file, index) => (
              <tr key={file}>
                <td>{file}</td>
                <td className="count">{state.counts[index]}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>total</td>
              <td className="count">
                {state.counts.reduce((sum, count) => sum + count, 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </main>
  )
}

export default App
