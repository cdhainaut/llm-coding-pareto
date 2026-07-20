const state = {
  records: [],
  filtered: [],
  years: [],
  providerSet: [],
  reasoningSet: [],
  selectedProviders: new Set(),
  selectedReasoning: new Set(),
};

function paretoFront(records) {
  const ordered = [...records].sort((a, b) => a.cpmi - b.cpmi || b.coding - a.coding);
  const out = [];
  let best = -Infinity;
  for (const row of ordered) {
    if (row.coding > best) {
      out.push(row);
      best = row.coding;
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

function initFilters() {
  const providerSelect = document.getElementById('provider');
  const reasoningSelect = document.getElementById('reasoning');
  state.providerSet = uniqueSorted(state.records.map((r) => r.provider));
  state.reasoningSet = uniqueSorted(state.records.map((r) => r.reasoning));
  state.selectedProviders = new Set(state.providerSet);
  state.selectedReasoning = new Set(state.reasoningSet);

  providerSelect.innerHTML = state.providerSet
    .map((p) => `<option value="${p}" selected>${p}</option>`)
    .join('');
  reasoningSelect.innerHTML = state.reasoningSet
    .map((r) => `<option value="${r}" selected>${r}</option>`)
    .join('');

  providerSelect.addEventListener('change', () => {
    state.selectedProviders = new Set(selectedValues(providerSelect));
    update();
  });
  reasoningSelect.addEventListener('change', () => {
    state.selectedReasoning = new Set(selectedValues(reasoningSelect));
    update();
  });
}

function filteredRecords() {
  const year = Number(document.getElementById('year').value);
  const maxCost = Number(document.getElementById('maxCost').value || 80);
  const search = document.getElementById('search').value.trim().toLowerCase();
  return activeForYear(state.records, year)
    .filter((r) => state.selectedProviders.has(r.provider))
    .filter((r) => state.selectedReasoning.has(r.reasoning))
    .filter((r) => r.cpmi <= maxCost)
    .filter((r) => !search || r.model.toLowerCase().includes(search));
}

function traceFor(rows, name, marker, extra = {}) {
  return {
    x: rows.map((r) => r.cpmi),
    y: rows.map((r) => r.coding),
    text: rows.map((r) => `${r.model}<br>${r.provider}<br>${r.reasoning}`),
    mode: 'markers',
    name,
    marker,
    hovertemplate:
      '<b>%{text}</b><br>$%{x:.3g}/M input tokens<br>coding Elo %{y:.0f}<extra></extra>',
    ...extra,
  };
}

function update() {
  const year = document.getElementById('year').value;
  document.getElementById('yearLabel').textContent = year;
  const rows = filteredRecords();
  const front = paretoFront(rows);
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
    traces.push(traceFor(others, 'modèles', {
      size: 8,
      color: 'rgba(100,116,139,0.48)',
      line: { width: 0 },
    }));
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

  const layout = {
    title: `Coût vs coding Elo — ${year}`,
    margin: { l: 70, r: 30, t: 55, b: 60 },
    xaxis: {
      title: 'coût input API — USD / million tokens (log)',
      type: 'log',
      gridcolor: '#e5e7eb',
      tickprefix: '$',
    },
    yaxis: {
      title: 'coding Elo — LMArena',
      range: [1080, 1600],
      gridcolor: '#e5e7eb',
    },
    paper_bgcolor: 'white',
    plot_bgcolor: '#fbfbfb',
    legend: { x: 0.78, y: 0.06 },
  };
  Plotly.react('chart', traces, layout, { responsive: true, displayModeBar: false });

  const tbody = document.getElementById('frontTable');
  tbody.innerHTML = front
    .map((r) => `
      <tr>
        <td>${r.model}</td>
        <td>${r.provider}</td>
        <td>${r.reasoning}</td>
        <td class="num">$${r.cpmi}</td>
        <td class="num">${r.coding}</td>
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

  ['year', 'maxCost', 'search', 'frontOnly'].forEach((id) => {
    document.getElementById(id).addEventListener('input', update);
    document.getElementById(id).addEventListener('change', update);
  });

  update();
}

main().catch((err) => {
  document.body.innerHTML = `<pre style="padding:24px; white-space:pre-wrap;">Erreur de chargement: ${err}</pre>`;
});
