export function calculateOrderTotal(order: any): { subtotal: number; tax: number; total: number } {
  if (!order || !order.orderLines) return { subtotal: 0, tax: 0, total: 0 };
  let subtotal = 0;
  let tax = 0;
  order.orderLines.forEach((line: any) => {
    const lineTotal = parseFloat(line.unitPriceSnapshot) * parseFloat(line.qty);
    const lineTax = lineTotal * (parseFloat(line.taxRateSnapshotPct) / 100);
    subtotal += lineTotal;
    tax += lineTax;
  });
  return { subtotal, tax, total: subtotal + tax };
}
