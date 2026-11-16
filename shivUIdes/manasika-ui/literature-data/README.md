# AI Companion literature corpus

`public-domain-literature.json.gz` is a server-side retrieval corpus. It contains short, page or section indexed chunks from:

- *White Nights and Other Stories*, Fyodor Dostoevsky, translated by Constance Garnett, 1918 edition. The supplied scan is image-only; the corpus uses its OCR transcription from the same Internet Archive item. The edition was published before 1931 and is public domain in the United States.
- *The Metamorphosis*, Franz Kafka, translated by Ian Johnston. The supplied PDF says the translation was released to the public domain in January 1999.

The server imports these chunks into the persistent `ai_companion_literature` SQLite table. Replies use this corpus only for literary questions, quote at most 25 words, and name the source.

The supplied 1976 *A Textbook of Human Psychology*, edited by H. J. Eysenck and G. D. Wilson, has an explicit copyright notice. Its text is **not** included in this repository or Docker image. For the user's private local copy only, `scripts/import-private-psychology-pdf.py` indexes it into the ignored `data/creative.sqlite` database. Any resulting replies are labeled as historical educational context and are not clinical guidance. Do not publish that database or its extracted text without appropriate rights.

This is retrieval-augmented memory, not fine-tuning. Manasika currently has no trainable language-model weights or model-training pipeline connected to this backend.
