// Overlay de login del tablero: solo por número de teléfono autorizado.
//
// IMPORTANTE: esto es capa de interfaz, NO la seguridad. La seguridad real está
// en database.rules.json: `tasks` solo se deja leer/escribir por el dueño o por
// un teléfono registrado en `boardMembers`. El gate consulta esa misma lista
// ANTES de mandar el SMS, para que un número no autorizado ni reciba código.
//
// El radar (/empleo) NO usa este gate: sigue siendo solo del dueño.
//
// Uso:
//   import { mountAuthGate } from "./gate.js";
//   const gate = mountAuthGate({ onEnter: (user) => {...}, onLeave: (user) => {...} });
//   gate.recheck();  // vuelve a verificar el acceso (p. ej. si Firebase lo negó)
import { ref, get } from "firebase/database";
import { db } from "./firebase.js";
import {
  auth, isAllowed, ALLOWED_PHONES, watchSession, sendPhoneCode, confirmPhoneCode,
} from "./auth.js";

/** Indicativo que se asume cuando el número se escribe sin "+". */
const DEFAULT_COUNTRY_CODE = "+57";

/** Normaliza lo que escribe la persona a E.164 (+573001234567). */
export function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) return `+${digits}`;
  // "0057…" es la forma de marcar internacional sin "+".
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  // 10 dígitos sin indicativo = número local (móvil colombiano).
  if (digits.length === 10) return `${DEFAULT_COUNTRY_CODE}${digits}`;
  return `+${digits}`;
}

/** ¿Este número puede entrar al tablero? El dueño siempre; el resto, si está en boardMembers. */
async function isBoardPhone(phone) {
  if (ALLOWED_PHONES.includes(phone)) return true;
  const snapshot = await get(ref(db, `boardMembers/${phone}`));
  return snapshot.val() === true;
}

/** Acceso al tablero de una sesión: el dueño (correo o teléfono) o un teléfono autorizado. */
async function hasBoardAccess(user) {
  if (!user) return false;
  if (isAllowed(user)) return true;
  return Boolean(user.phoneNumber) && isBoardPhone(user.phoneNumber);
}

