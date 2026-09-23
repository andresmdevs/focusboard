import { db } from "./firebase.js";
import { ref, onValue, set, update, remove } from "firebase/database";
import { registerServiceWorker } from "./sw.js";
import { mountAuthGate } from "./gate.js";
import { logout } from "./auth.js";

const THEME_KEY = "focusboard.theme.v1";
const tasksRef = ref(db, "tasks");

const STATUSES = {
  todo: "Pendiente",
  progress: "En progreso",
  testing: "Pruebas",
  done: "Finalizado",
};

const PRIORITIES = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

// Involucrados: mismos límites que database.rules.json (tasks/$id/people).
const MAX_PEOPLE = 20;
const MAX_PERSON_LENGTH = 40;
const MAX_AVATARS = 3;

let tasks = [];
let formPeople = [];
let gate = null;
let retryOnDenied = true;
let activeStatus = "todo";
let toastTimer;
let touchDrag = null;

const dialog = document.querySelector("#task-dialog");
const form = document.querySelector("#task-form");
const taskTemplate = document.querySelector("#task-template");
const peopleInput = document.querySelector("#task-people-input");
const peopleChips = document.querySelector("#task-people-chips");
const peopleSuggestions = document.querySelector("#people-suggestions");
const searchInput = document.querySelector("#search-input");
const priorityFilter = document.querySelector("#priority-filter");

function subscribeTasks() {
  // Fuente de verdad: Realtime Database. Cualquier cambio (local o de otro
  // dispositivo) llega por aquí y re-renderiza el tablero en tiempo real.
  // Devuelve la función para cancelar la suscripción (al cerrar sesión).
  return onValue(
    tasksRef,
    (snapshot) => {
      const value = snapshot.val();
      tasks = value ? Object.values(value).map(normalizeTask) : [];
      retryOnDenied = true;
      render();
    },
    (err) => {
      console.error("Error leyendo tareas:", err);
      const denied = err.code === "PERMISSION_DENIED";
      showToast(denied ? "Tu número no tiene permisos para este tablero." : "Sin conexión con la base de datos.");
      // Firebase cancela el listener cuando la sesión pierde el permiso (p. ej.
      // quitaron el número de boardMembers): se re-verifica el acceso, lo que
      // muestra el gate o, si el número volvió a la lista, re-suscribe. Una sola
      // vez seguida, para no entrar en bucle si el permiso falla por otra causa.
      if (denied && retryOnDenied) {
        retryOnDenied = false;
        gate?.recheck();
      }
    }
  );
}

// RTDB guarda los arrays como objetos con llaves numéricas: una lista con
// huecos (o editada a mano en la consola) llega como objeto. Se normaliza aquí
// para que el render nunca reciba algo que no sea una lista de textos.
function asTextList(value) {
  const items = Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : [];
  return items.filter((item) => typeof item === "string" && item);
}

function normalizeTask(task) {
  return { ...task, tags: asTextList(task.tags), people: asTextList(task.people) };
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(date).replace(".", "");
}

