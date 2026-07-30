"use strict";

(function () {
  var ALLOWED_NN_BONUSES = ["88", "2", "90"];
  var AR_COUNTRY_CODE = "54";
  var API_BASE_URL = "https://apg.cuatrobet.com/v0/identity";
  var MARKETING_LIBRARY_URL = "https://cuatrobet.com/mtapi/js/v2/mlibrary.js";
  var FINGERPRINT_SCRIPT_URL = "https://openfpcdn.io/fingerprintjs/v4";
  var GENERIC_REGISTRATION_ERROR_MESSAGE =
    "No se pudo completar el registro. Revisa los datos e intentalo de nuevo.";
  var CONFIRMED_REGISTRATION_ERROR_MESSAGES = {
    EMAIL_CURRENCY_UNIQUE:
      "Este correo electronico ya esta registrado. Usa otro correo o inicia sesion."
  };
  var TRACKING_QUERY_KEYS = [
    "qtag", "adtag", "btag", "stag", "voluum_clickid", "siteid",
    "utm", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "gclid", "fbclid", "x_pm_click", "redirect_creative_id"
  ];

  var landingConfig = {
    apiKey: "f57361d7-f180-46d8-8b71-805288f3fb2a",
    registrationUrl: API_BASE_URL + "/registration/byform",
    redirectDomain: "https://cuatrobet.com",
    authBridgeUrl: "https://o.cuatrobet.com/landing-auth/",
    defaultCurrency: "ARS",
    selectedLanguage: "es",
    verificationLinkVersion: "2"
  };

  var fingerprintVisitorIdPromise;

  function findRegistrationErrorCode(payload) {
    if (!payload) return "";
    if (typeof payload === "string") {
      try { return findRegistrationErrorCode(JSON.parse(payload)); } catch (_error) { return ""; }
    }
    var code = payload.modelError && (payload.modelError.code || payload.modelError.localizeKey) ||
      payload.code || payload.localizeKey || payload.errorCode || "";
    return typeof code === "string" ? code.trim().toUpperCase() : "";
  }

  function getRegistrationErrorMessage(payload) {
    var code = findRegistrationErrorCode(payload);
    if (code && CONFIRMED_REGISTRATION_ERROR_MESSAGES[code]) {
      return CONFIRMED_REGISTRATION_ERROR_MESSAGES[code];
    }
    if (code.indexOf("EMAIL") !== -1 && code.indexOf("UNIQUE") !== -1) {
      return CONFIRMED_REGISTRATION_ERROR_MESSAGES.EMAIL_CURRENCY_UNIQUE;
    }
    if (code.indexOf("PHONE") !== -1 && code.indexOf("UNIQUE") !== -1) {
      return "Este numero de telefono ya esta registrado. Usa otro numero o inicia sesion.";
    }
    if (code.indexOf("EMAIL") !== -1) return "Ingresa un correo electronico valido.";
    if (code.indexOf("PHONE") !== -1) return "Ingresa un numero de telefono valido.";
    if (code.indexOf("PASSWORD") !== -1) return "Ingresa una contrasena valida.";
    return GENERIC_REGISTRATION_ERROR_MESSAGE;
  }

  function parseErrorResponse(response) {
    return response.text()
      .then(function (text) {
        if (!text) return null;
        try { return JSON.parse(text); } catch (_error) { return text; }
      })
      .catch(function () { return null; });
  }

  function ensureMtfeFShim() {
    if (typeof window.MTFEF === "undefined") window.MTFEF = {};
    if (typeof window.MTFEF.registerCallback !== "function") window.MTFEF.registerCallback = function () {};
    if (typeof window.MTFEF.loginCallback !== "function") window.MTFEF.loginCallback = function () {};
  }

  function readCookie(name) {
    var escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var match = document.cookie.match(new RegExp("(?:^|; )" + escapedName + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : undefined;
  }

  function normalizePhone(phoneNumber) {
    var digits = String(phoneNumber || "").replace(/\D/g, "");
    if (digits.indexOf(AR_COUNTRY_CODE) === 0) digits = digits.slice(AR_COUNTRY_CODE.length);
    return digits ? "+" + AR_COUNTRY_CODE + digits : "";
  }

  function getSelectedBonusCode(value) {
    var code = String(value || "").trim();
    return ALLOWED_NN_BONUSES.indexOf(code) !== -1 ? code : "";
  }

  function requireSelectedBonusCode(value) {
    var code = getSelectedBonusCode(value);
    if (!code) throw new Error("Selecciona un bono valido.");
    return code;
  }

  function getCurrentBonusCode() {
    var bonusInput = document.getElementById("selected-bonus-code");
    return getSelectedBonusCode(bonusInput && bonusInput.value);
  }

  function getFingerprintVisitorId() {
    if (!fingerprintVisitorIdPromise) {
      fingerprintVisitorIdPromise = import(FINGERPRINT_SCRIPT_URL)
        .then(function (module) { return module.default.load(); })
        .then(function (agent) { return agent.get(); })
        .then(function (result) { return result.visitorId; })
        .catch(function () { return ""; });
    }
    return fingerprintVisitorIdPromise;
  }

  function getXChannel() {
    var isPwa = ("standalone" in window.navigator && window.navigator.standalone) ||
      window.matchMedia("(display-mode: standalone)").matches;
    var isWebView = /(WebView|(iPhone|iPod|iPad)(?!.*Safari)|Android.*(wv|.0.0.0)|Linux; U; Android)/i
      .test(window.navigator.userAgent) && !window.navigator.userAgent.toLowerCase().includes("build");
    if (isWebView) return "MOBILE_WEB";
    if (isPwa) return "PWA";
    return window.innerWidth >= 1280 ? "DESKTOP_AIR_PM" : "MOBILE_WEB";
  }

  function collectMarketingMeta() {
    if (window.MTFEF && typeof window.MTFEF.collectSources === "function") {
      try {
        var sources = window.MTFEF.collectSources();
        if (sources) return sources;
      } catch (_error) {}
    }

    if (typeof window.collectCookies === "function") {
      try {
        var cookies = window.collectCookies();
        if (cookies && Object.keys(cookies).length > 0) return cookies;
      } catch (_error2) {}
    }

    var query = new URLSearchParams(window.location.search);
    var meta = {
      adtag: readCookie("adtag"),
      btag: readCookie("pm_btag"),
      siteid: readCookie("pm_siteid"),
      qtag: readCookie("qtag"),
      adtag_t: readCookie("adtag_t"),
      btag_t: readCookie("btag_t"),
      qtag_t: readCookie("qtag_t"),
      org: readCookie("org"),
      org_t: readCookie("org_t"),
      sourceURL: readCookie("sourceUrl"),
      iohash: readCookie("iohash")
    };

    TRACKING_QUERY_KEYS.forEach(function (key) {
      var value = query.get(key);
      if (value) meta[key] = value;
    });

    if (typeof window.clstrmid === "string" && window.clstrmid.trim()) {
      meta.clstrmid = window.clstrmid.trim();
    }

    return Object.keys(meta).reduce(function (acc, key) {
      if (typeof meta[key] === "string" && meta[key].trim()) acc[key] = meta[key];
      return acc;
    }, {});
  }

  function getHostnameFromUrl(url) {
    try { return new URL(url).hostname; } catch (_error) { return ""; }
  }

  function canSetCookieForDomain(hostname) {
    var currentHostname = window.location.hostname;
    return hostname && (currentHostname === hostname || currentHostname.endsWith("." + hostname));
  }

  function persistAuthToken(token, redirectDomain) {
    if (!token) return;
    var targetHostname = getHostnameFromUrl(redirectDomain);
    var cookieDomain = canSetCookieForDomain(targetHostname) ? "; domain=" + targetHostname : "";
    var secureSuffix = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = "thirdPartyAuthToken=" + token + "; path=/; SameSite=Lax" + cookieDomain + secureSuffix;
    document.cookie = "airToken=" + token + "; path=/; SameSite=Lax" + cookieDomain + secureSuffix;
  }

  function buildHeaders() {
    var headers = new Headers({
      "Content-Type": "application/json",
      "X-Api-Key": landingConfig.apiKey,
      "X-Channel": getXChannel(),
      "X-Response-Error": "true",
      "X-Landing": "true",
      "X-VerificationLinkVersion": landingConfig.verificationLinkVersion
    });
    return getFingerprintVisitorId().then(function (visitorId) {
      if (visitorId) headers.set("X-ClientId", visitorId);
      return headers;
    });
  }

  function buildRedirectUrl(redirectDomain, bonusCode) {
    var baseUrl = new URL("/deposit/", redirectDomain || landingConfig.redirectDomain);
    var currentParams = new URLSearchParams(window.location.search);
    var parts = ["promo", "landing", "bonus=" + encodeURIComponent(bonusCode)];
    currentParams.forEach(function (value, key) {
      if (key !== "promo" && key !== "landing" && key !== "bonus") {
        parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
      }
    });
    return baseUrl.toString() + "?" + parts.join("&");
  }

  function buildAuthBridgeUrl(apiResponse, redirectDomain, redirectUrl) {
    var token = typeof (apiResponse && apiResponse.token) === "string" ? apiResponse.token : "";
    if (!token || canSetCookieForDomain(getHostnameFromUrl(redirectDomain))) return redirectUrl;

    var bridgeUrl = new URL(landingConfig.authBridgeUrl);
    var params = new URLSearchParams({
      token: token,
      next: redirectUrl,
      source: window.location.hostname
    });
    if (apiResponse && typeof apiResponse.sessionStartDate === "string" && apiResponse.sessionStartDate.trim()) {
      params.set("sessionStartDate", apiResponse.sessionStartDate.trim());
    }
    bridgeUrl.hash = params.toString();
    return bridgeUrl.toString();
  }

  function syncTrackingLinks() {
    document.querySelectorAll("a[href]").forEach(function (anchor) {
      var href = anchor.getAttribute("href");
      if (!href || href === "#" || (!href.startsWith("https://") && !href.startsWith("http://"))) return;
      var url;
      try { url = new URL(href); } catch (_error) { return; }
      var currentParams = new URLSearchParams(window.location.search);
      TRACKING_QUERY_KEYS.forEach(function (key) {
        var value = currentParams.get(key);
        if (value) url.searchParams.set(key, value);
      });
      var selectedBonusCode = getCurrentBonusCode();
      if (selectedBonusCode) url.searchParams.set("regBonus", selectedBonusCode);
      else url.searchParams.delete("regBonus");
      if (typeof window.clstrmid === "string" && window.clstrmid.trim()) {
        url.searchParams.set("clstrmid", window.clstrmid.trim());
      }
      anchor.href = url.toString();
    });
  }

  function initMarketingLibrary() {
    ensureMtfeFShim();
    function initMtfeF() {
      if (window.MTFEF && typeof window.MTFEF.init === "function") {
        try { window.MTFEF.init(); } catch (_error) {}
      }
    }
    if (document.querySelector('script[data-mtfef-lib="' + MARKETING_LIBRARY_URL + '"]')) {
      initMtfeF();
      window.setTimeout(syncTrackingLinks, 1200);
      return;
    }
    var script = document.createElement("script");
    script.src = MARKETING_LIBRARY_URL;
    script.async = true;
    script.setAttribute("data-mtfef-lib", MARKETING_LIBRARY_URL);
    script.onload = function () {
      initMtfeF();
      window.setTimeout(syncTrackingLinks, 1200);
    };
    script.onerror = function () { window.setTimeout(syncTrackingLinks, 0); };
    document.head.appendChild(script);
  }

  function preparePayload(rawData) {
    var data = Object.assign({}, rawData || {});
    if (typeof window.getLastCookie === "function") Object.assign(data, window.getLastCookie());
    data.defaultCurrency = data.defaultCurrency || landingConfig.defaultCurrency;
    data.selectedLanguage = data.selectedLanguage || landingConfig.selectedLanguage;
    data.phone = normalizePhone(data.phone);
    data.nnBonus = requireSelectedBonusCode(data.nnBonus);
    data.isPlayerAgree = true;
    data.formName = "SHORTREGISTRATIONBYPHONE";
    data.marketingMeta = collectMarketingMeta();
    delete data.isAdult;
    delete data.selectedBonus;
    if (!data.email || !String(data.email).trim()) delete data.email;
    return data;
  }

  function submitThroughSharedFlow(payload) {
    var bonusCode = requireSelectedBonusCode(payload.nnBonus);
    window.nnbonus = bonusCode;
    window.landing_type = "registration_on_landing";
    return new Promise(function (resolve, reject) {
      window.sendApiRequest(
        payload,
        function (response) {
          var redirectDomain = response && response.redirectDomain || landingConfig.redirectDomain;
          var redirectUrl = buildRedirectUrl(redirectDomain, bonusCode);
          resolve({ redirectUrl: buildAuthBridgeUrl(response, redirectDomain, redirectUrl) });
        },
        function (response) {
          console.error("Registration request failed", response);
          reject(new Error(getRegistrationErrorMessage(response)));
        },
        function (response) {
          console.error("Registration request failed", response);
          reject(new Error(getRegistrationErrorMessage(response)));
        }
      );
    });
  }

  function submitRegistrationDirect(payload) {
    return buildHeaders()
      .then(function (headers) {
        return fetch(landingConfig.registrationUrl, {
          method: "POST",
          credentials: "include",
          headers: headers,
          body: JSON.stringify(payload)
        }).catch(function (error) {
          console.error("Registration request failed", error);
          throw new Error(GENERIC_REGISTRATION_ERROR_MESSAGE);
        });
      })
      .then(function (response) {
        if (!response.ok) {
          return parseErrorResponse(response).then(function (errorPayload) {
            console.error("Registration request failed", {
              status: response.status,
              statusText: response.statusText,
              payload: errorPayload
            });
            throw new Error(getRegistrationErrorMessage(errorPayload));
          });
        }
        return response.json();
      })
      .then(function (data) {
        var redirectDomain = data && data.redirectDomain || landingConfig.redirectDomain;
        var redirectUrl = buildRedirectUrl(redirectDomain, payload.nnBonus);
        persistAuthToken(data && data.token, redirectDomain);
        if (window.MTFEF && typeof window.MTFEF.registerCallback === "function") {
          try { window.MTFEF.registerCallback(); } catch (_error) {}
        }
        return { redirectUrl: buildAuthBridgeUrl(data, redirectDomain, redirectUrl) };
      });
  }

  function initStandaloneAdapter() {
    window.nnbonus = getCurrentBonusCode();
    window.landing_type = "registration_on_landing";
    window.juegosLandingAdapter = {
      submit: function (rawData) {
        var payload = preparePayload(rawData);
        return typeof window.sendApiRequest === "function"
          ? submitThroughSharedFlow(payload)
          : submitRegistrationDirect(payload);
      }
    };
    initMarketingLibrary();
    syncTrackingLinks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStandaloneAdapter, { once: true });
  } else {
    initStandaloneAdapter();
  }
}());
