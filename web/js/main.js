async function loadData() {
  try {
    // データの読み込み
    const response = await fetch('data.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // データ構造の検証
    if (!data || !Array.isArray(data.nodes)) {
      throw new Error('Invalid data format: nodes array is required');
    }

    const nodes = data.nodes.map(node => ({
      id: node.id,
      name: node.name,
      type: node.type,
      links: Array.isArray(node.links) ? node.links : []
    }));

    // リンクの構築
    const links = [];
    nodes.forEach(node => {
      if (Array.isArray(node.links)) {
        node.links.forEach(targetId => {
          const target = nodes.find(n => n.id === targetId);
          if (target) {
            links.push({
              source: node.id,
              target: targetId
            });
          }
        });
      }
    });

    return {
      nodes,
      links,
      config: data.config || {
        types: {
          project: { size: 100, color: "#4285F4" },
          company: { size: 70, color: "#DB4437" },
          service: { size: 40, color: "#F4B400" },
          employee: { size: 20, color: "#0F9D58" }
        }
      }
    };
  } catch (error) {
    console.error('Error loading or processing data:', error);
    return {
      nodes: [],
      links: [],
      config: {
        types: {
          project: { size: 100, color: "#4285F4" },
          company: { size: 70, color: "#DB4437" },
          service: { size: 40, color: "#F4B400" },
          employee: { size: 20, color: "#0F9D58" }
        }
      }
    };
  }
}

// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await loadData();
    // ... 残りの初期化コード ...
  } catch (error) {
    console.error('Failed to initialize:', error);
  }
});