function createDataTable(data) {
    const tableContainer = document.createElement('div');
    tableContainer.className = 'container mt-4';

    // フィルターコントロール
    const filterDiv = document.createElement('div');
    filterDiv.className = 'mb-3';
    filterDiv.innerHTML = `
        <div class="btn-group" role="group">
            <button type="button" class="btn btn-primary active" data-filter="all">All</button>
            <button type="button" class="btn btn-primary" data-filter="project">Projects</button>
            <button type="button" class="btn btn-primary" data-filter="company">Companies</button>
            <button type="button" class="btn btn-primary" data-filter="service">Services</button>
            <button type="button" class="btn btn-primary" data-filter="employee">Employees</button>
        </div>
    `;

    // テーブル作成
    const table = document.createElement('table');
    table.className = 'table table-striped table-hover';
    table.innerHTML = `
        <thead class="table-dark">
            <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Links</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    `;

    // データ行の追加
    const tbody = table.querySelector('tbody');
    data.nodes.forEach(node => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-type', node.type);
        tr.innerHTML = `
            <td>${node.id}</td>
            <td>${node.name}</td>
            <td><span class="badge bg-${getTypeColor(node.type)}">${node.type}</span></td>
            <td>${node.links.join(', ') || '-'}</td>
        `;
        tbody.appendChild(tr);
    });

    // フィルター機能
    filterDiv.addEventListener('click', (e) => {
        if (e.target.hasAttribute('data-filter')) {
            const filterValue = e.target.getAttribute('data-filter');
            const rows = tbody.querySelectorAll('tr');
            
            // ボタンのアクティブ状態を更新
            filterDiv.querySelectorAll('button').forEach(btn => {
                btn.classList.remove('active');
            });
            e.target.classList.add('active');

            // 行の表示/非表示を切り替え
            rows.forEach(row => {
                if (filterValue === 'all' || row.getAttribute('data-type') === filterValue) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }
    });

    tableContainer.appendChild(filterDiv);
    tableContainer.appendChild(table);
    return tableContainer;
}

// タイプに応じたBootstrapの色を返す
function getTypeColor(type) {
    const colorMap = {
        project: 'primary',
        company: 'danger',
        service: 'warning',
        employee: 'success'
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
                { id: 1, name: "Project A", type: "project", links: ["2", "3"] },
                { id: 2, name: "Company B", type: "company", links: ["1"] },
                { id: 3, name: "Service C", type: "service", links: ["1"] },
                { id: 4, name: "Employee D", type: "employee", links: ["2"] }
            ]
        };
        const tableElement = createDataTable(sampleData);
        tableContainer.node().appendChild(tableElement);
    });
