import { getUncachableStripeClient } from "./stripeClient";
import { log } from "./index";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
          "Received type: " + typeof payload + ". " +
          "This usually means express.json() parsed the body before reaching this handler."
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET not configured");
    }

    const stripe = await getUncachableStripeClient();
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    log(`Stripe webhook received: ${event.type}`, "stripe");

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        log(`Checkout session completed: ${session.id}`, "stripe");
        break;
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        log(`Payment succeeded: ${paymentIntent.id}`, "stripe");
        break;
      }
      default:
        log(`Unhandled event type: ${event.type}`, "stripe");
    }
  }
}
