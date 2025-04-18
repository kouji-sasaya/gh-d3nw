// SVGの表示を確認
d3.select('#canvas svg').style('display', 'block');
d3.select('#table-container').style('display', 'none');

// キャンバスサイズを取得して調整
const container = document.getElementById('canvas');
const width = container.clientWidth;
const height = container.clientHeight;
const navbar = document.querySelector('.navbar');
const navHeight = navbar ? navbar.clientHeight : 0;
const availableHeight = height - navHeight;
const radius = availableHeight * 0.17;  // Reduced further from 0.35 to 0.30 for vertical fit
const domainColorScale = d3.scaleOrdinal(d3.schemeCategory10); // new scale for domain-specific colors

const arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(radius * 1.5)
    .innerRadius(d => d.y0 * radius)
    .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

const svg = d3.select("svg")
    .attr("width", width)
    .attr("height", availableHeight)
    .attr("viewBox", [-width/2, -availableHeight/2, width, availableHeight])  // Center the viewBox based on availableHeight
    .style("font", "10px sans-serif");

// データを読み込んでSunburstを表示
fetch('data.json')
    .then(response => response.json())
    .then(data => {
        const root = partition(formatData(data));
        
        // Initialize the root's current property
        root.each(d => d.current = {
            x0: d.x0,
            x1: d.x1,
            y0: d.y0,
            y1: d.y1
        });

        svg.selectAll('*').remove();

        const g = svg.append("g");

        const path = g.append("g")
            .selectAll("path")
            .data(root.descendants().slice(1))
            .join("path")
            .attr("fill", d => {
                const ancestors = d.ancestors();
                const domainAncestor = ancestors.find(a => a.data.type === "domain");
                if (domainAncestor) {
                    return domainColorScale(domainAncestor.data.name);
                }
                let node = d;
                while (node.depth > 1) node = node.parent;
                return color(node.data.name);
            })
            .attr("fill-opacity", d => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
            .attr("pointer-events", d => arcVisible(d.current) ? "auto" : "none")
            .attr("d", d => arc(d.current));

        path.filter(d => d.children)
            .style("cursor", "pointer")
            .on("click", clicked);

        path.append("title")
            .text(d => `${d.ancestors().map(d => d.data.name).reverse().join("/")}`);

        const label = g.append("g")
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

        const parent = g.append("circle")
            .datum(root)
            .attr("r", radius)
            .attr("fill", "none")
            .attr("pointer-events", "all")
            .on("click", clicked);

        function clicked(event, p) {
            parent.datum(p.parent || root);

            root.each(d => d.target = {
                x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
                x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
                y0: Math.max(0, d.y0 - p.depth),
                y1: Math.max(0, d.y1 - p.depth)
            });

            const t = g.transition().duration(750);

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
    });

function formatData(data) {
    const root = {
        name: "root",
        children: []
    };

    // プロジェクトノードの作成
    const projectNodes = data.nodes.filter(n => n.type === "project");
    projectNodes.forEach(project => {
        const projectNode = {
            name: project.name,
            children: []
        };

        // プロジェクトに関連するドメインを追加
        const domains = data.nodes.filter(n => 
            n.type === "domain" && 
            data.nodes.some(e => 
                e.type === "employee" && 
                e.links.includes(project.id) && 
                e.links.includes(n.id)
            )
        );

        domains.forEach(domain => {
            const domainNode = {
                name: domain.name,
                type: "domain", // mark domain nodes
                children: []
            };

            // 会社に所属する従業員を追加
            const employees = data.nodes.filter(n => 
                n.type === "employee" && 
                n.links.includes(domain.id) && 
                n.links.includes(project.id)
            );

            employees.forEach(employee => {
                domainNode.children.push({
                    name: employee.name
                });
            });

            if (domainNode.children.length > 0) {
                projectNode.children.push(domainNode);
            }
        });

        if (projectNode.children.length > 0) {
            root.children.push(projectNode);
        }
    });

    return root;
}

const partition = data => {
    const root = d3.hierarchy(data)
        .sum(d => d.children ? 0 : 1)
        .sort((a, b) => b.value - a.value);
    return d3.partition()
        .size([2 * Math.PI, root.height + 1])
        (root);
};

const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, 8));

function arcVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
}

function labelVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
}

function labelTransform(d) {
    const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
    const y = ((d.y0 + d.y1) / 2) * radius;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
}
