# Sistema de Controle de Visitantes

Sistema para registro e controle de visitas em órgãos públicos. Permite registrar entrada e saída de visitantes, gerar relatórios e imprimir etiquetas de identificação.

---

## Estrutura do Projeto

```
visit-control/
├── apps/
│   ├── frontend/          # Interface React + Vite + Tailwind CSS
│   └── backend/           # API REST Express + Drizzle ORM
├── packages/
│   ├── db/                # Schema Drizzle + conexão PostgreSQL
│   ├── api-client/        # Cliente HTTP gerado pelo Orval (React Query)
│   ├── api-zod/           # Schemas de validação Zod gerados pelo Orval
│   └── api-spec/          # Especificação OpenAPI + configuração do Orval
├── docker/
│   └── nginx.Dockerfile   # Dockerfile do Nginx (frontend + proxy reverso)
├── nginx/
│   ├── nginx.conf         # Configuração do Nginx (proxy reverso + HTTPS)
│   └── nginx-frontend.conf # Configuração para servir o frontend como SPA
├── scripts/
│   ├── backup.sh          # Script de backup do banco de dados
│   ├── restore.sh         # Script de restauração do banco de dados
│   └── migrate.sh         # Aplica as migrações do Drizzle
├── .env.example           # Exemplo de variáveis de ambiente
├── docker-compose.yml     # Orquestração Docker completa
└── README.md
```

---

## Pré-requisitos

- **Docker** 24+
- **Docker Compose** 2.20+

Não é necessário instalar Node.js, PostgreSQL ou qualquer outra dependência diretamente na máquina.

---

## Deploy em Produção (VM Debian)

### 1. Instalar Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Clonar o repositório

```bash
git clone <url-do-repositorio>
cd visit-control
```

### 3. Configurar as variáveis de ambiente

```bash
cp .env.example .env
nano .env
```

Edite o `.env` ajustando pelo menos estas variáveis:

| Variável          | Descrição                                                 |
| ----------------- | --------------------------------------------------------- |
| `DB_PASSWORD`     | Senha do banco de dados (use algo forte em produção)      |
| `SESSION_SECRET`  | Chave secreta JWT (mínimo 32 caracteres aleatórios)       |
| `ALLOWED_ORIGINS` | URL do frontend (ex: `https://visitas.prefeitura.gov.br`) |

### 4. Iniciar a aplicação

```bash
bash ./scripts/start.sh
```

No Windows, execute `scripts\start.cmd` diretamente no CMD. No PowerShell,
use `./scripts/start.ps1`. Na primeira execução, o script solicita no próprio
terminal o nome, login, senha e confirmação da senha do administrador antes de
iniciar o sistema. Nas execuções seguintes, a solicitação é ignorada porque já
existe um usuário no banco.

No Git Bash ou em um terminal Bash do Linux/WSL, execute exatamente
`bash ./scripts/start.sh`. O script já trata automaticamente a conversão de
caminhos feita pelo Git Bash no Windows.

Aguarde alguns segundos para o banco inicializar. O schema e o usuário administrador são criados automaticamente na primeira vez que o volume do banco for inicializado.

A aplicação estará disponível em:

- **http://seu-servidor** — Interface do sistema
- **http://seu-servidor/api/health** — Health check da API

Em uma instalação Docker local, acesse **http://localhost** sem adicionar a
porta `3000`. Essa porta é usada apenas pelo frontend de desenvolvimento e
exige que o backend local também esteja rodando na porta `3001`.

Não existem credenciais administrativas fixas e os dados do primeiro
administrador não são armazenados nem transportados pelo `.env`. O cadastro é
executado por um comando interativo dentro do backend antes de os serviços
serem iniciados.

---

## Desenvolvimento Local

### Pré-requisitos locais

- Node.js 22+
- pnpm 9+
- PostgreSQL 16+ (ou Docker)

### Instalação

```bash
pnpm install
```

### Configurar banco local

```bash
# Suba apenas o banco de dados via Docker
docker compose up -d db

# Aplique o schema
DATABASE_URL="postgresql://visit_user:visit_pass@localhost:5432/visit_control" pnpm db:push
```

### Iniciar em modo de desenvolvimento

```bash
# Terminal 1 — Backend
pnpm dev:backend

# Terminal 2 — Frontend
PORT=3000 pnpm dev:frontend
```

O frontend roda em http://localhost:3000 com proxy automático para a API em localhost:3001.
Na primeira execução interativa do backend, o terminal solicitará o nome, o
login, a senha e a confirmação da senha do administrador inicial.

---

## Atualização

Para atualizar a aplicação para uma nova versão:

> Antes desta atualização, corrija eventuais visitantes antigos sem CPF. A
> migração interrompe a inicialização e informa o problema caso encontre algum,
> pois o sistema não pode inventar um documento válido para esses registros.

