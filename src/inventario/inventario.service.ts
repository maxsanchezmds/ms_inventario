import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InventarioEventPublisher } from './inventario-event-publisher';
import { InventarioRequestValidator } from './inventario-request-validator';
import { InventarioRepository } from './inventario.repository';
import {
  CreateProductoRequest,
  Pedido,
  Producto,
  StockEvaluadoEvent,
  UpdateProductoRequest,
} from './inventario.types';
import { TrazabilidadRepository } from './trazabilidad.repository';

type InventarioRepositoryPort = Pick<InventarioRepository, 'create' | 'update' | 'delete' | 'findAll' | 'findByIds'>;
type TrazabilidadRepositoryPort = Pick<TrazabilidadRepository, 'create'>;
type InventarioEventPublisherPort = Pick<InventarioEventPublisher, 'publishStockAprobado' | 'publishStockRechazado'>;

@Injectable()
export class InventarioService {
  constructor(
    @Inject(InventarioRepository) private readonly inventarioRepository: InventarioRepositoryPort,
    @Inject(TrazabilidadRepository) private readonly trazabilidadRepository: TrazabilidadRepositoryPort,
    @Inject(InventarioEventPublisher) private readonly inventarioEventPublisher: InventarioEventPublisherPort,
    private readonly requestValidator: InventarioRequestValidator,
  ) {}

  async create(body: CreateProductoRequest = {}): Promise<Producto> {
    const data = this.requestValidator.validateCreateRequest(body, new Date());
    const producto = await this.inventarioRepository.create(data.producto);
    await this.trazabilidadRepository.create(producto.id_producto, data.nombreResponsable);
    return producto;
  }

  async update(idProducto: string, body: UpdateProductoRequest = {}): Promise<Producto> {
    const normalizedId = this.requestValidator.validateIdProducto(idProducto);
    const updateData = this.requestValidator.validateUpdateRequest(body);
    const producto = await this.inventarioRepository.update(normalizedId, updateData.fields, new Date());

    if (!producto) {
      throw new NotFoundException('Producto no encontrado.');
    }

    await this.trazabilidadRepository.create(producto.id_producto, updateData.nombreResponsable);
    return producto;
  }

  async delete(idProducto: string, nombreResponsable: unknown): Promise<Producto> {
    const normalizedId = this.requestValidator.validateIdProducto(idProducto);
    const responsable = this.requestValidator.validateNombreResponsable(nombreResponsable);
    const producto = await this.inventarioRepository.delete(normalizedId);

    if (!producto) {
      throw new NotFoundException('Producto no encontrado.');
    }

    await this.trazabilidadRepository.create(producto.id_producto, responsable);
    return producto;
  }

  async findAll(): Promise<Producto[]> {
    return this.inventarioRepository.findAll();
  }

  async evaluatePedidoStock(pedido: Pedido): Promise<void> {
    const productosSolicitados = this.aggregatePedidoProducts(pedido);
    const productos = await this.inventarioRepository.findByIds(productosSolicitados.map((producto) => producto.id_producto));
    const productosById = new Map(productos.map((producto) => [producto.id_producto, producto]));

    const evaluacion = productosSolicitados.map((productoSolicitado) => {
      const producto = productosById.get(productoSolicitado.id_producto);
      const cantidadDisponible = producto?.stock.cantidad_disponible ?? 0;
      const aprobado =
        producto !== undefined &&
        producto.activo &&
        cantidadDisponible >= productoSolicitado.cantidad;

      return {
        id_producto: productoSolicitado.id_producto,
        cantidad_solicitada: productoSolicitado.cantidad,
        cantidad_disponible: cantidadDisponible,
        aprobado,
        ...(aprobado
          ? {}
          : { motivo: producto ? 'stock_insuficiente' : 'producto_no_existe' }),
      };
    }) satisfies StockEvaluadoEvent['productos'];

    if (evaluacion.every((producto) => producto.aprobado)) {
      await this.inventarioEventPublisher.publishStockAprobado(pedido, evaluacion);
      return;
    }

    await this.inventarioEventPublisher.publishStockRechazado(pedido, evaluacion);
  }

  private aggregatePedidoProducts(pedido: Pedido): Pedido['productos'] {
    const quantitiesByProduct = new Map<string, number>();

    for (const producto of pedido.productos) {
      const currentQuantity = quantitiesByProduct.get(producto.id_producto) ?? 0;
      quantitiesByProduct.set(producto.id_producto, currentQuantity + producto.cantidad);
    }

    return [...quantitiesByProduct.entries()].map(([id_producto, cantidad]) => ({ id_producto, cantidad }));
  }
}
