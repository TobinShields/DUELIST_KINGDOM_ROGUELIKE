# Contributing

The most useful thing you can send is a **report**, and the game makes it easy.

## Reporting a bug or an AI misplay

Use the **Report** button: it's in the duel's top bar and on the end-of-duel
screen. It downloads the duel log and opens a form on this repository's
[issues page](https://github.com/circlenline/DUELIST_KINGDOM_ROGUELIKE/issues/new/choose)
with the version, mode, decks, turn and last plays already filled in.
Drag the log file into the form and send it. You need a free GitHub account.

The log has the seed, both shuffled decks and every message the rules engine
produced, so the exact duel can be replayed move by move. Without it, a report
is guesswork.

A good report:

> Turn 7: the AI used Snatch Steal on my Scapegoat token while I had Jinzo on
> the field. Log attached.

Two kinds of reports:

- **Bug** — something broke, froze, looks wrong on screen, or a ruling doesn't
  work the way GOAT rulings say it should.
- **AI misplay** — the game worked, but the bot made a play a good GOAT player
  wouldn't. Say what you'd have done instead.

If you're on **iPhone or iPad**, please mention it: there was no iOS device to
test on, so those reports are especially welcome.

## Working on the code

`engine/browser/` is where the game lives; `engine/deckbuilder/` is the deck
builder. Two rules of the house:

1. **The two HTML files are generated.** Never edit `goat-simulador.html` or
   `deckbuilder.html` by hand: edit the sources under `engine/` and rebuild
   (`node build-html.mjs` in `engine/browser`, `node build.mjs` in
   `engine/deckbuilder`).
2. **Every fix comes with a check.** The suite (`node check-*.mjs` in
   `engine/browser`) runs the real HTML against a DOM stub. Every check in
   there exists because a bug got through without it.

For anything about the AI, measure before and after: `torneo.mjs` with at
least 250 games per pairing, plus the position bench (`banco.mjs`). At 60 games
the noise is ±13 points and it will tell you whatever you want to hear.

## People

- **[circlenline](https://github.com/circlenline)** — design, play-testing, bug hunting
- **Claude (Anthropic)** — implementation, test suite and tooling, vibe coded together
