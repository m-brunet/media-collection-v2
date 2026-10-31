# Editions and omnibus coverage: product impact

Status: Task 1 decisions consolidated. Read [Collections and shopping](collections.md) for authoritative rules and acceptance examples. This analysis explains their consequences without prescribing technical design.

## Books and volume counts are different

A saved edition is a book record. Separate editions can have different ISBNs, covers, locations, personal reading states, and loans. Multiple separately tracked copies of an identical edition/ISBN remain excluded.

A collection counts distinct covered volume numbers. An Owned omnibus covering 1-3 is one book satisfying three volumes. Another Owned edition of volume 2 adds one book, but no additional volume progress. Expected totals are derived from the starting volume (0 or 1) through the highest saved coverage, Owned or Not Owned.

Example: Owned 1, 2, 3 paperback, 3 hardcover, and 5 are five books, four distinct owned volumes, five expected volumes, and missing volume 4. Labels must distinguish book/edition counts from volume completeness.

## Ownership and shopping

Any Owned coverage satisfies a volume once. Only Owned books may overlap. Not Owned coverage cannot overlap another Not Owned or Owned book. These checks apply to creation and later changes. ISBN uniqueness addresses same identified editions; coverage validation additionally addresses different editions and omnibus overlaps.

Missing volumes without saved records remain inferred, not incomplete books. Mobile shopping is compact: volume labels, an emphasized highest Owned volume, and no Owned-edition picker. A single eligible ordinary saved Not Owned record can be marked Owned only after confirmation. Omnibus quick add is excluded. Ambiguous coverage, if encountered, has no quick add.

## Conflict resolution and data preservation

For a purchased Owned edition conflicting with one planned record, explicitly cancel, delete the planned record and continue, or update that record to the purchased edition and mark Owned. Different-edition replacement must update edition information rather than falsely claim ownership of the old edition.

For an omnibus overlapping several planned records, explicitly cancel or delete those planned books and add the purchased omnibus. Partial-overlap replacement removes the entire planned record with a warning, potentially shrinking the expected range. Never silently split, trim, generate, or delete book records.

Pre-registering Not Owned books is extremely rare. These safeguards must not turn MC into a wishlist/planning catalogue.

## Grouping and other features

Desktop collection details group editions under expandable volume entries. One omnibus covering several numbers must still be recognizable as one book when choosing an edition for editing, location, or lending. A book-level action must identify the actual book, not only a volume number.

Removing one Owned edition does not create a missing volume while another Owned book still covers it. Removing highest coverage recalculates the range; removing the final member removes the collection. Finished reopens when missing coverage remains, but complete ownership never automatically marks Finished.

Lending acts on a specific book, with one active loan per book. The explicit confirmation that lending leaves ownership/collection completeness unchanged is assigned to the lending follow-up, not inferred here. No per-user reading-state propagation between editions is implied.

## Assigned follow-ups

- Task 2: shared name matching and duplicate handling for books without ISBNs.
- Task 4: remaining lending interactions and their independence from collection ownership.
- Task 6: exact count labels, omnibus presentation within expandable entries, title differences in compact mobile summaries, and missing/error states. These refinements do not reopen coverage calculations.
- Technical agents: choose implementation details after reading the confirmed business rules; this document selects no schema, contracts, or algorithms.
