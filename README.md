# HTML Table to Markdown Table

<p align="center">
<a href="https://ibb.co/6cDqtp29"><img src="https://i.ibb.co/j93jwxd0/html-to-md.png" alt="html to md" border="0" width="80%"></a>
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

1. Run the following in your shell:

```bash
git clone https://github.com/julez122/html-to-md-table-converter.git
```
2. Open the folder.
3. Open `index.html`.


### Manual

1. If you're on mobile or a device without Git installed, either download the files individually or [download the zip](https://github.com/julez122/html-to-md-table-converter/releases/download/v4/html-to-md-table-converter-v4.zip).
2. Extract the zip file.
3. Open the folder.
4. Open `index.html`.

## Updating

### Git

Open the shell in your `html-to-md-table-converter` folder and simply run:

```bash
git pull
```

### Manual

If you don't use Git, update manually:

1. Download the latest release from the [Releases page](https://github.com/julez122/html-to-md-table-converter/releases/latest).
2. Extract the downloaded ZIP file.
3. If you have no local changes: copy the extracted files into your existing `html-to-md-table-converter` folder and overwrite when prompted.
4. If you have local edits you want to keep: first back up your folder, or extract the release to a new folder and selectively merge files.
5. Open `index.html` in your browser to run the updated app.
