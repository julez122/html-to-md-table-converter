# Project context

This project is a fully local HTML-table-to-Markdown converter. Its only runtime files are `index.html`, `styles.css`, and `app.js`; opening `index.html` directly in a browser must remain supported.

## Important behavior

- No backend, framework, build step, package manager, or network access is used.
- Tables are converted from a reconstructed logical two-dimensional grid so `rowspan` and `colspan` never shift later cells into incorrect columns.
- Flattened body spans repeat their value in each covered logical cell.
- Header rows come from `<thead>` or a leading all-`<th>` block. Tables without one receive neutral `Column N` headers and retain every source row as data.
- Nested tables are independently converted in document order. Their rows are excluded from the parent grid and their markup is excluded from the parent cell's inline text.
- Images convert from their `src`; when enclosed by an anchor, that href becomes the outer Markdown link. Ordinary text links retain normal Markdown-link output.
- The optional Source page URL is used with `new URL(relativeUrl, sourcePageUrl)` for relative/root-relative image and text links; with no source URL, destinations are preserved as written.
- Built-in console tests in `app.js` assert logical grids and Markdown results for the supported table patterns.
- The phone layout uses an auto-fitting CSS grid for actions, shrink-safe textareas, and breakable supporting text so labels and controls stay inside the viewport.
