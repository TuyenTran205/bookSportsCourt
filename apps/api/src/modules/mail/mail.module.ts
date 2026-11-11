import { Module } from "@nestjs/common";
import { MailTransport } from "./mail.transport.js";

@Module({ providers: [MailTransport], exports: [MailTransport] })
export class MailModule {}
