# AI Companion dataset

`mental_health_support_chat_augmented.json.gz` is a lossless gzip copy of the supplied augmented source file. The backend imports its records incrementally into persistent SQLite memory, without loading the 177 MB source into application memory. Every source row is retained; only records that pass a first-person mental-health relevance filter are eligible for retrieval. Chat messages are not stored.

The retrieval index supplements the existing `mental_health_support_chat.json` copy. This is data retrieval, not model-weight fine-tuning.

`companion_wellbeing_topics.json` adds 37 editor-authored, source-linked support records covering emotional regulation, relationships, school and work stress, decision-making, and related concerns. On backend startup, valid records are versioned in SQLite's `ai_companion_curated_memory` table and added to Companion's retrieval index. Safety tiers keep crisis and urgent clinical entries identifiable; suicide risk continues to use the server's fixed urgent-support protocol. The dataset is supportive information, not diagnosis or treatment. Clinical topics encourage qualified assessment, and unusual beliefs or perceptions are not affirmed as fact. Sources are linked in each record; the content is original summaries rather than copied source text.
