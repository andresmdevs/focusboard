import { db } from "./firebase.js";
import { ref, onValue, set, update, remove } from "firebase/database";

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

let tasks = [];
let activeStatus = "todo";
let toastTimer;
let touchDrag = null;

const dialog = document.querySelector("#task-dialog");
const form = document.querySelector("#task-form");
const taskTemplate = document.querySelector("#task-template");
const searchInput = document.querySelector("#search-input");
const priorityFilter = document.querySelector("#priority-filter");

function subscribeTasks() {
  // Fuente de verdad: Realtime Database. Cualquier cambio (local o de otro
  // dispositivo) llega por aquí y re-renderiza el tablero en tiempo real.
  onValue(
    tasksRef,
    (snapshot) => {
      const value = snapshot.val();
      tasks = value ? Object.values(value) : [];
      render();
    },
    () => showToast("Sin conexión con la base de datos.")
  );
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
    const haystack = [task.title, task.description, ...(task.tags || [])].join(" ").toLocaleLowerCase("es");
    return (!query || haystack.includes(query)) && (priority === "all" || task.priority === priority);
  });
}

function renderTask(task) {
  const fragment = taskTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".task-card");
  const badge = fragment.querySelector(".priority-badge");
  const title = fragment.querySelector("h3");
  const description = fragment.querySelector(".task-description");
  const tags = fragment.querySelector(".task-tags");
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

function openForm(task = null, status = activeStatus) {
  form.reset();
  document.querySelector("#task-id").value = task?.id || "";
  document.querySelector("#task-title").value = task?.title || "";
  document.querySelector("#task-description").value = task?.description || "";
  document.querySelector("#task-status").value = task?.status || status;
  document.querySelector("#task-priority").value = task?.priority || "medium";
  document.querySelector("#task-due-date").value = task?.dueDate || "";
  document.querySelector("#task-tags").value = task?.tags?.join(", ") || "";
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
  update(ref(db, `tasks/${id}`), { status });
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
  remove(ref(db, `tasks/${id}`));
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

form.addEventListener("submit", (event) => {
  event.preventDefault();
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
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  if (!task.title) return;
  set(ref(db, `tasks/${task.id}`), task);
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
subscribeTasks();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js"));
}
