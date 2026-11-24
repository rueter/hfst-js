import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { HfstInputStream, getTransducer } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(__dirname, 'public');
const modelsDir = path.join(rootDir, 'models');

const PORT = parseInt(process.env.PORT || '3000', 10);

// In-memory cache of loaded server-side transducers
const loadedModels = new Map();

const intlLanguageNames = new Intl.DisplayNames(['en'], { type: 'language' });

function getLanguageDisplayName(code) {
  try {
    const name = intlLanguageNames.of(code);
    if (name && name.toLowerCase() !== code.toLowerCase()) {
      return name;
    }
  } catch {}
  return code.toUpperCase();
}

/**
 * Scans the models directory and returns a structured list of available models.
 */
function scanAvailableModels() {
  const models = [];
  const searchDirs = [modelsDir, '/tmp/pyhfst_repo'];

  const seenIds = new Set();

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;

    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (!entry.endsWith('.hfstol') && !entry.endsWith('.hfst')) {
        // Special case for un-suffixed test files in /tmp/pyhfst_repo
        if (dir === '/tmp/pyhfst_repo' && (entry === 'analyser' || entry === 'generator-norm')) {
          const id = entry === 'analyser' ? 'fin_analyser' : 'fin_generator';
          if (!seenIds.has(id)) {
            seenIds.add(id);
            models.push({
              id,
              lang: 'fin',
              langName: 'Finnish',
              type: entry === 'analyser' ? 'analyser' : 'generator',
              typeName: entry === 'analyser' ? 'Morphological Analyser' : 'Morphological Generator',
              name: `Finnish (${id})`,
              filename: entry,
              filePath: path.join(dir, entry),
            });
          }
        }
        continue;
      }

      const basename = entry.replace(/\.(hfstol|hfst)$/i, '');
      const id = basename;
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const filePath = path.join(dir, entry);
      const match = basename.match(/^([a-z]{2,3})_(analyser|analyzer|generator|norm|lexc|lookup|morph)(.*)$/i);

      if (match) {
        const langCode = match[1].toLowerCase();
        const rawType = match[2].toLowerCase();
        const typeSuffix = match[3] || '';
        const langName = getLanguageDisplayName(langCode);

        let typeName = 'Transducer';
        let category = 'custom';
        if (rawType.startsWith('analys')) {
          typeName = 'Morphological Analyser';
          category = 'analyser';
        } else if (rawType.startsWith('generat')) {
          typeName = 'Morphological Generator';
          category = 'generator';
        }

        if (typeSuffix) {
          typeName += ` (${typeSuffix.replace(/^[_-]/, '')})`;
        }

        models.push({
          id,
          lang: langCode,
          langName,
          type: category,
          typeName,
          name: `${langName} (${langCode}) ${typeName}`,
          filename: entry,
          filePath,
        });
      } else {
        // Generic / custom model
        models.push({
          id,
          lang: 'other',
          langName: 'Other',
          type: 'custom',
          typeName: basename,
          name: `Custom: ${basename}`,
          filename: entry,
          filePath,
        });
      }
    }
  }

  // Sort by language name then type
  models.sort((a, b) => {
    if (a.langName !== b.langName) return a.langName.localeCompare(b.langName);
    return a.typeName.localeCompare(b.typeName);
  });

  return models;
}

function resolveModelFilePath(modelKey) {
  const models = scanAvailableModels();

  // 1. Direct match by id
  const direct = models.find((m) => m.id === modelKey || m.filename === modelKey);
  if (direct) return direct.filePath;

  // 2. Compatibility fallback: 'analyser' -> 'fin_analyser', 'generator' -> 'fin_generator'
  if (modelKey === 'analyser') {
    const fin = models.find((m) => m.id === 'fin_analyser') || models.find((m) => m.type === 'analyser');
    if (fin) return fin.filePath;
  }
  if (modelKey === 'generator') {
    const fin = models.find((m) => m.id === 'fin_generator') || models.find((m) => m.type === 'generator');
    if (fin) return fin.filePath;
  }

  // 3. Check direct path in modelsDir
  const candidate = path.join(modelsDir, modelKey.endsWith('.hfstol') ? modelKey : `${modelKey}.hfstol`);
  if (fs.existsSync(candidate)) return candidate;

  return null;
}

