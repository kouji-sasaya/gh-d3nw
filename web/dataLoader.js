export async function loadData() {
  const [dataResponse, configResponse] = await Promise.all([
    fetch("data.json"),
    fetch("config.json")
  ]);

  const dataJson = await dataResponse.json();
  const configJson = await configResponse.json();

  // Generate links based on parent-child relationships
  const links = dataJson.nodes.reduce((acc, node) => {
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
    nodes: dataJson.nodes,
    links: links,
    config: configJson
  };
}
