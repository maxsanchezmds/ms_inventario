import { ConflictException, Injectable } from '@nestjs/common';
import { Collection, MongoServerError } from 'mongodb';
import { Producto, ProductoUpdateFields } from './inventario.types';
import { MongoDatabase } from './mongo-database';

@Injectable()
export class InventarioRepository {
  constructor(private readonly mongoDatabase: MongoDatabase) {}

  async create(producto: Producto): Promise<Producto> {
    try {
      const collection = await this.getCollection();
      await collection.insertOne(producto);
      return producto;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Ya existe un producto con ese id_producto.');
      }
      throw error;
    }
  }

  async update(idProducto: string, fields: ProductoUpdateFields, now: Date): Promise<Producto | null> {
    const collection = await this.getCollection();
    const result = await collection.findOneAndUpdate(
      { id_producto: idProducto },
      {
        $set: {
          ...fields,
          fecha_actualizacion: now,
        },
      },
      { returnDocument: 'after', projection: { _id: 0 } },
    );

    return result;
  }

  async delete(idProducto: string): Promise<Producto | null> {
    const collection = await this.getCollection();
    const result = await collection.findOneAndDelete({ id_producto: idProducto }, { projection: { _id: 0 } });
    return result;
  }

  async findAll(): Promise<Producto[]> {
    const collection = await this.getCollection();
    return collection.find({}, { projection: { _id: 0 } }).sort({ nombre: 1, id_producto: 1 }).toArray();
  }

  async findByIds(idProductos: string[]): Promise<Producto[]> {
    const collection = await this.getCollection();
    return collection.find({ id_producto: { $in: idProductos } }, { projection: { _id: 0 } }).toArray();
  }

  private async getCollection(): Promise<Collection<Producto>> {
    return this.mongoDatabase.getInventarioCollection();
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return error instanceof MongoServerError && error.code === 11000;
  }
}
