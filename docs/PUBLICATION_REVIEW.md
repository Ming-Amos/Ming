# Publication review — 2026-09-26

Final artifact update: the narrated MP4 is 164 seconds and 10,410,417 bytes. Twelve representative frames, full decoding and audio levels passed review; see `submission/video-notes.md`. Git attributes preserve binary media and exact recorded-evidence bytes. The staged Git versions of all 26 manifest files matched their expected hashes, and the PDF and repaired target matched their local source bytes before the implementation commit.

Scope: the current Git publication candidates, selected demo bundle, Bob evidence, submission assets, and the public/local startup boundary. This review does not publish anything or establish competition eligibility.

## Result

No unresolved P1 issue was found in this bounded review. Two concrete P2 issues were identified and corrected before the publication checkpoint:

1. **Public Express mode could mix reviewed evidence with existing local runtime records.** `scripts/start.mjs` now creates a fresh, owned `runtime/public-demo-*` directory and copies only `docs/demo-evidence/runtime` into it. Public mode ignores an existing runtime override, passes the isolated location to the child server before startup, and removes only its owned directory after the child exits. The default local runtime and existing records are not overwritten. The separate Sites Worker already serves an explicit response map and was not affected.
2. **The Windows local launcher could reuse a read-only viewer as though it were the full application.** `scripts/Start-Ming.ps1` now recognizes that mode and reports a clear port conflict without stopping or replacing the viewer. Only a healthy writable Ming service is reused.

## Checks actually performed

- Enumerated tracked and unignored candidate files using Git rather than scanning `node_modules` or private runtime data. The initial scan covered 157 files; later final UI images and publication metadata were separately inspected as they appeared.
- Checked text candidates for private-key headers, common token forms, long secret assignments, and personal webmail addresses. No actual credential or personal email was identified. The sole token-like match was the explicitly named `fakeKey` in a secret-redaction test, not a live credential. No secret value was printed during this review.
- Read `.gitignore`, `.bobignore`, and `.dockerignore`. Local environment files, credentials, dependency/build directories, and the root runtime directory are excluded from Git candidates. Required Bob screenshots and explicitly reviewed evidence remain included.
- Verified **26 / 26 manifest SHA-256 hashes**. The same 26 original local runtime files also match those hashes byte-for-byte. All six exported run responses match the corresponding saved run JSON; the exported comparison exactly matches the manifest's comparison.
- Recomputed the captured before/after HTML source fingerprints: `4d61d95b3ffbc28d` and `29ebdc69fb588289`. They match the recorded comparison. The original failing baseline is retained.
- All eight Bob PNG files are unchanged from the previous committed originals. Visually inspected all eight: task identifiers, workspace names, costs, code/task text and the genuine budget-stop notice are visible; no account email, API key, or password was found. The MCP connection image is correctly distinguished from proof of agent execution.
- Visually inspected the final desktop, mobile, comparison, and concept-versus-implementation UI images. They show sample data. The concept/reference side is distinguishable from the actual running interface and is not used as browser execution evidence.
- The largest candidate at the initial scan was the PDF at **2,578,732 bytes**; the later comparison image is about 2 MB. No checked file approaches a 100 MB single-file threshold. The final narrated video must be checked separately when created; it did not exist during this scan.
- Startup isolation check on a dedicated port **4183**: the public history returned exactly the six reviewed runs; a pre-existing private marker in an explicitly supplied runtime remained untouched and returned **404** through the public API. The local launcher rejected that read-only service and the service remained healthy. The owned review processes were stopped; ports 4000 and 4001 were not altered.
- The startup script passed syntax validation. A final assertion of the isolation/rejection results and stopped review port exited with code 0. The launcher rejection itself is intentionally nonzero and is not a startup success.

## Attribution, audience, and remaining limits

The README, statements, slide notes and evidence README attribute the initial A/B implementation and partial repair/MCP foundations to Bob, and the later completion and actual recorded repair to Codex. Fixture plans and seeded defects are explicitly labeled; no live provider result or measured speedup is claimed. The cover is identified as concept artwork.

The Sites source and GitHub repository were being prepared privately at this checkpoint. A successful private deployment does not make a public judging URL. Public access, signed-out URL verification, the final narrated video, and final delivery checklist updates remain separate steps. Account eligibility remains subject to the organizer's confirmation.

This was a bounded candidate-file and visible-image review, not a full historical Git secret audit, exhaustive OCR of every binary asset, or a security certification. Any newly added source, evidence, narration, or publication credentials need the same review before public release. Never persist the temporary Sites Git credential in a source file or remote URL.
