import { loadLinks } from "./dataLoader.js";

loadLinks().then(links => {
  const nodes = Array.from(
    new Set(links.flatMap(l => [l.source, l.target])),
    id => ({ id })
  );
  
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  const svg = d3.select("svg")
    .attr("viewBox", [0, 0, width, height])
    .call(d3.zoom().on("zoom", zoomed)); // ズーム機能を追加
  
  const container = svg.append("g"); // ズーム対象のコンテナを追加
  
  // 矢印マーカーの定義を追加
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
    .force("link", d3.forceLink(links).id(d => d.id).distance(150)) // 距離を長く設定
    .force("charge", d3.forceManyBody().strength(-100)) // 引き付けを強く設定
    .force("center", d3.forceCenter(width / 2, height / 2));
  
  const link = container.append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow)");  // ここで矢印を追加
  
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
  
  // 円を塗りつぶした状態に変更
  node.append("circle")
      .attr("r", 30)
      .attr("fill", "steelblue");  // 塗りつぶし設定に変更
  
  // テキスト部分のフォントカラーを黒に変更（attrに加えstyleも指定）
  node.append("text")
      .text(d => d.id)
      .attr("text-anchor", "middle") // テキストを中央揃え
      .attr("dy", ".35em")  // テキストの位置を調整
      .attr("font-size", "16px")  //
      .attr("font-family", "Arial, sans-serif")
      .attr("font-weight", "normal") // フォントを通常に設定
      .attr("fill", "black")    // attrでフォントカラーを黒に指定
      .style("fill", "black");  // styleでもフォントカラーを黒に設定
  
  node.append("title")
      .text(d => d.id);
  
  simulation.on("tick", () => {
    link.attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const r = 30; // 円の半径
          return d.target.x - (dx / distance * r);
        })
        .attr("y2", d => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const r = 30; // 円の半径
          return d.target.y - (dy / distance * r);
        });
    // ノードが画面外に出ないように位置を調整
    node.attr("transform", d => {
      d.x = Math.max(30, Math.min(width - 30, d.x));
      d.y = Math.max(30, Math.min(height - 30, d.y));
      return `translate(${d.x},${d.y})`;
    });
  });

  function zoomed({ transform }) {
    container.attr("transform", transform); // ズーム対象のコンテナを変形
  }
});