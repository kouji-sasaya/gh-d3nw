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
  .attr("style", "max-width: 100%; height: 100%;");

const container = svg.append("g");

// データを読み込んでグラフを表示
fetch('data.json')
    .then(response => response.json())
    .then(data => {
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
        checkboxes.on("change", () => {
            const activeTypes = new Set(
                checkboxes
                    .filter(function () { return this.checked; })
                    .nodes()
                    .map(checkbox => checkbox.dataset.group)
            );

            nodes.forEach(node => {
                node.hidden = !activeTypes.has(node.type);
            });

            const filteredLinks = links.filter(link => {
                if (link.source.hidden || link.target.hidden) {
                    link.source.fx = null;
                    link.source.fy = null;
                    link.target.fx = null;
                    link.target.fy = null;
                    return false;
                }
                return true;
            });

            simulation.force("link").links(filteredLinks);

            simulation.alpha(1).restart();

            nodes.forEach(node => {
                if (node.hidden) {
                    node.fx = node.x + 500;
                    node.fy = node.y + 500;
                } else {
                    node.fx = null;
                    node.fy = null;
                }
            });

            node.style("display", d => (d.hidden ? "none" : "block"));
            link.style("display", d => (!d.source.hidden && !d.target.hidden ? "block" : "none"));
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
        checkboxes.on("change", () => {
            const activeTypes = new Set(
                checkboxes
                    .filter(function () { return this.checked; })
                    .nodes()
                    .map(checkbox => checkbox.dataset.group)
            );

            nodes.forEach(node => {
                node.hidden = !activeTypes.has(node.type);
            });

            const filteredLinks = links.filter(link => {
                if (link.source.hidden || link.target.hidden) {
                    link.source.fx = null;
                    link.source.fy = null;
                    link.target.fx = null;
                    link.target.fy = null;
                    return false;
                }
                return true;
            });

            simulation.force("link").links(filteredLinks);

            simulation.alpha(1).restart();

            nodes.forEach(node => {
                if (node.hidden) {
                    node.fx = node.x + 500;
                    node.fy = node.y + 500;
                } else {
                    node.fx = null;
                    node.fy = null;
                }
            });

            node.style("display", d => (d.hidden ? "none" : "block"));
            link.style("display", d => (!d.source.hidden && !d.target.hidden ? "block" : "none"));
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
