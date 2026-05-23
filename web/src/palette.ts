import { getAllActions, type Action } from "./actions";
import { loadSettings } from "./settings";

let isOpen = false;
let selectedIndex = 0;
let filteredActions: Action[] = [];

let paletteEl: HTMLDivElement | null = null;
let inputEl: HTMLInputElement | null = null;
let resultsEl: HTMLUListElement | null = null;

export function initPalette(): void {
  paletteEl = document.querySelector<HTMLDivElement>("#commandPalette");
  if (!paletteEl) return;
  
  inputEl = paletteEl.querySelector<HTMLInputElement>("#commandPaletteInput");
  resultsEl = paletteEl.querySelector<HTMLUListElement>("#commandPaletteResults");
  
  const backdrop = paletteEl.querySelector<HTMLDivElement>(".command-palette-backdrop");
  backdrop?.addEventListener("click", () => closePalette());
  
  inputEl?.addEventListener("input", () => {
    filterAndRender();
  });
  
  inputEl?.addEventListener("keydown", (event) => {
    if (!isOpen) return;
    
    if (event.key === "Escape") {
      event.preventDefault();
      closePalette();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex(selectedIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex(selectedIndex - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      executeSelected();
    }
  });
}

export function isPaletteOpen(): boolean {
  return isOpen;
}

export function openPalette(): void {
  if (!paletteEl || !inputEl) return;
  isOpen = true;
  selectedIndex = 0;
  inputEl.value = "";
  paletteEl.hidden = false;
  paletteEl.removeAttribute("hidden");
  filterAndRender();
  inputEl.focus();
}

export function closePalette(): void {
  if (!paletteEl) return;
  isOpen = false;
  paletteEl.hidden = true;
  paletteEl.setAttribute("hidden", "");
  const event = new CustomEvent("command-palette-closed");
  window.dispatchEvent(event);
}

function filterAndRender(): void {
  if (!inputEl || !resultsEl) return;
  const query = inputEl.value.toLowerCase().trim();
  const allActions = getAllActions();
  
  filteredActions = allActions.filter(action => {
    const isEnabled = action.enabled ? action.enabled() : true;
    if (!isEnabled) return false;
    
    const labelMatch = action.label.toLowerCase().includes(query);
    const categoryMatch = action.category.toLowerCase().includes(query);
    const idMatch = action.id.toLowerCase().includes(query);
    
    return labelMatch || categoryMatch || idMatch;
  });
  
  if (selectedIndex >= filteredActions.length) {
    selectedIndex = Math.max(0, filteredActions.length - 1);
  }
  
  renderResults();
}

function setSelectedIndex(index: number): void {
  if (filteredActions.length === 0) {
    selectedIndex = 0;
    return;
  }
  selectedIndex = (index + filteredActions.length) % filteredActions.length;
  renderResults();
  
  const activeItem = resultsEl?.querySelector(".command-palette-item.selected");
  if (activeItem) {
    activeItem.scrollIntoView({ block: "nearest" });
  }
}

function renderResults(): void {
  if (!resultsEl) return;
  resultsEl.innerHTML = "";
  
  if (filteredActions.length === 0) {
    const emptyLi = document.createElement("li");
    emptyLi.className = "command-palette-empty";
    emptyLi.textContent = "No matching actions";
    resultsEl.appendChild(emptyLi);
    return;
  }
  
  const settings = loadSettings();
  
  filteredActions.forEach((action, index) => {
    const li = document.createElement("li");
    li.className = `command-palette-item${index === selectedIndex ? " selected" : ""}`;
    
    const customKey = settings.keybindings?.[action.id];
    const keybinding = customKey !== undefined ? customKey : (action.defaultKeys || "");
    
    li.innerHTML = `
      <div class="item-label">
        <span class="item-category">${action.category}</span>
        <span>${action.label}</span>
      </div>
      ${keybinding ? `<kbd class="item-keybinding">${keybinding}</kbd>` : ""}
    `;
    
    li.addEventListener("click", () => {
      selectedIndex = index;
      executeSelected();
    });
    
    resultsEl!.appendChild(li);
  });
}

function executeSelected(): void {
  const action = filteredActions[selectedIndex];
  if (action) {
    closePalette();
    void action.handler();
  }
}
