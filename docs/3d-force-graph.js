// 3d-force-graph を使った 3D ネットワーク描画スクリプト
// 動作:
//  - 同ディレクトリの data.json を fetch
//  - オブジェクト配列 -> { nodes: [], links: [] } に変換
//  - three.js と 3d-force-graph を動的ロードして描画
//  - 変換後に元の配列を null にしてメモリを解放

(function() {
  const DATA_URL = 'data.json'; // docs フォルダ内に置かれている想定

  // 小さなローディングオーバーレイ
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

  // 動的スクリプトロードのヘルパー（順序ロード）
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

  async function init() {
    createLoaderOverlay();
    showLoader();

    // 1) data.json を取得してメモリ上に展開
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

    // 2) data.json の形式 -> 3d-force-graph の {nodes, links} へ変換
    // raw は [{id, name, type, links: [id,...], status,...}, ...]
    // まず config.json を読み込み、type ごとのサイズ・色を取得する
    let cfg = null;
    try {
      const cres = await fetch('config.json');
      if (cres.ok) cfg = await cres.json();
    } catch (e) {
      console.warn('config.json を読み込めませんでした。デフォルト設定を使用します。', e);
    }


    // --- types/status一覧を抽出 ---
    const idMap = new Map();
    const nodesRaw = raw.map((d, i) => {
      const node = {
        id: d.id,
        name: d.name || d.id,
        type: d.type || 'node',
        status: d.status || '',
        address: d.address || ''
      };
      const tcfg = cfg && cfg.config && cfg.config.types && cfg.config.types[node.type];
      if (tcfg) {
        node._size = tcfg.size;
        node._color = tcfg.color;
      } else {
        node._size = 50;
        node._color = '#aaaaaa';
      }
      idMap.set(d.id, node);
      return node;
    });
    const linksRaw = [];
    for (const d of raw) {
      if (Array.isArray(d.links)) {
        for (const tgt of d.links) {
          if (idMap.has(tgt)) linksRaw.push({ source: d.id, target: tgt });
        }
      }
    }
    // types/status一覧
  // Typesの順番を project, domain, service, user の順に固定
  const typeOrder = ['project', 'domain', 'service', 'user'];
  const allTypes = typeOrder.filter(t => nodesRaw.some(n => n.type === t));
  // Statusの順番を pass, warning, error の順に固定
  const statusOrder = ['pass', 'warning', 'error'];
  const allStatus = statusOrder.filter(s => nodesRaw.some(n => n.status === s));
    // --- localStorageからフィルタ状態を復元 ---
    function loadFilterState(key, all) {
      try {
        const v = localStorage.getItem(key);
        if (!v) return new Set(all);
        const arr = JSON.parse(v);
        return new Set(Array.isArray(arr) ? arr : all);
      } catch (e) { return new Set(all); }
    }
    function saveFilterState(key, set) {
      try { localStorage.setItem(key, JSON.stringify(Array.from(set))); } catch(e){}
    }
    let enabledTypes = loadFilterState('d3fg_enabled_types', allTypes);
    let enabledStatus = loadFilterState('d3fg_enabled_status', allStatus);
    // --- フィルタ適用関数 ---
    function filterNodesAndLinks() {
      // typeフィルタ: domain, project, service, user
      // statusフィルタ: userノードのみ
      const nodes = nodesRaw.filter(n => {
        if (!enabledTypes.has(n.type)) return false;
        if (n.type === 'user') {
          return enabledStatus.has(n.status);
        }
        return true; // domain, project, service
      });
      const nodeIds = new Set(nodes.map(n => n.id));
      const links = linksRaw.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));
      return { nodes, links };
    }
    // --- UI生成関数 ---
    function createFilterPanel() {
      const panel = document.createElement('div');
  panel.className = 'type-checkbox-container';
  // panelの枠線や背景色などを削除し、透明に
  panel.style.background = 'none';
  panel.style.boxShadow = 'none';
  panel.style.border = 'none';
  panel.style.padding = '0';
  panel.style.margin = '0';
  panel.style.color = '#eef2ff';
  panel.style.fontSize = '13px';
  panel.style.maxWidth = '180px';
      panel.innerHTML = `
        <div style="font-weight:bold;margin-bottom:4px;">Type</div>
        <div id="d3fg-type-list"></div>
        <div style="font-weight:bold;margin:8px 0 4px;">Status</div>
        <div id="d3fg-status-list"></div>
      `;
      // types
      const typeList = panel.querySelector('#d3fg-type-list');
      allTypes.forEach(type => {
        const id = 'd3fg-type-' + type;
        const label = document.createElement('label');
        label.style.display = 'block';
        label.style.marginBottom = '2px';
        label.innerHTML = `<input type="checkbox" id="${id}" value="${type}" ${enabledTypes.has(type)?'checked':''}> ${type}`;
        typeList.appendChild(label);
      });
      // status
      const statusList = panel.querySelector('#d3fg-status-list');
      allStatus.forEach(status => {
        const id = 'd3fg-status-' + status;
        const label = document.createElement('label');
        label.style.display = 'block';
        label.style.marginBottom = '2px';
        label.innerHTML = `<input type="checkbox" id="${id}" value="${status}" ${enabledStatus.has(status)?'checked':''}> ${status}`;
        statusList.appendChild(label);
      });
      return panel;
    }

    // 元データを参照解放
    raw = null;

    // 3) three.js と 3d-force-graph を動的ロード
    // three は CDN の安定版を使用
    try {
      // three を先に
      if (typeof THREE === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.min.js');
      }
      // 3d-force-graph の UMD ビルド
      if (typeof ForceGraph3D === 'undefined') {
        await loadScript('https://unpkg.com/3d-force-graph/dist/3d-force-graph.min.js');
      }
    } catch (err) {
      console.error('ライブラリ読み込み失敗', err);
      hideLoader();
      return;
    }

    // OrbitControls を動的に読み込む（three.js が必要）
    try {
      if (typeof THREE !== 'undefined' && typeof THREE.OrbitControls === 'undefined') {
        // three のモジュール版ではなく UMD の OrbitControls を直接追加するためのスクリプト
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.153.0/examples/js/controls/OrbitControls.js');
        // OrbitControls は THREE.OrbitControls として利用可能になる
      }
    } catch (err) {
      console.warn('OrbitControls の読み込みに失敗しました:', err);
    }

  // 4) コンテナ作成 — 既存の #canvas があればそこを使う
  let canvasEl = document.getElementById('canvas');
  if (!canvasEl) canvasEl = document.body;
  // canvas 内をクリアしてコンテナを差し込む
  canvasEl.innerHTML = '';
  const container = document.createElement('div');
  container.id = '3d-force-graph-container';
  container.style.width = '100%';
  // canvas の高さを踏襲
  container.style.height = '100%';
  container.style.position = 'relative';
  canvasEl.appendChild(container);

  // 5) グラフ初期化
    // ForceGraph3D は UMD で global に登録されている想定
    const Graph = (typeof ForceGraph3D !== 'undefined') ? ForceGraph3D : window.ForceGraph3D;
    if (!Graph) {
      console.error('ForceGraph3D not available'); hideLoader(); return;
    }
    let GraphInstance = null;
    function updateGraph() {
      const { nodes, links } = filterNodesAndLinks();
      if (!GraphInstance) {
        GraphInstance = Graph()(container)
          .graphData({ nodes, links })
          .nodeLabel(node => `${node.name} (${node.id})`)
          .linkDirectionalParticles(0)
          .backgroundColor('#07080a')
          .onNodeClick(node => {
            const distance = 40;
            const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
            const newPos = (node.x || node.y || node.z)
              ? { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio }
              : { x: 0, y: 0, z: distance };
            GraphInstance.cameraPosition(newPos, node, 3000);
          });
      } else {
        GraphInstance.graphData({ nodes, links });
      }
    }
    updateGraph();
    // --- フィルタパネルをUI下部に追加 ---
    setTimeout(() => {
      const ui = container.querySelector('div'); // 既存UI
      // 右パネルのみ作成
      const filterPanelR = createFilterPanel();
      filterPanelR.id = 'd3fg-filter-panel-right';
      filterPanelR.style.position = 'absolute';
      filterPanelR.style.right = '12px';
      filterPanelR.style.left = 'auto';
      filterPanelR.style.top = '12px'; // ラベルパネルと同じ高さ
      filterPanelR.style.pointerEvents = 'auto';
      // UIの下に追加（ラベルパネルと同時表示）
      if (ui && ui.parentNode) {
        ui.parentNode.insertBefore(filterPanelR, ui.nextSibling);
      } else {
        container.appendChild(filterPanelR);
      }

      // チェックボックス同期用ヘルパー
      // syncPanelsは不要（片方のみ）
      function syncPanels() {}

      // types/status チェックボックスイベント（右パネルのみ）
      allTypes.forEach(type => {
        const cbR = filterPanelR.querySelector(`#d3fg-type-${type}`);
        if (cbR) {
          cbR.addEventListener('change', () => {
            if (cbR.checked) enabledTypes.add(type); else enabledTypes.delete(type);
            saveFilterState('d3fg_enabled_types', enabledTypes);
            updateGraph();
          });
        }
      });
      allStatus.forEach(status => {
        const cbR = filterPanelR.querySelector(`#d3fg-status-${status}`);
        if (cbR) {
          cbR.addEventListener('change', () => {
            if (cbR.checked) enabledStatus.add(status); else enabledStatus.delete(status);
            saveFilterState('d3fg_enabled_status', enabledStatus);
            updateGraph();
          });
        }
      });
    }, 100);

    // --- UI: ラベル表示切替とノードサイズ倍率 ---
    (function setupUI() {
      const ui = document.createElement('div');
  ui.style.position = 'absolute';
  ui.style.left = '12px';
  ui.style.right = 'auto';
  ui.style.top = '12px';
  ui.style.zIndex = 10000;
  ui.style.background = 'rgba(12,14,20,0.6)';
  ui.style.color = '#eef2ff';
  ui.style.padding = '10px 12px';
  ui.style.borderRadius = '10px';
  ui.style.fontFamily = 'Inter, system-ui, -apple-system, "Hiragino Kaku Gothic ProN", "メイリオ", sans-serif';
  ui.style.fontSize = '13px';
  ui.style.alignItems = 'start';

      ui.innerHTML = `
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <input type='checkbox' id='d3fg-label-toggle' /> ラベル表示
        </label>
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <input type='checkbox' id='d3fg-bloom-toggle' /> Bloom (グロー) を有効
        </label>
  <div id='d3fg-bloom-controls' style='margin-bottom:8px;display:none'>
          <label style="display:block">強さ: <span id='d3fg-bloom-strength-val'>2.40</span>
            <input type='range' id='d3fg-bloom-strength' min='0' max='4' step='0.05' value='2.4' style='width:160px'>
          </label>
          <label style="display:block">半径: <span id='d3fg-bloom-radius-val'>0.90</span>
            <input type='range' id='d3fg-bloom-radius' min='0' max='2.0' step='0.01' value='0.9' style='width:160px'>
          </label>
          <label style="display:block">閾値: <span id='d3fg-bloom-threshold-val'>0.05</span>
            <input type='range' id='d3fg-bloom-threshold' min='0' max='1' step='0.01' value='0.05' style='width:160px'>
          </label>
        </div>
        <label style="display:block">ノードサイズ倍率: <span id='d3fg-size-val'>0.40</span>
          <input type='range' id='d3fg-size-range' min='0.4' max='2.5' step='0.05' value='0.40' style='width:160px'>
        </label>
        <hr style='border:none;border-top:1px solid rgba(255,255,255,0.06);margin:8px 0'>
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <input type='checkbox' id='d3fg-lod-toggle' /> ラベルLODを有効
        </label>
        <label style="display:block">LOD距離閾値: <span id='d3fg-lod-val'>120</span>
          <input type='range' id='d3fg-lod-range' min='20' max='800' step='5' value='120' style='width:160px'>
        </label>
        <label style="display:block;margin-top:6px">LOD更新間隔(ms): <span id='d3fg-lod-interval-val'>200</span>
          <input type='range' id='d3fg-lod-interval' min='50' max='1000' step='25' value='200' style='width:160px'>
        </label>
        <hr style='border:none;border-top:1px solid rgba(255,255,255,0.06);margin:8px 0'>
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <input type='checkbox' id='d3fg-auto-orbit' /> 自動回転 (左→右)
        </label>
        <label style="display:block">回転スピード: <span id='d3fg-auto-orbit-speed-val'>0.25</span>
          <input type='range' id='d3fg-auto-orbit-speed' min='0' max='3' step='0.05' value='0.25' style='width:160px'>
        </label>
      `;
      container.appendChild(ui);

      const chk = ui.querySelector('#d3fg-label-toggle');
  const bloomChk = ui.querySelector('#d3fg-bloom-toggle');
  const bloomControls = ui.querySelector('#d3fg-bloom-controls');
  const bloomStrength = ui.querySelector('#d3fg-bloom-strength');
  const bloomRadius = ui.querySelector('#d3fg-bloom-radius');
  const bloomThreshold = ui.querySelector('#d3fg-bloom-threshold');
  const bloomStrengthVal = ui.querySelector('#d3fg-bloom-strength-val');
  const bloomRadiusVal = ui.querySelector('#d3fg-bloom-radius-val');
  const bloomThresholdVal = ui.querySelector('#d3fg-bloom-threshold-val');
      const range = ui.querySelector('#d3fg-size-range');
      const val = ui.querySelector('#d3fg-size-val');
      const lodToggle = ui.querySelector('#d3fg-lod-toggle');
      const lodRange = ui.querySelector('#d3fg-lod-range');
      const lodVal = ui.querySelector('#d3fg-lod-val');
      const lodIntervalEl = ui.querySelector('#d3fg-lod-interval');
      const lodIntervalVal = ui.querySelector('#d3fg-lod-interval-val');
  const autoOrbitChk = ui.querySelector('#d3fg-auto-orbit');
  const autoOrbitSpeed = ui.querySelector('#d3fg-auto-orbit-speed');
  const autoOrbitSpeedVal = ui.querySelector('#d3fg-auto-orbit-speed-val');

      // 設定を localStorage から復元
      const savedLabel = localStorage.getItem('d3fg_label_visible');
      const savedScale = localStorage.getItem('d3fg_size_multiplier');
      const savedLODEn = localStorage.getItem('d3fg_lod_enabled');
      const savedLODDist = localStorage.getItem('d3fg_lod_distance');
      const savedLODInterval = localStorage.getItem('d3fg_lod_interval');
  const savedAutoOrbit = localStorage.getItem('d3fg_auto_orbit');
  const savedAutoOrbitSpeed = localStorage.getItem('d3fg_auto_orbit_speed');

      if (savedLabel !== null) chk.checked = savedLabel === '1'; else chk.checked = true;
  if (savedScale !== null) { range.value = savedScale; val.textContent = parseFloat(savedScale).toFixed(2); } else { range.value = '0.40'; val.textContent = '0.40'; }
      if (savedLODEn !== null) lodToggle.checked = savedLODEn === '1'; else lodToggle.checked = true;
      if (savedLODDist !== null) { lodRange.value = savedLODDist; lodVal.textContent = parseFloat(savedLODDist).toFixed(0); }
      if (savedLODInterval !== null) { lodIntervalEl.value = savedLODInterval; lodIntervalVal.textContent = parseInt(savedLODInterval,10); }
  if (savedAutoOrbit !== null) autoOrbitChk.checked = savedAutoOrbit === '1'; else autoOrbitChk.checked = false;
  if (savedAutoOrbitSpeed !== null) { autoOrbitSpeed.value = savedAutoOrbitSpeed; autoOrbitSpeedVal.textContent = parseFloat(savedAutoOrbitSpeed).toFixed(2); }
  // bloom 設定を復元
  const savedBloom = localStorage.getItem('d3fg_bloom_enabled');
  const savedBloomStrength = localStorage.getItem('d3fg_bloom_strength');
  const savedBloomRadius = localStorage.getItem('d3fg_bloom_radius');
  const savedBloomThreshold = localStorage.getItem('d3fg_bloom_threshold');
  if (savedBloom !== null) bloomChk.checked = savedBloom === '1'; else bloomChk.checked = false;
  if (savedBloomStrength !== null) { bloomStrength.value = savedBloomStrength; bloomStrengthVal.textContent = parseFloat(savedBloomStrength).toFixed(2); }
  if (savedBloomRadius !== null) { bloomRadius.value = savedBloomRadius; bloomRadiusVal.textContent = parseFloat(savedBloomRadius).toFixed(2); }
  if (savedBloomThreshold !== null) { bloomThreshold.value = savedBloomThreshold; bloomThresholdVal.textContent = parseFloat(savedBloomThreshold).toFixed(2); }

      function applyLabelVisibility(visible) {
        // nodes 配列に保存された __labelSprite を探して表示/非表示
        try {
          GraphInstance.graphData().nodes.forEach(n => {
            if (n && n.__labelSprite) n.__labelSprite.visible = !!visible;
          });
        } catch (e){}
      }

      function applySizeMultiplier(mult) {
        // 各ノードの three オブジェクトを見つけて scale を掛ける
        try {
          GraphInstance.graphData().nodes.forEach(n => {
            const g = n && n.__threeObj;
            if (!g) return;
            // meshは group.children[0]
            const mesh = g.children && g.children[0];
            if (mesh && mesh.scale) mesh.scale.setScalar(mult);
            // ラベルは group.children[1]
            const label = n.__labelSprite;
            if (label && label.scale) label.scale.setScalar(mult);
          });
        } catch (e){}
      }

      // 初期適用
      applyLabelVisibility(chk.checked);
      applySizeMultiplier(parseFloat(range.value));

      // LOD 適用関数
      function updateLabelsLOD() {
        try {
          const lodEnabled = !!lodToggle.checked;
          const threshold = parseFloat(lodRange.value) || 120;
          const cam = GraphInstance.camera();
          if (!cam) return;
          const nodesList = GraphInstance.graphData().nodes || [];
          for (let i = 0; i < nodesList.length; i++) {
            const n = nodesList[i];
            const label = n && n.__labelSprite;
            if (!label) continue;
            // get node world position: prefer threeObj group position if available
            let nx = 0, ny = 0, nz = 0;
            const g = n.__threeObj;
            if (g && g.position) {
              nx = g.position.x; ny = g.position.y; nz = g.position.z;
            } else if (typeof n.x !== 'undefined') {
              nx = n.x; ny = n.y; nz = n.z;
            }
            const dx = cam.position.x - nx;
            const dy = cam.position.y - ny;
            const dz = cam.position.z - nz;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            // visible only when label toggle is on AND (LOD disabled OR within threshold)
            label.visible = chk.checked && (!lodEnabled || dist <= threshold);
          }
        } catch (e) {}
      }

      // LOD UI イベント
      lodToggle.addEventListener('change', () => {
        localStorage.setItem('d3fg_lod_enabled', lodToggle.checked ? '1' : '0');
        // 即座に反映
        updateLabelsLOD();
      });
      lodRange.addEventListener('input', () => {
        lodVal.textContent = parseFloat(lodRange.value).toFixed(0);
        localStorage.setItem('d3fg_lod_distance', lodRange.value);
        updateLabelsLOD();
      });

      // per-frame loop to update LOD (throttled by interval)
      let lastLODUpdate = 0;
      function lodLoop(now) {
        try {
          const interval = parseInt(lodIntervalEl.value, 10) || 200;
          if (!lastLODUpdate || (performance.now() - lastLODUpdate) >= interval) {
            updateLabelsLOD();
            lastLODUpdate = performance.now();
          }
        } catch (e) {}
        requestAnimationFrame(lodLoop);
      }
      requestAnimationFrame(lodLoop);

      // LOD interval UI
      lodIntervalEl.addEventListener('input', () => {
        const v = parseInt(lodIntervalEl.value, 10);
        lodIntervalVal.textContent = v;
        localStorage.setItem('d3fg_lod_interval', String(v));
      });

      // Auto-orbit UI handlers
      autoOrbitChk.addEventListener('change', () => {
        localStorage.setItem('d3fg_auto_orbit', autoOrbitChk.checked ? '1' : '0');
        // if controls already exist, toggle immediately
        try { if (GraphInstance.__orbitControls) GraphInstance.__orbitControls.autoRotate = autoOrbitChk.checked; } catch(e){}
      });
      autoOrbitSpeed.addEventListener('input', () => {
        const v = parseFloat(autoOrbitSpeed.value);
        autoOrbitSpeedVal.textContent = v.toFixed(2);
        localStorage.setItem('d3fg_auto_orbit_speed', String(v));
        try { if (GraphInstance.__orbitControls) GraphInstance.__orbitControls.autoRotateSpeed = v; } catch(e){}
      });

      // --- Bloom UI イベント ---
      bloomChk.addEventListener('change', async () => {
        localStorage.setItem('d3fg_bloom_enabled', bloomChk.checked ? '1' : '0');
        bloomControls.style.display = bloomChk.checked ? 'block' : 'none';
        // If enabling bloom and composer not yet prepared, try to load postprocessing scripts and create composer
        if (bloomChk.checked && typeof THREE !== 'undefined') {
          await tryPrepareBloom();
        }
      });

      bloomStrength.addEventListener('input', () => {
        const v = parseFloat(bloomStrength.value);
        bloomStrengthVal.textContent = v.toFixed(2);
        localStorage.setItem('d3fg_bloom_strength', String(v));
        if (bloomPass) bloomPass.strength = v;
      });
      bloomRadius.addEventListener('input', () => {
        const v = parseFloat(bloomRadius.value);
        bloomRadiusVal.textContent = v.toFixed(2);
        localStorage.setItem('d3fg_bloom_radius', String(v));
        if (bloomPass) bloomPass.radius = v;
      });
      bloomThreshold.addEventListener('input', () => {
        const v = parseFloat(bloomThreshold.value);
        bloomThresholdVal.textContent = v.toFixed(2);
        localStorage.setItem('d3fg_bloom_threshold', String(v));
        if (bloomPass) bloomPass.threshold = v;
        if (highPass && highPass.uniforms && highPass.uniforms['luminosityThreshold']) {
          try { highPass.uniforms['luminosityThreshold'].value = v; } catch(e){}
        }
      });

      // 初期表示切替
      bloomControls.style.display = bloomChk.checked ? 'block' : 'none';

      chk.addEventListener('change', () => {
        localStorage.setItem('d3fg_label_visible', chk.checked ? '1' : '0');
        applyLabelVisibility(chk.checked);
      });

      range.addEventListener('input', () => {
        const m = parseFloat(range.value);
        val.textContent = m.toFixed(2);
        localStorage.setItem('d3fg_size_multiplier', range.value);
        applySizeMultiplier(m);
      });

      // 新規ノードが追加される可能性があるので、GraphInstance の graphData 更新時にも適用
      const origGraphData = GraphInstance.graphData;
      GraphInstance.graphData = function(data) {
        const res = origGraphData.apply(this, arguments);
        // 少し遅延して UI 値を再適用
        setTimeout(() => {
          applyLabelVisibility(chk.checked);
          applySizeMultiplier(parseFloat(range.value));
        }, 50);
        return res;
      };
    })();

    // node オブジェクトをカスタムで小さな球にする（見た目の安定のため）
    try {
      const spriteTexture = null; // placeholder if needed
      // helper: create a sprite with text drawn on canvas
      function makeLabelSprite(text, color) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const fontSize = 48;
        ctx.font = `bold ${fontSize}px sans-serif`;
        const padding = 12;
        const metrics = ctx.measureText(text);
        const textWidth = Math.ceil(metrics.width);
        canvas.width = textWidth + padding * 2;
        canvas.height = fontSize + padding * 2;
        // redraw with proper size
        ctx.font = `bold ${fontSize}px sans-serif`;
        // background (slightly translucent)
        ctx.fillStyle = 'rgba(8,10,16,0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // text
        ctx.fillStyle = color || '#ffffff';
        ctx.textBaseline = 'top';
        ctx.fillText(text, padding, padding);
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        // scale down to reasonable world units; will be adjusted per-node
        sprite.scale.set(canvas.width / 20, canvas.height / 20, 1);
        sprite.renderOrder = 9999;
        return sprite;
      }

      GraphInstance.nodeThreeObject(node => {
        // config.json の size を視認性の良い半径にスケーリングして使用
        const rawSize = node._size || 50;
        const a = 1.2;
        const b = 0.55;
        const baseSize = Math.max(0.9, a + b * Math.sqrt(rawSize));

  const geometry = new THREE.SphereGeometry(baseSize, 12, 12);
        const colorHex = node._color || '#ffffff';
        const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(colorHex), roughness: 0.6, metalness: 0.1 });
        const mesh = new THREE.Mesh(geometry, material);
        // status による色付けと発光設定
        if (node.status === 'error') {
          // error: use Google's brand red for color and emissive
          const errColor = new THREE.Color(0xEA4335); // Google red
          mesh.material.color = errColor;
          mesh.material.emissive = errColor;
          try { if (typeof mesh.material.emissiveIntensity !== 'undefined') mesh.material.emissiveIntensity = 6.0; } catch(e){}
          try { mesh.material.needsUpdate = true; } catch(e){}
        } else if (node.status === 'warning') {
          // warning: use Google's brand yellow for color and emissive
          const warnColor = new THREE.Color(0xFBBC05); // Google yellow
          mesh.material.color = warnColor;
          mesh.material.emissive = warnColor;
          try { if (typeof mesh.material.emissiveIntensity !== 'undefined') mesh.material.emissiveIntensity = 1.0; } catch(e){}
          try { mesh.material.needsUpdate = true; } catch(e){}
        }

        // Group に mesh とラベル sprite をまとめる
        const group = new THREE.Group();
        group.add(mesh);

  // ラベルは常時表示（スプライト）
        const label = makeLabelSprite(node.name || node.id, '#eef2ff');
        // position label slightly above the node
        label.position.set(0, baseSize + 0.8, 0);
        // scale label relative to node size for可読性
        const scaleFactor = Math.max(0.7, baseSize / 2.5);
        label.scale.multiplyScalar(scaleFactor);
        group.add(label);

        // --- Additive glow sprite to emphasize halo (only for bloom-target statuses)
        function makeGlowSprite(col, scaleFactor) {
          try {
            const size = 256; // larger canvas for smoother gradient
            const canvas = document.createElement('canvas');
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d');
            // convert THREE.Color to rgba components
            const c = (col && col.isColor) ? col : new THREE.Color(col);
            const r = Math.floor(c.r * 255), g = Math.floor(c.g * 255), b = Math.floor(c.b * 255);
            const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
            // remove white core so center color shows through cleanly;
            // start with stronger color at center for a solid look, then softer falloff
            grad.addColorStop(0.0, `rgba(${r},${g},${b},0.92)`);
            grad.addColorStop(0.18, `rgba(${r},${g},${b},0.85)`);
            grad.addColorStop(0.45, `rgba(${r},${g},${b},0.45)`);
            grad.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
            ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
            const tex = new THREE.CanvasTexture(canvas);
            tex.minFilter = THREE.LinearFilter;
            // set overall glow opacity so the center appears saturated but halo remains soft
            const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthTest: false, transparent: true, opacity: 0.85 });
            const spr = new THREE.Sprite(mat);
            const s = Math.max(1, scaleFactor);
            // scale up slightly to make halo larger and softer
            spr.scale.set(s * 1.2, s * 1.2, 1);
            spr.renderOrder = 0;
            return spr;
          } catch (e) { return null; }
        }

        // small core sprite: intense white center to drive bloom
        // create a circular core sprite with a radial gradient; color is a THREE.Color or hex
        function makeCoreSprite(color, scaleFactor, innerAlpha) {
          try {
            const size = 256; // larger for smoother circular falloff
            const canvas = document.createElement('canvas');
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0,0,size,size);
            const c = (color && color.isColor) ? color : new THREE.Color(color || 0xffffff);
            const r = Math.floor(c.r * 255), g = Math.floor(c.g * 255), b = Math.floor(c.b * 255);
            const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
            // allow caller to reduce inner alpha so the core isn't overly bright
            // default to a reduced inner alpha to avoid a blinding center when innerAlpha isn't provided
            const ia = (typeof innerAlpha === 'number') ? Math.max(0, Math.min(1, innerAlpha)) : 0.25;
            // tight core (use ia), then colored glow, then fade
            grad.addColorStop(0.0, `rgba(${r},${g},${b},${ia})`);
            grad.addColorStop(0.18, `rgba(${r},${g},${b},${Math.max(0.6, ia * 0.98)})`);
            grad.addColorStop(0.36, `rgba(${r},${g},${b},0.7)`);
            grad.addColorStop(0.65, `rgba(${r},${g},${b},0.28)`);
            grad.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
            ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
            const tex = new THREE.CanvasTexture(canvas);
            tex.minFilter = THREE.LinearFilter;
            // use NormalBlending for the core; reduce opacity so the center is even more subdued
            // use a more opaque default for core so it can appear as a solid disk when desired
            const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.NormalBlending, depthTest: false, transparent: true, opacity: 0.95 });
            const spr = new THREE.Sprite(mat);
            const s = Math.max(1, scaleFactor);
            // scale the core to be able to fill up to the glow radius when caller requests
            spr.scale.set(s * 1.0, s * 1.0, 1);
            spr.renderOrder = 2;
            return spr;
          } catch (e) { return null; }
        }

        // 保存して hover で操作できるようにする
        node.__labelSprite = label;
        node.__threeObj = group;

        // --- Bloom 対象にする ---
        // status === 'error' または status === 'warning' の場合、ラベルとノード本体をレイヤー1に設定して選択的ブルームを適用
        try {
          if (node.status === 'error' || node.status === 'warning') {
              // Do NOT mark the mesh or label as bloom targets; keep bloom limited to the outer glow sprite only.
              // add an additive glow sprite behind the node to emphasize halo
              try {
                // choose glow color: deeper red for errors (stronger halo), Google's yellow for warnings
                const glowColor = (node.status === 'error') ? new THREE.Color(0xB00020) : new THREE.Color(0xFBBC05);
                // Use the same glow scale for both statuses
                const glowScale = baseSize * 4.0;
                const glow = makeGlowSprite(glowColor, glowScale);
                if (glow) {
                  glow.position.set(0, 0, 0);
                  // mark only the glow sprite for bloom and enable bloom layer
                  try { glow.userData.bloom = true; } catch(e){}
                  if (glow.layers) glow.layers.enable(1);
                  // if error, increase sprite opacity slightly to make the red halo appear stronger
                  try { if (node.status === 'error' && glow.material) glow.material.opacity = Math.max(0.75, glow.material.opacity || 0.75); } catch(e){}
                  group.add(glow);

                  // For error nodes, add a saturated red core sprite (non-bloom) so the center is a clean red disk
                  if (node.status === 'error') {
                    try {
                      // create a core sprite scaled to the glow radius so the core appears solid up to the halo
                      const core = makeCoreSprite(new THREE.Color(0xB00020), glowScale, 1.0);
                      if (core) {
                        core.position.set(0, 0, 0);
                        try { core.userData.bloom = false; } catch(e){}
                        try { if (core.material) core.material.opacity = 1.0; } catch(e){}
                        group.add(core);
                      }
                    } catch (e) {}
                  }
                }
                // NOTE: core sprite and mesh/label bloom removed to keep only the outer halo effect
              } catch(e){}
            }
        } catch (e) {}

        return group;
      });

      // hover でラベルを拡大表示する
      let prevHover = null;
      GraphInstance.onNodeHover(node => {
        if (prevHover && prevHover.__labelSprite) {
          // 元のスケールに戻す
          prevHover.__labelSprite.scale.setScalar(1.0);
        }
        if (node && node.__labelSprite) {
          // 拡大: スプライトの現在の scale に対して倍率をかける
          node.__labelSprite.scale.multiplyScalar(1.8);
        }
        prevHover = node;
      });

      // 简単な環境光と点光源
      const threeScene = GraphInstance.scene();
      threeScene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const light = new THREE.DirectionalLight(0xffffff, 0.6);
      light.position.set(50, 50, 50);
      threeScene.add(light);
      // OrbitControls が読み込まれていれば、Graph のカメラ/renderer を使って接続
      try {
        const threeRenderer = GraphInstance.renderer();
        const threeCamera = GraphInstance.camera();
        if (THREE && THREE.OrbitControls && threeRenderer && threeCamera) {
          const controls = new THREE.OrbitControls(threeCamera, threeRenderer.domElement);
          controls.enableDamping = true;
          controls.dampingFactor = 0.07;
          controls.rotateSpeed = 0.6;
          controls.zoomSpeed = 1.0;
          controls.panSpeed = 0.8;
          // expose controls for UI to toggle auto-rotate
          GraphInstance.__orbitControls = controls;
          // GraphInstance の tick で controls.update を呼ぶ
          const origTick = GraphInstance._tick;
          // manual orbit fallback state
          let lastAutoRotateTime = 0;
            GraphInstance._tick = function() {
              try { controls.update(); } catch (e) {}
              // if auto-rotate enabled via UI, try to use OrbitControls.autoRotate, but also
              // provide a manual fallback rotation in case autoRotate isn't effective.
              try {
                const auto = localStorage.getItem('d3fg_auto_orbit');
                const sp = parseFloat(localStorage.getItem('d3fg_auto_orbit_speed')) || 0.25;
                // keep OrbitControls flags in sync for normal behavior
                try { if (auto !== null) controls.autoRotate = auto === '1'; } catch(e){}
                try { controls.autoRotateSpeed = sp; } catch(e){}

                // manual fallback: if UI requests auto-orbit, rotate camera around controls.target
                if (auto === '1') {
                  const now = performance.now();
                  if (!lastAutoRotateTime) lastAutoRotateTime = now;
                  const dt = Math.max(0, (now - lastAutoRotateTime) / 1000);
                  lastAutoRotateTime = now;
                  // angle per second: scale UI speed to a comfortable rad/s (0.25 -> ~0.5 rad/s)
                  const angPerSec = sp * 2.0; // empirical scaling
                  const ang = angPerSec * dt;
                  try {
                    const target = controls.target ? controls.target.clone() : new THREE.Vector3(0,0,0);
                    const camPos = threeCamera.position.clone().sub(target);
                    const cos = Math.cos(ang), sin = Math.sin(ang);
                    const x = camPos.x * cos - camPos.z * sin;
                    const z = camPos.x * sin + camPos.z * cos;
                    camPos.x = x; camPos.z = z;
                    threeCamera.position.copy(camPos.add(target));
                    threeCamera.lookAt(target);
                  } catch (e) {}
                }
              } catch (e) {}
              // If selective bloom is prepared and enabled, render in two passes:
              // 1) render bloom layer (layer 1) into bloomComposer
              // 2) render full scene into finalComposer (which will composite over screen)
              try {
                if (bloomComposer && finalComposer && bloomEnabled()) {
                  const renderer = threeRenderer;
                  const camera = threeCamera;
                  try {
                    // 1) replace non-bloom materials with dark / hide sprites
                    replaceMaterialsForBloom();
                    // 2) render bloomComposer which now only contains bright/bloom objects
                    bloomComposer.render();
                  } finally {
                    // 3) restore original materials
                    restoreMaterials();
                  }
                  // 4) render final scene to screen
                  finalComposer.render();
                  return; // skip original rendering
                }
              } catch (e) {}
              if (origTick) origTick.apply(this, arguments);
            };
        }
      } catch (e) {
        console.warn('OrbitControls の初期化に失敗しました', e);
      }
    } catch (err) {
      console.warn('カスタム nodeThreeObject / lighting 作成で警告', err);
    }

  // --- Bloom (postprocessing) setup (selective bloom via material swap) ---
  // We'll create two composers on demand: bloomComposer (renders bright parts) and finalComposer (renders normally)
  let bloomComposer = null;
  let finalComposer = null;
  let bloomPass = null;
  let highPass = null;
  // dark material used to hide non-bloom objects when rendering bloom pass
  let darkMaterial = null;
  const _savedMaterials = [];

    function bloomEnabled() {
      try {
        const v = localStorage.getItem('d3fg_bloom_enabled');
        if (v !== null) return v === '1';
        // fallback to false
        return false;
      } catch (e) { return false; }
    }

  // placeholders for functions that will be created when composers are prepared
  let replaceMaterialsForBloom = null;
  let restoreMaterials = null;

  async function tryPrepareBloom() {
      if (finalComposer) return; // already prepared
      try {
        // Load postprocessing scripts (EffectComposer + dependencies)
        if (typeof THREE.EffectComposer === 'undefined') {
          await loadScript('https://cdn.jsdelivr.net/npm/three@0.153.0/examples/js/postprocessing/EffectComposer.js');
          await loadScript('https://cdn.jsdelivr.net/npm/three@0.153.0/examples/js/postprocessing/RenderPass.js');
          await loadScript('https://cdn.jsdelivr.net/npm/three@0.153.0/examples/js/postprocessing/ShaderPass.js');
          await loadScript('https://cdn.jsdelivr.net/npm/three@0.153.0/examples/js/shaders/CopyShader.js');
          await loadScript('https://cdn.jsdelivr.net/npm/three@0.153.0/examples/js/shaders/LuminosityHighPassShader.js');
          await loadScript('https://cdn.jsdelivr.net/npm/three@0.153.0/examples/js/postprocessing/UnrealBloomPass.js');
        }

        const threeRenderer = GraphInstance.renderer();
        const threeCamera = GraphInstance.camera();
        const threeScene = GraphInstance.scene();
        if (!threeRenderer || !threeCamera || !threeScene) return;

  // ensure darkMaterial created
  darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

  // bloomComposer: will render scene where non-bloom objects are darkened
  bloomComposer = new THREE.EffectComposer(threeRenderer);
  const bloomRenderPass = new THREE.RenderPass(threeScene, threeCamera);
  bloomComposer.addPass(bloomRenderPass);

        const width = Math.max(256, Math.floor(window.innerWidth));
        const height = Math.max(256, Math.floor(window.innerHeight));
        // Add a luminosity high-pass to extract bright areas before bloom
        try {
          highPass = new THREE.ShaderPass(THREE.LuminosityHighPassShader);
          // threshold parameter controls how bright a pixel must be
          const savedThreshold = parseFloat(localStorage.getItem('d3fg_bloom_threshold')) || 0.05;
          highPass.uniforms['luminosityThreshold'].value = savedThreshold;
          bloomComposer.addPass(highPass);
        } catch (e) {}
  bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(width, height), 2.4, 0.9, 0.05);
    const sStrength = parseFloat(localStorage.getItem('d3fg_bloom_strength')) || 2.4;
    const sRadius = parseFloat(localStorage.getItem('d3fg_bloom_radius')) || 0.9;
  const sThreshold = parseFloat(localStorage.getItem('d3fg_bloom_threshold')) || 0.05;
    bloomPass.strength = sStrength; bloomPass.radius = sRadius; bloomPass.threshold = sThreshold;
        bloomComposer.addPass(bloomPass);

        // finalComposer: render scene normally
        finalComposer = new THREE.EffectComposer(threeRenderer);
        const finalRenderPass = new THREE.RenderPass(threeScene, threeCamera);
        finalComposer.addPass(finalRenderPass);

        // helper to replace materials for selective bloom
        replaceMaterialsForBloom = function() {
          _savedMaterials.length = 0;
          threeScene.traverse(obj => {
            try {
              if ((obj.isMesh || obj.isSprite) && !obj.userData.bloom) {
                _savedMaterials.push({ obj, material: obj.material, visible: obj.visible });
                if (obj.isMesh) obj.material = darkMaterial;
                if (obj.isSprite) obj.visible = false;
              }
            } catch (e) {}
          });
        };

        restoreMaterials = function() {
          for (let i = 0; i < _savedMaterials.length; i++) {
            const e = _savedMaterials[i];
            try {
              if (e.obj.isMesh) e.obj.material = e.material;
              if (e.obj.isSprite) e.obj.visible = e.visible;
            } catch (e2) {}
          }
          _savedMaterials.length = 0;
        };

        // resize handling
        window.addEventListener('resize', () => {
          try {
            const w = Math.max(256, Math.floor(window.innerWidth));
            const h = Math.max(256, Math.floor(window.innerHeight));
            bloomComposer.setSize(w, h);
            finalComposer.setSize(w, h);
          } catch (e) {}
        });
      } catch (e) {
        console.warn('Bloom の準備に失敗しました', e);
        bloomComposer = null; finalComposer = null; bloomPass = null;
      }
    }

    // If bloom was enabled from saved settings, prepare it now (async)
    if (bloomEnabled()) tryPrepareBloom();

    // 6) 描画が始まったらローダーを消す
    // 初フレームが来たら hide
    let firstFrame = true;
    const originalTick = GraphInstance._tick; // internal tick (may be undefined) - fallback approach
    // Use requestAnimationFrame to detect first render
    requestAnimationFrame(function checkFrame(){
      // if camera exists and scene rendered, hide loader
      if (firstFrame) {
        hideLoader();
        firstFrame = false;
      }
    });

    // 7) 明示的に GC できないので参照を切ることで解放を促す
    // nodes/links は GraphInstance にコピーされているため raw は null にしておく
    // ここではすでに raw = null

    console.log('3d-force-graph: nodes=', nodes.length, 'links=', links.length);
  }

  // 起動
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
