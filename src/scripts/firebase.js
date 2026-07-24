// Inicialización de Firebase (solo lo necesario: app + Realtime Database).
//
// Nota: estas claves NO son secretas. En apps web de Firebase la apiKey solo
// identifica el proyecto; la seguridad se define en las reglas de la base de
// datos (database.rules.json), no ocultando esta config.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyB2AFYccM_gT3RFBqYw43uGNoF1w4XPsrA",
  // Debe ser el MISMO dominio desde el que se sirve la app (web.app) - es la
  // recomendación oficial de Firebase para evitar el storage partitioning que
  // rompe el login en Safari cuando la app y el authDomain viven en dominios
  // distintos. REQUIERE un paso manual único en Google Cloud Console:
  // autorizar https://focusboard-dev.web.app/__/auth/handler como redirect
  // URI del cliente OAuth (si no, Google devuelve
  // "Error 400: redirect_uri_mismatch"). No revertir a .firebaseapp.com como
  // "arreglo rápido": ese valor reintroduce el fallo de Safari.
  authDomain: "focusboard-dev.web.app",
  databaseURL: "https://focusboard-dev-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "focusboard-dev",
  storageBucket: "focusboard-dev.firebasestorage.app",
  messagingSenderId: "915613495252",
  appId: "1:915613495252:web:6c502164fdd960f096b041",
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
// auth se crea aquí, junto a la app: llamar getAuth() desde otro módulo puede
// fallar con "Component auth has not been registered yet" si el bundler duplica
// instancias del SDK.
export const auth = getAuth(app);
