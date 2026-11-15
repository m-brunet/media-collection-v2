# Issue #82 — The publisher's collection as a second publisher choice

Status: **done** (2026-11-15). Decisions by the user on 2026-11-15 (GitHub issue #82), plan approved on 2026-11-15.
Branch `feat/lookup-publisher-collection`, one pull request.

Owning docs: [book entry](../product/book-entry.md#lookup-sources) and [collections](../product/collections.md#add-missing-volumes).

## Rules

- **Where it comes from:** BnF only. The UNIMARC record gives the publisher in `210`/`214 $c` and the publisher's
  collection in `225 $a` (series statement). `UnimarcRecord` takes the first `225 $a` whose name is not the book's
  series (`461 $t`, or the title used as series), compared without case, accents or punctuation (`NameKey.words`).
  Its numbering (`$v`) and ISSN (`$x`) are dropped, and so are the brackets of a name supplied by the cataloguer
  ("[Collection Akira]" → "Collection Akira").
- **Single book lookup:** the publisher choices are each source's publisher, then its publisher's collection, the
  preferred source first. The first stays selected. Equal names make one choice credited to every source that gives
  them; "LGF" and "Librairie générale française" stay apart.
- **Adding missing volumes:** each edition found carries its publishers (publisher, then publisher's collection, each
  name once). Each volume starts on its own first publisher; the review has a **Publisher** column (a list when there
  are two, the name when there is one, "As volume N" when there is none) and a **Publisher of every volume** list
  above the table (shown when the volumes found have more than one publisher between them). Choosing one sets it on
  every volume being added; a row can then be changed; *Each volume's own* puts the defaults back. The request carries
  the publisher of each volume; a volume without one takes the anchor's, as before. Books already in the library are
  never changed.

## Acceptance examples

1. Ewilan 1 (BnF): publishers "Librairie générale française" (selected) and "Le livre de poche", both from BnF.
2. Passe-miroir 1: "Gallimard jeunesse" and "Pôle fiction". Claymore 15: "Glénat" and "Shonen manga".
3. Blacksad 1 (its only `225` is the series), Solo Leveling 17 and Rose Hip Rose 1 (no `225`): one publisher.
4. BnF gives "Le livre de poche" as collection and Open Library "Le Livre de Poche" as publisher: one choice, credited
   to BnF and Open Library.
5. Volumes 2 (Glénat, Seinen manga), 3 (Kana) and 4 (none) to add: volume 2 starts on Glénat with a list, volume 3
   shows Kana, volume 4 shows "As volume 1". *Publisher of every volume* = Seinen manga, then volume 3 back to Kana:
   the request sends Seinen manga, Kana, Seinen manga.
