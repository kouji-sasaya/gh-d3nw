// docs/tooltip.js
// Type/Statusツールチップの共通モジュール

export function showTypeTooltip({ config, onChange } = {}) {
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
    document.body.appendChild(typeTooltip);
  }
  // UI生成
  const order = ['project', 'domain', 'group', 'service', 'team', 'user'];
  const types = order.filter(t => (config && config.types && config.types[t]))
    .concat(Object.keys(config?.types || {}).filter(t => !order.includes(t)));
  typeTooltip.innerHTML = '<strong style="display:block;margin-bottom:6px;">Filter types</strong>';
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
    cb.checked = true;
    cb.dataset.group = t;
    cb.className = 'filter-checkbox';
    cb.addEventListener('change', (ev) => {
      if (typeof onChange === 'function') onChange(t, ev.target.checked);
    });
    const span = document.createElement('span');
    span.textContent = typeLabel(t);
    wrapper.appendChild(cb);
    wrapper.appendChild(span);
    typeTooltip.appendChild(wrapper);
  });
  // トグルボタン
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
      typeTooltip.style.display = (typeTooltip.style.display === 'none' || typeTooltip.style.display === '') ? 'block' : 'none';
    });
    document.body.appendChild(toggleBtn);
  }
  typeTooltip.style.display = 'block';
  return typeTooltip;
}

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

export function showStatusTooltip({ onChange } = {}) {
  let statusTooltip = document.getElementById('network-status-tooltip');
  if (!statusTooltip) {
    statusTooltip = document.createElement('div');
    statusTooltip.id = 'network-status-tooltip';
    statusTooltip.style.position = 'fixed';
    statusTooltip.style.top = '300px';
    statusTooltip.style.right = '12px';
    statusTooltip.style.padding = '8px';
    statusTooltip.style.background = 'rgba(255,255,255,0.95)';
    statusTooltip.style.border = '1px solid rgba(0,0,0,0.08)';
    statusTooltip.style.borderRadius = '6px';
    statusTooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    statusTooltip.style.zIndex = 9999;
    statusTooltip.style.fontSize = '13px';
    document.body.appendChild(statusTooltip);
  }
  // UI生成
  const statuses = ['pass', 'warning', 'error'];
  statusTooltip.innerHTML = '<strong style="display:block;margin-bottom:6px;">Filter status</strong>';
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
      if (typeof onChange === 'function') onChange(st, cb.checked);
    });
    const span = document.createElement('span');
    span.textContent = st.charAt(0).toUpperCase() + st.slice(1);
    wrapper.appendChild(cb);
    wrapper.appendChild(span);
    statusTooltip.appendChild(wrapper);
  });
  // トグルボタン
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
      statusTooltip.style.display = (statusTooltip.style.display === 'none' || statusTooltip.style.display === '') ? 'block' : 'none';
    });
    document.body.appendChild(toggleBtn);
  }
  statusTooltip.style.display = 'block';
  return statusTooltip;
}

export function hideTypeTooltip() {
  const typeTooltip = document.getElementById('network-type-tooltip');
  if (typeTooltip) typeTooltip.style.display = 'none';
}

export function hideStatusTooltip() {
  const statusTooltip = document.getElementById('network-status-tooltip');
  if (statusTooltip) statusTooltip.style.display = 'none';
}
