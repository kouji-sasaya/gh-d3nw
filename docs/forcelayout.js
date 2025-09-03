// SVGの表示を確認
d3.select('#canvas svg').style('display', 'block');
d3.select('#table-container').style('display', 'none');

// --- スクロールバーを #canvas の直後に描画 ---
let scrollbarContainer = document.getElementById('network-scrollbar-container');
if (!scrollbarContainer) {
  scrollbarContainer = document.createElement('div');
  scrollbarContainer.id = 'network-scrollbar-container';
  scrollbarContainer.style.position = 'relative';
  scrollbarContainer.style.width = '100vw';
  scrollbarContainer.style.margin = '0 auto';
  scrollbarContainer.style.textAlign = 'center';
  scrollbarContainer.style.background = 'rgba(255,255,255,0.5)'; // 半透明
  scrollbarContainer.style.backdropFilter = 'blur(2px)';
  scrollbarContainer.style.padding = '8px 0 4px 0';

  scrollbarContainer.innerHTML = `
    <input
      type="range"
      id="network-scrollbar"
      min="-100"
      max="100"
      value="0"
      style="width: 60%;"
    >
    <span id="network-scrollbar-value">0%</span>
  `;
  // #canvasの直後に挿入
  const canvas = document.getElementById('canvas');
  if (canvas.nextSibling) {
    canvas.parentNode.insertBefore(scrollbarContainer, canvas.nextSibling);
  } else {
    canvas.parentNode.appendChild(scrollbarContainer);
  }
} else {
  scrollbarContainer.style.display = 'block';
}

// スクロールバーの値表示を更新
const scrollbar = document.getElementById('network-scrollbar');
const scrollbarValue = document.getElementById('network-scrollbar-value');
if (scrollbar && scrollbarValue) {
  scrollbar.addEventListener('input', function () {
    scrollbarValue.textContent = `${this.value}%`;
  });
  scrollbar.value = 0;
  scrollbarValue.textContent = '0%';
}

// カラーパレットの定義
const colorScale = d3.scaleOrdinal()
  .range([
    '#4285F4', '#DB4437', '#F4B400', '#0F9D58',
    '#4286f4', '#db4437', '#f4b400', '#0f9d58',
    '#3367D6', '#C5221F'
  ]);

const width = 928;
const height = 680;

const color = d3.scaleOrdinal(d3.schemeCategory10);

const svg = d3.select("svg")
  .attr("width", width)
  .attr("height", height)
  .attr("viewBox", [-width / 2, -height / 2, width, height])
  .attr("style", "max-width: 100%; height: 100%;")
  .call(d3.zoom()
    .scaleExtent([0.1, 4]) // ズームの範囲を0.1倍から4倍に設定
    .on("zoom", (event) => {
      container.attr("transform", event.transform);
    })
  );

const container = svg.append("g");

// コンテナのトランスフォーム初期化
container.attr("transform", "translate(0,0) scale(1)");

// チェックボックスコンテナ（ツールチップ風）を作る場所を reserve
let typeTooltip = document.getElementById('network-type-tooltip');
if (!typeTooltip) {
  typeTooltip = document.createElement('div');
  typeTooltip.id = 'network-type-tooltip';
  typeTooltip.style.position = 'fixed';
  typeTooltip.style.top = '80px';
  typeTooltip.style.right = '12px';
  typeTooltip.style.padding = '8px';
  typeTooltip.style.background = 'rgba(255,255,255,0.95)';
  typeTooltip.style.border = '1px solid rgba(0,0,0,0.08)';
  typeTooltip.style.borderRadius = '6px';
  typeTooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
  typeTooltip.style.zIndex = 9999;
  typeTooltip.style.fontSize = '13px';
  typeTooltip.style.display = 'none'; // 最初は非表示（後で表示）
  document.body.appendChild(typeTooltip);
}

// グローバルで管理
let linkDistance = 150;
let simulation = null;
let fullNodes = [];
let fullLinks = [];
let linkSelection = null;
let nodeSelection = null;
let linkGroup = null;
let nodeGroup = null;
let visibleTypes = new Set(); // 現在表示する type の集合
let animationIntervals = new Map(); // アニメーション管理用

// --- error/warningノードの同期点滅アニメーション ---
let animationTimer = null;
let blinkingState = false;

