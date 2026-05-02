import { SMTPServer, SMTPServerSession } from "smtp-server";
import { simpleParser } from "mailparser";
import { Stream } from "stream";
import { emailStorage, Email } from "./storage";
import { EmailValidator } from "./emailValidator";
import { randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";

let smtpServer: SMTPServer | null = null;
let onEmailReceived: ((email: Email) => void) | null = null;
let emailIdCounter = 0;
let emailReceivedCount = 0;

export function setOnEmailReceived(callback: (email: Email) => void) {
  console.log("📌 [SMTP] Registrando callback para nuevos emails");
  onEmailReceived = callback;
}

export async function startSMTPServer(port: number = 2525): Promise<void> {
  return new Promise((resolve, reject) => {
    smtpServer = new SMTPServer({
      secure: false,
      authOptional: true,
      onAuth(auth: any, session: SMTPServerSession, callback: Function) {
        // Acepta cualquier autenticación (o ninguna) para pruebas
        callback(null, { user: auth.username || "anonymous" });
      },
      onData(stream: Stream, session: SMTPServerSession, callback: Function) {
        simpleParser(stream, async (err: Error | null, parsed: any) => {
          console.log(`\n📥 [SMTP] Procesando email #${++emailReceivedCount}`);
          
          if (err) {
            console.error(" [SMTP] Error parsing email:", err);
            return callback(err);
          }

          try {
            // Parsear direcciones correctamente
            const parseAddresses = (addresses: any) => {
              if (!addresses) return [];
              if (typeof addresses === 'string') return [addresses];
              if (Array.isArray(addresses)) {
                return addresses.map((a: any) => 
                  typeof a === 'string' ? a : a.address || a.email || a.text
                );
              }
              return [addresses.address || addresses.email || addresses.text || ''];
            };

            const emailId = `email_${Date.now()}_${emailIdCounter++}_${randomBytes(4).toString('hex')}`;

            // Procesar adjuntos si existen
            const attachments = [];
            if (parsed.attachments && parsed.attachments.length > 0) {
              const attachDir = path.join(emailStorage.getStorageDir(), 'attachments', emailId);
              if (!fs.existsSync(attachDir)) {
                fs.mkdirSync(attachDir, { recursive: true });
              }
              
              for (const att of parsed.attachments) {
                const safeFilename = att.filename || `adjunto_${randomBytes(4).toString('hex')}`;
                const filePath = path.join(attachDir, safeFilename);
                // Guardar el buffer en el disco
                fs.writeFileSync(filePath, att.content);
                attachments.push({
                  filename: safeFilename,
                  contentType: att.contentType,
                  size: att.size,
                  path: filePath
                });
              }
            }

            const email: Email = {
              id: emailId,
              from: parsed.from?.text || parsed.from?.address || "unknown",
              to: parseAddresses(parsed.to),
              cc: parseAddresses(parsed.cc),
              bcc: parseAddresses(parsed.bcc),
              subject: parsed.subject || "(sin asunto)",
              html: parsed.html ? parsed.html.toString() : undefined,
              text: parsed.text ? parsed.text.toString() : undefined,
              timestamp: Date.now(),
              headers: Object.fromEntries(
                Array.from(parsed.headers.entries())
              ) as Record<string, string>,
              attachments: attachments.length > 0 ? attachments : undefined
            };

            // Validar email automáticamente ANTES de guardarlo para que se persista en disco
            try {
              if (email.html) {
                const validator = new EmailValidator();
                email.validation = validator.validate(email.html, email.text || '', email.subject || '');
                console.log(` [SMTP] Email validado`);
              }
            } catch (validationError) {
              console.error(`  [SMTP] Error en validación (ignorado):`, validationError);
            }

            emailStorage.addEmail(email);
            console.log(`  [SMTP] Email guardado: "${email.subject}"`);
            console.log(` [SMTP] Total en storage: ${emailStorage.getEmails().length}`);
            
            // Notificar que llegó un nuevo email
            if (onEmailReceived) {
              console.log(` [SMTP] Disparando callback para email #${emailReceivedCount}`);
              onEmailReceived(email);
            } else {
              console.warn(`  [SMTP] Callback NO registrado para email #${emailReceivedCount}`);
            }

            callback();
          } catch (error) {
            console.error("Error storing email:", error);
            callback(error);
          }
        });
      },
      disabledCommands: ["STARTTLS"],
    });

    smtpServer!.listen(port, "localhost", () => {
      console.log(` SMTP Server escuchando en localhost:${port}`);
      resolve();
    });

    smtpServer!.on("error", (err: Error) => {
      console.error("SMTP Server error:", err);
      reject(err);
    });
  });
}

export function stopSMTPServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!smtpServer) {
      resolve();
      return;
    }

    smtpServer.close((err: Error | undefined) => {
      if (err) {
        reject(err);
      } else {
        console.log(" SMTP Server detenido");
        smtpServer = null;
        resolve();
      }
    });
  });
}

export function isServerRunning(): boolean {
  return smtpServer !== null;
}
