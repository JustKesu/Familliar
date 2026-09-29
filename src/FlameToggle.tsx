import { useState, type ReactNode } from 'react'
import { applyFlame, loadSettings, saveSettings } from './storage/settingsStore'

export default function FlameToggle(): ReactNode {
	const [flame, setFlame] = useState<boolean>(() => loadSettings().flame)

	function toggle(): void {
		applyFlame(!flame)
		saveSettings({ ...loadSettings(), flame: !flame })
		setFlame(!flame)
	}

	return (
		<button type="button" className="tabs__button tabs__theme" aria-pressed={flame} onClick={toggle}>
			{flame ? 'Flame: On' : 'Flame: Off'}
		</button>
	)
}
