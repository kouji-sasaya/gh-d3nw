// SVGの表示を確認
d3.select('#canvas svg').style('display', 'block');
d3.select('#table-container').style('display', 'none');

// カラーパレットの定義
const colorScale = d3.scaleOrdinal()
  .range([
    '#4285F4', '#DB4437', '#F4B400', '#0F9D58',
    '#4286f4', '#db4437', '#f4b400', '#0f9d58',
    '#3367D6', '#C5221F'
  ]);

const width = 928;
const height = 680;

const color = d3.scaleOrdinal(d3.schemeCategory10);

const svg = d3.select("svg")
  .attr("width", width)
  .attr("height", height)
  .attr("viewBox", [-width / 2, -height / 2, width, height])
  .attr("style", "max-width: 100%; height: 100%;")
  .call(d3.zoom()
    .scaleExtent([0.1, 4]) // ズームの範囲を0.1倍から4倍に設定
    .on("zoom", (event) => {
      container.attr("transform", event.transform);
    })
  );

const container = svg.append("g");

// コンテナのトランスフォーム初期化
container.attr("transform", "translate(0,0) scale(1)");

// チェックボックスコンテナの作成
const checkboxContainer = d3.select("body")
  .append("div")
  .attr("class", "type-checkbox-container")
  .style("display", "flex")
  .style("flex-direction", "column");

// 型名の表示マッピング
const typeLabels = {
  'project': 'Projects',
  'company': 'Companies',
  'service': 'Services',
  'employee': 'Employees'
};

