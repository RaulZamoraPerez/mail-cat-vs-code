#  Test Backend - Mail Sandbox

Carpeta de prueba para la extensión RZP Mail.

## 🚀 Pasos rápidos

### 1. Instala dependencias

```bash
npm install
```

### 2. Inicia RZP Mail Sandbox

En VS Code: `Ctrl+Shift+P` → `RZP Mail: Start Sandbox`

### 3. Envía un email de prueba

```bash
npm run send
```

###  Resultado

El email debería aparecer en el panel de **Mail** (panel lateral derecho).

---

## 📧 Archivos

- `send-email.js` - Script para enviar email de prueba
- `package.json` - Dependencias

## 🔧 Configuración SMTP

```
Host: localhost
Port: 2525
User: rzp
Pass: rzp
```

