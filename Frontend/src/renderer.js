// ═══════════════════════════════════════════
// СТАН
// ═══════════════════════════════════════════
var dictionary = [];
var currentIndex = 0;
var capturedDataURL = null;
var currentHotkey = 'Ctrl+Shift+T';
var isRecordingHotkey = false;
let url = "";

// ═══════════════════════════════════════════
// ВКЛАДКИ
// ═══════════════════════════════════════════
document.querySelectorAll('.tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
    tab.classList.add('active');
    document.getElementById('panel-' + tab.getAttribute('data-panel')).classList.add('active');
    if (tab.getAttribute('data-panel') === 'cards') renderStudyView();
  });
});

// ═══════════════════════════════════════════
// КНОПКИ ВІКНА
// ═══════════════════════════════════════════
document.getElementById('btnMinimize').addEventListener('click', function() {
  if (window.electronAPI) window.electronAPI.minimize();
});
document.getElementById('btnClose').addEventListener('click', function() {
  if (window.electronAPI) window.electronAPI.close();
});

// ═══════════════════════════════════════════
// ПЕРЕКЛАД
// ═══════════════════════════════════════════
async function googleTranslate(text, tl, sl) {
  sl = sl || 'auto';
  var url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + sl + '&tl=' + tl + '&dt=t&q=' + encodeURIComponent(text);
  var resp = await fetch(url);
  if (!resp.ok) throw new Error('Помилка ' + resp.status);
  var data = await resp.json();
  return data[0].map(function(x) { return x[0]; }).filter(Boolean).join('');
}

window.electronAPI.onReceivePort((port) => {
	url = "http://localhost:${port}";
});

var srcText = document.getElementById('srcText');
var resultArea = document.getElementById('resultArea');

srcText.addEventListener('input', function() {
  document.getElementById('charCount').textContent = srcText.value.length + ' / 5000';
});
srcText.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.key === 'Enter') document.getElementById('translateBtn').click();
});

document.getElementById('translateBtn').addEventListener('click', async function() {
  var text = srcText.value.trim();
  if (!text) return;
  var tl = document.getElementById('tgtLang').value;
  var sl = document.getElementById('srcLang').value;
  setStatus('Перекладаємо…', '');
  this.disabled = true; this.textContent = 'Перекладаємо…';
  try {
    var translated = await googleTranslate(text, tl, sl);
    translated = translated.charAt(0).toUpperCase() + translated.slice(1);
    resultArea.textContent = translated;
    resultArea.classList.add('has-text');
    setStatus('Переклад готовий ✓', 'ok');
  } catch(e) { setStatus('Помилка: ' + e.message, 'error'); }
  this.disabled = false; this.textContent = 'Перекласти';
});

document.getElementById('swapBtn').addEventListener('click', function() {
  var sl = document.getElementById('srcLang');
  var tl = document.getElementById('tgtLang');
  var oldSl = sl.value === 'auto' ? 'uk' : sl.value;
  var oldTl = tl.value;
  var srcVal = srcText.value;
  var resVal = resultArea.classList.contains('has-text') ? resultArea.textContent : '';
  srcText.value = resVal;
  resultArea.textContent = srcVal || 'Переклад з\'явиться тут…';
  if (!srcVal) resultArea.classList.remove('has-text'); else resultArea.classList.add('has-text');
  for (var i = 0; i < sl.options.length; i++) { if (sl.options[i].value === oldTl) { sl.selectedIndex = i; break; } }
  for (var i = 0; i < tl.options.length; i++) { if (tl.options[i].value === oldSl) { tl.selectedIndex = i; break; } }
  document.getElementById('charCount').textContent = srcText.value.length + ' / 5000';
});

document.getElementById('clipBtn').addEventListener('click', async function() {
  try {
    var text = await navigator.clipboard.readText();
    srcText.value = text;
    document.getElementById('charCount').textContent = text.length + ' / 5000';
    setStatus('Буфер прочитано', 'ok');
  } catch(e) { setStatus('Немає доступу до буфера', 'error'); }
});

document.getElementById('clearBtn').addEventListener('click', function() {
  srcText.value = '';
  document.getElementById('charCount').textContent = '0 / 5000';
  resultArea.textContent = 'Переклад з\'явиться тут…';
  resultArea.classList.remove('has-text');
});

document.getElementById('copySrcBtn').addEventListener('click', function() {
  if (srcText.value) { navigator.clipboard.writeText(srcText.value); setStatus('Скопійовано ✓', 'ok'); }
});

document.getElementById('copyResultBtn').addEventListener('click', function() {
  if (resultArea.classList.contains('has-text')) { navigator.clipboard.writeText(resultArea.textContent); setStatus('Скопійовано ✓', 'ok'); }
});

