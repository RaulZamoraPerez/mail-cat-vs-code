import * as vscode from "vscode";
import * as path from "path";
import { emailStorage, Email } from "./storage";
import { isServerRunning } from "./smtpServer";

export class InboxWebviewProvider {
  public static readonly viewType = "rzp-mail-inbox";

  private _panel?: vscode.WebviewPanel;
  private _inboxUpdatedEmitter = new vscode.EventEmitter<void>();
  public readonly onInboxUpdated = this._inboxUpdatedEmitter.event;
  private _onPanelChange?: (panel: vscode.WebviewPanel | undefined) => void;
  private _onStartServer?: () => void;

  constructor(private readonly _extensionUri: vscode.Uri, private readonly _context: vscode.ExtensionContext) { }

  public setOnPanelChange(callback: (panel: vscode.WebviewPanel | undefined) => void) {
    this._onPanelChange = callback;
  }

  public setOnStartServer(callback: () => void) {
    this._onStartServer = callback;
  }

  public getSmtpConfig() {
    const port = this._context.globalState.get('rzp-smtp-port', 2525);
    const user = this._context.globalState.get('rzp-smtp-user', 'rzp');
    const pass = this._context.globalState.get('rzp-smtp-pass', 'rzp');
    return {
      port: typeof port === 'string' ? parseInt(port) : port,
      user: String(user),
      pass: String(pass)
    };
  }

