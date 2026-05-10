import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Configuración del servidor MailCat
SMTP_HOST = "localhost"
SMTP_PORT = 2525
SMTP_USER = "rzp"
SMTP_PASS = "rzp"

def send_test_email():
    # Crear el mensaje
    message = MIMEMultipart("alternative")
    message["Subject"] = "Prueba desde Python! Cat"
    message["From"] = "python-test@mailcat.com"
    message["To"] = "dev@example.com"

    # Cuerpo en HTML
    html = """
    <html>
      <body style="font-family: sans-serif; color: #333; padding: 20px;">
        <h1 style="color: #6366f1;">¡MailCat está funcionando!</h1>
        <p>Este correo fue enviado usando <b>Python</b> y smtplib.</p>
        <div style="background: #f3f4f6; padding: 15px; border-left: 4px solid #6366f1;">
          <p>Si estás viendo esto en tu panel de VS Code, significa que la interceptación SMTP es correcta.</p>
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">
          Enviado el: {}
        </p>
      </body>
    </html>
    """.format(smtplib.datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    message.attach(MIMEText(html, "html"))

    try:
        # Conectar al servidor y enviar
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(message["From"], message["To"], message.as_string())
        print("OK: Email enviado con exito. Revisa MailCat en VS Code.")
    except Exception as e:
        print(f"ERROR: Error al enviar el email: {e}")

if __name__ == "__main__":
    send_test_email()