document.getElementById('saveCardBtn').addEventListener('click', function() {
  var src = srcText.value.trim();
  var tgt = resultArea.classList.contains('has-text') ? resultArea.textContent : '';
  if (!src || !tgt) { setStatus('Немає тексту для збереження', 'error'); return; }
  dictionary.push({ src: src, tgt: tgt });
  setStatus('Збережено до словника ✓', 'ok');
  // Анімація кнопки
  var btn = this;
  btn.style.background = '#1e4a34';
  setTimeout(function() { btn.style.background = ''; }, 800);
});

// ═══════════════════════════════════════════
// ФЛЕШ-КАРТКИ
// ═══════════════════════════════════════════
function renderStudyView() {
  var sv = document.getElementById('studyView');
  var ev = document.getElementById('emptyView');
  if (dictionary.length === 0) { sv.style.display = 'none'; ev.style.display = 'flex'; return; }
  sv.style.display = 'flex'; ev.style.display = 'none';
  if (currentIndex >= dictionary.length) currentIndex = 0;
  showCard(currentIndex);
}

function showCard(idx) {
  var card = dictionary[idx];
  document.getElementById('cardWord').textContent = card.src;
  document.getElementById('cardTranslation').textContent = card.tgt;
  document.getElementById('studyCounter').textContent = 'Картка ' + (idx + 1) + ' з ' + dictionary.length;
  document.getElementById('showBtn').style.display = 'block';
  document.getElementById('cardTranslation').style.display = 'none';
}

document.getElementById('showBtn').addEventListener('click', function() {
  this.style.display = 'none';
  document.getElementById('cardTranslation').style.display = 'block';
});
document.getElementById('nextBtn').addEventListener('click', function() {
  currentIndex = (currentIndex + 1) % dictionary.length; showCard(currentIndex);
});
document.getElementById('prevBtn').addEventListener('click', function() {
  currentIndex = (currentIndex - 1 + dictionary.length) % dictionary.length; showCard(currentIndex);
});
document.getElementById('shuffleBtn').addEventListener('click', function() {
  for (var i = dictionary.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = dictionary[i]; dictionary[i] = dictionary[j]; dictionary[j] = tmp;
  }
  currentIndex = 0; showCard(0);
});
document.getElementById('removeBtn').addEventListener('click', function() {
  dictionary.splice(currentIndex, 1);
  if (dictionary.length === 0) { renderStudyView(); return; }
  currentIndex = Math.min(currentIndex, dictionary.length - 1);
  showCard(currentIndex);
});

// ═══════════════════════════════════════════
// ГАРЯЧА КЛАВІША
// ═══════════════════════════════════════════
document.getElementById('hotkeyDisplay').addEventListener('click', function() {
  if (isRecordingHotkey) return;
  isRecordingHotkey = true;
  this.classList.add('recording');
  document.getElementById('hotkeyKeys').textContent = '…';
  document.getElementById('hotkeyHint').textContent = 'натисни комбінацію';
});

document.addEventListener('keydown', function(e) {
  if (!isRecordingHotkey) return;
  e.preventDefault();
  if (e.key === 'Escape') {
    isRecordingHotkey = false;
    document.getElementById('hotkeyDisplay').classList.remove('recording');
    document.getElementById('hotkeyKeys').textContent = currentHotkey;
    document.getElementById('hotkeyHint').textContent = 'Змінити';
    return;
  }
  var parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt') {
    parts.push(e.key.toUpperCase());
    var combo = parts.join('+');
    currentHotkey = combo;
    document.getElementById('hotkeyKeys').textContent = combo;
    document.getElementById('hotkeyHint').textContent = 'Змінити';
    document.getElementById('hotkeyDisplay').classList.remove('recording');
    isRecordingHotkey = false;
    // Оновити гарячу клавішу в Electron
    if (window.electronAPI && window.electronAPI.setHotkey) {
      window.electronAPI.setHotkey(combo);
    }
    setStatus('Гаряча клавіша: ' + combo, 'ok');
  }
});

// ═══════════════════════════════════════════
// ОВЕРЛЕЙ
// ═══════════════════════════════════════════
function cropImage(dataURL, region) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      var sx = img.naturalWidth / window.screen.width;
      var sy = img.naturalHeight / window.screen.height;
      var c = document.createElement('canvas');
      c.width = region.w * sx; c.height = region.h * sy;
      c.getContext('2d').drawImage(img, region.x*sx, region.y*sy, region.w*sx, region.h*sy, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/png'));
    };
    img.src = dataURL;
  });
}

function setProgress(pct) {
  var bar = document.getElementById('progressBar');
  var fill = document.getElementById('progressFill');
  if (pct <= 0) { bar.style.display = 'none'; fill.style.width = '0%'; return; }
  bar.style.display = 'block'; fill.style.width = pct + '%';
}

