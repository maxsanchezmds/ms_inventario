import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DeleteMessageCommand, Message, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { InventarioService } from './inventario.service';
import { PedidoCreadoEvent } from './inventario.types';

const PEDIDO_CREADO_EVENTO = 'pedido_creado';

@Injectable()
export class PedidoCreadoConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PedidoCreadoConsumer.name);
  private readonly sqsClient = new SQSClient({});
  private readonly queueUrl = process.env.QUEUE_URL?.trim();
  private isRunning = false;
  private poller?: Promise<void>;

  constructor(private readonly inventarioService: InventarioService) {}

  onModuleInit(): void {
    if (!this.queueUrl) {
      this.logger.warn('QUEUE_URL no esta configurado; no se consumiran eventos de pedido_creado.');
      return;
    }

    this.isRunning = true;
    this.poller = this.pollQueue();
  }

  async onModuleDestroy(): Promise<void> {
    this.isRunning = false;
    await this.poller;
  }

  private async pollQueue(): Promise<void> {
    while (this.isRunning && this.queueUrl) {
      try {
        const response = await this.sqsClient.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
            VisibilityTimeout: 30,
          }),
        );

        for (const message of response.Messages ?? []) {
          await this.processMessage(message);
        }
      } catch (error) {
        this.logger.error('Error consumiendo mensajes desde SQS.', error);
        await this.sleep(5000);
      }
    }
  }

  private async processMessage(message: Message): Promise<void> {
    if (!this.queueUrl || !message.ReceiptHandle) {
      return;
    }

    const payload = this.parseMessageBody(message.Body);
    if (payload?.evento === PEDIDO_CREADO_EVENTO) {
      await this.inventarioService.evaluatePedidoStock(payload.pedido);
      this.logger.log(`Stock evaluado para pedido ${payload.pedido.id_pedido}.`);
    }

    await this.sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: message.ReceiptHandle,
      }),
    );
  }

  private parseMessageBody(body: string | undefined): PedidoCreadoEvent | null {
    if (!body) {
      return null;
    }

    try {
      const parsed = JSON.parse(body) as unknown;

      if (this.isPedidoCreadoEvent(parsed)) {
        return parsed;
      }

      if (this.isSnsEnvelope(parsed)) {
        const snsMessage = JSON.parse(parsed.Message) as unknown;
        return this.isPedidoCreadoEvent(snsMessage) ? snsMessage : null;
      }
    } catch (error) {
      this.logger.warn(`Mensaje SQS ignorado por JSON invalido: ${(error as Error).message}`);
    }

    return null;
  }

  private isPedidoCreadoEvent(value: unknown): value is PedidoCreadoEvent {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const event = value as Partial<PedidoCreadoEvent>;
    return (
      event.evento === PEDIDO_CREADO_EVENTO &&
      typeof event.pedido?.id_pedido === 'string' &&
      Array.isArray(event.pedido.productos) &&
      event.pedido.productos.every(
        (producto) =>
          typeof producto?.id_producto === 'string' &&
          Number.isInteger(producto.cantidad) &&
          producto.cantidad > 0,
      )
    );
  }

  private isSnsEnvelope(value: unknown): value is { Message: string } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'Message' in value &&
      typeof (value as { Message: unknown }).Message === 'string'
    );
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
}
