// Experimental: 3D network graph using three.js, showing all nodes from data.json
// マウスホイールでズームイン・ズームアウト対応

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.module.js';

(async function() {
  // Fetch all nodes from data.json
  const response = await fetch('data.json?v=' + Date.now());
  const allData = await response.json();
  const nodes = allData; // すべてのノードを使用

  // Generate links randomly for demo (since links field is empty)
  const links = [];
  for (let i = 0; i < nodes.length; i++) {
    if (i % 5 === 0 && i > 0) {
      links.push({ source: nodes[i].id, target: nodes[i - 1].id });
    }
    if (i % 7 === 0 && i > 1) {
      links.push({ source: nodes[i].id, target: nodes[i - 2].id });
    }
  }

  // Setup three.js scene
  const width = window.innerWidth;
  const height = window.innerHeight - 56; // minus navbar
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 200;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);

  // Remove previous canvas and append new one
  const canvasDiv = document.getElementById('canvas');
  canvasDiv.innerHTML = '';
  canvasDiv.appendChild(renderer.domElement);

  // Node geometry/material
  const nodeGeometry = new THREE.SphereGeometry(2, 16, 16);
  const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0xffd700 });

  // Position nodes randomly in 3D space
  nodes.forEach((node, i) => {
    node.x = Math.random() * 180 - 90;
    node.y = Math.random() * 120 - 60;
    node.z = Math.random() * 180 - 90;
    const mesh = new THREE.Mesh(nodeGeometry, nodeMaterial.clone());
    mesh.position.set(node.x, node.y, node.z);
    mesh.userData = node;
    scene.add(mesh);
  });

  // Draw links as lines
  links.forEach(link => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    if (sourceNode && targetNode) {
      const points = [
        new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
        new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z)
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: 0x8888ff });
      const line = new THREE.Line(geometry, material);
      scene.add(line);
    }
  });

  // Simple orbit controls (experimental, minimal)
  let isDragging = false, prevX = 0, prevY = 0;
  renderer.domElement.addEventListener('mousedown', e => {
    isDragging = true; prevX = e.clientX; prevY = e.clientY;
  });
  renderer.domElement.addEventListener('mouseup', () => { isDragging = false; });
  renderer.domElement.addEventListener('mousemove', e => {
    if (isDragging) {
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      scene.rotation.y += dx * 0.005;
      scene.rotation.x += dy * 0.005;
      prevX = e.clientX; prevY = e.clientY;
    }
  });

  // マウスホイールでズームイン・ズームアウト
  renderer.domElement.addEventListener('wheel', e => {
    e.preventDefault();
    // e.deltaY > 0: zoom out, < 0: zoom in
    camera.position.z += e.deltaY * 0.2;
    // 最小/最大ズーム制限
    camera.position.z = Math.max(30, Math.min(1000, camera.position.z));
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
})();