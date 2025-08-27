import ForceGraph3D from 'https://unpkg.com/3d-force-graph@1.73.0/dist/3d-force-graph.min.js';

(function() {
  const canvasDiv = document.getElementById('canvas');
  canvasDiv.innerHTML = '';

  // サンプルデータ
  const nodes = [
    { id: 'A', name: 'Node A' },
    { id: 'B', name: 'Node B' },
    { id: 'C', name: 'Node C' }
  ];
  const links = [
    { source: 'A', target: 'B' },
    { source: 'B', target: 'C' }
  ];

  // 3D Force Graph描画
  ForceGraph3D()(canvasDiv)
    .graphData({ nodes, links })
    .nodeLabel(node => node.name)
    .nodeColor(node => '#1976D2');
})();