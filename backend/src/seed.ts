import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const dec = (n: number) => new Prisma.Decimal(n);

async function main(): Promise<void> {
  console.log('🌱 Сидирование БД щебёночного завода...');

  // --- Склады (RAW = горная масса/сырьё, FINISHED = готовая продукция) ---
  const rawWh = await prisma.warehouse.upsert({
    where: { type: 'RAW' },
    update: {},
    create: { name: 'Склад сырья (горная масса)', type: 'RAW' },
  });
  const finWh = await prisma.warehouse.upsert({
    where: { type: 'FINISHED' },
    update: {},
    create: { name: 'Склад готовой продукции', type: 'FINISHED' },
  });

  // --- Пользователи (все роли ЩЕБ) ---
  const passwordHash = await bcrypt.hash('password123', 10);
  const users: { login: string; fullName: string; role: Prisma.UserCreateInput['role'] }[] = [
    { login: 'owner', fullName: 'Ифтихор (владелец заводов)', role: 'OWNER' },
    { login: 'owner2', fullName: 'Сохиб (финансы холдинга)', role: 'OWNER' },
    { login: 'owner3', fullName: 'Довуд (проектная)', role: 'OWNER' },
    { login: 'admin', fullName: 'Администратор системы', role: 'ADMIN' },
    { login: 'operator', fullName: 'Рустам Оператор', role: 'OPERATOR' },
    { login: 'assistant', fullName: 'Помощник Оператора', role: 'ASSISTANT_OPERATOR' },
    { login: 'sales', fullName: 'Фаррух Менеджер', role: 'SALES_MANAGER' },
    { login: 'driver1', fullName: 'Азиз Шофёр (самосвал 1)', role: 'DUMP_TRUCK_DRIVER' },
    { login: 'driver2', fullName: 'Бахтиёр Шофёр (самосвал 2)', role: 'DUMP_TRUCK_DRIVER' },
    { login: 'driver3', fullName: 'Джамшед Шофёр (самосвал 3)', role: 'DUMP_TRUCK_DRIVER' },
    { login: 'excavator', fullName: 'Умед Шофёр экскаватора', role: 'EXCAVATOR_DRIVER' },
    { login: 'mechanic', fullName: 'Шароф Механик', role: 'MECHANIC' },
    { login: 'supply', fullName: 'Наврўз Снабженец', role: 'SUPPLY_MANAGER' },
    { login: 'financier', fullName: 'Гулнора Финансист', role: 'FINANCIER' },
  ];
  const userMap: Record<string, string> = {};
  for (const u of users) {
    const created = await prisma.user.upsert({
      where: { login: u.login },
      update: {},
      create: { login: u.login, fullName: u.fullName, role: u.role, passwordHash },
    });
    userMap[u.login] = created.id;
  }

  // --- Продукция: 5 фракций (FINISHED) + горная масса (RAW) ---
  const products: { name: string; kind: 'RAW' | 'FINISHED'; price: number; minStock?: number; sort: number }[] = [
    { name: 'Горная масса', kind: 'RAW', price: 0, minStock: 100, sort: 0 },
    { name: 'Песок', kind: 'FINISHED', price: 90, minStock: 50, sort: 1 },
    { name: 'Щебень', kind: 'FINISHED', price: 140, minStock: 50, sort: 2 },
    { name: 'Пудра', kind: 'FINISHED', price: 110, minStock: 20, sort: 3 },
    { name: 'Зубок', kind: 'FINISHED', price: 130, minStock: 20, sort: 4 },
    { name: 'Смесь', kind: 'FINISHED', price: 100, minStock: 30, sort: 5 },
  ];
  const productMap: Record<string, string> = {};
  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    const created = existing
      ? existing
      : await prisma.product.create({
          data: {
            name: p.name,
            kind: p.kind,
            unit: 'M3',
            price: dec(p.price),
            minStock: p.minStock ? dec(p.minStock) : null,
            sortOrder: p.sort,
          },
        });
    productMap[p.name] = created.id;

    // Начальные остатки готовой продукции
    if (p.kind === 'FINISHED') {
      const wh = finWh.id;
      await prisma.stockItem.upsert({
        where: { warehouseId_productId: { warehouseId: wh, productId: created.id } },
        update: {},
        create: { warehouseId: wh, productId: created.id, quantity: dec(200) },
      });
    }
  }
  // Начальный остаток горной массы
  await prisma.stockItem.upsert({
    where: { warehouseId_productId: { warehouseId: rawWh.id, productId: productMap['Горная масса']! } },
    update: {},
    create: { warehouseId: rawWh.id, productId: productMap['Горная масса']!, quantity: dec(500) },
  });

  // --- Клиенты: внешние (наличные) + свой бизнес (бартер/долг) ---
  const clientsData: { name: string; type: 'EXTERNAL' | 'INTERNAL'; phone?: string }[] = [
    { name: 'ООО СтройМир', type: 'EXTERNAL', phone: '+992900000001' },
    { name: 'ИП Каримов', type: 'EXTERNAL', phone: '+992900000002' },
    { name: 'Бетонный завод (холдинг)', type: 'INTERNAL', phone: '+992900000003' },
    { name: 'Застройщик (холдинг)', type: 'INTERNAL', phone: '+992900000004' },
  ];
  for (const c of clientsData) {
    const existing = await prisma.client.findFirst({ where: { name: c.name } });
    if (!existing) {
      await prisma.client.create({ data: { name: c.name, type: c.type, phone: c.phone ?? null } });
    }
  }

  // --- Техника: экскаватор, 3 самосвала, дробилка (ЩЕБ-50) ---
  const vehicles: { name: string; type: 'EXCAVATOR' | 'DUMP_TRUCK' | 'CRUSHER'; plate?: string }[] = [
    { name: 'Экскаватор Hitachi', type: 'EXCAVATOR', plate: '01A001AA' },
    { name: 'Самосвал КамАЗ №1', type: 'DUMP_TRUCK', plate: '01A101BB' },
    { name: 'Самосвал КамАЗ №2', type: 'DUMP_TRUCK', plate: '01A102BB' },
    { name: 'Самосвал КамАЗ №3', type: 'DUMP_TRUCK', plate: '01A103BB' },
    { name: 'Дробилка ДСУ', type: 'CRUSHER', plate: null as unknown as string },
  ];
  for (const v of vehicles) {
    const existing = await prisma.vehicle.findFirst({ where: { name: v.name } });
    if (!existing) {
      await prisma.vehicle.create({ data: { name: v.name, type: v.type, plate: v.plate ?? null } });
    }
  }

  // --- Настройки: лимиты и порог крупной закупки (ХОЛ-20…21) ---
  await prisma.setting.upsert({
    where: { key: 'procurement.largeThreshold' },
    update: {},
    create: { key: 'procurement.largeThreshold', value: { amount: 5000 } },
  });
  await prisma.setting.upsert({
    where: { key: 'cash.limit' },
    update: {},
    create: { key: 'cash.limit', value: { amount: 50000 } },
  });

  console.log('✅ Готово. Пользователи: owner/operator/mechanic/driver1... (пароль у всех: password123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
