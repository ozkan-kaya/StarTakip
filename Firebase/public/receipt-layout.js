(() => {
  const css = String.raw`
@page star-offer{size:A5 landscape;margin:0}
@page star-offer-a4{size:A4 portrait;margin:0}
.receipt-sheet{box-sizing:border-box;width:210mm;height:var(--receipt-paper-height);padding:var(--receipt-margin-y) var(--receipt-margin-x);position:relative;background:#fff;transform-origin:top left}
.receipt-sheet[data-paper=a5]{page:star-offer;aspect-ratio:210/148}.receipt-sheet[data-paper=a4]{page:star-offer-a4}
.receipt-page-paper:has(.receipt-pages){width:210mm;max-width:100%;padding:0;background:transparent;outline:0;overflow:clip;zoom:1}
.receipt-pages{display:grid;gap:3mm}.receipt-page-paper .receipt-sheet{outline:1px solid #d7e1d4;outline-offset:-1px}
.receipt-frame{min-width:0}.receipt-page-number{position:absolute;inset:auto 0 1.5mm;margin:0;color:#627457;text-align:center;font:7pt/1.1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.receipt-offer{--receipt-ink:#173c35;--receipt-line:#d7e1d4;--receipt-muted:#627457;--receipt-code:22mm;--receipt-qty:30mm;--receipt-price:26mm;--receipt-operator:4mm;--receipt-total:28mm;--receipt-row:5.5mm;--receipt-totals-w:calc(var(--receipt-qty) + var(--receipt-operator) * 2 + var(--receipt-price) + var(--receipt-total));--receipt-columns:var(--receipt-code) minmax(0,1fr) var(--receipt-qty) var(--receipt-price) var(--receipt-total);box-sizing:border-box;width:100%;max-width:none;margin:0;color:var(--receipt-ink);font:9pt/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.receipt-sheet>.receipt-offer{width:100%;max-width:none}.receipt-offer *{box-sizing:border-box}
.receipt-offer .receipt-title{margin:0 0 2mm;text-align:center;font-size:14pt;line-height:1.15;font-weight:650;letter-spacing:.5pt}
.receipt-offer .receipt-grid{display:grid;grid-template-columns:var(--receipt-columns);gap:0}
.receipt-offer .receipt-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2mm;margin:0 0 3mm;padding-bottom:1mm;border-bottom:.2mm solid var(--receipt-line)}
.receipt-offer .receipt-meta dl{min-width:0;margin:0}.receipt-offer .receipt-meta-type{text-align:center}.receipt-offer .receipt-meta-date{text-align:right}
.receipt-offer .receipt-meta dt{display:inline;font-size:7pt;color:var(--receipt-muted)}
.receipt-offer .receipt-party-label{font-size:7pt;text-transform:uppercase;letter-spacing:.35pt;color:var(--receipt-muted)}
.receipt-offer .receipt-meta dd{display:inline;margin:0;font-size:9pt;font-weight:700;overflow-wrap:anywhere}
.receipt-offer .receipt-heading{margin:0 0 3mm;padding:0 0 1.5mm;border-bottom:.45mm solid var(--receipt-ink);break-inside:avoid}
.receipt-offer .receipt-seller{grid-column:1/3;padding-right:3mm}.receipt-offer .receipt-customer{grid-column:3/6;justify-self:end;width:max-content;min-width:0;max-width:100%;text-align:left;overflow-wrap:anywhere}
.receipt-offer .receipt-heading:has(>.receipt-customer){grid-template-columns:repeat(2,minmax(0,1fr))}
.receipt-offer .receipt-heading:has(>.receipt-customer)>.receipt-seller{grid-column:1;min-width:0}
.receipt-offer .receipt-heading>.receipt-customer{grid-column:2}
.receipt-offer .receipt-heading h2{display:inline;font-size:11pt;font-weight:700;line-height:1.15;letter-spacing:normal;margin:0;color:inherit}
.receipt-offer .receipt-heading p{margin:0;font-size:9pt;line-height:1.2;overflow-wrap:anywhere}.receipt-offer .receipt-heading .receipt-contact{color:inherit;font-size:11pt;font-weight:650}.receipt-offer .receipt-heading.receipt-addresses-compact .receipt-address{font-size:7.5pt}.receipt-offer .receipt-locality{white-space:nowrap}.receipt-offer .receipt-customer .receipt-locality{display:inline-block;max-width:100%;white-space:normal}
.receipt-offer .receipt-items{width:100%;margin:0;table-layout:fixed;border-collapse:collapse;font-size:8.5pt;white-space:normal}
.receipt-items col.receipt-code{width:var(--receipt-code)}.receipt-items col.receipt-qty{width:var(--receipt-qty)}
.receipt-offer :is(.receipt-items,.receipt-totals) col.receipt-price{width:var(--receipt-price)}
.receipt-offer :is(.receipt-items,.receipt-totals) col.receipt-total-col{width:var(--receipt-total)}
.receipt-offer :is(.receipt-items,.receipt-totals) col.receipt-item-operator{width:var(--receipt-operator)}
.receipt-offer .receipt-items th,.receipt-offer .receipt-items td{padding:1.2mm 1mm;line-height:1.25;vertical-align:top;text-align:left;border:0;border-bottom:.2mm solid var(--receipt-line);overflow-wrap:anywhere}
.receipt-offer .receipt-items td{height:5.5mm;font-size:8.5pt}.receipt-offer .receipt-items th{height:5mm;font-size:7pt;text-transform:uppercase;letter-spacing:.35pt;color:var(--receipt-muted);background:transparent;white-space:normal}
.receipt-offer .receipt-items :is(th,td):first-child{padding-left:0}.receipt-offer .receipt-items :is(th,td):last-child{padding-right:0}.receipt-offer :is(.receipt-items,.receipt-totals) :is(th,td).number{padding-inline:0;text-align:right;white-space:nowrap;overflow-wrap:normal;font-variant-numeric:tabular-nums}
.receipt-offer .receipt-items :is(th,td):is(.receipt-qty-number,.receipt-unit-price){text-align:left}
.receipt-offer .receipt-items :is(th,td).receipt-unit-price{padding-left:var(--receipt-unit-price-inset,0px)}
.receipt-offer .receipt-items :is(th,td).receipt-item-operator{padding-inline:0;text-align:center}
.receipt-offer .receipt-items th.receipt-item-operator>span{position:relative;left:var(--receipt-times-offset,0px)}
.receipt-offer .receipt-items th.receipt-item-equals>span{left:var(--receipt-equals-offset,0px)}
.receipt-offer .receipt-items .receipt-code-cell{white-space:nowrap;overflow-wrap:normal}.receipt-offer .receipt-items .receipt-numeric{white-space:nowrap;overflow-wrap:normal}
.receipt-offer .receipt-items thead{display:table-header-group}.receipt-offer .receipt-items tr{break-inside:avoid}.receipt-offer .receipt-items tbody tr,.receipt-offer .receipt-items tbody tr:hover{background:transparent;animation:none;transition:none}
.receipt-money-unit{display:inline-block;width:1ch;margin-left:.12em;text-align:left}
.receipt-quantity-unit{display:inline-block;width:11mm;margin-left:1mm;text-align:right}
.receipt-offer .receipt-payment-extra{font-size:8.5pt;color:var(--receipt-muted);font-weight:400}
.receipt-offer .receipt-bottom{padding-top:2mm;break-inside:avoid}
.receipt-offer .receipt-bottom>.receipt-grid{grid-template-columns:minmax(0,1fr) var(--receipt-totals-w);align-items:start}
.receipt-offer .receipt-annotations{grid-column:1;min-width:0;padding:0 4mm 0 0}
.receipt-offer .receipt-annotations p{font-size:9pt;line-height:var(--receipt-row);overflow-wrap:anywhere;margin:0}
.receipt-offer .receipt-bottom:has(.receipt-written-total){padding-top:1mm}
.receipt-offer .receipt-bottom:has(.receipt-written-total:last-child){padding-top:0}
.receipt-offer .receipt-totals{grid-column:2;min-width:0;width:100%;margin:0;table-layout:fixed;border-collapse:collapse;font-variant-numeric:tabular-nums}
.receipt-offer .receipt-totals col.receipt-totals-label:has(+col.receipt-price){width:calc(var(--receipt-qty) + var(--receipt-operator))}
.receipt-offer .receipt-totals :is(th,td){height:var(--receipt-row);padding:0 1mm;border:0;font-size:8.5pt;line-height:1.15;text-transform:none;background:transparent;vertical-align:middle;font-weight:400;color:inherit}
.receipt-offer .receipt-totals th{padding-left:0;text-align:left;overflow-wrap:anywhere}
.receipt-offer .receipt-totals .receipt-grand-row :is(th,td){height:calc(var(--receipt-row) + 1mm);font-size:9pt;font-weight:700;border-top:.45mm solid var(--receipt-ink)}
.receipt-offer .receipt-items:has(.receipt-line-total) tbody td:last-child,
.receipt-offer .receipt-totals tbody tr:not(.receipt-grand-row) td.number{font-weight:500}
.receipt-offer .receipt-total-amounts{display:inline-flex;align-items:baseline;gap:1.2mm}
.receipt-offer .receipt-legend{grid-column:2;margin:2mm 0 0;text-align:right;color:var(--receipt-muted);font-size:7pt}
.receipt-offer .receipt-note{font-size:7.5pt;line-height:1.25;color:var(--receipt-muted);margin:3mm 0 0;overflow-wrap:anywhere}
.receipt-offer .receipt-version-note{margin:2mm 0 0;color:var(--receipt-muted);font-size:11px;line-height:1.25}
.receipt-offer .receipt-cancel{margin:0 0 2mm;font-size:10pt;color:#962d25;font-weight:650}
/* A5 alignment for sales, purchases and payment receipts. */
.receipt-sheet[data-paper=a5] [data-aligned-receipt] .receipt-meta-date dd{white-space:nowrap;overflow-wrap:normal}
.receipt-sheet[data-paper=a5] [data-aligned-receipt] .receipt-totals tbody th{font-size:8.5pt;letter-spacing:0}
.receipt-sheet[data-paper=a5] [data-aligned-receipt] .receipt-seller{min-width:0;padding-right:6mm}
.receipt-sheet[data-paper=a5] [data-aligned-receipt] .receipt-customer{padding-right:1mm}
.receipt-sheet[data-paper=a5] [data-aligned-receipt] .receipt-party-identity{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:1mm;min-width:0;overflow-wrap:anywhere}
.receipt-sheet[data-paper=a5] [data-aligned-receipt] .receipt-party-identity>*{min-width:0;max-width:100%;overflow-wrap:anywhere}
.receipt-sheet[data-paper=a5] [data-aligned-receipt] .receipt-locality{display:inline-block;max-width:100%;white-space:normal;overflow-wrap:anywhere}
@media print{.receipt-pages{display:block}.receipt-frame{height:auto!important;break-after:page}.receipt-frame:last-child{break-after:auto}.receipt-sheet{transform:none!important;outline:0;print-color-adjust:exact;-webkit-print-color-adjust:exact}.receipt-offer .receipt-items thead{display:table-header-group}body.printing-receipt #transactionPrint:has(.receipt-offer){padding:0}#transactionPrint .receipt-offer .receipt-items{table-layout:fixed}}
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);

  function paper(format) {
    if (format === 'a4') {
      const scale = 210 / 148;
      return {format:'a4', orientation:'portrait', width:210, height:297, marginX:(210 - 134 * scale) / 2, marginY:7 * scale};
    }
    return {format:'a5', orientation:'landscape', width:210, height:148, marginX:6, marginY:6};
  }

  function paginate(article, format) {
    const doc = article.ownerDocument;
    const page = paper(format);
    const table = article.querySelector('.receipt-items');
    const bottom = article.querySelector('.receipt-bottom');
    const rows = Array.from(table.tBodies[0].rows);
    const group = doc.createElement('div');
    group.className = 'receipt-pages';
    const staging = doc.createElement('div');
    staging.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden';
    staging.append(group);
    doc.body.append(staging);

    function addPage(first) {
      const frame = doc.createElement('div');
      frame.className = 'receipt-frame';
      const sheet = doc.createElement('section');
      sheet.className = 'receipt-sheet';
      sheet.dataset.paper = page.format;
      sheet.style.setProperty('--receipt-paper-height', page.height + 'mm');
      sheet.style.setProperty('--receipt-margin-x', page.marginX + 'mm');
      sheet.style.setProperty('--receipt-margin-y', page.marginY + 'mm');
      const content = article.cloneNode(first);
      const pageTable = first ? content.querySelector('.receipt-items') : table.cloneNode(true);
      if (!first) content.append(pageTable);
      const body = pageTable.tBodies[0];
      body.replaceChildren();
      content.querySelector('.receipt-bottom')?.remove();
      sheet.append(content);
      frame.append(sheet);
      group.append(frame);
      if (first) {
        const referenceAddress = content.querySelector('.receipt-seller .receipt-address')
          || content.querySelector('.receipt-customer .receipt-address');
        if (referenceAddress) {
          const lineHeight = parseFloat(doc.defaultView.getComputedStyle(referenceAddress).lineHeight);
          if (referenceAddress.scrollHeight > lineHeight + 1) {
            referenceAddress.closest('.receipt-heading').classList.add('receipt-addresses-compact');
          }
        }
      }
      return {sheet, content, table:pageTable, body};
    }

    function fits({sheet, content}) {
      const computed = doc.defaultView.getComputedStyle(sheet);
      const height = sheet.clientHeight - parseFloat(computed.paddingTop) - parseFloat(computed.paddingBottom);
      return content.getBoundingClientRect().height <= height - 1;
    }

    try {
      let current = addPage(true);
      for (const row of rows) {
        const copy = row.cloneNode(true);
        current.body.append(copy);
        if (!fits(current)) {
          copy.remove();
          if (!current.body.rows.length) current.table.remove();
          current = addPage(false);
          current.body.append(copy);
        }
      }
      if (bottom) {
        const footer = bottom.cloneNode(true);
        current.content.append(footer);
        if (!fits(current)) {
          const previous = current;
          current = addPage(false);
          current.table.remove();
          current.content.append(footer);
          // Carry one item with the footer and keep earlier pages full.
          if (previous.body.rows.length > 1) {
            const lastRow = previous.body.rows[previous.body.rows.length - 1];
            current.content.prepend(current.table);
            current.body.append(lastRow);
            if (!fits(current)) previous.body.append(lastRow);
          }
          if (!current.body.rows.length) current.table.remove();
        }
      }
      const priceHeading = group.querySelector('th.receipt-unit-price');
      if (priceHeading) {
        const range = doc.createRange();
        const headingRow = priceHeading.parentElement;
        const [quantity, price, total] = ['.receipt-qty-number', '.receipt-unit-price', '.receipt-line-total'].map(selector => {
          range.selectNodeContents(headingRow.querySelector(selector));
          return range.getBoundingClientRect();
        });
        const gapBefore = price.left - quantity.right;
        const gapAfter = total.left - price.right;
        let inset = (gapAfter - gapBefore) / 2;
        for (const cell of group.querySelectorAll('.receipt-unit-price')) {
          range.selectNodeContents(cell);
          inset = Math.min(inset, cell.getBoundingClientRect().right - range.getBoundingClientRect().right);
        }
        if (inset > 0) group.style.setProperty('--receipt-unit-price-inset', inset + 'px');

        range.selectNodeContents(priceHeading);
        const alignedPrice = range.getBoundingClientRect();
        const gapCenters = [(quantity.right + alignedPrice.left) / 2, (alignedPrice.right + total.left) / 2];
        const offsetProperties = ['--receipt-times-offset', '--receipt-equals-offset'];
        headingRow.querySelectorAll('.receipt-item-operator>span').forEach((symbol, index) => {
          const bounds = symbol.getBoundingClientRect();
          const center = (bounds.left + bounds.right) / 2;
          group.style.setProperty(offsetProperties[index], (gapCenters[index] - center) + 'px');
        });
      }

      const count = group.children.length;
      if (count > 1) Array.from(group.children).forEach((frame, index) => {
        const number = doc.createElement('p');
        number.className = 'receipt-page-number';
        number.textContent = 'Sayfa ' + (index + 1) + ' / ' + count;
        frame.firstElementChild.append(number);
      });
      article.replaceWith(group);
      return group;
    } finally {
      staging.remove();
    }
  }

  const previewObservers = new WeakMap();
  function preview(container, format) {
    const article = container.querySelector('.receipt-offer');
    if (!article) return;
    const pages = paginate(article, format);
    previewObservers.get(container)?.disconnect();
    const fit = () => {
      for (const frame of pages.children) {
        const sheet = frame.firstElementChild;
        const scale = Math.min(1, container.clientWidth / sheet.offsetWidth);
        sheet.style.transform = 'scale(' + scale + ')';
        frame.style.height = (sheet.offsetHeight * scale) + 'px';
      }
    };
    fit();
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(fit);
      observer.observe(container);
      previewObservers.set(container, observer);
    }
  }

  window.starReceiptLayout = {css, paper, paginate, preview};
})();
