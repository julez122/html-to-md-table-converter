# HTML Table to Markdown Table

<p align="center">
<a href="https://ibb.co/6cDqtp29"><img src="https://i.ibb.co/j93jwxd0/html-to-md.png" alt="html to md" border="0" width="80%"></a>
</p>

A dependency-free, mobile-friendly HTML table and MediaWiki gallery converter. Open `index.html` directly in a modern browser, paste HTML or attach a saved HTML file, then select Convert to turn all discovered tables and galleries into Markdown. The app uses only local browser features. It does not upload, store, or send pasted HTML anywhere.

## Table Of Contents

 - [Features](#features)
 - [Use](#use)
 - [Installation](#installation)
   - [Git](#git)
   - [Manual](#manual)
 - [Updating](#updating)
   - [Git](#git)
   - [Manual](#manual)

## Features

- Reconstructs logical table grids before generating Markdown, including `rowspan`, `colspan`, empty cells, and uneven rows.
- Combines multi-level column headings and uses neutral `Column 1`, `Column 2`, and similar headers when a table has no identifiable header.
- Preserves common inline content such as links, bold, italics, code, and line breaks.
- Preserves linked images in normal table cells as Markdown image links, using the image `src` to render the image and its enclosing anchor for the click-through destination.
- Converts MediaWiki `ul.gallery` lists into `Image` / `Name` Markdown tables, with one row per direct `li.gallerybox`. Images come from `.thumb img`, captions from `.gallerytext`, and image click-through links from `.gallerytext a[href]`. Adds a `##` heading from the nearest `role="tabpanel"` element's `id` before each gallery, including galleries in hidden panels. Unrelated lists, tab buttons, edit controls, and OOUI wrappers are ignored.
- Optionally resolves relative, root-relative, and protocol-relative links or image destinations against a supplied source-page URL; empty source URLs leave HTML URLs untouched.
- Reads local `.html`, `.htm`, and `.xhtml` files without uploading them, extracting only supported table/gallery markup and the tab-panel wrappers needed for gallery headings into the existing input. Gallery-only files are supported.
- Converts mixed tables and galleries in document order, keeping nested structures once in the imported HTML and converting them separately without repeating their contents in parent cells.
- Treats nested tables as separate tables so their rows cannot shift the parent table's cells.
- Includes copy, Markdown download, and clear actions that work locally without a server.
- Uses an auto-fitting action grid and shrink-safe text fields to keep controls inside narrow phone viewports.

## Use

1. Open `index.html` in Chrome or another current browser, including on Android.
2. If your tables or galleries have relative, root-relative, or protocol-relative links such as `/wiki/...` or `//static.wikitide.net/...`, paste the website link in **Source page URL**. This also applies to attached HTML files. Otherwise, leave it blank to preserve URLs as written.
3. Paste HTML into **HTML input**, or choose a saved HTML file with **Attach HTML File**. Selecting a file extracts supported raw HTML into the input and clears the old output; Markdown is generated only when you select Convert.
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
