const state = {
  records: [],
  years: [],
  providerSet: [],
  effortSet: [],
  modelSet: [],
  selectedProviders: new Set(),
  selectedEfforts: new Set(),
  selectedModels: new Set(),
};

const DEFAULT_EFFORTS = ['standard'];

const METRICS = {
  coding: { label: 'Coding Elo', axis: 'coding Elo — LMArena', min: 1080, max: 1600 },
  overall: { label: 'Overall Elo', axis: 'overall Elo — LMArena', min: 1080, max: 1600 },
  hard: { label: 'Hard prompts Elo', axis: 'hard prompts Elo — LMArena', min: 1080, max: 1600 },
  aa_coding: { label: 'AA Coding Index', axis: 'Artificial Analysis coding index', min: 30, max: 80 },
  aa_agentic: { label: 'AA Agentic Index', axis: 'Artificial Analysis agentic index', min: 20, max: 60 },
  aa_intelligence: { label: 'AA Intelligence Index', axis: 'Artificial Analysis intelligence index', min: 30, max: 70 },
};

const PROVIDER_COLORS = {
  anthropic: '#f59e0b',
  openai: '#10b981',
  moonshotai: '#2563eb',
  deepseek: '#ef4444',
  google: '#7c3aed',
  minimax: '#db2777',
  qwen: '#0891b2',
  meta: '#65a30d',
  mistralai: '#ea580c',
  'z-ai': '#9333ea',
  'ibm-granite': '#64748b',
  other: '#6b7280',
};

function metricKey() {
  return document.getElementById('metric').value;
}

function metricValue(row, key = metricKey()) {
  const value = row[key];
  return value == null || Number.isNaN(value) ? null : Number(value);
}

function metricLabel() {
  return METRICS[metricKey()].label;
}

function providerColor(provider) {
  return PROVIDER_COLORS[provider] || PROVIDER_COLORS.other;
}

function paretoFront(records, key = metricKey()) {
  const valid = records.filter((row) => metricValue(row, key) != null);
  const ordered = [...valid].sort((a, b) => a.cpmi - b.cpmi || metricValue(b, key) - metricValue(a, key));
  const out = [];
  let best = -Infinity;
  for (const row of ordered) {
    const value = metricValue(row, key);
    if (value > best) {
      out.push(row);
      best = value;
    }
  }
  return out;
}

function activeForYear(records, year) {
  const cutoff = year + 0.99;
  return records.filter((row) => row.launch_num <= cutoff && (!row.end_num || row.end_num >= year));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function selectedValues(select) {
  return [...select.selectedOptions].map((o) => o.value);
}

function recordEfforts(row) {
  if (Array.isArray(row.supported_efforts) && row.supported_efforts.length) {
    return row.supported_efforts;
  }
  return DEFAULT_EFFORTS;
}

function effortText(row) {
  const efforts = recordEfforts(row);
  return efforts.length ? efforts.join(', ') : row.reasoning || 'standard';
}

function optionHtml(values) {
  return values.map((v) => `<option value="${v}" selected>${v}</option>`).join('');
}

function refreshSelectOptions(select, values, selectedSet) {
  const selected = values.filter((v) => selectedSet.has(v));
  select.innerHTML = values
    .map((v) => `<option value="${v}" ${selected.includes(v) ? 'selected' : ''}>${v}</option>`)
    .join('');
}

function setAll(select, values) {
  select.innerHTML = values.map((v) => `<option value="${v}" selected>${v}</option>`).join('');
}

function setNone(select, values) {
  select.innerHTML = values.map((v) => `<option value="${v}">${v}</option>`).join('');
}

function initSelectButtons() {
  document.querySelectorAll('button[data-select]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.select;
      const mode = button.dataset.mode;
      const select = document.getElementById(key);
      const values = {
        provider: state.providerSet,
        effort: state.effortSet,
        model: state.modelSet,
      }[key] || [];
      if (mode === 'all') setAll(select, values);
      else setNone(select, values);
      syncSelections();
      update();
    });
  });
}

function visibleModelValues() {
  const q = document.getElementById('modelSearch').value.trim().toLowerCase();
  return state.modelSet.filter((m) => !q || m.toLowerCase().includes(q));
}

function syncSelections() {
  state.selectedProviders = new Set(selectedValues(document.getElementById('provider')));
  state.selectedEfforts = new Set(selectedValues(document.getElementById('effort')));
  state.selectedModels = new Set(selectedValues(document.getElementById('model')));
}

function initFilters() {
  state.providerSet = uniqueSorted(state.records.map((r) => r.provider));
  state.effortSet = uniqueSorted(state.records.flatMap((r) => recordEfforts(r)));
  state.modelSet = uniqueSorted(state.records.map((r) => r.model));

  state.selectedProviders = new Set(state.providerSet);
  state.selectedEfforts = new Set(state.effortSet);
  state.selectedModels = new Set(state.modelSet);

  document.getElementById('provider').innerHTML = optionHtml(state.providerSet);
  document.getElementById('effort').innerHTML = optionHtml(state.effortSet);
  document.getElementById('model').innerHTML = optionHtml(state.modelSet);

  ['provider', 'effort', 'model'].forEach((id) => {
    document.getElementById(id).addEventListener('change', () => {
      syncSelections();
      update();
    });
  });

  document.getElementById('modelSearch').addEventListener('input', () => {
    refreshSelectOptions(document.getElementById('model'), visibleModelValues(), state.selectedModels);
    update();
  });

  initSelectButtons();
}