function startStatusBlinking(nodes) {
    if (animationTimer) {
        clearInterval(animationTimer);
        animationTimer = null;
    }
    if (!nodes.length) return;

    blinkingState = false;

    animationTimer = setInterval(() => {
        blinkingState = !blinkingState;
        nodes.forEach(node => {
            const nodeElement = nodeGroup.select(`g[data-id="${node.id}"]`);
            if (nodeElement.empty()) return;
            const circle = nodeElement.select('circle');
            if (circle.empty()) return;

            const config = window.config || {};
            const originalColor = (config.types && config.types[node.type] && config.types[node.type].color)
                ? config.types[node.type].color
                : color(node.type);
            const originalSize = (config.types && config.types[node.type] && config.types[node.type].size)
                ? config.types[node.type].size / 4
                : 8;

            let alertColor, alertSize;
            if (node.status === 'error') {
                alertColor = '#FF0000';
                alertSize = originalSize * 2;
            } else if (node.status === 'warning') {
                alertColor = '#FFFF00';
                alertSize = originalSize * 2;
            } else {
                return;
            }

            if (blinkingState) {
                circle.transition()
                    .duration(500)
                    .attr('fill', alertColor)
                    .attr('r', alertSize);
            } else {
                circle.transition()
                    .duration(500)
                    .attr('fill', originalColor)
                    .attr('r', originalSize);
            }
        });
    }, 1000);
}

function stopStatusBlinking() {
    if (animationTimer) {
        clearInterval(animationTimer);
        animationTimer = null;
    }
    // 全ノードを元の状態に戻す
    nodeGroup.selectAll('g.node').each(function(d) {
        if (d.status === 'error' || d.status === 'warning') {
            const circle = d3.select(this).select('circle');
            if (!circle.empty()) {
                const config = window.config || {};
                const originalColor = (config.types && config.types[d.type] && config.types[d.type].color)
                    ? config.types[d.type].color
                    : color(d.type);
                const originalSize = (config.types && config.types[d.type] && config.types[d.type].size)
                    ? config.types[d.type].size / 4
                    : 8;
                circle.transition()
                    .duration(300)
                    .attr('fill', originalColor)
                    .attr('r', originalSize);
            }
        }
    });
}

// データと設定を同時に取得
Promise.all([
  fetch('data.json?' + Date.now()).then(res => res.json()), // ←キャッシュ回避
  fetch('config.json?' + Date.now()).then(res => res.json()) // ←キャッシュ回避
]).then(([nodesData, configData]) => {
    const config = configData.config;
    // expose to window so other parts of the file that reference window.config work
    try { window.config = config; } catch (e) { /* noop in strict contexts */ }
    // nodesDataは配列として直接利用
    fullNodes = Array.isArray(nodesData) ? nodesData : (Array.isArray(nodesData.nodes) ? nodesData.nodes : []);
    // build fullLinks from nodes' links array (keep as id strings)
    fullLinks = [];
    fullNodes.forEach(node => {
        if (node.links && node.links.length > 0) {
            node.links.forEach(targetId => {
                fullLinks.push({
                    source: node.id,
                    target: targetId
                });
            });
        }
    });

    // 初期 visibleTypes は config.types の全キー
    visibleTypes = new Set(Object.keys((config && config.types) ? config.types : {}));
    if (visibleTypes.size === 0) {
      // フォールバック: データ中の type を採用
      fullNodes.forEach(n => visibleTypes.add(n.type));
    }

    // UI: ツールチップ内に type チェックボックスを作成（config.json に従う）
    createTypeTooltip(config);

    // シミュレーション作成（最初は fullNodes をそのまま使うが simulation.nodes() は updateGraph() で上書き）
    simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(d => d.id).distance(linkDistance))
        .force("charge", d3.forceManyBody().strength(d => {
            if (d.type === 'user') return -120;
            if (d.type === 'service') return -60;
            return -40;
        }))
        .force("x", d3.forceX())
        .force("y", d3.forceY())
        .force("collision", d3.forceCollide().radius(d => {
            const cfg = (typeof config !== 'undefined' && config && config.types) ? config : (window.config && window.config.types ? window.config : null);
            const baseRadius = (cfg && cfg.types && cfg.types[d.type] && cfg.types[d.type].size)
                ? (cfg.types[d.type].size / 4)
                : 10;
            const nameLen = String(d.name || '').length;
            const labelPadding = (d.type === 'user') ? 12 : 6;
            const nameExtra = Math.min(24, nameLen * 1.5);
            return baseRadius + labelPadding + nameExtra;
        }).iterations(2));

    // グループプレースホルダ生成（updateGraph で再バインド）
    linkGroup = container.append("g").attr("class", "links");
    nodeGroup = container.append("g").attr("class", "nodes");

    // 初回描画
    updateGraph();

    // キー操作: 矢印で linkDistance 操作（既存）とパン系は toolbar で操作済み
})
.catch(error => {
    console.error('Error loading data:', error);
    // フォールバック用の簡易データ
    const sampleData = {
        nodes: [
            { id: '1', name: "Project A", type: "project", links: ["2", "3"] },
            { id: '2', name: "domain B", type: "domain", links: ["1"] },
            { id: '3', name: "Service C", type: "service", links: ["1"] },
            { id: '4', name: "User D", type: "user", links: ["2"] }
        ]
    };
    fullNodes = sampleData.nodes;
    fullLinks = [];
    fullNodes.forEach(node => {
        if (node.links) node.links.forEach(t => fullLinks.push({ source: node.id, target: t }));
    });
    visibleTypes = new Set(fullNodes.map(n => n.type));
    const fbConfig = { types: { project:{}, domain:{}, service:{}, user:{} } };
    try { window.config = fbConfig; } catch (e) {}
    createTypeTooltip(fbConfig);
    simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(d => d.id).distance(linkDistance))
        .force("charge", d3.forceManyBody().strength(-60))
        .force("x", d3.forceX())
        .force("y", d3.forceY())
        .force("collision", d3.forceCollide().radius(10));
    linkGroup = container.append("g").attr("class", "links");
    nodeGroup = container.append("g").attr("class", "nodes");
    updateGraph();
});

