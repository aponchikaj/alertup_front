import React, { useEffect } from 'react';

interface Props {
  plan: string;
  price: number;
}

const WalletsButton = ({ plan, price }: Props) => {
  // Apple Pay flow
  const startApplePay = async () => {
    if (!window.ApplePaySession) return alert('Apple Pay not supported on this device/browser');

    const request: any = {
      countryCode: 'US',
      currencyCode: 'USD',
      total: { label: 'AlertUp', amount: String(price) },
      supportedNetworks: ['visa', 'masterCard', 'amex'],
      merchantCapabilities: ['supports3DS']
    };

    const session = new (window as any).ApplePaySession(3, request);

    session.onvalidatemerchant = async (e: any) => {
      try {
        const res = await fetch('/api/payments/apple-validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ validationURL: e.validationURL })
        });
        const merchantSession = await res.json();
        if (!res.ok) {
          alert(merchantSession.Message || 'Merchant validation not configured');
          session.abort();
          return;
        }
        session.completeMerchantValidation(merchantSession);
      } catch (err) {
        console.error('Merchant validation error', err);
        session.abort();
      }
    };

    session.onpaymentauthorized = async (e: any) => {
      try {
        // Send payment token to backend for processing
        const token = e.payment.token;
        const r = await fetch('/api/payments/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token, amount: price, plan, method: 'apple' })
        });
        const data = await r.json();
        if (!data.Success) {
          session.completePayment((window as any).ApplePaySession.STATUS_FAILURE);
          alert(data.Message || 'Payment failed');
        } else {
          session.completePayment((window as any).ApplePaySession.STATUS_SUCCESS);
          window.location.href = '/premium/success';
        }
      } catch (err) {
        console.error('Apple pay processing error', err);
        session.completePayment((window as any).ApplePaySession.STATUS_FAILURE);
      }
    };

    session.begin();
  };

  // Google Pay flow
  const startGooglePay = async () => {
    try {
      if (!(window as any).google || !(window as any).google.payments) {
        // Load script dynamically
        const script = document.createElement('script');
        script.src = 'https://pay.google.com/gp/p/js/pay.js';
        script.onload = () => initGooglePay();
        document.head.appendChild(script);
      } else {
        initGooglePay();
      }
    } catch (err) {
      console.error('Google Pay load error', err);
      alert('Google Pay not available');
    }
  };

  const initGooglePay = async () => {
    const paymentsClient = new (window as any).google.payments.api.PaymentsClient({ environment: 'TEST' });
    const baseRequest = { apiVersion: 2, apiVersionMinor: 0 };
    const tokenizationSpec = {
      type: 'PAYMENT_GATEWAY',
      parameters: { gateway: 'example', gatewayMerchantId: 'exampleGatewayMerchantId' }
    };
    const cardPaymentMethod = {
      type: 'CARD',
      parameters: { allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'], allowedCardNetworks: ['AMEX', 'MASTERCARD', 'VISA'] },
      tokenizationSpecification: tokenizationSpec
    };

    const paymentDataRequest = Object.assign({}, baseRequest, {
      allowedPaymentMethods: [cardPaymentMethod],
      merchantInfo: { merchantName: 'AlertUp' },
      transactionInfo: { totalPriceStatus: 'FINAL', totalPrice: String(price), currencyCode: 'USD' }
    });

    try {
      const paymentData = await paymentsClient.loadPaymentData(paymentDataRequest);
      const token = paymentData.paymentMethodData.tokenizationData.token;
      const r = await fetch('/api/payments/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, amount: price, plan, method: 'google' })
      });
      const data = await r.json();
      if (!data.Success) return alert(data.Message || 'Payment failed');
      window.location.href = '/premium/success';
    } catch (err) {
      console.error('Google Pay error', err);
      alert('Google Pay error');
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        {typeof (window as any).ApplePaySession !== 'undefined' && (
          <button onClick={startApplePay} style={{ padding: '8px 12px', borderRadius: 8, background: '#000', color: '#fff' }}>
            Pay with Apple Pay
          </button>
        )}
        <button onClick={startGooglePay} style={{ padding: '8px 12px', borderRadius: 8, background: '#4285F4', color: '#fff' }}>
          Pay with Google Pay
        </button>
      </div>
    </div>
  );
};

export default WalletsButton;
