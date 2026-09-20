# Card regressions

`representative-atomic.json` is a field-reduced excerpt of MTGJSON AtomicCards,
source date 2026-09-19. It retains original rules text, face information and rulings;
printing/price/foreign-language fields are omitted. Attribution and license:
../../public/NOTICE.txt. Tests do not download anything.

The Node display tests invoke the actual Python transform, then verify all faces,
paragraphs, stats and rulings survive rendering. Python unit tests independently
cover deduplication, out-of-order faces/rulings and empty input.