  public createInboxPanel() {
    // Si ya existe un panel, solo lo mostramos
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.Active);
      return;
    }

    // Crear nuevo panel en la columna activa (como una tab normal)
    this._panel = vscode.window.createWebviewPanel(
      InboxWebviewProvider.viewType,
      "RZP Mail Inbox",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        localResourceRoots: [this._extensionUri],
        retainContextWhenHidden: true,
      }
    );

    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    // Enviar configuración guardada
    setTimeout(() => {
      const config = this.getSmtpConfig();
      this._panel?.webview.postMessage({
        command: 'loadConfig',
        port: config.port,
        user: config.user,
        pass: config.pass
      });
    }, 500);

    // Manejar mensajes del webview
    this._panel.webview.onDidReceiveMessage((data) => {
      switch (data.command) {
        case "getEmails":
          this._sendEmails();
          break;
        case "clearInbox":
          emailStorage.clearEmails();
          this._sendEmails();
          vscode.window.showInformationMessage("Inbox limpiado");
          break;
        case "startServer":
          if (this._onStartServer) {
            this._onStartServer();
          }
          break;
        case "stopServer":
          vscode.commands.executeCommand("rzp-mail-sandbox.stop");
          break;
        case "updateSmtpConfig":
          // Guardar en almacenamiento de la extensión
          this._context.globalState.update('rzp-smtp-port', data.port);
          this._context.globalState.update('rzp-smtp-user', data.user);
          this._context.globalState.update('rzp-smtp-pass', data.pass);
          vscode.window.showInformationMessage(` Config guardada: puerto ${data.port}`);
          break;
        case "generateEnv":
          vscode.commands.executeCommand("rzp-mail-sandbox.generateEnv");
          break;
        case "saveSmtpConfig":
          this._context.globalState.update('rzp-smtp-port', data.port);
          this._context.globalState.update('rzp-smtp-pass', data.pass);
          vscode.window.showInformationMessage(` Config guardada: puerto ${data.port}`);
          break;
        case "copyToClipboard":
          vscode.env.clipboard.writeText(data.text).then(() => {
            if (data.message) {
              vscode.window.showInformationMessage(data.message);
            }
          });
          break;
        case "showError":
          vscode.window.showErrorMessage(data.message);
          break;
        case "confirmClearInbox":
          vscode.window.showQuickPick(["Sí", "No"], { placeHolder: "¿Limpiar todos los emails?" }).then(answer => {
            if (answer === "Sí") {
              emailStorage.clearEmails();
              this._sendEmails();
              vscode.window.showInformationMessage(" Inbox limpiado");
            }
          });
          break;
        case "openAttachment":
          if (data.emailId && data.filename) {
            const attachDir = path.join(emailStorage.getStorageDir(), 'attachments', data.emailId);
            const filePath = path.join(attachDir, data.filename);
            vscode.env.openExternal(vscode.Uri.file(filePath));
          }
          break;
      }
    });

    // Notificar que el panel fue creado
    if (this._onPanelChange) {
      this._onPanelChange(this._panel);
    }

    // Limpiar cuando se cierre
    this._panel.onDidDispose(() => {
      this._panel = undefined;
      if (this._onPanelChange) {
        this._onPanelChange(undefined);
      }
    });

    // Pedir actualización inicial
    this.refreshInbox();
  }

  public refreshInbox() {
    if (this._panel) {
      console.log(`🔄 [Webview] Refrescando inbox...`);
      this._sendEmails();
    } else {
      console.warn(`[Webview] Panel no disponible para refresh`);
    }
  }

  public selectEmail(emailId: string) {
    if (this._panel) {
      this._panel.webview.postMessage({
        command: "selectEmail",
        emailId: emailId
      });
    }
  }

  private _sendEmails() {
    if (!this._panel) return;

    const emails = emailStorage.getEmails();
    console.log(`📤 [Webview] Enviando ${emails.length} emails al webview`);
    this._panel.webview.postMessage({
      command: "updateEmails",
      isRunning: isServerRunning(),
      emails: emails.map(email => ({
        ...email,
        toDisplay: email.to.join(", "),
        dateDisplay: new Date(email.timestamp).toLocaleTimeString("es-ES")
      }))
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'images', 'logo.png'));
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RZP Mail - Mailtrap Style</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            /* Usar fuentes del sistema para un look nativo y elegante */
            font-family: var(--vscode-font-family), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            display: flex;
            flex-direction: column;
            height: 100vh;
            font-size: 13px;
          }

          /* Contenedor principal con sombra sutil de separación */
          .container {
            display: flex;
            height: 100%;
            background-color: var(--vscode-editor-background);
          }

          /* Sidebar rediseñado, más limpio */
          .sidebar {
            width: 280px;
            min-width: 250px;
            background-color: var(--vscode-sideBar-background);
            border-right: 1px solid var(--vscode-sideBarSectionHeader-border, rgba(128, 128, 128, 0.1));
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            box-shadow: 2px 0 8px rgba(0,0,0,0.05);
            z-index: 5;
          }

          .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background-color: var(--vscode-editor-background);
          }

          /* Cabecera superior elegante */
          .header {
            padding: 16px 24px;
            border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.15));
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: var(--vscode-editor-background);
            z-index: 10;
          }

          .header h2 {
            font-size: 16px;
            font-weight: 600;
            color: var(--vscode-editor-foreground);
            letter-spacing: 0.3px;
          }

          /* Botones con estilo profesional y flat design */
          .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: 1px solid transparent;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
          }

          .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          .btn:active {
            transform: translateY(1px);
          }

          .btn-secondary {
            background-color: transparent;
            border: 1px solid var(--vscode-button-background);
            color: var(--vscode-foreground);
          }

          .btn-secondary:hover {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
          }

          /* Stats integrados elegantemente en la lista */
          .stats {
            padding: 14px 20px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, rgba(128, 128, 128, 0.1));
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background-color: var(--vscode-sideBar-background);
          }

          .email-list {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
          }

          /* Elementos de la lista de correo con diseño de tarjetas modernas */
          .email-item {
            padding: 12px 16px;
            margin-bottom: 8px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.1));
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 1px 2px rgba(0,0,0,0.02);
          }

          .email-item:hover {
            background-color: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 2px 6px rgba(0,0,0,0.08);
          }

          .email-item.active {
            background-color: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
            border-color: var(--vscode-focusBorder);
            border-left: 3px solid var(--vscode-focusBorder);
          }

          .email-item.active .email-from,
          .email-item.active .email-subject,
          .email-item.active .email-meta {
            color: var(--vscode-list-activeSelectionForeground);
          }

          .email-from {
            font-weight: 600;
            font-size: 13px;
            margin-bottom: 4px;
            color: var(--vscode-editor-foreground);
          }

          .email-subject {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 6px;
            font-weight: 400;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .email-meta {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            opacity: 0.8;
          }

          /* Estados vacíos limpios */
          .empty-state, .empty-state-main {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100%;
            color: var(--vscode-descriptionForeground);
            text-align: center;
            padding: 24px;
          }
          
          .empty-state-main h3 {
            font-size: 18px;
            font-weight: 500;
            margin-bottom: 8px;
            color: var(--vscode-editor-foreground);
          }

          /* Panel de Detalles del correo (lado derecho) */
          .email-detail {
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow: hidden;
          }

          .detail-header {
            padding: 20px 24px;
            border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.1));
            background-color: var(--vscode-editor-background);
            flex-shrink: 0;
          }

          .detail-subject {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--vscode-editor-foreground);
            letter-spacing: 0.2px;
          }

          .detail-meta {
            display: grid;
            gap: 6px;
            font-size: 12px;
          }

          .detail-meta-row {
            display: flex;
            gap: 12px;
          }

          .detail-meta-label {
            font-weight: 600;
            min-width: 60px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.5px;
            padding-top: 1px;
          }

          .detail-content {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background-color: var(--vscode-editor-background);
          }

          /* Pestañas (Tabs) estilizadas */
          .tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.1));
            padding: 0 12px;
            background-color: var(--vscode-editor-background);
            flex-shrink: 0;
            gap: 4px;
          }

          .tab {
            padding: 12px 16px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
            color: var(--vscode-descriptionForeground);
          }

          .tab:hover {
            color: var(--vscode-foreground);
            background-color: var(--vscode-list-hoverBackground);
            border-radius: 4px 4px 0 0;
          }

          .tab.active {
            border-bottom-color: var(--vscode-focusBorder);
            color: var(--vscode-foreground);
            font-weight: 600;
          }

          .tab-content {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            padding: 0;
          }

          .tab-content > div {
            flex: 1;
            display: flex;
            flex-direction: column;
          }

          .preview-wrapper {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            min-height: 0;
          }

          /* Barra de advertencia/compatibilidad elegante */
          .compatibility-badge {
            padding: 10px 24px;
            background-color: var(--vscode-editorInfo-background, rgba(55, 148, 255, 0.1));
            border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.1));
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
          }

          .compat-score {
            font-weight: 600;
            color: var(--vscode-editorInfo-foreground, #3794ff);
          }

          .compat-score.warning {
            color: var(--vscode-editorWarning-foreground, #cca700);
            background-color: var(--vscode-editorWarning-background, rgba(204, 167, 0, 0.1));
            padding: 2px 8px;
            border-radius: 12px;
          }

          .compat-score.danger {
            color: var(--vscode-editorError-foreground, #f14c4c);
            background-color: var(--vscode-editorError-background, rgba(241, 76, 76, 0.1));
            padding: 2px 8px;
            border-radius: 12px;
          }

          .html-preview {
            width: 100%;
            height: 100%;
            border: none;
            background-color: #ffffff; /* El renderizado del email siempre debe ser blanco puro */
          }

          .preview-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            min-height: 0;
            padding: 16px 24px;
            background-color: var(--vscode-editorWidget-background, #f3f3f3); /* Un fondo gris tenue nativo para resaltar la hoja de papel (email) */
          }

          .preview-iframe {
            flex: 1;
            border: 1px solid var(--vscode-panel-border, rgba(0,0,0,0.1));
            border-radius: 6px;
            background: #ffffff;
            min-height: 0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08); /* Estilo "Hoja de papel" */
          }

          .raw-content {
            flex: 1;
            background-color: var(--vscode-editor-background);
            padding: 24px;
            font-family: 'Fira Code', 'JetBrains Mono', 'Monaco', monospace;
            font-size: 13px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-break: break-all;
            overflow: auto;
            min-height: 0;
            height: 100%;
            margin: 0;
            border: none;
            color: var(--vscode-editor-foreground);
          }

          /* Panel inferior de Validación */
          .validation-panel {
            padding: 20px 24px;
            background-color: var(--vscode-sideBar-background);
            border-top: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.1));
            flex-shrink: 0;
            overflow-y: auto;
            max-height: 300px;
          }

          .validation-panel h3 {
            margin: 0 0 16px 0;
            font-size: 14px;
            font-weight: 600;
            color: var(--vscode-editor-foreground);
            letter-spacing: 0.2px;
          }

          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
          }

          .metric-card {
            background-color: var(--vscode-editor-background);
            padding: 16px;
            border-radius: 6px;
            border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.1));
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          }

          .metric-header {
            font-weight: 600;
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .metric-score {
            font-size: 24px;
            font-weight: 300;
            margin: 8px 0;
            color: var(--vscode-editor-foreground);
          }

          .metric-details {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            line-height: 1.4;
          }

          .client-scores {
            font-size: 11px;
            line-height: 1.6;
          }

          .welcome-screen {
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 20px;
            overflow-y: auto;
            background-color: var(--vscode-editor-background);
          }

          .welcome-header {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 16px;
            color: var(--vscode-foreground);
          }

          .welcome-section {
            margin-bottom: 20px;
          }

          .welcome-section h3 {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 10px;
            color: var(--vscode-foreground);
          }

          .credentials-display {
            background-color: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.15));
            border-left: 3px solid var(--vscode-focusBorder);
            padding: 12px;
            border-radius: 6px;
            font-family: var(--vscode-editor-font-family), monospace;
            font-size: 13px;
            line-height: 1.6;
            margin-bottom: 12px;
            color: var(--vscode-editor-foreground);
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }

          .code-example {
            background-color: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.15));
            padding: 14px;
            border-radius: 6px;
            font-family: var(--vscode-editor-font-family), monospace;
            font-size: 12px;
            overflow-x: auto;
            margin-bottom: 12px;
            color: var(--vscode-editor-foreground);
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
          }

          .start-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: background-color 0.2s ease, transform 0.1s;
            align-self: flex-start;
            margin-top: 12px;
          }

          .start-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
          }

          .start-btn:active {
            transform: scale(0.98);
          }

          .device-mockup {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            margin: 0 auto;
            border-radius: 8px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            position: relative;
            background: #000;
          }

          .device-mockup.mobile {
            width: 375px;
            height: 812px;
            border-radius: 40px;
            padding: 12px;
            background: #000;
            /* Borde metálico oscuro estilo iPhone */
            box-shadow: 
              inset 0 0 2px 2px rgba(255, 255, 255, 0.15), 
              0 0 0 2px #4b5563,
              0 20px 40px rgba(0, 0, 0, 0.8);
          }
          
          /* Dynamic Island / Notch del móvil */
          .device-mockup.mobile::before {
            content: '';
            position: absolute;
            top: 22px;
            left: 50%;
            transform: translateX(-50%);
            width: 100px;
            height: 24px;
            background: #000;
            border-radius: 16px;
            z-index: 10;
            box-shadow: inset 0 0 2px rgba(255,255,255,0.1);
          }

          .device-mockup.tablet {
            width: 768px;
            height: 1024px;
            border-radius: 32px;
            padding: 24px;
            background: #000;
            /* Borde metálico estilo iPad */
            box-shadow: 
              inset 0 0 2px 1px rgba(255, 255, 255, 0.1),
              0 0 0 2px #374151,
              0 20px 40px rgba(0, 0, 0, 0.8);
          }
          
          /* Cámara del Tablet */
          .device-mockup.tablet::before {
             content: '';
             position: absolute;
             top: 10px;
             left: 50%;
             transform: translateX(-50%);
             width: 8px;
             height: 8px;
             background: #111;
             border-radius: 50%;
             box-shadow: inset 0 0 3px rgba(255,255,255,0.5);
             z-index: 10;
          }

          .device-mockup.desktop {
            width: 100%;
            height: 100%;
            min-height: 500px;
            border-radius: 8px;
            padding-top: 32px; /* Espacio para barra superior */
            background: #e5e7eb; /* Barra macOS clara */
            box-shadow: 
              0 0 0 1px rgba(255,255,255,0.1),
              0 20px 40px rgba(0,0,0,0.6);
          }
          
          /* Botones tipo macOS para desktop */
          .device-mockup.desktop::before {
            content: '';
            position: absolute;
            top: 11px;
            left: 14px;
            width: 11px;
            height: 11px;
            border-radius: 50%;
            background: #ff5f56;
            box-shadow: 18px 0 0 #ffbd2e, 36px 0 0 #27c93f;
            z-index: 10;
          }

          .device-mockup iframe {
            width: 100% !important;
            height: 100% !important;
            min-height: 100%;
            background: white;
            border: none !important;
            flex: 1;
          }

          /* Ajustar bordes del iframe según el dispositivo */
          .device-mockup.mobile iframe { border-radius: 28px; }
          .device-mockup.tablet iframe { border-radius: 8px; }
          .device-mockup.desktop iframe { border-radius: 0 0 8px 8px; }

          .start-btn.success {
            background-color: var(--vscode-charts-green, #4CAF50);
            color: #ffffff;
          }
            background-color: transparent;
            border-color: #50c878;
            color: #50c878;
          }

          .start-btn.success:hover {
            background-color: #0f2818;
          }

          .status-indicator {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 24px;
            padding: 16px;
            background-color: var(--vscode-editorWidget-background);
            border-radius: 8px;
            border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.15));
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          }

          .status-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background-color: var(--vscode-editorError-foreground, #f14c4c);
            box-shadow: 0 0 8px rgba(241, 76, 76, 0.4);
          }

          .status-dot.active {
            background-color: var(--vscode-charts-green, #4CAF50);
            box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
          }

          .credentials-box {
            background-color: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 12px;
            font-size: 12px;
            font-family: var(--vscode-editor-font-family), monospace;
            color: var(--vscode-editor-foreground);
          }

          .credentials-box p {
            margin-bottom: 6px;
            color: var(--vscode-descriptionForeground);
          }

          .copy-btn {
            background-color: var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.2));
            border: none;
            color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
            padding: 6px 12px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            border-radius: 4px;
            margin-top: 6px;
            transition: background 0.2s;
          }

          .copy-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground, rgba(128, 128, 128, 0.3));
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- SIDEBAR - Lista de emails -->
          <div class="sidebar">
            <div class="sidebar-header" style="display: flex; flex-direction: column; align-items: center; padding: 24px 20px 16px; background: var(--vscode-sideBar-background); border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, rgba(128, 128, 128, 0.1));">
              <!-- Logo y Límite centrados -->
              <img src="${logoUri}" alt="RZP Mail" style="height: 56px; width: auto; object-fit: contain; margin-bottom: 12px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">
              
              <div style="font-size: 10px; font-weight: 600; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px; background: var(--vscode-badge-background, rgba(128,128,128,0.1)); color: var(--vscode-badge-foreground); padding: 4px 10px; border-radius: 12px;" title="Para no llenar tu disco, los correos se auto-eliminan a las 2h o al llegar a 50">
                Límite: 50 emails
              </div>

              <!-- Botones de Acción (Config y Limpiar en fila) -->
              <div style="display: flex; gap: 8px; width: 100%;">
                <button class="btn btn-secondary" onclick="showConfig()" style="flex: 1; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; border-radius: 4px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  Config
                </button>
                <button class="btn btn-secondary" onclick="clearInbox()" title="Borrar todo el historial y liberar disco" style="flex: 1; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; border-radius: 4px; border-color: transparent; background: var(--vscode-button-secondaryBackground, rgba(128,128,128,0.1)); color: var(--vscode-button-secondaryForeground);">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Limpiar
                </button>
              </div>
            </div>

            <!-- Buscador elegante -->
            <div class="sidebar-search" style="padding: 16px 20px; background: var(--vscode-sideBar-background);">
              <div style="position: relative; display: flex; align-items: center;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--vscode-descriptionForeground)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 12px; opacity: 0.7;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" id="searchInput" oninput="filterEmails()" placeholder="Buscar emails..." style="width: 100%; padding: 8px 12px 8px 34px; background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); color: var(--vscode-input-foreground); border-radius: 4px; font-size: 12px; outline: none; transition: border-color 0.2s;">
              </div>
            </div>

            <!-- Estadísticas integradas separando el buscador de la lista -->
            <div class="stats" id="emailStats" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; font-size: 11px; font-weight: 600; color: var(--vscode-descriptionForeground); background: var(--vscode-sideBarSectionHeader-background, rgba(0,0,0,0.02)); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, rgba(128, 128, 128, 0.1)); border-top: 1px solid var(--vscode-sideBarSectionHeader-border, rgba(128, 128, 128, 0.1));">
              <span>Inbox</span>
              <span id="emailStatsText" style="opacity: 0.8; font-weight: normal;">0 / 50</span>
            </div>

            <div class="email-list" id="emailList">
              <div class="empty-state">
                <p>Sin emails</p>
              </div>
            </div>
          </div>

          <!-- MAIN - Detalle del email -->
          <div class="main-content" id="mainContent">
            <div class="welcome-screen" id="welcomeScreen">
              <img src="${logoUri}" alt="RZP Mail Sandbox" style="max-height: 180px; width: auto; object-fit: contain; margin-bottom: 24px;">
              <div class="welcome-header" style="display: none;">RZP Mail Sandbox</div>
              
              <div class="status-indicator">
                <div class="status-dot" id="statusDot"></div>
                <span id="statusText">Servidor: OFF</span>
              </div>

              <div class="welcome-section">
                <h3 style="margin-bottom: 12px; font-size: 16px;">🚀 Configuración SMTP</h3>
                <p style="font-size: 13px; color: var(--vscode-descriptionForeground); margin-bottom: 20px; line-height: 1.6; background: var(--vscode-editorWidget-background); padding: 16px; border-radius: 8px; border-left: 4px solid var(--vscode-charts-green, #4CAF50); box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                  <strong>¿Cómo funciona?</strong> MailCat es tu servidor de pruebas aislado. Solo dale a <b>Iniciar Servidor</b> y copia  credenciales.<br><br>
                  <i>Tip: Usa el puerto <b>2525</b> (o puertos > 1024) para evitar restricciones. El usuario y clave pueden ser el texto que prefieras.</i>
                </p>
                <div class="credentials-display" style="display: flex; flex-direction: column; gap: 12px;">
                  <div style="display: grid; grid-template-columns: 100px 1fr; gap: 12px; align-items: center;">
                    <label style="font-size: 12px; font-weight: 600; color: var(--vscode-descriptionForeground); text-transform: uppercase;">Host:</label>
                    <div style="font-size: 14px; font-weight: 500; font-family: var(--vscode-editor-font-family), monospace;">localhost</div>
                  </div>
                  <div style="display: grid; grid-template-columns: 100px 1fr; gap: 12px; align-items: center;">
                    <label style="font-size: 12px; font-weight: 600; color: var(--vscode-descriptionForeground); text-transform: uppercase;">Puerto:</label>
                    <input type="number" id="smtpPort" style="padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-family: monospace; font-size: 14px; outline: none;">
                  </div>
                  <div style="display: grid; grid-template-columns: 100px 1fr; gap: 12px; align-items: center;">
                    <label style="font-size: 12px; font-weight: 600; color: var(--vscode-descriptionForeground); text-transform: uppercase;">Usuario:</label>
                    <input type="text" id="smtpUser" value="rzp" style="padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-family: monospace; font-size: 14px; outline: none;">
                  </div>
                  <div style="display: grid; grid-template-columns: 100px 1fr; gap: 12px; align-items: center;">
                    <label style="font-size: 12px; font-weight: 600; color: var(--vscode-descriptionForeground); text-transform: uppercase;">Contraseña:</label>
                    <input type="password" id="smtpPass" style="padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-family: monospace; font-size: 14px; outline: none;">
                  </div>
                  <div style="display: flex; gap: 12px; margin-top: 8px;">
                    <button class="btn btn-secondary" data-config-btn onclick="updateSmtpConfig()" style="font-size: 12px; flex: 1;">Guardar Config</button>
                    <button class="btn btn-secondary" data-config-btn onclick="copyEnvConfig()" style="background-color: var(--vscode-charts-orange, #d97706); color: white; border: none; font-size: 12px; flex: 1;">Copiar a .env</button>
                  </div>
                  <button class="start-btn" id="startBtn" onclick="startServer()" style="width: 100%; margin-top: 12px; padding: 12px; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">▶ Iniciar Servidor</button>
                  <button class="start-btn" id="stopBtn" onclick="stopServer()" style="display: none; width: 100%; margin-top: 12px; padding: 12px; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; background-color: transparent; border: 2px solid var(--vscode-editorError-foreground, #ef4444); color: var(--vscode-editorError-foreground, #ef4444);">■ Detener Servidor</button>
                </div>
              </div>

              <div class="welcome-section">
                <h3 id="configActiveTitle" style="display: none;"> Configuración Activa</h3>
                <div id="activeConfig" class="credentials-display" style="display: none;">
                  <div style="margin-bottom: 8px;">
                    <label style="font-size: 12px; color: #6b7280;">Host:</label>
                    <div style="font-family: monospace; color: #10b981;">localhost</div>
                  </div>
                  <div style="margin-bottom: 8px;">
                    <label style="font-size: 12px; color: #6b7280;">Puerto (actual):</label>
                    <div style="font-family: monospace; color: #10b981;" id="activePort">2525</div>
                  </div>
                  <div style="margin-bottom: 8px;">
                    <label style="font-size: 12px; color: #6b7280;">Usuario:</label>
                    <div style="font-family: monospace; color: #10b981;">rzp</div>
                  </div>
                  <button class="btn btn-secondary" onclick="copyActiveConfig()" style="width: 100%; margin-top: 8px;">Copiar Config</button>
                </div>
              </div>

              <div class="welcome-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <h3 style="margin:0;">&lt;/&gt; Código de Envío</h3>
                  <select id="snippetLanguage" onchange="updateSnippet()" style="background: #1a1f2e; color: #e8e8e8; border: 1px solid #2d3748; padding: 4px; border-radius: 4px; font-size: 11px; cursor: pointer; outline: none;">
                    <option value="node">Node.js (Nodemailer)</option>
                    <option value="php">PHP (PHPMailer)</option>
                    <option value="python">Python (smtplib)</option>
                    <option value="csharp">C# (.NET)</option>
                  </select>
                </div>
                <div class="code-example" id="snippetContainer" style="position: relative;">
                  <button onclick="copySnippet()" style="position: absolute; right: 8px; top: 8px; background: rgba(255,255,255,0.1); border: none; color: white; cursor: pointer; padding: 4px 8px; border-radius: 2px; font-size: 10px; transition: background 0.2s;"> Copiar</button>
                  <pre id="snippetCode" style="margin: 0; padding-top: 12px; white-space: pre-wrap; font-family: 'Fira Code', monospace; font-size: 11px;"></pre>
                </div>
              </div>

              <div class="welcome-section" id="readySection" style="display: none; margin-top: 20px;">
                <p style="color: #50c878; font-weight: 500;">¡Servidor activo! Los emails aparecerán automáticamente en la lista</p>
              </div>
            </div>

            <div class="empty-state-main" id="emptyState" style="display: none;">
              <p>Selecciona un email para ver los detalles</p>
            </div>
            <div id="emailDetailContainer" style="display: none; height: 100%;"></div>
          </div>
        </div>

        <script>
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
              btn.textContent = ' Iniciando...';
            }
            vscode.postMessage({ command: 'startServer' });
          }

          function stopServer() {
            const btn = document.getElementById('stopBtn');
            if (btn) {
              btn.disabled = true;
              btn.textContent = ' Deteniendo...';
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
    if (stopBtn) { stopBtn.style.display = 'inline-block'; stopBtn.disabled = false; stopBtn.textContent = ' Detener Servidor'; }
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
    if (startBtn) { startBtn.style.display = 'inline-block'; startBtn.disabled = false; startBtn.textContent = ' Iniciar Servidor'; }
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
            vscode.postMessage({ command: 'copyToClipboard', text: code, message: ' Snippet copiado al portapapeles' });
          }

          // Inicializar snippet
          setTimeout(updateSnippet, 100);

          function copyActiveConfig() {
            const port = document.getElementById('activePort').textContent;
            const config = 'host: localhost\\nport: ' + port + '\\nuser: rzp';
            vscode.postMessage({ command: 'copyToClipboard', text: config, message: ' Configuración copiada' });
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
  vscode.postMessage({ command: 'copyToClipboard', text: envContent, message: ' Config .env copiada al portapapeles' });
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
                    \${email.validation && email.validation.performance ? \`
                    <div class="detail-meta-row">
                      <span class="detail-meta-label">Peso:</span>
                      <span style="display: inline-block; padding: 2px 8px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 10px; font-size: 11px; font-weight: bold; margin-left: 4px;">\${(email.validation.performance.totalSize / 1024).toFixed(1)} KB</span>
                    </div>\` : ''}
                  </div>
                </div>

                <div class="tabs">
                  <div class="tab active" onclick="switchTab('preview', this)">HTML</div>
                  <div class="tab" onclick="switchTab('html-source', this)">HTML Source</div>
                  <div class="tab" onclick="switchTab('text', this)">Text</div>
                  <div class="tab" onclick="switchTab('raw', this)">Raw</div>
                  <div class="tab" onclick="switchTab('eslint', this)">ESLint</div>
                  <div class="tab" onclick="switchTab('spam', this)">Spam Analysis</div>
                  <div class="tab" onclick="switchTab('html-check', this)">HTML Check</div>
                  \${email.attachments && email.attachments.length > 0 ? \`<div class="tab" onclick="switchTab('attachments', this)"> Adjuntos (\${email.attachments.length})</div>\` : ''}
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

          function renderHtmlCheck(email) {
            const validation = email.validation;
            if (!validation) return '<div style="padding: 20px; text-align: center; color: #6b7280;">Sin datos de validación</div>';
            
            const getScoreColor = (score) => score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
            const avg = validation.clientCompatibility.average;
            const avgColor = getScoreColor(avg);

            let allIssues = [
              ...validation.css.warnings.map(w => ({ type: 'CSS', text: w, color: '#f59e0b' })),
              ...validation.links.issues.map(w => ({ type: 'Links', text: w, color: '#ef4444' })),
              ...validation.performance.warnings.map(w => ({ type: 'Performance', text: w, color: '#f59e0b' }))
            ];
            
            let issuesHtml = allIssues.map(issue => \`
              <div style="background: #1e1e1e; padding: 16px; border-radius: 6px; border-left: 4px solid \${issue.color}; margin-bottom: 12px; display: flex; align-items: center;">
                <div style="min-width: 100px; font-size: 11px; text-transform: uppercase; color: #858585; font-weight: bold;">\${issue.type}</div>
                <div style="font-size: 13px; color: #d4d4d4;">\${issue.text}</div>
              </div>
            \`).join('');

            if (allIssues.length === 0) {
               issuesHtml = \`<div style="text-align: center; padding: 30px; background: #1e1e1e; border-radius: 6px; color: #10b981;"> No issues detected. Your email looks great!</div>\`;
            }

            return \`
              <div class="html-check-container" style="padding: 32px; max-width: 900px; margin: 0 auto; color: var(--vscode-foreground); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                
                <div style="display: flex; gap: 60px; margin-bottom: 50px; align-items: center; justify-content: center; flex-wrap: wrap;">
                  <!-- Circulo principal -->
                  <div style="flex: 0 0 220px; text-align: center;">
                    <div style="position: relative; width: 220px; height: 220px; margin: 0 auto;">
                      <svg width="220" height="220" viewBox="0 0 36 36" style="transform: rotate(-90deg);">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#2d2d2d" stroke-width="4" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="\${avgColor}" stroke-width="4" stroke-dasharray="\${avg}, 100" />
                      </svg>
                      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center;">
                        <div style="font-size: 42px; font-weight: 700; color: \${avgColor}; line-height: 1;">\${avg}%</div>
                        <div style="font-size: 11px; opacity: 0.7; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 8px; font-weight: 600; text-align: center; max-width: 100px;">Market Support</div>
                      </div>
                    </div>
                  </div>

                  <!-- Lista de clientes -->
                  <div style="flex: 1; min-width: 250px;">
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 12px; font-size: 14px;">
                        <span><span style="color: #4ade80; margin-right: 12px;">✔</span> Apple Mail</span>
                        <span style="font-weight: 600;">\${validation.clientCompatibility.appleMail}%</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 12px; font-size: 14px;">
                        <span><span style="color: #60a5fa; margin-right: 12px;">✔</span> Gmail</span>
                        <span style="font-weight: 600;">\${validation.clientCompatibility.gmail}%</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 12px; font-size: 14px;">
                        <span><span style="color: #60a5fa; margin-right: 12px;">✔</span> Outlook</span>
                        <span style="font-weight: 600;">\${validation.clientCompatibility.outlook}%</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 12px; font-size: 14px;">
                        <span><span style="color: #94a3b8; margin-right: 12px;">✔</span> Samsung Mail</span>
                        <span style="font-weight: 600;">\${validation.clientCompatibility.samsungMail}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Problemas detectados -->
                <div>
                  <h3 style="margin-bottom: 24px; font-size: 18px; font-weight: 600; border-bottom: 1px solid #333; padding-bottom: 12px; color: #fff;">Issue Report</h3>
                  <div style="display: flex; flex-direction: column;">
                    \${issuesHtml}
                  </div>
                </div>

              </div>
            \`;
          }

          function renderSpamAnalysis(email) {
            const spam = email.validation?.spam;
            if (!spam) return '<div style="padding: 20px; text-align: center; color: #6b7280;">Sin datos de Spam Analysis</div>';
            
            const getScoreColor = (score) => score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
            const avgColor = getScoreColor(spam.score);

            let issuesHtml = spam.warnings.map(warn => \`
              <div style="background: #1e1e1e; padding: 16px; border-radius: 6px; border-left: 4px solid #f59e0b; margin-bottom: 12px; display: flex; align-items: center;">
                <div style="font-size: 13px; color: #d4d4d4;">\${warn}</div>
              </div>
            \`).join('');

            if (spam.warnings.length === 0) {
               issuesHtml = \`<div style="text-align: center; padding: 30px; background: #1e1e1e; border-radius: 6px; color: #10b981;"> No spam issues detected! (Score 100/100)</div>\`;
            }

            return \`
              <div class="html-check-container" style="padding: 32px; max-width: 900px; margin: 0 auto; color: var(--vscode-foreground); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                
                <div style="display: flex; gap: 60px; margin-bottom: 50px; align-items: center; justify-content: center; flex-wrap: wrap;">
                  <div style="flex: 0 0 220px; text-align: center;">
                    <div style="position: relative; width: 220px; height: 220px; margin: 0 auto;">
                      <svg width="220" height="220" viewBox="0 0 36 36" style="transform: rotate(-90deg);">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#2d2d2d" stroke-width="4" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="\${avgColor}" stroke-width="4" stroke-dasharray="\${spam.score}, 100" />
                      </svg>
                      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center;">
                        <div style="font-size: 42px; font-weight: 700; color: \${avgColor}; line-height: 1;">\${spam.score}</div>
                        <div style="font-size: 11px; opacity: 0.7; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 8px; font-weight: 600; text-align: center; max-width: 100px;">Spam Score</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 style="margin-bottom: 24px; font-size: 18px; font-weight: 600; border-bottom: 1px solid #333; padding-bottom: 12px; color: #fff;">Spam Hints & Rules</h3>
                  <div style="display: flex; flex-direction: column;">
                    \${issuesHtml}
                  </div>
                </div>
              </div>
            \`;
          }

          function renderESLint(email) {
            const linter = email.validation?.linter;
            if (!linter) return '<div style="padding: 20px; text-align: center; color: #6b7280;">Sin datos del Linter</div>';

            let itemsHtml = linter.issues.sort((a,b) => {
              const weights = { 'error': 3, 'warning': 2, 'pass': 1 };
              return weights[b.type] - weights[a.type];
            }).map(issue => {
              let icon, color, bgColor;
              if (issue.type === 'error') { icon = 'Error'; color = '#ef4444'; bgColor = 'rgba(239, 68, 68, 0.1)'; }
              else if (issue.type === 'warning') { icon = 'Warn'; color = '#f59e0b'; bgColor = 'rgba(245, 158, 11, 0.1)'; }
              else { icon = 'Pass'; color = '#10b981'; bgColor = 'rgba(16, 185, 129, 0.1)'; }

              const codeBlock = issue.codeSnippet 
                ? \`<div style="margin-top: 8px; padding: 8px; background: #0a0e14; border: 1px solid #333; border-radius: 4px; border-left: 3px solid \${color}; overflow-x: auto;">
                    <div style="font-family: Consolas, monospace; font-size: 11px; color: #9cdcfe; white-space: nowrap;">
                      <span style="color: #6b7280; margin-right: 8px;">\${issue.lineNum ? issue.lineNum : '>'}</span>
                      \${escapeHtml(issue.codeSnippet).substring(0, 150)}\${issue.codeSnippet.length > 150 ? '...' : ''}
                    </div>
                   </div>\` 
                : '';

              return \`
                <div style="background: \${bgColor}; border: 1px solid \${color}40; padding: 12px 16px; border-radius: 6px; margin-bottom: 8px; display: flex; align-items: flex-start; gap: 12px;">
                  <div style="font-size: 16px; margin-top: 2px;">\${icon}</div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 13px; font-weight: 600; color: \${color}; margin-bottom: 4px;">\${issue.title}</div>
                    <div style="font-size: 12px; color: #a3a3a3; line-height: 1.4;">\${issue.consequence}</div>
                    \${codeBlock}
                  </div>
                </div>
              \`;
            }).join('');

            return \`
              <div style="padding: 24px; max-width: 800px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h2 style="font-size: 20px; color: var(--vscode-foreground); margin-bottom: 8px;">ESLint for Emails</h2>
                  <div style="display: flex; gap: 16px; justify-content: center; font-size: 13px; font-weight: 600;">
                    <span style="color: #10b981; background: rgba(16,185,129,0.1); padding: 4px 12px; border-radius: 12px;">\${linter.passedCount} checks pasaron</span>
                    <span style="color: #f59e0b; background: rgba(245,158,11,0.1); padding: 4px 12px; border-radius: 12px;">\${linter.warningsCount} advertencias</span>
                    <span style="color: #ef4444; background: rgba(239,68,68,0.1); padding: 4px 12px; border-radius: 12px;">\${linter.errorsCount} críticos</span>
                  </div>
                </div>
                <div style="border-top: 1px solid #333; margin-bottom: 24px;"></div>
                \${itemsHtml}
              </div>
            \`;
          }

          let isDarkMode = false;
          function toggleDarkMode() {
            isDarkMode = !isDarkMode;
            const btn = document.getElementById('darkModeBtn');
            const iframe = document.getElementById('emailIframe');
            if (isDarkMode) {
              if(btn) { btn.textContent = ' Light Mode'; btn.style.background = '#404040'; }
              if (iframe) {
                iframe.style.filter = 'invert(1) hue-rotate(180deg)';
                iframe.style.backgroundColor = '#fff';
              }
            } else {
              if(btn) { btn.textContent = ' Dark Mode'; btn.style.background = ''; }
              if (iframe) {
                iframe.style.filter = 'none';
                iframe.style.backgroundColor = '';
              }
            }
          }

          function renderPreview(email) {
            if (!email.html) {
              return \`<div class="raw-content">\${email.text || 'Sin contenido'}</div>\`;
            }
            
            return \`<div class="preview-wrapper">
              <div class="simulator-controls" style="padding: 10px; display: flex; gap: 8px; justify-content: center; align-items: center; background: var(--vscode-editor-background); border-bottom: 1px solid var(--vscode-widget-border);">
                <button class="btn btn-secondary" onclick="setDeviceMode('desktop')" style="font-size: 11px;"> Desktop</button>
                <button class="btn btn-secondary" onclick="setDeviceMode('tablet')" style="font-size: 11px;"> Tablet</button>
                <button class="btn btn-secondary" onclick="setDeviceMode('mobile')" style="font-size: 11px;"> Mobile</button>
                <div style="width: 1px; height: 16px; background: var(--vscode-widget-border); margin: 0 4px;"></div>
                <button class="btn btn-secondary" onclick="toggleDarkMode()" id="darkModeBtn" style="font-size: 11px;"> Dark Mode</button>
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
            } else if (tab === 'html-source') {
              const escapedHtml = email.html ? escapeHtml(email.html) : 'Sin HTML';
              tabContent.innerHTML = \`<pre class="raw-content" style="padding: 16px; font-family: Consolas, monospace; font-size: 13px; color: #d4d4d4; background: #1e1e1e; border-radius: 4px; overflow-x: auto; margin: 16px;">\${escapedHtml}</pre>\`;
            } else if (tab === 'text') {
              const text = email.text || 'Sin texto';
              tabContent.innerHTML = \`<pre class="raw-content" style="padding: 16px; margin: 16px;">\${escapeHtml(text)}</pre>\`;
            } else if (tab === 'raw') {
              let headersRaw = '';
              if (email.headers) {
                headersRaw = Object.keys(email.headers).map(k => \`\${k}: \${escapeHtml(email.headers[k])}\`).join('\\n') + '\\n\\n';
              }
              const rawBody = escapeHtml(email.html || email.text || '');
              tabContent.innerHTML = \`<pre class="raw-content" style="padding: 16px; font-family: Consolas, monospace; font-size: 13px; color: #9cdcfe; background: #1e1e1e; border-radius: 4px; overflow-x: auto; margin: 16px;">\${headersRaw}\${rawBody}</pre>\`;
            } else if (tab === 'eslint') {
              tabContent.innerHTML = renderESLint(email);
            } else if (tab === 'spam') {
              tabContent.innerHTML = renderSpamAnalysis(email);
            } else if (tab === 'html-check') {
              tabContent.innerHTML = renderHtmlCheck(email);
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
                      <button class="btn btn-secondary" onclick="openAttachment('\${att.filename}')" style="padding: 6px 12px; background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; cursor: pointer;"> Abrir</button>
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
            if (text === null || text === undefined) return '';
            const str = typeof text === 'string' ? text : JSON.stringify(text);
            const map = {
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;',
              '"': '&quot;',
              "'": '&#039;'
            };
            return str.replace(/[&<>"']/g, m => map[m]);
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
              // Fix: re-renderizar detalle cuando llegan nuevos emails
              if (emails.length > 0 && selectedEmailId) {
                const stillExists = emails.find(e => e.id === selectedEmailId);
                if (!stillExists) {
                  selectEmail(emails[0].id); // Solo si el email fue borrado
                } else {
                  // Solo actualizar la lista, NO re-renderizar el detalle
                  document.querySelector('[data-id="' + selectedEmailId + '"]')?.classList.add('active');
                  // Update stats tab count WITHOUT triggering tab change
                  const activeTab = document.querySelector('.tab.active');
                  if (activeTab) {
                    const tabName = Array.from(document.querySelectorAll('.tab')).findIndex(t => t === activeTab);
                  }
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
        </script>
      </body>
      </html>
    `;
  }
}
