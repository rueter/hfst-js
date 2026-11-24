# hfst-js (pyhfst for JavaScript)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

A high-performance, pure JavaScript / TypeScript implementation of **HFST** (Helsinki Finite-State Technology) optimized lookup transducers (`.hfstol` format), rewritten from the Python [**pyhfst**](https://pypi.org/project/pyhfst/) library.

- **Zero dependencies**: No C/C++ binaries, no native bindings, no WebAssembly build steps required.
- **Universal**: Runs seamlessly in **Node.js**, **modern browsers**, **Web Workers**, **Deno**, and **Bun**.
- **Full HFST support**: Supports both **weighted** and **unweighted** transducers, flag diacritic operations (`@P@`, `@N@`, `@R@`, `@D@`, `@C@`, `@U@`), epsilon transitions, and time cutoffs.
- **Ultra-fast**: Powered by typed arrays (`Uint16Array`, `Uint32Array`, `Float32Array`, `DataView`) for instant loading (~20ms for 25MB FST files) and microsecond-level cached lookups.
- **100% API Compatibility**: Drop-in compatible with `pyhfst` in Python. Supports both `camelCase` and `snake_case` methods and properties.

---

## Installation

```bash
npm install hfst-js
```

---

## Usage

### 1. Node.js (ES Modules)

```javascript
import pyhfst, { HfstInputStream } from 'hfst-js';

// Open transducer file
const inputStream = new HfstInputStream('./analyser.hfstol');
const tr = inputStream.read();

// Lookup morphological analysis
const analyses = tr.lookup('voi');
console.log(analyses);
// Output:
// [
//   ['voida+V+Act+Ind+Prs+Sg3', 0.0],
//   ['voida+V+Act+Ind+Prs+ConNeg', 0.0],
//   ['voida+V+Act+Ind+Prt+Sg3', 0.0],
//   ['voida+V+Act+Imprt+Prs+ConNeg+Sg2', 0.0],
//   ['voida+V+Act+Imprt+Sg2', 0.0],
//   ['voi+N+Sg+Nom', 0.0],
//   ['voi+Pcle', 0.0],
//   ['voi+Interj', 0.0]
// ]
```

### 2. Node.js (CommonJS)

```javascript
const { HfstInputStream } = require('hfst-js');

const tr = new HfstInputStream('./analyser.hfstol').read();
console.log(tr.lookup('kissa'));
// [['kissa+N+Sg+Nom', 0.0]]
```

### 3. Browser & Web Workers (fetch / ArrayBuffer)

```javascript
import { HfstInputStream } from 'hfst-js';

// Fetch transducer binary over HTTP:
const tr = await HfstInputStream.fromUrl('https://example.com/analyser.hfstol');

// Or initialize from an ArrayBuffer / Uint8Array:
// const tr = HfstInputStream.fromBuffer(arrayBuffer).read();

console.log(tr.lookup('koirani'));
// [
//   ['koi+N+Sg+Nom+Cmp#rani+N+Sg+Nom', 0.0],
//   ['koira+N+Sg+Nom+PxSg1', 0.0],
//   ['koira+N+Sg+Gen+PxSg1', 0.0],
//   ['koira+N+Pl+Nom+PxSg1', 0.0]
// ]
```

---

## API Comparison: Python `pyhfst` vs JavaScript `hfst-js`

| Feature | Python (`pyhfst`) | JavaScript (`hfst-js`) |
| :--- | :--- | :--- |
| **Import** | `import pyhfst` | `import pyhfst from 'hfst-js'` |
| **Open stream** | `stream = pyhfst.HfstInputStream("file")` | `stream = new HfstInputStream("file")` |
| **From Buffer** | N/A | `HfstInputStream.fromBuffer(buf)` |
| **From URL (Browser)** | N/A | `await HfstInputStream.fromUrl(url)` |
| **Read transducer** | `tr = stream.read()` | `tr = stream.read()` |
| **Lookup** | `tr.lookup("word")` | `tr.lookup("word")` |
| **Time cutoff** | `tr.lookup("word", time_cutoff=0.01)` | `tr.lookup("word", 0.01)` |
| **Disable cache** | `HfstInputStream("file", cache=False)` | `new HfstInputStream("file", false)` |
| **Direct loader** | `tr = pyhfst.get_transducer("file")` | `tr = getTransducer("file")` |

---

## API Reference

### `HfstInputStream`

- `new HfstInputStream(pathOrBuffer, cache = true)`
  - `pathOrBuffer`: File path (string) or binary buffer (`Buffer`, `Uint8Array`, or `ArrayBuffer`).
  - `cache`: Boolean, whether to cache lookup results (default: `true`).
- `read(): Hfst`
  - Parses the transducer and returns an `Hfst` wrapper instance.
- `HfstInputStream.fromFile(path, cache = true): HfstInputStream`
- `HfstInputStream.fromBuffer(buffer, cache = true): HfstInputStream`
- `HfstInputStream.fromUrl(url, options?): Promise<Hfst>`
- `HfstInputStream.fromFileAsync(path, cache = true): Promise<Hfst>`

### `Hfst`

- `lookup(string, timeCutoff = 0.0): Array<[string, number]>`
  - Performs lookup and returns an array of `[analysisString, weight]` pairs.
  - `timeCutoff`: Maximum lookup time in seconds (`0.0` means no limit).
- `lookupResults(string, timeCutoff = 0.0): Result[]`
  - Returns raw `Result` objects containing individual symbols.
- `tr`: Underlying `Transducer` instance.
- `cache`: Boolean caching flag.

### `Result`

- `getSymbols()`, `get_symbols()`: Returns `string[]` array of output symbols.
- `getWeight()`, `get_weight()`: Returns `number` weight.
- `toString()`, `__str__()`: Formats as `"symbols: weight"`.

### `Transducer`

- Represents the compiled finite state transducer.
- `header`: `TransducerHeader`
- `alphabet`: `TransducerAlphabet`
- `indexTable`: `IndexTable`
- `transitionTable`: `TransitionTable`
- `isWeighted`: Boolean flag

### Low-level Classes & Utilities

- `ByteArray`: Emulates `pyhfst.byte_array.ByteArray`.
- `BinaryReader`: High-speed binary reader over `DataView`.
- `FlagDiacriticOperator`: Enum mapping (`P: 0`, `N: 1`, `R: 2`, `D: 3`, `C: 4`, `U: 5`).
- `FlagDiacriticOperation`: Represents individual flag operations.
- `TRANSITION_TARGET_TABLE_START` (`2147483648`), `INFINITE_WEIGHT`, `NO_SYMBOL_NUMBER` (`65535`), `NO_TABLE_INDEX` (`4294967295`).

---

## Performance

Tested on macOS (Apple Silicon, Node.js v26):

| Operation | Model Size | Time |
| :--- | :--- | :--- |
| **Binary Load & Parse** | 25.6 MB (`analyser.hfstol`) | **~23 ms** |
| **Uncached Complex Lookup** | Compound Finnish words (10+ transitions) | **~0.24 ms** |
| **Cached Lookup** | Common words | **~0.004 ms** (4 µs) |

---

## Citations & Acknowledgments

This package is a rewrite of the original Python `pyhfst` library by Khalid Alnajjar and Mika Hämäläinen:

```bibtex
@article{pyhfst_2023, 
    title={PyHFST: A Pure Python Implementation of HFST},
    author={Alnajjar, Khalid and H{\"a}m{\"a}l{\"a}inen, Mika},
    booktitle={Lightning Proceedings of NLP4DH and IWCLUL 2023},
    pages={32--35},
    year={2023} 
}
```
## CITE

Jack Rueter & Olga Erina, hfst-js


## License

[Apache License 2.0](LICENCE)
