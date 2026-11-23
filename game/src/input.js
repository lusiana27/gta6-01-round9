// Keyboard + mouse state, shared by the loop, the HUD and the shot autopilot.

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const pressed = new Set();

  function keyName(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    const name = keyName(event);
    if (!keys.has(name)) pressed.add(name);
    keys.add(name);
  });
  window.addEventListener('keyup', (event) => keys.delete(keyName(event)));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });

  return {
    keys, mouse,
    down(name) { return keys.has(name); },
    axis(negative, positive) {
      return (keys.has(positive) ? 1 : 0) - (keys.has(negative) ? 1 : 0);
    },
    /** True once for the frame the key went down; consumed by endFrame. */
    wasPressed(name) { return pressed.has(name); },
    endFrame() { pressed.clear(); mouse.clicked = false; },
  };
}

/** A scripted input source the screenshot autopilot drives instead of the keyboard. */
export function createScriptedInput() {
  const keys = new Set();
  const mouse = { x: 640, y: 300, down: false, clicked: false };
  return {
    keys, mouse,
    down(name) { return keys.has(name); },
    axis(negative, positive) {
      return (keys.has(positive) ? 1 : 0) - (keys.has(negative) ? 1 : 0);
    },
    wasPressed() { return false; },
    endFrame() { mouse.clicked = false; },
    setKey(name, on) { if (on) keys.add(name); else keys.delete(name); },
    clear() { keys.clear(); },
  };
}
