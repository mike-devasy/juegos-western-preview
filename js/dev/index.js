import "../common.min.js";
(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) return;
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) processPreload(link);
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") continue;
      for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
    }
  }).observe(document, {
    childList: true,
    subtree: true
  });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep) return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
function headerScroll() {
  const header = document.querySelector("[data-fls-header-scroll]");
  const headerShow = header.hasAttribute("data-fls-header-scroll-show");
  const headerShowTimer = header.dataset.flsHeaderScrollShow ? header.dataset.flsHeaderScrollShow : 500;
  const startPoint = header.dataset.flsHeaderScroll ? header.dataset.flsHeaderScroll : 1;
  let scrollDirection = 0;
  let timer;
  document.addEventListener("scroll", function(e) {
    const scrollTop = window.scrollY;
    clearTimeout(timer);
    if (scrollTop >= startPoint) {
      !header.classList.contains("--header-scroll") ? header.classList.add("--header-scroll") : null;
      if (headerShow) {
        if (scrollTop > scrollDirection) {
          header.classList.contains("--header-show") ? header.classList.remove("--header-show") : null;
        } else {
          !header.classList.contains("--header-show") ? header.classList.add("--header-show") : null;
        }
        timer = setTimeout(() => {
          !header.classList.contains("--header-show") ? header.classList.add("--header-show") : null;
        }, headerShowTimer);
      }
    } else {
      header.classList.contains("--header-scroll") ? header.classList.remove("--header-scroll") : null;
      if (headerShow) {
        header.classList.contains("--header-show") ? header.classList.remove("--header-show") : null;
      }
    }
    scrollDirection = scrollTop <= 0 ? 0 : scrollTop;
  });
}
document.querySelector("[data-fls-header-scroll]") ? window.addEventListener("load", headerScroll) : null;

const POPUP_HASH = "#popup";
const AR_COUNTRY_CODE = "54";
const AR_LOCAL_PHONE_LENGTH = 10;
const PHONE_PREFIX = `+${AR_COUNTRY_CODE}`;
const PHONE_MASK_START = `${PHONE_PREFIX} (`;

const getPhoneLocalDigits = (phoneNumber = "") => {
  const digits = String(phoneNumber).replace(/\D/g, "");
  return digits.startsWith(AR_COUNTRY_CODE) ? digits.slice(AR_COUNTRY_CODE.length) : digits;
};

const isValidArPhone = (phoneNumber = "") => getPhoneLocalDigits(phoneNumber).length === AR_LOCAL_PHONE_LENGTH;

const normalizePhone = (phoneNumber = "") => {
  const localDigits = getPhoneLocalDigits(phoneNumber);
  return localDigits ? `+${AR_COUNTRY_CODE}${localDigits}` : PHONE_PREFIX;
};

const formatArPhone = (value = "") => {
  const digits = getPhoneLocalDigits(value).slice(0, AR_LOCAL_PHONE_LENGTH);
  if (!digits.length) return PHONE_PREFIX;

  const areaCode = digits.slice(0, 3);
  const firstPart = digits.slice(3, 6);
  const secondPart = digits.slice(6, 10);
  let formatted = `${PHONE_MASK_START}${areaCode}`;

  if (areaCode.length === 3) formatted += ")";
  if (firstPart.length) formatted += ` ${firstPart}`;
  if (secondPart.length) formatted += ` - ${secondPart}`;
  return formatted;
};

