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

    // node オブジェクトをカスタムで小さな球にする（見た目の安定のため）
    try {
      const spriteTexture = null; // placeholder if needed
      GraphInstance.nodeThreeObject(node => {
  // config.json の size を視認性の良い半径にスケーリングして使用
  // 大きさのダイナミクスを落ち着かせるため sqrt スケールを採用
  const rawSize = node._size || 50;
  // tunable constants: a (min radius), b (scale factor)
  const a = 1.2;
  const b = 0.55; // 調整すると全体の大きさが増減します
  const baseSize = Math.max(0.9, a + b * Math.sqrt(rawSize));
  const geometry = new THREE.SphereGeometry(baseSize, 12, 12);
        const colorHex = node._color || '#ffffff';
        const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(colorHex), roughness: 0.6, metalness: 0.1 });
        const sprite = new THREE.Mesh(geometry, material);
        // ステータスに応じた光るエフェクト
        if (node.status === 'error') sprite.material.emissive = new THREE.Color(0xff4444);
        if (node.status === 'warning') sprite.material.emissive = new THREE.Color(0xffcc44);
        return sprite;
      });

      // 简単な環境光と点光源
      const threeScene = GraphInstance.scene();
      threeScene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const light = new THREE.DirectionalLight(0xffffff, 0.6);
      light.position.set(50, 50, 50);
      threeScene.add(light);
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
