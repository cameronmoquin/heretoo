
// Tap-to-order drill for the guide pages — the same staged chunking as
// the trainer app: parts of at most 7, global numbering.
(function () {
  var box = document.getElementById('drill');
  if (!box) return;
  var all = JSON.parse(box.dataset.items);
  var nChunks = Math.ceil(all.length / 7);
  var per = Math.ceil(all.length / nChunks);
  var lessonId = box.dataset.lesson || '';

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var k = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[k]; a[k] = t;
    }
    return a;
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function stageRun(stage) {
    var start = stage * per;
    var items = all.slice(start, start + per);
    var order = shuffle(items.map(function (_, i) { return i; }));
    var picked = [];
    var partLabel = nChunks > 1 ? 'Part ' + (stage + 1) + ' of ' + nChunks : '';

    function draw() {
      var row = picked.map(function (idx, p) {
        return '<span class="' + (idx === p ? '' : 'wrong') + '">' + (start + p + 1) + '. ' + esc(items[idx]) + '</span>';
      }).join(' &nbsp; ') || '<span style="color:var(--dim)">Tap the items in order</span>';
      var chips = order.map(function (idx) {
        var p = picked.indexOf(idx);
        return '<button type="button" class="chip" data-i="' + idx + '"' + (p >= 0 ? ' disabled' : '') + '><b>' +
          (p >= 0 ? (start + p + 1) + '.' : '') + '</b>' + esc(items[idx]) + '</button>';
      }).join('');
      box.innerHTML = (partLabel ? '<div class="part">' + partLabel + '</div>' : '') +
        '<div class="row">' + row + '</div>' + chips +
        '<div class="ctl"><button type="button" id="d-undo"' + (picked.length ? '' : ' disabled') + '>Undo</button>' +
        (picked.length === items.length ? '<button type="button" class="primary" id="d-check">Check</button>' : '') + '</div>';
      box.querySelectorAll('.chip:not(:disabled)').forEach(function (b) {
        b.onclick = function () { picked.push(+b.dataset.i); draw(); };
      });
      document.getElementById('d-undo').onclick = function () { picked.pop(); draw(); };
      var c = document.getElementById('d-check'); if (c) c.onclick = check;
    }

    function check() {
      var right = 0;
      picked.forEach(function (idx, p) { if (idx === p) right++; });
      var perfect = right === items.length, last = stage >= nChunks - 1;
      var list = items.map(function (it, i) {
        var got = picked[i];
        return '<button type="button" class="chip ' + (got === i ? 'ok' : 'bad') + '" disabled><b>' + (start + i + 1) + '.</b>' +
          esc(it) + (got === i ? '' : ' <span style="color:var(--dim)">(you: ' + esc(items[got]) + ')</span>') + '</button>';
      }).join('');
      box.innerHTML = (partLabel ? '<div class="part">' + partLabel + '</div>' : '') +
        '<div class="score">' + right + ' / ' + items.length + ' in place</div>' + list +
        '<div class="ctl"><button type="button" class="primary" id="d-next">' +
        (perfect ? (last ? 'Done — run it again' : 'Next part') : 'Try again') + '</button></div>';
      if (perfect && last && window.fsotHit) window.fsotHit('complete', 'drill:' + lessonId);
      document.getElementById('d-next').onclick = function () {
        stageRun(perfect ? (last ? 0 : stage + 1) : stage);
      };
    }

    draw();
  }

  stageRun(0);
})();
