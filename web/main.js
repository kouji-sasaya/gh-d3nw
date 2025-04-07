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

function createTypeCheckboxes() {
  const types = ["project", "company", "service", "employee"];

  // Create a container for checkboxes
  const checkboxContainer = d3.select("body")
    .append("div")
    .attr("class", "type-checkbox-container")
    .style("position", "absolute")
    .style("left", "10px") // Move to the left side
    .style("top", "10px")
    .style("display", "flex")
    .style("flex-direction", "column");

  // Add a checkbox for each type
  types.forEach(type => {
    const label = checkboxContainer.append("label")
      .style("margin-bottom", "5px");

    label.append("input")
      .attr("type", "checkbox")
      .attr("class", "filter-checkbox")
      .attr("data-group", type)
      .property("checked", true); // Default to checked

    label.append("span")
      .text(type);
  });
}

// Call the function to create checkboxes
createTypeCheckboxes();

loadData().then(({ nodes, links }) => {
  // Create a simulation with several forces
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(d => {
      if (nodes.find(node => node.id === d.source.id)?.group === "employee") {
        return 50 * 3; // 3x distance for employees
      }
      return 50 * 3; // Default distance for others, multiplied by 3
    }))
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
      if (d.group === "service") return 10 * 1.5; // 1.5x radius for services
      if (d.group === "company") return 10 * 2; // 2x radius for companies
      if (d.group === "project") return 10 * 2.5; // 2.5x radius for projects
      if (d.group === "employee") return 10; // 1x radius for employees
      return 10; // Default radius for others
    })
    .attr("fill", d => {
      if (d.group === "service") return "purple"; // Purple color for services
      return color(d.group); // Default color for others
    });

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

  // Add filtering functionality
  const checkboxes = d3.selectAll(".filter-checkbox");
  checkboxes.on("change", () => {
    const activeGroups = new Set(
      checkboxes
        .filter(function () { return this.checked; })
        .nodes()
        .map(checkbox => checkbox.dataset.group)
    );

    // Update node visibility and force simulation
    nodes.forEach(node => {
      node.hidden = !activeGroups.has(node.group);
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
