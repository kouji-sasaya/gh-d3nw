// ES module wrapper for the existing 3d-force-graph logic.
// Export an async `init` function that mounts the graph into #canvas or body.

export async function init() {
  const DATA_URL = 'data.json'; // docs フォルダ内に置かれている想定

  function createLoaderOverlay() {
    if (document.getElementById('d3fg-loading-overlay')) return;
    const style = document.createElement('style');
    style.textContent = `
      #d3fg-loading-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(6,8,12,0.6);backdrop-filter:blur(4px);z-index:9999}
      #d3fg-loading-card{padding:14px 18px;border-radius:10px;color:#eaf2ff;background:linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:Inter,system-ui,'Hiragino Kaku Gothic ProN','メイリオ',sans-serif}
      .d3fg-spinner{width:40px;height:40px;border-radius:50%;border:4px solid rgba(255,255,255,0.08);border-top-color:rgba(160,190,255,0.95);animation:d3fg-spin 1s linear infinite;margin:0 auto}
      @keyframes d3fg-spin{to{transform:rotate(360deg)}}
      #d3fg-loading-text{margin-top:10px;text-align:center;font-size:14px;opacity:0.95}
    `;
    document.head.appendChild(style);
    const overlay = document.createElement('div');
    overlay.id = 'd3fg-loading-overlay';
    overlay.innerHTML = `
      <div id="d3fg-loading-card">
        <div class="d3fg-spinner" aria-hidden="true"></div>
        <div id="d3fg-loading-text">3Dネットワークグラフを構築しています…</div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  function showLoader(){ const o = document.getElementById('d3fg-loading-overlay'); if(o) o.style.display='flex'; }
  function hideLoader(){ const o = document.getElementById('d3fg-loading-overlay'); if(o) o.style.display='none'; }

  function loadScript(src){
    return new Promise((resolve, reject)=>{
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = () => resolve();
      s.onerror = (e) => reject(new Error('Failed to load '+src));
      document.head.appendChild(s);
    });
  }

  createLoaderOverlay();
  showLoader();

  // fetch data
  let raw = null;
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error('Failed to fetch data.json: ' + res.status);
    raw = await res.json();
  } catch (err) {
    console.error(err);
    const el = document.createElement('div'); el.textContent = 'データ読み込みに失敗しました'; el.style.color='red'; document.body.appendChild(el);
    hideLoader();
    return;
  }

  // load config.json if available
  let cfg = null;
  try { const cres = await fetch('config.json'); if (cres.ok) cfg = await cres.json(); } catch(e){ console.warn('config.json read failed', e); }

  const idMap = new Map();
  const nodesRaw = raw.map((d) => {
    const node = { id: d.id, name: d.name || d.id, type: d.type || 'node', status: d.status || '', address: d.address || '' };
    // apply type-level config if available
    const tcfg = cfg && cfg.config && cfg.config.types && cfg.config.types[node.type];
    if (tcfg) {
      node._size = tcfg.size;
      node._color = tcfg.color;
    } else {
      node._size = 50;
      node._color = '#aaaaaa';
    }
    // allow per-node overrides from data.json (d.size / d.color)
    if (d.size !== undefined && d.size !== null) node._size = d.size;
    if (d.color) node._color = d.color;
    idMap.set(d.id, node);
    return node;
  });
  const linksRaw = [];
  for (const d of raw) {
    if (Array.isArray(d.links)) {
      for (const tgt of d.links) {
        if (idMap.has(d.id) && idMap.has(tgt)) linksRaw.push({ source: d.id, target: tgt });
      }
    }
  }

  const typeOrder = ['project', 'domain', 'service', 'user'];
  const allTypes = typeOrder.filter(t => nodesRaw.some(n => n.type === t));
  const statusOrder = ['pass', 'warning', 'error'];
  const allStatus = statusOrder.filter(s => nodesRaw.some(n => n.status === s));

  function loadFilterState(key, all) {
    try { const v = localStorage.getItem(key); if (!v) return new Set(all); const arr = JSON.parse(v); if (!Array.isArray(arr) || arr.length===0) return new Set(all); return new Set(arr); } catch(e){ return new Set(all); }
  }
  function saveFilterState(key, set) { try { localStorage.setItem(key, JSON.stringify(Array.from(set))); } catch(e){} }
  let enabledTypes = loadFilterState('d3fg_enabled_types', allTypes);
  let enabledStatus = loadFilterState('d3fg_enabled_status', allStatus);

  function filterNodesAndLinks() {
    const nodes = nodesRaw.filter(n => { if (!enabledTypes.has(n.type)) return false; return true; });
    const nodeIds = new Set(nodes.map(n=>n.id));
    const links = linksRaw.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));
    console.log('filterNodesAndLinks:', { enabledTypes: Array.from(enabledTypes), enabledStatus: Array.from(enabledStatus), nodes: nodes.map(n=>n.id), links: links.map(l=>[l.source,l.target]) });
    return { nodes, links };
  }

  // create container
  let canvasEl = document.getElementById('canvas'); if (!canvasEl) canvasEl = document.body; canvasEl.innerHTML='';
  const container = document.createElement('div'); container.id='3d-force-graph-container'; container.style.width='100%'; container.style.height='100%'; container.style.position='relative'; canvasEl.appendChild(container);

  // ensure three and ForceGraph3D available
  try {
    if (typeof THREE === 'undefined') {
      await loadScript('https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.min.js');
    }
    if (typeof ForceGraph3D === 'undefined' && typeof window.ForceGraph3D === 'undefined') {
      await loadScript('https://unpkg.com/3d-force-graph/dist/3d-force-graph.min.js');
    }
  } catch (err) { console.error('library load failed', err); hideLoader(); return; }

  const Graph = (typeof ForceGraph3D !== 'undefined') ? ForceGraph3D : window.ForceGraph3D;
  if (!Graph) { console.error('ForceGraph3D not available'); hideLoader(); return; }
  let GraphInstance = null;
  function updateGraph(){
    const {nodes, links} = filterNodesAndLinks();
    if (!GraphInstance) {
      GraphInstance = Graph()(container)
        .graphData({ nodes, links })
        .nodeLabel(n => `${n.name} (${n.id})`)
        .nodeColor(n => n._color || '#aaaaaa')
        .nodeVal(n => n._size || 50)
        .linkDirectionalParticles(0)
        .backgroundColor('#07080a');
    } else {
      GraphInstance.graphData({nodes,links});
      // ensure color/size functions are set (in case config changed)
      GraphInstance.nodeColor(n => n._color || '#aaaaaa').nodeVal(n => n._size || 50);
    }
  }
  updateGraph();

  raw = null;
  // hide loader once first frame renders
  let firstFrame = true;
  requestAnimationFrame(function checkFrame(){ if (firstFrame) { hideLoader(); firstFrame = false; } });

  console.log('3d-force-graph: nodes=', nodesRaw.length, 'links=', linksRaw.length);
}

// default export for convenience
export default { init };
