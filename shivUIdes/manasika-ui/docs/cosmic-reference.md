# Cosmic reference data

The Cosmic Corner additions use a static, browser-loaded reference bundle generated from the supplied `zodiac_db` folder. Source JSON and ZIP archives are read in place and are never modified. The generated outputs live in `public/data/cosmic/` and are committed alongside the app so the static deployment can serve them without a database migration or new API key.

Expected source files next to the checkout:

- `astro_transits_and_growth.json`
- `natal_chart_reflections.json`
- `positive_astro_reframing.json`
- `lunar_solar_self_reflection.zip` (contains `lunar_solar_self_reflection.json`)
- `tarot_reading_interpretations.zip` (contains `tarot_reading_interpretations.json`)

From `shivUIdes/manasika-ui`, rebuild the static bundle with:

```powershell
python scripts/build_cosmic_reference.py --source-dir "../../../zodiac_db"
npm run build
```

The Zodiac Atlas labels entries as dataset interpretations rather than live astronomical calculations. The graph links concepts that co-occur in the supplied astrology records; links do not represent causality or prediction. Tarot is offered for entertainment and personal reflection. Original datasets and the existing Cosmic Corner data remain separate and unchanged.
