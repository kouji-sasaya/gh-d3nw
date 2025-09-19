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
  
  // enhance labels: create sprites and higher-visibility labels with scaling controls
  function makeLabelSprite(text, color, fontSize = 64) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    // choose large base font for clarity; will be scaled down in world units
    ctx.font = `bold ${fontSize}px sans-serif`;
    const padding = Math.round(fontSize * 0.28);
    const metrics = ctx.measureText(text);
    const textWidth = Math.ceil(metrics.width);
    canvas.width = textWidth + padding * 2;
    canvas.height = fontSize + padding * 2;
    // redraw with proper sizing
    ctx.font = `bold ${fontSize}px sans-serif`;
    // background: slightly translucent dark to improve contrast
    ctx.fillStyle = 'rgba(8,10,16,0.72)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // text
    ctx.fillStyle = color || '#ffffff';
    ctx.textBaseline = 'top';
    ctx.fillText(text, padding, padding);
    const tex = new THREE.CanvasTexture(canvas);
    // ensure texture is updated from the canvas
    tex.needsUpdate = true;
    tex.minFilter = THREE.LinearFilter;
    // allow transparency and render on top
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    // initial scale in world units (will be adjusted by multiplier)
    sprite.scale.set(canvas.width / 30, canvas.height / 30, 1);
    sprite.renderOrder = 9999;
    // prevent automatic frustum culling which can hide small sprites at edges
    sprite.frustumCulled = false;
    // store base scale to allow hover to restore correctly
    sprite.userData = sprite.userData || {};
    sprite.userData.baseScale = sprite.scale.clone();
    return sprite;
  }

  function attachLabelsAndNodeObject() {
    if (!GraphInstance) return;
    // create Three object per node for consistent sizing and label sprites
    GraphInstance.nodeThreeObject(node => {
      const rawSize = node._size || 50;
      // derive visible sphere radius from configured size (tune constants for readability)
      const a = 1.1, b = 0.6;
      const baseSize = Math.max(0.9, a + b * Math.sqrt(rawSize));

      const geometry = new THREE.SphereGeometry(baseSize, 12, 12);
      const colorHex = node._color || '#ffffff';
      const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(colorHex), roughness: 0.6, metalness: 0.1 });
      const mesh = new THREE.Mesh(geometry, material);

      const group = new THREE.Group();
      group.add(mesh);

      // create label sprite with larger font for readability
      const label = makeLabelSprite(node.name || node.id, '#eef2ff', 64);
      // position label slightly above node
      label.position.set(0, baseSize + 0.9, 0);
      // scale label relative to node size so large nodes keep readable labels
      const scaleFactor = Math.max(0.8, baseSize / 2.6);
      label.scale.multiplyScalar(scaleFactor);
      group.add(label);

      // save for UI operations
      node.__labelSprite = label;
      node.__threeObj = group;

      return group;
    });

    // hover: enlarge label for readability
    let prevHover = null;
    GraphInstance.onNodeHover(node => {
      if (prevHover && prevHover.__labelSprite) {
        try {
          const s = prevHover.__labelSprite;
          if (s.userData && s.userData.baseScale) s.scale.copy(s.userData.baseScale);
          else s.scale.setScalar(1.0);
        } catch (e) {}
      }
      if (node && node.__labelSprite) {
        try {
          const s = node.__labelSprite;
          if (s.userData && s.userData.baseScale) s.scale.copy(s.userData.baseScale).multiplyScalar(1.8);
          else s.scale.multiplyScalar(1.8);
        } catch (e) {}
      }
      prevHover = node;
    });

    // apply initial label visibility and size multiplier UI (create controls)
    (function setupLabelUI() {
      const ui = document.createElement('div');
      ui.style.position = 'absolute';
      ui.style.left = '12px';
      ui.style.top = '12px';
      ui.style.zIndex = 10000;
      ui.style.background = 'rgba(12,14,20,0.6)';
      ui.style.color = '#eef2ff';
      ui.style.padding = '8px 10px';
      ui.style.borderRadius = '8px';
      ui.style.fontSize = '13px';
      ui.innerHTML = `
          <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <input type='checkbox' id='d3fg-label-toggle' checked /> ラベル表示
          </label>
        `;
      container.appendChild(ui);

      const chk = ui.querySelector('#d3fg-label-toggle');
      // helper to show/hide labels
      function applyLabelVisibility(visible) {
        try { GraphInstance.graphData().nodes.forEach(n => { if (n && n.__labelSprite) n.__labelSprite.visible = !!visible; }); } catch(e){}
      }

      // restore saved visibility
      const savedLabel = localStorage.getItem('d3fg_label_visible');
      if (savedLabel !== null) chk.checked = savedLabel === '1'; else chk.checked = true;

      applyLabelVisibility(chk.checked);

      chk.addEventListener('change', () => {
        localStorage.setItem('d3fg_label_visible', chk.checked ? '1' : '0');
        applyLabelVisibility(chk.checked);
      });

      // reapply label visibility after graphData() updates
      const origGraphData = GraphInstance.graphData;
      GraphInstance.graphData = function() {
        const res = origGraphData.apply(this, arguments);
        setTimeout(() => { applyLabelVisibility(chk.checked); }, 50);
        return res;
      };
    })();
    // Re-apply current graphData to ensure nodeThreeObject is invoked for existing nodes
    try {
      const cur = GraphInstance && GraphInstance.graphData && GraphInstance.graphData();
      if (cur) GraphInstance.graphData(cur);
    } catch (e) {}
  }

  updateGraph();

  // attach label sprites and node objects after graph instance is ready
  try { attachLabelsAndNodeObject(); } catch(e){ console.warn('attachLabelsAndNodeObject failed', e); }

  raw = null;
  // hide loader once first frame renders
  let firstFrame = true;
  requestAnimationFrame(function checkFrame(){ if (firstFrame) { hideLoader(); firstFrame = false; } });

  console.log('3d-force-graph: nodes=', nodesRaw.length, 'links=', linksRaw.length);
}

// default export for convenience
export default { init };
