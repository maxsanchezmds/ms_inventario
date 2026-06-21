import { BadRequestException } from '@nestjs/common';
import { InventarioRequestValidator } from './inventario-request-validator';

describe('InventarioRequestValidator', () => {
  const validator = new InventarioRequestValidator();
  const now = new Date('2026-01-01T00:00:00.000Z');

  test('normaliza producto creado con atributos opcionales', () => {
    const result = validator.validateCreateRequest(
      {
        id_producto: ' sku-1 ',
        nombre: ' Caja ',
        tipo: ' Embalaje ',
        stock: { cantidad_disponible: 10 },
        atributos: { color: 'azul' },
        nombre_responsable: ' Ana Perez ',
      },
      now,
    );

    expect(result).toEqual({
      producto: {
        id_producto: 'sku-1',
        nombre: 'Caja',
        tipo: 'Embalaje',
        stock: { cantidad_disponible: 10, cantidad_reservada: 0 },
        atributos: { color: 'azul' },
        activo: true,
        fecha_creacion: now,
        fecha_actualizacion: now,
      },
      nombreResponsable: 'Ana Perez',
    });
  });

  test('rechaza body de creacion que no sea objeto', () => {
    expect(() => validator.validateCreateRequest(null as never, now)).toThrow(BadRequestException);
    expect(() => validator.validateCreateRequest([] as never, now)).toThrow(BadRequestException);
  });

  test('rechaza stock invalido', () => {
    expect(() =>
      validator.validateCreateRequest(
        {
          nombre: 'Caja',
          tipo: 'Embalaje',
          stock: { cantidad_disponible: 1.5 },
          nombre_responsable: 'Ana Perez',
        },
        now,
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      validator.validateCreateRequest(
        {
          nombre: 'Caja',
          tipo: 'Embalaje',
          stock: { cantidad_disponible: 1, cantidad_reservada: -1 },
          nombre_responsable: 'Ana Perez',
        },
        now,
      ),
    ).toThrow(BadRequestException);
  });

  test('normaliza campos de actualizacion', () => {
    expect(
      validator.validateUpdateRequest({
        nombre: ' Caja mediana ',
        tipo: ' Embalaje ',
        stock: { cantidad_disponible: 5, cantidad_reservada: 2 },
        atributos: { fragil: true },
        activo: false,
        nombre_responsable: ' Ana Perez ',
      }),
    ).toEqual({
      fields: {
        nombre: 'Caja mediana',
        tipo: 'Embalaje',
        stock: { cantidad_disponible: 5, cantidad_reservada: 2 },
        atributos: { fragil: true },
        activo: false,
      },
      nombreResponsable: 'Ana Perez',
    });
  });

  test('rechaza actualizacion sin campos de producto o activo no booleano', () => {
    expect(() => validator.validateUpdateRequest({ nombre_responsable: 'Ana Perez' })).toThrow(BadRequestException);
    expect(() =>
      validator.validateUpdateRequest({
        activo: 'si' as never,
        nombre_responsable: 'Ana Perez',
      }),
    ).toThrow(BadRequestException);
  });

  test('valida identificadores y responsable', () => {
    expect(validator.validateIdProducto(' sku.1:zona-a ')).toBe('sku.1:zona-a');
    expect(validator.validateNombreResponsable(' Ana Perez ')).toBe('Ana Perez');
    expect(() => validator.validateIdProducto('sku con espacios')).toThrow(BadRequestException);
    expect(() => validator.validateNombreResponsable('')).toThrow(BadRequestException);
  });
});