async function runOCRandTranslate(croppedURL, region) {
  var lang = document.getElementById('ocrLang').value;
  var tl = document.getElementById('ovTgtLang').value;
  var ocrBox = document.getElementById('ocrResult');
  var transBox = document.getElementById('ovTransResult');
  ocrBox.textContent = '…'; ocrBox.classList.remove('has-text');
  transBox.textContent = '—'; transBox.classList.remove('has-text');
  setProgress(10); setStatus('Розпізнаємо текст…', '');
  try {
    var worker = await Tesseract.createWorker(lang, 1, {
      logger: function(m) {
        if (m.status === 'recognizing text') {
          setProgress(10 + Math.round(m.progress * 60));
          setStatus('OCR: ' + Math.round(m.progress * 100) + '%', '');
        }
      }
    });
    var result = await worker.recognize(croppedURL);
    await worker.terminate();
    var text = result.data.text.trim();
    setProgress(75);
    if (!text) { ocrBox.textContent = 'Текст не знайдено'; setProgress(0); setStatus('Текст не знайдено', 'error'); return; }
    ocrBox.textContent = text; ocrBox.classList.add('has-text');
    setStatus('Перекладаємо…', ''); setProgress(80);
    var translated = await googleTranslate(text, tl);
    transBox.textContent = translated; transBox.classList.add('has-text');
    setProgress(100);
    setTimeout(function() { setProgress(0); }, 600);
    setStatus('Готово ✓', 'ok');
    var popupMode = document.getElementById('popupMode').value;
    if (window.electronAPI && window.electronAPI.showPopup) {
      if (popupMode === 'always') {
        window.electronAPI.showPopup({ ocr: text, translation: translated, region: region });
      } else if (popupMode === 'minimized' && window.electronAPI.isMinimized) {
        window.electronAPI.isMinimized().then(function(minimized) {
          if (minimized) window.electronAPI.showPopup({ ocr: text, translation: translated, region: region });
        });
      }
    }
  } catch(e) {
    ocrBox.textContent = 'Помилка: ' + e.message;
    setProgress(0); setStatus('Помилка OCR', 'error');
  }
}

document.getElementById('captureBtn').addEventListener('click', async function() {
  if (!window.electronAPI) { setStatus('Тільки в Electron', 'error'); return; }
  setStatus('Захоплення екрану…', '');
  this.style.opacity = '0.6'; this.style.pointerEvents = 'none';
  var result = await window.electronAPI.captureScreen();
  this.style.opacity = ''; this.style.pointerEvents = '';
  if (!result.success) { setStatus('Помилка захоплення', 'error'); return; }
  capturedDataURL = result.dataURL;
  await window.electronAPI.showOverlay();
  setStatus('Виділіть область…', '');
});

document.getElementById('copyOcrBtn').addEventListener('click', function() {
  var t = document.getElementById('ocrResult').textContent;
  if (t && t !== '—') { navigator.clipboard.writeText(t); setStatus('Скопійовано ✓', 'ok'); }
});
document.getElementById('copyOvTransBtn').addEventListener('click', function() {
  var t = document.getElementById('ovTransResult').textContent;
  if (t && t !== '—') { navigator.clipboard.writeText(t); setStatus('Скопійовано ✓', 'ok'); }
});
document.getElementById('saveOvBtn').addEventListener('click', function() {
  var src = document.getElementById('ocrResult').textContent;
  var tgt = document.getElementById('ovTransResult').textContent;
  if (!src || src === '—' || src === '…') { setStatus('Немає тексту', 'error'); return; }
  dictionary.push({ src: src, tgt: tgt });
  setStatus('Збережено до словника ✓', 'ok');
});

if (window.electronAPI) {
  window.electronAPI.onRegionSelected(async function(region) {
    var cropped = await cropImage(capturedDataURL, region);
    var icon = document.querySelector('#previewInner i');
    var hint = document.getElementById('previewHint');
    var img = document.getElementById('previewImg');
    if (icon) icon.style.display = 'none';
    if (hint) hint.style.display = 'none';
    img.src = cropped; img.style.display = 'block';
    await runOCRandTranslate(cropped, region);
  });
  window.electronAPI.onOverlayCancelled(function() { setStatus('Захоплення скасовано', ''); });
  window.electronAPI.onTriggerCapture(function() { document.getElementById('captureBtn').click(); });
}

// ═══════════════════════════════════════════
// СТАТУС
// ═══════════════════════════════════════════
var statusTimer;
function setStatus(msg, type) {
  clearTimeout(statusTimer);
  document.getElementById('statusText').textContent = msg;
  var dot = document.getElementById('sdot');
  dot.className = 'sdot' + (type ? ' ' + type : '');
  if (type === 'ok' || type === 'error') {
    statusTimer = setTimeout(function() {
      document.getElementById('statusText').textContent = 'Готовий до роботи';
      dot.className = 'sdot';
    }, 3000);
  }
}

renderStudyView();