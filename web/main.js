import { dataService } from './services/dataService.js';
import { graphStore } from './stores/graphStore.js';

// カラーパレットの定義
const colorScale = d3.scaleOrdinal()
  .range([
    '#4285F4', // Google Blue
    '#DB4437', // Google Red
    '#F4B400', // Google Yellow
    '#0F9D58', // Google Green
    '#4286f4', // Light Blue
    '#db4437', // Light Red
    '#f4b400', // Light Yellow
    '#0f9d58', // Light Green
    '#3367D6', // Dark Blue
    '#C5221F'  // Dark Red
  ]);

const width = 928;
const height = 680;

// Specify the color scale
const color = d3.scaleOrdinal(d3.schemeCategory10);

const svg = d3.select("svg")
  .attr("width", width)
  .attr("height", height)
  .attr("viewBox", [-width / 2, -height / 2, width, height])
  .attr("style", "max-width: 100%; height: 100%;") // Changed to use full height
  .call(d3.zoom().on("zoom", ({ transform }) => {
    container.attr("transform", transform);
  }));

const container = svg.append("g");

async function loadData() {
  const response = await fetch('data.json');
  const data = await response.json();
  
  // 与えられたJSONデータからノードとリンクを作成
  const nodes = data.nodes;
  const links = [];
  
  // リンク情報を生成
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

  return { nodes, links, config: data.config };
}

function createTypeCheckboxes(types) {
  const checkboxContainer = d3.select("body")
    .append("div")
    .attr("class", "type-checkbox-container")
    .style("display", "flex")
    .style("flex-direction", "column");

  Object.keys(types).forEach(type => {
    const label = checkboxContainer.append("label")
      .style("margin-bottom", "5px");

    label.append("input")
      .attr("type", "checkbox")
      .attr("class", "filter-checkbox")
      .attr("data-group", type)
      .property("checked", true);

    label.append("span")
      .text(type);
  });
}

loadData().then(({ nodes, links, config }) => {
  createTypeCheckboxes(config.types);
  
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(d => {
      // 従業員からのリンクは距離を調整
      if (nodes.find(node => node.id === d.source.id)?.type === "employee") {
        return 50 * 3;
      }
      return 50 * 3;
    }))
    .force("charge", d3.forceManyBody().strength(-30))
    .force("x", d3.forceX())
    .force("y", d3.forceY())
    .force("collision", d3.forceCollide().radius(d => {
      // configから各タイプのサイズを取得
      return config.types[d.type].size / 10 + 5;
    }));

  // リンクの描画設定
  const link = container.append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke-width", 1.5);

  // ノードの描画設定
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

  // ノードの円を描画
  node.append("circle")
    .attr("r", d => config.types[d.type].size / 4)
    .attr("fill", d => config.types[d.type].color);

  node.append("g")
    .each(function(d) {
      if (d.type === "service") {
        if (d.name.toLowerCase() === "github") {
          d3.select(this).append("image")
            .attr("xlink:href", "github-mark.svg")
            .attr("width", config.types[d.type].size / 2)
            .attr("height", config.types[d.type].size / 2)
            .attr("x", -config.types[d.type].size / 4)
            .attr("y", -config.types[d.type].size / 4);
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

  // Add titles to nodes
  node.append("title")
    .text(d => d.name);

  // Set the position attributes of links and nodes each time the simulation ticks
  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node
      .attr("transform", d => `translate(${d.x},${d.y})`);
  });

  // Add filtering functionality
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

    // Remove dependencies for hidden nodes
    const filteredLinks = links.filter(link => {
      if (link.source.hidden || link.target.hidden) {
        link.source.fx = null; // Unpin hidden nodes
        link.source.fy = null;
        link.target.fx = null;
        link.target.fy = null;
        return false; // Exclude hidden links
      }
      return true;
    });

    simulation.force("link").links(filteredLinks);

    simulation.alpha(1).restart();

    // Move hidden nodes away from the center
    nodes.forEach(node => {
      if (node.hidden) {
        node.fx = node.x + 500; // Move far from the center
        node.fy = node.y + 500;
      } else {
        node.fx = null;
        node.fy = null;
      }
    });

    // Update node and link visibility
    node.style("display", d => (d.hidden ? "none" : "block"));
    link.style("display", d => (!d.source.hidden && !d.target.hidden ? "block" : "none"));
  });

  // Drag behavior functions
  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;

    // ドラッグ中のノードに接続されたリンクを赤くして太くする
    link
      .attr("stroke", d => (d.source.id === event.subject.id || d.target.id === event.subject.id ? "red" : "#999"))
      .attr("stroke-width", d => (d.source.id === event.subject.id || d.target.id === event.subject.id ? 3 : 1.5));
  }

  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    // Keep the node pinned at its current position
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;

    // ドラッグ終了後にリンクのスタイルをリセット
    link
      .attr("stroke", "#999")
      .attr("stroke-width", 1.5);
  }

  // Double-click behavior to unpin nodes
  node.on("dblclick", (event, d) => {
    d.fx = null;
    d.fy = null;
  });
});