function filteredRecords() {
  const year = Number(document.getElementById('year').value);
  const maxCost = Number(document.getElementById('maxCost').value || 80);
  const search = document.getElementById('search').value.trim().toLowerCase();
  const key = metricKey();
  return activeForYear(state.records, year)
    .filter((r) => state.selectedProviders.has(r.provider))
    .filter((r) => recordEfforts(r).some((effort) => state.selectedEfforts.has(effort)))
    .filter((r) => state.selectedModels.has(r.model))
    .filter((r) => metricValue(r, key) != null)
    .filter((r) => r.cpmi <= maxCost)
    .filter((r) => !search || r.model.toLowerCase().includes(search));
}

function traceFor(rows, name, marker, extra = {}) {
  const key = metricKey();
  return {
    x: rows.map((r) => r.cpmi),
    y: rows.map((r) => metricValue(r, key)),
    text: rows.map((r) => `${r.model}<br>${r.provider}<br>${effortText(r)}`),
    customdata: rows.map((r) => [r.price_output_per_mtok ?? 'n/a', r.default_effort ?? 'n/a']),
    mode: 'markers',
    name,
    marker,
    hovertemplate:
      '<b>%{text}</b><br>' +
      '$%{x:.3g}/M input tokens<br>' +
      '$%{customdata[0]:.3g}/M output tokens<br>' +
      'default effort: %{customdata[1]}<br>' +
      `${metricLabel()} %{y:.2f}<extra></extra>`,
    ...extra,
  };
}

function update() {
  const year = document.getElementById('year').value;
  document.getElementById('yearLabel').textContent = year;
  const rows = filteredRecords();
  const front = paretoFront(rows, metricKey());
  const frontSet = new Set(front.map((r) => r.model));
  const others = rows.filter((r) => !frontSet.has(r.model));
  const frontOnly = document.getElementById('frontOnly').checked;
  const displayed = frontOnly ? front : rows;

  document.getElementById('count').textContent = String(displayed.length);
  document.getElementById('frontCount').textContent = String(front.length);
  const best = front.length ? front[front.length - 1] : null;
  document.getElementById('bestModel').textContent = best ? best.model : '—';

  const traces = [];
  if (!frontOnly && others.length) {
    const byProvider = new Map();
    for (const row of others) {
      if (!byProvider.has(row.provider)) byProvider.set(row.provider, []);
      byProvider.get(row.provider).push(row);
    }
    for (const [provider, providerRows] of byProvider) {
      traces.push(traceFor(providerRows, provider, {
        size: 8,
        color: providerColor(provider),
        opacity: 0.58,
        line: { width: 0 },
      }));
    }
  }
  if (front.length) {
    traces.push(traceFor(front, 'front de Pareto', {
      size: 9,
      color: '#16a34a',
      line: { color: 'white', width: 1.2 },
    }, {
      mode: 'lines+markers',
      line: { color: '#16a34a', width: 3 },
    }));
  }

  if (document.getElementById('showLabels').checked && displayed.length) {
    traces.push(traceFor(displayed, 'noms', {
      size: 9,
      color: 'rgba(37,99,235,0.0)',
      line: { width: 0 },
    }, {
      mode: 'text',
      textposition: 'top center',
      textfont: { size: 10, color: '#1d4ed8' },
      showlegend: false,
    }));
  }

  const metric = METRICS[metricKey()];
  const layout = {
    title: `Coût vs ${metric.label} — ${year}`,
    margin: { l: 70, r: 30, t: 55, b: 60 },
    xaxis: {
      title: 'coût input API — USD / million tokens (log)',
      type: 'log',
      gridcolor: '#e5e7eb',
      tickprefix: '$',
    },
    yaxis: {
      title: metric.axis,
      range: [metric.min, metric.max],
      gridcolor: '#e5e7eb',
    },
    paper_bgcolor: 'white',
    plot_bgcolor: '#fbfbfb',
    legend: { x: 0.78, y: 0.06 },
  };
  Plotly.react('chart', traces, layout, { responsive: true, displayModeBar: false });

  document.getElementById('metricHeader').textContent = metric.label;
  document.getElementById('frontTable').innerHTML = front
    .map((r) => `
      <tr>
        <td>${r.model}</td>
        <td>${r.provider}</td>
        <td>${effortText(r)}</td>
        <td class="num">$${r.cpmi}</td>
        <td class="num">${r.price_output_per_mtok == null ? 'n/a' : '$' + r.price_output_per_mtok}</td>
        <td class="num">${metricValue(r)}</td>
        <td>${r.launch}</td>
      </tr>
    `)
    .join('');
}

async function main() {
  const response = await fetch('./data/models.json');
  const payload = await response.json();
  state.records = payload.records;
  state.years = payload.years;
  initFilters();

  ['year', 'metric', 'maxCost', 'search', 'frontOnly', 'showLabels'].forEach((id) => {
    document.getElementById(id).addEventListener('input', update);
    document.getElementById(id).addEventListener('change', update);
  });

  update();
}

main().catch((err) => {
  document.body.innerHTML = `<pre style="padding:24px; white-space:pre-wrap;">Erreur de chargement: ${err}</pre>`;
});
