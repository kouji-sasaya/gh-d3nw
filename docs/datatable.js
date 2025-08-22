// datatable.js: Display data.json as a table using DataTables.js
// This script assumes jQuery and DataTables are loaded in index.html

(function() {
    // Ensure #canvas is used to host the datatable (clear previous svg/canvas)
    const canvas = document.getElementById('canvas');
    if (!canvas) return;

    // Replace canvas content with datatable container (full size)
    canvas.innerHTML = "<div id='datatable-container' style='position:absolute;top:0;left:0;right:0;bottom:0;padding:0;background:white;box-sizing:border-box;display:flex;flex-direction:column;'><table id='dt' class='display' style='width:100%'></table></div>";

    const datatableContainer = document.getElementById('datatable-container');

    // Load data.json (use explicit relative path) and render table
    fetch('./data.json')
        .then(response => {
            if (!response.ok) throw new Error('HTTP error ' + response.status);
            return response.json();
        })
        .then(payload => {
            // payload may be an array or an object like { nodes: [...] }
            let dataArray = Array.isArray(payload) ? payload : (Array.isArray(payload.nodes) ? payload.nodes : []);

            if (!dataArray.length) {
                datatableContainer.innerHTML = '<div style="color:red;padding:20px;">No data available in data.json</div>';
                return;
            }

            // Build columns dynamically from keys of first object
            const keys = Object.keys(dataArray[0]);
            const columns = keys.map(k => ({
                title: k.charAt(0).toUpperCase() + k.slice(1),
                data: k,
                render: d => Array.isArray(d) ? d.join(', ') : (d === null || d === undefined ? '-' : String(d))
            }));

            // Helper: build a THEAD with a filter row
            function buildTheadHTML() {
                let thead = '<thead><tr>';
                keys.forEach(k => { thead += `<th>${k.charAt(0).toUpperCase() + k.slice(1)}</th>`; });
                thead += '</tr><tr class="filters">';
                keys.forEach((k, idx) => { thead += `<th><input class="filter-input" data-col="${idx}" type="text" placeholder="Filter ${k}"></th>`; });
                thead += '</tr></thead>';
                return thead;
            }

            // If DataTables not available, fallback to simple full-size table with rows-per-page control and per-column filters
            if (typeof $ === 'undefined' || !$.fn || !$.fn.dataTable) {
                // create a simple rows-per-page selector, export buttons, filters row and table container
                const optionsHTML = `
                    <div style="padding:8px 12px;border-bottom:1px solid #eee;background:#fff;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                      <div style="display:flex;align-items:center;gap:8px;">
                        <label style="font-size:14px;color:#333;">
                          表示件数：
                          <select id="rows-per-page">
                            <option value="10">10</option>
                            <option value="25" selected>25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                            <option value="-1">All</option>
                          </select>
                        </label>
                      </div>
                      <div id="plain-export-buttons" style="display:flex;gap:8px;margin-left:auto;">
                        <button id="btn-copy" type="button">Copy</button>
                        <button id="btn-csv" type="button">CSV</button>
                        <button id="btn-json" type="button">JSON</button>
                        <button id="btn-excel" type="button">Excel</button>
                      </div>
                    </div>
                    <div id="plain-filters" style="padding:8px 12px;border-bottom:1px solid #eee;background:#fff;display:flex;gap:8px;flex-wrap:wrap;"></div>
                    <div id="plain-table-wrapper" style="overflow:auto;flex:1;padding:0 12px;"></div>
                `;
                datatableContainer.innerHTML = optionsHTML;

                const filtersDiv = document.getElementById('plain-filters');
                const wrapper = document.getElementById('plain-table-wrapper');

                // create per-column text inputs (inline)
                keys.forEach((k, idx) => {
                    const fld = document.createElement('div');
                    fld.style.flex = '1 1 150px';
                    fld.innerHTML = `<label style="font-size:12px;color:#333;display:block;margin-bottom:4px;">${k}</label><input class="plain-filter" data-key="${k}" type="text" style="width:100%;box-sizing:border-box;padding:6px;border:1px solid #ccc;border-radius:3px;" placeholder="Filter ${k}">`;
                    filtersDiv.appendChild(fld);
                });

                function applyPlainFilters(rows) {
                    const inputs = Array.from(document.querySelectorAll('.plain-filter'));
                    return rows.filter(row => {
                        return inputs.every(inp => {
                            const key = inp.getAttribute('data-key');
                            const v = inp.value.trim().toLowerCase();
                            if (!v) return true;
                            const rv = row[key];
                            if (rv === null || rv === undefined) return false;
                            const s = Array.isArray(rv) ? rv.join(' ') : String(rv);
                            return s.toLowerCase().indexOf(v) !== -1;
                        });
                    });
                }

                function renderRows(limit) {
                    let rows = dataArray.slice();
                    rows = applyPlainFilters(rows);
                    if (limit !== -1) rows = rows.slice(0, limit);
                    let html = '<table style="width:100%;border-collapse:collapse;"><thead><tr>';
                    columns.forEach(c => { html += `<th style="border:1px solid #ddd;padding:8px;text-align:left;">${c.title}</th>`; });
                    html += '</tr></thead><tbody>';
                    rows.forEach(row => {
                        html += '<tr>';
                        keys.forEach(k => html += `<td style="border:1px solid #ddd;padding:8px;">${Array.isArray(row[k])?row[k].join(', '):(row[k]??'')}</td>`);
                        html += '</tr>';
                    });
                    html += '</tbody></table>';
                    wrapper.innerHTML = html;
                }

                // initial render with default 25
                renderRows(25);

                // attach rows-per-page event
                const sel = document.getElementById('rows-per-page');
                if (sel) {
                    sel.addEventListener('change', function() {
                        const v = parseInt(this.value, 10);
                        renderRows(v);
                    });
                }

                // attach per-column filter events
                document.querySelectorAll('.plain-filter').forEach(inp => {
                    inp.addEventListener('input', () => {
                        const v = parseInt(sel.value, 10);
                        renderRows(v);
                    });
                });

                // --- Fallback export utilities (CSV with BOM, JSON, Excel-ish, Copy) ---
                function downloadBlob(filename, blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                }

                function getFilteredRows() {
                    return applyPlainFilters(dataArray.slice());
                }

                function exportCSV(rows) {
                    if (!rows.length) return;
                    const header = keys.join(',');
                    const lines = rows.map(r => keys.map(k => {
                        const v = r[k];
                        if (v === null || v === undefined) return '';
                        const s = Array.isArray(v) ? v.join(' ') : String(v);
                        // escape quotes
                        return '"' + s.replace(/"/g, '""') + '"';
                    }).join(',')).join('\r\n');
                    const bom = '\uFEFF';
                    const csv = bom + header + '\r\n' + lines;
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    downloadBlob('data.csv', blob);
                }

                function exportJSON(rows) {
                    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json;charset=utf-8' });
                    downloadBlob('data.json', blob);
                }

                function exportExcel(rows) {
                    // simple Excel-ish export via HTML table blob (works in Excel, preserves UTF-8 BOM)
                    let html = '<table><thead><tr>' + keys.map(k => `<th>${k}</th>`).join('') + '</tr></thead><tbody>';
                    rows.forEach(r => {
                        html += '<tr>' + keys.map(k => `<td>${Array.isArray(r[k])?r[k].join(' '):(r[k]??'')}</td>`).join('') + '</tr>';
                    });
                    html += '</tbody></table>';
                    const bom = '\uFEFF';
                    const blob = new Blob([bom + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
                    downloadBlob('data.xls', blob);
                }

                function copyToClipboard(rows) {
                    const header = keys.join('\t');
                    const text = header + '\n' + rows.map(r => keys.map(k => Array.isArray(r[k])?r[k].join(' '):(r[k]??'')).join('\t')).join('\n');
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(text).catch(()=> { prompt('Copy the following text:', text); });
                    } else {
                        prompt('Copy the following text:', text);
                    }
                }

                // wire buttons
                document.getElementById('btn-csv').addEventListener('click', () => exportCSV(getFilteredRows()));
                document.getElementById('btn-json').addEventListener('click', () => exportJSON(getFilteredRows()));
                document.getElementById('btn-excel').addEventListener('click', () => exportExcel(getFilteredRows()));
                document.getElementById('btn-copy').addEventListener('click', () => copyToClipboard(getFilteredRows()));

                return;
            }

            // DataTables available: initialize with scroll options fitting the container.
            const baseOptions = {
                data: dataArray,
                columns: columns,
                pageLength: 25,
                dom: 'lBfrtip', // include length (表示件数) control
                buttons: [
                  { extend: 'copyHtml5', text: 'Copy', exportOptions: { columns: ':visible' } },
                  { extend: 'csvHtml5', text: 'CSV', bom: true, charset: 'utf-8', filename: 'data', exportOptions: { columns: ':visible' } },
                  { extend: 'excelHtml5', text: 'Excel', filename: 'data', exportOptions: { columns: ':visible' } },
                  // custom JSON button
                  {
                    text: 'JSON',
                    action: function (e, dt, node, config) {
                      const rows = dt.rows({ search: 'applied' }).data().toArray();
                      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'data.json';
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    }
                  }
                ],
                lengthChange: true, // allow user to change number of entries shown
                lengthMenu: [[10,25,50,100,-1],[10,25,50,100,'All']], // options shown to the user
                searching: true,
                ordering: true,
                info: true,
                autoWidth: false,
                scrollCollapse: true,
                scrollX: true,
                orderCellsTop: true, // allow filters in a header row
                language: {
                    emptyTable: 'No data available',
                    search: 'Filter:',
                    paginate: { previous: 'Prev', next: 'Next' }
                }
            };

            let dtInstance = null;

            function initDataTable() {
                // compute available height for the DataTable scroll body
                const containerRect = datatableContainer.getBoundingClientRect();
                // subtract some pixels to account for DataTables header/controls; adjust if needed
                const scrollYpx = Math.max(100, Math.floor(containerRect.height - 80)) + 'px';

                // destroy previous instance if exists
                if ($.fn.dataTable.isDataTable('#dt')) {
                    $('#dt').DataTable().destroy();
                    $('#dt').empty();
                }

                // build header with filters
                const theadHTML = buildTheadHTML();
                $('#dt').html(theadHTML);

                const options = Object.assign({}, baseOptions, { scrollY: scrollYpx,
                    initComplete: function() {
                        // Column-wise filtering: wire inputs to column search
                        const api = this.api();
                        // Attach handlers to the THEAD inside the DataTable container so it works with
                        // DataTables' header cloning when scrollX/scrollY is enabled.
                        const container = $(api.table().container());
                        container.find('thead tr.filters th').each(function(idx) {
                            const input = $(this).find('input');
                            input.off('.dtFilter').on('input.dtFilter', function() {
                                const val = this.value;
                                if (api.column(idx).search() !== val) {
                                    api.column(idx).search(val).draw();
                                }
                            });
                        });
                    }
                });
                dtInstance = $('#dt').DataTable(options);
            }

            // initial init
            initDataTable();

            // re-init on resize so scrollY stays correct (filters rebuilt in init)
            let resizeTimer = null;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    initDataTable();
                }, 150);
            });
        })
        .catch(error => {
            console.error('Error loading data.json:', error);
            const c = document.getElementById('datatable-container');
            if (c) c.innerHTML = '<div style="color:red;padding:20px;">Failed to load data.json (' + (error && error.message ? error.message : 'unknown') + ')</div>';
        });
})();
