const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Condo Admin API',
      version: '1.0.0',
      description:
        'API REST del sistema de administración de condominios. Casi todos los endpoints requieren un token ' +
        'JWT obtenido en POST /api/auth/login — usá el botón "Authorize" e ingresá `Bearer <token>` (o solo el ' +
        'token, según el cliente).',
    },
    servers: [
      { url: 'http://localhost:3001', description: 'Local' },
      { url: 'https://condo-backend-o5av.onrender.com', description: 'Producción (Render)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: { error: { type: 'string', example: 'Mensaje de error' } },
        },
        Ok: {
          type: 'object',
          properties: { ok: { type: 'boolean', example: true } },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Falta token o el token es inválido/expiró',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Forbidden: {
          description: 'El rol del usuario no tiene permiso para esta acción, o pertenece a otro condominio',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        NotFound: {
          description: 'No encontrado',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Login, recuperación y reseteo de contraseña (público)' },
      { name: 'Condominios', description: 'Alta/baja de condominios, QR de pago, asignación de expensas' },
      { name: 'Usuarios', description: 'Gestión de usuarios del sistema' },
      { name: 'Propiedades', description: 'Propiedades y cargos extra' },
      { name: 'Pagos', description: 'Pagos de expensas y reservas' },
      { name: 'Anuncios', description: 'Comunicados del condominio' },
      { name: 'Asambleas', description: 'Asambleas, votación y documentos adjuntos' },
      { name: 'Visitas', description: 'Pases QR de visitas y sus documentos (carnet, placa)' },
      { name: 'Historial Visitas', description: 'Registro de ingresos/salidas de visitas' },
      { name: 'Botón de Pánico', description: 'Alertas de pánico' },
      { name: 'Áreas Sociales', description: 'Áreas comunes reservables (churrasquera, salón, etc.)' },
      { name: 'Reservas de Áreas', description: 'Reservas de áreas sociales y su cobro' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
