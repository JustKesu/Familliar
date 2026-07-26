import { useEffect, useState, type ReactNode } from 'react'
import { Entries } from './markup'
import { asString, isEntryObject } from './markup/entryTypes'

/*
 * TEMPORARY DEMO PAGE
 *
 * Build order step 1 is the markup renderer (PHASE1.md section E), so this
 * page exists to show it working against real data/ content — nothing more.
 * It will be replaced by character creation in step 3. Reachable from the
 * main app via the "Markup demo" tab (see App.tsx).
 *
 * Each panel was chosen to exercise a different part of the renderer. The
 * "show raw markup" toggle puts the source text next to the output, which is
 * the quickest way to see whether a tag rendered correctly.
 */

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

type DataFile = (typeof DATA_FILES)[number]
type DataSets = Record<DataFile, unknown[]>

interface DemoSpec {
	/** What this entry is here to demonstrate. */
	caption: string
	file: DataFile
	find: (row: Record<string, unknown>) => boolean
	/** Which keys of the matched row hold entry structures, in render order. */
	fields: readonly string[]
}

const DEMOS: readonly DemoSpec[] = [
	{
		caption: 'Damage dice, saving throws, and upcast scaling ({@scaledamage)',
		file: 'spells.json',
		find: (row) => row['name'] === 'Fireball' && row['source'] === 'XPHB',
		fields: ['entries', 'entriesHigherLevel'],
	},
	{
		caption: 'A class feature whose text contains a nested list',
		file: 'class-features.json',
		find: (row) =>
			row['name'] === 'Rage' && row['className'] === 'Barbarian' && row['level'] === 1,
		fields: ['entries'],
	},
	{
		caption: 'A magic item carrying a table',
		file: 'items.json',
		find: (row) => row['name'] === 'Alchemy Jug' && row['source'] === 'XDMG',
		fields: ['entries'],
	},
	{
		caption: 'A feat that references another feat',
		file: 'feats.json',
		find: (row) => row['name'] === 'Greater Mark of Detection' && row['source'] === 'EFA',
		fields: ['entries'],
	},
]

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; data: DataSets }
	| { status: 'error'; message: string }

async function loadFile(file: DataFile): Promise<unknown[]> {
	const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`)
	if (!response.ok) throw new Error(`${file} — HTTP ${response.status}`)
	const parsed: unknown = await response.json()
	if (!Array.isArray(parsed)) throw new Error(`${file} — expected a top-level array`)
	return parsed
}

function findRow(
	rows: unknown[] | undefined,
	predicate: (row: Record<string, unknown>) => boolean,
): Record<string, unknown> | undefined {
	if (!rows) return undefined
	for (const row of rows) {
		if (isEntryObject(row) && predicate(row)) return row
	}
	return undefined
}

function DemoPanel({ spec, data }: { spec: DemoSpec; data: DataSets }): ReactNode {
	const [showRaw, setShowRaw] = useState(false)
	const row = findRow(data[spec.file], spec.find)

	if (!row) {
		return (
			<article className="panel">
				<p className="error">
					Not found in {spec.file}: the entry for “{spec.caption}”.
				</p>
			</article>
		)
	}

	const name = asString(row['name']) ?? '(unnamed)'
	const source = asString(row['source']) ?? ''
	const fields = spec.fields.filter((field) => row[field] !== undefined)

	return (
		<article className="panel">
			<header className="panel__head">
				<h2>
					{name} {source && <span className="panel__source">{source}</span>}
				</h2>
				<label className="panel__toggle">
					<input
						type="checkbox"
						checked={showRaw}
						onChange={(event) => setShowRaw(event.target.checked)}
					/>{' '}
					show raw markup
				</label>
			</header>
			<p className="panel__caption">{spec.caption}</p>

			<div className="panel__body">
				{fields.map((field) => (
					<Entries key={field} entries={row[field]} />
				))}
			</div>

			{showRaw && (
				<pre className="panel__raw">
					{fields.map((field) => JSON.stringify(row[field], null, 2)).join('\n')}
				</pre>
			)}
		</article>
	)
}

function MarkupDemo() {
	const [state, setState] = useState<LoadState>({ status: 'loading' })

	useEffect(() => {
		let cancelled = false

		Promise.all(DATA_FILES.map(loadFile))
			.then((loaded) => {
				if (cancelled) return
				const data = Object.fromEntries(
					DATA_FILES.map((file, index) => [file, loaded[index] ?? []]),
				) as DataSets
				setState({ status: 'ready', data })
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setState({
					status: 'error',
					message: error instanceof Error ? error.message : String(error),
				})
			})

		return () => {
			cancelled = true
		}
	}, [])

	return (
		<main>
			<h1>Familliar</h1>
			<p className="subtitle">
				5etools markup renderer — build order step 1. Temporary demo page.
			</p>

			{state.status === 'loading' && <p>Loading data…</p>}
			{state.status === 'error' && (
				<p className="error">Could not load data: {state.message}</p>
			)}

			{state.status === 'ready' && (
				<>
					{DEMOS.map((spec) => (
						<DemoPanel key={spec.caption} spec={spec} data={state.data} />
					))}

					<footer className="counts">
						{DATA_FILES.map((file) => (
							<span key={file} className="counts__item">
								{file.replace('.json', '')} <b>{state.data[file].length}</b>
							</span>
						))}
					</footer>
				</>
			)}
		</main>
	)
}

export default MarkupDemo