function dateState(dateString) {
  if (!dateString) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dateString}T00:00:00`);
  if (due.getTime() === today.getTime()) return "today";
  if (due < today) return "overdue";
  return "";
}

function setTodayLabel() {
  const label = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" })
    .format(new Date())
    .replace(/^./, (letter) => letter.toUpperCase());
  document.querySelector("#today-label").textContent = label;
}

function getFilteredTasks() {
  const query = searchInput.value.trim().toLocaleLowerCase("es");
  const priority = priorityFilter.value;
  return tasks.filter((task) => {
    const haystack = [task.title, task.description, ...(task.tags || []), ...(task.people || [])].join(" ").toLocaleLowerCase("es");
    return (!query || haystack.includes(query)) && (priority === "all" || task.priority === priority);
  });
}

// Compara nombres sin distinguir mayúsculas ni tildes: "andres" = "Andrés".
const samePerson = (a, b) => a.localeCompare(b, "es", { sensitivity: "base" }) === 0;

function cleanPersonName(name) {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_PERSON_LENGTH);
}

function personInitials(name) {
  const words = name.split(" ").filter(Boolean);
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked.map((word) => Array.from(word)[0]).join("").toLocaleUpperCase("es");
}

// Color estable por nombre (la misma persona siempre sale igual en todas las tarjetas).
function personTone(name) {
  const key = name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es");
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.codePointAt(0)) % 9973;
  return hash % 3;
}

function peopleSummary(people) {
  if (people.length === 1) return people[0];
  if (people.length === 2) return `${people[0]} y ${people[1]}`;
  return `${people[0]} y ${people.length - 1} más`;
}

function renderTaskPeople(container, people) {
  if (!people.length) return;
  const stack = document.createElement("span");
  stack.className = "avatar-stack";
  stack.setAttribute("aria-hidden", "true");
  const overflow = people.length > MAX_AVATARS;
  people.slice(0, overflow ? MAX_AVATARS - 1 : MAX_AVATARS).forEach((name) => {
    const avatar = document.createElement("span");
    avatar.className = `avatar avatar-tone-${personTone(name)}`;
    avatar.textContent = personInitials(name);
    stack.append(avatar);
  });
  if (overflow) {
    const more = document.createElement("span");
    more.className = "avatar avatar-more";
    more.textContent = `+${people.length - (MAX_AVATARS - 1)}`;
    stack.append(more);
  }
  const label = document.createElement("span");
  label.className = "people-label";
  label.textContent = peopleSummary(people);
  label.setAttribute("aria-hidden", "true");
  const spoken = document.createElement("span");
  spoken.className = "sr-only";
  spoken.textContent = `${people.length === 1 ? "Involucrado" : `${people.length} involucrados`}: ${new Intl.ListFormat("es").format(people)}`;
  container.title = people.join(", ");
  container.append(stack, label, spoken);
}

function renderTask(task) {
  const fragment = taskTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".task-card");
  const badge = fragment.querySelector(".priority-badge");
  const title = fragment.querySelector("h3");
  const description = fragment.querySelector(".task-description");
  const tags = fragment.querySelector(".task-tags");
  const people = fragment.querySelector(".task-people");
  const due = fragment.querySelector(".due-date");
  const statusSelect = fragment.querySelector(".status-select");
  const menu = fragment.querySelector(".task-menu");

  card.dataset.taskId = task.id;
  card.draggable = false;
  card.setAttribute("aria-label", `Tarea: ${task.title}`);
  badge.classList.add(`priority-${task.priority}`);
  badge.textContent = PRIORITIES[task.priority];
  title.textContent = task.title;
  description.textContent = task.description || "";
  (task.tags || []).forEach((tag) => {
    const item = document.createElement("span");
    item.className = "tag";
    item.textContent = tag;
    tags.append(item);
  });
  renderTaskPeople(people, task.people || []);

  if (task.dueDate) {
    const state = dateState(task.dueDate);
    due.className = `due-date ${state}`;
    due.textContent = state === "today" ? "Vence hoy" : `${state === "overdue" ? "Venció " : ""}${formatDate(task.dueDate)}`;
  }

  Object.entries(STATUSES).forEach(([value, label]) => {
    const option = new Option(label, value, false, value === task.status);
    statusSelect.add(option);
  });
  statusSelect.addEventListener("change", () => updateStatus(task.id, statusSelect.value));
  menu.addEventListener("click", () => openForm(task));
  card.addEventListener("dblclick", () => openForm(task));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter") openForm(task);
  });
  attachDragEvents(card, task.id);
  return fragment;
}

function render() {
  const filtered = getFilteredTasks();
  Object.keys(STATUSES).forEach((status) => {
    const list = document.querySelector(`[data-list-for="${status}"]`);
    const statusTasks = filtered
      .filter((task) => task.status === status)
      .sort((a, b) => {
        const byDate = (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
        return byDate !== 0 ? byDate : (a.createdAt || "").localeCompare(b.createdAt || "");
      });
    list.replaceChildren(...statusTasks.map(renderTask));
    if (!statusTasks.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = filtered.length ? "No hay tareas con este estado." : "No hay coincidencias con los filtros.";
      list.append(empty);
    }
    document.querySelector(`[data-count-for="${status}"]`).textContent = tasks.filter((task) => task.status === status).length;
    document.querySelector(`#metric-${status}`).textContent = tasks.filter((task) => task.status === status).length;
  });
  const active = tasks.filter((task) => task.status === "progress" || task.status === "testing");
  document.querySelector("#focus-count").textContent = `${active.length} ${active.length === 1 ? "tarea activa" : "tareas activas"}`;
  document.querySelector("#focus-summary").textContent = active.length
    ? `Sigue con: ${active[0].title}`
    : "Elige una tarea pendiente para avanzar.";
}

/** Nombres usados en el tablero (sin repetir), para autocompletar. */
function knownPeople(excludeTaskId = null) {
  const names = [];
  tasks.forEach((task) => task.id !== excludeTaskId && (task.people || []).forEach((name) => {
    if (!names.some((known) => samePerson(known, name))) names.push(name);
  }));
  return names.sort((a, b) => a.localeCompare(b, "es"));
}