function initPhoneMask(phoneInput) {
  if (!phoneInput || phoneInput.dataset.phoneMaskInitialized === "true") return;

  phoneInput.dataset.phoneMaskInitialized = "true";
  phoneInput.value = formatArPhone(phoneInput.value);
  phoneInput.placeholder = "";
  phoneInput.inputMode = "numeric";
  phoneInput.autocomplete = "tel";

  const prefixLength = PHONE_PREFIX.length;
  const moveCaretToEnd = () => {
    window.requestAnimationFrame(() => {
      const position = phoneInput.value.length;
      phoneInput.setSelectionRange(position, position);
    });
  };
  const restorePrefix = () => {
    phoneInput.value = formatArPhone(phoneInput.value);
    moveCaretToEnd();
  };

  phoneInput.addEventListener("focus", restorePrefix);
  phoneInput.addEventListener("blur", restorePrefix);
  phoneInput.addEventListener("click", () => {
    if ((phoneInput.selectionStart ?? 0) < prefixLength) moveCaretToEnd();
  });
  phoneInput.addEventListener("input", restorePrefix);
  phoneInput.addEventListener("keydown", (event) => {
    const selectionStart = phoneInput.selectionStart ?? prefixLength;
    const selectionEnd = phoneInput.selectionEnd ?? selectionStart;
    const localDigits = getPhoneLocalDigits(phoneInput.value);
    const isDeletingPrefix =
      (event.key === "Backspace" && selectionStart <= prefixLength && selectionEnd <= prefixLength) ||
      (event.key === "Delete" && selectionStart < prefixLength);

    if (isDeletingPrefix) {
      event.preventDefault();
      moveCaretToEnd();
      return;
    }

    if ((event.key === "Backspace" || event.key === "Delete") && localDigits.length <= 1) {
      event.preventDefault();
      phoneInput.value = PHONE_PREFIX;
      phoneInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}

function initRegistrationPopup() {
  const popup = document.querySelector("#registration-popup");
  const form = popup?.querySelector("#register-form");
  const openers = document.querySelectorAll("[data-registration-popup]");
  const landingParams = new URLSearchParams(window.location.search);

  if (!popup || !form) return;

  const bonusSelect = popup.querySelector("[data-bonus-select]");
  const bonusToggle = bonusSelect?.querySelector(".bonus-select__toggle");
  const bonusSelection = bonusToggle?.querySelector(".bonus-card__selection");
  const bonusOptionsPanel = bonusSelect?.querySelector(".bonus-select__options");
  const bonusOptions = bonusOptionsPanel ? Array.from(bonusOptionsPanel.querySelectorAll(".bonus-option")) : [];
  const selectedBonusInput = form.elements.selectedBonus;
  const bonusCodeInput = form.elements.nnBonus;

  const setBonusSelectOpen = (isOpen) => {
    if (!bonusSelect || !bonusToggle || !bonusOptionsPanel) return;
    bonusSelect.classList.toggle("is-open", isOpen);
    bonusToggle.setAttribute("aria-expanded", String(isOpen));
    bonusOptionsPanel.hidden = !isOpen;
  };

  if (bonusSelect && bonusToggle && bonusSelection && bonusOptionsPanel && bonusOptions.length) {
    bonusToggle.addEventListener("click", () => {
      setBonusSelectOpen(bonusToggle.getAttribute("aria-expanded") !== "true");
    });

    bonusOptions.forEach((option) => {
      option.addEventListener("click", () => {
        const bonusId = option.dataset.bonusId || "welcome-slots";
        const bonusCode = option.dataset.bonusCode || "1";
        const optionIcon = option.querySelector(".bonus-card__icon");
        const optionBody = option.querySelector(".bonus-card__body");

        if (!optionIcon || !optionBody) return;

        bonusSelection.replaceChildren(optionIcon.cloneNode(true), optionBody.cloneNode(true));
        bonusOptions.forEach((candidate) => {
          const isSelected = candidate === option;
          candidate.classList.toggle("is-selected", isSelected);
          candidate.setAttribute("aria-selected", String(isSelected));
        });

        selectedBonusInput.value = bonusId;
        bonusCodeInput.value = bonusCode;
        window.nnbonus = bonusCode;
        bonusCodeInput.dispatchEvent(new Event("change", { bubbles: true }));
        bonusToggle.setAttribute("aria-label", `Bono seleccionado: ${optionBody.textContent.trim()}`);
        setBonusSelectOpen(false);
        bonusToggle.focus();
      });
    });

    bonusSelect.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setBonusSelectOpen(false);
        bonusToggle.focus();
      }
    });

    document.addEventListener("click", (event) => {
      if (!bonusSelect.contains(event.target)) setBonusSelectOpen(false);
    });
  }

  initPhoneMask(form.elements.phone);

  openers.forEach((opener) => {
    if (!(opener instanceof HTMLAnchorElement)) return;
    const fallbackUrl = new URL(opener.href);
    landingParams.forEach((value, key) => fallbackUrl.searchParams.set(key, value));
    opener.href = fallbackUrl.toString();
  });

  const openPopup = ({ updateHash = true } = {}) => {
    if (popup.classList.contains("is-open")) return;
    popup.classList.add("is-open");
    popup.setAttribute("aria-hidden", "false");
    document.body.classList.add("registration-popup-open");
    if (updateHash && window.location.hash !== POPUP_HASH) {
      history.pushState(null, "", `${window.location.pathname}${window.location.search}${POPUP_HASH}`);
    }
    popup.querySelector("input:not([type='hidden'])")?.focus();
  };

  openers.forEach((opener) => opener.addEventListener("click", (event) => {
    event.preventDefault();
    openPopup();
  }));

  popup.querySelector("[data-password-toggle]")?.addEventListener("click", (event) => {
    const input = form.elements.password;
    const showPassword = input.type === "password";
    input.type = showPassword ? "text" : "password";
    event.currentTarget.setAttribute("aria-label", showPassword ? "Ocultar contraseña" : "Mostrar contraseña");
  });

  const validators = {
    phone: (input) => isValidArPhone(input.value),
    email: (input) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim()),
    password: (input) => input.value.trim().length >= 8,
    isAdult: (input) => input.checked,
  };

  const validate = (showErrors = false) => Object.entries(validators).map(([name, validator]) => {
    const input = form.elements[name];
    const valid = validator(input);
    input.closest("label")?.classList.toggle("is-invalid", showErrors && !valid);
    return valid;
  }).every(Boolean);

  form.addEventListener("input", () => validate(false));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorBlock = form.querySelector("#register-form-error");
    if (!validate(true)) return;

    form.elements.phone.value = normalizePhone(form.elements.phone.value);

    const submitButton = form.querySelector(".registration-form__submit");
    submitButton.disabled = true;
    errorBlock.hidden = true;

    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const result = await window.patrickLandingAdapter?.submit(data, { form });
      if (!result?.redirectUrl) throw new Error("Missing registration redirect");
      window.location.assign(result.redirectUrl);
    } catch (error) {
      console.error("Registration submit failed", error);
      errorBlock.textContent = "Algo salió mal. Intentá nuevamente.";
      errorBlock.hidden = false;
    } finally {
      submitButton.disabled = false;
    }
  });

  const navigationEntry = performance.getEntriesByType("navigation")[0];
  const isDirectNavigation = navigationEntry
    ? navigationEntry.type === "navigate"
    : !performance.navigation || performance.navigation.type === performance.navigation.TYPE_NAVIGATE;

  if (window.location.hash === POPUP_HASH && isDirectNavigation) openPopup({ updateHash: false });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initRegistrationPopup, { once: true });
} else {
  initRegistrationPopup();
}
