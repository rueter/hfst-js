// HFST-JS Web App Client Controller with Multi-Language Support

let pyhfstCore = null; // Loaded dynamically for browser-mode execution
let clientHfst = null; // Client-side Hfst instance for in-browser execution
let currentMode = 'server'; // 'server' | 'browser'
let currentModelId = 'fin_analyser';
let availableModels = [];
let debounceTimer = null;
let lastResults = null;
let showJson = false;

const SAMPLES = {
  fin_analyser: [
    'voi',
    'ihmettelen',
    'kissa',
    'koira',
    'koirani',
    'luutapiiri',
    'luutapiirissanikin',
    'menemme',
    'kirjoittaisitko',
  ],
  fin_generator: [
    'koira+N+Pl+Nom',
    'voida+V+Act+Ind+Prs+Sg1',
    'kissa+N+Sg+Gen',
    'ihmetellä+V+Act+Cond+Prs+Sg2',
    'mennä+V+Act+Ind+Prs+Pl1',
  ],
  myv_analyser: [
    'кудо',
    'кудосо',
    'эрямо',
    'моро',
    'киска',
    'васенце',
    'лов',
    'теште',
    'веле',
  ],
  myv_generator: [
    'кудо+N+Sg+Nom+Indef',
    'кудо+N+SP+Ine+Indef',
    'моро+N+Sg+Nom+Indef',
    'киска+N+Sg+Nom+Indef',
    'васенце+Num+Ord+Sg+Nom+Indef',
  ],
};

// Elements
const wordInput = document.getElementById('wordInput');
const clearBtn = document.getElementById('clearBtn');
const lookupBtn = document.getElementById('lookupBtn');
const modelSelect = document.getElementById('modelSelect');
const sampleChips = document.getElementById('sampleChips');
const resultsList = document.getElementById('resultsList');
const resultsContainer = document.getElementById('resultsContainer');
const emptyState = document.getElementById('emptyState');
const jsonViewer = document.getElementById('jsonViewer');
const resultCount = document.getElementById('resultCount');
const btnToggleJson = document.getElementById('btnToggleJson');
const btnModeServer = document.getElementById('btnModeServer');
const btnModeBrowser = document.getElementById('btnModeBrowser');
const engineLabel = document.getElementById('engineLabel');
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');

// Stats elements
const statLatency = document.getElementById('statLatency');
const statLoadTime = document.getElementById('statLoadTime');
const statWeighted = document.getElementById('statWeighted');
const statSymbols = document.getElementById('statSymbols');
const statIndexSize = document.getElementById('statIndexSize');
const statTransSize = document.getElementById('statTransSize');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadAvailableModels();
  renderSampleChips();
  await updateModelInfo();
});

