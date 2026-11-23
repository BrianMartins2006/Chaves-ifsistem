# Hospedagem: Vercel + backend Java + Supabase

Arquitetura: navegador → React na Vercel → API Spring Boot → PostgreSQL do
Supabase. A leitura da planilha continua sendo feita pelo backend. Mantemos o
JWT/BCrypt do projeto; não estamos migrando para Supabase Auth. Nenhuma senha de
banco, JWT_SECRET ou service-role key vai para o frontend.

## Escolha do backend

Recomendação para demonstração acadêmica com baixo custo: **Render**, com Docker.
O plano gratuito entra em repouso após 15 minutos sem requisições; o primeiro
acesso depois pode demorar. Para uso frequente, considerar uma instância paga.
Alternativa: **Railway**, cujo plano Hobby tem compromisso mínimo de US$ 5/mês,
com cobrança por uso acima do valor incluído. Conferir preços ao contratar.

Fontes consultadas: [Render Java](https://render.com/hosting/java),
[Render gratuito](https://render.com/docs/free),
[Railway preços](https://docs.railway.com/pricing).

## Supabase

1. Crie o projeto e execute `supabase/setup.sql` no SQL editor.
2. Não adicione `app_private` aos schemas expostos pela Data API. As tabelas da
   aplicação serão criadas nesse schema; o React só conversa com nossa API.
3. Em Connect, copie os dados PostgreSQL. Para hosts que precisam de IPv4, prefira
   **Session pooler**, porta 5432. Não usar transaction pooler nesta configuração.
4. Configure no serviço do backend:

```text
SPRING_PROFILES_ACTIVE=supabase
DB_URL=jdbc:postgresql://HOST-DO-SESSION-POOLER:5432/postgres?sslmode=require
DB_USERNAME=postgres.REFERENCIA-DO-PROJETO
DB_PASSWORD=<senha do banco>
DB_POOL_SIZE=5
JWT_SECRET=<segredo aleatório de pelo menos 32 bytes>
APP_ALLOWED_ORIGINS=https://SEU-FRONT.vercel.app
BOOTSTRAP_ADMIN=true
ADMIN_CPF=<CPF válido do primeiro administrador>
ADMIN_EMAIL=<email @ifsuldeminas.edu.br>
ADMIN_PASSWORD=<senha forte com pelo menos 12 caracteres>
```

Use host e usuário exatos do painel; DB_URL é JDBC, não a URL HTTPS do projeto.
O perfil exige SSL e limita o pool. H2 fica somente em dev/demo. O bootstrap não
altera administrador existente; após a criação inicial pode ser desabilitado.
O Hibernate mantém a estratégia update existente, sem apagar tabelas. O perfil
não migra automaticamente dados de H2 ou de outro schema já existente.

Fontes: [Conexões PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres),
[schemas expostos](https://supabase.com/docs/guides/api/using-custom-schemas).

## Render / Railway

Crie serviço a partir do repositório, runtime Docker, usando `Dockerfile.backend`.
Esse Dockerfile compila somente a API. Configure as variáveis acima e o domínio
HTTPS público. O backend lê PORT da plataforma. Configure o health check em `/health`. Não ative os perfis dev/demo em
produção. A conexão efetiva ao Supabase depende de configurar o projeto e as
credenciais na hospedagem; ainda não foi executada nesta sessão.

## Vercel

Importe o repositório com Root Directory `frontend`, framework Vite,
build `npm run build`, output `dist`. O arquivo `frontend/vercel.json` já define
build e fallback de SPA.

Configure no frontend:

```text
VITE_API_URL=https://SUA-API.onrender.com
```

Substitua pela URL real do Render ou Railway. Depois de alterar a variável,
republique o frontend, pois Vite incorpora o valor no build. No backend, configure
APP_ALLOWED_ORIGINS com a URL exata da Vercel, sem barra final; para mais de uma,
separe por vírgula. Não há curinga para previews. O proxy API_TARGET é só para o
Vite local. Acesso remoto usa VITE_API_URL com CORS e cabeçalho Bearer.

Fonte: [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite).

## Validação de identidade

CPF: 11 dígitos ou máscara padrão, dois verificadores corretos, sem sequência
repetida. Apenas a validade matemática é verificada; não consulta a Receita.
E-mail de ALUNO: domínio exato `alunos.ifsuldeminas.edu.br`. Demais perfis:
`ifsuldeminas.edu.br`. Cadastro e edição normalizam espaços externos e caixa e
rejeitam formato ou domínio incorreto. Esta validação não confirma propriedade
ou existência da caixa postal: não há envio de e-mail de confirmação nesta etapa.
O login também rejeita CPFs inválidos. Dados antigos inválidos não são corrigidos
automaticamente; revise-os antes de migrar para produção.

Não há credenciais fixas para desenvolvimento. Configure ADMIN_CPF, ADMIN_EMAIL,
ADMIN_PASSWORD e BOOTSTRAP_ADMIN=true para provisionar seu administrador local.
