/*
 * The shared side drawer (D134/D146, built in R4). Every panel that moves out
 * of the sheet — Senses and the ability scores here, Manage Spells/Inventory/
 * Feats later — renders inside this one component.
 *
 * Which panel is open is UI state held by the caller and nothing else: not
 * stored on the character, not in the URL, gone after a reload. Mounting one
 * <Drawer> at a time is what "at most one" means — a second panel replaces the
 * first because the caller's state holds one value.
 *
 * The section and row blocks are <details>, so the browser owns the open state
 * and the click handling, exactly as ValueBreakdown does (D41).
 */

import { useEffect, type ReactNode } from 'react'

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }): ReactNode {
	useEffect(() => {
		function close(event: KeyboardEvent): void {
			if (event.key === 'Escape') onClose()
		}
		document.addEventListener('keydown', close)
		return () => document.removeEventListener('keydown', close)
	}, [onClose])

	return (
		<aside className="drawer" role="dialog" aria-label={title}>
			<header className="drawer__header">
				<h2>{title}</h2>
				<button type="button" className="drawer__close" aria-label="Close" onClick={onClose}>
					×
				</button>
			</header>
			<div className="drawer__body">{children}</div>
		</aside>
	)
}

/** A collapsible block inside the drawer: a heading bar with ▾/▸, open to start. */
export function DrawerSection({ title, children }: { title: string; children: ReactNode }): ReactNode {
	return (
		<details className="drawer-section" open>
			<summary>{title}</summary>
			<div className="drawer-section__body">{children}</div>
		</details>
	)
}

/** A row inside the drawer that expands to more content under it. Collapsed to start — the row itself is the value. */
export function DrawerRow({ label, children }: { label: ReactNode; children: ReactNode }): ReactNode {
	return (
		<details className="drawer-row">
			<summary>{label}</summary>
			<div className="drawer-row__body">{children}</div>
		</details>
	)
}
