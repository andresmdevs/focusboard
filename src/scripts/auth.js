// Login con Google para las secciones privadas (radar de empleo).
//
// IMPORTANTE: esto es la capa de interfaz, NO la seguridad real. Cualquiera
// puede descargar este bundle y saltarse la UI. La seguridad de verdad está en
// database.rules.json, que repite la misma comprobación del lado del servidor:
// si el correo no coincide, Firebase deniega los datos aunque la UI se burle.
// Si cambias ALLOWED_EMAILS aquí, cámbialo también en database.rules.json.
//
// Se usa signInWithRedirect (no signInWithPopup): el popup depende de cookies
// de terceros y de comunicación entre ventanas (postMessage), que Chrome y
// varias extensiones de privacidad bloquean cada vez más - cuando eso pasa,
// el popup se completa visualmente pero la promesa nunca se resuelve, sin
// ningún error visible. El redirect navega la página completa y vuelve, sin
// depender de esos canales.
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { auth } from "./firebase.js";

/** Cuentas con acceso. Debe coincidir con database.rules.json. */
export const ALLOWED_EMAILS = ["andreshcp@gmail.com"];
/** Teléfonos con acceso, en formato E.164. Debe coincidir con database.rules.json. */
export const ALLOWED_PHONES = ["+573008427074"];

export { auth };
auth.languageCode = "es";

const provider = new GoogleAuthProvider();
// Fuerza el selector de cuenta: evita entrar con una sesión de Google ajena
// que ya estuviera abierta en el navegador.
provider.setCustomParameters({ prompt: "select_account" });

export const isAllowed = (user) =>
  Boolean(user) &&
  ((Boolean(user.email) && user.emailVerified && ALLOWED_EMAILS.includes(user.email)) ||
    (Boolean(user.phoneNumber) && ALLOWED_PHONES.includes(user.phoneNumber)));

// Popup primero, redirect como respaldo.
//
// Ahora que authDomain es el mismo dominio de la app, el popup es fiable
// (antes fallaba en silencio por el aislamiento de almacenamiento entre
// dominios) y evita el error "missing initial state" que Safari lanza con
// redirect en entornos con storage particionado. El redirect queda como
// respaldo para cuando el navegador bloquea popups (típico en móvil).
const REDIRECT_FALLBACK_CODES = [
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
  "auth/cancelled-popup-request",
];

export async function login() {
  try {
    return await signInWithPopup(auth, provider);
  } catch (err) {
    if (REDIRECT_FALLBACK_CODES.includes(err?.code)) {
      return signInWithRedirect(auth, provider);
    }
    throw err;
  }
}

export const logout = () => signOut(auth);

let recaptcha = null;

/** Crea (una sola vez) el verificador reCAPTCHA invisible en el contenedor dado. */
function getRecaptcha(containerId) {
  if (!recaptcha) {
    recaptcha = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
  }
  return recaptcha;
}

/** Envía el código SMS. Devuelve un confirmationResult para pasar a confirmPhoneCode. */
export const sendPhoneCode = (phoneNumber, containerId) =>
  signInWithPhoneNumber(auth, phoneNumber, getRecaptcha(containerId));

export const confirmPhoneCode = (confirmationResult, code) =>
  confirmationResult.confirm(code);

/** Recoge el resultado del redirect al volver de Google. Llamar una vez al
 * cargar la página; lanza el FirebaseError si el login falló (dominio no
 * autorizado, popup/redirect bloqueado, etc.) para que la UI lo muestre. */
export const consumeRedirectResult = () => getRedirectResult(auth);

/** Llama a `cb(user, allowed)` en cada cambio de sesión. Devuelve el unsubscribe. */
export const watchSession = (cb) =>
  onAuthStateChanged(auth, (user) => cb(user, isAllowed(user)));
