const root = document.documentElement;
const logoField = document.querySelector(".logo-field");
const canTrackPointer = window.matchMedia("(pointer: fine)").matches;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (canTrackPointer && !reduceMotion) {
  let frame = 0;
  let tiles = [];
  let spacing = 42;
  const poolRadius = 5;
  const pullRadius = 220;

  const buildLogoField = () => {
    if (!logoField) {
      return;
    }

    logoField.textContent = "";
    spacing = Math.max(34, Math.min(48, window.innerWidth / 22));
    const fragment = document.createDocumentFragment();
    tiles = [];

    for (let row = -poolRadius; row <= poolRadius; row += 1) {
      for (let column = -poolRadius; column <= poolRadius; column += 1) {
        const tile = document.createElement("span");

        tile.className = "logo-field__tile";
        tile.style.setProperty("--tile-x", "0px");
        tile.style.setProperty("--tile-y", "0px");
        tile.style.setProperty("--pull", "0");
        tile.style.setProperty("--pull-x", "0px");
        tile.style.setProperty("--pull-y", "0px");
        tile.style.setProperty("--tilt-x", "0deg");
        tile.style.setProperty("--tilt-y", "0deg");
        fragment.appendChild(tile);
        tiles.push({ element: tile, column, row });
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

      const anchorX = Math.round(clientX / spacing) * spacing;
      const anchorY = Math.round(clientY / spacing) * spacing;

      for (const tile of tiles) {
        const rowOffset = tile.row % 2 ? spacing * 0.46 : 0;
        const x = anchorX + tile.column * spacing + rowOffset;
        const y = anchorY + tile.row * spacing;
        const adjustedDx = clientX - x;
        const adjustedDy = clientY - y;
        const distanceSquared = adjustedDx * adjustedDx + adjustedDy * adjustedDy;

        if (distanceSquared > pullRadius * pullRadius) {
          tile.element.style.setProperty("--tile-x", `${x}px`);
          tile.element.style.setProperty("--tile-y", `${y}px`);
          tile.element.style.setProperty("--pull", "0");
          tile.element.style.setProperty("--pull-x", "0px");
          tile.element.style.setProperty("--pull-y", "0px");
          tile.element.style.setProperty("--tilt-x", "0deg");
          tile.element.style.setProperty("--tilt-y", "0deg");
          continue;
        }

        const distance = Math.sqrt(distanceSquared);
        const pull = 1 - distance / pullRadius;
        const force = pull * pull;

        tile.element.style.setProperty("--tile-x", `${x}px`);
        tile.element.style.setProperty("--tile-y", `${y}px`);
        tile.element.style.setProperty("--pull", force.toFixed(3));
        tile.element.style.setProperty("--pull-x", `${(adjustedDx * force * 0.56).toFixed(2)}px`);
        tile.element.style.setProperty("--pull-y", `${(adjustedDy * force * 0.56).toFixed(2)}px`);
        tile.element.style.setProperty("--tilt-x", `${(adjustedDy * force * -0.16).toFixed(2)}deg`);
        tile.element.style.setProperty("--tilt-y", `${(adjustedDx * force * 0.16).toFixed(2)}deg`);
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