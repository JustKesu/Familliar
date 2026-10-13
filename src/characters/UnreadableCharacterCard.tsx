import { useId, type ReactNode } from 'react'
import type { UnreadableCharacter } from '../storage/characterStore'

/** D354: not a button and not openable; only Export, plus Delete for a damaged entry (a newer-version one must not be lost by a stale tab). */
export function UnreadableCharacterCard({
	entry,
	onExport,
	onRequestDelete,
}: {
	entry: UnreadableCharacter
	onExport: (key: string) => void
	onRequestDelete: (key: string) => void
}): ReactNode {
	const title = entry.name ?? 'Unnamed character'
	const newer = entry.kind === 'newer'
	const detailId = useId()

	return (
		<li className="char-card char-card--unreadable">
			<div className="char-card__open">
				<span className="char-card__portrait" aria-hidden="true">
					!
				</span>
				<span className="char-card__text">
					<span className="char-card__name">{title}</span>
					<span className="char-card__flag">{newer ? 'Saved by a newer version' : 'Damaged'}</span>
					{newer ? (
						<span className="char-card__sub char-card__sub--small">Reload the page to open it.</span>
					) : (
						<>
							<span className="char-card__sub char-card__sub--small" title={entry.message} aria-describedby={detailId}>
								This character could not be read. Export it to keep a copy.
							</span>
							<span id={detailId} hidden>
								{entry.message}
							</span>
						</>
					)}
					<span className="char-card__actions">
						<button type="button" aria-label={`Export ${title}`} onClick={() => onExport(entry.key)}>
							Export
						</button>
						{!newer && (
							<button type="button" aria-label={`Delete ${title}`} onClick={() => onRequestDelete(entry.key)}>
								Delete
							</button>
						)}
					</span>
				</span>
			</div>
		</li>
	)
}
