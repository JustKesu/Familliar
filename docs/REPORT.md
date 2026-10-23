# U-1: zastaralé texty

Setup: fetch, ff-only merge, npm ci; HEAD ef9b70d při startu (OK).

Změněno:
- src/inventory/inventoryData.ts: komentář u `ItemRef.value` – 382 z 947 položek (F-41); čte se v InventoryTab (`costWeightLine`, "Cost:" v detailu položky) a `customItemFromRef` (kopíruje do `valueCopper`). Původní "read by nothing" bylo nepravdivé.
- docs/STATUS.md: řádek "Open (TGS2-4..5)" nahrazen zadaným zněním.

Ověřeno: npm run typecheck – bez chyb; npm run test – 186 souborů, 3390 testů prošlo. E2E nespuštěno (jen komentář a dokument).

Manual browser check for the user: none - no UI change.
