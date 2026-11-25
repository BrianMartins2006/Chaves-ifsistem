import React, { useEffect, useRef, useState } from "react";
const AUTH =
  location.hostname === "localhost"
    ? "http://localhost:9000"
    : "https://ifsistem-auth.onrender.com";
const profiles = {
  ALUNO: "Aluno",
  PROFESSOR: "Professor",
  SERVIDOR: "Servidor",
  ADMINISTRADOR: "Administrador",
};
export default function AuthUsers({ currentUser }) {
  const [data, setData] = useState({ conteudo: [], totalPaginas: 0 }),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [active, setActive] = useState(""),
    [page, setPage] = useState(0),
    [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(null),
    [editor, setEditor] = useState(null),
    [action, setAction] = useState(null),
    [visible, setVisible] = useState(false);
  const lock = useRef(false),
    version = useRef(0);
  async function api(path, method = "GET", body) {
    const response = await window.IfsistemSSO.fetch(AUTH + path, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 401) {
      await window.IfsistemSSO.login();
      throw Error("Sua sessão expirou. Entre novamente no IFSISTEM.");
    }
    if (response.status === 204) return null;
    const result = await response.json();
    if (!response.ok)
      throw Error(
        result.erro || result.detail || "Não foi possível concluir a operação.",
      );
    return result;
  }
  useEffect(() => {
    let live = true;
    const current = ++version.current;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      size: "20",
      sort: "nome",
    });
    if (query.trim()) params.set("q", query.trim());
    if (filter) params.set("perfil", filter);
    if (active) params.set("ativo", active);
    const timer = setTimeout(
      () =>
        api("/usuarios?" + params)
          .then((result) => {
            if (live && current === version.current) setData(result);
          })
          .catch((error) => {
            if (live) setNotice({ error: true, text: error.message });
          })
          .finally(() => {
            if (live) setLoading(false);
          }),
      250,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, filter, active, page, reload]);
  async function save(e) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice(null);
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (editor) {
        if (editor.id) {
          const body = {
            nome: fields.nome,
            email: fields.email,
            telefone: fields.telefone || null,
            curso: fields.curso || null,
            periodo: fields.periodo ? Number(fields.periodo) : null,
          };
          if (fields.perfil && fields.perfil !== editor.perfil)
            body.perfil = fields.perfil;
          await api("/usuarios/" + editor.id, "PUT", body);
        } else {
          if (fields.senhaInicial !== fields.confirmacao)
            throw Error("As senhas não coincidem.");
          await api("/usuarios", "POST", {
            nome: fields.nome,
            cpf: fields.cpf.replace(/\D/g, ""),
            email: fields.email,
            perfil: fields.perfil,
            senhaInicial: fields.senhaInicial,
          });
        }
      } else if (action) {
        const id = encodeURIComponent(action.user.id);
        if (action.type === "password") {
          if (fields.senha !== fields.confirmacao)
            throw Error("As senhas não coincidem.");
          await api("/usuarios/" + id + "/senha", "PUT", {
            senha: fields.senha,
          });
        }
        if (action.type === "status")
          await api("/usuarios/" + id + "/ativo", "PATCH", {
            ativo: !action.user.ativo,
          });
        if (action.type === "delete") await api("/usuarios/" + id, "DELETE");
      }
      setEditor(null);
      setAction(null);
      setVisible(false);
      setReload((n) => n + 1);
      setNotice({ text: "Alteração salva no IFSISTEM com sucesso." });
    } catch (error) {
      setNotice({ error: true, text: error.message });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function open(user) {
    setEditor(user || {});
    setAction(null);
    setVisible(false);
    setNotice(null);
  }
  function request(type, user) {
    setAction({ type, user });
    setEditor(null);
    setVisible(false);
    setNotice(null);
  }
  const passwordFields = (name) => (
    <>
      <label>
        Senha
        <input
          name={name}
          type={visible ? "text" : "password"}
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
        />
      </label>
      <label>
        Confirmar senha
        <input
          name="confirmacao"
          type={visible ? "text" : "password"}
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
        />
      </label>
      <button
        type="button"
        className="secondary"
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? "Ocultar senhas" : "Mostrar senhas"}
      </button>
    </>
  );
  return (
    <section className="card auth-users">
      <div className="section-head">
        <div>
          <h2>Usuários do IFSISTEM</h2>
          <p className="muted">
            Cadastros e permissões compartilhados com os outros módulos.
          </p>
        </div>
        <button disabled={busy} onClick={() => open()}>
          Cadastrar usuário
        </button>
      </div>
      <div className="form-grid">
        <label>
          Buscar nome ou CPF
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setPage(0);
              setQuery(e.target.value);
            }}
          />
        </label>
        <label>
          Perfil
          <select
            value={filter}
            onChange={(e) => {
              setPage(0);
              setFilter(e.target.value);
            }}
          >
            <option value="">Todos</option>
            {Object.entries(profiles).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Situação
          <select
            value={active}
            onChange={(e) => {
              setPage(0);
              setActive(e.target.value);
            }}
          >
            <option value="">Todas</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </label>
      </div>
      {notice && (
        <div
          className={"notice " + (notice.error ? "error" : "")}
          role={notice.error ? "alert" : "status"}
        >
          {notice.text}
        </div>
      )}
      {(editor || action) && (
        <form
          className="user-editor"
          onSubmit={save}
          key={editor?.id || action?.user.id || "new"}
        >
          <h3>
            {editor
              ? editor.id
                ? "Editar usuário"
                : "Cadastrar Professor ou Servidor"
              : action.type === "password"
                ? "Redefinir senha"
                : action.type === "delete"
                  ? "Excluir usuário"
                  : action.user.ativo
                    ? "Inativar usuário"
                    : "Reativar usuário"}
          </h3>
          {editor ? (
            <>
              <label>
                Nome completo
                <input name="nome" required defaultValue={editor.nome || ""} />
              </label>
              <label>
                E-mail
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={editor.email || ""}
                />
              </label>
              {!editor.id && (
                <label>
                  CPF
                  <input
                    name="cpf"
                    required
                    inputMode="numeric"
                    maxLength={14}
                    placeholder="000.000.000-00"
                    onInput={(e) => {
                      const digits = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 11);
                      e.target.value = digits
                        .replace(/(\d{3})(\d)/, "$1.$2")
                        .replace(/(\d{3})(\d)/, "$1.$2")
                        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
                    }}
                  />
                </label>
              )}
              <label>
                Perfil
                <select
                  name="perfil"
                  defaultValue={editor.perfil || "PROFESSOR"}
                  disabled={
                    editor.perfil === "ADMINISTRADOR" ||
                    editor.id === currentUser.id
                  }
                >
                  {Object.entries(profiles)
                    .filter(([key]) =>
                      editor.id
                        ? key !== "ADMINISTRADOR" ||
                          editor.perfil === "ADMINISTRADOR"
                        : ["PROFESSOR", "SERVIDOR"].includes(key),
                    )
                    .map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              {editor.id ? (
                <>
                  <p className="muted">
                    CPF e matrícula são mantidos. O perfil da própria conta e de
                    Administrador não pode ser alterado aqui.
                  </p>
                  <label>
                    Telefone
                    <input
                      name="telefone"
                      defaultValue={editor.telefone || ""}
                    />
                  </label>
                  <label>
                    Curso
                    <input name="curso" defaultValue={editor.curso || ""} />
                  </label>
                  <label>
                    Período
                    <input
                      type="number"
                      min="1"
                      name="periodo"
                      defaultValue={editor.periodo || ""}
                    />
                  </label>
                </>
              ) : (
                <>
                  {passwordFields("senhaInicial")}
                  <p className="muted">
                    Alunos se cadastram no auth. Oriente a pessoa a trocar a
                    senha inicial após o primeiro acesso.
                  </p>
                </>
              )}
            </>
          ) : (
            <>
              <p>
                <strong>{action.user.nome}</strong> ·{" "}
                {profiles[action.user.perfil]}
              </p>
              {action.type === "password" ? (
                <>
                  {passwordFields("senha")}
                  <p>
                    Confirme a redefinição. As sessões de renovação desse
                    usuário serão revogadas.
                  </p>
                </>
              ) : (
                <p>
                  {action.type === "delete"
                    ? "Confirme a exclusão lógica. A conta deixará de acessar o sistema; o histórico será preservado."
                    : action.user.ativo
                      ? "Confirme a inativação. O acesso e as sessões do usuário serão bloqueados."
                      : "Confirme a reativação da conta."}
                </p>
              )}
            </>
          )}
          <div className="actions">
            <button disabled={busy}>
              {busy ? "Salvando…" : editor ? "Salvar usuário" : "Confirmar"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                setEditor(null);
                setAction(null);
                setNotice(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {loading ? (
        <p role="status">Carregando usuários do IFSISTEM…</p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Contato</th>
                  <th>Perfil</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.conteudo.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Nome">
                      <strong>{user.nome}</strong>
                      <small>{user.matricula}</small>
                    </td>
                    <td data-label="Contato">{user.email}</td>
                    <td data-label="Perfil">{profiles[user.perfil]}</td>
                    <td data-label="Situação">
                      {user.status === "EXCLUIDO"
                        ? "Excluído"
                        : user.ativo
                          ? "Ativo"
                          : "Inativo"}
                    </td>
                    <td data-label="Ações">
                      <div className="actions">
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => open(user)}
                        >
                          Editar
                        </button>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => request("password", user)}
                        >
                          Redefinir senha
                        </button>
                        {user.id !== currentUser.id && (
                          <>
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => request("status", user)}
                            >
                              {user.ativo ? "Inativar" : "Reativar"}
                            </button>
                            <button
                              className="text-button danger"
                              disabled={busy}
                              onClick={() => request("delete", user)}
                            >
                              Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.conteudo.length && (
            <p className="empty">Nenhum usuário encontrado.</p>
          )}
        </>
      )}
      <div className="pagination">
        <button
          className="secondary"
          disabled={busy || loading || page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Anterior
        </button>
        <span>
          Página {page + 1} de {Math.max(1, data.totalPaginas)}
        </span>
        <button
          className="secondary"
          disabled={busy || loading || page + 1 >= data.totalPaginas}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </button>
      </div>
    </section>
  );
}
