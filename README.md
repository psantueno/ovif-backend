# ovif-backend

## Configuración de correo

El servicio de restablecimiento de contraseña utiliza Nodemailer y el servidor `mail.haciendanqn.gob.ar`. Configurá estas variables en tu `.env`:

- `SMTP_HOST=mail.haciendanqn.gob.ar`
- `SMTP_PORT=465`
- `SMTP_USER=<cuenta>@haciendanqn.gob.ar`
- `SMTP_PASS=<contraseña de la cuenta>`
- `EMAIL_FROM="OVIF <ovif@haciendanqn.gob.ar>"`
- `SMTP_SECURE=true` (SSL/TLS como indicó Infraestructura)
