function renderSunburst(data) {
  // サンバーストチャートのサイズを指定
  const width = 928;
  const height = width;
  const radius = width / 6;

  // カラースケールの作成
  const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, data.children.length + 1));

  // レイアウト計算
  const hierarchy = d3.hierarchy(data)
      .sum(d => d.value)
      .sort((a, b) => b.value - a.value);
  const root = d3.partition()
      .size([2 * Math.PI, hierarchy.height + 1])(hierarchy);
  root.each(d => d.current = d);

  // アークジェネレーターの作成
  const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius * 1.5)
      .innerRadius(d => d.y0 * radius)
      .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

  // SVGコンテナの作成（中央揃え）
  const svg = d3.create("svg")
      .attr("viewBox", [-width/2, -height/2, width, width])
      .style("font", "10px sans-serif");

  // アークを追加
  const path = svg.append("g")
    .selectAll("path")
    .data(root.descendants().slice(1))
    .join("path")
      .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
      .attr("fill-opacity", d => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
      .attr("pointer-events", d => arcVisible(d.current) ? "auto" : "none")
      .attr("d", d => arc(d.current));

  // クリック可能に（子を持つ場合）
  path.filter(d => d.children)
      .style("cursor", "pointer")
      .on("click", clicked);

  const format = d3.format(",d");
  path.append("title")
      .text(d => `${d.ancestors().map(d => d.data.name).reverse().join("/")}\n${format(d.value)}`);

  const label = svg.append("g")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
      .style("user-select", "none")
    .selectAll("text")
    .data(root.descendants().slice(1))
    .join("text")
      .attr("dy", "0.35em")
      .attr("fill-opacity", d => +labelVisible(d.current))
      .attr("transform", d => labelTransform(d.current))
      .text(d => d.data.name);

  const parent = svg.append("circle")
      .datum(root)
      .attr("r", radius)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("click", clicked);

  // クリック時のズーム処理
  function clicked(event, p) {
    parent.datum(p.parent || root);

    root.each(d => d.target = {
      x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      y0: Math.max(0, d.y0 - p.depth),
      y1: Math.max(0, d.y1 - p.depth)
    });

    const t = svg.transition().duration(event.altKey ? 7500 : 750);

    path.transition(t)
        .tween("data", d => {
          const i = d3.interpolate(d.current, d.target);
          return t => d.current = i(t);
        })
      .filter(function(d) {
        return +this.getAttribute("fill-opacity") || arcVisible(d.target);
      })
        .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
        .attr("pointer-events", d => arcVisible(d.target) ? "auto" : "none")
        .attrTween("d", d => () => arc(d.current));

    label.filter(function(d) {
        return +this.getAttribute("fill-opacity") || labelVisible(d.target);
      }).transition(t)
        .attr("fill-opacity", d => +labelVisible(d.target))
        .attrTween("transform", d => () => labelTransform(d.current));
  }
  
  function arcVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
  }

  function labelVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
  }

  function labelTransform(d) {
    const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
    const y = (d.y0 + d.y1) / 2 * radius;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  }

  return svg.node();
}

// 変換処理を修正：各プロジェクトごとに、employee の links から会社IDを抽出してグループ化
function transformData(flat) {
  const nodes = flat.nodes;
  const config = flat.config;
  // project, employee はそのまま使用
  const projects = nodes.filter(d => d.type === "project");
  const employees = nodes.filter(d => d.type === "employee");
  const companies = nodes.filter(d => d.type === "company"); // 会社名取得用

  const tree = { name: "root", children: [] };

  projects.forEach(proj => {
    const projItem = { name: proj.name, value: config.types.project.size, children: [] };
    // プロジェクトに紐づく従業員を集計
    const groupedCompanies = {};
    employees.forEach(emp => {
      if (emp.links.includes(proj.id)) {
        // 従業員の links から会社ID (先頭文字が'c') を取得
        const compId = emp.links.find(link => link.startsWith('c'));
        if (compId) {
          if (!groupedCompanies[compId]) {
            // companies 配列から該当する会社オブジェクトを探す
            const compObj = companies.find(c => c.id === compId);
            groupedCompanies[compId] = { 
              name: compObj ? compObj.name : compId, 
              value: config.types.company.size, 
              children: [] 
            };
          }
          groupedCompanies[compId].children.push({
            name: emp.name,
            value: config.types.employee.size
          });
        }
      }
    });
    projItem.children = Object.values(groupedCompanies);
    if (projItem.children.length > 0) {
      tree.children.push(projItem);
    }
  });
  return tree;
}

// データ読み込みと描画実行の例（data.json のデータを使用）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    fetch('data.json')
      .then(response => response.json())
      .then(data => {
        // 平坦なデータの場合、階層構造に変換
        const tree = data.nodes ? transformData(data) : data;
        const chartNode = renderSunburst(tree);
        // #canvas 内に中央配置するため、innerHTMLをクリアしてからappend
        const container = document.querySelector("#canvas");
        container.innerHTML = "";
        container.appendChild(chartNode);
      })
      .catch(error => {
        console.error('Error loading data:', error);
      });
  });
} else {
  fetch('data.json')
    .then(response => response.json())
    .then(data => {
      const tree = data.nodes ? transformData(data) : data;
      const chartNode = renderSunburst(tree);
      const container = document.querySelector("#canvas");
      container.innerHTML = "";
      container.appendChild(chartNode);
    })
    .catch(error => {
      console.error('Error loading data:', error);
    });
}