// データを読み込んでグラフを表示
fetch('data.json')
    .then(response => response.json())
    .then(data => {
        // チェックボックスの作成
        Object.keys(data.config.types).forEach(type => {
            const label = checkboxContainer.append("label")
                .style("margin-bottom", "5px");

            label.append("input")
                .attr("type", "checkbox")
                .attr("class", "filter-checkbox")
                .attr("data-group", type)
                .property("checked", true);

            label.append("span")
                .text(typeLabels[type]);
        });

        const nodes = data.nodes;
        const links = [];
        
        nodes.forEach(node => {
            if (node.links) {
                node.links.forEach(targetId => {
                    links.push({
                        source: node.id,
                        target: targetId
                    });
                });
            }
        });

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(d => {
                if (nodes.find(node => node.id === d.source.id)?.type === "employee") {
                    return 50 * 3;
                }
                return 50 * 3;
            }))
            .force("charge", d3.forceManyBody().strength(-30))
            .force("x", d3.forceX())
            .force("y", d3.forceY())
            .force("collision", d3.forceCollide().radius(d => {
                return data.config.types[d.type].size / 10 + 5;
            }));

        const link = container.append("g")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke-width", 1.5);

        const node = container.append("g")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .selectAll("g")
            .data(nodes)
            .join("g")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        node.append("circle")
            .attr("r", d => data.config.types[d.type].size / 4)
            .attr("fill", d => data.config.types[d.type].color);

        node.append("g")
            .each(function(d) {
                if (d.type === "service") {
                    if (d.name.toLowerCase() === "github") {
                        d3.select(this).append("image")
                            .attr("xlink:href", "github-mark.svg")
                            .attr("width", data.config.types[d.type].size / 2)
                            .attr("height", data.config.types[d.type].size / 2)
                            .attr("x", -data.config.types[d.type].size / 4)
                            .attr("y", -data.config.types[d.type].size / 4);
                    } else {
                        d3.select(this).append("text")
                            .text(d => d.name)
                            .attr("text-anchor", "middle")
                            .attr("dy", ".35em")
                            .attr("font-size", "10px")
                            .attr("font-family", "Arial, sans-serif")
                            .attr("fill", "black")
                            .attr("stroke", "none");
                    }
                } else {
                    d3.select(this).append("text")
                        .text(d => d.name)
                        .attr("text-anchor", "middle")
                        .attr("dy", ".35em")
                        .attr("font-size", "10px")
                        .attr("font-family", "Arial, sans-serif")
                        .attr("fill", "black")
                        .attr("stroke", "none");
                }
            });

        node.append("title")
            .text(d => d.name);

        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("transform", d => `translate(${d.x},${d.y})`);
        });

        const checkboxes = d3.selectAll(".filter-checkbox");
        checkboxes.on("change", function() {
            // アクティブな型を取得
            const activeTypes = new Set(
                Array.from(document.querySelectorAll('.filter-checkbox'))
                    .filter(cb => cb.checked)
                    .map(cb => cb.dataset.group)
            );

            // ノードの表示状態を更新
            node.each(d => {
                d.hidden = !activeTypes.has(d.type);
            });

            // リンクをフィルタリング
            const filteredLinks = links.filter(link => {
                const sourceNode = nodes.find(n => n.id === link.source.id || n.id === link.source);
                const targetNode = nodes.find(n => n.id === link.target.id || n.id === link.target);
                return !sourceNode.hidden && !targetNode.hidden;
            });

            // シミュレーションを更新
            simulation.force("link").links(filteredLinks);
            simulation.alpha(1).restart();

            // ノードとリンクの表示を更新
            node.style("display", d => d.hidden ? "none" : "block");
            link.style("display", d => {
                const sourceNode = nodes.find(n => n.id === d.source.id || n.id === d.source);
                const targetNode = nodes.find(n => n.id === d.target.id || n.id === d.target);
                return (!sourceNode.hidden && !targetNode.hidden) ? "block" : "none";
            });
        });

        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;

            link
                .attr("stroke", d => (d.source.id === event.subject.id || d.target.id === event.subject.id ? "red" : "#999"))
                .attr("stroke-width", d => (d.source.id === event.subject.id || d.target.id === event.subject.id ? 3 : 1.5));
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;

            link
                .attr("stroke", "#999")
                .attr("stroke-width", 1.5);
        }

        node.on("dblclick", (event, d) => {
            d.fx = null;
            d.fy = null;
        });
    })
    .catch(error => {
        console.error('Error loading data:', error);
        const sampleData = {
            nodes: [
                { id: 1, name: "Project A", type: "project", links: ["2", "3"] },
                { id: 2, name: "Company B", type: "company", links: ["1"] },
                { id: 3, name: "Service C", type: "service", links: ["1"] },
                { id: 4, name: "Employee D", type: "employee", links: ["2"] }
            ]
        };

        const nodes = sampleData.nodes;
        const links = [];
        
        nodes.forEach(node => {
            if (node.links) {
                node.links.forEach(targetId => {
                    links.push({
                        source: node.id,
                        target: targetId
                    });
                });
            }
        });

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(d => {
                if (nodes.find(node => node.id === d.source.id)?.type === "employee") {
                    return 50 * 3;
                }
                return 50 * 3;
            }))
            .force("charge", d3.forceManyBody().strength(-30))
            .force("x", d3.forceX())
            .force("y", d3.forceY())
            .force("collision", d3.forceCollide().radius(d => {
                return 10 + 5;
            }));

        const link = container.append("g")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke-width", 1.5);

        const node = container.append("g")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .selectAll("g")
            .data(nodes)
            .join("g")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        node.append("circle")
            .attr("r", 10 / 4)
            .attr("fill", "blue");

        node.append("g")
            .each(function(d) {
                d3.select(this).append("text")
                    .text(d => d.name)
                    .attr("text-anchor", "middle")
                    .attr("dy", ".35em")
                    .attr("font-size", "10px")
                    .attr("font-family", "Arial, sans-serif")
                    .attr("fill", "black")
                    .attr("stroke", "none");
            });

        node.append("title")
            .text(d => d.name);

        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("transform", d => `translate(${d.x},${d.y})`);
        });

        const checkboxes = d3.selectAll(".filter-checkbox");
        checkboxes.on("change", function() {
            // アクティブな型を取得
            const activeTypes = new Set(
                Array.from(document.querySelectorAll('.filter-checkbox'))
                    .filter(cb => cb.checked)
                    .map(cb => cb.dataset.group)
            );

            // ノードの表示状態を更新
            node.each(d => {
                d.hidden = !activeTypes.has(d.type);
            });

            // リンクをフィルタリング
            const filteredLinks = links.filter(link => {
                const sourceNode = nodes.find(n => n.id === link.source.id || n.id === link.source);
                const targetNode = nodes.find(n => n.id === link.target.id || n.id === link.target);
                return !sourceNode.hidden && !targetNode.hidden;
            });

            // シミュレーションを更新
            simulation.force("link").links(filteredLinks);
            simulation.alpha(1).restart();

            // ノードとリンクの表示を更新
            node.style("display", d => d.hidden ? "none" : "block");
            link.style("display", d => {
                const sourceNode = nodes.find(n => n.id === d.source.id || n.id === d.source);
                const targetNode = nodes.find(n => n.id === d.target.id || n.id === d.target);
                return (!sourceNode.hidden && !targetNode.hidden) ? "block" : "none";
            });
        });

        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;

            link
                .attr("stroke", d => (d.source.id === event.subject.id || d.target.id === event.subject.id ? "red" : "#999"))
                .attr("stroke-width", d => (d.source.id === event.subject.id || d.target.id === event.subject.id ? 3 : 1.5));
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;

            link
                .attr("stroke", "#999")
                .attr("stroke-width", 1.5);
        }

        node.on("dblclick", (event, d) => {
            d.fx = null;
            d.fy = null;
        });
    });
