import React, { useEffect, useState } from "react";
export default function SsoTransition({ error }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (error) return;
    const timer = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(timer);
  }, [error]);
  return (
    <main className="sso-neutral" aria-busy={!error}>
      <img src="/brand/ifconect.png" alt="IFConect" />
      {!error && (
        <div className="sso-spinner" role="status" aria-label="Conectando" />
      )}
      {!error && slow && <p role="status">Conectando ao IFSISTEM…</p>}
      {error && (
        <>
          <p role="alert">{error}</p>
          <button onClick={() => window.IfsistemSSO.login()}>
            Tentar novamente
          </button>
        </>
      )}
    </main>
  );
}
