// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Poblando la base de datos de GameVault...');

  // 1. Crear Usuario Administrador Inicial
  const hashedPassword = await Bun.password.hash('admin123', {
    algorithm: 'bcrypt',
    cost: 10,
  });

  const admin = await prisma.usuario.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      nombreCompleto: 'Administrador GameVault',
      username: 'admin',
      password: hashedPassword,
      rol: 'ADMINISTRADOR',
    },
  });

  // 2. Crear Categorías Iniciales del POS
  const categoriasBase = ['Consolas', 'Videojuegos', 'Accesorios', 'Pines Digitales'];

  for (const nombreCategoria of categoriasBase) {
    const existe = await prisma.categoria.findFirst({
      where: { nombreCategoria },
    });

    if (!existe) {
      await prisma.categoria.create({
        data: { nombreCategoria },
      });
    }
  }

  console.log('✅ Base de datos poblada exitosamente:');
  console.log('   • Usuario Admin: admin');
  console.log('   • Contraseña:   admin123');
  console.log(`   • Categorías:   ${categoriasBase.join(', ')}`);

  // 3. Crear Clientes Iniciales
  const clientesBase = [
    { nombre: 'Alejandro Morales', telefono: '5512345678' },
    { nombre: 'Valeria Gómez', telefono: '5598765432' },
    { nombre: 'Carlos Mendoza', telefono: '5544332211' },
    { nombre: 'Mariana Torres', telefono: '5588776655' },
  ];

  for (const c of clientesBase) {
    const existe = await prisma.cliente.findFirst({
      where: { nombre: c.nombre },
    });
    if (!existe) {
      await prisma.cliente.create({ data: c });
    }
  }

  // 4. Crear Productos Iniciales
  const productosBase = [
    { codigo: 'SS5-SLIM-01', nombre: 'PlayStation 5 Slim 1TB Digital', precio: 449.99, stock: 5, idCategoria: 1, esDigital: false },
    { codigo: 'NSW-OLED-02', nombre: 'Nintendo Switch OLED Blanco 64GB', precio: 349.99, stock: 7, idCategoria: 1, esDigital: false },
    { codigo: 'XSX-1TB-03', nombre: 'Xbox Series X 1TB Black Edition', precio: 499.99, stock: 4, idCategoria: 1, esDigital: false },
    { codigo: 'S645507000000', nombre: 'The Legend of Zelda: Tears of the Kingdom', precio: 69.99, stock: 12, idCategoria: 2, esDigital: false },
    { codigo: 'S349500S00000', nombre: "Cyberpunk 2077 Collector's Edition", precio: 249.99, stock: 2, idCategoria: 2, esDigital: false },
    { codigo: 'SM2-PS5-04', nombre: "Marvel's Spider-Man 2 Launch Edition", precio: 69.99, stock: 14, idCategoria: 2, esDigital: false },
    { codigo: 'GTA6-PRE-05', nombre: 'Grand Theft Auto VI - Pre-Order Edition', precio: 79.99, stock: 25, idCategoria: 2, esDigital: false },
    { codigo: 'ER-SHADOW-06', nombre: 'Elden Ring: Shadow of the Erdtree Edition', precio: 59.99, stock: 9, idCategoria: 2, esDigital: false },
    { codigo: 'SSXS8B0600000', nombre: 'PlayStation 5 DualSense Wireless Controller', precio: 69.99, stock: 15, idCategoria: 3, esDigital: false },
    { codigo: 'SSAS887000000', nombre: 'Xbox Elite Wireless Controller Series 2', precio: 179.99, stock: 6, idCategoria: 3, esDigital: false },
    { codigo: 'PIN-PSN-10U', nombre: 'PlayStation Network Card $10 USD', precio: 10.00, stock: 3, idCategoria: 4, esDigital: true },
    { codigo: 'PIN-XGPU-1M', nombre: 'Xbox Game Pass Ultimate 1 Mes', precio: 14.99, stock: 2, idCategoria: 4, esDigital: true },
    { codigo: 'PIN-ESHOP-20U', nombre: 'Nintendo eShop Card $20 USD', precio: 20.00, stock: 2, idCategoria: 4, esDigital: true },
    { codigo: 'PIN-STEAM-20U', nombre: 'Steam Wallet Card $20 USD', precio: 20.00, stock: 2, idCategoria: 4, esDigital: true },
  ];

  for (const p of productosBase) {
    const existe = await prisma.producto.findUnique({
      where: { codigo: p.codigo },
    });
    if (!existe) {
      await prisma.producto.create({ data: p });
    }
  }

  // 5. Cargar Pines Digitales de prueba y sincronizar stock real disponible
  const pinesSeed: Record<string, string[]> = {
    'PIN-PSN-10U': ['PSN-10U-ABCD-1234', 'PSN-10U-EFGH-5678', 'PSN-10U-IJKL-9012'],
    'PIN-XGPU-1M': ['XGPU-1M-WXYZ-7890', 'XGPU-1M-ABCD-4567'],
    'PIN-ESHOP-20U': ['ESHOP-20U-MNLK-3456', 'ESHOP-20U-OPQR-7890'],
    'PIN-STEAM-20U': ['STEAM-20U-QWER-1234', 'STEAM-20U-TYUI-5678'],
  };

  for (const [codigoProd, codigos] of Object.entries(pinesSeed)) {
    const prod = await prisma.producto.findUnique({ where: { codigo: codigoProd } });
    if (prod) {
      for (const pinCode of codigos) {
        const existePin = await prisma.pinDigital.findFirst({
          where: { codigo: pinCode, productoId: prod.id },
        });
        if (!existePin) {
          await prisma.pinDigital.create({
            data: {
              codigo: pinCode,
              productoId: prod.id,
              estado: 'DISPONIBLE',
            },
          });
        }
      }

      const totalDisponibles = await prisma.pinDigital.count({
        where: { productoId: prod.id, estado: 'DISPONIBLE' },
      });

      await prisma.producto.update({
        where: { id: prod.id },
        data: {
          stock: totalDisponibles,
          esDigital: true,
        },
      });
    }
  }

  // 6. Crear Preventa Inicial si no existe
  const cliente1 = await prisma.cliente.findFirst({ where: { nombre: 'Alejandro Morales' } });
  const prodGTA = await prisma.producto.findUnique({ where: { codigo: 'GTA6-PRE-05' } });
  if (cliente1 && prodGTA) {
    const existePrev = await prisma.preventa.findFirst({
      where: { idCliente: cliente1.id, idProducto: prodGTA.id },
    });
    if (!existePrev) {
      await prisma.preventa.create({
        data: {
          idCliente: cliente1.id,
          idProducto: prodGTA.id,
          montoAnticipo: 40.00,
          estado: 'PENDIENTE',
        },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error('Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });