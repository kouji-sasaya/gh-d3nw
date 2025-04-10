export async function loadData() {
  const response = await fetch("data.json");
  const json = await response.json();
  
  // Generate links based on parent-child relationships
  const links = json.nodes.reduce((acc, node) => {
    if (node.children) {
      node.children.forEach(childId => {
        acc.push({
          source: node.id,
          target: childId
        });
      });
    }
    return acc;
  }, []);

  return {
    nodes: json.nodes,
    links: links,
    config: json.config
  };
}
