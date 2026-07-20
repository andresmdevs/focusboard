// Inicialización de Firebase (solo lo necesario: app + Realtime Database).
//
// Nota: estas claves NO son secretas. En apps web de Firebase la apiKey solo
// identifica el proyecto; la seguridad se define en las reglas de la base de
// datos (database.rules.json), no ocultando esta config.
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyB2AFYccM_gT3RFBqYw43uGNoF1w4XPsrA",
  authDomain: "focusboard-dev.firebaseapp.com",
  databaseURL: "https://focusboard-dev-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "focusboard-dev",
  storageBucket: "focusboard-dev.firebasestorage.app",
  messagingSenderId: "915613495252",
  appId: "1:915613495252:web:6c502164fdd960f096b041",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
