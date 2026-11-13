# Manisika

A calming, responsive mental wellness and creative community prototype distilled from the November 12 brainstorming notes.

The shell's logo, warm cream base, lavender/sage/rose palette, rounded cards, and serif/sans type pairing are adapted from the local Figma export in `shivUIdes/MANASIKA Wellness Platform (UI)`. The existing Manisika notebook tabs and feature implementations remain in place.

## Ideas carried into the prototype

- A personal welcome with language and comfort sound preferences.
- A private daily emotional check-in, notes, calendar, and gentle history view.
- Recommendations that adapt to recent check-ins, including extra calming suggestions after three low days.
- A breathing timer, five-to-one grounding countdown, private reflection room, and supportive check-in bot.
- Anonymous, structured community posts around campus pressure, confidence, heartbreak, fresh starts, and creative expression, with basic harmful-language blocking and reporting controls.
- A human-led creative studio for finding music and art collaborators. It does not generate or autotune creative work.
- A crisis message that directs people to local emergency support and trusted people.
- A local, rule-based support library with grounding and self-kindness prompts informed by the [WHO stress management guide](https://www.who.int/publications/i/item/9789240003927).

## Run it

Run `node server.js`, then open [http://127.0.0.1:4173](http://127.0.0.1:4173). No packages, build step, or account are needed. Preferences, mood entries, reflections, and locally created posts are stored in that browser's local storage.

Build the container with `docker build -t manisika .` and run it with `docker run --rm -p 127.0.0.1:4173:4173 manisika`.

## Optional local model

The app can call an installed Ollama model through the Node server. The user must opt in under profile preferences; the browser sends chat turns to `/api/chat`, and the server forwards them only to the configured Ollama URL. It does not forward mood notes or event logs. Configure `MANISIKA_OLLAMA_URL` and `MANISIKA_OLLAMA_MODEL` in the server environment; `.env.example` shows the local endpoint. Without that configuration, chat uses its local rule-based fallback. No cloud provider is configured by default.

The onboarding profile asks about likes, dislikes, preferred language and sound, and an optional starting mood. Mood patterns summarize the user’s self-reported check-ins and chosen context; this is not raw keystroke analysis or a clinical assessment. Data events omit free-text mood notes. The user can export or clear local records from Mood patterns.

## Prototype boundaries

This is a local prototype, not a clinical or crisis service. It has no authentication, encryption, moderation service, location access, clinician directory, real-time messaging, or cross-device sync. Community examples are seeded demo content. The fallback bot uses local response rules and is not a therapist. No model fine-tuning has been performed; fine-tuning requires selecting a model, a permitted training dataset, and a training/runtime environment. Avoid storing sensitive information on a shared device.
