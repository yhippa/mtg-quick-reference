"""Hash pinned research inputs and implementation for auditability."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent
paths = sorted(p for p in root.rglob("*") if p.is_file()
               and "results" not in p.relative_to(root).parts
               and "__pycache__" not in p.parts)
shared = ["scripts/rules_parser.py", "scripts/fetch_rules.py", "src/rules-search.ts", "src/search.ts"]
shared_hashes = {path: hashlib.sha256((root.parents[1] / path).read_bytes()).hexdigest() for path in shared}
manifest = {"sharedProductionInputsSha256": shared_hashes,"algorithm": "sha256", "pathBase": "research/omnisearch",
            "files": {str(p.relative_to(root)): {"bytes": p.stat().st_size,
                       "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
                      for p in paths}}
(root / "results/manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(f"Hashed {len(paths)} research inputs and implementation files")
