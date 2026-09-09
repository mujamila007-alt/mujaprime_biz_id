// MujaPrime install mini banner v2
(function () {
  'use strict';

  var APK_PATH = 'https://github.com/mujamila007-alt/mujaprime_biz_id/blob/main/update-and-apk/Muja%20Prime_2.2-Edition.apk?raw=true';
  var POPUP_ID = 'muja-install-popup';
  var SLOT_ID = 'muja-install-slot';
  var deferredInstallPrompt = null;

  function apkUrl() {
    try { return new URL(APK_PATH, window.location.origin).href; }
    catch (e) { return APK_PATH; }
  }

  function shouldSkipPage() {
    var p = (window.location.pathname || '/').toLowerCase();
    var blocked = [
      '/payment', '/admin', '/status-aktif', '/status-whatsapp', '/status-whatsapp-admin2',
      '/reset-cache', '/hapus-service-worker', '/panduan-backup-restore'
    ];
    return blocked.some(function (prefix) { return p.indexOf(prefix) === 0; });
  }

  function isStandalone() {
    return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function closeBanner() {
    var popup = document.getElementById(POPUP_ID);
    var slot = document.getElementById(SLOT_ID);
    if (!popup) return;
    popup.classList.remove('muja-install-show');
    popup.classList.add('muja-install-hiding');
    window.setTimeout(function () {
      if (slot && slot.parentNode) slot.parentNode.removeChild(slot);
    }, 250);
  }

  async function openInstaller(event) {
    if (event && event.preventDefault) event.preventDefault();

    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        closeBanner();
        return false;
      } catch (e) {}
    }

    window.location.href = apkUrl();
    return false;
  }

  window.MujaInstallApk = openInstaller;
  window.MujaPrimeInstallApkUrl = apkUrl;

  function bindManualButtons() {
    document.querySelectorAll('[data-muja-install-apk]').forEach(function (btn) {
      if (btn.__mujaInstallBound) return;
      btn.__mujaInstallBound = true;
      if (btn.tagName === 'A') btn.setAttribute('href', apkUrl());
      btn.addEventListener('click', openInstaller);
    });
  }

  function createBanner() {
    if (shouldSkipPage() || isStandalone() || document.getElementById(SLOT_ID)) return;

    var slot = document.createElement('div');
    slot.id = SLOT_ID;
    slot.setAttribute('aria-live', 'polite');

    var popup = document.createElement('aside');
    popup.id = POPUP_ID;
    popup.setAttribute('role', 'status');
    popup.setAttribute('aria-label', 'Install aplikasi Muja Prime');

    popup.innerHTML = '' +
      '<div class="muja-install-card">' +
        '<div class="muja-install-logo" aria-hidden="true">' +
          '<img src="/muja.png" alt="" loading="eager" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'">' +
          '<span class="muja-install-logo-fallback">MP</span>' +
        '</div>' +
        '<div class="muja-install-text">' +
          '<strong class="muja-install-title">MujaPrime lebih nyaman di aplikasi</strong>' +
          '<span class="muja-install-subtitle">Install aplikasi resmi untuk akses lebih cepat</span>' +
        '</div>' +
        '<button class="muja-install-btn" type="button" aria-label="Install aplikasi MujaPrime">Install</button>' +
        '<button class="muja-install-close" type="button" aria-label="Tutup notifikasi install">&times;</button>' +
      '</div>';

    slot.appendChild(popup);

    // Place the banner directly after the site header so it occupies its own layout space.
    // It therefore never sits on top of product cards/content.
    var header = document.querySelector('.muja-header, #header, header');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(slot, header.nextSibling);
    } else {
      document.body.insertBefore(slot, document.body.firstChild);
    }

    var installBtn = popup.querySelector('.muja-install-btn');
    var closeBtn = popup.querySelector('.muja-install-close');
    installBtn.addEventListener('click', openInstaller);
    closeBtn.addEventListener('click', closeBanner);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { popup.classList.add('muja-install-show'); });
    });
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  function init() {
    bindManualButtons();
    createBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
