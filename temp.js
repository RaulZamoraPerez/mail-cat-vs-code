
          const vscode = acquireVsCodeApi();
          let emails = [];
          let selectedEmailId = null;
          let serverRunning = false;
          let isConfigMode = true;
       let currentPort = '2525';
let currentPass = 'rzp';

          // Iconos de email
          const ICON_MAIL_SCREEN = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><g fill="none"><path fill="currentColor" d="M13.435 19.174A7.15 7.15 0 0 0 14.738 23H9.26a7.16 7.16 0 0 0 1.303-3.826z"/><path fill="currentColor" d="M23 16.304v1.913a.957.957 0 0 1-.957.957H1.957A.956.956 0 0 1 1 18.217v-1.913z"/><path fill="currentColor" d="M23 1.957v14.347H1V1.957A.957.957 0 0 1 1.957 1h20.087a.956.956 0 0 1 .956.957"/><path fill="currentColor" d="M1 1.957v14.347h4.175L20.48 1H1.957A.957.957 0 0 0 1 1.957"/><path fill="currentColor" d="M16.302 5.783h-8.61a.957.957 0 0 0-.956.956v4.783a.957.957 0 0 0 .957.956h8.609a.957.957 0 0 0 .956-.956V6.739a.956.956 0 0 0-.956-.956"/><path fill="currentColor" d="M7.696 5.783a.957.957 0 0 0-.957.956v4.783a.957.957 0 0 0 .957.956H9l6.696-6.695z"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M16.305 5.783h-8.61a.957.957 0 0 0-.956.956v4.783a.957.957 0 0 0 .957.956h8.609a.956.956 0 0 0 .956-.956V6.739a.956.956 0 0 0-.957-.956" stroke-width=".8"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m6.74 7.217l4.304 2.2a1.91 1.91 0 0 0 1.913 0l4.304-2.2M9.262 23a7.16 7.16 0 0 0 1.303-3.826M14.737 23a7.16 7.16 0 0 1-1.302-3.826M7.695 23h8.609M1 16.304h22" stroke-width=".8"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M22.044 1H1.957A.957.957 0 0 0 1 1.957v16.26a.957.957 0 0 0 .957.957h20.087a.956.956 0 0 0 .956-.957V1.957A.956.956 0 0 0 22.044 1" stroke-width=".8"/></g></svg>';
          const ICON_MAIL_GEOMETRIC = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><g fill="none"><path fill="currentColor" d="M22.615 5.296a2.86 2.86 0 0 0 .84-2.29c-.26-2.67-4.451-2-7.011 2.63a.3.3 0 0 0 .1.41a.31.31 0 0 0 .46-.11c.8-1.27 2.52-3.14 4-3.43a1.6 1.6 0 0 1 1.22.06c.44.33.2 1.25-.12 1.71l-.75.73c-.07.12-.64.53-.3 1s1 0 1.61.7c1.09 1.21-1.77 1.89-1.69 2.7c0 .36.43.42.85.51c1.72.321-.62 3.151-3.3 3.481a.35.35 0 0 0-.3.37c.08.72 2.06-.1 2.65-.41a5.8 5.8 0 0 0 1.91-1.47a1.85 1.85 0 0 0-.11-2.68c2.03-1.36 1.5-3.3-.06-3.91m-17.132 7.79a6 6 0 0 1-2-.72c-.68-.38-1.671-1.14-1.841-1.92c-.28-1.36 1.21-.35 1.36-1.35a.65.65 0 0 0-.28-.57c-.18-.13-.66-.41-.69-.43a3 3 0 0 1-.7-.6a.88.88 0 0 1 .55-1.49c.22 0 .77 0 1.12-.32c.63-.791-1.24-1.071-1.37-2.681a.79.79 0 0 1 .23-.74a.84.84 0 0 1 .49-.15a4 4 0 0 1 2.53 1.07c.847.71 1.582 1.542 2.18 2.47a.29.29 0 0 0 .4.1a.3.3 0 0 0 .11-.41a11.6 11.6 0 0 0-2.18-2.75a5.5 5.5 0 0 0-2.11-1.27a3.9 3.9 0 0 0-1.13-.16a1.77 1.77 0 0 0-.88.29a1.7 1.7 0 0 0-.71 1.29a2.83 2.83 0 0 0 .84 2.26a2.3 2.3 0 0 0-.9.63a1.9 1.9 0 0 0-.5 1.2c-.011.42.115.83.36 1.17c.273.361.613.666 1 .9a1.44 1.44 0 0 0-.52.66a1.7 1.7 0 0 0-.07.901c.067.407.239.79.5 1.11a6.1 6.1 0 0 0 1.86 1.43a6.9 6.9 0 0 0 2.28.71a.34.34 0 0 0 .37-.3a.33.33 0 0 0-.3-.33m2.911 4.291a.3.3 0 0 0-.31.28c-.12.56-.27 1.1-.37 1.66a6 6 0 0 0-.1.72c0 .24 0 .48-.05.72v1.7a.34.34 0 0 0 .67.11c.15-.57.31-1.11.43-1.68c.05-.24.09-.48.12-.73a6 6 0 0 0 0-.73c0-.59-.07-1.15-.12-1.74a.29.29 0 0 0-.27-.31m3.721-.27a.301.301 0 0 0-.6-.05a10 10 0 0 0-.25 1.95q.01.562.08 1.12q.105.807.09 1.62a.34.34 0 0 0 .26.4a.35.35 0 0 0 .4-.27c.206-.647.317-1.32.33-2q.015-.577-.06-1.15c-.07-.53-.22-1.06-.25-1.62m3.8 2.11c-.11-.47-.27-.9-.4-1.36a.3.3 0 0 0-.527-.154a.3.3 0 0 0-.063.214a14 14 0 0 0-.08 1.43q.02.603.16 1.19c.1.46.23.9.34 1.36a.34.34 0 0 0 .36.31a.34.34 0 0 0 .31-.37q.037-.714 0-1.43q.022-.3 0-.6a4 4 0 0 0-.1-.59"/><path fill="currentColor" d="M16.814 7.556a1.85 1.85 0 0 0-.77-.2a36 36 0 0 0-4.381 0a19 19 0 0 0-4.541.65c-.3.14-.73.41-.73 1.76q.006 2.509.28 5.002a.74.74 0 0 0 .66.64c1.14 0 5.07-.11 7.441-.23c.78 0 1.4-.07 1.69-.1c.136-.012.269-.05.39-.11a1.15 1.15 0 0 0 .33-.73q.246-1.823.24-3.661c.014-.751-.05-1.502-.19-2.24a1.47 1.47 0 0 0-.42-.78m-1 .91a1.4 1.4 0 0 1 .31 0c-.6.32-1.89 1-3.051 1.54l-1.23.561c-.46.2-.55.29-1.07 0s-1-.59-1.51-1s-.96-.56-1.341-.89q.935-.143 1.88-.19a52 52 0 0 1 5.961-.02zm.37 5.542c0 .08-.11.09-.19.1c-1 .07-3.061.27-5.001.4c-2.44.16-3.371.2-3.651.21a.1.1 0 0 1-.11-.09a21 21 0 0 1-.1-2.43c0-1.14 0-2.391.1-3.091a23 23 0 0 0 2.19 1.94a4.5 4.5 0 0 0 1.65.91a4.7 4.7 0 0 0 1.93-.69a38 38 0 0 0 3.211-2.12c0 .24.05.51.07.81a30 30 0 0 1-.1 4.05"/></g></svg>';

          function startServer() {
            const btn = document.getElementById('startBtn');
            if (btn) {
              btn.disabled = true;
              btn.textContent = '⏳ Iniciando...';
            }
            vscode.postMessage({ command: 'startServer' });
          }

          function stopServer() {
            const btn = document.getElementById('stopBtn');
            if (btn) {
              btn.disabled = true;
              btn.textContent = '⏳ Deteniendo...';
            }
            vscode.postMessage({ command: 'stopServer' });
          }

          function updateServerStatus(running) {
  serverRunning = running;
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const startBtn = document.getElementById('startBtn');
  const readySection = document.getElementById('readySection');
  const smtpPort = document.getElementById('smtpPort');
  const smtpPass = document.getElementById('smtpPass');
  const configButtons = document.querySelectorAll('[data-config-btn]');

  const stopBtn = document.getElementById('stopBtn');

  if (running) {
    if (statusDot) statusDot.classList.add('active');
    if (statusText) statusText.textContent = 'Servidor: ON ✓';
    if (startBtn) startBtn.style.display = 'none';
    if (stopBtn) { stopBtn.style.display = 'inline-block'; stopBtn.disabled = false; stopBtn.textContent = '🛑 Detener Servidor'; }
    if (readySection) readySection.style.display = 'block';
    // Deshabilitar inputs
    if (smtpPort) { smtpPort.disabled = true; smtpPort.style.opacity = '0.5'; }
    if (smtpPass) { smtpPass.disabled = true; smtpPass.style.opacity = '0.5'; }
    configButtons.forEach(btn => { btn.disabled = true; btn.style.opacity = '0.5'; });
    // Mostrar config activa
    document.getElementById('configActiveTitle').style.display = 'block';
    document.getElementById('activeConfig').style.display = 'block';
    document.getElementById('activePort').textContent = document.getElementById('smtpPort').value;
  } else {
    if (statusDot) statusDot.classList.remove('active');
    if (statusText) statusText.textContent = 'Servidor: OFF';
    if (startBtn) { startBtn.style.display = 'inline-block'; startBtn.disabled = false; startBtn.textContent = '🚀 Iniciar Servidor'; }
    if (stopBtn) stopBtn.style.display = 'none';
    if (readySection) readySection.style.display = 'none';
    // Habilitar inputs
    if (smtpPort) { smtpPort.disabled = false; smtpPort.style.opacity = '1'; }
    const smtpUser = document.getElementById('smtpUser');
    if (smtpUser) { smtpUser.disabled = false; smtpUser.style.opacity = '1'; }
    if (smtpPass) { smtpPass.disabled = false; smtpPass.style.opacity = '1'; }
    configButtons.forEach(btn => { btn.disabled = false; btn.style.opacity = '1'; });
    // Ocultar config activa
    document.getElementById('configActiveTitle').style.display = 'none';
    document.getElementById('activeConfig').style.display = 'none';
  }
}

          function updateSnippet() {
            const lang = document.getElementById('snippetLanguage').value;
            const port = document.getElementById('smtpPort').value || '2525';
            const user = document.getElementById('smtpUser').value || 'rzp';
            const pass = document.getElementById('smtpPass').value || 'rzp';
            
            let code = '';
            if (lang === 'node') {
              code = \`const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: \${port},
  auth: { user: '\${user}', pass: '\${pass}' }
});

await transporter.sendMail({
  from: 'test@app.com',
  to: 'user@test.com',
  subject: 'Prueba MailCat',
  html: '<h1>¡Funciona!</h1>'
});\`;
            } else if (lang === 'php') {
              code = \`use PHPMailer\\\\PHPMailer\\\\PHPMailer;

$mail = new PHPMailer(true);
$mail->isSMTP();
$mail->Host       = 'localhost';
$mail->SMTPAuth   = true;
$mail->Username   = '\${user}';
$mail->Password   = '\${pass}';
$mail->Port       = \${port};

$mail->setFrom('test@app.com');
$mail->addAddress('user@test.com');
$mail->isHTML(true);
$mail->Subject = 'Prueba MailCat';
$mail->Body    = '<h1>¡Funciona!</h1>';
$mail->send();\`;
            } else if (lang === 'python') {
              code = \`import smtplib
from email.message import EmailMessage

msg = EmailMessage()
msg.set_content('¡Funciona!')
msg['Subject'] = 'Prueba MailCat'
msg['From'] = 'test@app.com'
msg['To'] = 'user@test.com'

with smtplib.SMTP('localhost', \${port}) as server:
    server.login('\${user}', '\${pass}')
    server.send_message(msg)\`;
            } else if (lang === 'csharp') {
              code = \`using System.Net.Mail;
using System.Net;

var client = new SmtpClient("localhost", \${port}) {
    Credentials = new NetworkCredential("\${user}", "\${pass}"),
    EnableSsl = false
};

var mailMessage = new MailMessage
{
    From = new MailAddress("test@app.com"),
    Subject = "Prueba MailCat",
    Body = "<h1>¡Funciona!</h1>",
    IsBodyHtml = true,
};
mailMessage.To.Add("user@test.com");

client.Send(mailMessage);\`;
            }
            
            document.getElementById('snippetCode').textContent = code;
          }

          function copySnippet() {
            const code = document.getElementById('snippetCode').textContent;
            vscode.postMessage({ command: 'copyToClipboard', text: code, message: '📋 Snippet copiado al portapapeles' });
          }

          // Inicializar snippet
          setTimeout(updateSnippet, 100);

          function copyActiveConfig() {
            const port = document.getElementById('activePort').textContent;
            const config = 'host: localhost\\nport: ' + port + '\\nuser: rzp';
            vscode.postMessage({ command: 'copyToClipboard', text: config, message: '✅ Configuración copiada' });
          }

          function updateSmtpConfig() {
            const portStr = document.getElementById('smtpPort')?.value || '2525';
            const port = parseInt(portStr);
            const user = document.getElementById('smtpUser')?.value || 'rzp';
            const pass = document.getElementById('smtpPass')?.value || 'rzp';
            
            // Validar puerto
            if (isNaN(port) || port < 1 || port > 65535) {
              vscode.postMessage({ command: 'showError', message: 'Puerto inválido. Usar número entre 1 y 65535' });
              return;
            }
            
            // Enviar al provider para guardar en globalState
            vscode.postMessage({ 
              command: 'updateSmtpConfig',
              port: port,
              user: user,
              pass: pass
            });
          }

         function copyEnvConfig() {
  const port = document.getElementById('smtpPort')?.value || '2525';
  const user = document.getElementById('smtpUser')?.value || 'rzp';
  const pass = document.getElementById('smtpPass')?.value || 'rzp';
  const envContent = 'SMTP_HOST=localhost\\nSMTP_PORT=' + port + '\\nSMTP_USER=' + user + '\\nSMTP_PASS=' + pass;
  vscode.postMessage({ command: 'copyToClipboard', text: envContent, message: '📋 Config .env copiada al portapapeles' });
}

          function generateEnvFile() {
            // Deprecated - use copyEnvConfig instead
          }

          function copyConfig() {
            const config = \`host: localhost\\nport: 2525\`;
            vscode.postMessage({ command: 'copyToClipboard', text: config, message: 'Config copiada' });
          }

          function clearInbox() {
            vscode.postMessage({ command: 'confirmClearInbox' });
          }

          function showConfig() {
            isConfigMode = true;
            document.getElementById('welcomeScreen').style.display = 'flex';
            document.getElementById('emptyState').style.display = 'none';
            document.getElementById('emailDetailContainer').style.display = 'none';
            document.querySelectorAll('.email-item').forEach(el => el.classList.remove('active'));
            selectedEmailId = null;
          }

          function selectEmail(emailId) {
            isConfigMode = false;
            selectedEmailId = emailId;
            const email = emails.find(e => e.id === emailId);
            
            // Actualizar UI
            document.querySelectorAll('.email-item').forEach(el => {
              el.classList.remove('active');
            });
            document.querySelector(\`[data-id="\${emailId}"]\`)?.classList.add('active');

            // Mostrar detalle
            showEmailDetail(email);            
            // Si el preview está activo, cargar el HTML en el iframe
            setTimeout(() => {
              const iframe = document.getElementById('emailIframe');
              if (iframe && email.html) {
                iframe.srcdoc = email.html;
              }
            }, 100);          }

          function showEmailDetail(email) {
            document.getElementById('welcomeScreen').style.display = 'none';
            document.getElementById('emptyState').style.display = 'none';
            const detailContainer = document.getElementById('emailDetailContainer');
            detailContainer.style.display = 'block';
            
            detailContainer.innerHTML = \`
              <div class="email-detail">
                <div class="detail-header">
                  <div class="detail-subject">\${email.subject}</div>
                  <div class="detail-meta">
                    <div class="detail-meta-row">
                      <span class="detail-meta-label">De:</span>
                      <span>\${email.from}</span>
                    </div>
                    <div class="detail-meta-row">
                      <span class="detail-meta-label">Para:</span>
                      <span>\${email.toDisplay}</span>
                    </div>
                    <div class="detail-meta-row">
                      <span class="detail-meta-label">Hora:</span>
                      <span>\${email.dateDisplay}</span>
                    </div>
                  </div>
                </div>

                <div class="tabs">
                  <div class="tab active" onclick="switchTab('preview', this)">Preview</div>
                  <div class="tab" onclick="switchTab('html', this)">HTML</div>
                  <div class="tab" onclick="switchTab('text', this)">Texto</div>
                  \${email.attachments && email.attachments.length > 0 ? \`<div class="tab" onclick="switchTab('attachments', this)">📎 Adjuntos (\${email.attachments.length})</div>\` : ''}
                </div>

                <div id="tabContent" class="tab-content">
                  \${renderPreview(email)}
                </div>
              </div>
            \`;
            
            // Cargar el HTML en el iframe después de renderizar
            setTimeout(() => {
              const iframe = document.getElementById('emailIframe');
              if (iframe && email.html) {
                iframe.srcdoc = email.html;
              }
            }, 100);
          }

          function renderPreview(email) {
            if (!email.html) {
              return \`<div class="raw-content">\${email.text || 'Sin contenido'}</div>\`;
            }
            
            const validation = email.validation;
            const getScoreColor = (score) => score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
            const getScoreBadge = (score) => {
              if (score >= 80) return '';
              if (score >= 50) return '';
              return '';
            };
            
            let validationHtml = '';
            if (validation) {
              const cssScore = validation.css.score;
              const linksScore = validation.links.score;
              const perfScore = validation.performance.score;
              const clientAvgScore = validation.clientCompatibility.average;
              
              validationHtml = \`
                <div class="validation-panel">
                  <h3>Métricas de Validación</h3>
                  
                  <div class="metrics-grid">
                    <div class="metric-card">
                      <div class="metric-header">CSS Compatibility</div>
                      <div class="metric-score" style="color: \${getScoreColor(cssScore)}">
                        \${getScoreBadge(cssScore)} \${cssScore}%
                      </div>
                      \${validation.css.unsupportedProperties.length > 0 ? 
                        \`<div class="metric-details">\${validation.css.unsupportedProperties.slice(0, 2).join(', ')}\${validation.css.unsupportedProperties.length > 2 ? '...' : ''}</div>\` 
                        : '<div class="metric-details">Sin problemas</div>'}
                    </div>
                    
                    <div class="metric-card">
                      <div class="metric-header">Links (\${validation.links.totalLinks})</div>
                      <div class="metric-score" style="color: \${getScoreColor(linksScore)}">
                        \${getScoreBadge(linksScore)} \${linksScore}%
                      </div>
                      <div class="metric-details">
                        Externas: \${validation.links.externalLinks.length}
                      </div>
                    </div>
                    
                    <div class="metric-card">
                      <div class="metric-header">Performance</div>
                      <div class="metric-score" style="color: \${getScoreColor(perfScore)}">
                        \${getScoreBadge(perfScore)} \${perfScore}%
                      </div>
                      <div class="metric-details">
                        \${(validation.performance.totalSize / 1024).toFixed(1)}KB<br>
                        \${validation.performance.imageCount} imgs
                      </div>
                    </div>
                    
                    <div class="metric-card">
                      <div class="metric-header">Client Support</div>
                      <div class="metric-score" style="color: \${getScoreColor(clientAvgScore)}">
                        \${getScoreBadge(clientAvgScore)} \${clientAvgScore}%
                      </div>
                      <div class="client-scores">
                        Gmail: \${validation.clientCompatibility.gmail}%<br>
                        Outlook: \${validation.clientCompatibility.outlook}%
                      </div>
                    </div>
                  </div>
                </div>
              \`;
            }
            
            return \`<div class="preview-wrapper">
              \${validationHtml}
              <div class="simulator-controls" style="padding: 10px; display: flex; gap: 8px; justify-content: center; background: var(--vscode-editor-background); border-bottom: 1px solid var(--vscode-widget-border);">
                <button class="btn btn-secondary" onclick="setDeviceMode('desktop')" style="font-size: 11px;">💻 Desktop</button>
                <button class="btn btn-secondary" onclick="setDeviceMode('tablet')" style="font-size: 11px;">📟 Tablet</button>
                <button class="btn btn-secondary" onclick="setDeviceMode('mobile')" style="font-size: 11px;">📱 Mobile</button>
              </div>
              <div class="preview-container" style="display: flex; justify-content: center; background: #0a0e14; padding: 24px; min-height: 600px; overflow-y: auto;">
                <div id="mockupContainer" class="device-mockup desktop">
                  <iframe class="preview-iframe" id="emailIframe" sandbox="allow-same-origin"></iframe>
                </div>
              </div>
            </div>\`;
          }

          function analyzeHtmlCompatibility(html) {
            let issues = [];
            let score = 100;

            // Buscar características no soportadas
            const incompatiblePatterns = [
              { pattern: /\b(grid|flex|subgrid)\b/gi, issue: 'Flexbox/Grid limitado', impact: 5 },
              { pattern: /\bbackground-image:\s*url/gi, issue: 'Background images bloqueados', impact: 10 },
              { pattern: /\bonload=/gi, issue: 'Event handlers no permitidos', impact: 15 },
              { pattern: /\s+style=\s*["\'].*?animation/gi, issue: 'Animaciones no soportadas', impact: 5 },
              { pattern: /<iframe/gi, issue: 'IFrames no permitidos', impact: 20 },
              { pattern: /<script/gi, issue: 'Scripts no permitidos', impact: 25 },
              { pattern: /\b(position|z-index):\s*(fixed|sticky)/gi, issue: 'Posicionamiento limitado', impact: 10 }
            ];

            incompatiblePatterns.forEach(item => {
              if (item.pattern.test(html)) {
                issues.push(item.issue);
                score -= item.impact;
              }
            });

            score = Math.max(0, score);
            let level = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger';
            
            return { score, issues: [...new Set(issues)], level };
          }

          function setDeviceMode(mode) {
            const container = document.getElementById('mockupContainer');
            if (container) {
              container.className = 'device-mockup ' + mode;
            }
          }

          function openAttachment(filename) {
            vscode.postMessage({ command: 'openAttachment', emailId: selectedEmailId, filename: filename });
          }

          function switchTab(tab, element) {
            // Cambiar tab activo
            document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
            element.classList.add('active');

            const email = emails.find(e => e.id === selectedEmailId);
            const tabContent = document.getElementById('tabContent');

            if (tab === 'preview') {
              tabContent.innerHTML = renderPreview(email);
              // Si hay HTML, cargar en el iframe
              setTimeout(() => {
                const iframe = document.getElementById('emailIframe');
                if (iframe && email.html) {
                  iframe.srcdoc = email.html;
                }
              }, 50);
            } else if (tab === 'html') {
              tabContent.innerHTML = email.html ? highlightHtml(email.html) : '<div style="padding: 20px; text-align: center; color: #6b7280;">Sin HTML</div>';
            } else if (tab === 'text') {
              const text = email.text || 'Sin texto';
              tabContent.innerHTML = \`<pre class="raw-content">\${text}</pre>\`;
            } else if (tab === 'attachments') {
              if (email.attachments && email.attachments.length > 0) {
                const attHtml = email.attachments.map(att => {
                  const sizeKB = (att.size / 1024).toFixed(1);
                  return \`
                    <div class="attachment-item" style="padding: 12px; background: var(--vscode-list-hoverBackground); border: 1px solid var(--vscode-widget-border); margin-bottom: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                      <div style="display: flex; flex-direction: column;">
                        <strong style="font-size: 13px;">\${att.filename}</strong>
                        <span style="font-size: 11px; opacity: 0.7; margin-top: 4px;">\${att.contentType} • \${sizeKB} KB</span>
                      </div>
                      <button class="btn btn-secondary" onclick="openAttachment('\${att.filename}')" style="padding: 6px 12px; background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; cursor: pointer;">📂 Abrir</button>
                    </div>
                  \`;
                }).join('');
                tabContent.innerHTML = \`<div style="padding: 16px;">
                  <h3 style="margin-bottom: 16px; color: var(--vscode-foreground);">Archivos Adjuntos (\${email.attachments.length})</h3>
                  \${attHtml}
                </div>\`;
              } else {
                tabContent.innerHTML = \`<div style="padding: 16px; text-align: center; opacity: 0.7;">No hay archivos adjuntos</div>\`;
              }
            }
          }

          function escapeHtml(text) {
            const map = {
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;',
              '"': '&quot;',
              "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
          }

          function highlightHtml(html) {
            if (!html) return '';
            let escaped = escapeHtml(html);
            
            // Resaltar etiquetas y atributos (Tema oscuro de VS Code)
            escaped = escaped.replace(/(&lt;\/?)([\w-]+)(.*?)(&gt;)/g, function(match, p1, p2, p3, p4) {
              let attrs = p3.replace(/([\w-]+)=(&quot;.*?&quot;|&#039;.*?&#039;)/g, '<span style="color: #9cdcfe;">$1</span>=<span style="color: #ce9178;">$2</span>');
              return \`\${p1}<span style="color: #569cd6;">\${p2}</span>\${attrs}\${p4}\`;
            });

            // Añadir números de línea
            const lines = escaped.split('\\n');
            const linesHtml = lines.map((line, i) => 
              \`<div style="display: flex;"><div style="min-width: 35px; text-align: right; color: #858585; padding-right: 12px; border-right: 1px solid #404040; margin-right: 12px; user-select: none;">\${i + 1}</div><div style="white-space: pre-wrap; word-break: break-all;">\${line || ' '}</div></div>\`
            ).join('');
            
            return \`<div style="background: #1e1e1e; padding: 16px 0; font-family: 'Fira Code', Consolas, monospace; font-size: 13px; line-height: 1.6; overflow-x: auto; border-radius: 4px;">\${linesHtml}</div>\`;
          }

          // Cargar configuración guardada
          setTimeout(() => {
            const smtpPort = document.getElementById('smtpPort');
            const smtpPass = document.getElementById('smtpPass');
            if (smtpPort) smtpPort.value = localStorage.getItem('rzp-smtp-port') || '2525';
            if (smtpPass) smtpPass.value = localStorage.getItem('rzp-smtp-pass') || 'rzp';
          }, 100);

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateEmails') {
              console.log('[Webview] Recibido updateEmails con ' + message.emails.length + ' emails');
              emails = message.emails;
              const emailList = document.getElementById('emailList');
              const stats = document.getElementById('emailStats');
              const welcomeScreen = document.getElementById('welcomeScreen');
              const emptyState = document.getElementById('emptyState');

              // Actualizar estado real del servidor siempre
              updateServerStatus(message.isRunning);
              
              if (emails.length > 0) {
                // Si había estado en modo "sin emails", quitar el empty state
                if (emptyState && !selectedEmailId && !isConfigMode) {
                  emptyState.style.display = 'flex';
                }
              }

              stats.textContent = \`Total: \${emails.length} | Último: \${emails[0]?.dateDisplay || '-'}\`;

              if (emails.length === 0) {
                emailList.innerHTML = \`
                  <div class="empty-state">
                    <p>\${ICON_MAIL_GEOMETRIC}</p>
                    <p>Sin emails</p>
                  </div>
                \`;
              } else {
                emailList.innerHTML = emails.map(email => \`
                  <div class="email-item" data-id="\${email.id}" onclick="selectEmail('\${email.id}')">
                    <div class="email-from">\${ICON_MAIL_SCREEN} <span class="search-text">\${email.from}</span></div>
                    <div class="email-subject search-text">\${email.subject}</div>
                    <div class="email-meta">
                      <span>\${email.toDisplay}</span>
                      <span>\${email.dateDisplay}</span>
                    </div>
                  </div>
                \`).join('');
                
                // Reaplicar filtro si hay búsqueda activa
                filterEmails();
              }

              // Fix: re-renderizar detalle cuando llegan nuevos emails
               if (emails.length > 0 && selectedEmailId) {
  const stillExists = emails.find(e => e.id === selectedEmailId);
  if (!stillExists) {
    selectEmail(emails[0].id); // Solo si el email fue borrado
  } else {
    // Solo actualizar la lista, NO re-renderizar el detalle
  document.querySelector('[data-id="' + selectedEmailId + '"]')?.classList.add('active');
  }
} else if (emails.length > 0 && !selectedEmailId && !isConfigMode) {
  selectEmail(emails[0].id);
}
            } else if (message.command === 'loadConfig') {
              const smtpPort = document.getElementById('smtpPort');
              const smtpUser = document.getElementById('smtpUser');
              const smtpPass = document.getElementById('smtpPass');
              if (smtpPort) smtpPort.value = message.port || '2525';
              if (smtpUser) smtpUser.value = message.user || 'rzp';
              if (smtpPass) smtpPass.value = message.pass || 'rzp';
              currentPort = message.port;
              currentPass = message.pass;
            } else if (message.command === 'selectEmail') {
              selectEmail(message.emailId);
            }
          });

          // Pedir actualización inicial
          vscode.postMessage({ command: 'getEmails' });

          function filterEmails() {
            const query = document.getElementById('searchInput')?.value.toLowerCase() || '';
            const items = document.querySelectorAll('.email-item');
            items.forEach(item => {
              const textContent = Array.from(item.querySelectorAll('.search-text')).map(el => el.textContent).join(' ').toLowerCase();
              if (textContent.includes(query)) {
                item.style.display = 'block';
              } else {
                item.style.display = 'none';
              }
            });
          }
        