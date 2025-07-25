function createDataTable(data) {
    const tableContainer = document.createElement('div');
    tableContainer.className = 'container mt-4';

    let currentFilter = "all";
    let currentSortColumn = null;
    let currentSortOrder = null;

    // フィルターコントロール
    const filterDiv = document.createElement('div');
    filterDiv.className = 'mb-3';
    filterDiv.innerHTML = `
        <div class="btn-group" role="group">
            <button type="button" class="btn btn-primary active" data-filter="all">All</button>
            <button type="button" class="btn btn-primary" data-filter="project">Projects</button>
            <button type="button" class="btn btn-primary" data-filter="domain">Domains</button>
            <button type="button" class="btn btn-primary" data-filter="service">Services</button>
            <button type="button" class="btn btn-primary" data-filter="user">Users</button>
        </div>
    `;

    // テーブル作成
    const table = document.createElement('table');
    table.className = 'table table-striped table-hover';

    // ヘッダー作成を修正 (追加: "Address")
    const thead = document.createElement('thead');
    thead.className = 'table-dark';
    const headerRow = thead.insertRow();
    
    ['ID', 'Name', 'Address', 'Type', 'Links'].forEach(headerText => {
        const th = document.createElement('th');
        th.style.cursor = 'pointer';
        th.innerHTML = `${headerText} <span class="sort-indicator" style="margin-left:5px;opacity:0.3">⇅</span>`;
        th.addEventListener('click', () => sortTable(th, headerText, tbody, data.nodes));
        headerRow.appendChild(th);
    });
    
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    // New function to render the table body based on currentFilter and sort state.
    function updateTable() {
        let filteredNodes = data.nodes.filter(n => currentFilter === 'all' ? true : n.type === currentFilter);
        if (currentSortColumn) {
            filteredNodes.sort((a, b) => {
                let valueA, valueB;
                switch(currentSortColumn) {
                    case 'ID':
                        valueA = a.id;
                        valueB = b.id;
                        break;
                    case 'Name':
                        valueA = a.name;
                        valueB = b.name;
                        break;
                    case 'Address':
                        valueA = a.address;
                        valueB = b.address;
                        break;
                    case 'Type':
                        valueA = a.type;
                        valueB = b.type;
                        break;
                    case 'Links':
                        valueA = a.links ? a.links.length : 0;
                        valueB = b.links ? b.links.length : 0;
                        break;
                }
                if (valueA < valueB) return currentSortOrder === 'asc' ? -1 : 1;
                if (valueA > valueB) return currentSortOrder === 'asc' ? 1 : -1;
                return 0;
            });
        }
        tbody.innerHTML = '';
        filteredNodes.forEach(node => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-type', node.type);
            tr.innerHTML = `
                <td>${node.id}</td>
                <td>${node.name}</td>
                <td>${node.address || '-'}</td>
                <td><span class="badge bg-${getTypeColor(node.type)}">${node.type}</span></td>
                <td>${node.links.join(', ') || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    filterDiv.addEventListener('click', (e) => {
        if (e.target.hasAttribute('data-filter')) {
            const filterValue = e.target.getAttribute('data-filter');
            currentFilter = filterValue;
            filterDiv.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            updateTable();
        }
    });

    function sortTable(th, columnName, tbody, nodes) {
        const currentSort = th.getAttribute('data-sort') || '';
        const isAsc = currentSort !== 'asc';
        
        // リセット全てのソートインジケーター
        thead.querySelectorAll('th').forEach(header => {
            header.setAttribute('data-sort', '');
            header.querySelector('.sort-indicator').innerHTML = '⇅';
            header.querySelector('.sort-indicator').style.opacity = '0.3';
        });

        th.setAttribute('data-sort', isAsc ? 'asc' : 'desc');
        th.querySelector('.sort-indicator').innerHTML = isAsc ? '↑' : '↓';
        th.querySelector('.sort-indicator').style.opacity = '1';

        currentSortColumn = columnName;
        currentSortOrder = isAsc ? 'asc' : 'desc';
        updateTable();
    }

    updateTable();

    tableContainer.appendChild(filterDiv);
    tableContainer.appendChild(table);

    return tableContainer;
}

// タイプに応じたBootstrapの色を返す
function getTypeColor(type) {
    const colorMap = {
        project: 'primary',
        domain: 'danger',
        service: 'warning',
        user: 'success'
    };
    return colorMap[type] || 'secondary';
}

// Hide SVG and show table container
d3.select('#canvas svg').style('display', 'none');
const tableContainer = d3.select('#table-container')
  .style('display', 'block')
  .style('padding', '20px');

// Clear previous content
tableContainer.html('');

// データを読み込んでテーブルを表示
fetch('data.json')
    .then(response => response.json())
    .then(data => {
        const tableElement = createDataTable(data);
        tableContainer.node().appendChild(tableElement);
    })
    .catch(error => {
        console.error('Error loading data:', error);
        // エラー時はサンプルデータを表示
        const sampleData = {
            nodes: [
                { id: 1, name: "Project A", address: "123 Main St", type: "project", links: ["2", "3"] },
                { id: 2, name: "domain B", address: "456 Elm St", type: "domain", links: ["1"] },
                { id: 3, name: "Service C", address: "789 Oak St", type: "service", links: ["1"] },
                { id: 4, name: "User D", address: "101 Pine St", type: "user", links: ["2"] }
            ]
        };
        const tableElement = createDataTable(sampleData);
        tableContainer.node().appendChild(tableElement);
    });

const sb = document.getElementById('network-scrollbar-container');
if (sb) sb.style.display = 'none';
