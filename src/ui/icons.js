const svg = (body, strokeWidth = 1.8) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = Object.freeze({
  hammer: svg('<path d="M4 20 14.3 10.3"/><path d="M11 6.9 13.9 4l7 7-2.9 2.9z" fill="currentColor" stroke-width="1.6"/>', 2.4),
  bomb: svg('<circle cx="10" cy="14.5" r="6.5" fill="currentColor" stroke-width="1.6"/><path d="M14.6 9.9 16.3 8.2"/><path d="M16.3 8.2c.9-1.7 2.3-2.4 3.7-2.2"/><path d="M21.6 3.2l.9-.9M22 5.8h1.2M19.6 2.4V1.2" stroke-width="1.4"/>', 2.4),
  saw: svg('<path d="M19.9 12.0 21.5 15.1 18.8 15.9 18.6 19.5 16.0 18.8 14.0 21.8 12.0 19.9 8.9 21.5 8.1 18.8 4.5 18.6 5.2 15.9 2.2 14.0 4.1 12.0 2.5 8.9 5.2 8.0 5.4 4.5 8.0 5.2 10.0 2.2 12.0 4.1 15.1 2.5 16.0 5.2 19.5 5.4 18.8 8.0 21.8 10.0zM14.8 12a2.8 2.8 0 1 0-5.6 0 2.8 2.8 0 1 0 5.6 0z" fill="currentColor" fill-rule="evenodd" stroke-width="1.2"/>'),
  katana: svg('<path d="M8 16C12.5 12.8 17 8.2 21 3" stroke-width="1.7"/><path d="M5.6 14.4l4 4" stroke-width="2.2"/><path d="M2.8 21.2l3.8-3.8" stroke-width="3.2"/>'),
  press: svg('<path d="M12 2v5" stroke-width="3"/><rect x="4" y="7" width="16" height="4.5" rx="1" fill="currentColor" stroke-width="1.6"/><path d="M3 21h18"/><path d="M8 17.5h8v3.5H8z" fill="currentColor" fill-opacity=".14"/>'),
  glass: svg('<rect x="5" y="3" width="14" height="18" rx="1.5" fill="currentColor" fill-opacity=".14"/><path d="M8.5 7.5 11 5.5M8.5 11.5l5-4"/><path d="M14 13l1.6 2.2 2.4-.6M15.6 15.2 14.8 18"/>'),
  wood: svg('<rect x="3" y="6" width="18" height="12" rx="2" fill="currentColor" fill-opacity=".14"/><path d="M3 10.2c4 0 5 1.8 9 1.8s5-1.8 9-1.8M3 14.6c3 0 5-.8 8-.8"/><ellipse cx="15.5" cy="15" rx="1.7" ry="1"/>'),
  stone: svg('<path d="M4 16.5 6 9l5-4 6 2 3 6-2 5-8 1z" fill="currentColor" fill-opacity=".14"/><path d="M11 5l1 6 5 2M12 11l-4 4"/>'),
  metal: svg('<rect x="3" y="5" width="18" height="14" rx="1.5" fill="currentColor" fill-opacity=".14"/><circle cx="6.5" cy="8.5" r=".9"/><circle cx="17.5" cy="8.5" r=".9"/><circle cx="6.5" cy="15.5" r=".9"/><circle cx="17.5" cy="15.5" r=".9"/><path d="M9.5 15.5 14.5 8.5"/>'),
});
