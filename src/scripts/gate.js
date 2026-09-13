// Overlay de login reutilizable para las páginas privadas (tablero y radar).
//
// IMPORTANTE: esto es capa de interfaz, NO la seguridad. La seguridad real está
// en database.rules.json, que repite la comprobación del lado del servidor: sin
// la sesión autorizada, Firebase deniega los datos aunque alguien salte la UI.
// Antes el nodo `tasks` estaba abierto (`.read/.write: true`) y cualquiera podía
// leer o borrar el tablero; ahora exige la misma cuenta que `jobRadar`, así que
// el tablero necesita este gate para no chocar con errores de permisos.
//
// Uso:
//   import { mountAuthGate } from "./gate.js";
//   mountAuthGate({ onEnter: (user) => {...}, onLeave: (user) => {...} });
import {
  auth, isAllowed, watchSession, login,
  consumeRedirectResult, sendPhoneCode, confirmPhoneCode,
} from "./auth.js";

const STYLE = `
  .auth-gate { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center;
    padding: 24px; background: var(--bg, #f4f4f0); }
  [data-theme="dark"] .auth-gate { background: var(--bg, #161d1a); }
  .auth-gate-card { width: min(100%, 420px); padding: 32px 30px; background: var(--surface);
    border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); text-align: center; }
  .auth-gate-card h2 { margin: 0 0 8px; font-size: 1.6rem; font-weight: 600; letter-spacing: -.03em; }
  .auth-gate-copy { margin: 0 0 20px; color: var(--muted); font-size: .92rem; line-height: 1.5; }
  .auth-gate-copy.is-error { color: var(--red); }
  .auth-gate .primary-button { width: 100%; }
  .auth-gate-toggle { display: block; width: 100%; margin-top: 12px; padding: 6px; border: 0;
    background: transparent; color: var(--muted); font-size: .85rem; text-decoration: underline; cursor: pointer; }
  .auth-gate-phone { display: grid; gap: 10px; margin-top: 14px; }
  .auth-gate-phone input { width: 100%; height: 42px; padding: 0 13px; border: 1px solid var(--line);
    border-radius: 10px; background: var(--surface); color: var(--text); text-align: center; font-size: .95rem; }
  .auth-gate-recaptcha { display: flex; justify-content: center; margin-top: 10px; }
  .auth-gate[hidden] { display: none; }
`;

const MARKUP = `
  <div class="auth-gate-card">
    <p class="eyebrow">ACCESO PRIVADO</p>
    <h2>focusboard</h2>
    <p class="auth-gate-copy" data-gate="copy">Verificando sesión…</p>

    <button class="primary-button" type="button" data-gate="google" hidden>
      Iniciar sesión con Google
    </button>
    <button class="auth-gate-toggle" type="button" data-gate="show-phone" hidden>
      O inicia sesión con tu número de teléfono
    </button>

    <form class="auth-gate-phone" data-gate="phone-form" hidden>
      <input type="tel" inputmode="tel" autocomplete="tel" placeholder="+57 300 000 0000" data-gate="phone" />
      <button class="primary-button" type="submit" data-gate="phone-send">Enviar código</button>
      <div data-gate="code-group" hidden style="display:grid;gap:10px">
        <input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6"
          placeholder="Código de 6 dígitos" data-gate="code" />
        <button class="primary-button" type="button" data-gate="verify">Verificar código</button>
      </div>
      <button class="auth-gate-toggle" type="button" data-gate="show-google">← Volver a Google</button>
    </form>

    <div class="auth-gate-recaptcha" data-gate="recaptcha"></div>
  </div>
`;

