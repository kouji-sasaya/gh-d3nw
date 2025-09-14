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

    const idMap = new Map();
    const nodes = raw.map((d, i) => {
      const node = {
        id: d.id,
        name: d.name || d.id,
        type: d.type || 'node',
        status: d.status || '',
        address: d.address || ''
      };
      // config.json の types 定義を参照して _size と _color を付与
      const tcfg = cfg && cfg.config && cfg.config.types && cfg.config.types[node.type];
      if (tcfg) {
        node._size = tcfg.size;    // ユーザー指定のサイズ値
        node._color = tcfg.color;  // ヘックスカラー文字列
      } else {
        node._size = 50; // デフォルト
        node._color = '#aaaaaa';
      }
      idMap.set(d.id, node);
      return node;
    });

    const links = [];
    for (const d of raw) {
      if (Array.isArray(d.links)) {
        for (const tgt of d.links) {
          // only create link if target exists
          if (idMap.has(tgt)) links.push({ source: d.id, target: tgt });
        }
      }
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

    const GraphInstance = Graph()(container)
      .graphData({ nodes, links })
      .nodeLabel(node => `${node.name} (${node.id})`)
      // nodeAutoColorBy は使わず config.json の色を使う
      .linkDirectionalParticles(0)
      .backgroundColor('#07080a')
      .onNodeClick(node => {
        // 中央へ移動
        const distance = 120;
        const distRatio = 1 + distance/Math.hypot(node.x||0, node.y||0, node.z||0);
        GraphInstance.cameraPosition({ x: (node.x||0)*distRatio, y: (node.y||0)*distRatio, z: (node.z||0)*distRatio }, node, 4000);
      });

    // --- UI: ラベル表示切替とノードサイズ倍率 ---
    (function setupUI() {
      const ui = document.createElement('div');
      ui.style.position = 'absolute';
      ui.style.right = '12px';
      ui.style.top = '12px';
      ui.style.zIndex = 10000;
      ui.style.background = 'rgba(12,14,20,0.6)';
      ui.style.color = '#eef2ff';
      ui.style.padding = '10px 12px';
      ui.style.borderRadius = '10px';
      ui.style.fontFamily = 'Inter, system-ui, -apple-system, "Hiragino Kaku Gothic ProN", "メイリオ", sans-serif';
      ui.style.fontSize = '13px';

      ui.innerHTML = `
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <input type='checkbox' id='d3fg-label-toggle' /> ラベル表示
        </label>
        <label style="display:block">ノードサイズ倍率: <span id='d3fg-size-val'>1.0</span>
          <input type='range' id='d3fg-size-range' min='0.4' max='2.5' step='0.05' value='1.0' style='width:160px'>
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
      `;
      container.appendChild(ui);

      const chk = ui.querySelector('#d3fg-label-toggle');
      const range = ui.querySelector('#d3fg-size-range');
      const val = ui.querySelector('#d3fg-size-val');
      const lodToggle = ui.querySelector('#d3fg-lod-toggle');
      const lodRange = ui.querySelector('#d3fg-lod-range');
      const lodVal = ui.querySelector('#d3fg-lod-val');
      const lodIntervalEl = ui.querySelector('#d3fg-lod-interval');
      const lodIntervalVal = ui.querySelector('#d3fg-lod-interval-val');

      // 設定を localStorage から復元
      const savedLabel = localStorage.getItem('d3fg_label_visible');
      const savedScale = localStorage.getItem('d3fg_size_multiplier');
      const savedLODEn = localStorage.getItem('d3fg_lod_enabled');
      const savedLODDist = localStorage.getItem('d3fg_lod_distance');
      const savedLODInterval = localStorage.getItem('d3fg_lod_interval');

      if (savedLabel !== null) chk.checked = savedLabel === '1'; else chk.checked = true;
      if (savedScale !== null) { range.value = savedScale; val.textContent = parseFloat(savedScale).toFixed(2); }
      if (savedLODEn !== null) lodToggle.checked = savedLODEn === '1'; else lodToggle.checked = true;
      if (savedLODDist !== null) { lodRange.value = savedLODDist; lodVal.textContent = parseFloat(savedLODDist).toFixed(0); }
      if (savedLODInterval !== null) { lodIntervalEl.value = savedLODInterval; lodIntervalVal.textContent = parseInt(savedLODInterval,10); }

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
        if (node.status === 'error') mesh.material.emissive = new THREE.Color(0xff4444);
        if (node.status === 'warning') mesh.material.emissive = new THREE.Color(0xffcc44);

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

        // 保存して hover で操作できるようにする
        node.__labelSprite = label;
        node.__threeObj = group;

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
          // GraphInstance の tick で controls.update を呼ぶ
          const origTick = GraphInstance._tick;
          GraphInstance._tick = function() {
            try { controls.update(); } catch (e) {}
            if (origTick) origTick.apply(this, arguments);
          };
        }
      } catch (e) {
        console.warn('OrbitControls の初期化に失敗しました', e);
      }
    } catch (err) {
      console.warn('カスタム nodeThreeObject / lighting 作成で警告', err);
    }

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
