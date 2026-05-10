import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { startSMTPServer, stopSMTPServer, isServerRunning, setOnEmailReceived } from "./smtpServer";
import { InboxWebviewProvider } from "./webview";
import { emailStorage } from "./storage";

let inboxProvider: InboxWebviewProvider | null = null;
let statusBarItem: vscode.StatusBarItem;
let inboxPanel: vscode.WebviewPanel | undefined;

class StatusViewProvider implements vscode.WebviewViewProvider {
  constructor(private extensionUri: vscode.Uri, private onOpenInbox: () => void) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    this.updateView(webviewView.webview);

    const triggerOpen = () => {
      this.onOpenInbox();
      vscode.commands.executeCommand('workbench.action.closeSidebar');
    };

    if (webviewView.visible) triggerOpen();
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) triggerOpen();
    });

   
    webviewView.webview.onDidReceiveMessage((data) => {
      if (data.command === 'openInbox') {
        this.onOpenInbox();
      }
    });

   
    setInterval(() => {
      this.updateView(webviewView.webview);
    }, 1000);
  }

  private updateView(webview: vscode.Webview) {
    const running = isServerRunning();
    webview.html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; }
          body {
            padding: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 12px;
          }
          .status {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 16px;
            cursor: pointer;
            padding: 8px;
            border-radius: 4px;
            transition: background-color 0.2s;
          }
          .status:hover {
            background-color: var(--vscode-list-hoverBackground);
          }
          .indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            ${running ? 'background-color: #4CAF50;' : 'background-color: #999;'}
          }
          .info-box {
            padding: 10px;
            background-color: var(--vscode-list-hoverBackground);
            border-radius: 4px;
            margin-bottom: 12px;
            font-size: 11px;
            line-height: 1.6;
            border-left: 3px solid var(--vscode-focusBorder);
          }
          .info-box strong {
            color: var(--vscode-descriptionForeground);
          }
          .code {
            font-family: 'Monaco', monospace;
            font-size: 10px;
            margin-top: 4px;
            padding: 6px;
            background-color: var(--vscode-textCodeBlock-background);
            border-radius: 2px;
            word-break: break-all;
            color: var(--vscode-foreground);
          }
          .open-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            width: 100%;
            transition: background-color 0.2s;
          }
          .open-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
        </style>
      </head>
      <body>
        <div class="status" onclick="vscode.postMessage({command: 'openInbox'})">
          <div class="indicator"></div>
          <span><strong>${running ? '✓ Servidor ON' : '✗ Servidor OFF'}</strong></span>
        </div>
        
        <div class="info-box">
          <strong>📧 SMTP Config:</strong>
          <div class="code">
            host: localhost<br>
            port: 2525<br>
            user: rzp<br>
            pass: rzp
          </div>
        </div>

        <button class="open-btn" onclick="vscode.postMessage({command: 'openInbox'})">
           Abrir Inbox
        </button>

        <script>
          const vscode = acquireVsCodeApi();
        </script>
      </body>
      </html>
    `;
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log(' RZP Mail Sandbox activada');

  
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "rzp-mail-sandbox.openInbox";
  updateStatusBar();
  context.subscriptions.push(statusBarItem);

  const statusViewProvider = new StatusViewProvider(context.extensionUri, () => {
    if (!inboxPanel || !inboxPanel.active) {
      inboxProvider?.createInboxPanel();
    } else {
      inboxPanel.reveal();
    }
  });
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("rzp-mail-status", statusViewProvider)
  );

  // Inicializar provider del webview (para manejar datos)
inboxProvider = new InboxWebviewProvider(context.extensionUri, context);
  inboxProvider.setOnPanelChange((panel) => {
    inboxPanel = panel;
  });
  
  // Registrar callback para nuevos emails
  setOnEmailReceived((email) => {
    console.log(` [Extension] Callback recibido para: "${email.subject}"`);
    inboxProvider?.refreshInbox();
    
    // Notificación Toast interactiva
    vscode.window.showInformationMessage(`📧 MailCat interceptó: "${email.subject}"`, "Ver Correo").then(selection => {
      if (selection === "Ver Correo") {
        vscode.commands.executeCommand("rzp-mail-sandbox.openInbox");
        // Asegurarse de que el panel está listo antes de seleccionar el email
        setTimeout(() => {
          inboxProvider?.selectEmail(email.id);
        }, 300);
      }
    });
  });
  
  inboxProvider.setOnStartServer(async () => {
    try {
      if (isServerRunning()) {
        vscode.window.showWarningMessage("  Servidor ya está corriendo");
        return;
      }
    
      
  
      const config = inboxProvider!.getSmtpConfig();
await startSMTPServer(config.port);
      updateStatusBar();
      inboxProvider?.refreshInbox();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(` Error al iniciar servidor:`, errorMsg);
      vscode.window.showErrorMessage(
        ` Error al iniciar: ${errorMsg}`
      );
    }
  });

  // Comando: Start Sandbox
  context.subscriptions.push(
    vscode.commands.registerCommand("rzp-mail-sandbox.start", async () => {
      try {
        if (isServerRunning()) {
          vscode.window.showWarningMessage("  Servidor ya está corriendo");
          return;
        }

        // Iniciar SMTP
        const config = inboxProvider!.getSmtpConfig();
        const port = parseInt(String(config.port));
        console.log(` Iniciando servidor SMTP en puerto ${port}`);
        await startSMTPServer(port);
        
        updateStatusBar();
        const pass = config.pass;
        vscode.window.showInformationMessage(
          ` RZP Mail Sandbox iniciado\n\n📧 SMTP: localhost:${port}\n User: rzp\n Pass: ${pass}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          ` Error al iniciar: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  // Comando: Stop Sandbox
  context.subscriptions.push(
    vscode.commands.registerCommand("rzp-mail-sandbox.stop", async () => {
      try {
        if (!isServerRunning()) {
          vscode.window.showWarningMessage("  Servidor no está corriendo");
          return;
        }

        await stopSMTPServer();
        updateStatusBar();
        vscode.window.showInformationMessage(" RZP Mail Sandbox detenido");
      } catch (error) {
        vscode.window.showErrorMessage(
          ` Error al detener: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

 
  context.subscriptions.push(
    vscode.commands.registerCommand("rzp-mail-sandbox.openInbox", () => {
      if (inboxPanel && !inboxPanel.active) {
        inboxPanel.reveal(vscode.ViewColumn.Beside);
      } else if (!inboxPanel) {
        inboxProvider?.createInboxPanel();
      }
    })
  );


  context.subscriptions.push(
    vscode.commands.registerCommand("rzp-mail-sandbox.copyConfig", () => {
      const config = `host: localhost
port: 2525
auth: {
  user: "rzp",
  pass: "rzp"
}`;

      vscode.env.clipboard.writeText(config).then(() => {
        vscode.window.showInformationMessage(" Config copiada");
      });
    })
  );


  context.subscriptions.push(
    vscode.commands.registerCommand("rzp-mail-sandbox.generateEnv", async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage(" No hay carpeta abierta en el workspace");
        return;
      }

      const envContent = `#  RZP Mail Sandbox Configuration
# Generated by RZP Mail Sandbox Extension

SMTP_HOST=localhost
SMTP_PORT=2525
SMTP_USER=rzp
SMTP_PASS=rzp

# Para usar con Nodemailer:
# const transporter = nodemailer.createTransport({
#   host: process.env.SMTP_HOST,
#   port: parseInt(process.env.SMTP_PORT),
#   auth: {
#     user: process.env.SMTP_USER,
#     pass: process.env.SMTP_PASS
#   }
# });
`;

      const envPath = path.join(workspaceFolders[0].uri.fsPath, '.env.rzp-mail');
      
      try {
        fs.writeFileSync(envPath, envContent, 'utf-8');
        vscode.window.showInformationMessage(` Archivo .env generado: ${envPath}`);
        
        // Abrir el archivo generado
        const doc = await vscode.workspace.openTextDocument(envPath);
        await vscode.window.showTextDocument(doc);
      } catch (error) {
        vscode.window.showErrorMessage(` Error generando .env: ${error}`);
      }
    })
  );

  // Comando: Clear Inbox
  context.subscriptions.push(
    vscode.commands.registerCommand("rzp-mail-sandbox.clearInbox", async () => {
      const answer = await vscode.window.showQuickPick(
        ["Sí", "No"],
        { placeHolder: "¿Limpiar todos los emails?" }
      );

      if (answer === "Sí") {
        emailStorage.clearEmails();
        inboxProvider?.refreshInbox();
        vscode.window.showInformationMessage(" Inbox limpiado");
      }
    })
  );

 
 
setInterval(() => {
  if (inboxProvider) {
    inboxProvider.refreshInbox(); 
  }
}, 1000);

  
  context.subscriptions.push(
    vscode.commands.registerCommand("rzp-mail-sandbox.debug-storage", () => {
      const emails = emailStorage.getEmails();
      const msg = ` Storage tiene ${emails.length} emails:\n${emails.map((e, i) => `${i+1}. ${e.subject}`).join('\n')}`;
      vscode.window.showInformationMessage(msg);
      console.log(msg);
    })
  );
}

function updateStatusBar() {
  if (isServerRunning()) {
    statusBarItem.text = "$(mail) RZP Mail ON";
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
    statusBarItem.tooltip = "Sandbox corriendo\nClick para abrir Inbox";
  } else {
    statusBarItem.text = "$(mail) RZP Mail OFF";
    statusBarItem.backgroundColor = undefined;
    statusBarItem.tooltip = "Sandbox detenido\nEjecuta: RZP Mail: Start Sandbox";
  }
  statusBarItem.show();
}

export function deactivate() {
  if (isServerRunning()) {
    stopSMTPServer().catch(console.error);
  }
}
