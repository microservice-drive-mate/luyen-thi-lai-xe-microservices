import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  notificationUserRoom,
  WsServerBinderPort,
} from '../../application/ports/ws-emitter.port';
import { SocketAuthPort } from '../../application/ports/socket-auth.port';

@WebSocketGateway({
  namespace: '/notifications',
  path: '/notifications/socket.io',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly socketAuth: SocketAuthPort,
    private readonly serverBinder: WsServerBinderPort,
  ) {}

  afterInit(server: Server): void {
    this.serverBinder.bindServer(server);
    this.logger.log('Notification websocket gateway initialized');
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      this.reject(client, 'missing_token');
      return;
    }

    try {
      const claims = await this.socketAuth.verifyAccessToken(token);
      const userId = claims.sub;
      if (!userId) {
        this.reject(client, 'missing_subject');
        return;
      }

      client.data.userId = userId;
      await client.join(notificationUserRoom(userId));
      client.emit('notification.connected', { userId });
      this.logger.log(`Socket ${client.id} connected for user ${userId}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown authentication error';
      this.logger.warn(`Socket ${client.id} authentication failed: ${message}`);
      this.reject(client, 'invalid_token');
    }
  }

  handleDisconnect(client: Socket): void {
    const userId =
      typeof client.data.userId === 'string' ? client.data.userId : 'unknown';
    this.logger.log(`Socket ${client.id} disconnected for user ${userId}`);
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string') {
      return this.normalizeToken(authToken);
    }

    const authorization = client.handshake.headers.authorization;
    if (typeof authorization === 'string') {
      return this.normalizeToken(authorization);
    }

    return null;
  }

  private normalizeToken(value: string): string | null {
    const token = value.replace(/^Bearer\s+/i, '').trim();
    return token.length > 0 ? token : null;
  }

  private reject(client: Socket, reason: string): void {
    client.emit('notification.auth_failed', { reason });
    client.disconnect(true);
  }
}
