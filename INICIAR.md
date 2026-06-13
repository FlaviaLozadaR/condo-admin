# Cómo iniciar el proyecto

## 1. Iniciar el Backend (Terminal 1)
```bash
cd backend
npm start
```
Corre en: http://localhost:3001

## 2. Iniciar el Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```
Corre en: http://localhost:5173

## Usuarios demo
| Rol         | Email                        | Contraseña |
|-------------|------------------------------|------------|
| Super Admin | superadmin@condominio.com    | 123456     |
| Admin       | admin@condominio.com         | 123456     |
| Propietario | juan@email.com               | 123456     |
| Inquilino   | ana@email.com                | 123456     |
| Seguridad   | carlos@email.com             | 123456     |

## API disponible en http://localhost:3001/api
- POST   /auth/login
- GET/POST /condominios
- GET/POST/PUT/DELETE /usuarios/:id
- GET/POST/PUT/DELETE /propiedades/:id
- GET/POST /pagos · PATCH /pagos/:id/status
- GET/POST /anuncios · DELETE /anuncios/:id
- GET/POST /asambleas · POST /asambleas/:id/vote
- GET/POST /visitas · PATCH /visitas/:id/status
- GET/POST /historial-visitas
- GET/POST /panic · PATCH /panic/:id/status
