declare module "smtp-server" {
  import { Stream } from "stream";

  interface SMTPServerOptions {
    secure?: boolean;
    authOptional?: boolean;
    disabledCommands?: string[];
    onData?: (
      stream: Stream,
      session: SMTPServerSession,
      callback: (err?: Error) => void
    ) => void;
    onAuth?: (auth: any, session: SMTPServerSession, callback: Function) => void;
    onClose?: (session: SMTPServerSession) => void;
  }

  interface SMTPServerSession {
    id: string;
    envelope: {
      mailFrom: string;
      rcptTo: string[];
    };
  }

  class SMTPServer {
    constructor(options: SMTPServerOptions);
    listen(port: number, host?: string, callback?: () => void): void;
    close(callback?: (err?: Error) => void): void;
    on(event: string, callback: (...args: any[]) => void): void;
  }

  export { SMTPServer, SMTPServerSession };
}
