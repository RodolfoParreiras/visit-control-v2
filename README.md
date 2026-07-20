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

| Variável          | Descrição                                               |
|-------------------|---------------------------------------------------------|
| `DB_PASSWORD`     | Senha do banco de dados (use algo forte em produção)   |
| `SESSION_SECRET`  | Chave secreta JWT (mínimo 32 caracteres aleatórios)    |
| `ALLOWED_ORIGINS` | URL do frontend (ex: `https://visitas.prefeitura.gov.br`) |

### 4. Iniciar a aplicação

```bash
docker compose up -d --build
```

Aguarde alguns segundos para o banco inicializar. O schema e o usuário administrador são criados automaticamente na primeira vez que o volume do banco for inicializado.

A aplicação estará disponível em:

- **http://seu-servidor** — Interface do sistema
- **http://seu-servidor/api/health** — Health check da API

Credenciais iniciais: **login:** `admin` / **senha:** `admin`

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

---

## Atualização

Para atualizar a aplicação para uma nova versão:

```bash
git pull
docker compose up -d --build
```

---

## Backup e Restauração

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

| Variável          | Padrão                                        | Descrição                                    |
|-------------------|-----------------------------------------------|----------------------------------------------|
| `DATABASE_URL`    | `postgresql://visit_user:visit_pass@db:5432/visit_control` | URL de conexão com o PostgreSQL |
| `SESSION_SECRET`  | —                                             | Chave secreta para assinatura JWT (obrigatória) |
| `NODE_ENV`        | `production`                                  | Ambiente de execução                         |
| `PORT`            | `3001`                                        | Porta do backend                             |
| `ALLOWED_ORIGINS` | `http://localhost`                            | Origens CORS permitidas (separadas por vírgula) |
| `LOG_LEVEL`       | `info`                                        | Nível de log (trace/debug/info/warn/error)   |
| `DB_PASSWORD`     | `visit_pass`                                  | Senha do PostgreSQL                          |

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

| Camada       | Tecnologia                             |
|--------------|----------------------------------------|
| Frontend     | React 19, Vite, Tailwind CSS v4, Wouter |
| UI           | Radix UI, shadcn/ui, Recharts          |
| Backend      | Node.js 22, Express 5, Drizzle ORM     |
| Banco        | PostgreSQL 16                          |
| Autenticação | JWT (jsonwebtoken) + bcryptjs          |
| Proxy        | Nginx Alpine                           |
| Containers   | Docker + Docker Compose                |
