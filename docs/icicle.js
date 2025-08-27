// Zoomable icicle (reads data.json, converts flat graph -> tree, draws interactive icicle)
(function() {
    const container = document.getElementById('canvas');
    if (!container) return;

    // ensure svg present (index.html loadScript resets #canvas to "<svg></svg>")
    const svgEl = container.querySelector('svg') || (function() {
        const s = document.createElementNS('http://www.w3.org/2000/svg','svg');
        container.appendChild(s);
        return s;
    })();
    const svg = d3.select(svgEl);

    // layout params (will recompute on resize)
    let width = Math.max(600, container.clientWidth);
    let height = Math.max(320, container.clientHeight * 0.85);
    let rootNode = null;
    let partition = null;
    let x = d3.scaleLinear().range([0, width]);
    let y = d3.scaleLinear().range([0, height]);
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    svg.attr('width', width).attr('height', height).style('font', '12px sans-serif');
    svg.selectAll('*').remove();
    const g = svg.append('g');

    // Convert flat nodes -> hierarchy (simple rules: projects under root, domains/services/users attach to project/domain if linked)
    function buildHierarchyFromFlat(nodes) {
        const map = new Map(nodes.map(n => [n.id, Object.assign({}, n, { children: [] })]));
        const root = { id: '__root__', name: 'All', children: [] };
        const get = id => map.get(id);

        // attach projects under root
        nodes.filter(n => n.type === 'project').forEach(p => root.children.push(get(p.id)));

        // domains: prefer linking to project, else root
        nodes.filter(n => n.type === 'domain').forEach(d => {
            const parent = (d.links || []).find(id => get(id) && get(id).type === 'project');
            if (parent && get(parent)) get(parent).children.push(get(d.id));
            else root.children.push(get(d.id));
        });

        // services: attach to project if linked, else root
        nodes.filter(n => n.type === 'service').forEach(s => {
            const parent = (s.links || []).find(id => get(id) && get(id).type === 'project');
            if (parent && get(parent)) get(parent).children.push(get(s.id));
            else root.children.push(get(s.id));
        });

        // users: prefer project, then domain, then first link, else root
        nodes.filter(n => n.type === 'user').forEach(u => {
            const links = u.links || [];
            const parentId = links.find(id => get(id) && get(id).type === 'project')
                           || links.find(id => get(id) && get(id).type === 'domain')
                           || links[0];
            if (parentId && get(parentId)) get(parentId).children.push(get(u.id));
            else root.children.push(get(u.id));
        });

        return root;
    }

    // build partition and draw
    function draw(dataArray) {
        svg.selectAll('*').remove();
        const g = svg.append('g');

        width = Math.max(600, container.clientWidth);
        height = Math.max(320, container.clientHeight * 0.85);

        svg.attr('width', width).attr('height', height);
        x.range([0, width]);
        y.range([0, height]);

        // build hierarchy
        const tree = buildHierarchyFromFlat(dataArray);
        rootNode = d3.hierarchy(tree)
            .sum(d => (d.children && d.children.length) ? 0 : 1)
            .sort((a,b) => b.value - a.value);

        partition = d3.partition()
            .size([1, rootNode.height + 1]); // x in [0,1], y in [0,depth+1]

        partition(rootNode);

        // scales: x maps x0..x1 (0..1) -> [0,width], y maps depth -> [0,height]
        x.domain([0,1]).range([0,width]);
        y.domain([0, rootNode.height + 1]).range([0, height]);

        const nodes = rootNode.descendants();

        const cell = g.selectAll('g')
            .data(nodes)
            .join('g')
            .attr('transform', d => `translate(${x(d.x0)},${y(d.y0)})`)
            .style('cursor', d => d.children ? 'pointer' : 'default')
            .on('click', (event,d) => clicked(d));

        cell.append('rect')
            .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
            .attr('height', d => Math.max(0, y(d.y1) - y(d.y0) - 1))
            .attr('fill', d => {
                // color by type if present, else by depth
                const t = (d.data && d.data.type) ? d.data.type : (d.depth === 0 ? 'root' : `depth${d.depth}`);
                return color(t);
            })
            .attr('stroke', '#fff');

        cell.append('title').text(d => `${(d.data && d.data.name) || d.data.id} — ${d.value}`);

        const text = cell.append('text')
            .attr('x', 6)
            .attr('y', 12)
            .attr('fill', '#111')
            .style('pointer-events', 'none')
            .text(d => (d.data && d.data.name) ? d.data.name : d.data.id)
            .each(function(d) {
                // clamp long labels
                const t = d3.select(this);
                let s = t.text();
                if (s.length > 30) t.text(s.slice(0,28) + '…');
            });

        // visibility helper
        function labelVisible(d) {
            const w = x(d.x1) - x(d.x0);
            return w > 60 && (y(d.y1) - y(d.y0) > 12);
        }
        text.attr('display', d => labelVisible(d) ? null : 'none');

        // clicked: zoom into node p
        function clicked(p) {
            const duration = 600;
            const kx = width / (p.x1 - p.x0);
            const ky = height / (rootNode.height + 1 - p.depth);

            x.domain([p.x0, p.x1]);
            y.domain([p.depth, rootNode.height + 1]);

            const t = g.transition().duration(duration);

            cell.transition(t)
                .attr('transform', d => `translate(${x(d.x0)},${y(d.y0)})`);

            cell.select('rect').transition(t)
                .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
                .attr('height', d => Math.max(0, y(d.y1) - y(d.y0) - 1));

            cell.select('text').transition(t)
                .attr('display', d => labelVisible(d) ? null : 'none')
                .attr('x', 6)
                .attr('y', 12);
        }

        // initial focus at root (no-op but ensures domains set)
        clicked(rootNode);

        // keep svg overflow visible so labels near edges aren't clipped
        svg.style('overflow','visible');
    }

    // load data.json and draw
    fetch('data.json')
        .then(r => r.json())
        .then(data => {
            // if data is object like { nodes: [...] }
            const arr = Array.isArray(data) ? data : (Array.isArray(data.nodes) ? data.nodes : []);
            draw(arr);
        })
        .catch(err => {
            console.error('zoomable-icicle: failed to load data.json', err);
            // no-op
        });

    // responsive: redraw on resize (throttle)
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (!rootNode) return;
            // re-compute width/height and redraw from original data by reconstructing flat arr
            // easiest: re-fetch data (small)
            fetch('data.json').then(r => r.json()).then(data => {
                const arr = Array.isArray(data) ? data : (Array.isArray(data.nodes) ? data.nodes : []);