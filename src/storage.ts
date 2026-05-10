import { ValidationResult } from "./emailValidator";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface Attachment {
  filename: string;
  contentType: string;
  size: number;
  path: string;
}

export interface Email {
  id: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html?: string;
  text?: string;
  timestamp: number;
  headers: Record<string, string>;
  validation?: ValidationResult;
  attachments?: Attachment[];
}

class EmailStorage {
  private emails: Email[] = [];
  private storageDir: string;
  private storageFile: string;

  constructor() {
   
    this.storageDir = path.join(os.homedir(), '.vscode-rzp-mail');
    this.storageFile = path.join(this.storageDir, 'emails.json');
    
    // Crear directorio si no existe
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

   
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storageFile)) {
        const data = fs.readFileSync(this.storageFile, 'utf-8');
        this.emails = JSON.parse(data);
        console.log(` Cargados ${this.emails.length} emails del almacenamiento`);
        this.cleanOldEmails();
      }
    } catch (error) {
      console.error(' Error cargando emails:', error);
      this.emails = [];
    }
  }

  private cleanOldEmails(): void {
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const now = Date.now();
    let hasChanges = false;

    this.emails = this.emails.filter(email => {
      if (now - email.timestamp > TWO_HOURS) {
        this.deleteEmailAttachments(email.id);
        hasChanges = true;
        return false; // Eliminar
      }
      return true; // Mantener
    });

    if (hasChanges) {
      console.log(' [Storage] Auto-limpieza de tiempo: correos viejos borrados');
      this.saveToDisk();
    }
  }

  private saveToDisk(): void {
    try {
      fs.writeFileSync(this.storageFile, JSON.stringify(this.emails, null, 2), 'utf-8');
    } catch (error) {
      console.error(' Error guardando emails:', error);
    }
  }

  addEmail(email: Email): void {
    // Al añadir, ya quedan ordenados del más nuevo al más viejo
    this.emails.unshift(email);
    // Límite de 50 emails para proteger la memoria/disco
    while (this.emails.length > 50) {
      const removed = this.emails.pop();
      if (removed) {
        this.deleteEmailAttachments(removed.id);
      }
    }
    this.saveToDisk();
  }

  getEmails(): Email[] {
    this.cleanOldEmails();
    return this.emails;
  }

  getEmailById(id: string): Email | undefined {
    return this.emails.find(e => e.id === id);
  }

  clearEmails(): void {
    
    this.emails.forEach(email => this.deleteEmailAttachments(email.id));
    this.emails = [];
    this.saveToDisk();
  }

  private deleteEmailAttachments(emailId: string): void {
    try {
      const attachDir = path.join(this.storageDir, 'attachments', emailId);
      if (fs.existsSync(attachDir)) {
        fs.rmSync(attachDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.error(` Error borrando adjuntos del email ${emailId}:`, e);
    }
  }

  getStats() {
    return {
      total: this.emails.length,
      lastEmail: this.emails[0]?.timestamp || null
    };
  }

  getStorageDir(): string {
    return this.storageDir;
  }
}

export const emailStorage = new EmailStorage();