function getOrLoadModel(modelKey) {
  if (loadedModels.has(modelKey)) {
    return loadedModels.get(modelKey);
  }

  const modelFile = resolveModelFilePath(modelKey);
  if (!modelFile || !fs.existsSync(modelFile)) {
    throw new Error(`Model "${modelKey}" not found. Available models: ${scanAvailableModels().map(m => m.id).join(', ')}`);
  }

  const t0 = performance.now();
  const inputStream = new HfstInputStream(modelFile);
  const hfst = inputStream.read();
  const t1 = performance.now();

  const info = {
    key: modelKey,
    filePath: modelFile,
    fileSize: fs.statSync(modelFile).size,
    loadTimeMs: t1 - t0,
    hfst,
    header: {
      numberOfSymbols: hfst.tr.header.getSymbolCount(),
      numberOfInputSymbols: hfst.tr.header.getInputSymbolCount(),
      indexTableSize: hfst.tr.header.getIndexTableSize(),
      targetTableSize: hfst.tr.header.getTargetTableSize(),
      weighted: hfst.tr.header.isWeighted(),
      hasHfst3Header: hfst.tr.header.hasHfst3Header(),
      features: hfst.tr.alphabet.features,
    },
  };

  loadedModels.set(modelKey, info);
  return info;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.hfstol': 'application/octet-stream',
  '.hfst': 'application/octet-stream',
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API: List Available Models ---
  if (pathname === '/api/models' && req.method === 'GET') {
    const available = scanAvailableModels();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ models: available }));
    return;
  }

  // --- API: Model Info ---
  if (pathname === '/api/info' && req.method === 'GET') {
    const modelKey = parsedUrl.searchParams.get('model') || 'fin_analyser';
    try {
      const model = getOrLoadModel(modelKey);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          key: model.key,
          fileSize: model.fileSize,
          loadTimeMs: model.loadTimeMs,
          header: model.header,
        })
      );
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // --- API: Perform Lookup ---
  if (pathname === '/api/lookup') {
    let modelKey = 'fin_analyser';
    let word = '';
    let timeCutoff = 0.0;

    if (req.method === 'GET') {
      modelKey = parsedUrl.searchParams.get('model') || 'fin_analyser';
      word = parsedUrl.searchParams.get('word') || '';
      timeCutoff = parseFloat(parsedUrl.searchParams.get('time_cutoff') || '0');
    } else if (req.method === 'POST') {
      try {
        const bodyText = await readRequestBody(req);
        const body = JSON.parse(bodyText);
        modelKey = body.model || 'fin_analyser';
        word = body.word || '';
        timeCutoff = parseFloat(body.timeCutoff || body.time_cutoff || '0');
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON request body' }));
        return;
      }
    }

    if (!word) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ word: '', results: [], count: 0, timeMs: 0 }));
      return;
    }

    try {
      const model = getOrLoadModel(modelKey);
      const t0 = performance.now();
      const results = model.hfst.lookup(word, timeCutoff);
      const t1 = performance.now();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          word,
          model: modelKey,
          results,
          count: results.length,
          timeMs: t1 - t0,
        })
      );
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // --- API: Upload Model ---
  if (pathname === '/api/upload' && req.method === 'POST') {
    try {
      const filename = parsedUrl.searchParams.get('name') || `model-${Date.now()}`;
      const safeName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const ext = safeName.endsWith('.hfstol') || safeName.endsWith('.hfst') ? '' : '.hfstol';
      const targetFilename = `${safeName}${ext}`;

      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true });
      }
      const targetPath = path.join(modelsDir, targetFilename);
      fs.writeFileSync(targetPath, buffer);

      // Verify and preload
      const t0 = performance.now();
      const tr = getTransducer(buffer);
      const t1 = performance.now();

      const id = targetFilename.replace(/\.(hfstol|hfst)$/i, '');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          id,
          filename: targetFilename,
          size: buffer.length,
          parseTimeMs: t1 - t0,
          header: {
            symbols: tr.header.getSymbolCount(),
            weighted: tr.header.isWeighted(),
          },
        })
      );
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Upload failed: ${err.message}` }));
    }
    return;
  }

  // --- Serve Transducer Binary (for in-browser client testing) ---
  if (pathname.startsWith('/models/')) {
    const filename = pathname.replace('/models/', '');
    let filePath = path.join(modelsDir, filename);

    if (!fs.existsSync(filePath)) {
      // Check if mapped by ID
      const resolved = resolveModelFilePath(filename);
      if (resolved && fs.existsSync(resolved)) {
        filePath = resolved;
      }
    }

    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': stat.size,
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // --- Serve Library Source for in-browser ES Module import ---
  if (pathname.startsWith('/src/')) {
    const relativePath = pathname.replace('/src/', '');
    const srcFilePath = path.join(rootDir, 'src', relativePath);
    if (fs.existsSync(srcFilePath) && fs.statSync(srcFilePath).isFile()) {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      fs.createReadStream(srcFilePath).pipe(res);
      return;
    }
  }

  // --- Static Files (publicDir) ---
  let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(publicDir, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 HFST-JS Web App running at: http://localhost:${PORT}`);
  console.log(`   Discovered models in ${modelsDir}:`);
  for (const m of scanAvailableModels()) {
    console.log(`   • [${m.id}] ${m.name}`);
  }
  console.log(`======================================================\n`);
});