```bash
git pull
sh ./scripts/start.sh
```

---

## Backup e Restauração

Administradores também podem gerar e baixar um backup completo diretamente
pela opção **Backup do Sistema** no menu de configurações. O arquivo é gerado
no formato `.sql.gz`, registrado na auditoria e removido do servidor após o
download.

### Backup

```bash
./scripts/backup.sh ./backups
```

O backup é salvo em `./backups/visit_control_YYYYMMDD_HHMMSS.sql.gz`.

### Restauração

```bash
./scripts/restore.sh ./backups/visit_control_20240101_120000.sql.gz
```

### Backup automático com cron

```bash
# Edite o crontab
crontab -e

# Adicione a linha para backup diário às 2h da manhã
0 2 * * * /opt/visit-control/scripts/backup.sh /opt/backups >> /var/log/visit-control-backup.log 2>&1
```

---

## Configuração HTTPS (SSL)

Edite `nginx/nginx.conf` e descomente o bloco do servidor HTTPS. Depois coloque os certificados em `nginx/ssl/`:

```bash
mkdir -p nginx/ssl
cp /etc/letsencrypt/live/seu-dominio/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/seu-dominio/privkey.pem   nginx/ssl/
```

Com Let's Encrypt + Certbot:

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d seu-dominio.com.br
```

Reinicie o nginx após a configuração:

```bash
docker compose restart nginx
```

---

## Variáveis de Ambiente

| Variável          | Padrão                                                     | Descrição                                       |
| ----------------- | ---------------------------------------------------------- | ----------------------------------------------- |
| `DATABASE_URL`    | `postgresql://visit_user:visit_pass@db:5432/visit_control` | URL de conexão com o PostgreSQL                 |
| `SESSION_SECRET`  | —                                                          | Chave secreta para assinatura JWT (obrigatória) |
| `NODE_ENV`        | `production`                                               | Ambiente de execução                            |
| `PORT`            | `3001`                                                     | Porta do backend                                |
| `ALLOWED_ORIGINS` | `http://localhost`                                         | Origens CORS permitidas (separadas por vírgula) |
| `LOG_LEVEL`       | `info`                                                     | Nível de log (trace/debug/info/warn/error)      |
| `DB_PASSWORD`     | `visit_pass`                                               | Senha do PostgreSQL                             |

---

## Logs

Para ver os logs da aplicação:

```bash
# Todos os serviços
docker compose logs -f

# Apenas o backend
docker compose logs -f backend

# Apenas o nginx
docker compose logs -f nginx

# Apenas o banco
docker compose logs -f db
```

---

## Gerando o Cliente de API (após alterar o OpenAPI)

Se você modificar a especificação OpenAPI em `packages/api-spec/openapi.yaml`:

```bash
pnpm --filter @visit-control/api-spec run codegen
```

## Central de Atendimento

- Ative a fila no cadastro do setor e escolha entre chamada geral ou atendimento por mesas.
- Para setores com mesas, use o botão de gerenciamento na listagem de setores para cadastrar, ativar ou desativar cada mesa.
- Cadastre usuários com o perfil **Atendente** e vincule cada um ao seu setor. Esse perfil acessa somente a Central de Atendimento.
- Toda nova visita destinada a um setor habilitado entra automaticamente na fila FIFO daquele setor.
- A recepção pode abrir **Visor de Chamadas** no menu lateral. O visor recebe novas chamadas em tempo real e faz o anúncio por voz quando o navegador permite áudio.

---

## Comandos Úteis

```bash
# Verificar status dos containers
docker compose ps

# Reiniciar um serviço
docker compose restart backend

# Parar tudo
docker compose down

# Parar e remover volumes (⚠️ apaga dados do banco)
docker compose down -v

# Acessar o banco de dados
docker compose exec db psql -U visit_user -d visit_control

# Ver logs em tempo real
docker compose logs -f --tail=100
```

---

## Arquitetura

```
                Internet
                    │
                    ▼
            Nginx  :80/:443
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
  /api/* → Backend         /* → Frontend
  (Express :3001)          (React SPA)
        │
        ▼
  PostgreSQL :5432
```

---

## Tecnologias

| Camada       | Tecnologia                              |
| ------------ | --------------------------------------- |
| Frontend     | React 19, Vite, Tailwind CSS v4, Wouter |
| UI           | Radix UI, shadcn/ui, Recharts           |
| Backend      | Node.js 22, Express 5, Drizzle ORM      |
| Banco        | PostgreSQL 16                           |
| Autenticação | JWT (jsonwebtoken) + bcryptjs           |
| Proxy        | Nginx Alpine                            |
| Containers   | Docker + Docker Compose                 |
