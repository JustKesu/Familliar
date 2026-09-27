import { useEffect, useState, type ReactNode } from 'react'
import { featCampaignNote, loadFeats, type FeatEntry } from './featAsiData'
import type { FeatRef } from './featInstances'

/**
 * D205: "whenever you would gain a feat from the Origin category, you can instead
 * gain a Dark Gift feat" (RHW), offered for every background. `namedFeat` null is
 * a background with no fixed feat, where the Dark Gift is required.
 */
export function OriginFeatSwapPicker({
	namedFeat,
	value,
	onChange,
}: {
	namedFeat: FeatRef | null
	value: FeatRef | null
	onChange: (feat: FeatRef | null) => void
}): ReactNode {
	const [darkGifts, setDarkGifts] = useState<FeatEntry[] | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [wantsDarkGift, setWantsDarkGift] = useState(value !== null)

	useEffect(() => {
		let cancelled = false
		loadFeats()
			.then((feats) => {
				if (!cancelled) setDarkGifts(feats.filter((feat) => feat.category === 'DG').sort((a, b) => a.name.localeCompare(b.name)))
			})
			.catch((reason: unknown) => {
				if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason))
			})
		return () => {
			cancelled = true
		}
	}, [])

	const showList = namedFeat === null || wantsDarkGift

	return (
		<fieldset className="feat-asi-picker__level">
			<legend>{namedFeat ? 'Origin feat' : 'Origin feat: choose a Dark Gift feat'}</legend>
			{namedFeat && (
				<>
					<label>
						<input
							type="radio"
							name="origin-feat-kind"
							checked={!wantsDarkGift}
							onChange={() => {
								setWantsDarkGift(false)
								onChange(null)
							}}
						/>
						{namedFeat.name}
					</label>
					<label>
						<input type="radio" name="origin-feat-kind" checked={wantsDarkGift} onChange={() => setWantsDarkGift(true)} />
						A Dark Gift feat instead
					</label>
				</>
			)}
			{showList && error !== null && <p className="error">Could not load the Dark Gift feats: {error}</p>}
			{showList && darkGifts && (
				<ul className="feat-asi-picker__feats" aria-label="Dark Gift feats">
					{darkGifts.map((feat) => {
						const campaignNote = featCampaignNote(feat)
						return (
							<li key={`${feat.name}|${feat.source}`} className="feat-asi-picker__feat">
								<label>
									<input
										type="radio"
										name="origin-feat-dark-gift"
										checked={value?.name === feat.name && value.source === feat.source}
										onChange={() => onChange({ name: feat.name, source: feat.source })}
									/>
									{feat.name} — Dark Gift
								</label>
								{campaignNote && <p className="feat-asi-picker__note">{campaignNote}</p>}
							</li>
						)
					})}
				</ul>
			)}
		</fieldset>
	)
}
