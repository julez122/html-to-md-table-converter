(() => {
  'use strict';

  const input = document.getElementById('html-input');
  const output = document.getElementById('markdown-output');
  const status = document.getElementById('status');
  const convertButton = document.getElementById('convert-button');
  const copyButton = document.getElementById('copy-button');
  const downloadButton = document.getElementById('download-button');
  const clearButton = document.getElementById('clear-button');

  const BLOCK_TAGS = new Set(['ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'SECTION', 'UL']);
  const IGNORED_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'CANVAS']);

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

  function inlineCode(content) {
    const runs = content.match(/`+/g) || [];
    const longestRun = runs.reduce((length, run) => Math.max(length, run.length), 0);
    const fence = '`'.repeat(longestRun + 1);
    const needsPadding = /^`|`$/.test(content);
    return `${fence}${needsPadding ? ' ' : ''}${content}${needsPadding ? ' ' : ''}${fence}`;
  }

  function renderInlineChildren(node) {
    return Array.from(node.childNodes).map(renderInlineNode).join('');
  }

  function renderInlineNode(node) {
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

    if (tag === 'TABLE') {
      return ' ';
    }

    if (tag === 'BR') {
      return ' <br> ';
    }

    if (tag === 'IMG') {
      return node.getAttribute('alt') || '';
    }

    const content = renderInlineChildren(node);
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
      return label && href ? `[${label}](${escapeLinkDestination(href)})` : label;
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

  function cellToMarkdown(cell) {
    return normalizeCellMarkdown(renderInlineChildren(cell));
  }

  function buildHeaders(model, headerRows) {
    return Array.from({ length: model.width }, (_, columnIndex) => {
      const parts = [];
      headerRows.forEach((rowIndex) => {
        const entry = model.grid[rowIndex][columnIndex];
        const text = entry ? cellToMarkdown(entry.cell) : '';
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

  function tableToMarkdown(table) {
    const model = buildLogicalGrid(table);
    const columnCount = Math.max(model.width, 1);
    const headerRows = findHeaderRows(model, table);
    const headerSet = new Set(headerRows);
    const headers = headerRows.length > 0
      ? buildHeaders({ ...model, width: columnCount }, headerRows)
      : Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`);
    const bodyRows = model.grid
      .map((row, rowIndex) => ({ row, rowIndex }))
      .filter(({ rowIndex }) => !headerSet.has(rowIndex))
      .map(({ row }) => Array.from({ length: columnCount }, (_, columnIndex) => {
        const entry = row[columnIndex];
        return entry ? cellToMarkdown(entry.cell) : '';
      }));

    return [
      formatMarkdownRow(headers),
      formatMarkdownRow(headers.map(() => '---')),
      ...bodyRows.map(formatMarkdownRow),
    ].join('\n');
  }

  function fallbackTable(table) {
    const text = normalizeCellMarkdown(table.textContent || '');
    return [
      '| Column 1 |',
      '| --- |',
      `| ${text} |`,
    ].join('\n');
  }

  function convertHtmlToMarkdown(html) {
    const documentFragment = parseDocument(html);
    const tables = Array.from(documentFragment.querySelectorAll('table'));
    if (tables.length === 0) {
      return { markdown: '', count: 0 };
    }

    const markdownTables = tables.map((table) => {
      try {
        return tableToMarkdown(table);
      } catch (error) {
        console.warn('A table needed the fallback converter.', error);
        return fallbackTable(table);
      }
    });

    return { markdown: markdownTables.join('\n\n'), count: tables.length };
  }

  function convertFromInput() {
    const result = convertHtmlToMarkdown(input.value);
    output.value = result.markdown;
    if (result.count === 0) {
      setStatus('No HTML table was found.', 'error');
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
    input.value = '';
    output.value = '';
    setStatus('Cleared.');
    input.focus();
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
    ];

    let passed = 0;
    gridCases.forEach((test) => {
      assertEqual(gridText(test.html), test.expected, test.name);
      passed += 1;
    });
    markdownCases.forEach((test) => {
      assertEqual(convertHtmlToMarkdown(test.html).markdown, test.expected, test.name);
      passed += 1;
    });
    assertEqual(convertHtmlToMarkdown('<p>No table here</p>'), { markdown: '', count: 0 }, 'no table result');
    passed += 1;
    console.info(`Table converter structural tests: ${passed} passed.`);
    return passed;
  }

  convertButton.addEventListener('click', convertFromInput);
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
