import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Namespace, Socket } from "socket.io";
import { SOCKET_EVENTS } from "../../../../../packages/shared/src/constants.js";
import {
  dateOnlySchema,
  uuidSchema,
} from "../../../../../packages/shared/src/schemas.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { RealtimeSessionsService } from "../auth/realtime-sessions.service.js";

@WebSocketGateway({
  namespace: "/ws",
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Namespace;

  constructor(private readonly sessions: RealtimeSessionsService) {}

  afterInit() {
    // Middleware xác thực session chạy trước khi socket được nhận vào namespace.
    this.sessions.install(this.server);
  }

  handleConnection(socket: Socket) {
    const user = socket.data.user as AuthenticatedUser | undefined;
    if (!user) {
      if (!socket.data.isGuest) {
        socket.disconnect(true);
      }
      return;
    }
    void socket.join(`user:${user.id}`);
    if (user.role === "owner") void socket.join(`owner:${user.id}`);
  }

  @SubscribeMessage(SOCKET_EVENTS.JOIN_VENUE)
  joinVenue(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { venueId?: unknown; date?: unknown },
  ) {
    const venueId = body?.venueId;
    const date = body?.date;
    if (
      typeof venueId !== "string" ||
      !uuidSchema.safeParse(venueId).success ||
      typeof date !== "string" ||
      !dateOnlySchema.safeParse(date).success
    ) {
      return { ok: false, error: "INVALID_ROOM" };
    }

    // Mỗi socket chỉ theo dõi một room venue+ngày để tránh rò rỉ dữ liệu.
    for (const room of socket.rooms) {
      if (room.startsWith("venue:")) void socket.leave(room);
    }
    const room = `venue:${venueId}:date:${date}`;
    void socket.join(room);
    return { ok: true, room };
  }

  @SubscribeMessage(SOCKET_EVENTS.LEAVE_VENUE)
  leaveVenue(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { venueId?: unknown; date?: unknown },
  ) {
    const venueId = body?.venueId;
    const date = body?.date;
    if (typeof venueId !== "string" || typeof date !== "string") {
      return { ok: false };
    }
    void socket.leave(`venue:${venueId}:date:${date}`);
    return { ok: true };
  }

  emitToVenueDate(
    venueId: string,
    date: string,
    event: string,
    payload: unknown,
  ) {
    this.server?.to(`venue:${venueId}:date:${date}`).emit(event, payload);
  }

  emitToOwner(ownerId: string, event: string, payload: unknown) {
    this.server?.to(`owner:${ownerId}`).emit(event, payload);
  }

  onModuleDestroy() {
    this.logger.log("Realtime gateway stopped");
  }
}