// アニメーション関数：エラー・警告ノードの点滅・拡大縮小
function startStatusAnimation(nodeId, status) {
    // 既存のアニメーションがあれば停止
    if (animationIntervals.has(nodeId)) {
        clearInterval(animationIntervals.get(nodeId));
        animationIntervals.delete(nodeId);
    }

    const nodeElement = nodeGroup.select(`g[data-id="${nodeId}"]`);
    if (nodeElement.empty()) return;

    const circle = nodeElement.select('circle');
    if (circle.empty()) return;

    // 元の値を取得
    const nodeData = fullNodes.find(n => n.id === nodeId);
    if (!nodeData) return;

    const config = window.config || {};
    const originalColor = (config.types && config.types[nodeData.type] && config.types[nodeData.type].color) 
        ? config.types[nodeData.type].color 
        : color(nodeData.type);
    const originalSize = (config.types && config.types[nodeData.type] && config.types[nodeData.type].size) 
        ? config.types[nodeData.type].size / 4 
        : 8;

    // ステータスに応じた色とサイズ
    let alertColor, alertSize;
    if (status === 'error') {
        alertColor = '#FF0000'; // 赤色
        alertSize = originalSize * 2; // 2倍のサイズ
    } else if (status === 'warning') {
        alertColor = '#FFFF00'; // 黄色
        alertSize = originalSize * 2; // 2倍のサイズ
    } else {
        return; // error または warning でない場合は何もしない
    }

    let isAlertState = false;
    const interval = setInterval(() => {
        if (isAlertState) {
            // 元の状態に戻す
            circle.transition()
                .duration(500)
                .attr('fill', originalColor)
                .attr('r', originalSize);
            isAlertState = false;
        } else {
            // アラート状態にする
            circle.transition()
                .duration(500)
                .attr('fill', alertColor)
                .attr('r', alertSize);
            isAlertState = true;
        }
    }, 1000); // 1秒間隔

    animationIntervals.set(nodeId, interval);
}

function stopStatusAnimation(nodeId) {
    if (animationIntervals.has(nodeId)) {
        clearInterval(animationIntervals.get(nodeId));
        animationIntervals.delete(nodeId);

        // 元の状態に戻す
        const nodeElement = nodeGroup.select(`g[data-id="${nodeId}"]`);
        if (!nodeElement.empty()) {
            const circle = nodeElement.select('circle');
            if (!circle.empty()) {
                const nodeData = fullNodes.find(n => n.id === nodeId);
                if (nodeData) {
                    const config = window.config || {};
                    const originalColor = (config.types && config.types[nodeData.type] && config.types[nodeData.type].color) 
                        ? config.types[nodeData.type].color 
                        : color(nodeData.type);
                    const originalSize = (config.types && config.types[nodeData.type] && config.types[nodeData.type].size) 
                        ? config.types[nodeData.type].size / 4 
                        : 8;
                    
                    circle.transition()
                        .duration(300)
                        .attr('fill', originalColor)
                        .attr('r', originalSize);
                }
            }
        }
    }
}

