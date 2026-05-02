const nodemailer = require('nodemailer');

console.log(' Configurando transporte...');

const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 2525,
  auth: {
    user: 'rzp',
    pass: 'rzp'
  }
});

console.log(' Listo. Enviando email de prueba...\n');

transporter.sendMail({
  from: 'prueba@tuapp.com',
  to: 'usuario@example.com',
  subject: '¡Funciona perfectamente!',
  html: `
    <div style="font-family: Arial; padding: 20px; background: #f5f5f5; border-radius: 8px;">
      <h1>Hola </h1>
      <p>Este es un email de prueba desde tu backend.</p>
      <p><strong>Estado:</strong> Enviado correctamente</p>
      <p style="color: #666; font-size: 12px;">Si lo ves en RZP Mail, ¡la extensión está funcionando!</p>
    </div>
  `
}, (err, info) => {
  if (err) {
    console.log('Error:', err.message);
  } else {
    console.log('Email enviado correctamente');
    console.log('Revisa el panel de RZP Mail en VS Code\n');
  }
});