function refreshPeopleSuggestions() {
  const options = knownPeople()
    .filter((name) => !formPeople.some((person) => samePerson(person, name)))
    .map((name) => new Option(name, name));
  peopleSuggestions.replaceChildren(...options);
}

function renderPersonChip(name) {
  const chip = document.createElement("li");
  chip.className = "person-chip";
  chip.append(name);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "person-chip-remove";
  remove.setAttribute("aria-label", `Quitar a ${name}`);
  remove.textContent = "×";
  remove.addEventListener("click", () => {
    formPeople = formPeople.filter((person) => person !== name);
    chip.remove();
    announcePeople(`Se quitó ${name}.`);
    refreshPeopleSuggestions();
    peopleInput.focus();
  });
  chip.append(remove);
  return chip;
}

// Los chips se agregan/quitan uno a uno (nunca se re-renderiza la lista): si el
// blur del input añade un nombre justo cuando se hace clic en la × de otro chip,
// ese botón sigue en el DOM y el clic no se pierde.
function addPeople(rawNames) {
  // Sin la tarea que se está editando: así se puede corregir la escritura de un
  // nombre que solo existe en ella (p. ej. "andres" -> "Andrés").
  const known = knownPeople(document.querySelector("#task-id").value || null);
  const added = [];
  let overflowed = false;
  rawNames.map(cleanPersonName).filter(Boolean).forEach((raw) => {
    if (formPeople.some((person) => samePerson(person, raw))) return;
    if (formPeople.length >= MAX_PEOPLE) {
      overflowed = true;
      return;
    }
    // Si la persona ya existe en el tablero con otra escritura, se reutiliza esa.
    const name = known.find((existing) => samePerson(existing, raw)) || raw;
    formPeople.push(name);
    peopleChips.append(renderPersonChip(name));
    added.push(name);
  });
  if (overflowed) showToast(`Máximo ${MAX_PEOPLE} personas por tarea.`);
  if (added.length) announcePeople(`Se añadió ${new Intl.ListFormat("es").format(added)}.`);
  refreshPeopleSuggestions();
}

// Los lectores de pantalla no "ven" aparecer o desaparecer un chip: se anuncia.
function announcePeople(message) {
  document.querySelector("#task-people-status").textContent = message;
}

function removeLastPerson() {
  const name = formPeople.pop();
  peopleChips.lastElementChild?.remove();
  announcePeople(`Se quitó ${name}.`);
  refreshPeopleSuggestions();
}

function commitPeopleInput() {
  addPeople(peopleInput.value.split(/[,;]/));
  peopleInput.value = "";
}

function setFormPeople(names) {
  formPeople = [];
  peopleChips.replaceChildren();
  announcePeople("");
  names.forEach((name) => {
    if (formPeople.some((person) => samePerson(person, name))) return;
    formPeople.push(name);
    peopleChips.append(renderPersonChip(name));
  });
  refreshPeopleSuggestions();
}

function openForm(task = null, status = activeStatus) {
  form.reset();
  document.querySelector("#task-id").value = task?.id || "";
  document.querySelector("#task-title").value = task?.title || "";
  document.querySelector("#task-description").value = task?.description || "";
  document.querySelector("#task-status").value = task?.status || status;
  document.querySelector("#task-priority").value = task?.priority || "medium";
  document.querySelector("#task-due-date").value = task?.dueDate || "";
  document.querySelector("#task-tags").value = task?.tags?.join(", ") || "";
  setFormPeople(task?.people || []);
  document.querySelector("#dialog-title").textContent = task ? "Editar tarea" : "Nueva tarea";
  document.querySelector("#delete-task").hidden = !task;
  dialog.showModal();
  document.querySelector("#task-title").focus();
}

function closeForm() {
  dialog.close();
}

function updateStatus(id, status) {
  const currentTask = tasks.find((task) => task.id === id);
  if (!currentTask || currentTask.status === status) return;
  update(ref(db, `tasks/${id}`), { status }).catch((err) => {
    console.error("Error moviendo la tarea:", err);
    showToast("No se pudo mover la tarea.");
  });
  showToast(`Movida a ${STATUSES[status].toLocaleLowerCase("es")}.`);
}

function attachDragEvents(card, id) {
  card.addEventListener("pointerdown", (event) => beginTouchDrag(event, card, id));
  card.addEventListener("mousedown", (event) => beginTouchDrag(event, card, id));
}

