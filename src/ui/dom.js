export const byId = (id) => document.getElementById(id);

export function tileButton({ key, label, icon, shortcut = '' }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tile';
  button.dataset.key = key;
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = `${icon}<span class="tile-name">${label}</span>${shortcut ? `<kbd>${shortcut}</kbd>` : ''}`;
  return button;
}

export function chipButton({ key, label }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chip';
  button.dataset.key = key;
  button.textContent = label;
  return button;
}

export function markSelected(buttons, attribute, key) {
  buttons.forEach((button) => button.setAttribute(attribute, String(button.dataset.key === key)));
}
