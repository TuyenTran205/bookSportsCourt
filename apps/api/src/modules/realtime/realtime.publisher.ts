import { Injectable } from "@nestjs/common";
import { SOCKET_EVENTS } from "../../../../../packages/shared/src/constants.js";
import type { SlotUpdatedPayload } from "../../../../../packages/shared/src/types.js";
import { RealtimeSessionsService } from "../auth/realtime-sessions.service.js";
import { RealtimeGateway } from "./realtime.gateway.js";

export interface BookingCreatedRealtimePayload {
  bookingId: string;
  venueId: string;
  courtId: string;
}

export interface BookingCancelledRealtimePayload {
  bookingId: string;
  reason: string;
}

export interface PaymentSubmittedRealtimePayload {
  paymentId: string;
  bookingId: string;
  venueId: string;
}

@Injectable()
export class RealtimePublisher {
  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly sessions: RealtimeSessionsService,
  ) {}

  emitSlots(payload: SlotUpdatedPayload) {
    this.gateway.emitToVenueDate(
      payload.venueId,
      payload.date,
      SOCKET_EVENTS.SLOT_UPDATED,
      payload,
    );
  }

  emitBookingCreated(
    ownerId: string,
    customerId: string,
    payload: BookingCreatedRealtimePayload,
  ) {
    this.gateway.emitToOwner(
      ownerId,
      SOCKET_EVENTS.BOOKING_CREATED,
      payload,
    );
    void this.sessions.sendPrivate(
      customerId,
      SOCKET_EVENTS.BOOKING_CREATED,
      payload,
    );
  }

  emitBookingCancelled(
    customerId: string,
    payload: BookingCancelledRealtimePayload,
  ) {
    void this.sessions.sendPrivate(
      customerId,
      SOCKET_EVENTS.BOOKING_CANCELLED,
      payload,
    );
  }

  emitPaymentSubmitted(
    ownerId: string,
    payload: PaymentSubmittedRealtimePayload,
  ) {
    this.gateway.emitToOwner(
      ownerId,
      SOCKET_EVENTS.PAYMENT_SUBMITTED,
      payload,
    );
    void this.sessions.sendPrivate(
      ownerId,
      SOCKET_EVENTS.PAYMENT_SUBMITTED,
      payload,
    );
  }

  emitBookingConfirmed(
    customerId: string,
    payload: { paymentId: string; bookingId: string },
  ) {
    void this.sessions.sendPrivate(
      customerId,
      SOCKET_EVENTS.BOOKING_CONFIRMED,
      payload,
    );
  }

  emitPaymentRejected(
    customerId: string,
    payload: { paymentId: string; bookingId: string; reason: string },
  ) {
    void this.sessions.sendPrivate(
      customerId,
      SOCKET_EVENTS.PAYMENT_REJECTED,
      payload,
    );
  }
}