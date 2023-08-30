import { Injectable, Logger, NestMiddleware } from '@nestjs/common';

/*@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger(`HTTP`);

  use(req: Request, res: Response, next: NextFunction) {
    this.logger.log(
      `Logging HTTP request ${req.method} ${req.url} ${res.statusCode}`,
    );
    next();
  }
}*/
