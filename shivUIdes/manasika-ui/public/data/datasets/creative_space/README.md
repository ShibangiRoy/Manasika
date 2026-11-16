# Creative Space datasets

These source files are versioned here and loaded by the Creative Space prompt selector. The application maps them as requested:

- `creative_story_narratives.json` → My Art
- `image_gen_data_engineering.json` → My Music
- `lyric_generation_prompts.json` → My Stories

The same records are imported into the persistent backend `creative_dataset_records` database. User-authored prompts and notes are stored separately in `creative_user_inputs`, scoped to the user's anonymous browser account. The client keeps only a compact prompt index in IndexedDB.

The prompt-generation integration uses the dataset's `enhanced_prompt` plus a section-specific prompt wrapper. It does not train or fine-tune model weights.
