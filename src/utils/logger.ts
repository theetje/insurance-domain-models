import winston from 'winston';
import { AppConfig } from '../types';

export class Logger {
  private static instance: Logger;
  private static globalLevel: string | null = null;
  private logger!: winston.Logger; // Use definite assignment assertion

  private constructor(config?: AppConfig['logging']) {
    this.createLogger(config);
  }

  static setGlobalLevel(level: string): void {
    Logger.globalLevel = level;
    if (Logger.instance) {
      Logger.instance.logger.level = level;
    }
  }

  private createLogger(config?: AppConfig['logging']): void {
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
      level: Logger.globalLevel || config?.level || 'warn', // Use global level if set
      format,
      transports
    });
  }

  static getInstance(config?: AppConfig['logging']): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    } else if (config) {
      // Update existing logger with new config
      Logger.instance.createLogger(config);
    }
    return Logger.instance;
  }

  setLevel(level: string): void {
    this.logger.level = level;
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
