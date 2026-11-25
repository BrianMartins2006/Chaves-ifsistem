# Integração com o login único IFSISTEM

## Levantamento e linha de base

Spring Boot 4.1.1, Java 21, React/Vite. Principal `main` atualizada por fetch e
fast-forward antes das alterações. Linha de base: 57 testes, sem falhas.
Antes: JwtFilter e JwtService validavam tokens HMAC próprios, com CPF em sub;
CurrentUser lia uma entidade Usuario do SecurityContext. AuthController fornecia
/auth/login, /auth/register e /auth/me; UsuarioController gerenciava usuários em
/administrador/** e /servidor/**. AdminBootstrap criava administrador por ambiente.
O React tinha login, cadastro de aluno e gestão local de pessoas.

`usuarios` é referenciada por reservations.requester/reviewedBy e por
key_movements.responsibleUser/processedByUser/returnedByUser. As FKs e os UUIDs
foram preservados. A identidade agora vem das claims de um access token RS256,
validado pelo Resource Server com JWKS e issuer do auth. O papel deriva de perfil.
Os usuários locais passam a ser espelhos; nenhuma credencial é criada.

## Cadastro pela equipe do auth

Substituir N pelo próximo índice livre, sem mudar barras ou origens:

```properties
auth.clientes[N].client-id=chaves
auth.clientes[N].redirect-uris=https://chaves-ifsistem.vercel.app/callback.html,http://localhost:5173/callback.html
auth.clientes[N].post-logout-redirect-uris=https://chaves-ifsistem.vercel.app/,http://localhost:5173/
```

Acesso local: http://localhost:5173; usar localhost, evitando 127.0.0.1. O auth
local deve estar em http://localhost:9000. Em produção, o script usa
https://ifsistem-auth.onrender.com. Página inicial pós-login: `/`.
Frontend e backend são publicados separadamente: frontend na Vercel, API na Render.
O card do portal deve apontar para https://chaves-ifsistem.vercel.app/.

## Banco e deploy

Antes de atualizar a API, execute `supabase/sso-mirror.sql` no banco persistente.
Remove NOT NULL das colunas não fornecidas pelo auth e apaga hashes locais;
preserva registros e relacionamentos. Não há Flyway/Liquibase no projeto.
Os UUIDs do auth precisam coincidir com os UUIDs legados; nunca remapear FKs
ou criar outro usuário para o mesmo CPF. Faça backup antes da migração e confira
os IDs com a equipe do auth. O cadastro de novos usuários ocorre somente no auth.

Backend: AUTH_URL opcional (padrão https://ifsistem-auth.onrender.com); manter
DB_URL, DB_USERNAME, DB_PASSWORD, SPRING_PROFILES_ACTIVE=supabase,
APP_ALLOWED_ORIGINS e as variáveis de planilha/calendário existentes.
Remover JWT_SECRET, BOOTSTRAP_ADMIN, ADMIN_CPF, ADMIN_EMAIL, ADMIN_PASSWORD.
Frontend: manter VITE_API_URL=https://chaves-ifsistem.onrender.com e, opcionalmente,
VITE_PORTAL_URL=https://ifsistem-portal.onrender.com/. Nunca configurar client secret.

O script oficial foi obtido de /ifsistem-sso.js e copiado sem alterações para
frontend/public. sso.js configura o cliente, callback.html/callback.js concluem
PKCE e todas as chamadas de API usam IfsistemSSO.fetch. Dados de usuario() são
usados só para exibição; autorização continua no backend. O logout chama o auth.
/login.html oferece entrada explícita; `/` inicia SSO automaticamente sem sessão.

## Validação e limitações

Testes de backend usam JwtDecoder simulado; nenhum chama o auth real. A suíte de
negócio mantém reservas, aprovação, conflitos, chaves, concorrência e permissões.
Testes antigos de senha/cadastro local deixam de se aplicar ao módulo.
A validação completa com credenciais reais depende do cadastro do cliente e da
migração do banco; não executar o deploy enquanto esses passos estiverem pendentes.

Validação final: **57 testes antes e 57 depois**, todos verdes. Foram substituídos
3 testes do cadastro/login/gestão locais por 3 testes de SSO (espelhamento e
atualização, ausência de perfil e remoção das rotas antigas). Build React e teste
Playwright passaram: callback com nonce/state, PKCE S256, access token no Bearer,
persistência de sessão, logout, navegação ao portal e tela de 390px. Auth e API
são simulados no teste de navegador. Login real com sessão compartilhada ainda
precisa ser validado após preparar auth e Supabase.

## Acesso à gestão central de usuários

O menu apresenta **Usuários** somente para ADMINISTRADOR e SERVIDOR (Secretaria).
O link abre https://ifsistem-auth.onrender.com/usuarios.html na mesma aba.
A sessão central do auth será utilizada; não há transferência de tokens na URL,
acesso direto ao banco externo ou edição do espelho local. A autorização da
página e das operações continua sendo responsabilidade do auth.
