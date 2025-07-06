const express = require('express')
const jwt = require('jsonwebtoken')
const { expressjwt: jwtMiddleware } = require('express-jwt')
const { createLogger, format, transports } = require('winston')
const client = require('prom-client')

const app = express()
const PORT = 3000
const SECRET_KEY = 'supersecret'

app.use(express.json())

// Logger
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [new transports.Console()]
})

// Prometheus metrics
client.collectDefaultMetrics()
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP em segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2.5, 5]
})

app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const delta = (Date.now() - start) / 1000
    httpRequestDuration.labels(req.method, req.path, res.statusCode).observe(delta)
  })
  next()
})

// Routes
app.get('/token', (req, res) => {
  const user = req.query.user || 'guest'
  const payload = { sub: user }
  const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' })
  logger.info('Token emitido', { user })
  res.json({ token })
})

app.use('/users', jwtMiddleware({ secret: SECRET_KEY, algorithms: ['HS256'] }))

app.get('/users', (req, res) => {
  logger.info('Acesso ao /users', { user: req.auth.sub })
  res.json([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }])
})

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType)
  res.end(await client.register.metrics())
})

app.listen(PORT, () => console.log(`EduAPI fake rodando em http://localhost:${PORT}`))


// Rota insegura simulando uso do eval
app.get('/calc', (req, res) => {
    const expr = req.query.expr || '2+2';
    // ⚠️ Inseguro: executa código arbitrário vindo da requisição
    const result = eval(expr);
    res.json({ result });
});

