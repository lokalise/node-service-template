# Database identifiers

- In order to support efficient [cursor-based pagination](https://brunoscheufler.com/blog/2022-01-01-paginating-large-ordered-datasets-with-cursor-based-pagination), it is preferable to use identifiers that provide efficient lexicographical and chronological sorting of generated identifiers without any additional processing, such as ULIDs or CUIDs.
- ULID is our recommended approach for databases that support it (e. g. CockroachDB can generate them via "gen_random_ulid()" function).
- At the time of writing, PostgreSQL doesn't natively support generating either ULIDs nor CUIDs. However, there are [ongoing efforts](https://commitfest.postgresql.org/47/4388/) to implement UUID v7 support natively in PostgreSQL, which would address the same need. See also an [RFC](https://www.rfc-editor.org/info/rfc9562).
- For compatibility reasons, we are using CUID (v1) in the template, because this is what Prisma supports. However, you are recommended to use plain UUIDs + createdAt-based cursors for highly sensitive use-cases with strict security requirements. See [documentation](https://github.com/paralleldrive/cuid2) from CUID2 authors for the details.
