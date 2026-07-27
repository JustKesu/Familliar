import { useEffect, useState, type ReactNode } from 'react'
import { CHOSEN_LANGUAGE_COUNT, loadLanguages, type LanguageEntry } from './languageData'

/*
 * Character creation, languages slice (PHASE1.md build order step 3).
 * Common is known automatically and is not part of the choice — see
 * languageData.ts. The player picks exactly CHOSEN_LANGUAGE_COUNT more from
 * the standard languages. Once that many are picked, every unpicked
 * checkbox is disabled rather than merely warning after the fact, so a
 * third can never be selected in the first place.
 *
 * Feature-granted languages (Thieves' Cant, Druidic, Deft Explorer) are out
 * of scope — they come from class features the wizard does not select yet.
 */

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; languages: LanguageEntry[] }
	| { status: 'error'; message: string }

export type LanguageChoice = LanguageEntry[]

function languageKey(entry: LanguageEntry): string {
	return `${entry.name}|${entry.source}`
}

/**
 * Lets the player pick exactly CHOSEN_LANGUAGE_COUNT languages in addition
 * to Common. Displays `value` — the choice as the caller currently has it —
 * and reports every change upward via `onChange`, matching every other
 * picker in the wizard: the caller owns the selection, so it survives this
 * component unmounting and remounting.
 */
export function LanguagePicker({
	value,
	onChange,
}: {
	value: LanguageChoice
	onChange: (choice: LanguageChoice) => void
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })

	useEffect(() => {
		let cancelled = false
		loadLanguages()
			.then((languages) => {
				if (!cancelled) setState({ status: 'ready', languages })
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

	if (state.status === 'loading') return <p>Loading languages…</p>
	if (state.status === 'error') {
		return <p className="error">Could not load languages: {state.message}</p>
	}

	const selectedKeys = new Set(value.map(languageKey))
	const atLimit = value.length >= CHOSEN_LANGUAGE_COUNT

	function toggle(entry: LanguageEntry, checked: boolean): void {
		if (checked) {
			onChange([...value, entry])
		} else {
			onChange(value.filter((v) => languageKey(v) !== languageKey(entry)))
		}
	}

	return (
		<div className="language-picker">
			<p className="language-picker__hint">
				Common is already known. Choose {CHOSEN_LANGUAGE_COUNT} more languages ({value.length}/
				{CHOSEN_LANGUAGE_COUNT} chosen).
			</p>
			<ul className="language-picker__list">
				{state.languages.map((entry) => {
					const key = languageKey(entry)
					const checked = selectedKeys.has(key)
					return (
						<li key={key}>
							<label>
								<input
									type="checkbox"
									checked={checked}
									disabled={!checked && atLimit}
									onChange={(event) => toggle(entry, event.target.checked)}
								/>
								{entry.name} ({entry.source})
							</label>
						</li>
					)
				})}
			</ul>
			{!atLimit && (
				<p className="language-picker__hint">
					Pick {CHOSEN_LANGUAGE_COUNT - value.length} more to continue.
				</p>
			)}
		</div>
	)
}
