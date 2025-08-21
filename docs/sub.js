async function loadData() {
  const response = await fetch("data.json");
  const json = await response.json();
  return json.data;
}

const sampleData = {
    nodes: [
        { id: 1, name: "Project A", address: "123 Main St", type: "project", links: ["2", "3"] },
        { id: 2, name: "domain B", address: "456 Elm St", type: "domain", links: ["1"] },
        { id: 3, name: "Service C", address: "789 Oak St", type: "service", links: ["1"] },
        { id: 4, name: "User D", address: "101 Pine St", type: "user", links: ["2"] }
    ]
};

function createTable(data) {
  const table = d3.select("body")
    .append("table")
    .attr("style", "border-collapse: collapse; width: 100%;");

  // Add table header
  const thead = table.append("thead");
  thead.append("tr")
    .selectAll("th")
    .data(["ID", "Name", "Type", "Projects", "domain", "Nickname", "Services"])
    .enter()
    .append("th")
    .text(d => d)
    .attr("style", "border: 1px solid black; padding: 8px; background-color: #f2f2f2; text-align: left;");

  // Add table body
  const tbody = table.append("tbody");
  const rows = tbody.selectAll("tr")
    .data(data)
    .enter()
    .append("tr");

  // Add cells to rows
  rows.selectAll("td")
    .data(d => [
      d.id,
      d.name,
      d.type,
      d.projects ? d.projects.join(", ") : "",
      d.domain,
      d.nickname,
      d.services ? d.services.join(", ") : ""
    ])
    .enter()
    .append("td")
    .text(d => d)
    .attr("style", "border: 1px solid black; padding: 8px;");
}

loadData().then(data => {
  createTable(data);
});
