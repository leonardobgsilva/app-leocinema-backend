const express = require('express');
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');
const cors = require('cors');
require('dotenv').config();

const authMiddleware = require('./auth'); // Importe o middleware de autenticação

const app = express();
const PORT = 3333;

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

// Rotas
app.post('/comprar-ingresso', authMiddleware, async (req, res) => {
  const { movie, date, time, quantity } = req.body;

  try {
    const ticket = await Ticket.create({
      movie,
      date,
      time,
      quantity
    });
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
