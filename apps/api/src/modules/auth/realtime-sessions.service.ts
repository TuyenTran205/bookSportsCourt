import { Injectable, UnauthorizedException } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { parseAllowedOrigins } from "../../config/allowed-origins.js";
import type { Namespace, Socket } from "socket.io";
import { AuthService } from "./auth.service.js";
import { AuthJwtService } from "./auth-jwt.service.js";
import { cookie } from "./auth-http.js";
import { onSessionInvalidated, withSession } from "./session-context.js";
import { SOCKET_EVENTS } from "../../../../../packages/shared/src/constants.js";

/** Session layer only. Gateway must still authorize every room/resource and call sendPrivate. */
@Injectable()
export class RealtimeSessionsService {
  private readonly sockets = new Map<
    Socket,
    {
      token: string;
      kind: "access" | "ws";
      userId: string;
      role: string;
      version: number;
    }
  >();
  private readonly unsubscribe = onSessionInvalidated((id) =>
    this.disconnectUser(id),
  );
  private sweeping = false;
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: AuthJwtService,
    private readonly config: ConfigService,
  ) {}
  install(namespace: Pick<Namespace, "use">) {
    namespace.use((socket, next) => {
      void this.register(socket).then(
        () => next(),
        () => next(new Error("UNAUTHORIZED")),
      );
    });
  }
  async register(socket: Socket) {
    const origin = socket.handshake.headers.origin;
    if (
      origin !== undefined &&
      !parseAllowedOrigins(
        this.config.getOrThrow<string>("ALLOWED_ORIGINS"),
        this.config.get<string>("NODE_ENV") ?? "development",
      ).includes(origin)
    )
      throw new UnauthorizedException();
    const authToken =
      typeof socket.handshake.auth?.token === "string" &&
      socket.handshake.auth.token.trim().length > 0
        ? socket.handshake.auth.token.trim()
        : undefined;
    const cookieToken = cookie(
      { headers: socket.handshake.headers, method: "GET" },
      "access_token",
    );
    if (!authToken && !cookieToken && socket.handshake.auth?.guest === true) {
      socket.data.isGuest = true;
      socket.use(([event], next) => {
        if (
          event === SOCKET_EVENTS.JOIN_VENUE ||
          event === SOCKET_EVENTS.LEAVE_VENUE
        ) {
          return next();
        }
        return next(new Error("UNAUTHORIZED"));
      });
      return;
    }
    const kind: "access" | "ws" = authToken ? "ws" : "access";
    const raw = authToken ?? cookieToken;
    const claims =
      kind === "ws"
        ? await this.jwt.verifyWs(raw)
        : await this.jwt.verify(raw, "access");
    const user = await this.auth.requireActiveUser(
      claims.userId,
      undefined,
      claims.sessionVersion,
    );
    this.sockets.set(socket, {
      token: raw!,
      kind,
      userId: user.id,
      role: user.role,
      version: claims.sessionVersion,
    });
    socket.data.user = user;
    socket.once("disconnect", () => this.sockets.delete(socket));
    // Socket.IO packet middleware blocks the handler until the DB check completes.
    socket.use((_packet, next) => {
      void this.verify(socket).then(
        () => {
          const saved = this.sockets.get(socket);
          if (!saved) return next(new Error("UNAUTHORIZED"));
          withSession(saved.userId, saved.version, () => next());
        },
        () => next(new Error("UNAUTHORIZED")),
      );
    });
  }
  async verify(socket: Socket) {
    try {
      const saved = this.sockets.get(socket);
      if (!saved) throw new UnauthorizedException();
      const claims =
        saved.kind === "ws"
          ? await this.jwt.verifyWs(saved.token)
          : await this.jwt.verify(saved.token, "access");
      const user = await this.auth.requireActiveUser(
        claims.userId,
        undefined,
        claims.sessionVersion,
      );
      if (user.role !== saved.role) throw new UnauthorizedException(); // Drop stale private rooms on role change.
      return user;
    } catch (error) {
      this.sockets.delete(socket);
      socket.disconnect(true);
      throw error;
    }
  }
  async sendPrivate(userId: string, event: string, payload: unknown) {
    let sent = 0;
    for (const [socket, saved] of this.sockets)
      if (saved.userId === userId) {
        try {
          await this.verify(socket);
        } catch {
          continue;
        }
        if (!this.sockets.has(socket)) continue;
        socket.emit(event, payload);
        sent++;
      }
    return sent;
  }
  disconnectUser(id: string) {
    for (const [socket, saved] of this.sockets)
      if (saved.userId === id) {
        this.sockets.delete(socket);
        socket.disconnect(true);
      }
  }
  @Interval(5000)
  async sweep() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      for (const socket of [...this.sockets.keys()])
        await this.verify(socket).catch(() => undefined);
    } finally {
      this.sweeping = false;
    }
  }
  onModuleDestroy() {
    this.unsubscribe();
    for (const socket of this.sockets.keys()) socket.disconnect(true);
    this.sockets.clear();
  }
}
