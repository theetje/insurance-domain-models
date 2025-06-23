import winston from 'winston';
import { AppConfig } from '../types';

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private constructor(config?: AppConfig['logging']) {
    const format = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.prettyPrint()
    );

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ];

    if (config?.file) {
      transports.push(
        new winston.transports.File({
          filename: config.file,
          format
        })
      );
    }

    this.logger = winston.createLogger({
      level: config?.level || 'info',
      format,
      transports
    });
  }

  static getInstance(config?: AppConfig['logging']): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  error(message: string, error?: Error | any): void {
    this.logger.error(message, { error: error?.stack || error });
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }
}
