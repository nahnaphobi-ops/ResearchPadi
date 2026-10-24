# ResearchPadi for Microsoft Word

A task pane add-in that brings ResearchPadi into Word (Windows, Mac and Word on the web):

- **Write**: Improve, Fix grammar, Academic tone, Shorten, Simplify (Free plan included) and Expand (paid) on the selected text; **Continue writing** at the cursor (same daily allowance as autocomplete on the site).
- **Cite**: search sources (Ghanaian repositories first, then OpenAlex and Semantic Scholar), cite at the cursor, switch between all eight citation styles, and insert or update the reference list at the end of the document. Citations are hidden content controls, so they renumber and relabel when the style changes; the sources travel inside the .docx.

Students sign in with the same phone number and code as on the site.

## Files

| What | Where |
| --- | --- |
| Task pane page | `frontend/word.html` → `frontend/src/word/` (built with the site, served at `https://researchpadi.com/word.html`) |
| Manifest | `frontend/public/word-addin/manifest.xml` (served at `https://researchpadi.com/word-addin/manifest.xml`) |
| Icons | `frontend/public/word-addin/icon-*.png` |
| Framing | `frontend/vercel.json` lets Office (and only Office) show `word.html` in a frame, which Word on the web needs |

The pane needs WordApi 1.3 (Word 2016 or later, Microsoft 365, Word on the web).

## Try it yourself (sideload)

Deploy first, so `https://researchpadi.com/word.html` is live. Then:

- **Word on the web**: open a document › Home › Add-ins › More Add-ins › My Add-ins › Upload My Add-in › choose `manifest.xml`.
- **Word on Windows**: put `manifest.xml` in a shared folder, add that folder under File › Options › Trust Center › Trust Center Settings › Trusted Add-in Catalogs (tick "Show in Menu"), restart Word, then Home › Add-ins › Shared Folder.
- **Word on Mac**: copy `manifest.xml` to `~/Library/Containers/com.microsoft.Word/Data/Documents/wef/` and restart Word.

The ResearchPadi button appears on the Home tab.

## Publish to everyone (Microsoft Marketplace)

This needs your Microsoft account; it cannot be done from the code.

1. Create a Microsoft Partner Center account (free) at https://partner.microsoft.com and enrol in the Microsoft 365 and Copilot program.
2. In Partner Center: Marketplace offers › New offer › Office add-in. Upload `manifest.xml`.
3. Fill in the listing: description, at least one screenshot (1366×768) of the pane in Word, the 300×300 logo, privacy policy URL (`https://researchpadi.com/privacy`), terms (`https://researchpadi.com/terms`) and support URL.
4. Give Microsoft's testers a working sign-in: a test phone number and code (the demo account `+233200000000` / `123456` works when `DEMO_LOGIN` is on).
5. Submit. Validation usually takes 3 to 5 working days; Microsoft emails any fixes they need.

Before submitting, validate the manifest:

```bash
npx office-addin-manifest validate frontend/public/word-addin/manifest.xml
```

For a school or company, an admin can instead deploy `manifest.xml` to everyone in their Microsoft 365 tenant from the Microsoft 365 admin centre › Settings › Integrated apps.