async function loadAvailableModels() {
  try {
    const res = await fetch('/api/models');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    availableModels = data.models || [];

    // Group models by language
    modelSelect.innerHTML = '';
    const groups = {};
    for (const m of availableModels) {
      const groupName = m.langName || 'Other';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(m);
    }

    for (const [groupName, mList] of Object.entries(groups)) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = groupName;
      for (const m of mList) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.name} [${m.filename}]`;
        optgroup.appendChild(opt);
      }
      modelSelect.appendChild(optgroup);
    }

    // Select first or default to fin_analyser / myv_analyser
    if (availableModels.some((m) => m.id === currentModelId)) {
      modelSelect.value = currentModelId;
    } else if (availableModels.length > 0) {
      currentModelId = availableModels[0].id;
      modelSelect.value = currentModelId;
    }
  } catch (err) {
    console.error('Failed to load available models:', err);
  }
}

function getCurrentModelInfo() {
  return availableModels.find((m) => m.id === currentModelId) || null;
}

function renderSampleChips() {
  sampleChips.innerHTML = '';
  const current = getCurrentModelInfo();

  let samples = SAMPLES[currentModelId];
  if (!samples) {
    if (current && current.type === 'generator') {
      samples = ['lemma+N+Sg+Nom', 'lemma+V+Act+Ind+Prs+Sg3'];
    } else {
      samples = ['test', 'word'];
    }
  }

  // Update input placeholder based on analyser vs generator
  if (current && current.type === 'generator') {
    wordInput.placeholder = 'Type tag sequence to generate (e.g. ' + (samples[0] || 'word+N+Pl+Nom') + ')...';
  } else {
    wordInput.placeholder = 'Type word to analyze (e.g. ' + (samples.slice(0, 3).join(', ') || 'word') + ')...';
  }

  for (const sample of samples) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sample-chip';
    chip.textContent = sample;
    chip.addEventListener('click', () => {
      wordInput.value = sample;
      handleInput();
      triggerLookup();
    });
    sampleChips.appendChild(chip);
  }
}

function setupEventListeners() {
  // Input
  wordInput.addEventListener('input', () => {
    handleInput();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(triggerLookup, 150);
  });

  wordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(debounceTimer);
      triggerLookup();
    }
  });

  clearBtn.addEventListener('click', () => {
    wordInput.value = '';
    handleInput();
    displayResults([], 0);
    wordInput.focus();
  });

  lookupBtn.addEventListener('click', () => {
    clearTimeout(debounceTimer);
    triggerLookup();
  });

  // Model change
  modelSelect.addEventListener('change', async () => {
    currentModelId = modelSelect.value;
    renderSampleChips();
    clientHfst = null; // reset client cache
    await updateModelInfo();
    if (wordInput.value.trim()) {
      triggerLookup();
    }
  });

  // Engine Mode Toggle
  btnModeServer.addEventListener('click', () => setExecutionMode('server'));
  btnModeBrowser.addEventListener('click', () => setExecutionMode('browser'));

  // JSON View Toggle
  btnToggleJson.addEventListener('click', () => {
    showJson = !showJson;
    btnToggleJson.classList.toggle('active', showJson);
    renderResultsView();
  });

  // Custom File Upload
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      await loadCustomFile(file);
    }
  });

  // Drag & drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
      await loadCustomFile(file);
    }
  });
}

function handleInput() {
  clearBtn.style.display = wordInput.value ? 'block' : 'none';
}

async function setExecutionMode(mode) {
  currentMode = mode;
  btnModeServer.classList.toggle('active', mode === 'server');
  btnModeBrowser.classList.toggle('active', mode === 'browser');

  if (mode === 'browser') {
    engineLabel.textContent = 'In-Browser Engine';
    if (!pyhfstCore) {
      statLatency.textContent = 'Loading engine...';
      try {
        pyhfstCore = await import('/src/core.js');
      } catch (err) {
        console.error('Failed to load in-browser engine:', err);
        alert('Failed to load in-browser engine: ' + err.message);
        setExecutionMode('server');
        return;
      }
    }
    await prepareClientModel();
  } else {
    engineLabel.textContent = 'Node.js Server';
    await updateModelInfo();
  }

  if (wordInput.value.trim()) {
    triggerLookup();
  }
}

async function prepareClientModel() {
  statLatency.textContent = 'Loading model...';
  const m = getCurrentModelInfo();
  const filename = m ? m.filename : `${currentModelId}.hfstol`;
  const url = `/models/${filename}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();

    const tParse0 = performance.now();
    clientHfst = pyhfstCore.HfstInputStream.fromBuffer(arrayBuffer).read();
    const tParse1 = performance.now();

    statLoadTime.textContent = `${(tParse1 - tParse0).toFixed(1)} ms (in-browser)`;
    statWeighted.textContent = clientHfst.tr.header.isWeighted() ? 'Yes' : 'No';
    statSymbols.textContent = clientHfst.tr.header.getSymbolCount().toLocaleString();
    statIndexSize.textContent = clientHfst.tr.header.getIndexTableSize().toLocaleString();
    statTransSize.textContent = clientHfst.tr.header.getTargetTableSize().toLocaleString();
    statLatency.textContent = 'Ready';
  } catch (err) {
    console.error('Error loading client model:', err);
    statLatency.textContent = 'Load error';
    alert(`Could not load model in browser: ${err.message}. Falling back to server mode.`);
    setExecutionMode('server');
  }
}

async function loadCustomFile(file) {
  const modelName = file.name.replace(/\.(hfstol|hfst)$/i, '');

  if (currentMode !== 'browser') {
    setExecutionMode('browser');
  }

  statLatency.textContent = 'Parsing file...';
  const t0 = performance.now();
  const arrayBuffer = await file.arrayBuffer();

  if (!pyhfstCore) {
    pyhfstCore = await import('/src/core.js');
  }

  try {
    clientHfst = pyhfstCore.HfstInputStream.fromBuffer(arrayBuffer).read();
    const t1 = performance.now();

    // Add option to model select if not present
    let opt = Array.from(modelSelect.options).find((o) => o.value === modelName);
    if (!opt) {
      opt = document.createElement('option');
      opt.value = modelName;
      opt.textContent = `Custom: ${file.name}`;
      modelSelect.appendChild(opt);
    }
    modelSelect.value = modelName;
    currentModelId = modelName;

    renderSampleChips();
    statLoadTime.textContent = `${(t1 - t0).toFixed(1)} ms (local file)`;
    statWeighted.textContent = clientHfst.tr.header.isWeighted() ? 'Yes' : 'No';
    statSymbols.textContent = clientHfst.tr.header.getSymbolCount().toLocaleString();
    statIndexSize.textContent = clientHfst.tr.header.getIndexTableSize().toLocaleString();
    statTransSize.textContent = clientHfst.tr.header.getTargetTableSize().toLocaleString();
    statLatency.textContent = 'Ready';

    if (wordInput.value.trim()) {
      triggerLookup();
    }
  } catch (err) {
    alert('Error loading custom transducer: ' + err.message);
    statLatency.textContent = 'Error';
  }
}

