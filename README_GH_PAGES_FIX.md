# GitHub Pages deployment fix

## Root cause
The file `SemaTel.html` contained invalid/duplicated HTML structure (multiple `head`/`body` blocks). That can prevent GitHub Pages from reliably serving or for the app to load correctly.

## Applied changes
- Ensured `SemaTel.html` is a valid single HTML document.

## Validate
1. Push changes to `main`.
2. In your repo: **Settings → Pages** → verify Source is `main / (root)`.
3. Test the deployed URL in a private window.


