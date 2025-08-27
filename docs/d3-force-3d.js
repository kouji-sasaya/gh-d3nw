// ES ModulesでThree.jsとOrbitControlsをインポート
(async function() {
  // Three.jsとOrbitControlsを動的import
  const THREE = await import('https://unpkg.com/three@0.153.0/build/three.module.js?module');
  const { OrbitControls } = await import('https://unpkg.com/three@0.153.0/examples/jsm/controls/OrbitControls.js?module');

  // d3-force-3d CDN（UMDしかないので従来通り）
  if (!window.d3 || !window.d3.forceSimulation3D) {
    await new Promise(resolve => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/d3-force-3d@1.1.0/build/d3-force-3d.min.js';
      script.onload = resolve;
      document.head.appendChild(script);
    });
  }

  // キャンバス初期化
  const canvasDiv = document.getElementById('canvas');
  canvasDiv.innerHTML = '';

  // Three.jsシーンセットアップ
  const width = canvasDiv.clientWidth || window.innerWidth;
  const height = canvasDiv.clientHeight || window.innerHeight;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, width / height, 1, 10000);
  camera.position.set(0, 0, 800);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  canvasDiv.appendChild(renderer.domElement);

  // ライト
  const light = new THREE.DirectionalLight(0xffffff, 0.8);
  light.position.set(0, 0, 1000);
  scene.add(light);

  // OrbitControls
  const controls = new OrbitControls(camera, renderer.domElement);

  // データ取得
  const [nodesData, configData] = await Promise.all([
    fetch('data.json?' + Date.now()).then(res => res.json()),
    fetch('config.json?' + Date.now()).then(res => res.json())
  ]);
  const config = configData.config;
  const nodes = Array.isArray(nodesData) ? nodesData : (Array.isArray(nodesData.nodes) ? nodesData.nodes : []);
  // links生成
  const links = [];
  nodes.forEach(node => {
    if (node.links && node.links.length > 0) {
      node.links.forEach(targetId => {
        links.push({ source: node.id, target: targetId });
      });
    }
  });

  // id→node参照
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  // d3-force-3dでレイアウト計算
  const sim = d3.forceSimulation3D(nodes)
    .force('link', d3.forceLink3D(links).id(d => d.id).distance(120))
    .force('charge', d3.forceManyBody3D().strength(-80))
    .force('center', d3.forceCenter(0, 0, 0))
    .alpha(1)
    .alphaDecay(0.02);

  // ノードのThree.jsオブジェクト生成
  const nodeObjs = [];
  nodes.forEach(node => {
    const size = (config.types[node.type]?.size || 30) / 3;
    const color = config.types[node.type]?.color || '#888888';
    const geometry = new THREE.SphereGeometry(size, 16, 16);
    const material = new THREE.MeshPhongMaterial({ color });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.userData = { node };
    scene.add(sphere);
    nodeObjs.push(sphere);

    // ラベル
    const labelDiv = document.createElement('div');
    labelDiv.style.position = 'absolute';
    labelDiv.style.color = '#222';
    labelDiv.style.fontSize = '13px';
    labelDiv.style.pointerEvents = 'none';
    labelDiv.style.fontWeight = node.type === 'group' ? 'bold' : 'normal';
    labelDiv.textContent = node.name;
    canvasDiv.appendChild(labelDiv);
    sphere.userData.labelDiv = labelDiv;
  });

  // リンクのThree.jsオブジェクト生成
  const linkObjs = [];
  links.forEach(link => {
    const material = new THREE.LineBasicMaterial({ color: 0x999999 });
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3()
    ]);
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    linkObjs.push({ line, link });
  });

  // アニメーションループ
  function animate() {
    sim.tick();

    nodes.forEach((node, i) => {
      nodeObjs[i].position.set(node.x, node.y, node.z);
    });

    linkObjs.forEach(obj => {
      const src = nodeById.get(obj.link.source);
      const tgt = nodeById.get(obj.link.target);
      if (src && tgt) {
        obj.line.geometry.setFromPoints([
          new THREE.Vector3(src.x, src.y, src.z),
          new THREE.Vector3(tgt.x, tgt.y, tgt.z)
        ]);
      }
    });

    nodeObjs.forEach(sphere => {
      const vector = sphere.position.clone();
      vector.project(camera);
      const x = (vector.x * 0.5 + 0.5) * width;
      const y = (-vector.y * 0.5 + 0.5) * height;
      sphere.userData.labelDiv.style.left = `${x}px`;
      sphere.userData.labelDiv.style.top = `${y}px`;
      sphere.userData.labelDiv.style.display = (vector.z < 1) ? 'block' : 'none';
    });

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  window.addEventListener('resize', () => {
    const w = canvasDiv.clientWidth || window.innerWidth;
    const h = canvasDiv.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
})();