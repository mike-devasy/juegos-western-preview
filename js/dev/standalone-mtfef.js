const REGISTRATION_ERROR_MESSAGE = 'Algo salió mal.';
const AR_COUNTRY_CODE = '54';
const DEFAULT_NN_BONUS = '88';
const ALLOWED_NN_BONUSES = new Set(['88', '2', '90']);
const API_BASE_URL = 'https://apg.cuatrobet.com/v0/identity';
const FINGERPRINT_SCRIPT_URL = 'https://openfpcdn.io/fingerprintjs/v4';
const MARKETING_LIBRARY_URL = 'https://cuatrobet.com/mtapi/js/v2/mlibrary.js';
const TRACKING_QUERY_KEYS = [
  'qtag',
  'adtag',
  'btag',
  'stag',
  'voluum_clickid',
  'siteid',
  'utm',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'fbclid',
  'x_pm_click',
  'redirect_creative_id',
];

const landingConfig = {
  apiKey: 'f57361d7-f180-46d8-8b71-805288f3fb2a',
  registrationUrl: `${API_BASE_URL}/registration/byform`,
  redirectDomain: 'https://cuatrobet.com',
  defaultCurrency: 'ARS',
  selectedLanguage: 'es',
  verificationLinkVersion: '2',
};

let fingerprintVisitorIdPromise;

const ensureMtfeFShim = () => {
  if (typeof window.MTFEF === 'undefined') {
    window.MTFEF = {};
  }

  if (typeof window.MTFEF.registerCallback !== 'function') {
    window.MTFEF.registerCallback = () => {};
  }

  if (typeof window.MTFEF.loginCallback !== 'function') {
    window.MTFEF.loginCallback = () => {};
  }
};

const readCookie = (name) => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
};

const getPhoneLocalDigits = (phoneNumber = '') => {
  const digits = String(phoneNumber).replace(/\D/g, '');
  return digits.startsWith(AR_COUNTRY_CODE) ? digits.slice(AR_COUNTRY_CODE.length) : digits;
};

const normalizePhone = (phoneNumber = '') => {
  const localDigits = getPhoneLocalDigits(phoneNumber);
  return localDigits ? `+${AR_COUNTRY_CODE}${localDigits}` : '';
};

const getFingerprintVisitorId = async () => {
  if (!fingerprintVisitorIdPromise) {
    fingerprintVisitorIdPromise = import(/* @vite-ignore */ FINGERPRINT_SCRIPT_URL)
      .then((module) => module.default.load())
      .then((agent) => agent.get())
      .then((result) => result.visitorId)
      .catch(() => '');
  }

  return fingerprintVisitorIdPromise;
};

const isStandalonePwa = () =>
  ('standalone' in window.navigator && window.navigator.standalone) ||
  window.matchMedia('(display-mode: standalone)').matches;

const isWebView = () => {
  const rules = [
    'WebView',
    '(iPhone|iPod|iPad)(?!.*Safari)',
    'Android.*(wv|.0.0.0)',
    'Linux; U; Android',
  ];

  return new RegExp(`(${rules.join('|')})`, 'i').test(window.navigator.userAgent)
    && !window.navigator.userAgent.toLowerCase().includes('build');
};

const getXChannel = () => {
  if (isWebView()) {
    return 'MOBILE_WEB';
  }

  if (isStandalonePwa()) {
    return 'PWA';
  }

  return window.innerWidth >= 1280 ? 'DESKTOP_AIR_PM' : 'MOBILE_WEB';
};

const collectMarketingMeta = () => {
  if (window.MTFEF && typeof window.MTFEF.collectSources === 'function') {
    try {
      const sources = window.MTFEF.collectSources();
      if (sources) {
        return sources;
      }
    } catch (_error) {
      // Tracking must never block registration.
    }
  }

  if (typeof window.collectCookies === 'function') {
    try {
      const cookies = window.collectCookies();
      if (cookies && Object.keys(cookies).length > 0) {
        return cookies;
      }
    } catch (_error) {
      // Fall back to direct cookie and query parsing below.
    }
  }

  const query = new URLSearchParams(window.location.search);
  const cookieMap = {
    adtag: readCookie('adtag'),
    btag: readCookie('pm_btag'),
    siteid: readCookie('pm_siteid'),
    qtag: readCookie('qtag'),
    adtag_t: readCookie('adtag_t'),
    btag_t: readCookie('btag_t'),
    qtag_t: readCookie('qtag_t'),
    org: readCookie('org'),
    org_t: readCookie('org_t'),
    sourceURL: readCookie('sourceUrl'),
    iohash: readCookie('iohash'),
  };

  const queryMap = TRACKING_QUERY_KEYS.reduce((accumulator, key) => {
    const value = query.get(key);
    if (value) {
      accumulator[key] = value;
    }
    return accumulator;
  }, {});

  if (typeof window.clstrmid === 'string' && window.clstrmid.trim()) {
    queryMap.clstrmid = window.clstrmid.trim();
  }

  return Object.entries({ ...cookieMap, ...queryMap }).reduce((accumulator, [key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      accumulator[key] = value;
    }
    return accumulator;
  }, {});
};

