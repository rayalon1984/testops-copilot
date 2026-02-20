declare module 'pushover-notifications' {
  export interface PushoverOptions {
    user: string;
    token: string;
    onerror?: (error: Error) => void;
    update_sounds?: boolean;
  }

  export interface PushoverMessage {
    message: string;
    title?: string;
    sound?: string;
    device?: string;
    priority?: number;
    url?: string;
    url_title?: string;
    timestamp?: number;
  }

  export default class Pushover {
    constructor(options: PushoverOptions);
    send(message: PushoverMessage, callback?: (err: Error | null, result: unknown) => void): void;
  }
}
