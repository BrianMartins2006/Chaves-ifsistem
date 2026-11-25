# IFConect · Gestão de espaços

Backend Java 21 / Spring Boot 4.1.1 e frontend React/Vite para salas, reservas,
aulas e controle de chaves. Autenticação pelo login único IFSISTEM, cliente
público `chaves`, PKCE e tokens RS256. Não há cadastro ou senha local.

## Desenvolvimento

O auth local precisa estar em http://localhost:9000 com o cliente cadastrado.

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH"
export AUTH_URL=http://localhost:9000
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

Em outro terminal:

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

Abra **http://localhost:5173**. Use localhost em todo o fluxo. O perfil dev usa
H2 descartável e a planilha real. O perfil demo usa H2 e salas de exemplo;
a autenticação continua no IFSISTEM. Não há usuário-semente ou senha de teste.

## Testes e build

```bash
./mvnw clean verify
npm --prefix frontend test
npm --prefix frontend run build
```

Para o teste de navegador com auth/API simulados, inicie o Vite e execute
`npm --prefix frontend run test:e2e`. Nenhuma credencial real é utilizada.
O build combinado usa `npm --prefix frontend run build` antes de
`./mvnw package -Pfrontend`; a API no Render é construída por Dockerfile.backend,
e o React na Vercel recebe VITE_API_URL.

## Integração e deploy

Antes de publicar a versão SSO, siga [a integração](docs/sso-integration.md):
cadastre as URIs exatas no auth e aplique `supabase/sso-mirror.sql` no banco.
Mantenha UUIDs e FKs legados. Nenhuma operação em produção é feita pelo script
automaticamente. Remova JWT_SECRET e variáveis ADMIN_*/BOOTSTRAP_ADMIN.

- [Hospedagem](docs/hosting.md)
- [Calendário, grade e atualização do período](docs/academic-calendar.md)
- [Backend](docs/backend.md)
