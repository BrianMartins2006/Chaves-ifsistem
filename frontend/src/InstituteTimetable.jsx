import React, { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import index from "./data/timetable-index.json";
GlobalWorkerOptions.workerSrc = workerUrl;
const normalize = (value) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export default function InstituteTimetable() {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [zoom, setZoom] = useState(1);
  const [pdf, setPdf] = useState(null),
    [error, setError] = useState(""),
    [rendering, setRendering] = useState(true),
    [reload, setReload] = useState(0);
  const container = useRef(null),
    canvas = useRef(null),
    [width, setWidth] = useState(600);
  const matches = index.groups.filter((group) =>
    normalize(group.name).includes(normalize(search)),
  );
  const group = index.groups.find((group) => group.page === page);
  const position = matches.findIndex((group) => group.page === page);
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(1, Math.floor(entries[0].contentRect.width))),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    setError("");
    setPdf(null);
    const loading = getDocument({ url: index.file });
    loading.promise
      .then((doc) => {
        if (!cancelled) setPdf(doc);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Não foi possível carregar o documento. Tente novamente ou abra o PDF completo.",
          );
      });
    return () => {
      cancelled = true;
      loading.destroy();
    };
  }, [reload]);
  useEffect(() => {
    if (!pdf || !page || !canvas.current) return;
    let cancelled = false,
      task;
    setRendering(true);
    setError("");
    // A fresh canvas prevents overlapping PDF render operations during fast zoom/page changes.
    const element = canvas.current;
    pdf
      .getPage(page)
      .then(async (documentPage) => {
        if (cancelled) return;
        const initial = documentPage.getViewport({ scale: 1 });
        const cssWidth = width * zoom;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = documentPage.getViewport({
          scale: (cssWidth / initial.width) * ratio,
        });
        element.width = Math.floor(viewport.width);
        const visibleHeight = viewport.height * (group.heightFraction || 1);
        element.height = Math.ceil(visibleHeight);
        element.style.width = `${cssWidth}px`;
        element.style.height = `${visibleHeight / ratio}px`;
        task = documentPage.render({
          canvasContext: element.getContext("2d"),
          viewport,
        });
        try {
          await task.promise;
          if (!cancelled) setRendering(false);
        } catch (e) {
          if (!cancelled && e.name !== "RenderingCancelledException") {
            setError("Não foi possível exibir esta página.");
            setRendering(false);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Não foi possível exibir esta página.");
          setRendering(false);
        }
      });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, page, zoom, width]);
  function filter(value) {
    setSearch(value);
    const found = index.groups.find((group) =>
      normalize(group.name).includes(normalize(value)),
    );
    setPage(found?.page || null);
  }
  return (
    <section className="card institute-timetable">
      <div className="section-head">
        <div>
          <span className="eyebrow">GRADE OFICIAL · CAMPUS MACHADO</span>
          <h2>Horários de aulas</h2>
          <p className="muted">
            {index.label} · {index.groups.length} turmas
          </p>
        </div>
        <a
          className="secondary link-button"
          href={index.file}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir PDF completo
        </a>
      </div>
      <div className="timetable-filters">
        <label>
          Buscar turma ou curso
          <input
            type="search"
            placeholder="Ex.: Informática, Administração…"
            value={search}
            onChange={(e) => filter(e.target.value)}
          />
        </label>
        <label>
          Turma
          <select
            value={page || ""}
            onChange={(e) => setPage(Number(e.target.value))}
          >
            <option value="" disabled>
              Selecione uma turma
            </option>
            {matches.map((group) => (
              <option key={group.page} value={group.page}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="document-toolbar">
        <div className="actions">
          <button
            className="secondary"
            disabled={position <= 0}
            onClick={() => setPage(matches[position - 1].page)}
          >
            Turma anterior
          </button>
          <button
            className="secondary"
            disabled={position < 0 || position + 1 >= matches.length}
            onClick={() => setPage(matches[position + 1].page)}
          >
            Próxima turma
          </button>
        </div>
        <div className="actions">
          <button
            className="secondary"
            aria-label="Reduzir horário"
            disabled={zoom <= 1}
            onClick={() => setZoom(Math.max(1, zoom - 0.5))}
          >
            Reduzir
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            className="secondary"
            aria-label="Ampliar horário"
            disabled={zoom >= 3}
            onClick={() => setZoom(Math.min(3, zoom + 0.5))}
          >
            Ampliar
          </button>
        </div>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}{" "}
          <button className="secondary" onClick={() => setReload(reload + 1)}>
            Tentar novamente
          </button>
        </div>
      )}
      {group && (
        <>
          <h3>{group.name}</h3>
          <p className="document-hint">
            Use Ampliar para ler os detalhes. Com a grade ampliada, deslize para
            os lados.
          </p>
          {(!pdf || rendering) && !error && (
            <p role="status">Carregando grade…</p>
          )}
        </>
      )}
      <div
        className="pdf-scroll"
        ref={container}
        aria-busy={!pdf || rendering}
        tabIndex="0"
        aria-label="Visualização da grade de aulas"
      >
        {group ? (
          <canvas
            key={`${page}-${zoom}-${width}-${reload}`}
            ref={canvas}
            role="img"
            aria-label={`Grade de ${group.name}`}
          />
        ) : (
          <p className="empty">Nenhuma turma encontrada.</p>
        )}
      </div>
      {group && (
        <details className="document-text">
          <summary>Consultar esta grade em texto</summary>
          <pre>{group.text}</pre>
        </details>
      )}
      <a className="text-button" href={index.file} download>
        Baixar todos os horários em PDF
      </a>
    </section>
  );
}