async function updateModelInfo() {
  if (currentMode === 'browser' && clientHfst) {
    statWeighted.textContent = clientHfst.tr.header.isWeighted() ? 'Yes' : 'No';
    statSymbols.textContent = clientHfst.tr.header.getSymbolCount().toLocaleString();
    statIndexSize.textContent = clientHfst.tr.header.getIndexTableSize().toLocaleString();
    statTransSize.textContent = clientHfst.tr.header.getTargetTableSize().toLocaleString();
    return;
  }

  try {
    const res = await fetch(`/api/info?model=${encodeURIComponent(currentModelId)}`);
    if (!res.ok) return;
    const data = await res.json();
    statLoadTime.textContent = `${data.loadTimeMs.toFixed(1)} ms (server)`;
    statWeighted.textContent = data.header.weighted ? 'Yes' : 'No';
    statSymbols.textContent = data.header.numberOfSymbols.toLocaleString();
    statIndexSize.textContent = data.header.indexTableSize.toLocaleString();
    statTransSize.textContent = data.header.targetTableSize.toLocaleString();
  } catch (err) {
    console.error('Failed to fetch model info:', err);
  }
}

async function triggerLookup() {
  const word = wordInput.value.trim();
  if (!word) {
    displayResults([], 0);
    return;
  }

  if (currentMode === 'browser') {
    if (!clientHfst) {
      await prepareClientModel();
    }
    if (!clientHfst) return;

    const t0 = performance.now();
    const results = clientHfst.lookup(word);
    const t1 = performance.now();
    const latency = t1 - t0;

    displayResults(results, latency);
  } else {
    // Server lookup
    try {
      const res = await fetch(
        `/api/lookup?model=${encodeURIComponent(currentModelId)}&word=${encodeURIComponent(word)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      displayResults(data.results, data.timeMs);
    } catch (err) {
      console.error('Server lookup error:', err);
      statLatency.textContent = 'Error';
    }
  }
}

function displayResults(results, latencyMs) {
  lastResults = results;
  resultCount.textContent = `${results.length} ${results.length === 1 ? 'match' : 'matches'}`;

  if (latencyMs < 1) {
    statLatency.textContent = `${(latencyMs * 1000).toFixed(0)} µs`;
  } else {
    statLatency.textContent = `${latencyMs.toFixed(2)} ms`;
  }

  renderResultsView();
}

function renderResultsView() {
  if (!lastResults || lastResults.length === 0) {
    emptyState.style.display = 'flex';
    resultsList.style.display = 'none';
    jsonViewer.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';

  if (showJson) {
    resultsList.style.display = 'none';
    jsonViewer.style.display = 'block';
    jsonViewer.textContent = JSON.stringify(lastResults, null, 2);
  } else {
    jsonViewer.style.display = 'none';
    resultsList.style.display = 'flex';
    resultsList.innerHTML = '';

    for (const [analysisString, weight] of lastResults) {
      const item = document.createElement('div');
      item.className = 'result-item';

      const main = document.createElement('div');
      main.className = 'result-main';

      // Parse tags (tokens starting with +)
      const parts = analysisString.split(/(?=\+)/);
      if (parts.length > 0) {
        const lemma = document.createElement('span');
        lemma.className = 'result-lemma';
        lemma.textContent = parts[0];
        main.appendChild(lemma);

        for (let i = 1; i < parts.length; i++) {
          const tag = document.createElement('span');
          tag.className = 'result-tag';
          if (['+V', '+N', '+A', '+Adv', '+Pron', '+Num', '+Pcle', '+Interj'].includes(parts[i])) {
            tag.classList.add('pos');
          }
          tag.textContent = parts[i];
          main.appendChild(tag);
        }
      } else {
        main.textContent = analysisString;
      }

      const weightEl = document.createElement('div');
      weightEl.className = 'result-weight';
      weightEl.textContent = `w: ${weight}`;

      item.appendChild(main);
      item.appendChild(weightEl);
      resultsList.appendChild(item);
    }
  }
}
