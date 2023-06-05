import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export default class SendgridService {

  private static readonly API_BASE = "https://api.sendgrid.com/v3";
  private static readonly DEFAULT_EMAIL_SENDER = "no-reply@faisal.gg";

  private readonly logger: Logger = new Logger("SendgridService");

  constructor(private readonly config: ConfigService) {
    /*this.sendEmail("hi@faisal.gg", "First email send (Test #01)", {
      type: "text/plain",
      value: "Test #01"
    });
    console.log("Email sent");*/
  }

  public async sendEmail(to: string, subject: string, content: { type: "text/plain" | "text/html", value: string }) {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + this.config.getOrThrow("SENDGRID_API_KEY"),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        subject,
        personalizations: [
          {
            from: {
              email: SendgridService.DEFAULT_EMAIL_SENDER
            },
            to: [
              {
                email: to
              }
            ]
          }
        ],
        from: {
          email: SendgridService.DEFAULT_EMAIL_SENDER
        },
        reply_to: {
          email: to
        },
        content: [
          content
        ]
      })
    });
    if (res.status !== 202) {
      const data = await res.json();
      this.logger.error(`Unable to send email to ${this}`, data);
      throw new ServiceUnavailableException();
    }
  }
}