const getHostnameFromUrl = (value) => {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
};

const getApexCuatrobetDomain = () => {
  const { hostname } = window.location;
  return hostname === 'cuatrobet.com' || hostname.endsWith('.cuatrobet.com') ? 'cuatrobet.com' : '';
};

const canSetCookieForDomain = (targetHostname) => {
  if (!targetHostname) {
    return false;
  }

  const currentHostname = window.location.hostname;
  return currentHostname === targetHostname || currentHostname.endsWith(`.${targetHostname}`);
};

const getCookieDomain = (targetHostname) => (canSetCookieForDomain(targetHostname) ? `; domain=${targetHostname}` : '');

const persistAuthToken = (token, redirectDomain) => {
  if (!token) {
    return;
  }

  const targetHostname = getHostnameFromUrl(redirectDomain);
  const cookieDomain = getCookieDomain(targetHostname);
  const secureSuffix = window.location.protocol === 'https:' ? '; Secure' : '';

  document.cookie = `thirdPartyAuthToken=${token}; path=/; SameSite=Lax${cookieDomain}${secureSuffix}`;
  document.cookie = `airToken=${token}; path=/; SameSite=Lax${cookieDomain}${secureSuffix}`;
};

const buildHeaders = async () => {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Api-Key': landingConfig.apiKey,
    'X-Channel': getXChannel(),
    'X-Response-Error': 'true',
    'X-Landing': 'true',
    'X-VerificationLinkVersion': landingConfig.verificationLinkVersion,
  });

  const visitorId = await getFingerprintVisitorId();
  if (visitorId) {
    headers.set('X-ClientId', visitorId);
  }

  return headers;
};

const parseErrorResponse = async (response) => {
  try {
    return await response.json();
  } catch {
    try {
      return await response.text();
    } catch {
      return null;
    }
  }
};

const resolveRedirectDomain = (apiResponse) => {
  const apexDomain = getApexCuatrobetDomain();
  if (apexDomain) {
    return `https://${apexDomain}`;
  }

  if (typeof apiResponse?.redirectDomain === 'string' && apiResponse.redirectDomain.trim()) {
    return apiResponse.redirectDomain;
  }

  return landingConfig.redirectDomain;
};

const buildRedirectUrl = (redirectDomain, bonusCode) => {
  const baseUrl = new URL('/deposit/', redirectDomain);
  const currentParams = new URLSearchParams(window.location.search);
  const parts = ['promo', 'landing', `bonus=${encodeURIComponent(bonusCode)}`];

  currentParams.forEach((value, key) => {
    if (key !== 'promo' && key !== 'landing' && key !== 'bonus') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  });

  return `${baseUrl.toString()}?${parts.join('&')}`;
};

const readTrackingQueryParam = (key) => new URLSearchParams(window.location.search).get(key);

const insertUrlParam = (key, value, href) => {
  try {
    const url = new URL(href);
    url.searchParams.set(key, value);
    return url.toString();
  } catch {
    return href;
  }
};

const getSelectedBonusCode = (value) => {
  const inputValue = value ?? document.getElementById('selected-bonus-code')?.value;
  const bonusCode = String(inputValue || DEFAULT_NN_BONUS);
  return ALLOWED_NN_BONUSES.has(bonusCode) ? bonusCode : DEFAULT_NN_BONUS;
};

const syncTrackingLinks = () => {
  const anchors = document.querySelectorAll('a[href]');

  anchors.forEach((anchor) => {
    const href = anchor.getAttribute('href');

    if (!href || href.includes('//nativeapp') || (!href.startsWith('https://') && !href.startsWith('http://'))) {
      return;
    }

    let nextHref = href;

    TRACKING_QUERY_KEYS.forEach((key) => {
      const value = readTrackingQueryParam(key);
      if (value) {
        nextHref = insertUrlParam(key, value, nextHref);
      }
    });

    nextHref = insertUrlParam('regBonus', getSelectedBonusCode(), nextHref);
    if (typeof window.clstrmid === 'string' && window.clstrmid.trim()) {
      nextHref = insertUrlParam('clstrmid', window.clstrmid.trim(), nextHref);
    }

    anchor.href = nextHref;
  });
};

