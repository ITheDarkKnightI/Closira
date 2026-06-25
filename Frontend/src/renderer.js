// ═══════════════════════════════════════════
// СТАН
// ═══════════════════════════════════════════
var dictionary = [];
var currentIndex = 0;
var capturedDataURL = null;
var currentHotkey = 'Ctrl+Shift+T';
var isRecordingHotkey = false;
let url = "";
let serverReady = false;
let languages = null;

// ═══════════════════════════════════════════
// OTHER FUNCTIONS
// ═══════════════════════════════════════════

// saving word and its text to DB 
async function saveData(word1, text1){
  console.log(`Post reqest to save data: ward: ${word1}; sentence: ${text1}`);
  var current_url = url + "/save";
  var resp = await fetch(current_url, {
	  method: 'POST',
	  headers: {
		'Content-Type': 'application/json'
	  }, 
	  body: JSON.stringify({word: word1, text: text1 })
  });
  if (!resp.ok) throw new Error('Помилка при перекладі' + resp.status);
}

// Loading all saved word from db
async function dataLoad(){
  console.log(`Loading words from DB`);
  var current_url = url + "/load";
  var resp = await fetch(current_url, {
    method: 'POST',
    headers: {
	'Content-Type': 'application/json'
    }
  }); 
  if (!resp.ok) throw new Error('Помилка при завантаженні слів ' + resp.status);
  let words = await resp.json();
  words.forEach(word => {
    dictionary.push({src: word.word, tgt: word.text});
  });
}

// Delete from DB
async function deleteData(word1, text1){
  console.log(`Deleting data`);
  const current_url = url + "/delete";
  var resp = await fetch(current_url, {
    method: 'POST',
    headers: {
	'Content-Type': 'application/json'
    },
    body: JSON.stringify({word: word1, text: text1})
  });
  if(!resp.ok) throw new Error('Помилка під час видалення слів ' + resp.status);
}
// ═══════════════════════════════════════════
// ЕКРАН ЗАВАНТАЖЕННЯ + ПЕРЕВІРКА ПІДКЛЮЧЕННЯ
// ═══════════════════════════════════════════
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingTitle = document.getElementById('loadingTitle');
const loadingSub = document.getElementById('loadingSub');
const loadingProgressFill = document.getElementById('loadingProgressFill');
const loadingError = document.getElementById('loadingError');
const loadingErrorText = document.getElementById('loadingErrorText');
// Src and Trg languages
const mainSrc = document.getElementById('srcLang');
const mainTrg = document.getElementById('tgtLang');
const ocrSrc = document.getElementById('ocrLang');
const ocrTrg = document.getElementById('ovTgtLang');

function selectRandOption(selectE){
  if(selectE.options.length == null){
    console.log(`No options for ${selectE.name}`);
    return;
  }
  let randomIndex = Math.floor(Math.random() * selectE.options.length);
  selectE.selectedIndex = randomIndex;
}

function addOption(name, data){
  data.forEach(item => {
    let option = new Option(name, item.value);
    item.selects.forEach(select =>{
      select.add(option.cloneNode(true));
    });
  });
}

function setLoadingProgress(pct) {
  loadingProgressFill.style.width = pct + '%';
}

function showLoadingError(msg) {
  loadingError.style.display = 'flex';
  loadingErrorText.textContent = msg;
  loadingTitle.textContent = 'Помилка підключення';
  loadingSub.textContent = 'Перевірте, чи запущено Java, або перезапустіть додаток.';
}


async function pingHealth() {
  if (!url) return false;
  try {
    const resp = await fetch(url + '/connect', { signal: AbortSignal.timeout(3000) });
    languages = await resp.json();
    return resp.ok;
  } catch(e) {
    return false;
  }
}

async function waitForServer() {
  setLoadingProgress(10);
  loadingTitle.textContent = 'Запуск сервера…';
  loadingSub.textContent = 'Завантаження моделей перекладу. Це може зайняти кілька секунд.';

  let portWait = 0;
  while (!url && portWait < 120) {
    await new Promise(r => setTimeout(r, 500));
    portWait++;
  }
  if (!url) {
    showLoadingError('Сервер не відповів: порт не отримано');
    return;
  }

  setLoadingProgress(30);
  loadingTitle.textContent = 'Підключення до сервера…';

  let attempts = 0;
  const maxAttempts = 60;
  while (attempts < maxAttempts) {
    const ok = await pingHealth();
    if (ok) {
      if(languages != null){
	// loading languages
        languages.forEach(language => {addOption(language.name,
		[{value: language.nllbName, selects: [mainSrc, mainTrg]},
		{value: language.ocrName, selects: [ocrSrc, ocrTrg]}]
	)});
	selectRandOption(mainTrg);
	selectRandOption(ocrTrg);
      }
      // loading words
      dataLoad();

      setLoadingProgress(100);
      loadingTitle.textContent = 'Готово!';
      loadingSub.textContent = 'Сервер готовий до роботи.';
      await new Promise(r => setTimeout(r, 400));
      // ховаємо оверлей
      loadingOverlay.classList.add('hidden');
      setTimeout(() => { loadingOverlay.style.display = 'none'; }, 500);
      serverReady = true;
      setStatus('Готовий до роботи', '');
      return;
    }
    attempts++;
    // Анімація прогресу 30–90%
    setLoadingProgress(30 + Math.round((attempts / maxAttempts) * 60));
    loadingTitle.textContent = `Завантаження моделей… (${attempts}/${maxAttempts})`;
    await new Promise(r => setTimeout(r, 1500));
  }

  showLoadingError('Сервер не відповів за відведений час');
}
waitForServer();

