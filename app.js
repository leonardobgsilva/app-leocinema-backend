const express = require('express');
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');
const cors = require('cors');
const client = require('prom-client');
require('dotenv').config();

const app = express();
const PORT = 3333;
// Métricas em uma porta separada: o Ingress só publica a porta da API (3333),
// então /metrics nunca fica acessível pela internet via CloudFront.
const METRICS_PORT = process.env.METRICS_PORT || 9091;

// Métricas padrão do processo (CPU, memória, event loop, GC) + métricas da API
client.collectDefaultMetrics();

// Uma única histogram cobre o método RED: taxa (_count), erros (status_code)
// e duração (_bucket). O label `route` usa o padrão da rota (não a URL) para
// manter a cardinalidade baixa.
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP em segundos, por rota e status',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
});

const ticketsSold = new client.Counter({
  name: 'leocinema_tickets_sold_total',
  help: 'Total de ingressos vendidos'
});

const sequelize = new Sequelize(process.env.DB_DATABASE, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'mysql'
});

// Definição do modelo de dados para a tabela de ingressos
const Ticket = sequelize.define('ticket', {
  movie: Sequelize.STRING,
  date: Sequelize.DATE,
  time: Sequelize.TIME,
  quantity: Sequelize.INTEGER
});

// Sincronizar o banco de dados
sequelize.sync().then(() => {
  console.log('Modelos sincronizados com o banco de dados');
}).catch(err => {
  console.error('Erro ao sincronizar modelos com o banco de dados:', err);
});

// Funções para verificar a conexão com o banco de dados e a sincronização do modelo
const checkDatabaseConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexão com o banco de dados estabelecida com sucesso.');
    return true;
  } catch (error) {
    console.error('Não foi possível conectar ao banco de dados:', error);
    return false;
  }
};

const checkModelSync = async () => {
  try {
    await Ticket.sync();
    console.log('Modelo de dados sincronizado com sucesso.');
    return true;
  } catch (error) {
    console.error('Erro ao sincronizar modelo de dados:', error);
    return false;
  }
};

// Middlewares
app.use(cors({
  origin: '*'
}));
app.use(bodyParser.json());

// Mede a duração de cada requisição. /health fica de fora: a liveness probe o
// chama a cada 10s por pod e distorceria taxa e latência do tráfego real.
app.use((req, res, next) => {
  if (req.path === '/health') return next();

  const stopTimer = httpRequestDuration.startTimer();
  res.on('finish', () => {
    stopTimer({
      method: req.method,
      route: req.route ? req.route.path : 'unmatched',
      status_code: res.statusCode
    });
  });
  next();
});

// Rotas
app.post('/comprar-ingresso', async (req, res) => {
  const { movie, date, time, quantity } = req.body;

  try {
    const ticket = await Ticket.create({
      movie,
      date,
      time,
      quantity
    });
    ticketsSold.inc(Number(quantity) || 0);
    res.status(201).json(ticket);
  } catch (error) {
    console.error('Erro ao comprar ingresso:', error);
    res.status(500).json({ error: 'Erro ao comprar ingresso. Por favor, tente novamente.' });
  }
});

app.get('/health', async (req, res) => {
  const databaseConnection = await checkDatabaseConnection();
  const modelSyncStatus = await checkModelSync();

  if (databaseConnection && modelSyncStatus) {
    res.send('OK');
  } else {
    res.status(500).json({ error: 'A aplicação não está funcionando corretamente.' });
  }
});

// Iniciar o servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Servidor de métricas (scrape do Prometheus)
const metricsApp = express();
metricsApp.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
metricsApp.listen(METRICS_PORT, '0.0.0.0', () => {
  console.log(`Métricas Prometheus na porta ${METRICS_PORT}`);
});
