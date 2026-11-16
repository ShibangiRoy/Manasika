# AI Companion dataset

`mental_health_support_chat_augmented.json.gz` is a lossless gzip copy of the supplied augmented source file. The backend imports its records incrementally into persistent SQLite memory, without loading the 177 MB source into application memory. Every source row is retained; only records that pass a first-person mental-health relevance filter are eligible for retrieval. Chat messages are not stored.

The retrieval index supplements the existing `mental_health_support_chat.json` copy. This is data retrieval, not model-weight fine-tuning.