// Блокуємо дії якщо сервер не готовий
function requireServer() {
  if (!serverReady) {
    setStatus('Сервер ще завантажується…', 'error');
    return false;
  }
  return true;
}
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
async function googleTranslate(text1, tl, sl) {
  console.log(`Post request: srcLan:${sl}, trgLan:${tl}`);
  var current_url = url + "/translate";
  var resp = await fetch(current_url, {
	  method: 'POST',
	  headers: {
		'Content-Type': 'application/json'
	  }, 
	  body: JSON.stringify({srcLan: sl, trgLan: tl, text: text1})
  });
  if (!resp.ok) throw new Error('Помилка ' + resp.status);
  var data = await resp.json();
  return data.text;
}

window.electronAPI.onReceivePort((port) => {
	url = `http://localhost:${port}`;
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
  if(!requireServer()) return;
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
  // saving to DB
  saveData(src, tgt);
  // saving in current session
  dictionary.push({src: src, tgt: tgt});
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
  // delete the word
  const currentWord = dictionary[currentIndex];
  deleteData(currentWord.src, false);
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
  var sl;
  switch(lang){
	  case "eng": sl = "eng_Latn"; break;
	  case "ukr": sl = "ukr_Cyrl"; break;
	  default: sl = "eng_Latn"; break;
  }
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
    var translated = await googleTranslate(text, tl, sl);
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
  if(!requireServer()) return;
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
  saveData(src, tgt);
  dictionary.push({src: src, tgt: tgt});
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
// ═══════════════════════════════════════════
// КАСТОМНИЙ СКРОЛЛБАР
// ═══════════════════════════════════════════
function initCustomScrollbar(el) {
  if (el._scrollbarInit) return;
  el._scrollbarInit = true;

  var wrapper = document.createElement('div');
  wrapper.style.cssText ='position:relative;overflow:hidden;flex:1;min-height:0;width:100%;';
  el.parentNode.insertBefore(wrapper, el);
  wrapper.appendChild(el);

  var track = document.createElement('div');
  track.style.cssText = 'position:absolute;right:3px;top:4px;bottom:4px;width:4px;border-radius:10px;background:transparent;opacity:0;transition:opacity 0.2s;pointer-events:none;z-index:10;';
  wrapper.appendChild(track);

  var thumb = document.createElement('div');
  thumb.style.cssText = 'position:absolute;width:4px;border-radius:10px;background:#307fff;cursor:pointer;transition:background 0.15s;';
  track.appendChild(thumb);

  function update() {
    var ratio = el.clientHeight / el.scrollHeight;
    if (ratio >= 1) { track.style.opacity = '0'; return; }
    var trackH = track.clientHeight;
    var thumbH = Math.max(28, trackH * ratio);
    var thumbTop = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * (trackH - thumbH);
    thumb.style.height = thumbH + 'px';
    thumb.style.top = thumbTop + 'px';
  }

  el.style.overflow = 'auto';
  el.style.height = '100%';
  el.style.scrollbarWidth = 'none';

  el.addEventListener('scroll', update);
  new ResizeObserver(update).observe(el);

  wrapper.addEventListener('mouseenter', function() { track.style.opacity = '1'; });
  wrapper.addEventListener('mouseleave', function() { track.style.opacity = '0'; });

  var dragging = false, startY = 0, startScroll = 0;
  thumb.addEventListener('mousedown', function(e) {
    dragging = true; startY = e.clientY;
    startScroll = el.scrollTop;
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    var trackH = track.clientHeight;
    var thumbH = thumb.clientHeight;
    var delta = e.clientY - startY;
    var scrollRange = el.scrollHeight - el.clientHeight;
    el.scrollTop = startScroll + delta * (scrollRange / (trackH - thumbH));
  });
  document.addEventListener('mouseup', function() {
    if (dragging) { dragging = false; document.body.style.userSelect = ''; }
  });

  thumb.addEventListener('mouseenter', function() { thumb.style.background = '#2d6be4'; });
  thumb.addEventListener('mouseleave', function() { thumb.style.background = '#307fff'; });

  update();
}

function initAllScrollbars() {
  document.querySelectorAll('textarea, .result-area, .ov-box-body').forEach(initCustomScrollbar);
}

document.addEventListener('DOMContentLoaded', initAllScrollbars);
if (document.readyState !== 'loading') initAllScrollbars();
