import { loadLinks } from "./dataLoader.js";

const width = 928;
const height = 680;

// Specify the color scale
const color = d3.scaleOrdinal(d3.schemeCategory10);

const svg = d3.select("svg")
  .attr("width", width)
  .attr("height", height)
  .attr("viewBox", [-width / 2, -height / 2, width, height])
  .attr("style", "max-width: 100%; height: auto;")
  .call(d3.zoom().on("zoom", ({ transform }) => {
    container.attr("transform", transform);
  }));

const container = svg.append("g");

async function loadData() {
  const response = await fetch("data.json");
  const json = await response.json();

  // Extract nodes and links from the JSON structure
  const nodes = json.data.map(d => ({
    id: d.id,
    name: d.nickname, // Use "nickname" for display
    group: d.type
  }));

  const links = [];
  json.data.forEach(d => {
    if (d.projects) { // Updated from parentProjectId to projects
      d.projects.forEach(projectId => {
        links.push({ source: d.id, target: projectId });
      });
    }
    if (d.company) { // Updated from parentCompanyId to company
      links.push({ source: d.id, target: d.company });
    }
  });

  return { nodes, links };
}

loadData().then(({ nodes, links }) => {
  // Create a simulation with several forces
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(50))
    .force("charge", d3.forceManyBody().strength(-30))
    .force("x", d3.forceX())
    .force("y", d3.forceY())
    .force("collision", d3.forceCollide().radius(d => {
      if (d.group === "project") return 10 * 5 + 5; // Add padding for projects
      if (d.group === "company") return 10 * 3 + 5; // Add padding for companies
      return 10 + 5; // Add padding for others
    }));

  // Add a line for each link
  const link = container.append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke-width", 1.5);

  // Add a circle for each node
  const node = container.append("g")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .selectAll("g")
    .data(nodes)
    .join("g") // Group for circle and text
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

  node.append("circle")
    .attr("r", d => {
      if (d.group === "project") return 10 * 5; // 5x radius for projects
      if (d.group === "company") return 10 * 3; // 3x radius for companies
      return 10; // Default radius for others
    })
    .attr("fill", d => color(d.group));

  node.append("text")
    .text(d => d.name) // Display "nickname" as the node name
    .attr("text-anchor", "middle")
    .attr("dy", ".35em") // Center vertically
    .attr("font-size", "10px")
    .attr("font-family", "Arial, sans-serif")
    .attr("fill", "black") // Text color
    .attr("stroke", "none"); // Disable text stroke

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

  // Drag behavior functions
  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }
});
