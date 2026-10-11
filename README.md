# 🎬 LeoCinema - Backend

API REST para compra de ingressos de cinema, parte do projeto [LeoCinema Kubernetes](https://github.com/leonardobgsilva/app-leocinema-kubernetes).

## 🛠️ Stack

- [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
- [Sequelize](https://sequelize.org/) — ORM
- [MariaDB](https://mariadb.org/) — banco de dados
- [dotenv](https://github.com/motdotla/dotenv) — variáveis de ambiente

## 📁 Estrutura

```
app-leocinema-backend/
├── .github/
│   └── workflows/
│       └── pipeline.yaml   # CI/CD — build e push para o Docker Hub
├── app.js                  # Servidor Express e rotas
├── Dockerfile
└── package.json
```

## 🔌 Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/comprar-ingresso` | Cria um novo ingresso |
| `GET` | `/health` | Health check da aplicação e banco |

### POST `/comprar-ingresso`

**Body:**
```json
{
  "movie": "Vingadores: Ultimato",
  "date": "2026-05-27",
  "time": "13:24",
  "quantity": 2
}
```

**Resposta `201`:**
```json
{
  "id": 1,
  "movie": "Vingadores: Ultimato",
  "date": "2026-05-27T00:00:00.000Z",
  "time": "13:24",
  "quantity": 2,
  "createdAt": "2026-06-28T21:56:26.233Z",
  "updatedAt": "2026-06-28T21:56:26.233Z"
}
```

### GET `/health`

**Resposta `200`:** `OK`

## 📈 Métricas (Prometheus)

O backend expõe `GET /metrics` em uma **porta separada** (`9091` por padrão), fora da porta da API (`3333`). O Ingress só publica a porta da API, então as métricas não ficam acessíveis pela internet, apenas dentro do cluster (scrape do Prometheus via `ServiceMonitor`).

| Métrica | Tipo | Descrição |
|---|---|---|
| `http_request_duration_seconds` | histogram | Duração das requisições por `method`, `route` e `status_code`. Dela saem taxa (`_count`), erros (`status_code`) e latência (`_bucket`) |
| `leocinema_tickets_sold_total` | counter | Total de ingressos vendidos |
| `process_*`, `nodejs_*` | — | Métricas padrão do processo (CPU, memória, event loop, GC) |

- O label `route` usa o padrão da rota (`/comprar-ingresso`), não a URL, para manter a cardinalidade baixa. Rotas inexistentes viram `unmatched`.
- `/health` não é medido: a liveness probe o chama a cada 10s por pod e distorceria os números do tráfego real.

```bash
curl localhost:9091/metrics
```

## ⚙️ Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `DB_HOST` | Host do banco de dados |
| `DB_DATABASE` | Nome do banco de dados |
| `DB_USER` | Usuário do banco de dados |
| `DB_PASSWORD` | Senha do banco de dados |
| `METRICS_PORT` | Porta do `/metrics` (padrão `9091`) |

## 🐳 Docker

```bash
docker build -t leobgs/leocinema-backend:latest .
docker run -p 3333:3333 \
  -e DB_HOST=<host> \
  -e DB_DATABASE=<database> \
  -e DB_USER=<user> \
  -e DB_PASSWORD=<password> \
  leobgs/leocinema-backend:latest
```

## 🚀 CI/CD

![Fluxo do pipeline](docs/ci-pipeline.png)

O workflow `pipeline.yaml` roda a cada push em `main` e `oidc`:

1. **Autentica na AWS por OIDC.** O GitHub emite um token de curta duração e o AWS STS o troca por credenciais temporárias no papel IAM `leocinema-gha-ecr-push`. Não há access key em secret. O papel só aceita este repositório, nas branches permitidas, e só pode fazer push nos repositórios ECR do projeto. O Terraform dele está em [tf-oidc](https://github.com/leonardobgsilva/tf-oidc).
2. **Builda e envia a imagem ao Amazon ECR** com a tag igual ao SHA do commit. Os repositórios ECR têm tags imutáveis, então uma tag sempre aponta para um único build.
3. **Roda o Trivy** na imagem. Por enquanto é só relatório (não barra o build) e o resultado fica no log da execução.
4. **Abre um Pull Request** no [app-leocinema-kubernetes](https://github.com/leonardobgsilva/app-leocinema-kubernetes) trocando a imagem no `values.yaml`. Depois do merge, o ArgoCD sincroniza o cluster.

### Antes e depois

| | Antes | Depois |
|---|---|---|
| Credenciais | Usuário e senha do Docker Hub em secrets | Credenciais temporárias via OIDC, sem access key |
| Tag da imagem | `argocd` (mutável, reaproveitada a cada build) | SHA do commit (imutável no ECR) |
| Atualização do GitOps | `git push` na `main` com token pessoal na URL | Pull Request, com token limitado a um repositório |
| Scan de imagem | Nenhum | Trivy a cada build |
| Actions | `actions/checkout@v2` | Versões atuais |

### Secrets necessários

- `AWS_ROLE_ARN`: ARN do papel IAM (output `role_arn` do [tf-oidc](https://github.com/leonardobgsilva/tf-oidc)).
- `GITOPS_TOKEN`: token fino do GitHub, limitado ao repositório Kubernetes (Contents e Pull requests em *Read and write*).

### Imagem pública no Docker Hub

O workflow `dockerhub.yaml` é independente do pipeline da AWS. A cada push na `main` (ou manualmente, em *Actions → Run workflow*) ele publica a imagem em [leobgs/leocinema-backend](https://hub.docker.com/r/leobgs/leocinema-backend), com as tags `latest` e o SHA do commit, para qualquer pessoa testar em outra máquina:

```bash
docker pull leobgs/leocinema-backend:latest
```

Secrets necessários: `DOCKERHUB_USERNAME` e `DOCKERHUB_PASSWORD` (use um *Access Token* do Docker Hub com permissão de leitura e escrita, não a senha da conta). A tag `argocd`, usada pelo fluxo antigo, não é mais atualizada.

### Limites conhecidos

- O deploy da imagem do ECR no EKS **não foi testado** (o cluster fica desligado para não gerar custo). O pipeline foi validado até a abertura do Pull Request.
- O `GITOPS_TOKEN` ainda é um token de longa duração. O próximo passo seria trocá-lo por um GitHub App.
- A imagem base é `node:14-alpine`, que está fora de suporte, e o relatório do Trivy não foi tratado neste projeto.
- O frontend roda em S3 + CloudFront e não passa por este pipeline.

## 🔗 Repositório Kubernetes

[app-leocinema-kubernetes](https://github.com/leonardobgsilva/app-leocinema-kubernetes)

**Leonardo Borges** — [leonardobgsilva.github.io](https://leonardobgsilva.github.io)
