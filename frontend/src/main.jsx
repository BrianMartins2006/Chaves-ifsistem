import PortalLink from "./PortalLink.jsx";
import Brand from "./Brand.jsx";
import React, { useEffect, useState, useRef, useId } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import RoomAgenda from "./RoomAgenda.jsx";
import { normalizeSearch, shiftDate, checkoutState } from "./schedule.js";
const InstituteTimetable = React.lazy(() => import("./InstituteTimetable.jsx"));
import { formatCpf, validateRegistration } from "./identity.js";

const labels = {
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
  CANCELLED: "Cancelada",
  CHECKED_OUT: "Retirada",
  RETURNED: "Devolvida",
  AVAILABLE: "Disponível",
  CLASS: "Em aula",
  RESERVATION: "Reservada",
  MIXED: "Ocupada",
  ADMINISTRADOR: "Administrador",
  SERVIDOR: "Servidor",
  PROFESSOR: "Professor",
  ALUNO: "Aluno",
};
const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const zone = "America/Sao_Paulo";
function parts(date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
}
function inputTime(date) {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function instant(value) {
  const [y, m, d, h, n] = value.split(/[-T:]/).map(Number);
  const wall = Date.UTC(y, m - 1, d, h, n);
  let t = wall;
  for (let i = 0; i < 3; i++) {
    const p = parts(new Date(t));
    t =
      wall - (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t);
  }
  if (inputTime(new Date(t)) !== value) throw Error("Horário inválido.");
  return new Date(t).toISOString();
}
const fmt = (v, z = zone) =>
  v
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: z,
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(v))
    : "—";
function Badge({ value }) {
  return <span className={`badge ${value}`}>{labels[value] || value}</span>;
}
function Field({ label, ...props }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const password = props.type === "password";
  const cpf = props.name === "cpf" || props.name === "cpfConfirmation";
  return (
    <div className="field">
      <label htmlFor={props.id || id}>{label}</label>
      <span className={password ? "password-control" : "input-control"}>
        <input
          id={id}
          {...props}
          type={password && visible ? "text" : props.type}
          {...(cpf
            ? {
                inputMode: "numeric",
                maxLength: 14,
                placeholder: "000.000.000-00",
                onInput: (e) => {
                  e.currentTarget.value = formatCpf(e.currentTarget.value);
                },
              }
            : {})}
        />
        {password && (
          <button
            type="button"
            className="password-toggle"
            aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? "Ocultar" : "Mostrar"}
          </button>
        )}
      </span>
    </div>
  );
}

