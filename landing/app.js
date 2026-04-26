(function () {
  'use strict';

  var REPO = 'sanpicule/takumakai-shift-generate-app';
  var API_URL = 'https://api.github.com/repos/' + REPO + '/releases/latest';
  var RELEASES_URL = 'https://github.com/' + REPO + '/releases/latest';

  var versionEl = document.getElementById('version');
  var sizeEl = document.getElementById('size');
  var btnEl = document.getElementById('download-btn');
  var fallbackEl = document.getElementById('fallback');

  function formatSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    var mb = bytes / (1024 * 1024);
    return '(' + mb.toFixed(1) + ' MB)';
  }

  function showFallback() {
    versionEl.textContent = '取得できませんでした';
    btnEl.href = RELEASES_URL;
    fallbackEl.hidden = false;
  }

  fetch(API_URL, { headers: { 'Accept': 'application/vnd.github+json' } })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var tag = data.tag_name || '';
      versionEl.textContent = tag || '不明';

      var assets = Array.isArray(data.assets) ? data.assets : [];
      var winAsset = null;
      for (var i = 0; i < assets.length; i++) {
        var a = assets[i];
        if (a && typeof a.name === 'string' && /\.exe$/i.test(a.name)) {
          winAsset = a;
          break;
        }
      }

      if (winAsset && winAsset.browser_download_url) {
        btnEl.href = winAsset.browser_download_url;
        btnEl.setAttribute('download', winAsset.name);
        sizeEl.textContent = formatSize(winAsset.size);
      } else {
        btnEl.href = RELEASES_URL;
        fallbackEl.hidden = false;
      }
    })
    .catch(function () {
      showFallback();
    });
})();