export function mountAuthGate({ onEnter, onLeave } = {}) {
  if (!document.getElementById("auth-gate-styles")) {
    const style = document.createElement("style");
    style.id = "auth-gate-styles";
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  const gate = document.createElement("div");
  gate.className = "auth-gate";
  gate.innerHTML = MARKUP;
  document.body.appendChild(gate);

  const $ = (name) => gate.querySelector(`[data-gate="${name}"]`);
  const els = {
    copy: $("copy"), google: $("google"), showPhone: $("show-phone"),
    showGoogle: $("show-google"), phoneForm: $("phone-form"), phone: $("phone"),
    phoneSend: $("phone-send"), codeGroup: $("code-group"), code: $("code"),
    verify: $("verify"),
  };

  let entered = false;
  let confirmation = null;

  const setCopy = (text, isError = false) => {
    els.copy.textContent = text;
    els.copy.classList.toggle("is-error", isError);
  };
  const showLoginButtons = () => {
    els.google.hidden = false;
    if (els.phoneForm.hidden) els.showPhone.hidden = false;
  };

  els.google.addEventListener("click", async () => {
    els.google.disabled = true;
    setCopy("Abriendo Google…");
    try {
      await login();
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
      setCopy(`No se pudo iniciar sesión (${err?.code || "error"}).`, true);
      showLoginButtons();
      els.google.disabled = false;
    }
  });

  els.showPhone.addEventListener("click", () => {
    els.google.hidden = true;
    els.showPhone.hidden = true;
    els.phoneForm.hidden = false;
    els.phone.focus();
  });
  els.showGoogle.addEventListener("click", () => {
    els.phoneForm.hidden = true;
    els.codeGroup.hidden = true;
    els.phone.value = "";
    els.code.value = "";
    confirmation = null;
    showLoginButtons();
  });

  els.phoneForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const raw = els.phone.value.trim();
    const phone = (raw.startsWith("+") ? "+" : "") + raw.replace(/\D/g, "");
    if (phone.replace("+", "").length < 8) {
      setCopy("Escribe un número válido con indicativo de país (ej. +57…).", true);
      return;
    }
    els.phoneSend.disabled = true;
    els.phoneSend.textContent = "Enviando…";
    try {
      // RecaptchaVerifier necesita un contenedor con id; se lo damos al vuelo.
      const recaptchaEl = $("recaptcha");
      if (!recaptchaEl.id) recaptchaEl.id = "auth-gate-recaptcha-box";
      confirmation = await sendPhoneCode(phone, recaptchaEl.id);
      els.codeGroup.hidden = false;
      els.code.focus();
      setCopy("Código enviado — revisa tus SMS.");
    } catch (err) {
      console.error("Error enviando código:", err);
      setCopy(`No se pudo enviar el código (${err?.code || "error"}).`, true);
    } finally {
      els.phoneSend.disabled = false;
      els.phoneSend.textContent = "Enviar código";
    }
  });

  els.verify.addEventListener("click", async () => {
    const code = els.code.value.trim();
    if (!confirmation || code.length < 6) {
      setCopy("Escribe el código de 6 dígitos que recibiste.", true);
      return;
    }
    els.verify.disabled = true;
    els.verify.textContent = "Verificando…";
    try {
      await confirmPhoneCode(confirmation, code);
    } catch (err) {
      console.error("Error verificando código:", err);
      setCopy(`Código incorrecto o vencido (${err?.code || "error"}).`, true);
    } finally {
      els.verify.disabled = false;
      els.verify.textContent = "Verificar código";
    }
  });

  consumeRedirectResult().catch((err) => {
    console.error("Error procesando el login:", err);
    setCopy(`No se pudo completar el inicio de sesión (${err?.code || "error"}).`, true);
    showLoginButtons();
  });

  function apply(user, allowed) {
    if (allowed) {
      gate.hidden = true;
      if (!entered) { entered = true; onEnter?.(user); }
      return;
    }
    gate.hidden = false;
    if (entered) { entered = false; onLeave?.(user); }
    els.phoneForm.hidden = true;
    els.codeGroup.hidden = true;
    confirmation = null;
    if (user?.email) {
      setCopy(`La cuenta ${user.email} no tiene acceso.`, true);
    } else if (user?.phoneNumber) {
      setCopy(`El número ${user.phoneNumber} no tiene acceso.`, true);
    } else {
      setCopy("Sección privada. Inicia sesión para ver tu tablero.");
    }
    showLoginButtons();
  }

  if (auth.currentUser) apply(auth.currentUser, isAllowed(auth.currentUser));
  return watchSession(apply);
}
