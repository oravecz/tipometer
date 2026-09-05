/* Tipometer — a one-screen tip calculator. */
(function () {
  'use strict';

  var STEP = 5;          // 0.5% expressed in tenths of a percent
  var MIN = 0;
  var MAX = 1000;        // 100%
  var DEFAULT = 150;     // 15%
  var STORE_KEY = 'tipometer.v1';

  var rateEl = document.getElementById('rate-value');
  var billEl = document.getElementById('bill');
  var currencyEl = document.getElementById('currency');
  var clearEl = document.getElementById('clear');
  var tipEl = document.getElementById('tip-amount');
  var totalEl = document.getElementById('grand-total');
  var minusEl = document.getElementById('decrement');
  var plusEl = document.getElementById('increment');

  var tenths = DEFAULT;

  /* ---- currency ---- */

  var REGION_CURRENCY = {
    US: 'USD', CA: 'CAD', GB: 'GBP', AU: 'AUD', NZ: 'NZD', JP: 'JPY',
    CN: 'CNY', IN: 'INR', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK',
    PL: 'PLN', CZ: 'CZK', MX: 'MXN', BR: 'BRL', ZA: 'ZAR', SG: 'SGD',
    HK: 'HKD', KR: 'KRW', IL: 'ILS', TR: 'TRY', AE: 'AED', PH: 'PHP',
    TH: 'THB', ID: 'IDR', MY: 'MYR', VN: 'VND', RU: 'RUB', UA: 'UAH'
  };
  var EURO = ['AT','BE','CY','DE','EE','ES','FI','FR','GR','HR','IE','IT',
              'LT','LU','LV','MT','NL','PT','SI','SK'];

  var locale = (navigator.languages && navigator.languages[0]) ||
               navigator.language || 'en-US';

  function guessCurrency() {
    var region = '';
    try {
      // Intl.Locale is unavailable on older WebKit; fall back to the tag.
      region = (typeof Intl.Locale === 'function')
        ? (new Intl.Locale(locale).region || '')
        : (locale.split('-')[1] || '');
    } catch (e) {
      region = locale.split('-')[1] || '';
    }
    region = region.toUpperCase();
    if (REGION_CURRENCY[region]) return REGION_CURRENCY[region];
    if (EURO.indexOf(region) !== -1) return 'EUR';
    return 'USD';
  }

  var money, symbol = '$';
  try {
    money = new Intl.NumberFormat(locale, {
      style: 'currency', currency: guessCurrency()
    });
    var parts = money.formatToParts(0);
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === 'currency') { symbol = parts[i].value; break; }
    }
  } catch (e) {
    money = { format: function (n) { return '$' + n.toFixed(2); } };
  }
  currencyEl.textContent = symbol;

  /* ---- state ---- */

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      if (typeof saved.tenths === 'number') tenths = clamp(Math.round(saved.tenths));
      if (typeof saved.bill === 'string') billEl.value = saved.bill;
    } catch (e) { /* storage blocked or corrupt — use defaults */ }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        tenths: tenths, bill: billEl.value
      }));
    } catch (e) { /* private mode — nothing to do */ }
  }

  function clamp(v) { return Math.min(MAX, Math.max(MIN, v)); }

  function parseBill() {
    // Accept "." or "," as the decimal mark; ignore grouping and stray text.
    var raw = billEl.value.replace(/[^0-9.,]/g, '');
    var cut = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf(','));
    var whole, frac = '';
    if (cut === -1) {
      whole = raw.replace(/[.,]/g, '');
    } else {
      whole = raw.slice(0, cut).replace(/[.,]/g, '');
      frac = raw.slice(cut + 1).replace(/[.,]/g, '');
    }
    var n = parseFloat((whole || '0') + '.' + (frac || '0'));
    return isFinite(n) && n > 0 ? n : 0;
  }

  function formatRate() {
    return (tenths % 10 === 0) ? String(tenths / 10) : (tenths / 10).toFixed(1);
  }

  function render() {
    rateEl.textContent = formatRate();
    minusEl.disabled = tenths <= MIN;
    plusEl.disabled = tenths >= MAX;

    var bill = parseBill();
    // Round the tip to the cent, then build the total from the rounded tip so
    // the three figures on screen always add up.
    var tip = Math.round(bill * tenths / 10) / 100;
    tipEl.textContent = money.format(tip);
    totalEl.textContent = money.format(bill + tip);

    clearEl.hidden = billEl.value.length === 0;
  }

  function nudge(direction) {
    var next = clamp(tenths + direction * STEP);
    if (next === tenths) return false;
    tenths = next;
    render();
    save();
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} }
    return true;
  }

  /* ---- press and hold ---- */

  function wireStepper(button, direction) {
    var delayTimer = null, repeatTimer = null, repeated = false;

    function stop() {
      clearTimeout(delayTimer);
      clearInterval(repeatTimer);
      delayTimer = repeatTimer = null;
    }

    button.addEventListener('pointerdown', function (event) {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      stop();
      repeated = false;
      delayTimer = setTimeout(function () {
        repeatTimer = setInterval(function () {
          if (!nudge(direction)) stop();
          else repeated = true;
        }, 80);
      }, 420);
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (name) {
      button.addEventListener(name, stop);
    });

    // The click supplies the first step for pointer and keyboard alike; it is
    // suppressed after a hold so the repeat run does not gain a bonus step.
    button.addEventListener('click', function () {
      if (repeated) { repeated = false; return; }
      nudge(direction);
    });
  }

  wireStepper(minusEl, -1);
  wireStepper(plusEl, 1);

  /* ---- bill field ---- */

  billEl.addEventListener('input', function () {
    var cleaned = billEl.value.replace(/[^0-9.,]/g, '');
    if (cleaned !== billEl.value) billEl.value = cleaned;
    render();
    save();
  });

  billEl.addEventListener('blur', function () {
    var bill = parseBill();
    if (bill > 0) billEl.value = bill.toFixed(2);
    else if (billEl.value.trim() !== '') billEl.value = '';
    render();
    save();
  });

  clearEl.addEventListener('click', function () {
    billEl.value = '';
    render();
    save();
    billEl.focus();
  });

  document.addEventListener('keydown', function (event) {
    if (event.target === billEl) return;
    if (event.key === 'ArrowUp' || event.key === '+') { nudge(1); event.preventDefault(); }
    if (event.key === 'ArrowDown' || event.key === '-') { nudge(-1); event.preventDefault(); }
  });

  load();
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
