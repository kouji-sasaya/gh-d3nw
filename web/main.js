import { loadLinks } from "./dataLoader.js";

loadLinks().then(links => {
  // Skip the header row
  links = links.slice(1);

  const width = window.innerWidth;
  const height = window.innerHeight;

  // Initialize nodes with unique IDs and types from links
  const nodes = Array.from(
    new Set(links.flatMap(l => [l.source, l.target])),
    id => ({
      id,
      type: links.find(l => l.source === id)?.type || "unknown" // Assign type if available
    })
  );

  const svg = d3.select("svg")
    .attr("viewBox", [0, 0, width, height])
    .call(d3.zoom().on("zoom", zoomed));

  const container = svg.append("g");

  // Define arrow markers for links
  const defs = container.append("defs");
  defs.append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
    .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#999");

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-50))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide(40));

  const link = container.append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow)");

  const node = container.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
    .selectAll("g")
    .data(nodes)
    .join("g")
      .call(d3.drag()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }));

  node.append("circle")
      .attr("r", 30)
      .attr("fill", d => {
        if (d.id === "apple") return "red"; // Make "apple" red
        switch (d.type) {
          case "fruit": return "orange";
          case "vegetable": return "green";
          case "herb": return "purple";
          case "spice": return "brown";
          case "grain": return "yellow";
          case "nut": return "beige";
          case "protein": return "red";
          case "fungus": return "gray";
          default: return "steelblue";
        }
      })
      .attr("class", d => d.id === "apple" ? "blink" : ""); // Add class for blinking

  node.append("text")
      .text(d => d.id)
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .attr("font-size", "16px")
      .attr("font-family", "Arial, sans-serif")
      .attr("fill", "black");

  node.append("title")
      .text(d => `${d.id} (${d.type})`);

  simulation.on("tick", () => {
    link.attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });

  function zoomed({ transform }) {
    container.attr("transform", transform);
  }
});

// Add CSS for blinking effect
const style = document.createElement("style");
style.textContent = `
  .blink {
    animation: blink-animation 1s infinite;
  }
  @keyframes blink-animation {
    50% { opacity: 0; }
  }
`;
document.head.appendChild(style);