/** Mensaje para la persona según el error de Firebase al pedir el SMS. */
function sendCodeErrorMessage(err) {
  switch (err?.code) {
    // Spark permite 10 SMS al día por proyecto; se renueva al día siguiente.
    case "auth/quota-exceeded":
      return "Se agotó el cupo de códigos SMS de hoy. Intenta de nuevo mañana.";
    case "auth/too-many-requests":
      return "Demasiados intentos desde este dispositivo. Espera un rato y vuelve a intentar.";
    case "auth/invalid-phone-number":
      return "Ese número no es válido. Revisa que esté completo (ej. 300 000 0000).";
    case "auth/captcha-check-failed":
      return "No se pudo validar el reCAPTCHA. Recarga la página e intenta de nuevo.";
    default:
      return `No se pudo enviar el código (${err?.code || "error"}).`;
  }
}

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
    <p class="auth-gate-copy" data-gate="copy" role="status" aria-live="polite">Verificando sesión…</p>

    <form class="auth-gate-phone" data-gate="phone-form" hidden>
      <label class="sr-only" for="auth-gate-phone-input">Número de teléfono</label>
      <input id="auth-gate-phone-input" type="tel" inputmode="tel" autocomplete="tel"
        placeholder="300 000 0000" data-gate="phone" />
      <button class="primary-button" type="submit" data-gate="phone-send">Enviar código</button>
      <div data-gate="code-group" hidden style="display:grid;gap:10px">
        <label class="sr-only" for="auth-gate-code-input">Código de verificación</label>
        <input id="auth-gate-code-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6"
          placeholder="Código de 6 dígitos" data-gate="code" />
        <button class="primary-button" type="button" data-gate="verify">Verificar código</button>
        <button class="auth-gate-toggle" type="button" data-gate="change-phone">Usar otro número</button>
      </div>
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
    copy: $("copy"), phoneForm: $("phone-form"), phone: $("phone"),
    phoneSend: $("phone-send"), codeGroup: $("code-group"), code: $("code"),
    verify: $("verify"), changePhone: $("change-phone"),
  };

  let entered = false;
  let confirmation = null;
  // Cada cambio de sesión dispara una verificación asíncrona (consulta
  // boardMembers); este contador descarta respuestas de sesiones ya viejas.
  let checkSeq = 0;
  let lastCheckFailed = false;

  const setCopy = (text, isError = false) => {
    els.copy.textContent = text;
    els.copy.classList.toggle("is-error", isError);
  };
  const resetCodeStep = () => {
    els.codeGroup.hidden = true;
    els.code.value = "";
    els.phone.disabled = false;
    els.phoneSend.hidden = false;
    confirmation = null;
  };

  els.changePhone.addEventListener("click", () => {
    resetCodeStep();
    setCopy("Escribe tu número autorizado.");
    els.phone.focus();
  });

  els.phoneForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const phone = normalizePhone(els.phone.value);
    if (phone.replace("+", "").length < 10) {
      setCopy("Escribe un número válido (ej. 300 000 0000).", true);
      return;
    }
    els.phoneSend.disabled = true;
    els.phoneSend.textContent = "Verificando…";
    try {
      // Filtro antes del SMS: un número fuera de la lista ni recibe código.
      if (!(await isBoardPhone(phone))) {
        setCopy(`El número ${phone} no está autorizado para este tablero.`, true);
        return;
      }
      els.phoneSend.textContent = "Enviando…";
      // RecaptchaVerifier necesita un contenedor con id; se lo damos al vuelo.
      const recaptchaEl = $("recaptcha");
      if (!recaptchaEl.id) recaptchaEl.id = "auth-gate-recaptcha-box";
      confirmation = await sendPhoneCode(phone, recaptchaEl.id);
      els.phone.disabled = true;
      els.phoneSend.hidden = true;
      els.codeGroup.hidden = false;
      els.code.focus();
      setCopy(`Código enviado a ${phone} — revisa tus SMS.`);
    } catch (err) {
      console.error("Error enviando código:", err);
      setCopy(sendCodeErrorMessage(err), true);
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
      // Éxito: watchSession() detecta la nueva sesión y apply() abre el tablero.
      await confirmPhoneCode(confirmation, code);
    } catch (err) {
      console.error("Error verificando código:", err);
      setCopy(`Código incorrecto o vencido (${err?.code || "error"}).`, true);
    } finally {
      els.verify.disabled = false;
      els.verify.textContent = "Verificar código";
    }
  });
  els.code.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      els.verify.click();
    }
  });

  async function apply(user) {
    const seq = ++checkSeq;
    let allowed = false;
    let failed = false;
    try {
      allowed = await hasBoardAccess(user);
    } catch (err) {
      console.error("Error verificando el acceso al tablero:", err);
      failed = true;
    }
    if (seq !== checkSeq) return;
    lastCheckFailed = failed;

    if (allowed) {
      gate.hidden = true;
      if (!entered) { entered = true; onEnter?.(user); }
      return;
    }
    gate.hidden = false;
    if (entered) { entered = false; onLeave?.(user); }
    resetCodeStep();
    els.phoneForm.hidden = false;
    if (failed) {
      setCopy("No se pudo verificar el acceso. Revisa tu conexión.", true);
    } else if (user?.phoneNumber) {
      setCopy(`El número ${user.phoneNumber} no tiene acceso a este tablero.`, true);
    } else if (user?.email) {
      setCopy(`La cuenta ${user.email} no tiene acceso. Entra con tu número autorizado.`, true);
    } else {
      setCopy("Tablero privado. Entra con tu número de teléfono autorizado.");
    }
  }

  // Si la verificación falló por red, reintenta al volver la conexión. Solo en
  // ese caso: sin sesión, apply() reinicia el formulario y se perdería el paso
  // del código SMS que esté en curso.
  window.addEventListener("online", () => {
    if (!entered && lastCheckFailed) apply(auth.currentUser);
  });

  const unsubscribe = watchSession((user) => apply(user));
  return {
    unsubscribe,
    // Re-verifica la sesión actual desde cero: si sigue teniendo acceso vuelve
    // a llamar onEnter (re-suscribe); si no, muestra el gate.
    recheck() {
      if (entered) { entered = false; onLeave?.(auth.currentUser); }
      return apply(auth.currentUser);
    },
  };
}
