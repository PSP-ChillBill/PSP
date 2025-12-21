export function calculateOrderTotal(order: any): number {
  if (!order || !order.orderLines) return 0;
  return order.orderLines.reduce((sum: number, line: any) => {
    const lineTotal = parseFloat(line.unitPriceSnapshot) * parseFloat(line.qty);
    const tax = lineTotal * (parseFloat(line.taxRateSnapshotPct) / 100);
    return sum + lineTotal + tax;
  }, 0);
}