function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(target.closest("button, select, input, textarea, a"));
}

function clearDropTargets() {
  document.querySelectorAll(".board-column.is-drop-target").forEach((column) => column.classList.remove("is-drop-target"));
}

function beginTouchDrag(event, card, id) {
  if (touchDrag) return;
  if (isInteractiveTarget(event.target) || (event.pointerType === "mouse" && event.button !== 0)) return;
  touchDrag = {
    id,
    card,
    pointerId: event.pointerId ?? "mouse",
    startX: event.clientX,
    startY: event.clientY,
    isDragging: false,
    ghost: null,
    target: null,
  };
  if (event.pointerId !== undefined) card.setPointerCapture(event.pointerId);
}

function moveTouchDrag(event) {
  if (!touchDrag || (event.pointerId ?? "mouse") !== touchDrag.pointerId) return;
  const movedFarEnough = Math.hypot(event.clientX - touchDrag.startX, event.clientY - touchDrag.startY) > 9;
  if (!touchDrag.isDragging && !movedFarEnough) return;
  if (!touchDrag.isDragging) startTouchDrag();
  event.preventDefault();
  positionDragGhost(event.clientX, event.clientY);
  updateTouchDropTarget(event.clientX, event.clientY);
  autoScrollBoard(event.clientX);
}

function startTouchDrag() {
  touchDrag.isDragging = true;
  touchDrag.card.classList.add("is-dragging");
  touchDrag.ghost = touchDrag.card.cloneNode(true);
  touchDrag.ghost.className = "drag-ghost";
  touchDrag.ghost.removeAttribute("id");
  document.body.append(touchDrag.ghost);
  document.body.classList.add("is-touch-dragging");
}

function positionDragGhost(x, y) {
  if (!touchDrag?.ghost) return;
  touchDrag.ghost.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
}

function updateTouchDropTarget(x, y) {
  const target = document.elementFromPoint(x, y)?.closest(".board-column");
  if (target === touchDrag.target) return;
  clearDropTargets();
  touchDrag.target = target || null;
  touchDrag.target?.classList.add("is-drop-target");
}

function autoScrollBoard(x) {
  const board = document.querySelector("#board");
  const bounds = board.getBoundingClientRect();
  const edge = 42;
  if (x < bounds.left + edge) board.scrollLeft -= 11;
  if (x > bounds.right - edge) board.scrollLeft += 11;
}

function endTouchDrag(event) {
  if (!touchDrag || (event.pointerId ?? "mouse") !== touchDrag.pointerId) return;
  const drag = touchDrag;
  if (drag.isDragging && drag.target) updateStatus(drag.id, drag.target.dataset.status);
  drag.ghost?.remove();
  drag.card.classList.remove("is-dragging");
  document.body.classList.remove("is-touch-dragging");
  clearDropTargets();
  touchDrag = null;
}

