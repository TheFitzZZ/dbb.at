const root = document.documentElement;
const logoField = document.querySelector(".logo-field");
const canTrackPointer = window.matchMedia("(pointer: fine)").matches;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (canTrackPointer && !reduceMotion) {
  let frame = 0;
  let tiles = [];

  const buildLogoField = () => {
    if (!logoField) {
      return;
    }

    logoField.textContent = "";
    const spacing = Math.max(58, Math.min(86, window.innerWidth / 14));
    const columns = Math.ceil(window.innerWidth / spacing) + 2;
    const rows = Math.ceil(window.innerHeight / spacing) + 2;
    const fragment = document.createDocumentFragment();
    tiles = [];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const tile = document.createElement("span");
        const offset = row % 2 ? spacing * 0.46 : 0;
        const x = column * spacing - spacing + offset;
        const y = row * spacing - spacing * 0.72;

        tile.className = "logo-field__tile";
        tile.style.setProperty("--tile-x", `${x}px`);
        tile.style.setProperty("--tile-y", `${y}px`);
        tile.style.setProperty("--pull", "0");
        tile.style.setProperty("--pull-x", "0px");
        tile.style.setProperty("--pull-y", "0px");
        fragment.appendChild(tile);
        tiles.push({ element: tile, x: x + spacing * 0.18, y: y + spacing * 0.18 });
      }
    }

    logoField.appendChild(fragment);
  };

  const setPointer = (clientX, clientY) => {
    if (frame) {
      cancelAnimationFrame(frame);
    }

    frame = requestAnimationFrame(() => {
      const offsetX = clientX - window.innerWidth / 2;
      const offsetY = clientY - window.innerHeight / 2;

      root.style.setProperty("--mouse-x", `${clientX}px`);
      root.style.setProperty("--mouse-y", `${clientY}px`);
      root.style.setProperty("--parallax-x", `${Math.max(-28, Math.min(28, offsetX * 0.035))}px`);
      root.style.setProperty("--parallax-y", `${Math.max(-22, Math.min(22, offsetY * 0.035))}px`);

      for (const tile of tiles) {
        const dx = clientX - tile.x;
        const dy = clientY - tile.y;
        const distance = Math.hypot(dx, dy);
        const pull = Math.max(0, 1 - distance / 420);
        const force = pull * pull;

        tile.element.style.setProperty("--pull", force.toFixed(3));
        tile.element.style.setProperty("--pull-x", `${(dx * force * 0.56).toFixed(2)}px`);
        tile.element.style.setProperty("--pull-y", `${(dy * force * 0.56).toFixed(2)}px`);
      }
    });
  };

  buildLogoField();
  setPointer(window.innerWidth / 2, window.innerHeight / 2);

  window.addEventListener("pointermove", (event) => {
    setPointer(event.clientX, event.clientY);
  }, { passive: true });

  window.addEventListener("pointerleave", () => {
    setPointer(window.innerWidth / 2, window.innerHeight / 2);
  });

  window.addEventListener("resize", () => {
    buildLogoField();
    setPointer(window.innerWidth / 2, window.innerHeight / 2);
  });
}