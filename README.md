# HTML Table to Markdown Table

<p align="center">
<a href="https://ibb.co/s9t2cLLs"><img src="https://i.ibb.co/Wvs67SSB/html-to-md.png" width="90%" alt="html-to-md" border="0" /></a>
</p>

A dependency-free, mobile-friendly HTML table converter. Open `index.html` directly in a modern browser, paste an HTML table or a larger HTML fragment, and convert all discovered tables into Markdown. The app uses only local browser features. It does not upload, store, or send pasted HTML anywhere.

## Features

- Reconstructs logical table grids before generating Markdown, including `rowspan`, `colspan`, empty cells, and uneven rows.
- Combines multi-level column headings and uses neutral `Column 1`, `Column 2`, and similar headers when a table has no identifiable header.
- Preserves common inline content such as links, bold, italics, code, and line breaks.
- Preserves linked images as Markdown image links, using the image `src` to render the image and its enclosing anchor for the click-through destination.
- Optionally resolves relative and root-relative links or image destinations against a supplied source-page URL; empty source URLs leave HTML URLs untouched.
- Reads local `.html`, `.htm`, and `.xhtml` files without uploading them, extracting only their table markup into the existing input.
- Treats nested tables as separate tables so their rows cannot shift the parent table's cells.
- Includes copy, Markdown download, and clear actions that work locally without a server.
- Uses an auto-fitting action grid and shrink-safe text fields to keep controls inside narrow phone viewports.

## Use

1. Open `index.html` in Chrome or another current browser, including on Android.
2. If your table has relative or root-relative links such as `/wiki/...`, paste the website link in **Source page URL**. Otherwise, leave it blank.
3. Paste HTML into **HTML input**, or choose a saved HTML file with **Attach HTML File**. Selecting a file extracts its table markup into the input but does not convert automatically.
4. Select **Convert**.
5. Copy the result, edit it if desired, or download it as `tables.md`.

## Installation

### Git

Run the following in your shell:

```bash
git clone https://github.com/julez122/html-to-md-table-converter.git
```

### Manual

If you're on mobile or a device without Git installed, either download the files individually or [download the zip](https://github.com/julez122/html-to-md-table-converter/releases/download/v4/html-to-md-table-converter-v4.zip).

## Updating

### Git

Open the shell in your `html-to-md-table-converter` folder and simply run:

```bash
git pull
```

### Manual

Download the latest [Release](https://github.com/julez122/html-to-md-table-converter/releases), extract it and replace the previous files.