function App() {
  const sessionEpoch = useRef(0);
  const reservationLock = useRef(false),
    reservationNotice = useRef(null);
  const [reservationSending, setReservationSending] = useState(false);
  const [sentReservations, setSentReservations] = useState({});
  const [reservationError, setReservationError] = useState(null);
  const [token, setToken] = useState(null),
    [user, setUser] = useState(null),
    [tab, setTab] = useState("rooms");
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(null);
  const [rooms, setRooms] = useState([]),
    [reservations, setReservations] = useState({ content: [], totalPages: 0 }),
    [keys, setKeys] = useState([]),
    [history, setHistory] = useState({ content: [], totalPages: 0 }),
    [users, setUsers] = useState([]);
  const [roomSearch, setRoomSearch] = useState("");
  const [agendaError, setAgendaError] = useState("");
  const [agendaLoading, setAgendaLoading] = useState(false),
    [agendaReload, setAgendaReload] = useState(0);
  const [selected, setSelected] = useState(""),
    [date, setDate] = useState(inputTime(new Date()).slice(0, 10)),
    [availability, setAvailability] = useState(null);
  const [page, setPage] = useState(0),
    [historyPage, setHistoryPage] = useState(0),
    [status, setStatus] = useState("");
  const [start, setStart] = useState(inputTime(new Date(Date.now() - 60000))),
    [end, setEnd] = useState(inputTime(new Date(Date.now() + 3600000)));
  const reservationKey = JSON.stringify([selected, start, end]);
  const sentReservation = sentReservations[reservationKey];
  useEffect(() => {
    if (sentReservation || reservationError?.key === reservationKey) {
      reservationNotice.current?.focus({ preventScroll: true });
      reservationNotice.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [sentReservation, reservationError, reservationKey]);
  async function requestReservation(e) {
    e.preventDefault();
    if (reservationLock.current || sentReservation) return;
    reservationLock.current = true;
    const epoch = sessionEpoch.current,
      key = reservationKey;
    setReservationSending(true);
    setReservationError(null);
    try {
      const startTime = instant(start),
        endTime = instant(end);
      if (startTime >= endTime)
        throw Error("O início deve ser anterior ao fim.");
      const result = await api("/api/reservations", "POST", {
        roomId: selected,
        startTime,
        endTime,
      });
      if (epoch === sessionEpoch.current)
        setSentReservations((previous) => ({ ...previous, [key]: result }));
    } catch (error) {
      if (epoch === sessionEpoch.current)
        setReservationError({ key, text: error.message });
    } finally {
      reservationLock.current = false;
      setReservationSending(false);
    }
  }
  const [review, setReview] = useState(null),
    [reason, setReason] = useState("");
  const operator = ["ADMINISTRADOR", "SERVIDOR"].includes(user?.perfil),
    admin = user?.perfil === "ADMINISTRADOR";
  function logout() {
    sessionEpoch.current++;
    setSentReservations({});
    setReservationError(null);
    setToken(null);
    setUser(null);
    setRooms([]);
    setUsers([]);
    setKeys([]);
    setHistory({ content: [] });
    setReservations({ content: [] });
    setAvailability(null);
    setSelected("");
    setRoomSearch("");
    setTab("rooms");
    setPage(0);
    setHistoryPage(0);
    setReview(null);
  }
  async function api(path, method = "GET", body, auth = token) {
    const epoch = sessionEpoch.current;
    const r = await fetch(apiBase + path, {
      method,
      headers: {
        Accept: "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    if (epoch !== sessionEpoch.current)
      throw Error("A sessão mudou. Repita a operação.");
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!r.ok) {
      if (r.status === 401 && auth) logout();
      throw Error(
        data?.detail ||
          data?.message ||
          (r.status === 401
            ? "CPF ou senha inválidos."
            : `Não foi possível concluir a operação (${r.status}).`),
      );
    }
    return data;
  }
  async function task(action) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setMessage({ error: true, text: e.message });
    } finally {
      setBusy(false);
    }
  }
  async function loadReservations() {
    setReservations(
      await api(
        `/api/reservations?page=${page}&size=10${status ? "&status=" + status : ""}`,
      ),
    );
  }
  async function loadKeys() {
    const [k, h] = await Promise.all([
      api("/api/keys/status"),
      api(`/api/keys/history?page=${historyPage}&size=10`),
    ]);
    setKeys(k);
    setHistory(h);
  }
  useEffect(() => {
    if (!token) return;
    task(async () => {
      const r = await api("/api/rooms");
      setRooms(r);
    });
  }, [token]);
  useEffect(() => {
    if (!token) return;
    task(async () => {
      if (tab === "reservations") await loadReservations();
      if (tab === "keys" && operator) await loadKeys();
      if (tab === "users" && operator)
        setUsers(admin ? await api("/administrador/usuarios") : []);
    });
  }, [token, tab, page, status, historyPage]);
  useEffect(() => {
    if (!token || tab !== "rooms" || !selected || !date) {
      setAvailability(null);
      setAgendaLoading(false);
      setAgendaError("");
      return;
    }
    let active = true;
    setAgendaLoading(true);
    setAgendaError("");
    setAvailability(null);
    setMessage(null);
    api(`/api/rooms/${encodeURIComponent(selected)}/availability?date=${date}`)
      .then((data) => {
        if (active) setAvailability(data);
      })
      .catch((error) => {
        if (active) setAgendaError(error.message);
      })
      .finally(() => {
        if (active) setAgendaLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, tab, selected, date, agendaReload]);
  function selectRoom(id) {
    setSelected(id);
    setAgendaReload((value) => value + 1);
    if (window.matchMedia("(max-width:700px)").matches)
      requestAnimationFrame(() =>
        document
          .getElementById("room-agenda")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
  }
  const filteredRooms = rooms.filter((room) =>
    normalizeSearch(room.name).includes(normalizeSearch(roomSearch)),
  );
  const roomName = (id) => rooms.find((r) => r.id === id)?.name || id;
  const person = (id) =>
    users.find((u) => u.id === id)?.nome ||
    (id === user?.id ? user.nome : "Solicitante da reserva");
  async function authenticate(e) {
    e.preventDefault();
    const form = e.currentTarget,
      data = Object.fromEntries(new FormData(form));
    await task(async () => {
      if (signup) {
        const request = validateRegistration(data);
        request.periodo = Number(request.periodo);
        await api("/auth/register", "POST", request, null);
        setSignup(false);
        setMessage({ text: "Conta criada. Entre com seu CPF e senha." });
        form.reset();
      } else {
        const auth = await api("/auth/login", "POST", data, null),
          me = await api("/auth/me", "GET", null, auth.token);
        setUser(me);
        setToken(auth.token);
        form.reset();
      }
    });
  }
  async function mutate(path, body, success) {
    await api(path, "POST", body);
    setMessage({ text: success });
    if (tab === "reservations") await loadReservations();
    if (tab === "keys") await loadKeys();
  }
  if (!token)
    return (
      <main className="auth-layout">
        <section className="auth-story">
          <Brand />
          <div>
            <span className="eyebrow">CAMPUS ORGANIZADO</span>
            <h1>
              O espaço certo.
              <br />
              Na hora certa.
            </h1>
            <p>
              Salas, reservas e chaves em um único lugar. Mais clareza para quem
              estuda, ensina e cuida do campus.
            </p>
            <div className="story-grid">
              <span>01 · Encontre uma sala</span>
              <span>02 · Reserve seu horário</span>
              <span>03 · Retire sua chave</span>
            </div>
          </div>
          <small>Sistema de gestão de espaços · IFSULDEMINAS</small>
        </section>
        <section className="auth-panel">
          <div className="auth-card">
            <span className="eyebrow">BEM-VINDO AO IFCONECT</span>
            <h2>{signup ? "Crie sua conta" : "Acesse sua conta"}</h2>
            <p>
              {signup
                ? "Cadastro de aluno com e-mail institucional."
                : "Entre para organizar seu próximo encontro."}
            </p>
            {message && (
              <div
                role="alert"
                className={"notice " + (message.error ? "error" : "")}
              >
                {message.text}
              </div>
            )}
            <form onSubmit={authenticate}>
              {signup && (
                <>
                  <Field
                    label="Nome completo"
                    name="nome"
                    required
                    autoComplete="name"
                  />
                  <Field
                    label="E-mail institucional"
                    name="email"
                    type="email"
                    placeholder="nome@alunos.ifsuldeminas.edu.br"
                    required
                  />
                  <Field label="Matrícula" name="matricula" required />
                </>
              )}
              <Field
                label="CPF"
                pattern="(?:[0-9]{11}|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})"
                title="Informe 11 números ou o formato 000.000.000-00"
                name="cpf"
                required
                autoComplete="username"
                inputMode="numeric"
              />
              {signup && (
                <Field label="Confirmar CPF" name="cpfConfirmation" required />
              )}
              <Field
                label="Senha"
                name="senha"
                type="password"
                minLength={signup ? 8 : undefined}
                required
                autoComplete={signup ? "new-password" : "current-password"}
              />
              {signup && (
                <Field
                  label="Confirmar senha"
                  name="passwordConfirmation"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              )}
              {signup && (
                <div className="form-grid">
                  <Field label="Curso" name="curso" required />
                  <Field
                    label="Período"
                    name="periodo"
                    type="number"
                    min="1"
                    required
                  />
                </div>
              )}
              <button disabled={busy}>
                {busy ? "Aguarde…" : signup ? "Criar conta" : "Entrar"}
              </button>
            </form>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setSignup(!signup);
                setMessage(null);
              }}
            >
              {signup ? "Já tenho uma conta" : "Sou aluno e quero me cadastrar"}
            </button>
            <small>O acesso às funções depende do seu perfil.</small>
          </div>
        </section>
      </main>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <PortalLink />
        <p className="nav-caption">MEU CAMPUS</p>
        <nav>
          {[
            ["rooms", "Salas e disponibilidade", "▦"],
            ["timetable", "Horários de aulas", "◷"],
            ["reservations", "Reservas", "▤"],
            ...(operator
              ? [
                  ["keys", "Controle de chaves", "⚿"],
                  ["users", "Pessoas", "♙"],
                ]
              : []),
          ].map(([id, label, icon]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => {
                setTab(id);
                setMessage(null);
              }}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar">{user.nome.slice(0, 1)}</div>
          <strong>{user.nome}</strong>
          <small>{labels[user.perfil]}</small>
          <button className="logout" onClick={logout}>
            Sair da conta
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Gestão de espaços{" "}
            <span className="muted">
              /{" "}
              {
                {
                  rooms: "Salas",
                  timetable: "Horários de aulas",
                  reservations: "Reservas",
                  keys: "Chaves",
                  users: "Pessoas",
                }[tab]
              }
            </span>
          </span>
          <span className="campus">IFSULDEMINAS</span>
        </header>
        <main className="content">
          <div className="heading">
            <div>
              <span className="eyebrow">
                TUDO PRONTO PARA SEU PRÓXIMO PASSO
              </span>
              <h1>
                {
                  {
                    rooms: "Encontre seu espaço",
                    timetable: "A grade do instituto, na sua mão",
                    reservations: "Suas reservas, organizadas",
                    keys: "Cada chave em seu lugar",
                    users: "Pessoas do campus",
                  }[tab]
                }
              </h1>
              <p>
                {
                  {
                    rooms:
                      "Consulte salas e organize seu horário com tranquilidade.",
                    timetable:
                      "Consulte as turmas, disciplinas e horários do campus.",
                    reservations: operator
                      ? "Avalie solicitações e acompanhe os horários aprovados."
                      : "Acompanhe suas solicitações e decisões.",
                    keys: "Registre retiradas e devoluções, sem perder o histórico.",
                    users: "Cadastre pessoas com o perfil de acesso adequado.",
                  }[tab]
                }
              </p>
            </div>
            <Badge value={user.perfil} />
          </div>
          {message && (
            <div
              className={"notice " + (message.error ? "error" : "")}
              role="alert"
            >
              {message.text}
            </div>
          )}
          {busy && (
            <p role="status" className="loading">
              Atualizando…
            </p>
          )}
          {tab === "rooms" && (
            <>
              <div className="stats">
                <article>
                  <span>Espaços disponíveis na fonte</span>
                  <strong>{rooms.length}</strong>
                  <small>Dados da planilha configurada</small>
                </article>
                <article>
                  <span>Fuso dos horários</span>
                  <strong className="small-number">São Paulo</strong>
                  <small>America/Sao_Paulo</small>
                </article>
                <article>
                  <span>Comece por aqui</span>
                  <strong className="small-number">Sala + horário</strong>
                  <small>Escolha um espaço para reservar</small>
                </article>
              </div>
              <div className="rooms-layout">
                <section className="card">
                  <h2>Salas do campus</h2>
                  <p className="muted">
                    Selecione uma sala para consultar ou reservar.
                  </p>
                  <Field
                    label="Buscar sala"
                    type="search"
                    placeholder="Ex.: Sala 114, laboratório…"
                    value={roomSearch}
                    onChange={(event) => setRoomSearch(event.target.value)}
                  />
                  <p className="room-count" role="status">
                    {filteredRooms.length} salas encontradas
                  </p>
                  {rooms.length > 0 && filteredRooms.length === 0 && (
                    <p className="empty">Nenhuma sala corresponde à busca.</p>
                  )}
                  <div className="key-grid room-grid">
                    {filteredRooms.map((r) => (
                      <button
                        className={
                          "key-card room-card " +
                          (selected === r.id ? "selected" : "")
                        }
                        key={r.id}
                        aria-pressed={selected === r.id}
                        onClick={() => selectRoom(r.id)}
                      >
                        <span className="room-icon" aria-hidden="true">
                          ▦
                        </span>
                        <span>
                          <strong>{r.name}</strong>
                          <small>
                            {r.building || "Espaço do campus"}
                            {r.capacity ? " · " + r.capacity + " lugares" : ""}
                          </small>
                        </span>
                        <span className="room-pick">
                          {selected === r.id ? "Selecionada" : "Selecionar"}
                        </span>
                      </button>
                    ))}
                  </div>
                  {!rooms.length && (
                    <p>
                      Nenhuma sala carregada.{" "}
                      <button
                        className="secondary"
                        onClick={() =>
                          task(async () => setRooms(await api("/api/rooms")))
                        }
                      >
                        Tentar novamente
                      </button>
                    </p>
                  )}
                </section>
                <section
                  className="card"
                  id="room-agenda"
                  aria-label="Agenda da sala selecionada"
                >
                  <span className="eyebrow">PLANEJE SEU HORÁRIO</span>
                  <h2>
                    {selected ? roomName(selected) : "Selecione uma sala"}
                  </h2>
                  {!selected && (
                    <p className="muted">
                      Clique em uma sala para ver automaticamente todos os
                      intervalos livres e ocupados.
                    </p>
                  )}
                  <form
                    className="agenda-controls"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setAgendaReload((value) => value + 1);
                    }}
                  >
                    <button
                      type="button"
                      className="secondary"
                      disabled={!selected || agendaLoading}
                      onClick={() => setDate(shiftDate(date, -1))}
                    >
                      Dia anterior
                    </button>
                    <Field
                      label="Dia da consulta"
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="secondary"
                      disabled={!selected || agendaLoading}
                      onClick={() => setDate(shiftDate(date, 1))}
                    >
                      Próximo dia
                    </button>
                    <button
                      type="submit"
                      className="secondary"
                      disabled={!selected || agendaLoading}
                    >
                      Atualizar agenda
                    </button>
                  </form>
                  {agendaError && (
                    <div className="notice error" role="alert">
                      {agendaError}
                    </div>
                  )}
                  {agendaLoading && (
                    <p role="status" className="loading">
                      Carregando todos os horários da sala…
                    </p>
                  )}
                  {availability && (
                    <RoomAgenda
                      availability={availability}
                      onChooseSlot={(slot) => {
                        setStart(inputTime(new Date(slot.startTime)));
                        setEnd(inputTime(new Date(slot.endTime)));
                        document.getElementById("reservation-start")?.focus();
                      }}
                    />
                  )}
                  <hr />
                  <h3>Solicitar reserva</h3>
                  <p className="muted">
                    Reservas das 07h às 23h, no horário de São Paulo.
                  </p>
                  <form
                    onSubmit={requestReservation}
                    aria-busy={reservationSending}
                  >
                    <Field
                      label="Início · horário de São Paulo"
                      id="reservation-start"
                      type="datetime-local"
                      required
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                    <Field
                      label="Fim · horário de São Paulo"
                      type="datetime-local"
                      required
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                    />
                    <button
                      disabled={
                        !selected ||
                        busy ||
                        reservationSending ||
                        !!sentReservation
                      }
                    >
                      {reservationSending
                        ? "Enviando solicitação…"
                        : sentReservation
                          ? "Solicitação enviada"
                          : "Solicitar reserva"}
                    </button>
                    {sentReservation && (
                      <div
                        className="reservation-feedback"
                        role="status"
                        tabIndex={-1}
                        ref={reservationNotice}
                      >
                        <span
                          className="reservation-feedback-icon"
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                        <div>
                          <strong>Solicitação enviada com sucesso!</strong>
                          <p>
                            {roomName(sentReservation.roomId)} ·{" "}
                            {fmt(sentReservation.startTime)} até{" "}
                            {fmt(sentReservation.endTime)}.
                          </p>
                          <p>
                            Sua solicitação está pendente de avaliação. Você não
                            precisa enviar novamente.
                          </p>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => {
                              setPage(0);
                              setStatus("");
                              setTab("reservations");
                            }}
                          >
                            Ver minhas reservas
                          </button>
                        </div>
                      </div>
                    )}
                    {reservationError?.key === reservationKey && (
                      <div
                        className="reservation-feedback reservation-feedback-error"
                        role="alert"
                        tabIndex={-1}
                        ref={reservationNotice}
                      >
                        <span
                          className="reservation-feedback-icon"
                          aria-hidden="true"
                        >
                          !
                        </span>
                        <div>
                          <strong>Não foi possível enviar a solicitação</strong>
                          <p>{reservationError.text}</p>
                        </div>
                      </div>
                    )}
                  </form>
                </section>
              </div>
            </>
          )}
          {tab === "timetable" && (
            <React.Suspense
              fallback={
                <p role="status">Carregando os horários do instituto…</p>
              }
            >
              <InstituteTimetable />
            </React.Suspense>
          )}
          {tab === "reservations" && (
            <section className="card">
              <div className="section-head">
                <h2>
                  {operator ? "Solicitações e reservas" : "Minhas reservas"}
                </h2>
                <select
                  aria-label="Filtrar situação"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Todas as situações</option>
                  {["PENDING", "APPROVED", "REJECTED", "CANCELLED"].map((s) => (
                    <option key={s} value={s}>
                      {labels[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="table-scroll">
                <table className="responsive-table">
                  <thead>
                    <tr>
                      <th>Sala</th>
                      <th>Período</th>
                      <th>Situação</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.content.map((r) => (
                      <tr key={r.id}>
                        <td data-label="Sala">
                          <strong>{roomName(r.roomId)}</strong>
                          {r.rejectionReason && (
                            <small>{r.rejectionReason}</small>
                          )}
                        </td>
                        <td data-label="Período">
                          {fmt(r.startTime)}
                          <br />
                          {fmt(r.endTime)}
                        </td>
                        <td data-label="Situação">
                          <Badge value={r.status} />
                        </td>
                        <td data-label="Ações">
                          <div className="actions">
                            {operator && r.status === "PENDING" && (
                              <>
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    task(() =>
                                      mutate(
                                        `/api/reservations/${r.id}/approve`,
                                        undefined,
                                        "Reserva aprovada.",
                                      ),
                                    )
                                  }
                                >
                                  Aprovar
                                </button>
                                <button
                                  className="secondary"
                                  onClick={() => {
                                    setReview(r);
                                    setReason("");
                                  }}
                                >
                                  Rejeitar
                                </button>
                              </>
                            )}
                            {["PENDING", "APPROVED"].includes(r.status) && (
                              <button
                                className="text-button danger"
                                disabled={busy}
                                onClick={() =>
                                  task(() =>
                                    mutate(
                                      `/api/reservations/${r.id}/cancel`,
                                      undefined,
                                      "Reserva cancelada.",
                                    ),
                                  )
                                }
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!reservations.content.length && (
                <div className="empty">
                  Nenhuma reserva encontrada para esta consulta.
                </div>
              )}
              <Pagination
                page={page}
                total={reservations.totalPages}
                setPage={setPage}
                busy={busy}
              />
            </section>
          )}
          {tab === "keys" && (
            <>
              <section className="card">
                <h2>Situação das chaves</h2>
                <div className="key-grid">
                  {keys.map((k) => (
                    <article className="key-card" key={k.roomId}>
                      <span className="room-icon">⚿</span>
                      <h3>{roomName(k.roomId)}</h3>
                      <Badge value={k.status} />
                      {k.checkoutAt && (
                        <small>Retirada em {fmt(k.checkoutAt)}</small>
                      )}
                    </article>
                  ))}
                </div>
              </section>
              <section className="card">
                <h2>Registrar retirada</h2>
                <p className="muted">
                  Escolha uma reserva aprovada e vigente. A chave ficará
                  vinculada ao solicitante.
                </p>
                <Checkout
                  keys={keys}
                  api={api}
                  task={task}
                  busy={busy}
                  roomName={roomName}
                  onDone={async () => {
                    setMessage({ text: "Retirada registrada." });
                    await loadKeys();
                  }}
                />
              </section>
              <section className="card">
                <h2>Histórico de movimentações</h2>
                <div className="table-scroll">
                  <table className="responsive-table">
                    <thead>
                      <tr>
                        <th>Sala</th>
                        <th>Retirada</th>
                        <th>Devolução</th>
                        <th>Situação</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.content.map((m) => (
                        <tr key={m.id}>
                          <td data-label="Sala">{roomName(m.roomId)}</td>
                          <td data-label="Retirada">{fmt(m.checkoutAt)}</td>
                          <td data-label="Devolução">{fmt(m.checkinAt)}</td>
                          <td data-label="Situação">
                            <Badge value={m.status} />
                          </td>
                          <td data-label="Ação">
                            {m.status === "CHECKED_OUT" && (
                              <button
                                disabled={busy}
                                onClick={() =>
                                  task(() =>
                                    mutate(
                                      "/api/keys/checkin",
                                      { movementId: m.id },
                                      "Devolução registrada.",
                                    ),
                                  )
                                }
                              >
                                Devolver chave
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!history.content.length && (
                  <div className="empty">Nenhuma movimentação registrada.</div>
                )}
                <Pagination
                  page={historyPage}
                  total={history.totalPages}
                  setPage={setHistoryPage}
                  busy={busy}
                />
              </section>
            </>
          )}
          {tab === "users" && (
            <>
              <section className="card">
                <h2>Cadastrar pessoa</h2>
                <form
                  className="user-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      d = Object.fromEntries(new FormData(form));
                    const role = d.role;
                    delete d.role;
                    if (role === "ALUNO") d.periodo = Number(d.periodo);
                    else {
                      delete d.periodo;
                      delete d.curso;
                    }
                    const path = {
                      ALUNO: "/servidor/alunos",
                      PROFESSOR: "/servidor/professores",
                      SERVIDOR: "/administrador/servidores",
                      ADMINISTRADOR: "/administrador/usuarios",
                    }[role];
                    task(async () => {
                      await api(path, "POST", validateRegistration(d));
                      form.reset();
                      if (admin) setUsers(await api("/administrador/usuarios"));
                      setMessage({ text: "Pessoa cadastrada." });
                    });
                  }}
                >
                  <Field label="Nome completo" name="nome" required />
                  <Field
                    label="CPF"
                    pattern="(?:[0-9]{11}|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})"
                    title="Informe 11 números ou o formato 000.000.000-00"
                    name="cpf"
                    required
                  />
                  <Field
                    label="Confirmar CPF"
                    name="cpfConfirmation"
                    required
                  />
                  <Field
                    label="E-mail institucional"
                    name="email"
                    type="email"
                    required
                  />
                  <Field label="Matrícula" name="matricula" required />
                  <Field
                    label="Senha inicial"
                    name="senha"
                    type="password"
                    required
                    minLength="8"
                  />
                  <Field
                    label="Confirmar senha"
                    name="passwordConfirmation"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <label>
                    Perfil
                    <select name="role">
                      {(admin
                        ? ["ALUNO", "PROFESSOR", "SERVIDOR", "ADMINISTRADOR"]
                        : ["ALUNO", "PROFESSOR"]
                      ).map((p) => (
                        <option key={p} value={p}>
                          {labels[p]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field label="Curso · somente aluno" name="curso" />
                  <Field
                    label="Período · somente aluno"
                    name="periodo"
                    type="number"
                    min="1"
                  />
                  <button disabled={busy}>Cadastrar pessoa</button>
                </form>
              </section>
              {admin && (
                <section className="card">
                  <h2>Usuários cadastrados</h2>
                  <div className="table-scroll">
                    <table className="responsive-table">
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>E-mail</th>
                          <th>Perfil</th>
                          <th>Situação</th>
                          <th>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id}>
                            <td data-label="Nome">{u.nome}</td>
                            <td data-label="E-mail">{u.email}</td>
                            <td data-label="Perfil">{labels[u.perfil]}</td>
                            <td data-label="Situação">{u.status}</td>
                            <td data-label="Ação">
                              {u.id !== user.id && (
                                <button
                                  className="secondary"
                                  disabled={busy}
                                  onClick={() =>
                                    task(async () => {
                                      await api(
                                        `/administrador/usuarios/${u.id}/status`,
                                        "PATCH",
                                        {
                                          status:
                                            u.status === "ATIVO"
                                              ? "INATIVO"
                                              : "ATIVO",
                                        },
                                      );
                                      setUsers(
                                        await api("/administrador/usuarios"),
                                      );
                                    })
                                  }
                                >
                                  {u.status === "ATIVO"
                                    ? "Desativar"
                                    : "Ativar"}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </main>
        <footer>IFConect · Gestão de espaços do campus</footer>
      </div>
      {review && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-title"
          >
            <h2 id="review-title">Rejeitar solicitação</h2>
            <p>
              {roomName(review.roomId)} · {fmt(review.startTime)}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                task(async () => {
                  await mutate(
                    `/api/reservations/${review.id}/reject`,
                    { reason },
                    "Solicitação rejeitada.",
                  );
                  setReview(null);
                });
              }}
            >
              <label>
                Motivo
                <textarea
                  autoFocus
                  required
                  maxLength="1000"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <div className="actions">
                <button disabled={busy}>Confirmar rejeição</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setReview(null)}
                >
                  Voltar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function Pagination({ page, total, setPage, busy }) {
  return (
    <div className="pagination">
      <button
        className="secondary"
        disabled={busy || page === 0}
        onClick={() => setPage(page - 1)}
      >
        Anterior
      </button>
      <span>
        Página {page + 1} de {Math.max(total || 0, 1)}
      </span>
      <button
        className="secondary"
        disabled={busy || page + 1 >= (total || 0)}
        onClick={() => setPage(page + 1)}
      >
        Próxima
      </button>
    </div>
  );
}
function CheckoutNotice({ title, children, error = false }) {
  return (
    <div
      className={`checkout-notice${error ? " checkout-notice-error" : ""}`}
      role="alert"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6m0 3v1" />
      </svg>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}
function Checkout({ api, task, busy, roomName, onDone, keys }) {
  const [checkoutError, setCheckoutError] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [rows, setRows] = useState([]),
    [selected, setSelected] = useState(""),
    [page, setPage] = useState(0),
    [total, setTotal] = useState(0);
  const reservation = rows.find((row) => row.id === selected);
  const state = checkoutState(
    reservation,
    now,
    keys.find((key) => key.roomId === reservation?.roomId)?.status,
  );
  const impediment =
    state === "FUTURE"
      ? `Retirada liberada a partir de ${fmt(reservation.startTime)} (horário de São Paulo).`
      : state === "ENDED"
        ? "Esta reserva já terminou. Selecione uma reserva em andamento."
        : state === "CHECKED_OUT"
          ? "A chave desta sala já foi retirada. Registre a devolução antes de uma nova retirada."
          : "";
  async function load() {
    const r = await api(
      `/api/reservations?status=APPROVED&page=${page}&size=20`,
    );
    setRows(r.content);
    setTotal(r.totalPages);
    setSelected("");
  }
  useEffect(() => {
    task(load);
  }, [page]);
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          task(async () => {
            setCheckoutError("");
            try {
              await api("/api/keys/checkout", "POST", {
                reservationId: selected,
              });
            } catch (error) {
              setCheckoutError(error.message);
              return;
            }
            await onDone();
            await load();
          });
        }}
      >
        <label>
          Reserva aprovada
          <select
            required
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setCheckoutError("");
            }}
          >
            <option value="">Selecione uma reserva</option>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {roomName(r.roomId)} · {fmt(r.startTime)} até {fmt(r.endTime)}
              </option>
            ))}
          </select>
        </label>
        {impediment && (
          <CheckoutNotice
            title={
              state === "FUTURE"
                ? "Ainda não é hora de retirar a chave"
                : state === "ENDED"
                  ? "O horário desta reserva já terminou"
                  : "Esta chave já está em uso"
            }
          >
            {impediment}
          </CheckoutNotice>
        )}
        {checkoutError && (
          <CheckoutNotice title="Não foi possível registrar a retirada" error>
            {checkoutError}
          </CheckoutNotice>
        )}
        {state === "READY" && (
          <p className="muted">
            Reserva em andamento. A retirada pode ser registrada até{" "}
            {fmt(reservation.endTime)} (horário de São Paulo).
          </p>
        )}
        <button disabled={busy || state !== "READY"}>Registrar retirada</button>
      </form>
      <Pagination page={page} total={total} setPage={setPage} busy={busy} />
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
