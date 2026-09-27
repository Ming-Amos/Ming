# Import a public GitHub project

Ming can retrieve a browser-ready static project from a public GitHub repository, then use the existing confirmed acceptance workflow on those actual files. It does not run a repository installation or build on a server.

## Use it

1. Open Ming, choose **Start**, then **GitHub repository** in the project section.
2. Paste the repository root URL, such as `https://github.com/owner/repository`. Expand the optional settings for a branch, tag, commit or static folder. Repository `tree/...` page URLs are not accepted because branch names can contain slashes.
3. Choose **Find website files**. Ming resolves the requested ref or default branch to a commit and lists candidate folders with HTML entries. Choose the folder that contains the finished website, usually a committed `dist`, `build`, `docs` or repository root.
4. Choose **Use this folder** and review the real isolated page. The source details preserve the repository and exact commit used.
5. Describe what should work, choose **Create my checklist**, review the proposed checks and choose **Approve and check**. Manual authoring is under **Advanced options**. The report and repair brief include the repository, ref, commit and folder as well as source/plan fingerprints.
6. After fixing the repository, inspect and import again to retrieve the new commit. Review and rerun the original plan. The earlier result remains preserved. A comparison only treats two GitHub runs as the same source target when their repository and selected folder match.

## What is supported

- Public `https://github.com/owner/repository` URLs. No GitHub sign-in or token is requested.
- An optional branch, tag or commit, including branch names containing `/` in the dedicated ref field.
- Committed static HTML/CSS/JavaScript, local images/fonts and supported acyclic relative modules. The same compatibility limits apply as HTML/ZIP import.
- Bounded downloads: at most 100 selected static files, 20 MB unpacked, 10 MB per downloaded file and a 10 MB compressed snapshot. Repository tree inspection is bounded to 10,000 entries and a 2 MB API response.
- Progress, cancellation and actionable messages for inaccessible repositories, missing refs, rate limits, incomplete source builds, incompatible assets or oversized folders.

Private repositories, GitHub Enterprise hosts, submodules, symlink files, dependency installation, backend services, database setup and automatic builds are not available in this flow. For a private project or an uncommitted build, export the supported static output locally and upload its HTML/ZIP. Applications that need external APIs still need the full local runner.

## Source identity and privacy

Inspection performs anonymous read requests to `api.github.com`. Only after import confirmation are selected static file contents fetched from `raw.githubusercontent.com`, at the immutable commit. Each file's size and Git blob checksum must match the inspected tree. Failed or cancelled imports do not replace the previous project with partial data. Secrets/configuration paths, dependency directories and irrelevant repository metadata are excluded before file downloads.

No repository credentials, local files or test results are sent to a Ming server. Importing communicates with GitHub; execution afterward uses the same opaque isolated preview and blocked external-resource policy as file uploads. GitHub's API supports browser cross-origin requests; anonymous access can be rate limited. See [GitHub CORS documentation](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests).

Ref inspection is a point-in-time operation. If the branch changes afterward, the pending import still fetches the already displayed commit; inspect again for the latest version. A passing run establishes the outcomes of the approved checks on the imported static snapshot, not full application correctness or automatic AI repair. Importing and running checks consumes no model API or Bobcoins. **Create my checklist** makes a separately disclosed, billable model request; see [Doubao planning](DOUBAO_PLANNING.md).
