import { useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Box, Button, CircularProgress, Typography } from '@mui/material';

// Cache the Stripe.js instance per publishable key — loadStripe() must not be
// called on every render, but the key can differ across salons/environments.
const stripePromiseCache = new Map<string, Promise<Stripe | null>>();
function getStripePromise(publishableKey: string) {
  if (!stripePromiseCache.has(publishableKey)) {
    stripePromiseCache.set(publishableKey, loadStripe(publishableKey));
  }
  return stripePromiseCache.get(publishableKey)!;
}

function InnerForm({
  amountLabel,
  onSuccess,
  onError,
  onCancel,
}: {
  amountLabel: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });
    setSubmitting(false);

    if (error) {
      onError(error.message ?? 'Payment failed');
      return;
    }
    if (paymentIntent?.status === 'succeeded') {
      onSuccess(paymentIntent.id);
    } else {
      onError('Payment did not complete. Please try again.');
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <PaymentElement />
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          disabled={submitting}
          onClick={onCancel}
          sx={{ borderRadius: '12px', fontWeight: 700, py: 1.25, textTransform: 'none' }}
        >
          Cancel
        </Button>
        <Button
          fullWidth
          variant="contained"
          disabled={!stripe || !elements || submitting}
          onClick={handleSubmit}
          sx={{
            borderRadius: '12px', fontWeight: 800, py: 1.25, bgcolor: '#6C3FC5',
            '&:hover': { bgcolor: '#5a33a8' }, textTransform: 'none',
          }}
        >
          {submitting ? <CircularProgress size={18} color="inherit" /> : `Charge ${amountLabel}`}
        </Button>
      </Box>
    </Box>
  );
}

export default function StripePaymentForm({
  clientSecret,
  publishableKey,
  amountLabel,
  onSuccess,
  onError,
  onCancel,
}: {
  clientSecret: string;
  publishableKey: string;
  amountLabel: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, py: 1 }}>
      <Typography fontSize={12} color="#9CA3AF" fontWeight={600} textAlign="center">
        Enter card details to charge {amountLabel}
      </Typography>
      <Elements options={{ clientSecret }} stripe={getStripePromise(publishableKey)}>
        <InnerForm amountLabel={amountLabel} onSuccess={onSuccess} onError={onError} onCancel={onCancel} />
      </Elements>
    </Box>
  );
}
