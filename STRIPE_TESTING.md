# Stripe Test Payment Instructions

## Setup

1. **Get Test Keys**: Use the Stripe publishable key already configured in `.env`:

2. **Backend**: Ensure `STRIPE_SECRET_KEY` is set in backend `.env`

## Test Cards

### Successful Payments
- **Card Number**: `4242 4242 4242 4242`
- **Expiry**: Any future date (e.g., 12/34)
- **CVC**: Any 3 digits (e.g., 123)
- **ZIP**: Any 5 digits

### Declined Card
- **Card Number**: `4000 0000 0000 0002`
- **Result**: Card declined

### Requires Authentication (3D Secure)
- **Card Number**: `4000 0025 0000 3155`
- **Result**: Requires authentication popup

## How to Test

1. **Create Order**:
   - Go to Orders page
   - Click "New Order"
   - Add items from catalog
   - Click "Create Order"

2. **Process Payment**:
   - Click "Process Payment" on the order
   - Choose payment method:
     - **Cash**: Direct payment (no card needed)
     - **Credit Card**: Stripe test mode
   - For Credit Card:
     - Enter test card details above
     - Click "Pay €XX.XX"
     - Order will close and payment recorded

3. **Verify**:
   - Order status changes to "Closed"
   - Payment appears in order details
   - Check Stripe Dashboard (test mode) for payment

## Notes

- All payments use Stripe test mode
- No real money is charged
- Test cards work in test mode only
- Use Stripe Dashboard to view test payments: https://dashboard.stripe.com/test/payments
