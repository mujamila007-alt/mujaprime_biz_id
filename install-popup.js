// MujaPrime install helper
// Tombol install sekarang hanya muncul di halaman akun-saya, bukan popup mengambang.
(function () {
  'use strict';

  var APK_PATH = 'https://github.com/mujahiid007-mujaprime/apk-mujaprime/blob/main/MujaPrime_.apk?raw=true';
  var DISMISS_KEY = 'mujaInstallPopupDismissUntil';
  var POPUP_ID = 'muja-install-popup';

  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  function apkUrl() {
    var url = APK_PATH;
    try { url = new URL(APK_PATH, window.location.origin).href; } catch (e) {}
    return url;
  }

  function removeFloatingInstallPopup() {
    var popup = document.getElementById(POPUP_ID);
    if (popup && popup.parentNode) popup.parentNode.removeChild(popup);

    var legacyBanner = document.getElementById('installBanner');
    if (legacyBanner && legacyBanner.parentNode) legacyBanner.parentNode.removeChild(legacyBanner);
  }

  function openInstaller(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    safeStorageSet(DISMISS_KEY, String(Date.now() + 365 * 24 * 60 * 60 * 1000));
    removeFloatingInstallPopup();
    window.location.href = apkUrl();
    return false;
  }

  // Fungsi global untuk tombol manual di akun-saya.
  window.MujaInstallApk = openInstaller;
  window.MujaPrimeInstallApkUrl = apkUrl;

  function bindManualButtons() {
    removeFloatingInstallPopup();
    document.querySelectorAll('[data-muja-install-apk]').forEach(function (btn) {
      if (btn.__mujaInstallBound) return;
      btn.__mujaInstallBound = true;
      btn.setAttribute('href', apkUrl());
      btn.addEventListener('click', openInstaller);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindManualButtons, { once: true });
  } else {
    bindManualButtons();
  }
})();
