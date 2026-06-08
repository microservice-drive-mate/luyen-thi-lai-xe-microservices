import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  notificationUserRoom,
  WsEmitterPort,
  WsServerBinderPort,
} from '../../application/ports/ws-emitter.port';

@Injectable()
export class SocketIoNotificationEmitter
  extends WsEmitterPort
  implements WsServerBinderPort
{
  private readonly logger = new Logger(SocketIoNotificationEmitter.name);
  private server: Server | null = null;

  bindServer(server: unknown): void {
    this.server = server as Server;
  }

  emitToUser<TPayload>(userId: string, event: string, payload: TPayload): void {
    if (!this.server) {
      this.logger.warn(
        `Socket.IO server is not ready; skipped ${event} for ${userId}`,
      );
      return;
    }

    this.server.to(notificationUserRoom(userId)).emit(event, payload);
  }
}
