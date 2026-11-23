# Chaves-ifsistem · Gestão de espaços

Aplicação independente neste repositório: backend Java 21 / Spring Boot / Spring
Data JPA e frontend React. Gestão de salas, disponibilidade, reservas, aprovação,
controle de chaves e usuários com acesso por perfil.

## Desenvolvimento local

Requer JDK 21 completo, Node.js 22 e npm.

Terminal 1 — API com H2 e planilha real:

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH"
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

Terminal 2 — React:

```bash
cd frontend
npm ci
npm run dev
```

Abra **http://localhost:5173**. O Vite encaminha as chamadas à API local em 8081;
para outro endereço, configure API_TARGET no terminal do frontend.

Não há senha ou administrador padrão. Antes da primeira inicialização local,
configure seu próprio administrador (CPF válido e e-mail institucional):

```bash
export BOOTSTRAP_ADMIN=true
read -rp 'CPF do administrador: ' ADMIN_CPF
read -rp 'Email institucional: ' ADMIN_EMAIL
read -rsp 'Senha do administrador (mínimo 12 caracteres): ' ADMIN_PASSWORD
export ADMIN_CPF ADMIN_EMAIL ADMIN_PASSWORD
```

Depois execute o backend conforme o comando acima. Em dev/demo, o segredo JWT é
aleatório por execução, salvo se JWT_SECRET for informado. Os dados H2 são
apagados ao encerrar. Para testar sem internet, troque dev por demo (três salas
fictícias). No dev, a planilha precisa permitir exportação CSV por HTTPS.

## Perfis e autenticação

- Aluno: cadastro público com curso/período e e-mail institucional, consulta de
  salas, criação e cancelamento das próprias reservas.
- Professor: consulta e solicitação com prioridade sobre pedidos pendentes de
  alunos. Cadastro por servidor/administrador.
- Servidor: avaliação de reservas, movimentação de chaves e cadastro de alunos e
  professores.
- Administrador: funções de servidor, gestão de usuários e criação de perfis
  privilegiados.

O backend valida permissões em todas as rotas. O cadastro público não permite
escolher perfil privilegiado. Senhas usam BCrypt e JWT autentica as APIs.
O token fica somente na memória do React; recarregar a página exige novo login.
Sair descarta o token local; o token emitido permanece válido até sua expiração.

## Build único com React e API

```bash
npm --prefix frontend ci
npm --prefix frontend run build
./mvnw clean verify -Pfrontend
java -jar target/ifsystem-0.0.1-SNAPSHOT.jar --spring.profiles.active=demo
```

O JAR serve o React na raiz. Em demo, abra **http://localhost:8081**.
O perfil Maven `frontend` inclui frontend/dist no JAR; execute o build React antes.
A API continua nos pacotes Java atuais; não é necessário mover arquivos para
uma pasta backend para executá-la independentemente.

## PostgreSQL e execução isolada

Com Docker Compose:

```bash
cp .env.example .env
# Preencha todas as variáveis do .env com valores próprios.
docker compose up --build -d
```

Abra **http://localhost:8080** (APP_PORT permite alterar). O Compose cria banco
PostgreSQL próprio com volume persistente e espera sua verificação de saúde antes
de iniciar o sistema. Não publica a porta do banco no host.

Sem Docker, configure DB_URL, DB_USERNAME, DB_PASSWORD e JWT_SECRET e execute o
JAR sem perfil demo/dev. O banco PostgreSQL deve existir. JWT_SECRET é obrigatório
no perfil padrão, com pelo menos 32 bytes; não existe segredo padrão em produção.

Primeiro administrador: habilite BOOTSTRAP_ADMIN=true e informe ADMIN_CPF,
ADMIN_EMAIL institucional e ADMIN_PASSWORD com pelo menos 12 caracteres. O
bootstrap só cria quando não existe administrador; não altera senhas existentes.
Após criar, pode desabilitar BOOTSTRAP_ADMIN. Não há credencial de produção fixa.
Os valores de .env não são versionados.

## Testes e limites

```bash
./mvnw clean verify
npm --prefix frontend run build
```

A suíte Java usa PostgreSQL isolado (sem Docker), H2 e testes REST de autenticação,
autorização, concorrência e negócio. Não acessa a planilha real nos testes.

**Disponibilidade considera reservas aprovadas. Aulas semanais da planilha ainda
não bloqueiam datas automaticamente:** falta definir calendário letivo e exceções.
A interface informa essa limitação. Os IDs de sala dependem dos nomes quando não
há coluna externa imutável. Consulte [contratos da API](docs/backend.md).

O antigo painel HTML de teste foi preservado em `local-testing/`, ignorado pelo
Git e fora da aplicação. React é a interface principal. Não há dependência do
repositório remoto da turma em tempo de execução. Não foi feito push ou deploy.

Para repetir o teste de navegador, use uma instância demo recém-iniciada na porta
18084 (banco vazio, credenciais informadas nas variáveis de ambiente) e Chrome instalado:

```bash
java -jar target/ifsystem-0.0.1-SNAPSHOT.jar --spring.profiles.active=demo --server.port=18084
# Em outro terminal:
npm --prefix frontend run test:e2e
```

O teste cria contas e reservas apenas nessa instância e verifica permissões,
aprovação, movimentação de chaves, gestão de usuários e largura mobile. Reinicie o
demo antes de repetir. CHROME_PATH troca o executável do navegador; E2E_URL troca
a URL de teste. Capturas ficam no diretório temporário do sistema.

## Supabase, Vercel e hospedagem da API

Consulte [o guia de hospedagem](docs/hosting.md) para Supabase PostgreSQL com
schema privado, Vercel e Render/Railway. Não há credenciais fixas de demonstração. Alunos devem usar `@alunos.ifsuldeminas.edu.br`; os demais perfis,
`@ifsuldeminas.edu.br`. A validação verifica formato, domínio e verificadores do
CPF; não confirma identidade na Receita nem existência da caixa de e-mail.
