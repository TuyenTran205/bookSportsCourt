import { Module } from "@nestjs/common";
import { MailModule } from "./mail.module.js";
import { EmailOutboxRepository } from "./email-outbox.repository.js";
import { BusinessMailService } from "./business-mail.service.js";
import { BookingRemindersRepository } from "./booking-reminders.repository.js";
import { SendRemindersSchedule } from "../../schedules/send-reminders.schedule.js";

@Module({
  imports: [MailModule],
  providers: [
    EmailOutboxRepository,
    BusinessMailService,
    BookingRemindersRepository,
    SendRemindersSchedule,
  ],
})
export class BusinessMailModule {}
