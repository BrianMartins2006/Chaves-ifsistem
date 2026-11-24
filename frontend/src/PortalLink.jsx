import React from "react";
const portalUrl =
  import.meta.env.VITE_PORTAL_URL || "https://ifsistem-portal.onrender.com/";

export default function PortalLink() {
  return (
    <a className="portal-link" href={portalUrl}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden="true"
      >
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
      </svg>
      <span>Voltar ao portal</span>
    </a>
  );
}
