(() => {
  'use strict';

  const input = document.getElementById('html-input');
  const sourcePageUrlInput = document.getElementById('source-page-url');
  const htmlFileInput = document.getElementById('html-file-input');
  const output = document.getElementById('markdown-output');
  const status = document.getElementById('status');
  const convertButton = document.getElementById('convert-button');
  const copyButton = document.getElementById('copy-button');
  const downloadButton = document.getElementById('download-button');
  const clearButton = document.getElementById('clear-button');

  const BLOCK_TAGS = new Set(['ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'SECTION', 'UL']);
  const IGNORED_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'CANVAS']);
  const STRUCTURE_SELECTOR = 'table, ul.gallery';
  let fileLoadToken = 0;

  function setStatus(message, state = 'info') {
    status.textContent = message;
    status.dataset.state = state;
  }

  function parseDocument(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  function ownedRows(table) {
    return Array.from(table.querySelectorAll('tr')).filter((row) => row.closest('table') === table);
  }

  function directCells(row) {
    return Array.from(row.children).filter((child) => child.tagName === 'TH' || child.tagName === 'TD');
  }

  function spanValue(cell, name, remainingRows = Infinity) {
    const parsed = Number.parseInt(cell.getAttribute(name), 10);
    const value = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    return Math.min(value, 1000, remainingRows);
  }

  function buildLogicalGrid(table) {
    const rows = ownedRows(table);
    const grid = [];
    let width = 0;

    rows.forEach((row, rowIndex) => {
      if (!grid[rowIndex]) {
        grid[rowIndex] = [];
      }

      let columnIndex = 0;
      directCells(row).forEach((cell) => {
        while (grid[rowIndex][columnIndex]) {
          columnIndex += 1;
        }

        const rowSpan = spanValue(cell, 'rowspan', rows.length - rowIndex);
        const columnSpan = spanValue(cell, 'colspan');
        const entry = { cell, sourceRow: rowIndex, sourceColumn: columnIndex };

        for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
          const targetRow = rowIndex + rowOffset;
          if (!grid[targetRow]) {
            grid[targetRow] = [];
          }

          for (let columnOffset = 0; columnOffset < columnSpan; columnOffset += 1) {
            grid[targetRow][columnIndex + columnOffset] = entry;
          }
        }

        width = Math.max(width, columnIndex + columnSpan);
        columnIndex += columnSpan;
      });
    });

    const rectangularGrid = rows.map((_, rowIndex) => Array.from(
      { length: width },
      (_, columnIndex) => grid[rowIndex]?.[columnIndex] || null,
    ));

    return { rows, grid: rectangularGrid, width };
  }

  function isTheadRow(row, table) {
    const section = row.closest('thead');
    return Boolean(section && section.closest('table') === table);
  }

  function findHeaderRows(model, table) {
    const theadIndexes = model.rows
      .map((row, index) => (isTheadRow(row, table) ? index : -1))
      .filter((index) => index !== -1);

    if (theadIndexes.length > 0) {
      return theadIndexes;
    }

    const leadingHeaders = [];
    for (let index = 0; index < model.rows.length; index += 1) {
      const cells = directCells(model.rows[index]);
      const allHeaderCells = cells.length > 0 && cells.every((cell) => cell.tagName === 'TH');
      if (!allHeaderCells) {
        break;
      }
      leadingHeaders.push(index);
    }
    return leadingHeaders;
  }

  function escapeLinkDestination(destination) {
    return destination.replace(/([\\()])/g, '\\$1').replace(/\s/g, '%20');
  }

  function resolveDestination(destination, sourcePageUrl) {
    if (!destination || !sourcePageUrl || /^[a-z][a-z\d+.-]*:/i.test(destination)) {
      return destination;
    }

    try {
      return new URL(destination, sourcePageUrl).href;
    } catch (error) {
      return destination;
    }
  }

  function hasValidSourcePageUrl(sourcePageUrl) {
    if (!sourcePageUrl) {
      return true;
    }

    try {
      new URL(sourcePageUrl);
      return true;
    } catch (error) {
      return false;
    }
  }

  function isSupportedHtmlFile(file) {
    const name = file.name || '';
    const type = (file.type || '').toLowerCase();
    return /\.(?:html?|xhtml)$/i.test(name)
      || type === 'text/html'
      || type === 'application/xhtml+xml';
  }

  function extractSupportedMarkup(html) {
    const documentFragment = parseDocument(html);

    function extractChildren(parent) {
      const fragment = documentFragment.createDocumentFragment();
      Array.from(parent.children).forEach((child) => {
        if (child.matches(STRUCTURE_SELECTOR)) {
          // Retain nested structures inside their owner only once during import.
          fragment.append(child.cloneNode(true));
          return;
        }

        const content = extractChildren(child);
        if (child.matches('[role="tabpanel"]') && content.querySelector('ul.gallery')) {
          // Keep heading context without copying OOUI controls or wrapper attributes.
          const panel = documentFragment.createElement('div');
          panel.setAttribute('role', 'tabpanel');
          if (child.hasAttribute('id')) {
            panel.setAttribute('id', child.getAttribute('id'));
          }
          panel.append(content);
          fragment.append(panel);
        } else {
          fragment.append(content);
        }
      });
      return fragment;
    }

    return Array.from(extractChildren(documentFragment.body).children)
      .map((structure) => structure.outerHTML).join('\n\n');
  }

  function inlineCode(content) {
    const runs = content.match(/`+/g) || [];
    const longestRun = runs.reduce((length, run) => Math.max(length, run.length), 0);
    const fence = '`'.repeat(longestRun + 1);
    const needsPadding = /^`|`$/.test(content);
    return `${fence}${needsPadding ? ' ' : ''}${content}${needsPadding ? ' ' : ''}${fence}`;
  }

  function imageToMarkdown(image, sourcePageUrl, href = image.closest('a')?.getAttribute('href')) {
    const alt = image.getAttribute('alt')?.trim() || 'Image';
    const anchorHref = href?.trim();
    const source = image.getAttribute('src')?.trim();
    const imageDestination = resolveDestination(source || anchorHref || '', sourcePageUrl);
    const linkDestination = resolveDestination(anchorHref || '', sourcePageUrl);
    const markdownImage = `![${alt}](${imageDestination ? escapeLinkDestination(imageDestination) : ''})`;
    return source && linkDestination
      ? `[${markdownImage}](${escapeLinkDestination(linkDestination)})`
      : markdownImage;
  }

  function renderInlineChildren(node, sourcePageUrl) {
    return Array.from(node.childNodes).map((child) => renderInlineNode(child, sourcePageUrl)).join('');
  }

  function renderInlineNode(node, sourcePageUrl) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const tag = node.tagName;
    if (IGNORED_TAGS.has(tag)) {
      return '';
    }

    if (node.matches(STRUCTURE_SELECTOR)) {
      return ' ';
    }

    if (tag === 'BR') {
      return ' <br> ';
    }

    if (tag === 'IMG') {
      return imageToMarkdown(node, sourcePageUrl);
    }

    const content = renderInlineChildren(node, sourcePageUrl);
    if (tag === 'STRONG' || tag === 'B') {
      return content.trim() ? `**${content.trim()}**` : '';
    }

    if (tag === 'EM' || tag === 'I') {
      return content.trim() ? `*${content.trim()}*` : '';
    }

    if (tag === 'DEL' || tag === 'S' || tag === 'STRIKE') {
      return content.trim() ? `~~${content.trim()}~~` : '';
    }

    if (tag === 'CODE') {
      return content ? inlineCode(content) : '';
    }

    if (tag === 'A') {
      const label = content.trim();
      const href = node.getAttribute('href');
      if (node.querySelector('img')) {
        return label;
      }
      const destination = resolveDestination(href || '', sourcePageUrl);
      return label && destination ? `[${label}](${escapeLinkDestination(destination)})` : label;
    }

    if (BLOCK_TAGS.has(tag)) {
      return content.trim() ? ` ${content.trim()} <br> ` : '';
    }

    return content;
  }

  function normalizeCellMarkdown(value) {
    return value
      .replace(/\u00a0/g, ' ')
      .replace(/[\t\r\n\f ]+/g, ' ')
      .replace(/\s*<br>\s*/g, ' <br> ')
      .trim()
      .replace(/\|/g, '\\|');
  }

  function cellToMarkdown(cell, sourcePageUrl) {
    return normalizeCellMarkdown(renderInlineChildren(cell, sourcePageUrl));
  }

  function buildHeaders(model, headerRows, sourcePageUrl) {
    return Array.from({ length: model.width }, (_, columnIndex) => {
      const parts = [];
      headerRows.forEach((rowIndex) => {
        const entry = model.grid[rowIndex][columnIndex];
        const text = entry ? cellToMarkdown(entry.cell, sourcePageUrl) : '';
        if (text && !parts.includes(text)) {
          parts.push(text);
        }
      });
      return parts.join(' - ') || `Column ${columnIndex + 1}`;
    });
  }

  function formatMarkdownRow(cells) {
    return `| ${cells.join(' | ')} |`;
  }

  function tableToMarkdown(table, sourcePageUrl) {
    const model = buildLogicalGrid(table);
    const columnCount = Math.max(model.width, 1);
    const headerRows = findHeaderRows(model, table);
    const headerSet = new Set(headerRows);
    const headers = headerRows.length > 0
      ? buildHeaders({ ...model, width: columnCount }, headerRows, sourcePageUrl)
      : Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`);
    const bodyRows = model.grid
      .map((row, rowIndex) => ({ row, rowIndex }))
      .filter(({ rowIndex }) => !headerSet.has(rowIndex))
      .map(({ row }) => Array.from({ length: columnCount }, (_, columnIndex) => {
        const entry = row[columnIndex];
        return entry ? cellToMarkdown(entry.cell, sourcePageUrl) : '';
      }));

    return [
      formatMarkdownRow(headers),
      formatMarkdownRow(headers.map(() => '---')),
      ...bodyRows.map(formatMarkdownRow),
    ].join('\n');
  }

  function fallbackTable(table) {
    const content = table.cloneNode(true);
    content.querySelectorAll(STRUCTURE_SELECTOR).forEach((nested) => nested.replaceWith(' '));
    const text = normalizeCellMarkdown(content.textContent || '');
    return [
      '| Column 1 |',
      '| --- |',
      `| ${text} |`,
    ].join('\n');
  }

  function galleryToMarkdown(gallery, sourcePageUrl) {
    const items = Array.from(gallery.children).filter((child) => child.matches('li.gallerybox'));
    const rows = items.map((item) => {
      const content = item.cloneNode(true);
      // Nested tables/galleries get their own output; edit controls are not captions.
      content.querySelectorAll(`${STRUCTURE_SELECTOR}, .mw-editsection, .ht-editsection, [role="tab"]`)
        .forEach((nested) => nested.replaceWith(' '));
      const image = content.querySelector('.thumb img');
      const caption = content.querySelector('.gallerytext');
      const pageHref = caption?.querySelector('a[href]')?.getAttribute('href') || '';
      const imageMarkdown = image?.getAttribute('src')?.trim()
        ? normalizeCellMarkdown(imageToMarkdown(image, sourcePageUrl, pageHref))
        : '';
      return formatMarkdownRow([imageMarkdown, caption ? cellToMarkdown(caption, sourcePageUrl) : '']);
    });
    const markdown = ['| Image | Name |', '| --- | --- |', ...rows].join('\n');
    const panelId = gallery.closest('[role="tabpanel"]')?.getAttribute('id')?.trim();
    const heading = panelId?.replace(/\s+/g, ' ').replace(/([\\`*_[\]<>#])/g, '\\$1');
    return heading ? `## ${heading}\n\n${markdown}` : markdown;
  }

  function convertHtmlToMarkdown(html, sourcePageUrl = '') {
    const documentFragment = parseDocument(html);
    const structures = Array.from(documentFragment.querySelectorAll(STRUCTURE_SELECTOR));
    if (structures.length === 0) {
      return { markdown: '', count: 0 };
    }

    const markdownTables = structures.map((structure) => {
      if (structure.matches('ul.gallery')) {
        return galleryToMarkdown(structure, sourcePageUrl);
      }
      try {
        return tableToMarkdown(structure, sourcePageUrl);
      } catch (error) {
        console.warn('A table needed the fallback converter.', error);
        return fallbackTable(structure);
      }
    });

    return { markdown: markdownTables.join('\n\n'), count: structures.length };
  }

  function convertFromInput() {
    const sourcePageUrl = sourcePageUrlInput.value.trim();
    const result = convertHtmlToMarkdown(input.value, sourcePageUrl);
    output.value = result.markdown;
    if (result.count === 0) {
      setStatus('No HTML table or MediaWiki gallery was found.', 'error');
      return;
    }
    if (sourcePageUrl && !hasValidSourcePageUrl(sourcePageUrl)) {
      setStatus(`Converted ${result.count} ${result.count === 1 ? 'table' : 'tables'}, but the invalid source page URL was ignored.`, 'error');
      return;
    }
    setStatus(`Converted ${result.count} ${result.count === 1 ? 'table' : 'tables'}.`);
  }

  async function copyMarkdown() {
    if (!output.value) {
      setStatus('There is no Markdown to copy.', 'error');
      return;
    }

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(output.value);
        setStatus('Markdown copied.');
        return;
      }
    } catch (error) {
      console.info('Clipboard API was unavailable; using the selection fallback.', error);
    }

    output.focus();
    output.select();
    const copied = document.execCommand('copy');
    setStatus(copied ? 'Markdown copied.' : 'Copy was blocked. Select the output and copy it manually.', copied ? 'info' : 'error');
  }

  function downloadMarkdown() {
    if (!output.value) {
      setStatus('There is no Markdown to download.', 'error');
      return;
    }

    const file = new Blob([output.value], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tables.md';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Markdown download started.');
  }

  function clearAll() {
    fileLoadToken += 1;
    input.value = '';
    sourcePageUrlInput.value = '';
    htmlFileInput.value = '';
    output.value = '';
    setStatus('Cleared.');
    input.focus();
  }

  async function loadHtmlFile() {
    const file = htmlFileInput.files?.[0];
    if (!file) {
      return;
    }

    if (!isSupportedHtmlFile(file)) {
      htmlFileInput.value = '';
      setStatus('Choose an HTML file with a .html, .htm, or .xhtml extension.', 'error');
      return;
    }

    const requestToken = ++fileLoadToken;
    setStatus(`Reading ${file.name}…`);
    try {
      const supportedMarkup = extractSupportedMarkup(await file.text());
      if (requestToken !== fileLoadToken) {
        return;
      }
      if (!supportedMarkup) {
        setStatus(`No HTML table or MediaWiki gallery was found in ${file.name}.`, 'error');
        return;
      }
      input.value = supportedMarkup;
      output.value = '';
      setStatus(`Loaded table/gallery markup from ${file.name}. Select Convert to process it.`);
    } catch (error) {
      if (requestToken === fileLoadToken) {
        setStatus(`Could not read ${file.name}. Try choosing the file again.`, 'error');
      }
    }
  }

  function assertEqual(actual, expected, name) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
      throw new Error(`${name} failed. Expected ${expectedJson}, received ${actualJson}.`);
    }
  }

  function gridText(html) {
    const documentFragment = parseDocument(html);
    const table = documentFragment.querySelector('table');
    const model = buildLogicalGrid(table);
    return model.grid.map((row) => row.map((entry) => (entry ? cellToMarkdown(entry.cell) : '')));
  }

  function runBuiltInTests() {
    const gridCases = [
      {
        name: 'simple table',
        html: '<table><tr><th>Name</th><th>Age</th></tr><tr><td>Ada</td><td>36</td></tr></table>',
        expected: [['Name', 'Age'], ['Ada', '36']],
      },
      {
        name: 'thead and tbody',
        html: '<table><thead><tr><th>Item</th><th>Count</th></tr></thead><tbody><tr><td>Apples</td><td>2</td></tr></tbody></table>',
        expected: [['Item', 'Count'], ['Apples', '2']],
      },
      {
        name: 'rowspan',
        html: '<table><tr><th>Team</th><th>Score</th></tr><tr><td rowspan="2">Blue</td><td>4</td></tr><tr><td>6</td></tr></table>',
        expected: [['Team', 'Score'], ['Blue', '4'], ['Blue', '6']],
      },
      {
        name: 'colspan',
        html: '<table><tr><th>Name</th><th colspan="2">Scores</th></tr><tr><th>A</th><th>B</th><th>C</th></tr><tr><td>Lee</td><td>7</td><td>9</td></tr></table>',
        expected: [['Name', 'Scores', 'Scores'], ['A', 'B', 'C'], ['Lee', '7', '9']],
      },
      {
        name: 'combined rowspan and colspan',
        html: '<table><tr><th rowspan="2">Region</th><th colspan="2">Result</th></tr><tr><th>Won</th><th>Lost</th></tr><tr><td rowspan="2">North</td><td>4</td><td>1</td></tr><tr><td>5</td><td>2</td></tr></table>',
        expected: [['Region', 'Result', 'Result'], ['Region', 'Won', 'Lost'], ['North', '4', '1'], ['North', '5', '2']],
      },
      {
        name: 'empty and uneven cells',
        html: '<table><tr><th>A</th><th>B</th><th>C</th></tr><tr><td>x</td><td></td></tr><tr><td>y</td><td>z</td><td>w</td></tr></table>',
        expected: [['A', 'B', 'C'], ['x', '', ''], ['y', 'z', 'w']],
      },
      {
        name: 'nested table isolation',
        html: '<table><tr><th>Container</th><th>Value</th></tr><tr><td>Before<table><tr><th>Child</th></tr><tr><td>Nested</td></tr></table>After</td><td>2</td></tr></table>',
        expected: [['Container', 'Value'], ['Before After', '2']],
      },
    ];

    const markdownCases = [
      {
        name: 'multiple header rows',
        html: '<table><tr><th rowspan="2">Name</th><th colspan="2">Scores</th></tr><tr><th>A</th><th>B</th></tr><tr><td>Frugling</td><td>7</td><td>9</td></tr></table>',
        expected: '| Name | Scores - A | Scores - B |\n| --- | --- | --- |\n| Frugling | 7 | 9 |',
      },
      {
        name: 'neutral headers',
        html: '<table><tr><td>One</td><td>Two</td></tr><tr><td>Three</td><td>Four</td></tr></table>',
        expected: '| Column 1 | Column 2 |\n| --- | --- |\n| One | Two |\n| Three | Four |',
      },
      {
        name: 'inline formatting',
        html: '<table><tr><th>Text</th></tr><tr><td><strong>Bold</strong> <em>soft</em> <a href="https://example.com/a b">Link</a> <code>x|y</code><br>end</td></tr></table>',
        expected: '| Text |\n| --- |\n| **Bold** *soft* [Link](https://example.com/a%20b) `x\\|y` <br> end |',
      },
      {
        name: 'Wikipedia-style markup',
        html: '<table class="wikitable sortable" style="color: red" id="history"><thead><tr><th scope="col"><span>Year</span></th><th scope="col">Event</th></tr></thead><tbody><tr class="even"><td>2026</td><td><a href="/wiki/Test">Test</a></td></tr></tbody></table>',
        expected: '| Year | Event |\n| --- | --- |\n| 2026 | [Test](/wiki/Test) |',
      },
      {
        name: 'nested tables convert separately',
        html: '<table><tr><th>Outer</th></tr><tr><td>Value<table><tr><th>Inner</th></tr><tr><td>Child</td></tr></table></td></tr></table>',
        expected: '| Outer |\n| --- |\n| Value |\n\n| Inner |\n| --- |\n| Child |',
      },
      {
        name: 'multiple sibling tables keep document order',
        html: '<section><table><tr><th>First</th></tr><tr><td>A</td></tr></table><p>Ignored text</p><table><tr><th>Second</th></tr><tr><td>B</td></tr></table></section>',
        expected: '| First |\n| --- |\n| A |\n\n| Second |\n| --- |\n| B |',
      },
      {
        name: 'empty table remains a Markdown table',
        html: '<table class="empty"></table>',
        expected: '| Column 1 |\n| --- |',
      },
      {
        name: 'standalone image uses its source',
        html: '<table><tr><th>Icon</th></tr><tr><td><img alt="Zapup" src="images/zapup.png"></td></tr></table>',
        expected: '| Icon |\n| --- |\n| ![Zapup](images/zapup.png) |',
      },
      {
        name: 'linked image keeps its source and anchor destination',
        html: '<table><tr><th>Icon</th></tr><tr><td><a href="/wiki/File:Zapup.png"><img alt="Zapup.png" src="/images/thumb/zapup.png"></a></td></tr></table>',
        expected: '| Icon |\n| --- |\n| [![Zapup.png](/images/thumb/zapup.png)](/wiki/File:Zapup.png) |',
      },
      {
        name: 'relative image links stay relative',
        html: '<table><tr><th>Icon</th></tr><tr><td><a href="../files/item.png"><img alt="Item" src="./thumbs/item.png"></a></td></tr></table>',
        expected: '| Icon |\n| --- |\n| [![Item](./thumbs/item.png)](../files/item.png) |',
      },
      {
        name: 'absolute image source stays absolute',
        html: '<table><tr><th>Icon</th></tr><tr><td><img alt="Remote" src="https://cdn.example.com/assets/remote.png"></td></tr></table>',
        expected: '| Icon |\n| --- |\n| ![Remote](https://cdn.example.com/assets/remote.png) |',
      },
      {
        name: 'missing image alt uses a placeholder',
        html: '<table><tr><th>Icon</th></tr><tr><td><img src="/images/unknown.png"></td></tr></table>',
        expected: '| Icon |\n| --- |\n| ![Image](/images/unknown.png) |',
      },
      {
        name: 'ordinary links remain normal Markdown links',
        html: '<table><tr><th>Link</th></tr><tr><td><a href="https://example.com/docs">Documentation</a></td></tr></table>',
        expected: '| Link |\n| --- |\n| [Documentation](https://example.com/docs) |',
      },
      {
        name: 'image mixed with text and formatting',
        html: '<table><tr><th>Content</th></tr><tr><td><strong>Featured</strong> <img alt="Badge" src="/images/badge.png"> <em>today</em></td></tr></table>',
        expected: '| Content |\n| --- |\n| **Featured** ![Badge](/images/badge.png) *today* |',
      },
      {
        name: 'source page URL resolves root dot and parent destinations',
        sourcePageUrl: 'https://clashofcritters.wiki.gg/wiki/Critters',
        html: '<table><tr><th>Image</th><th>Link</th><th>Parent</th></tr><tr><td><a href="/wiki/File:Zapup.png"><img alt="Zapup.png" src="/images/thumb/Zapup.png/100px-Zapup.png?f1a4c6"></a></td><td><a href="./Guide">Guide</a></td><td><img alt="Badge" src="../images/badge.png"></td></tr></table>',
        expected: '| Image | Link | Parent |\n| --- | --- | --- |\n| [![Zapup.png](https://clashofcritters.wiki.gg/images/thumb/Zapup.png/100px-Zapup.png?f1a4c6)](https://clashofcritters.wiki.gg/wiki/File:Zapup.png) | [Guide](https://clashofcritters.wiki.gg/wiki/Guide) | ![Badge](https://clashofcritters.wiki.gg/images/badge.png) |',
      },
      {
        name: 'source page URL leaves absolute destinations unchanged',
        sourcePageUrl: 'https://clashofcritters.wiki.gg/wiki/Critters',
        html: '<table><tr><th>Image</th><th>Link</th></tr><tr><td><a href="https://cdn.example.com/files/zapup.png"><img alt="Zapup" src="https://images.example.com/zapup.png"></a></td><td><a href="https://example.com/docs">Docs</a></td></tr></table>',
        expected: '| Image | Link |\n| --- | --- |\n| [![Zapup](https://images.example.com/zapup.png)](https://cdn.example.com/files/zapup.png) | [Docs](https://example.com/docs) |',
      },
    ];

    const galleryItem = '<li class="gallerybox"><div class="thumb"><a href="/wiki/File:Shani.png"><img alt="Shani Icon Small" src="icons/shani.png"></a></div><div class="gallerytext"><center><a href="/wiki/Shani">Shani</a></center></div></li>';
    const galleryHtml = `<ul class="gallery mw-gallery-traditional">${galleryItem}</ul>`;
    const galleryHeader = '| Image | Name |\n| --- | --- |';
    const galleryRow = '| [![Shani Icon Small](icons/shani.png)](/wiki/Shani) | [Shani](/wiki/Shani) |';
    const galleryMarkdown = `${galleryHeader}\n${galleryRow}`;
    const plainTable = '<table><tr><th>Label</th></tr><tr><td>Value</td></tr></table>';
    const plainMarkdown = '| Label |\n| --- |\n| Value |';
    const mixedHtml = `${plainTable}<div id="Flame" role="tabpanel">${galleryHtml}</div>${plainTable}`;
    const galleryCases = [
      {
        name: 'simple gallery uses the caption page link instead of the thumbnail link',
        html: galleryHtml,
        expected: galleryMarkdown,
      },
      {
        name: 'multiple gallery items keep their order',
        html: `<ul class="gallery">${galleryItem}${galleryItem.replaceAll('Shani', 'Feliz').replace('shani.png', 'feliz.png')}</ul>`,
        expected: `${galleryMarkdown}\n${galleryRow.replaceAll('Shani', 'Feliz').replace('shani.png', 'feliz.png')}`,
      },
      {
        name: 'tab-panel heading',
        html: `<div id="Flame" role="tabpanel">${galleryHtml}</div>`,
        expected: `## Flame\n\n${galleryMarkdown}`,
      },
      {
        name: 'multiple tab panels including hidden panels keep their headings',
        html: `<div id="Flame" role="tabpanel">${galleryHtml}</div><div id="Water" role="tabpanel" hidden>${galleryHtml}</div>`,
        expected: `## Flame\n\n${galleryMarkdown}\n\n## Water\n\n${galleryMarkdown}`,
      },
      {
        name: 'nearest tab-panel heading',
        html: `<section id="Outer" role="tabpanel"><div id="Inner" role="tabpanel">${galleryHtml}</div></section>`,
        expected: `## Inner\n\n${galleryMarkdown}`,
      },
      {
        name: 'tab panel without an id does not invent a heading',
        html: `<div role="tabpanel">${galleryHtml}</div>`,
        expected: galleryMarkdown,
      },
      {
        name: 'tab-panel id is a single literal Markdown heading',
        html: `<div id="Flame_[rare]&#10;form" role="tabpanel">${galleryHtml}</div>`,
        expected: `## Flame\\_\\[rare\\] form\n\n${galleryMarkdown}`,
      },
      {
        name: 'protocol-relative image and root-relative page use the source URL',
        sourcePageUrl: 'https://arkrecodewiki.miraheze.org/wiki/Members',
        html: galleryHtml.replace('icons/shani.png', '//static.wikitide.net/example.png'),
        expected: `${galleryHeader}\n| [![Shani Icon Small](https://static.wikitide.net/example.png)](https://arkrecodewiki.miraheze.org/wiki/Shani) | [Shani](https://arkrecodewiki.miraheze.org/wiki/Shani) |`,
      },
      {
        name: 'protocol-relative URLs inherit an HTTP source protocol',
        sourcePageUrl: 'http://example.com/wiki/Members',
        html: galleryHtml.replace('icons/shani.png', '//static.wikitide.net/example.png'),
        expected: `${galleryHeader}\n| [![Shani Icon Small](http://static.wikitide.net/example.png)](http://example.com/wiki/Shani) | [Shani](http://example.com/wiki/Shani) |`,
      },
      {
        name: 'relative gallery page and image use the source URL',
        sourcePageUrl: 'https://example.com/wiki/Members',
        html: galleryHtml.replace('/wiki/Shani', './Shani').replace('icons/shani.png', '../images/shani.png'),
        expected: `${galleryHeader}\n| [![Shani Icon Small](https://example.com/images/shani.png)](https://example.com/wiki/Shani) | [Shani](https://example.com/wiki/Shani) |`,
      },
      {
        name: 'empty source preserves protocol-relative gallery URLs',
        html: galleryHtml.replace('icons/shani.png', '//static.wikitide.net/example.png'),
        expected: galleryMarkdown.replace('icons/shani.png', '//static.wikitide.net/example.png'),
      },
      {
        name: 'invalid source preserves literal gallery destinations',
        sourcePageUrl: 'not a URL',
        html: galleryHtml,
        expected: galleryMarkdown,
      },
      {
        name: 'absolute gallery URLs stay unchanged',
        sourcePageUrl: 'https://example.com/wiki/Members',
        html: galleryHtml.replace('icons/shani.png', 'https://cdn.example.org/shani.png').replace('/wiki/Shani', 'https://wiki.example.org/Shani'),
        expected: `${galleryHeader}\n| [![Shani Icon Small](https://cdn.example.org/shani.png)](https://wiki.example.org/Shani) | [Shani](https://wiki.example.org/Shani) |`,
      },
      {
        name: 'plain gallery caption preserves formatting and escapes cell pipes',
        html: '<ul class="gallery"><li class="gallerybox"><div class="thumb"><a href="/file"><img alt="A|B" src="icon.png"></a></div><div class="gallerytext"><strong>A|B</strong></div></li></ul>',
        expected: `${galleryHeader}\n| ![A\\|B](icon.png) | **A\\|B** |`,
      },
      {
        name: 'gallery item without an image keeps its caption',
        html: '<ul class="gallery"><li class="gallerybox"><div class="gallerytext"><a href="/wiki/Shani">Shani</a></div></li></ul>',
        expected: `${galleryHeader}\n|  | [Shani](/wiki/Shani) |`,
      },
      {
        name: 'gallery item without a caption keeps its image',
        html: '<ul class="gallery"><li class="gallerybox"><div class="thumb"><img src="icon.png"></div></li></ul>',
        expected: `${galleryHeader}\n| ![Image](icon.png) |  |`,
      },
      {
        name: 'missing image src is not replaced by a page URL',
        html: galleryHtml.replace('src="icons/shani.png"', ''),
        expected: `${galleryHeader}\n|  | [Shani](/wiki/Shani) |`,
      },
      {
        name: 'empty gallery and unrelated list items add no data rows',
        html: '<ul class="gallery"><li class="gallerycaption">A title</li><li>Other list item</li></ul>',
        expected: galleryHeader,
      },
      {
        name: 'mixed tables and galleries keep document order',
        html: mixedHtml,
        expected: `${plainMarkdown}\n\n## Flame\n\n${galleryMarkdown}\n\n${plainMarkdown}`,
      },
      {
        name: 'gallery nested in a table converts once outside the parent cell',
        html: `<table><tr><th>Outer</th></tr><tr><td>Before${galleryHtml}After</td></tr></table>`,
        expected: `| Outer |\n| --- |\n| Before After |\n\n${galleryMarkdown}`,
      },
      {
        name: 'table nested in a gallery converts once outside the caption',
        html: galleryHtml.replace('</center>', `${plainTable}</center>`),
        expected: `${galleryMarkdown}\n\n${plainMarkdown}`,
      },
      {
        name: 'nested gallery items are not borrowed by their parent gallery',
        html: `<ul class="gallery"><li class="gallerybox">${galleryHtml}</li></ul>`,
        expected: `${galleryHeader}\n|  |  |\n\n${galleryMarkdown}`,
      },
      {
        name: 'gallery captions ignore MediaWiki edit controls and tab buttons',
        html: galleryHtml.replace('<center>', '<span class="mw-editsection"><a href="/edit">edit</a></span><span class="ht-editsection">edit tab</span><button role="tab">Tab</button><center>'),
        expected: galleryMarkdown,
      },
      {
        name: 'MediaWiki redlinks remain valid caption page links',
        html: galleryHtml.replace('/wiki/Shani', '/wiki/Shani?action=edit&amp;redlink=1'),
        expected: galleryMarkdown.replaceAll('/wiki/Shani)', '/wiki/Shani?action=edit&redlink=1)'),
      },
    ];

    let passed = 0;
    gridCases.forEach((test) => {
      assertEqual(gridText(test.html), test.expected, test.name);
      passed += 1;
    });
    markdownCases.forEach((test) => {
      assertEqual(convertHtmlToMarkdown(test.html, test.sourcePageUrl).markdown, test.expected, test.name);
      passed += 1;
    });
    galleryCases.forEach((test) => {
      assertEqual(convertHtmlToMarkdown(test.html, test.sourcePageUrl).markdown, test.expected, test.name);
      passed += 1;
    });
    assertEqual(convertHtmlToMarkdown('<p>No table here</p>'), { markdown: '', count: 0 }, 'no table result');
    passed += 1;
    assertEqual(isSupportedHtmlFile({ name: 'saved-page.html', type: 'text/html' }), true, 'HTML file type');
    assertEqual(isSupportedHtmlFile({ name: 'saved-page.htm', type: '' }), true, 'HTM file extension');
    assertEqual(isSupportedHtmlFile({ name: 'notes.txt', type: 'text/plain' }), false, 'non-HTML file type');
    const extractedMarkup = extractSupportedMarkup('<main>Ignore this text<table id="first"><tr><td>One</td></tr></table><section>Ignore this too</section><table id="second"><tr><td>Two</td></tr></table></main>');
    assertEqual(parseDocument(extractedMarkup).querySelectorAll('table').length, 2, 'file table extraction count');
    assertEqual(extractedMarkup.includes('Ignore this'), false, 'file table extraction omits non-table markup');
    const nestedExtractedMarkup = extractSupportedMarkup('<table id="outer"><tr><td><table id="inner"><tr><td>Child</td></tr></table></td></tr></table>');
    assertEqual(parseDocument(nestedExtractedMarkup).querySelectorAll('table').length, 2, 'file table extraction keeps nested tables once');
    assertEqual(extractSupportedMarkup('<article>No tables here</article>'), '', 'file table extraction empty result');
    passed += 7;

    const unrelatedList = '<ul><li class="gallerybox"><div class="thumb"><img src="icon.png"></div><div class="gallerytext">Not a gallery</div></li></ul><div class="gallery"><li>Also not a gallery</li></div>';
    assertEqual(convertHtmlToMarkdown(unrelatedList), { markdown: '', count: 0 }, 'unrelated lists are not galleries');
    assertEqual(extractSupportedMarkup(unrelatedList), '', 'file extraction rejects unrelated lists');
    assertEqual(convertHtmlToMarkdown(mixedHtml).count, 3, 'mixed conversion counts tables and galleries');
    assertEqual(extractSupportedMarkup(`<main>Ignore this${galleryHtml}<p>Ignore that</p></main>`), galleryHtml, 'gallery-only file extracts raw HTML');
    passed += 4;

    const panelFile = `<html><body><div class="oo-ui-layout" data-ooui="ignored"><button role="tab">Ignore tab button</button><div id="Flame" role="tabpanel" data-ooui="ignored"><span class="ht-editsection"><a href="/edit">Ignore edit</a></span><fieldset>${galleryHtml}${plainTable}${galleryHtml}</fieldset></div><p>Ignore prose</p></div></body></html>`;
    const extractedPanel = extractSupportedMarkup(panelFile);
    assertEqual(parseDocument(extractedPanel).querySelectorAll('[role="tabpanel"]').length, 1, 'file extraction preserves one shared tab panel');
    assertEqual(parseDocument(extractedPanel).querySelector('[role="tabpanel"]').id, 'Flame', 'file extraction preserves the panel id');
    assertEqual(/Ignore|data-ooui|button|fieldset/.test(extractedPanel), false, 'file extraction omits unrelated MediaWiki wrappers and controls');
    assertEqual(convertHtmlToMarkdown(extractedPanel), {
      markdown: `## Flame\n\n${galleryMarkdown}\n\n${plainMarkdown}\n\n## Flame\n\n${galleryMarkdown}`,
      count: 3,
    }, 'file extraction keeps gallery-table-gallery order within a shared panel');
    passed += 4;

    const nestedImportCases = [
      `<div id="Flame" role="tabpanel"><table><tr><td>${galleryHtml}</td></tr></table></div>`,
      galleryHtml.replace('</center>', `${plainTable}</center>`),
      `<ul class="gallery"><li class="gallerybox">${galleryHtml}</li></ul>`,
      `<div id="Outer" role="tabpanel"><div id="Inner" role="tabpanel">${galleryHtml}</div></div>`,
      `<div id="Outer" role="tabpanel"><div role="tabpanel">${galleryHtml}</div></div>`,
      mixedHtml,
    ];
    nestedImportCases.forEach((html, index) => {
      const extracted = extractSupportedMarkup(html);
      assertEqual(parseDocument(extracted).querySelectorAll(STRUCTURE_SELECTOR).length,
        parseDocument(html).querySelectorAll(STRUCTURE_SELECTOR).length, `nested file extraction ${index + 1} keeps each structure once`);
      assertEqual(convertHtmlToMarkdown(extracted), convertHtmlToMarkdown(html), `nested file extraction ${index + 1} preserves conversion and headings`);
      passed += 2;
    });
    console.info(`Table converter structural tests: ${passed} passed.`);
    return passed;
  }

  convertButton.addEventListener('click', convertFromInput);
  htmlFileInput.addEventListener('change', loadHtmlFile);
  copyButton.addEventListener('click', copyMarkdown);
  downloadButton.addEventListener('click', downloadMarkdown);
  clearButton.addEventListener('click', clearAll);

  window.TableMarkdownConverter = Object.freeze({
    buildLogicalGrid,
    convertHtmlToMarkdown,
    runBuiltInTests,
  });

  try {
    runBuiltInTests();
  } catch (error) {
    console.error('Table converter structural tests failed.', error);
  }
})();
