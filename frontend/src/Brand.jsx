import React from "react";

// Keep the original institutional artwork; Vite includes it once supplied here.
const artwork = import.meta.glob("./assets/brand/ifconect.{png,svg,webp}", {
  eager: true,
  query: "?url",
  import: "default",
});
const logo = Object.values(artwork)[0];

export default function Brand() {
  return (
    <a
      className={`brand${logo ? " brand-with-logo" : ""}`}
      href="#"
      aria-label="IFConect · Início"
    >
      {logo && (
        <span className="brand-symbol" aria-hidden="true">
          <img className="brand-logo" src={logo} alt="" />
        </span>
      )}
      <span className="brand-wordmark">
        IF <span>Conect</span>
      </span>
    </a>
  );
}
