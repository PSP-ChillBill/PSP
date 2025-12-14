import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  await prisma.stockMovement.deleteMany();
  await prisma.stockItem.deleteMany();
  await prisma.orderLine.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.reservationService.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.discountEligibility.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.giftCard.deleteMany();
  await prisma.serviceEmployee.deleteMany();
  await prisma.option.deleteMany();
  await prisma.catalogItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.business.deleteMany();
  await prisma.taxRule.deleteMany();

  await prisma.taxRule.createMany({
    data: [
      {
        countryCode: 'US',
        taxClass: 'Standard',
        ratePercent: 20.0,
        validFrom: new Date('2024-01-01'),
        isActive: true,
      },
      {
        countryCode: 'US',
        taxClass: 'Reduced',
        ratePercent: 9.0,
        validFrom: new Date('2024-01-01'),
        isActive: true,
      },
    ],
  });

  const business = await prisma.business.create({
    data: {
      name: 'Demo Business',
      address: '123 Main St, New York, NY',
      phone: '+1 555-0123',
      email: 'contact@demobusiness.com',
      countryCode: 'US',
      priceIncludesTax: false,
    },
  });

  await prisma.employee.create({
    data: {
      businessId: business.id,
      name: 'Demo Owner',
      email: 'demo@example.com',
      role: 'Owner',
      status: 'Active',
    },
  });

  const manager = await prisma.employee.create({
    data: {
      businessId: business.id,
      name: 'Alice Manager',
      email: 'alice@example.com',
      role: 'Manager',
      status: 'Active',
    },
  });

  const staff = await prisma.employee.create({
    data: {
      businessId: business.id,
      name: 'Bob Barista',
      email: 'bob@example.com',
      role: 'Staff',
      status: 'Active',
    },
  });

  const catDrinks = await prisma.category.create({
    data: { businessId: business.id, name: 'Beverages', sortOrder: 1 },
  });

  const catFood = await prisma.category.create({
    data: { businessId: business.id, name: 'Food', sortOrder: 2 },
  });

  const catServices = await prisma.category.create({
    data: { businessId: business.id, name: 'Services', sortOrder: 3 },
  });

  const itemCoffee = await prisma.catalogItem.create({
    data: {
      businessId: business.id,
      categoryId: catDrinks.id,
      name: 'Specialty Coffee',
      code: 'COFFEE-001',
      type: 'Product',
      basePrice: 3.50,
      taxClass: 'Standard',
      options: {
        create: [
          { name: 'Small', priceModifier: 0, sortOrder: 1 },
          { name: 'Large', priceModifier: 1.0, sortOrder: 2 },
          { name: 'Oat Milk', priceModifier: 0.5, sortOrder: 3 },
        ],
      },
      stockItem: {
        create: {
          unit: 'cup',
          qtyOnHand: 500,
          averageUnitCost: 0.80,
        },
      },
    },
    include: { options: true },
  });

  const itemFood = await prisma.catalogItem.create({
    data: {
      businessId: business.id,
      categoryId: catFood.id,
      name: 'Butter Croissant',
      code: 'FOOD-001',
      type: 'Product',
      basePrice: 2.50,
      taxClass: 'Reduced',
      stockItem: {
        create: {
          unit: 'pc',
          qtyOnHand: 40,
          averageUnitCost: 0.50,
        },
      },
    },
    include: { options: true },
  });

  const itemService = await prisma.catalogItem.create({
    data: {
      businessId: business.id,
      categoryId: catServices.id,
      name: 'Consultation',
      code: 'SERV-001',
      type: 'Service',
      basePrice: 50.00,
      taxClass: 'Standard',
      defaultDurationMin: 60,
    },
  });

  await prisma.serviceEmployee.create({
    data: {
      catalogItemId: itemService.id,
      employeeId: staff.id,
    },
  });

  await prisma.discount.create({
    data: {
      businessId: business.id,
      code: 'WELCOME10',
      type: 'Percent',
      scope: 'Order',
      value: 10,
      startsAt: new Date(),
      status: 'Active',
    },
  });

  await prisma.giftCard.create({
    data: {
      businessId: business.id,
      code: 'GIFT-2024-TEST',
      initialValue: 50.00,
      balance: 50.00,
      status: 'Active',
    },
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(15, 0, 0, 0);

  await prisma.reservation.create({
    data: {
      businessId: business.id,
      employeeId: staff.id,
      customerName: 'John Doe',
      customerEmail: 'john@doe.com',
      appointmentStart: tomorrow,
      appointmentEnd: tomorrowEnd,
      plannedDurationMin: 60,
      status: 'Booked',
      services: {
        create: {
          catalogItemId: itemService.id,
        },
      },
    },
  });

  await prisma.order.create({
    data: {
      businessId: business.id,
      employeeId: staff.id,
      status: 'Open',
      tableOrArea: 'Table 5',
      orderLines: {
        create: [
          {
            optionId: itemCoffee.options[0].id, // Small
            itemNameSnapshot: itemCoffee.name,
            optionNameSnapshot: 'Small',
            qty: 2,
            unitPriceSnapshot: 3.50,
            taxClassSnapshot: 'Standard',
            taxRateSnapshotPct: 20.0,
          },
          {
            itemNameSnapshot: itemFood.name,
            qty: 1,
            unitPriceSnapshot: 2.50,
            taxClassSnapshot: 'Reduced',
            taxRateSnapshotPct: 9.0,
          },
        ],
      },
    },
  });

  console.log('✅ Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });