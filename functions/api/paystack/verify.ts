/** Paystack désactivé — abonnement = Wave + WhatsApp uniquement */
export async function onRequest() {
  return new Response(
    JSON.stringify({
      error: 'Paystack désactivé',
      message: 'Paiement abonnement uniquement par Wave puis confirmation WhatsApp.',
    }),
    { status: 410, headers: { 'Content-Type': 'application/json' } },
  );
}
