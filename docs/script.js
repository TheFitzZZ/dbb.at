const root = document.documentElement;
const logoField = document.querySelector(".logo-field");
const nameField = document.querySelector(".name-field");
const canTrackPointer = window.matchMedia("(pointer: fine)").matches;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const formerMembers = [
  "dbB+Atlan",
  "dbB+Blade",
  "dbB+Bucho",
  "dbB+Cerberus",
  "dbB+The Crow",
  "dbB+Demoman",
  "dbB+Dude",
  "dbB+Gulak",
  "dbB+Iceman",
  "dbB+Metallic",
  "dbB+Mp5warrior",
  "dbB+Mortican",
  "dbB+Nail",
  "dbB+Whiner",
  "dbB+Zentus",
  "dbB+Obi Wahn",
  "dbB+Jagg3r",
  "dbB+D3gaSS",
  "dbB+Heros",
  "dbB+Heidi",
  "dbB+Matrix",
  "dbB+MIB",
  "dbB+^Maxx Blade",
  "dbB+Ghost",
  "dbB+Tiele",
  "dbB+Ezekiel",
  "dbB+Overcooler",
  "dbB+Tiny",
  "dbB+Rincewind",
  "dbB+Reav-r",
  "dbB+K3NnY",
  "dbB+Viper89",
  "dbB+Dr.Who",
  "dbB+Snake",
  "dbB+Cravinkel",
  "dbB+FitzZZ",
  "dbB+Mörser",
  "dbB+Tino",
  "dbB+Speacher",
  "dbB+Angel",
  "dbB+DerPate",
  "dbB+DeeJay",
  "dbB+siro",
  "dbB+Thor",
  "dbB+Skratch",
  "dbB+number13",
  "dbB+Paddy11",
  "dbB+DuU06",
  "dbB+abraxxa",
  "dbB+Evilfish",
  "dbB+FallenAngel",
  "dbB+h0r4l3x",
];

const randomBetween = (min, max) => min + Math.random() * (max - min);
const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

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

if (nameField) {
  let visibleNames = 0;
  let nameQueue = shuffle(formerMembers);

  const nextMemberName = () => {
    if (nameQueue.length === 0) {
      nameQueue = shuffle(formerMembers);
    }

    return nameQueue.pop();
  };

  const buildName = (fullName) => {
    const inscription = document.createElement("span");
    const nick = fullName.startsWith("dbB+") ? fullName.slice(4) : fullName;

    inscription.className = "name-field__name";
    inscription.style.setProperty("--name-x", `${randomBetween(10, 90).toFixed(2)}vw`);
    inscription.style.setProperty("--name-y", `${randomBetween(10, 90).toFixed(2)}vh`);
    inscription.style.setProperty("--name-drift-x", `${randomBetween(-30, 30).toFixed(2)}px`);
    inscription.style.setProperty("--name-drift-y", `${randomBetween(-22, 22).toFixed(2)}px`);
    inscription.style.setProperty("--name-duration", `${Math.round(randomBetween(4200, 7200))}ms`);
    inscription.style.setProperty("--name-opacity", randomBetween(0.68, 0.96).toFixed(2));
    inscription.style.setProperty("--name-scale", randomBetween(0.92, 1.28).toFixed(2));

    inscription.innerHTML = `<span class="name-field__dbb">dbB</span><span class="name-field__plus">+</span><span class="name-field__nick"></span>`;
    inscription.querySelector(".name-field__nick").textContent = nick;

    return inscription;
  };

  const releaseName = () => {
    if (document.hidden) {
      window.setTimeout(releaseName, 900);
      return;
    }

    const maxVisibleNames = window.innerWidth < 680 ? 4 : 8;

    if (visibleNames < maxVisibleNames) {
      const inscription = buildName(nextMemberName());

      visibleNames += 1;
      nameField.appendChild(inscription);

      inscription.addEventListener("animationend", () => {
        visibleNames = Math.max(0, visibleNames - 1);
        inscription.remove();
      }, { once: true });
    }

    window.setTimeout(releaseName, randomBetween(420, 1320));
  };

  if (reduceMotion) {
    for (const memberName of shuffle(formerMembers).slice(0, 14)) {
      nameField.appendChild(buildName(memberName));
    }
  } else {
    window.setTimeout(releaseName, 720);
  }
}