const initMarketingLibrary = () => {
  ensureMtfeFShim();

  const initMtfeF = () => {
    if (window.MTFEF && typeof window.MTFEF.init === 'function') {
      try {
        window.MTFEF.init();
      } catch (_error) {
        // Tracking must not break the landing runtime.
      }
    }
  };

  if (document.querySelector(`script[data-mtfef-lib="${MARKETING_LIBRARY_URL}"]`)) {
    initMtfeF();
    window.setTimeout(syncTrackingLinks, 1200);
    return;
  }

  const script = document.createElement('script');
  script.src = MARKETING_LIBRARY_URL;
  script.async = true;
  script.setAttribute('data-mtfef-lib', MARKETING_LIBRARY_URL);
  script.onload = () => {
    initMtfeF();
    window.setTimeout(syncTrackingLinks, 1200);
  };
  script.onerror = () => {
    window.setTimeout(syncTrackingLinks, 0);
  };
  document.head.appendChild(script);
};

const preparePayload = (rawData = {}) => {
  const data = { ...rawData };

  if (typeof window.getLastCookie === 'function') {
    Object.assign(data, window.getLastCookie());
  }

  data.defaultCurrency = data.defaultCurrency || landingConfig.defaultCurrency;
  data.selectedLanguage = data.selectedLanguage || landingConfig.selectedLanguage;
  data.phone = normalizePhone(data.phone);
  data.nnBonus = getSelectedBonusCode(data.nnBonus);
  data.isPlayerAgree = true;
  data.formName = 'SHORTREGISTRATIONBYPHONE';
  data.marketingMeta = collectMarketingMeta();

  delete data.isAdult;
  delete data.selectedBonus;

  if (!data.email || !String(data.email).trim()) {
    delete data.email;
  }

  return data;
};

const submitThroughSharedFlow = (payload) => {
  const bonusCode = getSelectedBonusCode(payload.nnBonus);
  window.nnbonus = bonusCode;
  window.landing_type = 'registration_on_landing';

  return new Promise((resolve, reject) => {
    window.sendApiRequest(
      payload,
      (response) => {
        let redirectTo = response?.redirectDomain || 'https://cuatrobet.com';

        if (['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname)) {
          redirectTo = 'https://cuatrobet.com';
        }

        resolve({ redirectUrl: buildRedirectUrl(redirectTo, bonusCode) });
      },
      (response) => {
        reject(new Error(response?.message || REGISTRATION_ERROR_MESSAGE));
      },
      (response) => {
        reject(new Error(response?.message || REGISTRATION_ERROR_MESSAGE));
      },
    );
  });
};

const submitRegistrationDirect = async (payload) => {
  const headers = await buildHeaders();
  let response;

  try {
    response = await fetch(landingConfig.registrationUrl, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Registration request failed', error);
    throw new Error(REGISTRATION_ERROR_MESSAGE);
  }

  if (!response.ok) {
    const errorPayload = await parseErrorResponse(response);
    console.error('Registration request failed', {
      status: response.status,
      statusText: response.statusText,
      payload: errorPayload,
    });
    throw new Error(REGISTRATION_ERROR_MESSAGE);
  }

  const data = await response.json();
  const redirectDomain = resolveRedirectDomain(data);
  persistAuthToken(data?.token, redirectDomain);

  if (window.MTFEF && typeof window.MTFEF.registerCallback === 'function') {
    try {
      window.MTFEF.registerCallback();
    } catch (error) {
      console.error('MTFEF.registerCallback failed', error);
    }
  }

  return { redirectUrl: buildRedirectUrl(redirectDomain, getSelectedBonusCode(payload.nnBonus)) };
};

const initStandaloneAdapter = () => {
  const bonusInput = document.getElementById('selected-bonus-code');
  const initialBonusCode = getSelectedBonusCode(bonusInput?.value);
  if (bonusInput) {
    bonusInput.value = initialBonusCode;
  }

  window.nnbonus = initialBonusCode;
  window.landing_type = 'registration_on_landing';

  window.patrickLandingAdapter = {
    submit: async (rawData) => {
      const payload = preparePayload(rawData);
      return typeof window.sendApiRequest === 'function'
        ? submitThroughSharedFlow(payload)
        : submitRegistrationDirect(payload);
    },
  };

  initMarketingLibrary();
  syncTrackingLinks();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStandaloneAdapter, { once: true });
} else {
  initStandaloneAdapter();
}
