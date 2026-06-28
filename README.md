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

## ⚙️ Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `DB_HOST` | Host do banco de dados |
| `DB_DATABASE` | Nome do banco de dados |
| `DB_USER` | Usuário do banco de dados |
| `DB_PASSWORD` | Senha do banco de dados |

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

O pipeline do GitHub Actions (`pipeline.yaml`) é acionado a cada push na branch `main` e:

1. Builda a imagem e faz push para o Docker Hub
2. Atualiza o `values.yaml` do repositório Kubernetes com a nova tag
3. O ArgoCD detecta a mudança e sincroniza automaticamente o cluster

## 🔗 Repositório Kubernetes

[app-leocinema-kubernetes](https://github.com/leonardobgsilva/app-leocinema-kubernetes)

**Leonardo Borges** — [leonardobgsilva.github.io](https://leonardobgsilva.github.io)
