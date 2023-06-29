import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Twilio ratelimit every verification:
 *  - resend: 4 (Total send: 5)
 *  - check attempts: 5
 */
@Injectable()
export default class TwilioService {
  private static readonly VERIFY_API_BASE = 'https://verify.twilio.com/v2';
  private static readonly LOOKUPS_API_BASE = 'https://lookups.twilio.com/v2';

  private readonly logger: Logger = new Logger('TwilioService');

  constructor(private readonly config: ConfigService) {}

  get basicAuthorization() {
    return (
      'Basic ' +
      Buffer.from(
        `${this.config.getOrThrow(
          'TWILIO_ACCOUNT_SID',
        )}:${this.config.getOrThrow('TWILIO_AUTH_TOKEN')}`,
      ).toString('base64')
    );
  }

  private async request(path: string, method: 'get');
  private async request(
    path: string,
    method: 'post',
    data: Record<string, string>,
  );
  private async request(
    path: string,
    method: 'get' | 'post',
    payload?: Record<string, string>,
  ) {
    let init = {
      method: method,
      headers: {
        Authorization: this.basicAuthorization,
      },
    };
    if (method != 'get')
      init = Object.assign(init, {
        body: new URLSearchParams(payload),
      });
    const res = await fetch(
      TwilioService.VERIFY_API_BASE +
        `/Services/${this.config.getOrThrow('TWILIO_SERVICE_ID')}` +
        path,
      init,
    );
    const data = await res.json();
    return {
      status: res.status,
      data: data,
    };
  }

  public async createNewVerification(
    phoneNumber: string,
    channel: Channel,
    retry = false,
  ) {
    const res = await this.request('/Verifications', 'post', {
      To: phoneNumber,
      Channel: channel,
    });
    if (res.status !== 201) {
      if (res.status === 429) {
        this.logger.debug('Rate-limit reached for phone number: ', phoneNumber);
        if (!retry) {
          await this.cancelVerification(phoneNumber);
          return this.createNewVerification(phoneNumber, channel, true);
        }
      }
      this.logger.error(
        'Unexpected response from Twilio Verify [1] status: ',
        res.status,
        res.data,
      );
      throw new ServiceUnavailableException();
    }
    return res.data;
  }

  public async fetchVerification(
    phoneOrVerificationSid: string,
  ): Promise<any | null> {
    const res = await this.request(
      '/Verifications/' + phoneOrVerificationSid,
      'get',
    );
    if (res.status != 200) {
      if (res == 404) return null;
      this.logger.error(
        'Unexpected response from Twilio Verify [2] status: ',
        res.status,
        res.data,
      );
      throw new ServiceUnavailableException();
    }

    return res.data;
  }

  public async checkVerification(
    type: 'phone' | 'verificationSid',
    target: string,
    code: string,
  ): Promise<Boolean | 'RATELIMIT'> {
    let payload = {
      Code: code,
    };
    if (type === 'phone')
      payload = Object.assign(payload, {
        To: target,
      });
    else
      payload = Object.assign(payload, {
        VerificationSid: target,
      });

    const res = await this.request('/Verifications', 'post', payload);

    if (res.status != 200) {
      if (res.status === 429) return 'RATELIMIT';
      this.logger.error(
        'Unexpected response from Twilio Verify [3] status: ',
        res.status,
        res.data,
      );
      throw new ServiceUnavailableException();
    }

    return res.data.valid;
  }

  public async cancelVerification(
    phoneOrVerificationSid: string,
  ): Promise<boolean> {
    const res = await this.request(
      '/Verifications/' + phoneOrVerificationSid,
      'post',
      {
        Status: 'cancel',
      },
    );
    if (res.status !== 200) {
      if (res.status === 404) return null;
      this.logger.error(
        'Unexpected response from Twilio Verify [4] status: ',
        res.status,
        res.data,
      );
      throw new ServiceUnavailableException();
    }
    return true;
  }

  public async validatePhoneNumber(phoneNumber: string): Promise<boolean> {
    const res = await fetch(
      TwilioService.LOOKUPS_API_BASE + '/PhoneNumbers/' + phoneNumber,
      {
        headers: {
          Authorization: this.basicAuthorization,
        },
      },
    );
    const data = await res.json();
    if (res.status != 200) {
      this.logger.error(
        'Unexpected response from Twilio Lookups status: ',
        res.status,
      );
      throw new ServiceUnavailableException();
    }
    return data.valid;
  }
}

export type Channel = 'sms' | 'whatsapp' | 'voice';