function deleteTask() {
  const id = document.querySelector("#task-id").value;
  if (!id) return;
  remove(ref(db, `tasks/${id}`)).catch((err) => {
    console.error("Error eliminando la tarea:", err);
    showToast("No se pudo eliminar la tarea.");
  });
  closeForm();
  showToast("Tarea eliminada.");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function initializeTheme() {
  const theme = localStorage.getItem(THEME_KEY) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
}

function toggleTheme() {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

peopleInput.addEventListener("keydown", (event) => {
  if (event.isComposing || event.keyCode === 229) return;
  if (event.key === "Enter" && peopleInput.value.trim()) {
    // Enter con texto añade el nombre en vez de enviar el formulario.
    event.preventDefault();
    commitPeopleInput();
  } else if (event.key === "Backspace" && !event.repeat && !peopleInput.value && formPeople.length) {
    // Sin auto-repetición: mantener Backspace para borrar el texto no se lleva
    // de paso todos los nombres.
    removeLastPerson();
  }
});
peopleInput.addEventListener("input", (event) => {
  // La coma (tecleada o pegada) separa nombres. Se revisa en `input` y no en
  // keydown porque los teclados móviles no siempre reportan qué tecla fue.
  if (/[,;]/.test(peopleInput.value)) {
    const parts = peopleInput.value.split(/[,;]/);
    const rest = parts.pop();
    addPeople(parts);
    peopleInput.value = rest.trimStart();
    return;
  }
  // Elegir una sugerencia del datalist llega como reemplazo de texto: se añade
  // de una. Se exige que coincida con una sugerencia para no confundirlo con el
  // autocorrector del teclado, que también reemplaza texto.
  const replaced = !(event instanceof InputEvent) || event.inputType === "insertReplacementText";
  if (replaced && [...peopleSuggestions.options].some((option) => option.value === peopleInput.value)) {
    commitPeopleInput();
  }
});
peopleInput.addEventListener("paste", (event) => {
  // Una lista pegada ("Ana, Luis" o un nombre por línea) se reparte aquí: si
  // se dejara al navegador, el maxlength del input la cortaría a 40 caracteres.
  const text = event.clipboardData?.getData("text") ?? "";
  if (!/[,;\r\n\t]/.test(text)) return;
  event.preventDefault();
  const parts = (peopleInput.value + text).split(/[,;\r\n\t]/);
  peopleInput.value = parts.pop().trimStart().slice(0, MAX_PERSON_LENGTH);
  addPeople(parts);
});
peopleInput.closest(".people-input").addEventListener("click", (event) => {
  if (event.target === event.currentTarget || event.target === peopleChips) peopleInput.focus();
});
peopleInput.addEventListener("blur", () => {
  // Salir del campo confirma lo escrito; cambiar de ventana no.
  if (document.hasFocus()) commitPeopleInput();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  commitPeopleInput();
  const id = document.querySelector("#task-id").value;
  const existing = id ? tasks.find((item) => item.id === id) : null;
  const task = {
    id: id || crypto.randomUUID(),
    title: document.querySelector("#task-title").value.trim(),
    description: document.querySelector("#task-description").value.trim(),
    status: document.querySelector("#task-status").value,
    priority: document.querySelector("#task-priority").value,
    dueDate: document.querySelector("#task-due-date").value,
    tags: document.querySelector("#task-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    people: [...formPeople],
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  if (!task.title) return;
  // Sin await: offline la promesa no resuelve hasta reconectar y el diálogo
  // debe cerrarse igual. Si las reglas la rechazan, se avisa y se reabre con
  // lo escrito para no perderlo.
  set(ref(db, `tasks/${task.id}`), task).catch((err) => {
    console.error("Error guardando la tarea:", err);
    showToast("No se pudo guardar la tarea.");
    if (!dialog.open) openForm(task);
  });
  closeForm();
  showToast(id ? "Tarea actualizada." : "Tarea creada.");
});

document.querySelector("#open-task-form").addEventListener("click", () => openForm());
document.querySelector("#close-dialog").addEventListener("click", closeForm);
document.querySelector("#cancel-dialog").addEventListener("click", closeForm);
document.querySelector("#delete-task").addEventListener("click", deleteTask);
document.querySelector("#theme-toggle").addEventListener("click", toggleTheme);
document.querySelectorAll("[data-add-for]").forEach((button) => button.addEventListener("click", () => {
  activeStatus = button.dataset.addFor;
  openForm(null, activeStatus);
}));
searchInput.addEventListener("input", render);
priorityFilter.addEventListener("change", render);
document.querySelector("#clear-filters").addEventListener("click", () => {
  searchInput.value = "";
  priorityFilter.value = "all";
  render();
});
document.addEventListener("pointermove", moveTouchDrag, { passive: false });
document.addEventListener("pointerup", endTouchDrag);
document.addEventListener("pointercancel", endTouchDrag);
document.addEventListener("mousemove", moveTouchDrag, { passive: false });
document.addEventListener("mouseup", endTouchDrag);

initializeTheme();
setTodayLabel();
render();

// El tablero vive tras un login por teléfono (gate.js): las reglas de RTDB solo
// dejan leer/escribir `tasks` al dueño o a un número de `boardMembers`.
// subscribeTasks() solo se engancha con sesión válida y se corta al salir.
let tasksUnsub = null;
const logoutBtn = document.querySelector("#board-logout");
logoutBtn?.addEventListener("click", () => logout());
gate = mountAuthGate({
  onEnter: () => {
    if (!tasksUnsub) tasksUnsub = subscribeTasks();
    if (logoutBtn) logoutBtn.hidden = false;
  },
  onLeave: () => {
    if (tasksUnsub) { tasksUnsub(); tasksUnsub = null; }
    if (logoutBtn) logoutBtn.hidden = true;
    tasks = [];
    render();
  },
});

// Solo en producción: en `astro dev` el SW cachea agresivamente y sirve JS/CSS
// viejo tras cada cambio, incluso en páginas que no lo registran directamente
// (su scope es "/", así que cubre todo el origen una vez instalado).
registerServiceWorker();
