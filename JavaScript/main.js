var debugMode = false; // ★ デバッグモードの状態

var KMAX = 32;
var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
var spec = document.getElementById('spec');
var sctx = spec.getContext('2d');

var phase = 0;
var anim = false;
var last = 0;
var showUpper = true;

var amps = [];
for (var i = 0; i < KMAX; i++) amps.push(0);

var masterVol = 0.3;

var audioCtx = null;
var osc = null;
var masterGain = null;
var playing = false;

// ★ 初期音を B♭ に（234.14Hz）
var baseFreq = 234.14;
// A4 基準
var A4 = 442;

var currentNoteBtn = null;

function highlightButton(btn) {
  if (currentNoteBtn) {
    currentNoteBtn.style.background = "#238636"; // 元の緑
  }
  btn.style.background = "#005cc5"; // 青
  currentNoteBtn = btn;
}

/* ---------- 描画 ---------- */
function drawWave() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var W = canvas.width, H = canvas.height;
  var mid = H / 2;

  var maxAmp = 0;
  for (var i = 0; i <= W - 60; i++) {
    var t = i / (W - 60) * 2 * Math.PI;
    var y = 0;
    for (var k = 1; k <= KMAX; k++) {
      y += amps[k - 1] * masterVol * Math.sin(k * t + phase);
    }
    maxAmp = Math.max(maxAmp, Math.abs(y));
  }
  if (maxAmp < 1e-6) maxAmp = 1;

  var scale = (H * 0.45) / maxAmp;

  ctx.strokeStyle = '#444';
  ctx.beginPath();
  ctx.moveTo(40, mid);
  ctx.lineTo(W - 10, mid);
  ctx.stroke();

  for (var k = 1; k <= KMAX; k++) {
    var A = amps[k - 1] * masterVol;
    if (!A) continue;
    ctx.strokeStyle = 'rgba(88,166,255,0.25)';
    ctx.beginPath();
    for (var i = 0; i <= W - 60; i++) {
      var t = i / (W - 60) * 2 * Math.PI;
      var y = A * Math.sin(k * t + phase);
      var px = 40 + i;
      var py = mid - y * scale;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = '#58a6ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (var i = 0; i <= W - 60; i++) {
    var t = i / (W - 60) * 2 * Math.PI;
    var y = 0;
    for (var k = 1; k <= KMAX; k++) {
      y += amps[k - 1] * masterVol * Math.sin(k * t + phase);
    }
    var px = 40 + i;
    var py = mid - y * scale;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
}

function drawBars() {
  sctx.clearRect(0, 0, spec.width, spec.height);

  var W = spec.width;
  var H = showUpper ? 320 : 170;
  spec.height = H;

  var gap = showUpper ? 30 : 0;
  var rowHeight = showUpper ? (H - gap) / 2 : H;

  for (var k = 1; k <= KMAX; k++) {
    if (!showUpper && k > 16) continue;
    var row = (k <= 16) ? 0 : 1;
    var localK = (k <= 16) ? k : (k - 16);

    var rowTop = row * (rowHeight + gap);

    var x = (localK - 0.5) * W / 16;
    var h = amps[k - 1] * (rowHeight - 40);

    sctx.fillStyle = '#58a6ff';
    sctx.fillRect(x - 14, rowTop + rowHeight - h - 20, 28, h);
    sctx.fillStyle = '#e6edf3';
    sctx.font = '12px sans-serif';
    sctx.textAlign = 'center';
    sctx.fillText('N=' + k, x, rowTop + rowHeight - 6);
  }
}

function drawAll() { drawWave(); drawBars(); }

/* ---------- 棒グラフ スライド操作 ---------- */
function setAmpFromPos(clientX, clientY) {
  var rect = spec.getBoundingClientRect();
  var x = clientX - rect.left;
  var y = clientY - rect.top;

  if (x < 0 || x > rect.width) return;
  var gap = showUpper ? 30 : 0;
  var rowHeight = showUpper ? (rect.height - gap) / 2 : rect.height;

  var row = showUpper ? ((y < rowHeight) ? 0 : 1) : 0;
  var localY = row === 0 ? y : (y - rowHeight - gap);

  var localK = Math.floor(x / rect.width * 16);
  var k = row * 16 + localK;

  if (!showUpper && k >= 16) return;
  if (k < 0 || k >= KMAX) return;

  var localHeight = localY;

  var A = Math.max(0, Math.min(1,
    (rowHeight - localHeight - 20) / (rowHeight - 40)
  ));
  amps[k] = A;
  updateGain(k);
  drawAll();

  // ★ 数値入力欄が開いているときだけ同期する
  if (!document.getElementById('inputArea').classList.contains('hidden')) {
    buildInputList();
  }
}


var dragging = false;

spec.addEventListener('mousedown', function(e) {
  dragging = true;
  setAmpFromPos(e.clientX, e.clientY);
});

spec.addEventListener('mousemove', function(e) {
  if (dragging) setAmpFromPos(e.clientX, e.clientY);
});

window.addEventListener('mouseup', function() {
  dragging = false;
});

spec.addEventListener('touchstart', function(e) {
  dragging = true;
  var t = e.touches[0];
  setAmpFromPos(t.clientX, t.clientY);
  e.preventDefault();
}, { passive:false });

spec.addEventListener('touchmove', function(e) {
  if (!dragging) return;
  var t = e.touches[0];
  setAmpFromPos(t.clientX, t.clientY);
  e.preventDefault();
}, { passive:false });

window.addEventListener('touchend', function() {
  dragging = false;
});

/* ---------- アニメ ---------- */
function loop(t) {
  if (!anim) return;
  if (!last) last = t;
  phase += (t - last) / 1000;
  last = t;
  drawAll();
  requestAnimationFrame(loop);
}
function toggleUpperHarmonics() {
  showUpper = !showUpper;
  drawAll();
}

/* ---------- 音声 ---------- */
function startAudio() {
  if (playing) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  var real = new Float32Array(KMAX + 1);
  var imag = new Float32Array(KMAX + 1);

  for (var k = 1; k <= KMAX; k++) {
    imag[k] = amps[k - 1];
  }

  var maxAmp = 0;
  for (var t = 0; t < 2048; t++) {
    var ph = t / 2048 * 2 * Math.PI;
    var y = 0;
    for (var k = 1; k <= KMAX; k++) {
      y += amps[k - 1] * Math.sin(k * ph);
    }
    maxAmp = Math.max(maxAmp, Math.abs(y));
  }
  if (maxAmp < 1e-6) maxAmp = 1;

  var wave = audioCtx.createPeriodicWave(real, imag, {
    disableNormalization: true
  });

  osc = audioCtx.createOscillator();
  osc.setPeriodicWave(wave);
  osc.frequency.value = baseFreq;

  masterGain = audioCtx.createGain();
  masterGain.gain.value = masterVol / maxAmp;

  osc.connect(masterGain);
  masterGain.connect(audioCtx.destination);

  osc.start(audioCtx.currentTime);

  playing = true;
  updatePlayButtons();
}

function stopAudio() {
  if (!playing) return;

  if (osc) osc.stop();
  audioCtx.close();

  osc = null;
  masterGain = null;
  playing = false;
  updatePlayButtons();
}

var playBtn = document.querySelector("button[onclick='startAudio()']");
var stopBtn = document.querySelector("button[onclick='stopAudio()']");

function updatePlayButtons() {
  if (playing) {
    playBtn.style.background = "#005cc5"; // 青
    stopBtn.style.background = "#238636"; // 緑
  } else {
    playBtn.style.background = "#238636";
    stopBtn.style.background = "#005cc5";
  }
}


function rebuildWave() {
  if (!playing || !osc) return;

  var real = new Float32Array(KMAX + 1);
  var imag = new Float32Array(KMAX + 1);

  for (var k = 1; k <= KMAX; k++) {
    imag[k] = amps[k - 1];
  }

  var maxAmp = 0;
  for (var t = 0; t < 1024; t++) {
    var ph = t / 1024 * 2 * Math.PI;
    var y = 0;
    for (var k = 1; k <= KMAX; k++) {
      y += amps[k - 1] * Math.sin(k * ph);
    }
    maxAmp = Math.max(maxAmp, Math.abs(y));
  }
  if (maxAmp < 1e-6) maxAmp = 1;

  var wave = audioCtx.createPeriodicWave(real, imag, {
    disableNormalization: true
  });

  osc.setPeriodicWave(wave);
  masterGain.gain.setValueAtTime(
    masterVol / maxAmp,
    audioCtx.currentTime
  );
}

function updateGain(i) {
  rebuildWave();
}

function setMaster(v) {
  masterVol = v;

  if (playing && masterGain) {
    rebuildWave();
  }

  drawAll();
}

function setBaseFreq(v) {
  baseFreq = v;

  var input = document.getElementById('baseFreqInput');
  if (input) input.value = Math.round(baseFreq * 100) / 100;

  if (!playing) return;
  if (playing && osc) {
    osc.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
  }
}

function setA4(v) {
  A4 = v;
}

function octaveUp() {
  setBaseFreq(baseFreq * 2);
}

function octaveDown() {
  setBaseFreq(baseFreq / 2);
}

/* ---------- 音階ボタン ---------- */
var NOTES = [
  ['C', -9],
  ['C#/Db', -8],
  ['D', -7],
  ['D#/Eb', -6],
  ['E', -5],
  ['F', -4],
  ['F#/Gb', -3],
  ['G', -2],
  ['G#/Ab', -1],
  ['A', 0],
  ['Bb', 1],
  ['B/Cb', 2]
];

function noteFreq(semi) {
  return A4 * Math.pow(2, semi / 12);
}

function setNearestNote(semi) {
  var f = noteFreq(semi);

  while (f < baseFreq / Math.sqrt(2)) f *= 2;
  while (f > baseFreq * Math.sqrt(2)) f /= 2;

  setBaseFreq(f);
}

function initNoteButtons() {
  var div = document.getElementById('noteButtons');
  for (var i = 0; i < NOTES.length; i++) {
    (function() {
      var idx = i;
      var b = document.createElement('button');
      b.innerHTML = NOTES[idx][0];
      b.onclick = function() {
        setNearestNote(NOTES[idx][1]);
        highlightButton(b);
      };
      div.appendChild(b);
    })();
  }
}

/* ---------- プリセット（読み込み専用） ---------- */
var PRESETS = [
  {
    name: '基本B♭（基音のみ）',
    baseFreq: 233.08,
    activeHarmonics: [1]
  },
  {
    name: '倍音リッチ（1〜4倍音）',
    baseFreq: 233.08,
    activeHarmonics: [1, 2, 3, 4]
  },
  {
    name: '高次倍音強め（5〜8倍音）',
    baseFreq: 233.08,
    activeHarmonics: [5, 6, 7, 8]
  }
];

function applyPreset(preset) {
  setBaseFreq(preset.baseFreq);

  for (var k = 0; k < KMAX; k++) amps[k] = 0;
  for (var i = 0; i < preset.activeHarmonics.length; i++) {
    var n = preset.activeHarmonics[i];
    if (n >= 1 && n <= KMAX) {
      amps[n - 1] = 1 / n;
    }
  }

  rebuildWave();
  drawAll();
}

function initPresets() {
  var menu = document.getElementById('slotMenu');
  var btn = document.getElementById('slotMenuBtn');

  PRESETS.forEach(function(p) {
    var b = document.createElement('button');
    b.textContent = p.name;
    b.onclick = function() { applyPreset(p); };
    b.style.background = "#6f42c1"; // 紫
    menu.appendChild(b);
  });

  btn.onclick = function() {
    menu.classList.toggle('open');
  };
}

/* ---------- 数値入力モード（一覧表示） ---------- */
function buildInputList() {
  var area = document.getElementById('inputArea');
  area.innerHTML = '';

  // showUpper が true → 1〜32
  // showUpper が false → 1〜16
  var maxN = showUpper ? 32 : 16;

  for (var n = 1; n <= maxN; n++) {
    var row = document.createElement('div');
    row.className = 'nRow';

    var label = document.createElement('label');
    label.textContent = 'N=' + n;

    var input = document.createElement('input');
    input.type = 'number';
    input.min = 0;
    input.max = 100;
    input.value = Math.round(amps[n - 1] * 100);

    // 入力したら即反映
    input.oninput = (function(n) {
      return function(e) {
        var v = Math.max(0, Math.min(100, +e.target.value));
        amps[n - 1] = v / 100;
        updateGain(n - 1);
        drawAll();
      };
    })(n);

    // ★ クリックしたら値を消して0にする（トグル式）
    input.onclick = function() {
      input.value = "";
      amps[n - 1] = 0;
      updateGain(n - 1);
      drawAll();
    };


    row.appendChild(label);
    row.appendChild(input);
    area.appendChild(row);
  }
}

function toggleInputArea() {
  var area = document.getElementById('inputArea');
  area.classList.toggle('hidden');

  // 開いたときに一覧を生成
  if (!area.classList.contains('hidden')) {
    buildInputList();
  }
}

/* ---------- 初期化 ---------- */
function initUI() {
  initNoteButtons();
  initPresets();

  var toggleBtn = document.getElementById('toggleInput');

  if (toggleBtn) toggleBtn.onclick = toggleInputArea;

  setBaseFreq(baseFreq);
  drawAll();
}

initUI();

document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.key.toLowerCase() === 'b'){
    var pass = prompt("拡張モードのパスワードを入力してください:");
    if (pass === "huku798081") { // ★ 好きなパスワードに変更OK
      debugMode = true;
      alert("拡張モードが有効になりました！");
      updateDebugUI();
    } else {
      alert("パスワードが違います");
    }
  }
});

function updateDebugUI() {
  // ★ 32〜64倍音の表示切り替え
  if (debugMode) {
    showUpper = true;
    KMAX = 64;
  } else {
    showUpper = true;
    KMAX = 32;
  }

  // ★ 基本周波数入力欄を表示/非表示
  var baseFreqBox = document.getElementById("baseFreqBox");
  if (baseFreqBox) {
    baseFreqBox.style.display = debugMode ? "block" : "none";
  }

  // ★ ピッチ基準入力欄を表示/非表示
  var pitchBox = document.getElementById("pitchBox");
  if (pitchBox) {
    pitchBox.style.display = debugMode ? "block" : "none";
  }

  // ★ プリセット編集ボタンを表示/非表示
  var presetEditBox = document.getElementById("presetEditBox");
  if (presetEditBox) {
    presetEditBox.style.display = debugMode ? "block" : "none";
  }

  drawAll();
}

