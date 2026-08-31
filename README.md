# HTML Table to Markdown

A dependency-free, mobile-friendly HTML table converter. Open `index.html` directly in a modern browser, paste an HTML table or a larger HTML fragment, and convert all discovered tables into Markdown.

## Features

- Reconstructs logical table grids before generating Markdown, including `rowspan`, `colspan`, empty cells, and uneven rows.
- Combines multi-level column headings and uses neutral `Column 1`, `Column 2`, and similar headers when a table has no identifiable header.
- Preserves common inline content such as links, bold, italics, code, and line breaks.
- Treats nested tables as separate tables so their rows cannot shift the parent table's cells.
- Includes copy, Markdown download, and clear actions that work locally without a server.
- Uses an auto-fitting action grid and shrink-safe text fields to keep controls inside narrow phone viewports.

## Use

1. Open `index.html` in Chrome or another current browser, including on Android.
2. Paste HTML into **HTML input**.
3. Select **Convert**.
4. Copy the result, edit it if desired, or download it as `tables.md`.

The app uses only local browser features. It does not upload, store, or send pasted HTML anywhere.

## Verification

`app.js` runs built-in structural conversion tests when the page loads and reports their result in the browser console. The tests cover span handling, multi-row headers, missing cells, inline formatting, Wikipedia-style markup, multiple tables, and nested-table isolation.