// グラフの再構築（visibleTypes に応じて表示ノード／リンクを変更）
function updateGraph() {
    // 既存のアニメーションをすべて停止
    stopStatusBlinking();

    // visible nodes & links
    const visibleNodes = fullNodes.filter(n => visibleTypes.has(n.type));
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
        const visibleLinks = fullLinks.filter(l => visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target));

    // simulation にノード／リンクを設定
        // normalize links so source/target are node objects when possible
        const nodeById = new Map(visibleNodes.map(n => [n.id, n]));
        const normalizedLinks = visibleLinks.map(l => ({
            source: (nodeById.get(l.source) || l.source),
            target: (nodeById.get(l.target) || l.target)
        }));

        simulation.nodes(visibleNodes);
        simulation.force("link").links(normalizedLinks);

    // link の data join
    linkSelection = linkGroup.selectAll("line")
        .data(visibleLinks, d => {
            // Make key stable whether source/target are id strings or node objects
            const s = (typeof d.source === 'object') ? d.source.id : d.source;
            const t = (typeof d.target === 'object') ? d.target.id : d.target;
            return s + "->" + t;
        });

    linkSelection.exit().remove();

    const linkEnter = linkSelection.enter().append("line")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", 1.5);

    linkSelection = linkEnter.merge(linkSelection);

    // node の data join
    nodeSelection = nodeGroup.selectAll("g.node")
        .data(visibleNodes, d => d.id);

    // exit
    nodeSelection.exit().remove();

    // enter
    const nodeEnter = nodeSelection.enter().append("g")
        .attr("class", "node")
        .attr("data-id", d => d.id) // data-id属性を追加
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    nodeEnter.append("circle")
        .attr("r", d => {
            // デフォルトサイズフォールバック
            try {
                const cfg = (typeof config !== 'undefined' && config && config.types) ? config : (window.config && window.config.types ? window.config : null);
                return (cfg && cfg.types && cfg.types[d.type] && cfg.types[d.type].size) ? cfg.types[d.type].size / 4 : 8;
            } catch(e){ return 8; }
        })
        .attr("fill", d => {
            try {
                const cfg = (typeof config !== 'undefined' && config && config.types) ? config : (window.config && window.config.types ? window.config : null);
                return (cfg && cfg.types && cfg.types[d.type] && cfg.types[d.type].color) ? cfg.types[d.type].color : color(d.type);
            } catch(e){ return color(d.type); }
        })
        .attr('stroke', d => {
            // typeごとに縁取り色を指定
            if (d.type === 'team') return '#006064';      // team: 濃い色
            if (d.type === 'group') return '#4527A0';     // group: 濃い色
            if (d.type === 'project') return '#0D47A1';   // project: 濃い色
            if (config[d.type] && config[d.type].color) {
                return config[d.type].color;
            }
            return '#333';
        })
        .attr('stroke-width', 2);

    // label: users on right with smaller font, others centered
    nodeEnter.each(function(d) {
        if (d.type === "service") {
            d3.select(this).append("text")
                .text(d => d.name)
                .attr("text-anchor", "middle")
                .attr("dy", ".35em")
                .attr("font-size", "10px")
                .attr("font-family", "Arial, sans-serif")
                .attr("fill", "black");
        } else if (d.type === "user") {
            const r = 8;
            d3.select(this).append("text")
                .text(d => {
                    const s = String(d.name || '');
                    return s.length > 32 ? s.slice(0, 30) + '…' : s;
                })
                .attr("text-anchor", "start")
                .attr("dx", r + 8)
                .attr("dy", ".35em")
                .attr("font-size", "9px")
                .attr("font-family", "Arial, sans-serif")
                .attr("fill", "black");
        } else {
            // group, team, domain, project などはすべて同じデザイン
            d3.select(this).append("text")
                .text(d => d.name)
                .attr("text-anchor", "middle")
                .attr("dy", ".35em")
                .attr("font-size", "10px")
                .attr("font-family", "Arial, sans-serif")
                .attr("fill", "black");
        }
    });

    nodeEnter.append("title").text(d => d.name);

    nodeSelection = nodeEnter.merge(nodeSelection);

    // ステータスアニメーションを同期して開始
    const blinkingNodes = visibleNodes.filter(n => n.status === 'error' || n.status === 'warning');
    if (blinkingNodes.length) {
        setTimeout(() => {
            startStatusBlinking(blinkingNodes);
        }, 100);
    }

    // tick handler を設定（毎回同じ simulation を使う）
    simulation.on("tick", () => {
        // Build a quick lookup for node positions by id so we don't depend on DOM query timing
        const nodeByIdTick = new Map((simulation.nodes() || []).map(n => [n.id, n]));

        linkSelection
            .attr("x1", d => {
            const sx = (typeof d.source === 'object') ? d.source.x : (nodeByIdTick.get(d.source) || { x: 0 }).x;
            return sx;
            })
            .attr("y1", d => {
            const sy = (typeof d.source === 'object') ? d.source.y : (nodeByIdTick.get(d.source) || { y: 0 }).y;
            return sy;
            })
            .attr("x2", d => {
            const tx = (typeof d.target === 'object') ? d.target.x : (nodeByIdTick.get(d.target) || { x: 0 }).x;
            return tx;
            })
            .attr("y2", d => {
            const ty = (typeof d.target === 'object') ? d.target.y : (nodeByIdTick.get(d.target) || { y: 0 }).y;
            return ty;
            });

        nodeSelection
            .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // restart simulation gently
    simulation.alpha(1).restart();
}

// チェックボックス（ツールチップ）を作る関数
function createTypeTooltip(config) {
    // 順番を指定
    const order = ['project', 'domain', 'group', 'service', 'team', 'user'];
    const types = order.filter(t => (config && config.types && config.types[t]))
        .concat(Object.keys(config.types || {}).filter(t => !order.includes(t)));
    const el = document.getElementById('network-type-tooltip');
    el.innerHTML = '<strong style="display:block;margin-bottom:6px;">Filter types</strong>';
    types.forEach(t => {
        const id = `filter-${t}`;
        const wrapper = document.createElement('label');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '8px';
        wrapper.style.marginBottom = '4px';
        wrapper.style.cursor = 'pointer';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = id;
        cb.checked = visibleTypes.has(t);
        cb.dataset.group = t;
        cb.className = 'filter-checkbox';
        cb.addEventListener('change', (ev) => {
            if (ev.target.checked) visibleTypes.add(t);
            else visibleTypes.delete(t);
            updateGraph();
        });

        const span = document.createElement('span');
        span.textContent = typeLabel(t);

        wrapper.appendChild(cb);
        wrapper.appendChild(span);
        el.appendChild(wrapper);
    });

    // 表示トグルボタンをツールバー風に作る（右上に小さいボタン）
    let toggleBtn = document.getElementById('network-type-toggle');
    if (!toggleBtn) {
        toggleBtn = document.createElement('button');
        toggleBtn.id = 'network-type-toggle';
        toggleBtn.textContent = 'Types';
        toggleBtn.title = 'Toggle type filters';
        toggleBtn.style.position = 'fixed';
        toggleBtn.style.top = '80px';
        toggleBtn.style.right = '12px';
        toggleBtn.style.zIndex = 10000;
        toggleBtn.style.padding = '6px 8px';
        toggleBtn.style.fontSize = '13px';
        toggleBtn.style.borderRadius = '6px';
        toggleBtn.style.border = '1px solid rgba(0,0,0,0.08)';
        toggleBtn.style.background = 'white';
        toggleBtn.addEventListener('click', () => {
            el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
        });
        document.body.appendChild(toggleBtn);
    }
    // 最初は表示する
    el.style.display = 'block';
}

// type のラベル表示改善
function typeLabel(t) {
    const labels = {
        project: 'Projects',
        domain: 'Domains',
        group: 'Groups',
        team: 'Teams',
        service: 'Services',
        user: 'Users',
    };
    return labels[t] || t;
}

// drag ハンドラ
function dragstarted(event) {
    if (!simulation) return;
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
}

function dragged(event) {
    if (!event.subject) return;
    event.subject.fx = event.x;
    event.subject.fy = event.y;

    // ハイライト当たり判定
    linkSelection
        .attr("stroke", d => {
            const sid = (typeof d.source === 'object') ? d.source.id : d.source;
            const tid = (typeof d.target === 'object') ? d.target.id : d.target;
            return (sid === event.subject.id || tid === event.subject.id) ? "red" : "#999";
        })
        .attr("stroke-width", d => {
            const sid = (typeof d.source === 'object') ? d.source.id : d.source;
            const tid = (typeof d.target === 'object') ? d.target.id : d.target;
            return (sid === event.subject.id || tid === event.subject.id) ? 3 : 1.5;
        });
}

function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    if (event.subject) {
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    linkSelection
        .attr("stroke", "#999")
        .attr("stroke-width", 1.5);
}

document.addEventListener('keydown', function(e) {
    if (!simulation) return;
    // Link distance 操作（ArrowUp / ArrowDown）
    if (e.key === "ArrowUp") {
        linkDistance += 10;
        simulation.force("link").distance(linkDistance);
        simulation.alpha(1).restart();
    } else if (e.key === "ArrowDown") {
        linkDistance = Math.max(10, linkDistance - 10);
        simulation.force("link").distance(linkDistance);
        simulation.alpha(1).restart();
    }
});

// ページアンロード時にアニメーションをクリーンアップ
window.addEventListener('beforeunload', () => {
    stopStatusBlinking();
});

// ステータスフィルタ用ツールチップを作成
function createStatusTooltip() {
    const statuses = ['pass', 'warning', 'error'];
    let el = document.getElementById('network-status-tooltip');
    if (!el) {
        // ツールチップ要素がなければ新規作成
        el = document.createElement('div');
        el.id = 'network-status-tooltip';
        el.className = 'type-checkbox-container';
        el.style.position = 'fixed';
        el.style.top = '300px';
        el.style.right = '12px';
        el.style.padding = '8px';
        el.style.background = 'rgba(255,255,255,0.95)';
        el.style.border = '1px solid rgba(0,0,0,0.08)';
        el.style.borderRadius = '6px';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        el.style.zIndex = 9999;
        el.style.fontSize = '13px';
        el.style.display = 'none'; // 最初は非表示
        document.body.appendChild(el);
    }
    // ツールチップ内容をセット
    el.innerHTML = '<strong style="display:block;margin-bottom:6px;">Filter status</strong>';
    statuses.forEach(st => {
        const wrapper = document.createElement('label');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '8px';
        wrapper.style.marginBottom = '4px';
        wrapper.style.cursor = 'pointer';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = 'status-' + st;
        cb.checked = true;
        cb.dataset.status = st;
        cb.className = 'status-filter-checkbox';
        cb.addEventListener('change', () => {
            updateStatusFilter();
        });

        const span = document.createElement('span');
        span.textContent = st.charAt(0).toUpperCase() + st.slice(1);

        wrapper.appendChild(cb);
        wrapper.appendChild(span);
        el.appendChild(wrapper);
    });

    // トグルボタンを追加
    let toggleBtn = document.getElementById('network-status-toggle');
    if (!toggleBtn) {
        toggleBtn = document.createElement('button');
        toggleBtn.id = 'network-status-toggle';
        toggleBtn.textContent = 'Status';
        toggleBtn.title = 'Toggle status filters';
        toggleBtn.style.position = 'fixed';
        toggleBtn.style.top = '300px';
        toggleBtn.style.right = '12px';
        toggleBtn.style.zIndex = 10000;
        toggleBtn.style.padding = '6px 8px';
        toggleBtn.style.fontSize = '13px';
        toggleBtn.style.borderRadius = '6px';
        toggleBtn.style.border = '1px solid rgba(0,0,0,0.08)';
        toggleBtn.style.background = 'white';
        toggleBtn.addEventListener('click', () => {
            el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
        });
        document.body.appendChild(toggleBtn);
    }
    // 最初は表示する
    el.style.display = 'block';
}

// 現在のフィルタ状態を取得
function getStatusFilterSet() {
    const checked = Array.from(document.querySelectorAll('.status-filter-checkbox'))
        .filter(cb => cb.checked)
        .map(cb => cb.dataset.status);
    return new Set(checked);
}

// グラフやテーブルのフィルタを更新
function updateStatusFilter() {
    const filterSet = getStatusFilterSet();
    // グラフの場合
    if (typeof updateGraph === 'function') {
        window.visibleStatusSet = filterSet; // グローバルで保持
        updateGraph();
    }
    // DataTableの場合
    if (window.updateDataTable) {
        window.visibleStatusSet = filterSet;
        window.updateDataTable();
    }
}

// updateGraph内でstatusフィルタを反映
// 例: visibleNodes = allNodes.filter(n => visibleTypes.has(n.type) && visibleStatusSet.has(n.status));

// 初期化時に呼び出し
createStatusTooltip();
window.visibleStatusSet = new Set(['pass', 'warning', 'error']);
