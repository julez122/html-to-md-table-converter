# HTML Table to Markdown

A dependency-free, mobile-friendly HTML table converter. Open `index.html` directly in a modern browser, paste an HTML table or a larger HTML fragment, and convert all discovered tables into Markdown.

## Features

- Reconstructs logical table grids before generating Markdown, including `rowspan`, `colspan`, empty cells, and uneven rows.
- Combines multi-level column headings and uses neutral `Column 1`, `Column 2`, and similar headers when a table has no identifiable header.
- Preserves common inline content such as links, bold, italics, code, and line breaks.
- Preserves images as Markdown images, preferring an enclosing image link over the image `src` without resolving relative URLs.
- Optionally resolves relative and root-relative links or image destinations against a supplied source-page URL; empty source URLs leave HTML URLs untouched.
- Treats nested tables as separate tables so their rows cannot shift the parent table's cells.
- Includes copy, Markdown download, and clear actions that work locally without a server.
- Uses an auto-fitting action grid and shrink-safe text fields to keep controls inside narrow phone viewports.

## Installation

### Git

Run the following in your shell:

```
git clone https://github.com/julez122/html-to-md-table-converter.git
```

### Manual

If you're on mobile or a device without Git installed, either download the files individually or [download the zip](https://github.com/julez122/html-to-md-table-converter/releases/download/Release/html-to-md-table-converter.zip).

## Use

1. Open `index.html` in Chrome or another current browser, including on Android.
2. Paste HTML into **HTML input**.
3. Select **Convert**.
4. Copy the result, edit it if desired, or download it as `tables.md`.

The app uses only local browser features. It does not upload, store, or send pasted HTML anywhere.
