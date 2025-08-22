// datatable.js: Display data.json as a table using DataTables.js
// This script assumes jQuery and DataTables are loaded in index.html

(function() {
    // Ensure #canvas is used to host the datatable (clear previous svg/canvas)
    const canvas = document.getElementById('canvas');
    if (!canvas) return;

    // Replace canvas content with datatable container
    canvas.innerHTML = "<div id='datatable-container' style='padding:20px; background:white; height:100%; box-sizing:border-box;'><table id='dt' class='display' style='width:100%'></table></div>";

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
                document.getElementById('datatable-container').innerHTML = '<div style="color:red;">No data available in data.json</div>';
                return;
            }

            // Build columns dynamically from keys of first object
            const keys = Object.keys(dataArray[0]);
            const columns = keys.map(k => ({
                title: k.charAt(0).toUpperCase() + k.slice(1),
                data: k,
                render: d => Array.isArray(d) ? d.join(', ') : (d === null || d === undefined ? '-' : String(d))
            }));

            // Initialize DataTable (requires jQuery & DataTables loaded in index.html)
            if (typeof $ === 'undefined' || !$.fn || !$.fn.dataTable) {
                // If DataTables not available, show plain table
                let html = '<table style="width:100%;border-collapse:collapse;"><thead><tr>';
                columns.forEach(c => { html += `<th style="border:1px solid #ddd;padding:8px;">${c.title}</th>`; });
                html += '</tr></thead><tbody>';
                dataArray.forEach(row => {
                    html += '<tr>';
                    keys.forEach(k => html += `<td style="border:1px solid #ddd;padding:8px;">${Array.isArray(row[k])?row[k].join(', '):(row[k]??'')}</td>`);
                    html += '</tr>';
                });
                html += '</tbody></table>';
                document.getElementById('datatable-container').innerHTML = html;
                return;
            }

            $('#dt').DataTable({
                data: dataArray,
                columns: columns,
                pageLength: 10,
                lengthChange: false,
                searching: true,
                ordering: true,
                info: true,
                autoWidth: false,
                language: {
                    emptyTable: 'No data available',
                    search: 'Filter:',
                    paginate: { previous: 'Prev', next: 'Next' }
                }
            });
        })
        .catch(error => {
            console.error('Error loading data.json:', error);
            const c = document.getElementById('datatable-container');
            if (c) c.innerHTML = '<div style="color:red;">Failed to load data.json (' + (error && error.message ? error.message : 'unknown') + ')</div>';
        });
})();
