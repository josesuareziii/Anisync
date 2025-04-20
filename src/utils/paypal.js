import { loadScript } from "@paypal/paypal-js";

export async function initializePayPal() {
  try {
    return await loadScript({
      "client-id": import.meta.env.VITE_PAYPAL_CLIENT_ID,
      currency: "USD",
      intent: "capture"
    });
  } catch (err) {
    console.error("PayPal SDK loading error:", err);
    throw err;
  }
}

export function createPaymentObject(plan) {
  const amount = typeof plan.price === 'string' ? plan.price : plan.price.toString();
  
  return {
    purchase_units: [{
      amount: {
        currency_code: "USD",
        value: amount,
        breakdown: {
          item_total: {
            currency_code: "USD",
            value: amount
          }
        }
      },
      description: `AniSync ${plan.name}`,
      items: [{
        name: plan.name,
        quantity: "1",
        unit_amount: {
          currency_code: "USD",
          value: amount
        },
        category: "DIGITAL_GOODS"
      }]
    }]
  };
}

export function createPayPalButtonOptions(plan, onSuccess, onError, onCancel) {
  return {
    style: {
      layout: 'vertical',
      color: 'blue',
      shape: 'rect',
      label: 'pay'
    },
    createOrder: (data, actions) => {
      return actions.order.create(createPaymentObject(plan));
    },
    onApprove: async (data, actions) => {
      try {
        const order = await actions.order.capture();
        onSuccess(order);
      } catch (err) {
        onError(err);
      }
    },
    onError: (err) => {
      onError(err);
    },
    onCancel: () => {
      onCancel();
    }
  };
}